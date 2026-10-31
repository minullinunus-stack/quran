@echo off
chcp 65001 >nul
title Hatam bot - check
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  ) else (
    echo.
    echo Node.js not found. Install it from https://nodejs.org
    echo.
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :end
)

call npm run check

:end
echo.
pause
