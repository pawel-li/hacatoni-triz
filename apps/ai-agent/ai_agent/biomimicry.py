"""Biomimicry prompt runner that yields structured streaming events."""

from __future__ import annotations

import json
import os
import time
from collections.abc import Iterator
from typing import Any
from uuid import uuid4

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

DEFAULT_FUNCTION_QUERY = (
    "ochrona przed uderzeniami mechanicznymi i utrata wilgoci, "
    "lekka struktura, pelna biodegradacja lub kompostowalnosc po uzyciu"
)

BIOMIMICRY_DB = [
    {
        "id": "B01",
        "organism": "Jajko kurze",
        "mechanism": "Skorupka warstwowa z mikroporami",
        "function": "cienka, sztywna powloka chroni delikatna zawartosc przed uderzeniami "
        "i naciskiem, a mikroskopijne pory umozliwiaja wymiane gazowa i naturalny rozklad",
        "principle": "wytrzymalosc przez geometrie kopuly, nie grubosc materialu",
    },
    {
        "id": "B02",
        "organism": "Grzybnia (mycelium)",
        "mechanism": "Siec strzepek grzybowych spajajaca odpady organiczne",
        "function": "tworzy sztywna, lekka strukture ochronna z odpadow rolniczych, "
        "w pelni kompostowalna w ciagu tygodni",
        "principle": "wzrost struktury zamiast produkcji materialu, pelna biodegradacja",
    },
    {
        "id": "B03",
        "organism": "Skorka pomaranczy",
        "mechanism": "Wielowarstwowa, elastyczna okrywa z gabczasta warstwa wewnetrzna",
        "function": "amortyzuje uderzenia mechaniczne, chroni przed utrata wilgoci, "
        "w pelni jadalna i biodegradowalna",
        "principle": "amortyzacja przez warstwe porowata, ochrona przed wysychaniem",
    },
    {
        "id": "B04",
        "organism": "Muszla mieczaka (macica perlowa / nacre)",
        "mechanism": "Naprzemienne mikrowarstwy weglanu wapnia i bialka",
        "function": "bardzo wysoka wytrzymalosc na uderzenia przy minimalnej ilosci materialu, "
        "pekniecia nie propaguja sie przez cala strukture",
        "principle": "warstwowa architektura zatrzymuje pekniecia, wytrzymalosc bez grubosci",
    },
    {
        "id": "B05",
        "organism": "Siec pajecza",
        "mechanism": "Wlokno bialkowe o wysokiej wytrzymalosci na rozciaganie",
        "function": "duza wytrzymalosc przy bardzo malej masie materialu, w pelni biodegradowalne",
        "principle": "maksymalna wytrzymalosc na jednostke masy materialu",
    },
    {
        "id": "B06",
        "organism": "Szyszka sosnowa",
        "mechanism": "Luski reagujace na wilgotnosc (otwieraja/zamykaja sie)",
        "function": "struktura zmienia ksztalt i przepuszczalnosc w reakcji na wilgoc, "
        "bez zadnych ruchomych czesci mechanicznych",
        "principle": "aktuacja pasywna sterowana wilgotnoscia, zero energii z zewnatrz",
    },
    {
        "id": "B07",
        "organism": "Lisc lotosu",
        "mechanism": "Mikro- i nanostruktura powierzchni odpychajaca wode i brud",
        "function": "powierzchnia samoczyszczaca sie, odporna na wilgoc bez powlok chemicznych",
        "principle": "wlasciwosci hydrofobowe przez mikrostrukture, nie przez powloke chemiczna",
    },
    {
        "id": "B08",
        "organism": "Struktura plastra miodu (pszczoly)",
        "mechanism": "Regularna siatka szesciokatnych komorek",
        "function": "maksymalna wytrzymalosc konstrukcyjna przy minimalnym zuzyciu materialu",
        "principle": "geometria heksagonalna optymalizuje relacje wytrzymalosc/material",
    },
    {
        "id": "B09",
        "organism": "Skora jezozwierza / kolce jeza",
        "mechanism": "Sztywne wypustki rozpraszajace punktowy nacisk",
        "function": "rozprasza sile uderzenia na wieksza powierzchnie, chroniac rdzen",
        "principle": "rozpraszanie sil punktowych przez strukture powierzchniowa",
    },
    {
        "id": "B10",
        "organism": "Nasiona roslin (np. mniszek, klon)",
        "mechanism": "Lekka struktura wloknista transportowana przez wiatr",
        "function": "ochrona zarodka przy minimalnej masie materialu opakowujacego",
        "principle": "minimalizacja masy materialu ochronnego wzgledem chronionej zawartosci",
    },
]


