@echo off
setlocal
cd /d "%~dp0"
if not exist "server\agent-proxy\.env" (
  echo.
  echo Copy server\agent-proxy\.env.example to server\agent-proxy\.env first,
  echo then add the provider API keys you want to compare.
  echo.
  pause
  exit /b 1
)
echo.
echo Starting Summer Quest in AI LAB mode.
echo This intentionally permits manual model-profile comparison from the admin AI Lab.
echo Do not expose this development server directly to the public Internet.
echo.
call npm run agent:serve:lab
if errorlevel 1 pause
