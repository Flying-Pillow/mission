---
layout: default
title: Airport Control Plane
parent: Architecture
nav_order: 7
---

# Airport Control Plane

Airport is the Mission surface for repository and mission operations. It decides what each pane shows and renders daemon/Entity state without owning mission execution truth.

## Primary Components

| Component | Responsibility | Owned state |
| --- | --- | --- |
| Airport surfaces | Surface-local layout and focus state for Tower, Briefing Room, and Runway | panel-local UI state |
| Daemon protocol | `system.status` plus entity remote requests | daemon snapshots and entity results |

## Pane Model

The current airport implementation has three fixed panes. Some internal types still use gate-style naming, but the documentation treats these as panes to avoid confusion with workflow gates:

| Pane id | Purpose |
| --- | --- |
| `tower` | Repository or mission control surface |
| `briefingRoom` | Artifact or mission view surface |
| `runway` | Live agent-session surface |

Each pane has a `PaneBinding`:

| Binding field | Meaning |
| --- | --- |
| `targetKind` | `empty`, `repository`, `mission`, `task`, `artifact`, or `agentSession` |
| `targetId` | Selected semantic target |
| `mode` | `view` or `control` |

## Airport Projection State

Airport projection state carries:

- repository-scoped pane bindings
- focus intent and observed focus
- connected client registrations

It does not carry workflow execution truth.

It may react to workflow truth for view purposes, but it must not feed pane-local state back into workflow decisions.

Examples:

- valid: project the currently selected `agentSession` into Runway
- valid: update Tower or Briefing Room when daemon status changes
- invalid: let focused pane, visible pane, or client-local cursor change whether a task may start or whether a session is considered alive

## Pane Selection

Semantic selection is separate from surface focus:

- mission or repository selection updates pane bindings and views
- mission-mode task selection should resolve the task's canonical instruction and preferred session before panes bind
- mission-mode stage selection should resolve the stage's canonical result artifact before panes bind
- explicit surface focus observations update observed focus state; they do not reassert stale intent
- selecting an artifact or agent session must not, by itself, mutate workflow execution state

## Persistence Boundary

Airport intent is persisted inside repository daemon settings, not inside `mission.json`.

| Persisted field | Location |
| --- | --- |
| `airport.panes` | `.mission/settings.json` |
| `airport.focus.intentPaneId` | `.mission/settings.json` |

If the current airport intent matches the default bindings, the registry omits it rather than persisting redundant state.

## Non-Responsibilities

Airport does not own mission execution. It does not own task generation. It does not decide whether a session should start. It only derives views and surface-local layout state.

Airport also does not arbitrate session truth. If a client and the daemon disagree about what is visible, the daemon wins. If Airport and workflow disagree about whether work is active, workflow plus normalized runtime facts win.

## Relationship To Other Pages

- See [daemon.md](./daemon.html) for the multi-repository registry and daemon integration.
- See [airport-web-surface-blueprint.md](./airport-web-surface-blueprint.html) for the current Airport web surface shape.
- See [semantic-model.md](./semantic-model.html) for the semantic targets referenced by pane bindings.
