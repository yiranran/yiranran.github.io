#!/usr/bin/env python3
"""
Tiny HTTP server for local preview that sets Cache-Control: no-store
on every response. Defaults to 0.0.0.0:8765, root = current working dir.

Usage:
    python3 scripts/serve.py [port]
"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    httpd = HTTPServer(("0.0.0.0", port), NoCacheHandler)
    print(f"Serving on http://0.0.0.0:{port}/  (no-cache headers)")
    httpd.serve_forever()
