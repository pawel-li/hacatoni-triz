"""TRIZ prompt runner that yields structured streaming events."""

from __future__ import annotations

import json
import time
from collections.abc import Iterator
from typing import Any
from uuid import uuid4

from ai_agent.gemini import GeminiCostMeter, generate_json


def stream_triz_candidates(
    problem: str, meter: GeminiCostMeter | None = None
) -> Iterator[dict[str, Any]]:
    """Yield contradiction + candidate events only (no evaluation).

    Used by the combined run, where all candidates from both agents are
    evaluated together at the end.
    """
    normalized_problem = problem.strip()
    cost_meter = meter or GeminiCostMeter()

    yield _event("log", "TRIZ: reformulating problem as a technical contradiction...")
    contradiction = _reformulate_contradiction(normalized_problem, cost_meter)
    yield _event(
        "contradiction_found",
        f"Technical contradiction identified: {contradiction.get('triz_contradiction_statement', '')}",
        {"contradiction": contradiction},
    )

    yield _event("log", "TRIZ: generating candidate solutions...")
    for i, raw in enumerate(_generate_triz_solutions(normalized_problem, contradiction, cost_meter)[:3]):
        candidate = {
            "id": f"T{i + 1}",
            "zrodlo_mechanizmu": "TRIZ - " + str(raw.get("principle_used", "")),
            "tytul": str(raw.get("name", "")),
            "opis": str(raw.get("description", "")),
            "method": "triz",
        }
        yield _event(
            "candidate",
            f"Generated TRIZ candidate: {candidate['tytul']}.",
            {"candidate": candidate},
        )


def stream_triz_run(problem: str) -> Iterator[dict[str, Any]]:
    """Yield JSON-serializable events for a standalone TRIZ prompt run.

    Emits the same event types the frontend diagram understands
    (contradiction_found, candidate with T* ids, scored, run_cost,
    run_completed).
    """
    normalized_problem = problem.strip()
    meter = GeminiCostMeter()

    yield _event(
        "run_started",
        "TRIZ run started.",
        {"problem": normalized_problem, "model": meter.model, "provider": meter.provider},
    )

    candidates: list[dict[str, Any]] = []
    contradiction: dict[str, Any] = {}
    for event in stream_triz_candidates(normalized_problem, meter):
        if event.get("type") == "candidate":
            candidates.append(event.get("payload", {}).get("candidate") or {})
        elif event.get("type") == "contradiction_found":
            contradiction = event.get("payload", {}).get("contradiction") or {}
        yield event

    yield _event("log", "TRIZ: evaluating candidate solutions...")
    evaluation = _score_triz_candidates(normalized_problem, candidates, meter)
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
        "TRIZ run completed.",
        {
            "reasoningTrail": {
                "method": "triz",
                "problem": normalized_problem,
                "function_query": "",
                "similarity_ranking": [],
                "selected_mechanisms": [],
                "candidates": candidates,
                "contradiction": contradiction,
                "evaluation": evaluation,
            },
            "cost": cost,
        },
    )


def _score_triz_candidates(
    problem: str, candidates: list[dict[str, Any]], meter: GeminiCostMeter | None = None
) -> dict[str, Any]:
    """Evaluate T* candidates and build a diagram-compatible evaluation."""
    raw = [
        {
            "name": c.get("tytul", ""),
            "description": c.get("opis", ""),
            "principle_used": c.get("zrodlo_mechanizmu", ""),
        }
        for c in candidates
    ]
    evaluations = _evaluate_candidates(problem, raw, meter)
    selection = _select_best_candidate(problem, evaluations, meter)

    candidate_scores: list[dict[str, Any]] = []
    for i, candidate in enumerate(candidates):
        ev = next(
            (e for e in evaluations if e.get("candidate_name") == candidate.get("tytul")),
            evaluations[i] if i < len(evaluations) else {},
        )
        score = min(max(int(ev.get("score", 5)) * 10, 0), 100)
        candidate_scores.append(
            {
                "id": candidate.get("id", f"T{i + 1}"),
                "tytul": candidate.get("tytul", ""),
                "score": score,
                "criteria": [
                    {"name": "Zalety", "score": min(len(ev.get("pros", [])) * 25, 100), "weight": 0.5},
                    {"name": "Wady", "score": max(0, 100 - len(ev.get("cons", [])) * 25), "weight": 0.5},
                ],
                "rationale": "; ".join(ev.get("pros", [])[:2]),
            }
        )

    selected_name = selection.get("selected_candidate_name", "")
    best_id = next(
        (c.get("id") for c in candidates if c.get("tytul") == selected_name),
        None,
    )
    if not best_id and candidate_scores:
        best_id = max(candidate_scores, key=lambda s: s["score"])["id"]
    overall = next(
        (s["score"] for s in candidate_scores if s["id"] == best_id),
        max((s["score"] for s in candidate_scores), default=0),
    )

    return {
        "overallScore": overall,
        "bestCandidateId": best_id or "",
        "verdict": selection.get("reasoning", ""),
        "candidateScores": candidate_scores,
    }


