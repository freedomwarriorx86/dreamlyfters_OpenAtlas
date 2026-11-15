# Starts (or restarts) OpenAtlas on a Windows host laid out as:
#   C:\openatlas\backend   FastAPI app (main.py ...)
#   C:\openatlas\frontend  built frontend (frontend/dist)
#   C:\openatlas\serve.py  static server + /api proxy (deploy/serve.py)
#   C:\openatlas\venv      Python venv with backend\requirements.txt installed
# Processes are started through WMI so they survive the SSH session.
#   powershell -ExecutionPolicy Bypass -File C:\openatlas\start.ps1 [-Tunnel]
param([switch]$Tunnel)
$root = 'C:\openatlas'
New-Item -ItemType Directory -Force "$root\logs", "$root\cache" | Out-Null

function Stop-Matching($pattern) {
  Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like $pattern } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; "stopped $($_.ProcessId)" }
}
function Launch($cmd) {
  (Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{ CommandLine = "cmd.exe /c $cmd"; CurrentDirectory = $root }).ProcessId
}

Stop-Matching '*uvicorn main:app*'
Stop-Matching '*serve.py*'
Start-Sleep 1
"backend pid "  + (Launch "set OPENATLAS_CACHE_DIR=$root\cache&& cd /d $root\backend&& $root\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 >> $root\logs\backend.log 2>&1")
"frontend pid " + (Launch "set OPENATLAS_ROOT=$root\frontend&& $root\venv\Scripts\python.exe $root\serve.py 80 >> $root\logs\frontend.log 2>&1")

if ($Tunnel) {
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
  "tunnel pid " + (Launch "$root\cloudflared.exe tunnel --no-autoupdate --url http://localhost:80 > $root\logs\tunnel.log 2>&1")
  Start-Sleep 15
}
Start-Sleep 6
try { "health: " + (Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 http://localhost/api/health).StatusCode } catch { "health FAILED: $_" }
Select-String -Path "$root\logs\tunnel.log" -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
  ForEach-Object { $_.Matches.Value } | Select-Object -Last 1
