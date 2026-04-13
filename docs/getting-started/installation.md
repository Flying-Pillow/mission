---
layout: default
title: Installation
parent: Getting Started
nav_order: 1
---

# Installation

Mission installation is about preparing your machine to run the published Mission CLI and Airport layout. It is not yet about adopting a specific repository or starting a specific mission.

Mission now treats the terminal runtime as part of the product surface, not as a grab bag of operator-managed tools.

Mission separates setup into two layers:

- user-level setup for the machine that will run the Mission CLI and Airport terminal surfaces
- repository-level setup for each Git checkout you want Mission to manage

This page covers the first layer only.

## Install Mission

You can run Mission directly from npm:

```bash
npx @flying-pillow/mission
```

If you want persistent `mission` and `missiond` commands, install the package globally:

```bash
npm install -g @flying-pillow/mission
```

Then run the installer:

```bash
mission install
```

That prepares the operator environment without opening the full Airport layout.

## What The Installer Sets Up

The current installer prepares the things Mission needs in order to feel smooth on first run:

| Area | What Mission sets up |
| --- | --- |
| Operator config | Creates the Mission user config file |
| Mission workspace root | Chooses where isolated mission workspaces and worktrees will live |
| Terminal substrate | Provisions or validates the pinned zellij runtime Mission uses for the airport layout |
| Editor integration | Provisions or validates the pinned micro runtime used in Briefing Room |
| Airport runtime | Provisions or validates the pinned Bun runtime used to launch the Airport surfaces |

In the current implementation, the user config is written to the usual XDG config location when available, otherwise under `~/.config/mission/config.json`. On supported Linux systems, Mission stores its managed runtime envelope under `~/.config/mission/runtime`.

## What Mission Expects On Your Machine

These current runtime facts matter:

| Requirement | Why it matters |
| --- | --- |
| Node.js | Needed to bootstrap the published Mission CLI |
| Bun | Used by the Airport terminal surfaces and provisioned by Mission on supported Linux systems |
| zellij | Preferred terminal substrate and provisioned by Mission on supported Linux systems |
| micro | Default Briefing Room editor and provisioned by Mission on supported Linux systems |
| The daemon | Auto-started by the Airport layout when needed |

On Linux, Mission installs pinned runtime binaries into its own runtime directory instead of relying on whatever happens to be in the general user bin path. If you want a different terminal manager, editor, or Bun binary, set explicit paths in the Mission user config and Mission will respect those overrides.

## Your First Run

For most operators, the first good run looks like this:

```bash
npm install -g @flying-pillow/mission
mission install
mission
```

What happens next:

1. Mission validates the operator setup.
2. Mission provisions or repairs the managed runtime envelope when defaults are in use.
3. Mission opens the Airport terminal layout.
4. The daemon starts automatically if it is not already running.
5. If repository control state is missing, Mission can scaffold it on the way in.

On POSIX shells, Mission also tries to bootstrap the Airport layout so Tower, Runway, and Briefing Room open as one coordinated operator environment.

## Why The Setup Matters

The goal is not to make installation complicated. The goal is to make operation predictable.

Once installation is done:

- your mission workspaces have a known home
- the Airport layout knows which pinned Bun, terminal, and editor runtimes to use
- reconnecting to Mission feels consistent across repositories

That is part of the product promise: Mission should feel like a real operations tool, not a pile of one-off scripts.

## What This Page Does Not Cover

This page does not adopt a repository and does not start a mission.

Those come next:

- [Repository Setup](repository-setup.md)
- [Start Your First Mission](start-your-first-mission.md)