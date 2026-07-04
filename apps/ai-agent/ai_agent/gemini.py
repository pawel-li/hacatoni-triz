"""Gemini client helpers and lightweight cost metering."""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from typing import Any

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite"
DEFAULT_INPUT_USD_PER_1M = 0.10
DEFAULT_OUTPUT_USD_PER_1M = 0.40


def configured_model() -> str:
    return os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL


def use_vertexai() -> bool:
    return os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def provider_name() -> str:
    if use_vertexai():
        return "vertex-ai"
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return "gemini-api"
    return "local"


def build_genai_client():
    """Create a google-genai client or return None when no credentials exist."""
    from google import genai

    if use_vertexai():
        project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get(
            "GOOGLE_CLOUD_PROJECT_ID"
        )
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
        return genai.Client(vertexai=True, project=project, location=location)

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        return genai.Client(api_key=api_key)

    return None


@dataclass
class GeminiCostSummary:
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int = 0
    input_cost_usd: float = 0.0
    output_cost_usd: float = 0.0
    total_cost_usd: float = 0.0
    currency: str = "USD"
    calls: int = 0
    pricing: str = "estimate"


class GeminiCostMeter:
    def __init__(self, model: str | None = None) -> None:
        self.model = model or configured_model()
        self.provider = provider_name()
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.total_tokens = 0
        self.cached_tokens = 0
        self.calls = 0
        self._lock = threading.Lock()

    def record(self, response: Any) -> None:
        usage = getattr(response, "usage_metadata", None)
        if usage is None:
            return

        prompt_tokens = _read_int(usage, "prompt_token_count")
        candidate_tokens = _read_int(usage, "candidates_token_count")
        thoughts_tokens = _read_int(usage, "thoughts_token_count")
        completion_tokens = candidate_tokens + thoughts_tokens
        total_tokens = _read_int(usage, "total_token_count") or prompt_tokens + completion_tokens
        cached_tokens = _read_int(usage, "cached_content_token_count")

        with self._lock:
            self.calls += 1
            self.prompt_tokens += prompt_tokens
            self.completion_tokens += completion_tokens
            self.total_tokens += total_tokens
            self.cached_tokens += cached_tokens

    def summary(self) -> dict[str, Any]:
        input_rate = _read_float_env("GEMINI_INPUT_USD_PER_1M", DEFAULT_INPUT_USD_PER_1M)
        output_rate = _read_float_env("GEMINI_OUTPUT_USD_PER_1M", DEFAULT_OUTPUT_USD_PER_1M)
        input_cost = self.prompt_tokens / 1_000_000 * input_rate
        output_cost = self.completion_tokens / 1_000_000 * output_rate
        summary = GeminiCostSummary(
            provider=self.provider,
            model=self.model,
            prompt_tokens=self.prompt_tokens,
            completion_tokens=self.completion_tokens,
            total_tokens=self.total_tokens,
            cached_tokens=self.cached_tokens,
            input_cost_usd=round(input_cost, 8),
            output_cost_usd=round(output_cost, 8),
            total_cost_usd=round(input_cost + output_cost, 8),
            calls=self.calls,
            pricing=f"estimated from ${input_rate}/1M input and ${output_rate}/1M output tokens",
        )
        return {
            "provider": summary.provider,
            "model": summary.model,
            "promptTokens": summary.prompt_tokens,
            "completionTokens": summary.completion_tokens,
            "totalTokens": summary.total_tokens,
            "cachedTokens": summary.cached_tokens,
            "inputCostUsd": summary.input_cost_usd,
            "outputCostUsd": summary.output_cost_usd,
            "totalCostUsd": summary.total_cost_usd,
            "currency": summary.currency,
            "calls": summary.calls,
            "pricing": summary.pricing,
        }


def generate_json(prompt: str, meter: GeminiCostMeter | None = None, client=None) -> str:
    from google.genai import types

    gemini_client = client or build_genai_client()
    if gemini_client is None:
        raise RuntimeError("No Gemini configuration available")

    model = meter.model if meter else configured_model()
    response = gemini_client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    if meter:
        meter.record(response)
    return response.text or "{}"


def _read_int(obj: Any, name: str) -> int:
    value = getattr(obj, name, None)
    if value is None and isinstance(obj, dict):
        value = obj.get(name)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _read_float_env(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default