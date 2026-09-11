@echo off
REM ============================================================
REM  Glyph Palette - launcher
REM  Starts the Tauri desktop app in dev mode: Vite + a native
REM  window with hot-reload. The first run recompiles the Rust
REM  side and can take a few minutes; later runs are fast.
REM
REM  If you move the repo, edit REPO below.
REM ============================================================
setlocal
set "REPO=D:\Glyph Palette"
set "PORT=1420"

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
echo   GLYPH PALETTE   -   dev mode: Vite + Tauri, hot-reload
echo ===============================================================
echo.
echo   The app window opens once the build finishes. Keep this
echo   window open while you use it - closing it stops the app.
echo   Ctrl+C here also stops it.
echo.
echo ===============================================================
echo.
call npm run tauri dev
echo.
echo   Glyph Palette dev server stopped.
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
echo   [!] Port %PORT% is already in use - a Glyph Palette dev server
echo       is probably already running. Close it, then rerun this.
echo.
pause
exit /b 1