def stream_biomimicry_run(
    problem: str, function_query: str | None = None, top_n: int = 3
) -> Iterator[dict[str, Any]]:
    """Yield JSON-serializable events for a biomimicry prompt run."""
    normalized_problem = problem.strip()
    normalized_query = (function_query or DEFAULT_FUNCTION_QUERY).strip()

    yield _event(
        "run_started",
        "Biomimicry run started.",
        {"problem": normalized_problem, "functionQuery": normalized_query},
    )
    yield _event(
        "database_loaded",
        f"Loaded {len(BIOMIMICRY_DB)} biomimicry mechanisms from database.",
        {"databaseCount": len(BIOMIMICRY_DB)},
    )
    yield _event("log", "Building TF-IDF similarity model.")

    ranking, feature_count, corpus_size = _rank_mechanisms(normalized_query)
    yield _event(
        "vectorized",
        "Built TF-IDF matrix and calculated cosine similarity scores.",
        {"featureCount": feature_count, "corpusSize": corpus_size},
    )
    yield _event(
        "ranking",
        "Mechanism ranking is ready.",
        {"ranking": ranking, "functionQuery": normalized_query},
    )

    selected_entries = [
        entry
        for row in ranking[:top_n]
        for entry in BIOMIMICRY_DB
        if entry["id"] == row["id"]
    ]
    selected_ids = [entry["id"] for entry in selected_entries]
    candidates: list[dict[str, str]] = []

    for entry in selected_entries:
        yield _event(
            "mechanism_selected",
            f"Selected {entry['organism']} - {entry['mechanism']}.",
            {"mechanism": _public_entry(entry)},
        )
        yield _event("log", f"Generating concept for {entry['id']}.")
        candidate = _generate_concept_from_mechanism(normalized_problem, entry)
        candidates.append(candidate)
        yield _event(
            "candidate",
            f"Generated candidate: {candidate['tytul']}.",
            {"candidate": candidate},
        )

    evaluation = _evaluate_candidates(candidates, ranking)
    yield _event(
        "scored",
        f"Best solution scored {evaluation['overallScore']}/100.",
        {"evaluation": evaluation},
    )

    reasoning_trail = {
        "method": "biomimicry",
        "problem": normalized_problem,
        "function_query": normalized_query,
        "similarity_ranking": ranking,
        "selected_mechanisms": selected_ids,
        "candidates": candidates,
        "evaluation": evaluation,
    }
    yield _event(
        "run_completed",
        "Biomimicry run completed.",
        {"reasoningTrail": reasoning_trail},
    )


def _evaluate_candidates(
    candidates: list[dict[str, str]], ranking: list[dict[str, Any]]
) -> dict[str, Any]:
    """Score each generated candidate and pick the strongest solution."""
    similarity_by_id = {row["id"]: float(row["similarity"]) for row in ranking}
    max_similarity = max(similarity_by_id.values(), default=0.0)

    weights = {"bio_match": 0.45, "detail": 0.30, "feasibility": 0.25}
    candidate_scores: list[dict[str, Any]] = []

    for candidate in candidates:
        similarity = similarity_by_id.get(candidate["id"], 0.0)
        bio_match = similarity / max_similarity if max_similarity > 0 else 0.0
        detail = min(len(candidate.get("opis", "")) / 220.0, 1.0)
        feasibility = 0.45 if candidate.get("fallback") else 1.0

        criteria = [
            {
                "name": "Dopasowanie biomimetyczne",
                "score": round(bio_match * 100),
                "weight": weights["bio_match"],
            },
            {
                "name": "Szczegolowosc rozwiazania",
                "score": round(detail * 100),
                "weight": weights["detail"],
            },
            {
                "name": "Wykonalnosc",
                "score": round(feasibility * 100),
                "weight": weights["feasibility"],
            },
        ]
        score = round(
            (
                bio_match * weights["bio_match"]
                + detail * weights["detail"]
                + feasibility * weights["feasibility"]
            )
            * 100
        )
        candidate_scores.append(
            {
                "id": candidate["id"],
                "tytul": candidate.get("tytul", ""),
                "score": score,
                "criteria": criteria,
                "rationale": _score_rationale(score, candidate),
            }
        )

    best = max(candidate_scores, key=lambda item: item["score"], default=None)
    overall_score = best["score"] if best else 0
    best_id = best["id"] if best else ""

    return {
        "overallScore": overall_score,
        "bestCandidateId": best_id,
        "verdict": _score_verdict(overall_score),
        "candidateScores": candidate_scores,
    }


