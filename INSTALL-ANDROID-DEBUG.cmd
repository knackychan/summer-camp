@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
rem Installs the debug APK on EVERY authorized connected device/emulator.
call npm run android:doctor:strict -- --require-device
if errorlevel 1 goto :fail

set "ADB=adb"
where adb >nul 2>nul
if errorlevel 1 set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%\platform-tools\adb.exe" set "ADB=%ANDROID_SDK_ROOT%\platform-tools\adb.exe"

set /a OK=0
set /a BAD=0
for /f "skip=1 tokens=1,2" %%A in ('"%ADB%" devices') do (
  if "%%B"=="device" (
    echo.
    echo === Installing on %%A ===
    call npm run android:install -- --serial %%A
    if errorlevel 1 (set /a BAD+=1) else (set /a OK+=1)
  ) else if not "%%B"=="" (
    echo Skipping %%A: state is %%B, not authorized/ready.
  )
)

echo.
echo Summer Quest debug APK: !OK! device(s) installed, !BAD! failed.
if !OK! EQU 0 goto :fail
if !BAD! GTR 0 goto :fail
pause
exit /b 0
:fail
echo.
echo Android install failed. Review the messages above.
pause
exit /b 1
