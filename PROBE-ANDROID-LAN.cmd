@echo off
setlocal
cd /d "%~dp0"
rem Home-wifi probe: two USB tablets with the debug APK, on the same wifi.
rem The first hosts, the second finds it, joins and sends a line each way.
rem Pass --host <serial> --guest <serial> when more than two are connected.
call npm run android:probe-lan -- %*
if errorlevel 1 goto :fail
pause
exit /b 0
:fail
echo.
echo LAN probe failed. Review the messages above.
pause
exit /b 1
