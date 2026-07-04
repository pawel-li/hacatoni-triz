"""Hello unit test module."""

from ai_agent.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello ai-agent"
