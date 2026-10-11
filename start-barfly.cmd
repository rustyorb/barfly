@echo off
rem Starts everything: his voice (if it is installed), the bar, and the page in your browser.
rem Run with --check to see what it would do without starting anything.
rem To stop: close the two minimized windows it opens ("Barfly voice" and "Barfly bar").
setlocal
cd /d "%~dp0"
set "CHECK="
if /i "%~1"=="--check" set "CHECK=1"

rem ---- his voice (optional). The environment may be in voice\.venv, or in a sibling folder "barfly-voice".
set "BARFLY_VOICE_PYTHON=%~dp0voice\.venv\Scripts\python.exe"
set "HF_HOME=%~dp0voice\.hf"
if exist "%BARFLY_VOICE_PYTHON%" goto voice_found
set "BARFLY_VOICE_PYTHON=%~dp0..\barfly-voice\.venv\Scripts\python.exe"
set "HF_HOME=%~dp0..\barfly-voice\.hf"
if exist "%BARFLY_VOICE_PYTHON%" goto voice_found
echo [voice] not installed. He will use the browser's voice. See the README to add a cloned one.
goto bar

:voice_found
call :listening 8880
if not errorlevel 1 (
  echo [voice] already running on port 8880.
  goto bar
)
echo [voice] starting. The first line he speaks takes about 20 seconds; after that about 2.
if not defined CHECK start "Barfly voice" /min cmd /k call "%~dp0voice\start-voice.cmd"

:bar
call :listening 5188
if not errorlevel 1 (
  echo [bar]   already running on port 5188.
  goto open
)
if not exist node_modules (
  echo [bar]   first run: installing.
  if not defined CHECK call npm install
)
if not exist public\data\brain\graph.bin.gz (
  echo [bar]   first run: downloading the fly brain, about 135 MB.
  if not defined CHECK call npm run data
)
echo [bar]   starting.
if defined CHECK goto done
start "Barfly bar" /min cmd /k npm run dev

:wait
call :listening 5188
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto wait
)

:open
echo [page]  http://localhost:5188
if not defined CHECK start "" http://localhost:5188

:done
if defined CHECK echo (check only: nothing was started)
endlocal
exit /b 0

:listening
netstat -ano | findstr /r /c:":%1 .*LISTENING" >nul
exit /b %errorlevel%
