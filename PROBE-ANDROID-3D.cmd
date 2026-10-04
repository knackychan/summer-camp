@echo off
setlocal
cd /d "%~dp0"
rem Black-screen probe: opens Solar System, Monster Truck and Brick Lab inside the
rem app on the USB tablet and records what its GPU draws. Open the app first.
rem Add --browser to probe Chrome on the tablet instead of the app.
call npm run android:probe-3d -- %*
if errorlevel 1 goto :fail
pause
exit /b 0
:fail
echo.
echo 3D probe failed. Review the messages above.
pause
exit /b 1
