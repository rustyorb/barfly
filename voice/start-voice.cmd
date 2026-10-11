@echo off
rem Starts Barfly's voice server (Chatterbox-Turbo) on port 8880. Close this window to stop it.
rem Uses the environment in voice\.venv unless BARFLY_VOICE_PYTHON points at another python.exe.
cd /d "%~dp0"
if not defined HF_HOME set "HF_HOME=%~dp0.hf"
set "PY=.venv\Scripts\python.exe"
if defined BARFLY_VOICE_PYTHON set "PY=%BARFLY_VOICE_PYTHON%"
"%PY%" -m uvicorn server:app --host 127.0.0.1 --port 8880
