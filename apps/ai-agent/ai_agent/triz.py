"""TRIZ prompt runner that yields structured streaming events."""

from __future__ import annotations

import json
import time
from collections.abc import Iterator
from typing import Any
from uuid import uuid4

from ai_agent.gemini import GeminiCostMeter, generate_json


def stream_triz_stub_run(problem: str) -> Iterator[dict[str, Any]]:
    """Temporary TRIZ stub: does no work, just reports start and completion."""
    normalized_problem = problem.strip()
    meter = GeminiCostMeter()

    yield _event(
        "run_started",
        "TRIZ agent started.",
        {
            "problem": normalized_problem,
            "agent": "triz",
            "model": meter.model,
            "provider": meter.provider,
        },
    )
    cost = meter.summary()
    yield _event(
        "run_cost",
        f"Estimated Gemini cost: ${cost['totalCostUsd']:.6f}.",
        {"cost": cost},
    )
    yield _event("run_completed", "TRIZ agent done.", {"agent": "triz", "cost": cost})


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
    """Yield JSON-serializable events for a TRIZ prompt run."""
    normalized_problem = problem.strip()
    meter = GeminiCostMeter()

    yield _event(
        "run_started",
        "TRIZ run started.",
        {"problem": normalized_problem, "model": meter.model, "provider": meter.provider},
    )

    yield _event("log", "Step 1: Reformulating problem as Technical Contradiction...")

    contradiction = _reformulate_contradiction(normalized_problem, meter)
    yield _event(
        "contradiction_found",
        f"Technical contradiction identified: {contradiction.get('triz_contradiction_statement', '')}",
        {"contradiction": contradiction},
    )

    yield _event("log", "Step 2: Generating TRIZ candidate solutions...")
    candidates = _generate_triz_solutions(normalized_problem, contradiction, meter)
    for i, candidate in enumerate(candidates):
        yield _event(
            "triz_candidate",
            f"TRIZ candidate {i+1}: {candidate.get('name', '')}",
            {"candidate": candidate},
        )

    yield _event("log", "Step 3: Evaluating TRIZ candidates...")
    evaluations = _evaluate_candidates(normalized_problem, candidates, meter)
    yield _event(
        "triz_evaluated",
        f"Evaluated {len(evaluations)} candidates.",
        {"evaluations": evaluations},
    )

    yield _event("log", "Step 4: Selecting best candidate...")
    selection = _select_best_candidate(normalized_problem, evaluations, meter)
    yield _event(
        "triz_selected",
        f"Selected: {selection.get('selected_candidate_name', '')}",
        {"selection": selection},
    )

    overall_score = _compute_overall_score(evaluations, selection)
    yield _event(
        "scored",
        f"Best solution scored {overall_score}/100.",
        {
            "evaluation": {
                "overallScore": overall_score,
                "bestCandidateId": selection.get("selected_candidate_name", ""),
                "verdict": selection.get("reasoning", ""),
                "candidateScores": [
                    {
                        "id": ev.get("candidate_name", f"T{i+1}"),
                        "tytul": ev.get("candidate_name", ""),
                        "score": ev.get("score", 0) * 10,
                        "criteria": [
                            {"name": "Pro", "score": len(ev.get("pros", [])) * 20, "weight": 0.5},
                            {"name": "Con", "score": max(0, 100 - len(ev.get("cons", [])) * 20), "weight": 0.5},
                        ],
                        "rationale": "; ".join(ev.get("pros", [])),
                    }
                    for i, ev in enumerate(evaluations)
                ],
            }
        },
    )

    reasoning_trail = {
        "method": "triz",
        "problem": normalized_problem,
        "function_query": "",
        "similarity_ranking": [],
        "selected_mechanisms": [],
        "candidates": [
            {
                "id": f"T{i+1}",
                "zrodlo_mechanizmu": c.get("principle_used", "TRIZ"),
                "tytul": c.get("name", ""),
                "opis": c.get("description", ""),
            }
            for i, c in enumerate(candidates)
        ],
        "contradiction": contradiction,
        "triz_evaluations": evaluations,
        "triz_selection": selection,
    }
    cost = meter.summary()
    yield _event(
        "run_cost",
        f"Estimated Gemini cost: ${cost['totalCostUsd']:.6f}.",
        {"cost": cost},
    )
    yield _event(
        "run_completed",
        "TRIZ run completed.",
        {"reasoningTrail": reasoning_trail, "cost": cost},
    )


def _reformulate_contradiction(
    problem: str, meter: GeminiCostMeter | None = None
) -> dict[str, Any]:
    try:
        return json.loads(_call_llm(
            f"""You are a TRIZ expert.
Analyze the following problem and identify the Technical Contradiction.
A technical contradiction occurs when improving one parameter of a system causes another parameter to worsen.

Problem: {problem}

Identify the 39 TRIZ parameters involved.
What is the feature to improve? What is the feature that worsens?
Based on the Contradiction Matrix, what are the recommended Inventive Principles?

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
            f"""You are an R&D engineer. Use the following TRIZ contradiction and principles to generate exactly 3 distinct packaging solutions for the problem.

Problem: {problem}
Contradiction Analysis: {json.dumps(contradiction)}

Ensure the solutions are practical, innovative, and directly address the problem.
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
Evaluate the following candidate solutions against the original problem.

Problem: {problem}
Candidates: {json.dumps(candidates)}

Provide an evaluation for each candidate, including pros, cons, and a score from 1-10 on feasibility and impact.
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


def _compute_overall_score(evaluations: list[dict], selection: dict) -> int:
    selected_name = selection.get("selected_candidate_name", "")
    for ev in evaluations:
        if ev.get("candidate_name") == selected_name:
            return min(ev.get("score", 5) * 10, 100)
    if evaluations:
        return min(max(ev.get("score", 5) for ev in evaluations) * 10, 100)
    return 50


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
