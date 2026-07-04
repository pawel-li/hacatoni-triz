"""Combined biomimicry + TRIZ runner.

Runs both agents side by side, collects all candidate solutions (3 biomimicry
+ 3 TRIZ), then evaluates them together with an LLM agent and emits a single
`scored` event so the frontend can highlight the best solution.
"""

from __future__ import annotations

import json
import queue
import threading
import time
from collections.abc import Iterator
from typing import Any
from uuid import uuid4

from ai_agent.biomimicry import DEFAULT_FUNCTION_QUERY, stream_biomimicry_run
from ai_agent.gemini import GeminiCostMeter
from ai_agent.triz import _call_llm, stream_triz_candidates

_SENTINEL = object()
_SUPPRESSED_EVENT_TYPES = {"run_started", "scored", "run_cost", "run_completed"}

# (display name, LLM response field, weight)
_CRITERIA = [
    ("Innowacyjnosc", "innovation", 0.3),
    ("Wykonalnosc", "feasibility", 0.4),
    ("Wplyw", "impact", 0.3),
]


def stream_both_run(
    problem: str, function_query: str | None = None
) -> Iterator[dict[str, Any]]:
    """Yield JSON-serializable events for a combined biomimicry + TRIZ run."""
    normalized_problem = problem.strip()
    normalized_query = (function_query or DEFAULT_FUNCTION_QUERY).strip()
    meter = GeminiCostMeter()

    yield _event(
        "run_started",
        "Combined biomimicry + TRIZ run started.",
        {
            "problem": normalized_problem,
            "functionQuery": normalized_query,
            "model": meter.model,
            "provider": meter.provider,
        },
    )

    bio_candidates: list[dict[str, Any]] = []
    triz_candidates: list[dict[str, Any]] = []

    yield from _merge_streams(
        _collect_candidates(
            stream_biomimicry_run(
                normalized_problem,
                normalized_query,
                meter=meter,
                emit_cost=False,
            ),
            "biomimicry",
            bio_candidates,
        ),
        _collect_candidates(
            stream_triz_candidates(normalized_problem, meter),
            "triz",
            triz_candidates,
        ),
    )

    candidates = bio_candidates + triz_candidates
    yield _event(
        "log",
        f"Collected {len(candidates)} candidate solutions "
        f"({len(bio_candidates)} biomimicry + {len(triz_candidates)} TRIZ).",
    )
    yield _event("log", "Evaluating all candidates with the LLM agent...")

    evaluation = _evaluate_all_candidates(normalized_problem, candidates, meter)
    yield _event(
        "scored",
        f"Best solution scored {evaluation['overallScore']}/100.",
        {"evaluation": evaluation},
    )
    cost = meter.summary()
    yield _event(
        "run_cost",
        f"Estimated Gemini cost: ${cost['totalCostUsd']:.6f}.",
        {"cost": cost},
    )

    yield _event(
        "run_completed",
        "Combined biomimicry + TRIZ run completed.",
        {
            "reasoningTrail": {
                "method": "both",
                "problem": normalized_problem,
                "function_query": normalized_query,
                "similarity_ranking": [],
                "selected_mechanisms": [],
                "candidates": candidates,
                "evaluation": evaluation,
            },
            "cost": cost,
        },
    )


def _collect_candidates(
    stream: Iterator[dict[str, Any]],
    method: str,
    sink: list[dict[str, Any]],
) -> Iterator[dict[str, Any]]:
    """Tag + capture candidate events; drop per-agent lifecycle/score events."""
    for event in stream:
        event_type = event.get("type")
        if event_type == "candidate":
            candidate = dict(event.get("payload", {}).get("candidate") or {})
            candidate.setdefault("method", method)
            sink.append(candidate)
            yield {**event, "payload": {**event.get("payload", {}), "candidate": candidate}}
            continue
        if event_type in _SUPPRESSED_EVENT_TYPES:
            continue
        yield event


def _merge_streams(*streams: Iterator[dict[str, Any]]) -> Iterator[dict[str, Any]]:
    """Run event generators side by side, yielding events as they arrive."""
    events: queue.Queue[Any] = queue.Queue()

    def pump(stream: Iterator[dict[str, Any]]) -> None:
        try:
            for event in stream:
                events.put(event)
        except Exception as exc:  # noqa: BLE001
            events.put(_event("error", "Agent stream failed.", {"detail": str(exc)}))
        finally:
            events.put(_SENTINEL)

    for stream in streams:
        threading.Thread(target=pump, args=(stream,), daemon=True).start()

    remaining = len(streams)
    while remaining:
        item = events.get()
        if item is _SENTINEL:
            remaining -= 1
        else:
            yield item


