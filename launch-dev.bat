@echo off
REM ============================================================
REM  GP Dev Mode - launcher for the work copy
REM  Starts the Tauri desktop app in dev mode: Vite + a native
REM  window with hot-reload. The first run recompiles the Rust
REM  side and can take a few minutes; later runs are fast.
REM
REM  Runs whichever copy this file sits in, on port 1440, so it
REM  can run alongside the stable Glyph Palette (port 1420).
REM ============================================================
setlocal
set "REPO=%~dp0."
set "PORT=1440"

if not exist "%REPO%\src-tauri\tauri.conf.json" goto :norepo

where npm >nul 2>nul
if errorlevel 1 goto :nonode

where cargo >nul 2>nul
if errorlevel 1 goto :norust

cd /d "%REPO%"

if not exist "node_modules\.bin\tauri" goto :install
:installed

netstat -ano | find ":%PORT% " | find "LISTENING" >nul
if not errorlevel 1 goto :portbusy

cls
echo ===============================================================
echo   GP DEV MODE   -   work copy, hot-reload (port 1440)
echo ===============================================================
echo.
echo   The app window opens once the build finishes. Keep this
echo   window open while you use it - closing it stops the app.
echo   Ctrl+C here also stops it.
echo.
echo ===============================================================
echo.
call npm run tauri dev -- --config src-tauri/tauri.devmode.conf.json
echo.
echo   GP Dev Mode stopped.
pause
exit /b 0

:norepo
echo.
echo   [!] Repo not found at:  %REPO%
echo       Edit REPO at the top of this script if you moved it.
echo.
pause
exit /b 1

:nonode
echo.
echo   [!] npm is not on PATH. Install Node.js first - https://nodejs.org
echo.
pause
exit /b 1

:norust
echo.
echo   [!] cargo/rustc not on PATH. The Tauri shell needs the Rust
echo       toolchain - install from https://rustup.rs then reopen.
echo.
pause
exit /b 1

:install
echo   Installing npm dependencies. This happens once.
call npm install
if errorlevel 1 goto :installfailed
goto :installed

:installfailed
echo.
echo   [!] npm install failed. Scroll up for the error.
echo.
pause
exit /b 1

:portbusy
echo.
echo   [!] Port %PORT% is already in use - GP Dev Mode
echo       is probably already running. Close it, then rerun this.
echo.
pause
exit /b 1
