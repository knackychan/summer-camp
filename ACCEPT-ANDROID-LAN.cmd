@echo off
setlocal
cd /d "%~dp0"
rem Brick Lab building-together checklist (multiplayer slice 07): two USB tablets with the debug APK, on the same wifi.
rem The first hosts a throwaway world, the second joins; both build for 10 minutes.
rem Pass --host <serial> --guest <serial> when more than two are connected.
call npm run android:accept-lan -- %*
if errorlevel 1 goto :fail
pause
exit /b 0
:fail
echo.
echo Building-together checklist failed. Review the messages above.
pause
exit /b 1
