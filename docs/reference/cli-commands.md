---
layout: default
title: CLI Commands
parent: Reference
nav_order: 1
---

# CLI Commands

This page documents the public Mission CLI surface as it is actually routed today. The source of truth is the published CLI package in `packages/mission`, plus the Airport layout router in `apps/airport/terminal/src/routeAirportTerminalSurfaceEntry.ts`.

## Public Commands

The current public command surface is:

| Command | Status | What it does |
| --- | --- | --- |
| `mission` | Public | Opens the Airport layout |
| `mission install` | Public | Runs user-level Mission setup and writes operator config |
| `mission airport:status` | Public | Prints daemon airport status, or JSON with `--json` |
| `mission daemon:stop` | Public | Stops the daemon process and reports the result |
| `mission help` | Public | Prints the supported surface and notes |
| `missiond` | Public bin | Starts, stops, inspects, or runs the daemon process |

The package is published as `@flying-pillow/mission`.

One-shot use:

```bash
npx @flying-pillow/mission
```

Global install:

```bash
npm install -g @flying-pillow/mission
mission
missiond status
```

## `mission`

```bash
mission [--hmr] [--banner] [--no-banner]
```

Behavior verified in the current CLI package and Airport layout router:

- runs the installation guard before the Airport layout starts
- opens the Airport layout by default, with Tower as the left-side control surface
- auto-starts the daemon when needed
- attempts airport layout bootstrap through the terminal manager on POSIX shells when available
- auto-selects a mission when opened from a mission worktree
- opens repository mode when opened from the repository checkout
- provisions or validates the Mission-managed Bun runtime envelope before opening the OpenTUI Airport terminal surfaces when defaults are in use

Supported terminal flags are currently limited to:

- `--hmr`
- `--banner`
- `--no-banner`

## `mission install`

```bash
mission install [--json]
```

This command performs user-level setup:

- ensures Mission user config exists
- ensures the mission workspace root exists
- provisions or validates the pinned Bun runtime
- provisions or validates the pinned terminal manager runtime
- provisions or validates the pinned editor runtime

With `--json`, it prints the config path, the effective config object, the resolved missions path, and the managed runtime path.

## `mission airport:status`

```bash
mission airport:status [--json]
```

This command connects to the daemon and reports airport control-plane state, including:

- active airport identity
- pane bindings
- connected clients
- substrate pane state
- known repository airports
- focus intent and observed focus

## `mission daemon:stop`

```bash
mission daemon:stop [--json]
```

This command stops the daemon process using the current manifest and reports whether a process was killed, which socket was involved, and whether the daemon was already stopped.

## `missiond`

```bash
missiond [start|stop|restart|status|run] [--json] [--socket <path>]
```

This bin is shipped by the same `@flying-pillow/mission` package and delegates to the daemon runtime package. It is the direct process-control entry for:

- starting the daemon in the background
- stopping the daemon
- restarting it
- checking status
- running it in the foreground

## Internal Bootstrap Hooks

The router also contains internal commands used for airport surface bootstrap:

- `__airport-layout-open__`
- `__airport-layout-briefing-room-pane`
- `__airport-layout-runway-pane`

These are implementation hooks for airport layout startup. They are not part of the supported public CLI contract and should not be documented as operator-facing commands.

## About `mission init`

There is a `runInit` implementation in source, but the router does not expose `mission init` as a supported public command. It should therefore be treated as internal or legacy scaffolding code rather than as current public CLI.

That distinction matters because repository adoption is currently exposed through Airport control actions, not through a direct repo-mutating CLI init. In practice, `/init` in the Airport command surface prepares the first initialization mission worktree and lets repository scaffolding be reviewed as normal mission work.