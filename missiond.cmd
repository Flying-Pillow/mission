@echo off
setlocal
set "CORE_DIR=%~dp0packages\core"
set "SOURCE_ENTRY=%CORE_DIR%\src\daemon\missiond.ts"
set "BUILD_ENTRY=%CORE_DIR%\build\daemon\missiond.js"

if /i "%MISSION_DAEMON_LAUNCH_MODE%"=="source" if exist "%SOURCE_ENTRY%" (
	call pnpm --dir "%CORE_DIR%" exec tsx "%SOURCE_ENTRY%" %*
	exit /b %ERRORLEVEL%
)

if exist "%BUILD_ENTRY%" (
	call node "%BUILD_ENTRY%" %*
	exit /b %ERRORLEVEL%
)

if exist "%SOURCE_ENTRY%" (
	call pnpm --dir "%CORE_DIR%" exec tsx "%SOURCE_ENTRY%" %*
	exit /b %ERRORLEVEL%
)

echo missiond: no daemon entrypoint found. Build the mission-core package first. 1>&2
exit /b 1
