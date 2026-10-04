@echo off
setlocal
cd /d "%~dp0"
call npm run android:doctor:strict
if errorlevel 1 goto :fail
call npm run android:build:debug
if errorlevel 1 goto :fail
echo.
echo Android debug APK built successfully. See apps\android\.reports\build-debug.json
pause
exit /b 0
:fail
echo.
echo Android debug build failed. Review the messages above.
pause
exit /b 1
