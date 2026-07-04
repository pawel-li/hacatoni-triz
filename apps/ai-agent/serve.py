"""Minimal HTTP server exposing the ai-agent over HTTP (for Cloud Run)."""

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from ai_agent.biomimicry import stream_biomimicry_run
from ai_agent.hello import hello


def _load_dotenv():
    """Load repo-root .env into os.environ (without overriding existing vars)."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"message": hello()}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/run/stream":
            self.send_error(404)
            return

        try:
            payload = self._read_json_body()
            prompt = str(payload.get("prompt", "")).strip()
            function_query = payload.get("functionQuery")

            if not prompt:
                self.send_error(400, "Missing prompt")
                return

            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()

            for event in stream_biomimicry_run(prompt, function_query):
                self._write_sse_event(event)
            self.close_connection = True
        except BrokenPipeError:
            return
        except Exception as exc:  # noqa: BLE001
            if not self.wfile.closed:
                self._write_sse_event(
                    {
                        "id": "stream-error",
                        "type": "error",
                        "timestamp": "",
                        "message": "Ai-agent stream failed.",
                        "payload": {"detail": str(exc)},
                    }
                )

    def _read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b"{}"
        return json.loads(raw_body.decode("utf-8") or "{}")

    def _write_sse_event(self, event):
        frame = "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"
        self.wfile.write(frame.encode("utf-8"))
        self.wfile.flush()


def main():
    _load_dotenv()
    port = int(os.environ.get("PORT", 8080))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
