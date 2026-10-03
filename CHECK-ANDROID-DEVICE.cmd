@echo off
setlocal
cd /d "%~dp0"
call npm run android:device
if errorlevel 1 goto :fail
echo.
echo Next: complete apps\android\ACCEPTANCE-CHECKLIST.md on the physical tablet.
exit /b 0
:fail
echo.
echo Android device check failed. Review the messages above.
exit /b 1
