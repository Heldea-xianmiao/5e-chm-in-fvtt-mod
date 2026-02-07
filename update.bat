@echo off
chcp 65001 > nul
echo Fixing encoding first (GBK -> UTF-8)...
python "%~dp0fix_encoding.py"
echo.
echo Starting fix script...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_fixes.ps1"
echo.
echo Injecting cloud-ready scripts...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\inject_cloud_bridge.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare_for_cloud.ps1"
echo.
echo Creating .nojekyll to prevent GitHub Pages build issues...
type nul > "%~dp0chm\.nojekyll"
echo.
echo Fixing Web compatibility (Paths and Encodings)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix_web_compatibility.ps1"
echo.
echo Done.
pause