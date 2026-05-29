@echo off
chcp 65001 >nul
setlocal

set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%
set FRONTEND=%ROOT%\frontend
set BACKEND=%ROOT%\backend
set URL=http://localhost:5180/

echo hanalite starting...

if not exist "%FRONTEND%\package.json" (
    echo ERROR: frontend not found: %FRONTEND%
    pause
    exit /b 1
)

REM Stop stale servers (including orphaned uvicorn worker processes).
echo Stopping any existing hanalite servers on ports 8000 and 5180...
powershell -NoProfile -File "%ROOT%\scripts\kill-ports.ps1"
timeout /t 2 /nobreak >nul

REM --- FastAPI (port 8000) ---
start "hanalite api" cmd /k "cd /d %BACKEND% && .venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000"

REM --- Vite (port 5180) ---
start "hanalite ui" cmd /k "cd /d %FRONTEND% && npm run dev"

echo Waiting for API health check...
set /a RETRY=0

:wait_api
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/v1/health' -TimeoutSec 3; if (-not $h.inventory_api) { Write-Host 'WARNING: API missing inventory routes. Run stop-hanalite.bat then start again.'; exit 2 }; if (-not $h.itemtyp_color_api) { Write-Host 'WARNING: API missing item type color support (stale server). Run stop-hanalite.bat then start again.'; exit 3 }; exit 0 } catch { exit 1 }"
if %ERRORLEVEL%==0 goto wait_ui
set /a RETRY+=1
if %RETRY% LSS 15 goto wait_api
echo WARNING: API did not become ready. Check the "hanalite api" window.

:wait_ui
echo Waiting for %URL% ...
set /a RETRY=0

:wait_loop
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2).StatusCode | Out-Null; exit 0 } catch { exit 1 }"
if %ERRORLEVEL%==0 goto open_browser

set /a RETRY+=1
if %RETRY% LSS 20 goto wait_loop

echo WARNING: UI did not respond in time. Opening browser anyway...
echo Check the "hanalite ui" window for npm errors.

:open_browser
start "" "%URL%"
echo Done. To stop servers, run stop-hanalite.bat or close API/UI windows after Ctrl+C.
pause
