@echo off
rem Starts Barfly's voice server (Chatterbox-Turbo) on port 8880. Close this window to stop it.
rem Uses the environment in voice\.venv unless BARFLY_VOICE_PYTHON points at another python.exe.
rem It listens on this machine only. To let another machine on your network use it (SillyTavern, say),
rem set BARFLY_VOICE_HOST=0.0.0.0 first, and allow port 8880 through your firewall.
cd /d "%~dp0"
if not defined HF_HOME set "HF_HOME=%~dp0.hf"
if not defined BARFLY_VOICE_HOST set "BARFLY_VOICE_HOST=127.0.0.1"
set "PY=.venv\Scripts\python.exe"
if defined BARFLY_VOICE_PYTHON set "PY=%BARFLY_VOICE_PYTHON%"
"%PY%" -m uvicorn server:app --host %BARFLY_VOICE_HOST% --port 8880