def _score_rationale(score: int, candidate: dict[str, str]) -> str:
    if candidate.get("fallback"):
        return "Wygenerowano lokalny fallback (brak GEMINI_API_KEY) - obniza wykonalnosc."
    if score >= 75:
        return "Silne dopasowanie mechanizmu i konkretny, wdrozalny opis rozwiazania."
    if score >= 55:
        return "Rozsadne rozwiazanie, ktore zyskaloby na doprecyzowaniu materialu i procesu."
    return "Slabe dopasowanie funkcjonalne - rozwaz inny mechanizm biomimetyczny."


def _score_verdict(overall_score: int) -> str:
    if overall_score >= 75:
        return "Silne rozwiazanie gotowe do prototypowania."
    if overall_score >= 55:
        return "Obiecujace rozwiazanie, wymaga dopracowania."
    return "Slabe dopasowanie - rozwaz inne mechanizmy."


def _rank_mechanisms(function_query: str) -> tuple[list[dict[str, Any]], int, int]:
    corpus = [entry["function"] for entry in BIOMIMICRY_DB] + [function_query]
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(corpus)
    similarities = cosine_similarity(tfidf_matrix[-1], tfidf_matrix[:-1]).flatten()
    feature_count = len(vectorizer.get_feature_names_out())

    rows = [
        {
            "id": entry["id"],
            "organism": entry["organism"],
            "mechanism": entry["mechanism"],
            "similarity": float(similarities[index]),
        }
        for index, entry in enumerate(BIOMIMICRY_DB)
    ]
    return sorted(rows, key=lambda row: row["similarity"], reverse=True), feature_count, len(corpus)


def _generate_concept_from_mechanism(
    problem: str, entry: dict[str, str]
) -> dict[str, str]:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    if api_key:
        parsed = _generate_with_gemini(api_key, problem, entry)
    else:
        parsed = {
            "tytul": "Koncept inspirowany: " + entry["organism"],
            "opis": "[PLACEHOLDER - brak GEMINI_API_KEY] Rozwiniecie mechanizmu "
            + entry["mechanism"]
            + " ("
            + entry["principle"]
            + ") w konkretny projekt opakowania dla podanego problemu.",
            "fallback": True,
        }

    return {
        "id": entry["id"],
        "zrodlo_mechanizmu": entry["organism"] + " - " + entry["mechanism"],
        "tytul": str(parsed["tytul"]),
        "opis": str(parsed["opis"]),
        "fallback": bool(parsed.get("fallback", False)),
    }


def _generate_with_gemini(
    api_key: str, problem: str, entry: dict[str, str]
) -> dict[str, str]:
    from google import genai
    from google.genai import types

    prompt = f"""Jestes inzynierem projektujacym ekologiczne opakowania.

Problem: {problem}

Mechanizm z natury do wykorzystania jako inspiracja:
- Organizm: {entry["organism"]}
- Mechanizm: {entry["mechanism"]}
- Funkcja: {entry["function"]}
- Zasada dzialania: {entry["principle"]}

Zaproponuj JEDEN konkretny, wdrozalny koncept opakowania inspirowany tym mechanizmem.
Odpowiedz WYLACZNIE czystym JSON (bez markdown, bez ```), z polami:
tytul (krotki, 3-6 slow) i opis (2-3 zdania, konkretnie jak dziala i z jakiego materialu)."""

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    return json.loads(response.text or "{}")


def _public_entry(entry: dict[str, str]) -> dict[str, str]:
    return {
        "id": entry["id"],
        "organism": entry["organism"],
        "mechanism": entry["mechanism"],
        "function": entry["function"],
        "principle": entry["principle"],
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
