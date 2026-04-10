---
layout: default
title: Installation
parent: Getting Started
nav_order: 1
---

# Installation

Mission installation is about preparing your machine to act as an operator console. It is not yet about adopting a specific repository or starting a specific mission.

Mission separates setup into two layers:

- user-level setup for the machine that will run Tower
- repository-level setup for each Git checkout you want Mission to manage

This page covers the first layer only.

## Install Mission

Install the package globally:

```bash
npm install -g @flying-pillow/mission
```

Then run the installer:

```bash
mission install
```

That prepares the operator environment without launching the full Tower session.

## What The Installer Sets Up

The current installer prepares the things Mission needs in order to feel smooth on first run:

| Area | What Mission sets up |
| --- | --- |
| Operator config | Creates the Mission user config file |
| Mission workspace root | Chooses where isolated mission workspaces and worktrees will live |
| Terminal substrate | Resolves the terminal manager Mission uses for the airport layout |
| Editor integration | Resolves the editor binary used in the editor gate |

In the current implementation, the user config is written to the usual XDG config location when available, otherwise under `~/.config/mission/config.json`.

## What Mission Expects On Your Machine

These current runtime facts matter:

| Requirement | Why it matters |
| --- | --- |
| Bun | Required for the Tower runtime today |
| Node.js | Still fine for non-Tower commands |
| zellij | Preferred terminal substrate for the airport layout |
| An editor binary | Needed for the editor gate |
| The daemon | Auto-started by Tower when needed |

On Linux, Mission can auto-install some dependencies, including `zellij`, into the local user bin path when they are missing.

## Your First Run

For most operators, the first good run looks like this:

```bash
npm install -g @flying-pillow/mission
mission install
mission
```

What happens next:

1. Mission validates the operator setup.
2. Tower launches.
3. The daemon starts automatically if it is not already running.
4. If repository control state is missing, Mission can scaffold it on the way in.

On POSIX shells, Mission also tries to bootstrap the airport-style terminal layout so the Tower, agent session pane, and editor gate open as one coordinated surface.

## Why The Setup Matters

The goal is not to make installation complicated. The goal is to make operation predictable.

Once installation is done:

- your mission workspaces have a known home
- Tower knows which terminal and editor tools to use
- reconnecting to Mission feels consistent across repositories

That is part of the product promise: Mission should feel like a real operations tool, not a pile of one-off scripts.

## What This Page Does Not Cover

This page does not adopt a repository and does not start a mission.

Those come next:

- [Repository Setup](repository-setup.md)
- [Start Your First Mission](start-your-first-mission.md)