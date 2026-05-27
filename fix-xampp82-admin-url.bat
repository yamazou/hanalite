@echo off
setlocal

net session >nul 2>&1
if errorlevel 1 (
    echo Please run this file as Administrator:
    echo Right-click fix-xampp82-admin-url.bat -^> Run as administrator
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-xampp82-admin-url.ps1"
echo.
pause
