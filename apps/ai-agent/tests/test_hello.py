"""Hello unit test module."""

from ai_agent.biomimicry import stream_biomimicry_run
from ai_agent.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello ai-agent"


def test_stream_biomimicry_run_yields_ordered_fallback_events(monkeypatch):
    """Test biomimicry run events without external model credentials."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_GENAI_USE_VERTEXAI", raising=False)

    events = list(stream_biomimicry_run("Protect apples in transport."))
    event_types = [event["type"] for event in events]

    assert event_types[0] == "run_started"
    assert "database_loaded" in event_types
    assert "vectorized" in event_types
    assert "ranking" in event_types
    assert event_types.count("mechanism_selected") == 3
    assert event_types.count("candidate") == 3
    assert event_types[-1] == "run_completed"
    assert events[0]["payload"]["problem"] == "Protect apples in transport."
    assert "reasoningTrail" in events[-1]["payload"]
