@echo off
REM Builds dist\VSIMS.exe — a single-file, windowed (no console) executable.
REM Run this once on a Windows machine that has Python + pip available.
setlocal

echo === VSIMS build ===

REM 1. Make sure PyInstaller is available (installs it if missing).
python -m pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Installing PyInstaller...
    python -m pip install pyinstaller==6.10.0
    if errorlevel 1 goto :error
)

REM 2. Install the (optional) tray-icon runtime deps so the built exe has
REM    them available too — server.py degrades gracefully if these are
REM    missing, but the tray icon is worth having in the shipped build.
python -m pip install -r requirements.txt
if errorlevel 1 goto :error

REM 3. Clean previous build output.
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist VSIMS.spec del VSIMS.spec

REM 4. Build. --add-data bundles the static files server.py serves
REM    (STATIC_FILES) plus the SQL schema it reads on first run; the
REM    ";." means "place them at the root of the bundle", matching
REM    where server.py's BASE_DIR (sys._MEIPASS) expects to find them.
python -m PyInstaller ^
    --name VSIMS ^
    --onefile ^
    --windowed ^
    --add-data "VSIMS-Prototype.html;." ^
    --add-data "index.html;." ^
    --add-data "styles.css;." ^
    --add-data "app.js;." ^
    --add-data "js;js" ^
    --add-data "vsims_schema.sql;." ^
    server.py
if errorlevel 1 goto :error

echo.
echo === Build complete: dist\VSIMS.exe ===
echo Copy VSIMS.exe anywhere and double-click it. vsims.db and vsims.log
echo will be created next to it on first run.
goto :end

:error
echo.
echo === Build FAILED. See the output above for details. ===
exit /b 1

:end
endlocal
