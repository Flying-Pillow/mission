---
layout: default
title: State Schema
parent: Reference
nav_order: 2
---

# State Schema

Mission uses multiple state scopes on purpose. The daemon-wide snapshot, the airport registry, and the mission-local runtime data solve different problems and should not be collapsed into a single mental model.

## Daemon-Wide System Snapshot

The daemon-wide composite snapshot is `MissionSystemSnapshot`:

```ts
type MissionSystemSnapshot = {
  state: MissionSystemState;
  airportViews: AirportViewSet;
  airportRegistryViews: Record<string, AirportViewSet>;
}
```

This is the state surface that Tower and other clients consume from the daemon.

### `MissionSystemState`

`MissionSystemState` packages live daemon state for surfaces. Current implementations should name concrete fields after their owner, such as system status, Mission tower state, or Airport state, rather than using a generic semantic graph bucket.

| Field | Responsibility |
| --- | --- |
| `version` | Monotonic daemon snapshot version |
| `airport` | Active repository airport state |
| `airports` | Registry of repository airports and their persisted intents |

This is daemon-wide state. It is not stored in `mission.json`.

## Airport State Versus Airport Registry State

`MissionSystemState.airport` is the active airport state for the currently scoped repository.

`MissionSystemState.airports.repositories` is the repository airport registry. Each entry stores:

- `repositoryId`
- `repositoryRootPath`
- `airport`
- `persistedIntent`

This means there are two airport views in the daemon snapshot:

- the active airport that current surfaces are centered on
- the broader registry of repository-scoped airport states known to the daemon

That distinction matters because the active airport is only one view over a potentially larger multi-repository control set.

## Mission-Local Runtime Data

The per-mission persisted runtime data is `MissionRuntimeData` in `mission.json`:

```ts
type MissionRuntimeData = {
  schemaVersion: number;
  missionId: string;
  configuration: MissionWorkflowConfigurationSnapshot;
  runtime: MissionWorkflowRuntimeState;
}
```

This data is mission-local. It belongs to one mission workspace, not to the daemon as a whole. The workflow event history is stored separately as the mission runtime event log, not as an inline `eventLog` field in `mission.json`.

### `MissionWorkflowConfigurationSnapshot`

This snapshot freezes workflow policy into the mission record:

- workflow version
- workflow source
- stage order
- stage launch policy
- human-in-the-loop settings
- panic settings
- execution settings
- gate definitions
- task generation rules

It is copied from global or repository settings at mission start and then becomes the mission's authoritative runtime policy.

### `MissionWorkflowRuntimeState`

The runtime section of `mission.json` contains:

- mission lifecycle
- pause state
- panic state
- stage projections
- task runtime state
- AgentSession state
- airport pane views
- launch queue
- last update timestamp

This is persisted execution state.

## Persisted State Versus Derived View

Mission deliberately mixes persisted facts with derived views, but only inside the correct boundary:

| Scope | Persisted facts | Derived views |
| --- | --- | --- |
| Daemon system snapshot | Active and registry airport state, semantic context graph, version | Airport views for active and registry airports |
| Mission runtime data | Configuration snapshot, mission lifecycle, task state, AgentSession state, pause and panic state, launch queue | Stage projections and airport pane views stored inside runtime after reducer derivation |

Two distinctions are especially important:

1. `mission.json` does not contain airport pane bindings, panel registrations, or substrate pane ids.
2. `MissionSystemSnapshot` does not replace the mission runtime data for per-mission execution semantics.

## Repository Control State Versus Mission Execution State

Repository control state is separate again:

- `.mission/settings.json` stores repository-scoped daemon and control defaults
- `.mission/workflow/` stores the repository-owned workflow preset
- `mission.json` stores one mission's execution runtime

This is the practical division of responsibility:

| State location | What it is |
| --- | --- |
| `.mission/settings.json` | Repository daemon and control defaults |
| `.mission/workflow/workflow.json` + `.mission/workflow/templates/` | Repository workflow preset |
| `MissionSystemSnapshot` | Live daemon-wide composite state and airport views |
| `mission.json` | Mission-local persisted execution record |

For an adopting team, this is the main schema rule to remember: repository control state, daemon control-plane state, and mission execution state are separate on purpose. Mission is safer when those layers remain explicit.