def _evaluate_all_candidates(
    problem: str, candidates: list[dict[str, Any]], meter: GeminiCostMeter
) -> dict[str, Any]:
    """Score all candidates together with the LLM and pick the best one."""
    if candidates:
        try:
            return _llm_evaluation(problem, candidates, meter)
        except Exception:  # noqa: BLE001
            pass
    return _fallback_evaluation(candidates)


def _llm_evaluation(
    problem: str, candidates: list[dict[str, Any]], meter: GeminiCostMeter
) -> dict[str, Any]:
    summary = [
        {
            "id": c.get("id", ""),
            "method": c.get("method", ""),
            "tytul": c.get("tytul", ""),
            "opis": c.get("opis", ""),
            "zrodlo": c.get("zrodlo_mechanizmu", ""),
        }
        for c in candidates
    ]
    result = json.loads(_call_llm(
        f"""You are the Chief Innovation Officer comparing R&D proposals produced by two methods (biomimicry and TRIZ).

Problem: {problem}

Candidate solutions: {json.dumps(summary, ensure_ascii=False)}

Evaluate EVERY candidate against the problem. For each candidate score three criteria from 0 to 100:
innovation (novelty of the approach), feasibility (practicality to prototype and deploy), impact (how well it solves the problem).
Also give a one-sentence rationale per candidate, and an overall verdict naming the strongest solution and why it wins.

Respond ONLY with pure JSON (no markdown, no ```), with fields:
evaluations (list of objects with fields: id, innovation, feasibility, impact, rationale) - use the exact candidate ids provided;
verdict (string).""",
    meter,
    ))

    by_id = {str(c.get("id", "")): c for c in candidates}
    scores: list[dict[str, Any]] = []
    for item in result.get("evaluations", []):
        candidate_id = str(item.get("id", ""))
        if candidate_id not in by_id:
            continue
        criteria = [
            {"name": name, "score": _clamp_score(item.get(field, 0)), "weight": weight}
            for name, field, weight in _CRITERIA
        ]
        scores.append(
            {
                "id": candidate_id,
                "tytul": by_id[candidate_id].get("tytul", ""),
                "score": round(sum(c["score"] * c["weight"] for c in criteria)),
                "criteria": criteria,
                "rationale": str(item.get("rationale", "")),
            }
        )

    if not scores:
        raise ValueError("LLM returned no usable evaluations")

    best = max(scores, key=lambda s: s["score"])
    return {
        "overallScore": best["score"],
        "bestCandidateId": best["id"],
        "verdict": str(result.get("verdict", ""))
        or f"Najlepsze rozwiazanie: {best['tytul']}.",
        "candidateScores": scores,
    }


def _clamp_score(value: Any) -> int:
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return 0


def _fallback_evaluation(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    scores: list[dict[str, Any]] = []
    for candidate in candidates:
        detail = min(len(candidate.get("opis", "")) / 220.0, 1.0)
        feasibility = 45 if candidate.get("fallback") else 70
        criteria = [
            {"name": "Innowacyjnosc", "score": 60, "weight": 0.3},
            {"name": "Wykonalnosc", "score": feasibility, "weight": 0.4},
            {"name": "Wplyw", "score": round(detail * 100), "weight": 0.3},
        ]
        scores.append(
            {
                "id": candidate.get("id", ""),
                "tytul": candidate.get("tytul", ""),
                "score": round(sum(c["score"] * c["weight"] for c in criteria)),
                "criteria": criteria,
                "rationale": "[FALLBACK - brak GEMINI_API_KEY] Ocena heurystyczna.",
            }
        )

    best = max(scores, key=lambda s: s["score"], default=None)
    return {
        "overallScore": best["score"] if best else 0,
        "bestCandidateId": best["id"] if best else "",
        "verdict": "[FALLBACK] Wybrano kandydata z najwyzszym wynikiem heurystycznym.",
        "candidateScores": scores,
    }


def _event(
    event_type: str, message: str, payload: dict[str, Any] | None = None
) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "type": event_type,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "message": message,
        "payload": payload or {},
    }
