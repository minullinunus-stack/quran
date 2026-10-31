@echo off
chcp 65001 >nul
title Hatam bot
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  ) else (
    echo.
    echo Node.js not found. Install it from https://nodejs.org and run start.bat again.
    echo.
    pause
    exit /b 1
  )
)

node tools\start.js

echo.
echo Bot stopped. To start again, run start.bat.
pause
