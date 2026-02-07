@echo off
echo Starting fix script...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_fixes.ps1"
echo.
echo Injecting cloud-ready scripts...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare_for_cloud.ps1"
echo.
echo Done.
pause