---
layout: default
title: Repository Setup
parent: Getting Started
nav_order: 2
---

# Repository Setup

Repository setup is where Mission stops being a generic tool on your machine and becomes an operating system for a specific codebase.

The goal is simple: teach Mission enough about the repository that it can create missions safely, track them durably, and keep delivery work away from the primary checkout.

## What Repository Setup Means

Adopting a repository gives Mission three things:

- a place to store repository-level policy
- a way to find and manage missions for that repository
- a clean separation between control state and delivery work

In practical terms, Mission keeps repository control state under `.mission/`, while actual mission execution happens in isolated workspaces outside the main checkout.

That path model stays the same in both shared tracked mode and local-only contributor mode. A repository may choose to gitignore `.mission/`, but Mission still treats `.mission/` as the repository-bound control namespace rather than moving that state into user-scoped config.

## What The Operator Does

In the current control surface, repository discovery includes actions for:

- registering a repository
- switching between registered repositories
- editing repository setup
- browsing open GitHub issues once issue intake is configured

That means the operator journey is roughly:

1. Launch Mission and open the Airport layout.
2. Add or switch to the target repository.
3. Confirm repository setup and workflow defaults.
4. Start a mission when intake is ready; if this checkout is not initialized yet, Mission can bootstrap repository control in the first mission worktree.

## What Mission Creates

Repository setup creates repository-scoped control state, not a live mission runtime.

| Path | Purpose |
| --- | --- |
| `.mission/` | Root control directory |
| `.mission/settings.json` | Repository defaults for workflow, runtime, and tracking |
| external mission workspace root | Home for isolated mission worktrees |

The important rule is that `.mission/settings.json` belongs to the repository, while `mission.json` belongs to one specific mission.

## What Stays Clean

Mission is designed so repository setup does not mean “let the agent start editing the checkout.”

The safety model is:

- repository policy lives in `.mission/`
- mission execution lives in an external mission workspace
- the active checkout remains the control root, not the agent sandbox

That is one of the main reasons the product feels trustworthy in real work.

## Repository Defaults That Matter

The repository settings file can carry the defaults that make Mission feel tailored to a team instead of generic:

- workflow policy
- tracking provider
- instructions and skills paths
- default runtime and mode selection
- default model selection
- mission workspace root

For an architecture-minded team, this is where repository governance begins. Mission is not only tracking tasks. It is capturing the default operating policy for AI work in that repository.

## Repository Setup Is Not Mission Start

A repository can be adopted without any mission running.

That separation matters because Mission treats these as different concerns:

| Concern | Scope |
| --- | --- |
| Repository setup | Long-lived repository policy |
| Mission start | One bounded unit of delivery work |
| Mission runtime | Live execution state for that unit of work |

This is why repository setup does not create `mission.json`. That file only appears when a real mission has been prepared.

That separation does not mean the repository must already be initialized on the current checkout before the first mission can begin. In the current repository-adoption model, Mission may create `.mission/settings.json` inside the new mission worktree during first-mission preparation.

## GitHub And Review-Oriented Teams

Mission's implemented intake and repository preparation flows are GitHub-centered today. That is useful for governance-heavy teams because repository scaffolding and mission intake can be reconciled with real issue tracking and normal review expectations.

The product direction here is strong: Mission wants repository adoption to feel like establishing a safe operating envelope, not sneaking hidden metadata into a codebase.

## Current Alpha Note

There is a `mission init` implementation in source, but it is not currently part of the public routed CLI surface. For operators, repository adoption should be understood through the published Mission CLI and the Airport/Tower control flows, not through a documented `mission init` command.