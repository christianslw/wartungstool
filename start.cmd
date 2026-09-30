@echo off
rem ===========================================================================
rem  Wartungstool – Testserver starten (SQLite + REST-API)
rem  Voraussetzung: Node.js ab Version 22.5  (node -v zum Pruefen)
rem
rem  Das Frontend laeuft ohne Server ebenfalls: index.html doppelklicken.
rem  Dann werden die eingebauten Testdaten aus dem Browser-Speicher genutzt.
rem ===========================================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js wurde nicht gefunden.
  echo   Die Anwendung laeuft auch ohne Server: einfach index.html doppelklicken.
  echo.
  pause
  exit /b 1
)

start "" "http://localhost:8080/?api=http://localhost:8080/api"
node server.mjs
pause
