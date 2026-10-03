@echo off
setlocal
cd /d "%~dp0"
echo.
if not exist "server\agent-proxy\.env" (
  echo Summer Quest is starting in local-first mode without provider API keys.
  echo Learning, local hints, tablet UI and LAN serving still work.
  echo To enable live AI later, copy server\agent-proxy\.env.example to server\agent-proxy\.env.
  echo.
)
call npm run agent:serve
if errorlevel 1 pause
