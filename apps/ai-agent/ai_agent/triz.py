"""TRIZ prompt runner that yields structured streaming events."""

from __future__ import annotations

import json
import os
import time
from collections.abc import Iterator
from typing import Any
from uuid import uuid4


def stream_triz_run(problem: str) -> Iterator[dict[str, Any]]:
    """Yield JSON-serializable events for a TRIZ prompt run."""
    normalized_problem = problem.strip()

    yield _event(
        "run_started",
        "TRIZ run started.",
        {"problem": normalized_problem},
    )

    yield _event("log", "Step 1: Reformulating problem as Technical Contradiction...")

    contradiction = _reformulate_contradiction(normalized_problem)
    yield _event(
        "contradiction_found",
        f"Technical contradiction identified: {contradiction.get('triz_contradiction_statement', '')}",
        {"contradiction": contradiction},
    )

    yield _event("log", "Step 2: Generating TRIZ candidate solutions...")
    candidates = _generate_triz_solutions(normalized_problem, contradiction)
    for i, candidate in enumerate(candidates):
        yield _event(
            "triz_candidate",
            f"TRIZ candidate {i+1}: {candidate.get('name', '')}",
            {"candidate": candidate},
        )

    yield _event("log", "Step 3: Evaluating TRIZ candidates...")
    evaluations = _evaluate_candidates(normalized_problem, candidates)
    yield _event(
        "triz_evaluated",
        f"Evaluated {len(evaluations)} candidates.",
        {"evaluations": evaluations},
    )

    yield _event("log", "Step 4: Selecting best candidate...")
    selection = _select_best_candidate(normalized_problem, evaluations)
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
    yield _event(
        "run_completed",
        "TRIZ run completed.",
        {"reasoningTrail": reasoning_trail},
    )


def _reformulate_contradiction(problem: str) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return _fallback_contradiction(problem)
    try:
        return json.loads(_call_llm(
            api_key,
            f"""You are a TRIZ expert.
Analyze the following problem and identify the Technical Contradiction.
A technical contradiction occurs when improving one parameter of a system causes another parameter to worsen.

Problem: {problem}

Identify the 39 TRIZ parameters involved.
What is the feature to improve? What is the feature that worsens?
Based on the Contradiction Matrix, what are the recommended Inventive Principles?

Respond ONLY with pure JSON (no markdown, no ```), with fields:
feature_to_improve, feature_that_worsens, triz_contradiction_statement, triz_inventive_principles (list of strings).""",
        ))
    except Exception:
        return _fallback_contradiction(problem)


def _generate_triz_solutions(problem: str, contradiction: dict) -> list[dict[str, str]]:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return _fallback_solutions(contradiction)
    try:
        result = json.loads(_call_llm(
            api_key,
            f"""You are an R&D engineer. Use the following TRIZ contradiction and principles to generate exactly 3 distinct packaging solutions for the problem.

Problem: {problem}
Contradiction Analysis: {json.dumps(contradiction)}

Ensure the solutions are practical, innovative, and directly address the problem.
Respond ONLY with pure JSON (no markdown, no ```), with a single field:
candidates (list of objects with fields: name, description, principle_used).""",
        ))
        return result.get("candidates", [])
    except Exception:
        return _fallback_solutions(contradiction)


def _evaluate_candidates(problem: str, candidates: list[dict]) -> list[dict[str, Any]]:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return _fallback_evaluations(candidates)
    try:
        result = json.loads(_call_llm(
            api_key,
            f"""You are a product manager evaluating R&D proposals.
Evaluate the following candidate solutions against the original problem.

Problem: {problem}
Candidates: {json.dumps(candidates)}

Provide an evaluation for each candidate, including pros, cons, and a score from 1-10 on feasibility and impact.
Respond ONLY with pure JSON (no markdown, no ```), with a single field:
evaluations (list of objects with fields: candidate_name, pros (list), cons (list), score (int 1-10)).""",
        ))
        return result.get("evaluations", [])
    except Exception:
        return _fallback_evaluations(candidates)


def _select_best_candidate(problem: str, evaluations: list[dict]) -> dict[str, str]:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return _fallback_selection(evaluations)
    try:
        return json.loads(_call_llm(
            api_key,
            f"""You are the Chief Innovation Officer. Review the evaluations of the candidate solutions and select the best one to pursue.

Problem: {problem}
Evaluations: {json.dumps(evaluations)}

Explain your full reasoning trail: why this one was chosen over the others.
Respond ONLY with pure JSON (no markdown, no ```), with fields:
selected_candidate_name, reasoning.""",
        ))
    except Exception:
        return _fallback_selection(evaluations)


def _call_llm(api_key: str, prompt: str) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    return response.text or "{}"


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
