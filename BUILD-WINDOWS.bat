@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current LTS version from https://nodejs.org/
  pause
  exit /b 1
)

echo Installing dependencies...
call npm install
if errorlevel 1 goto :failed

echo Running tests...
call npm run check
if errorlevel 1 goto :failed

echo Building ChatMonJA for Windows 11 x64...
call npm run package:win
if errorlevel 1 goto :failed

echo.
echo Build complete. Look in the out folder for the Windows ZIP.
pause
exit /b 0

:failed
echo.
echo Build failed. Review the error above.
pause
exit /b 1
