#!/usr/bin/env bash
# Start the FastAPI backend (internal port 8000), warm the cache for the demo
# targets in the background, and serve the site + /api proxy on port 7860.
set -e
cd /app/backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 &
python /app/prewarm.py &
exec python /app/serve.py 7860
