@echo off
echo Starting fix script...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_fixes.ps1"
echo.
echo Done.
pause