"""Flashcards Study App package."""

import http.server
import os
import socketserver
import webbrowser
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    os.chdir(root)
    port = 8000
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        url = f"http://localhost:{port}/index.html"
        print(f"Serving Flashcards app at {url}")
        try:
            webbrowser.open(url)
        except Exception:  # pragma: no cover
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server.")


if __name__ == "__main__":
    main()
