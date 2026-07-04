"""Minimal HTTP server exposing the ai-agent over HTTP (for Cloud Run)."""

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from ai_agent.hello import hello


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"message": hello()}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(os.environ.get("PORT", 8080))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