def _reformulate_contradiction(
    problem: str, meter: GeminiCostMeter | None = None
) -> dict[str, Any]:
    try:
        return json.loads(_call_llm(
            f"""You are a TRIZ expert.
Analyze the following problem and identify the single most important Technical Contradiction.
A technical contradiction occurs when improving one parameter of a system causes another parameter to worsen.

Problem: {problem}

Instructions:
- Name the two conflicting parameters using their exact names (with numbers) from the 39 TRIZ engineering parameters.
- State the contradiction in one clear sentence grounded in the problem's specifics (reuse its numbers and constraints).
- From the classical Contradiction Matrix cell for those two parameters, recommend 3-5 Inventive Principles, each formatted "N. Name" (e.g. "1. Segmentation").

Respond ONLY with pure JSON (no markdown, no ```), with fields:
feature_to_improve, feature_that_worsens, triz_contradiction_statement, triz_inventive_principles (list of strings).""",
            meter,
        ))
    except Exception:
        return _fallback_contradiction(problem)


def _generate_triz_solutions(
    problem: str, contradiction: dict, meter: GeminiCostMeter | None = None
) -> list[dict[str, str]]:
    try:
        result = json.loads(_call_llm(
            f"""You are a senior R&D engineer. Use the TRIZ contradiction analysis below to generate exactly 3 distinct, concrete solutions to the problem.

Problem: {problem}
Contradiction Analysis: {json.dumps(contradiction, ensure_ascii=False)}

Requirements:
- Each solution must apply a DIFFERENT inventive principle from the analysis; name it in principle_used exactly as given.
- Each description must be 2-4 sentences naming the specific structure/geometry, material or mechanism, and explaining how it improves the target parameter WITHOUT worsening the conflicting one.
- Address the concrete constraints and numbers from the problem statement.
- No vague marketing language; every solution must be feasible to prototype with today's materials and manufacturing.
- Write name and description in the same language as the problem statement.

Respond ONLY with pure JSON (no markdown, no ```), with a single field:
candidates (list of objects with fields: name, description, principle_used).""",
            meter,
        ))
        return result.get("candidates", [])
    except Exception:
        return _fallback_solutions(contradiction)


def _evaluate_candidates(
    problem: str, candidates: list[dict], meter: GeminiCostMeter | None = None
) -> list[dict[str, Any]]:
    try:
        result = json.loads(_call_llm(
            f"""You are a product manager evaluating R&D proposals.
Evaluate the following candidate solutions strictly against the original problem and its constraints.

Problem: {problem}
Candidates: {json.dumps(candidates, ensure_ascii=False)}

Provide an evaluation for each candidate, including pros, cons, and a score from 1-10 on feasibility and impact.
Use the full 1-10 range and differentiate the candidates: penalize concepts that are vague, hard to manufacture, or ignore the problem's numeric constraints; reward concrete geometry/material choices with a clear causal link to the requirements.
Respond ONLY with pure JSON (no markdown, no ```), with a single field:
evaluations (list of objects with fields: candidate_name, pros (list), cons (list), score (int 1-10)).""",
            meter,
        ))
        return result.get("evaluations", [])
    except Exception:
        return _fallback_evaluations(candidates)


def _select_best_candidate(
    problem: str, evaluations: list[dict], meter: GeminiCostMeter | None = None
) -> dict[str, str]:
    try:
        return json.loads(_call_llm(
            f"""You are the Chief Innovation Officer. Review the evaluations of the candidate solutions and select the best one to pursue.

Problem: {problem}
Evaluations: {json.dumps(evaluations)}

Explain your full reasoning trail: why this one was chosen over the others.
Respond ONLY with pure JSON (no markdown, no ```), with fields:
selected_candidate_name, reasoning.""",
            meter,
        ))
    except Exception:
        return _fallback_selection(evaluations)


def _call_llm(prompt: str, meter: GeminiCostMeter | None = None) -> str:
    return generate_json(prompt, meter=meter)


# --- Fallbacks (when no API key is available) ---

def _fallback_contradiction(problem: str) -> dict[str, Any]:
    return {
        "feature_to_improve": "Ochrona produktu",
        "feature_that_worsens": "Biodegradowalnosc materialu",
        "triz_contradiction_statement": (
            f"[FALLBACK] Poprawa ochrony produktu pogarsza biodegradowalnosc. Problem: {problem[:100]}"
        ),
        "triz_inventive_principles": [
            "Principle 35: Parameter changes",
            "Principle 28: Mechanics substitution",
            "Principle 40: Composite materials",
        ],
    }


def _fallback_solutions(contradiction: dict) -> list[dict[str, str]]:
    principles = contradiction.get("triz_inventive_principles", ["Generic TRIZ principle"])
    return [
        {
            "name": f"Rozwiazanie TRIZ {i+1}",
            "description": f"[FALLBACK - brak GEMINI_API_KEY] Koncept oparty na zasadzie: {p}",
            "principle_used": p,
        }
        for i, p in enumerate(principles[:3])
    ]


def _fallback_evaluations(candidates: list[dict]) -> list[dict[str, Any]]:
    return [
        {
            "candidate_name": c.get("name", f"Candidate {i+1}"),
            "pros": ["Innowacyjne podejscie", "Zgodnosc z TRIZ"],
            "cons": ["[FALLBACK] Wymaga dalszej analizy"],
            "score": 6,
        }
        for i, c in enumerate(candidates)
    ]


def _fallback_selection(evaluations: list[dict]) -> dict[str, str]:
    best = max(evaluations, key=lambda e: e.get("score", 0)) if evaluations else {}
    return {
        "selected_candidate_name": best.get("candidate_name", "Unknown"),
        "reasoning": "[FALLBACK - brak GEMINI_API_KEY] Wybrano kandydata z najwyzszym wynikiem.",
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
