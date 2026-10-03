@echo off
setlocal
cd /d "%~dp0"
call npm run android:doctor:strict -- --require-device
if errorlevel 1 goto :fail
call npm run android:install
if errorlevel 1 goto :fail
echo.
echo Summer Quest debug APK installed successfully.
exit /b 0
:fail
echo.
echo Android install failed. Review the messages above.
exit /b 1
