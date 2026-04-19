@echo off
title Anti-YouTube Uninstaller
echo Anti-YouTube uninstaller
echo ========================
echo.
echo This will:
echo  - Stop the running Anti-YouTube process (if any)
echo  - Remove the YouTube block from your hosts file
echo  - Delete the encrypted state file
echo  - Delete the anti-youtube:// URL scheme registry entry
echo  - Delete this entire folder
echo.
pause
echo.

echo Stopping running instance...
taskkill /F /IM anti-youtube.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo Running cleanup (accept the UAC prompt)...
powershell -NoProfile -Command "Start-Process -FilePath '%~dp0anti-youtube.exe' -ArgumentList '--uninstall' -Verb RunAs -Wait"

echo.
echo Cleanup complete. Removing folder...
start "" /b cmd /c "timeout /t 2 /nobreak >nul && rd /s /q \"%~dp0\""
exit
