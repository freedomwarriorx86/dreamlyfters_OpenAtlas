# Deploying OpenAtlas

The frontend calls the API with relative `/api/...` URLs, so it must be served
from the same origin as the backend. `serve.py` does that: it serves the built
frontend and proxies `/api/*` to uvicorn.

## Windows host (current deployment)

```bash
# on the build machine
cd frontend && npm ci && npm run build
scp backend/*.py backend/requirements.txt HOST:C:/openatlas/backend/
scp -r frontend/dist/* HOST:C:/openatlas/frontend/
scp deploy/serve.py deploy/windows/start.ps1 HOST:C:/openatlas/
```

```powershell
# on the host, once
python -m venv C:\openatlas\venv
C:\openatlas\venv\Scripts\python -m pip install -r C:\openatlas\backend\requirements.txt
# download cloudflared-windows-amd64.exe to C:\openatlas\cloudflared.exe

# start / restart (add -Tunnel to also start a Cloudflare quick tunnel)
powershell -ExecutionPolicy Bypass -File C:\openatlas\start.ps1 -Tunnel
```

Logs are in `C:\openatlas\logs`, the archive cache in `C:\openatlas\cache`
(safe to delete). Processes do not survive a reboot; run `start.ps1` again.

## Environment variables

| variable | default | purpose |
| --- | --- | --- |
| `OPENATLAS_CACHE_DIR` | system temp `/openatlas_cache` | cutouts, PNGs, query results |
| `OPENATLAS_DOWNLOADS` | `4` | parallel IRSA cutout downloads (IRSA answers 503 above this) |
| `OPENATLAS_ROOT` | `C:\openatlas\frontend` | `serve.py`: directory with the built frontend |
| `OPENATLAS_BACKEND` | `http://127.0.0.1:8000` | `serve.py`: where `/api` is proxied |
| `OPENATLAS_API` | `http://localhost:8000` | `vite` dev server proxy target |
