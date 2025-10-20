@echo off
REM Portable make shim for Windows. Supports a few common targets used in AGENTS.md
setlocal enabledelayedexpansion

if "%~1"=="" goto :help

set target=%~1
shift

if /I "%target%"=="preview" goto :preview
if /I "%target%"=="generate-snapshots" goto :snapshots
if /I "%target%"=="approve-baseline" goto :approve
goto :help

:preview
  echo [make] preview -> npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
  call npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
  goto :eof

:snapshots
  echo [make] generate-snapshots starting
  call npm run build || goto :fail
  call npm run snapshots:install || goto :fail
  if not exist tests\playwright\visual.spec.ts-snapshots (
    echo [make] no baseline found -> creating initial snapshots
    call npm run snapshots:update || goto :fail
  ) else (
    call npm run test:visual || goto :fail
  )
  echo [make] running devtools landing hero check (non-blocking)
  call npm run devtools:landing-hero || echo [make] warning: devtools check failed (continuing)
  echo [make] generate-snapshots done
  goto :eof

:approve
  echo [make] approve-baseline -> npm run approve-baseline
  call npm run approve-baseline
  goto :eof

:help
  echo Usage: make ^<target^>
  echo   preview               Start Vite preview on 127.0.0.1:4173
  echo   generate-snapshots    Build app, install browsers, run visual tests and devtools check
  echo   approve-baseline      Update Playwright snapshot baselines
  exit /b 2

:fail
  echo [make] command failed with error %errorlevel%
  exit /b %errorlevel%
