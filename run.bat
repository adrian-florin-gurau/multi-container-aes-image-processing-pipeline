@echo off
setlocal
docker compose build
if errorlevel 1 exit /b %errorlevel%
docker compose up
