@echo off
chcp 65001 >nul
setlocal

echo Stopping hanalite servers on ports 8000 (API) and 5180 (UI)...

powershell -NoProfile -File "%~dp0scripts\kill-ports.ps1"

echo.
echo You can close the "hanalite api" and "hanalite ui" windows if they are still open.
echo.
pause
