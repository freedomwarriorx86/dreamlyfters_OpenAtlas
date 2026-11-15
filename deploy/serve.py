"""
OpenAtlas static server: serves the built frontend and proxies /api/* to the
FastAPI backend (uvicorn). Used instead of `python -m http.server` because the
frontend calls the API with relative /api URLs.

    python serve.py [port]

Environment: OPENATLAS_ROOT (default C:\\openatlas\\frontend),
             OPENATLAS_BACKEND (default http://127.0.0.1:8000)
"""
import http.server
import os
import sys
import urllib.error
import urllib.request

ROOT = os.environ.get("OPENATLAS_ROOT", r"C:\openatlas\frontend")
BACKEND = os.environ.get("OPENATLAS_BACKEND", "http://127.0.0.1:8000").rstrip("/")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 80
HOP = {"connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade",
       "proxy-authenticate", "proxy-authorization", "content-length", "content-encoding"}


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
                      ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".wasm": "application/wasm"}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):  # keep the console quiet; errors still go to stderr
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)

    def end_headers(self):
        p = self.path.split("?", 1)[0]
        if p.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif p.startswith("/media/"):
            self.send_header("Cache-Control", "public, max-age=604800")
        elif not p.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _proxy(self):
        req = urllib.request.Request(BACKEND + self.path, method=self.command)
        for k in ("Accept", "User-Agent", "Content-Type"):
            if self.headers.get(k):
                req.add_header(k, self.headers[k])
        body = None
        if self.command == "POST":
            body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        try:
            resp = urllib.request.urlopen(req, data=body, timeout=300)
        except urllib.error.HTTPError as e:
            resp = e
        except Exception as e:
            self.send_error(502, f"Backend unavailable: {e}")
            return
        data = resp.read()
        self.send_response(resp.status if hasattr(resp, "status") else resp.code)
        for k, v in resp.headers.items():
            if k.lower() not in HOP:
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith(("/api/", "/docs", "/openapi.json")):
            return self._proxy()
        # single-page app: unknown extension-less paths -> index.html
        p = self.path.split("?", 1)[0]
        if not os.path.exists(os.path.join(ROOT, p.lstrip("/"))) and "." not in os.path.basename(p):
            self.path = "/index.html" + (self.path[len(p):] if len(self.path) > len(p) else "")
        return super().do_GET()

    do_HEAD = do_GET

    def do_POST(self):
        return self._proxy() if self.path.startswith("/api/") else self.send_error(405)


if __name__ == "__main__":
    http.server.ThreadingHTTPServer.daemon_threads = True
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
