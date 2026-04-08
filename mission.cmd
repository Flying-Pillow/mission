@echo off
setlocal
set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%apps\tower\terminal"
set "MISSION_DAEMON_COMMAND=%ROOT_DIR%missiond.cmd"
set "HMR_MODE=0"

:parse_wrapper_flags
if "%~1"=="--hmr" (
	set "HMR_MODE=1"
	shift
	goto parse_wrapper_flags
)

if "%HMR_MODE%"=="1" (
	call pnpm --dir "%APP_DIR%" exec tsx watch src/index.ts %*
) else (
	call pnpm --dir "%APP_DIR%" exec tsx src/index.ts %*
)