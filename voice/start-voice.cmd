@echo off
rem Starts Barfly's voice server (Chatterbox-Turbo) on port 8880. Close this window to stop it.
rem
rem The Python environment is looked for in this order:
rem   1. BARFLY_VOICE_PYTHON, if you set it to a python.exe
rem   2. voice\.venv           (the README's install)
rem   3. ..\..\barfly-voice    (a sibling folder next to the project, to keep 5 GB out of the repo)
rem
rem It listens on this machine only. To let another machine on your network use it (SillyTavern, say),
rem set BARFLY_VOICE_HOST=0.0.0.0 first, and allow port 8880 through your firewall.
setlocal
cd /d "%~dp0"

netstat -ano | findstr /r /c:":8880 .*LISTENING" >nul
if not errorlevel 1 (
  echo The voice server is already running on port 8880. Nothing to start.
  echo Its page is at http://127.0.0.1:8880/ui
  echo To restart it, close the window it is running in, then run this again.
  goto hold
)

set "PY=%BARFLY_VOICE_PYTHON%"
if defined PY if exist "%PY%" goto found
set "PY=%~dp0.venv\Scripts\python.exe"
if exist "%PY%" (
  if not defined HF_HOME set "HF_HOME=%~dp0.hf"
  goto found
)
set "PY=%~dp0..\..\barfly-voice\.venv\Scripts\python.exe"
if exist "%PY%" (
  if not defined HF_HOME set "HF_HOME=%~dp0..\..\barfly-voice\.hf"
  goto found
)

echo No voice environment found. See "The cloned voice" in the README to install one.
goto hold

:found
if not defined BARFLY_VOICE_HOST set "BARFLY_VOICE_HOST=127.0.0.1"
echo Starting the voice. Its page will be at http://127.0.0.1:8880/ui once it says "ready".
"%PY%" -m uvicorn server:app --host %BARFLY_VOICE_HOST% --port 8880
echo.
echo The voice server stopped.

:hold
rem when this was double-clicked, keep the window open so the message can be read
echo %CMDCMDLINE% | findstr /i /c:" /c " >nul && pause
endlocal
