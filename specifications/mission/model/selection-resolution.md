---
layout: default
title: Selection Resolution
parent: Model
nav_order: 4
---

# Selection Resolution

This document defines how mission-control selection resolves into the companion context shown in Briefing Room and Runway.

It is normative.

This document must be read alongside the mission model, the core object model, and the airport control plane specification.

If this document conflicts with pane-local UI heuristics, this document wins.

## Purpose

Mission-control tree selection is the operator cursor.

It is not, by itself, the full content contract for the right-side panes.

The right-side panes must be driven by a resolved selection bundle derived from the selected target and the semantic mission graph.

The purpose of that bundle is coherence:

- selecting a task must surface the task's instruction document
- selecting a task must surface the task's preferred agent session when one exists
- selecting a stage must surface the stage's product artifact
- explicit artifact or session rows may refine that bundle, but they do not redefine the underlying ownership model

## Core Rule

Mission uses two selection layers in mission mode:

1. raw selection: the currently selected mission-control target
2. resolved selection: the derived work bundle that companion panes consume

Raw selection is what the operator has highlighted.

Resolved selection is what Briefing Room and Runway should show.

These two layers are related, but they are not identical.

## Resolved Selection Terms

### `activeInstruction`

The canonical markdown artifact for the selected task.

This is the task assignment or instruction file.

It is not chosen by filename heuristics.

It must resolve from an explicit semantic relationship.

### `activeAgentSession`

The preferred agent session for the selected task.

If multiple sessions exist for the task, the preferred session is the most recently updated session.

If an explicit session row is selected, that explicit session wins.

### `activeStageResult`

The canonical product artifact for the selected stage.

Examples include `PRD.md`, `SPEC.md`, `VERIFY.md`, `AUDIT.md`, and `DELIVERY.md`.

## Task And Stage Ownership Rule

Task is the primary unit of work.

A task is the collection of:

- the task identity and lifecycle record
- the canonical instruction markdown artifact for that task
- zero or more agent sessions launched for that task

Stage is structural and derived, but stage selection still has a canonical result surface.

A stage selection resolves to the stage's canonical product artifact.

## Resolution Rules

### Stage row selected

The resolved selection must contain:

- `stageId`
- `activeStageResult`

The stage result must be the canonical product artifact defined for that stage.

If the current workflow allows more than one stage artifact in a stage, the workflow definition must designate one canonical stage result artifact for selection resolution.

### Stage artifact row selected

The resolved selection must contain:

- `stageId`
- `activeStageResult`

The selected artifact row is the active stage result.

### Task row selected

The resolved selection must contain:

- `taskId`
- `activeInstruction`
- `activeAgentSession` when at least one session exists for that task

`activeInstruction` must be the task's canonical instruction artifact.

`activeAgentSession` must be the most recently updated session associated with that task.

### Task artifact row selected

The resolved selection must contain:

- `taskId`
- `activeInstruction`
- `activeAgentSession` when at least one session exists for that task

The selected artifact row is the active instruction.

The preferred session rule remains the same as task-row selection.

### Session row selected

The resolved selection must contain:

- `taskId` from the owning task
- `activeInstruction` from the owning task
- `activeAgentSession` as the explicitly selected session

Explicit session selection overrides the preferred-session rule for that task.

## Required Invariants

1. Every task must have exactly one canonical instruction artifact once that task is materialized.
2. A task selection without a resolvable instruction artifact is invalid mission state, not a condition for UI fallback behavior.
3. Stage selection must resolve through semantic stage-to-artifact ownership, not through path guessing.
4. Session preference must be based on session recency metadata, not tree order.
5. Pane binding logic must consume resolved selection; it must not reimplement task or stage companion selection independently in each pane.
6. Selection resolution is derived projection state. It must not be persisted as pane state in `mission.json`.

## Data Requirements

The semantic model must make these relationships explicit enough to resolve selection deterministically:

- each `TaskContext` must reference its canonical instruction artifact
- each `TaskContext` must reference its associated agent session ids when sessions exist
- each session used for preference must expose recency metadata suitable for deterministic ordering
- each workflow stage must have one canonical stage result artifact for selection purposes

The current `primaryArtifactId` field is the correct semantic role for the canonical instruction artifact.

If the implementation uses a different name later, the ownership rule must stay the same.

## Ownership Boundary

Selection resolution belongs to daemon-owned mission-control projection or a shared semantic selection resolver.

It does not belong to:

- Briefing Room-specific heuristics
- Runway-specific heuristics
- tower-only local cursor state
- terminal substrate observations

Tower may own the local tree cursor.

Tower must not become the only place that knows how task selection turns into instruction and session selection.

## Non-Goals

This document does not:

- redefine workflow execution truth
- make stage a command-owning entity
- persist pane focus or pane routing into mission-local workflow state
- require compatibility shims for older pane-routing behavior

## Practical Examples

- Selecting the `spec` stage resolves `activeStageResult` to `SPEC.md`.
- Selecting a task such as `01-prd-from-brief` resolves `activeInstruction` to that task's markdown assignment artifact.
- Selecting that same task with three sessions resolves `activeAgentSession` to the session with the newest update timestamp.
- Selecting one specific session under that task keeps the same `activeInstruction` but pins `activeAgentSession` to the explicitly selected session.

## Implementation Consequences

The current implementation can satisfy this specification with a small shared-model adjustment rather than pane-specific branching.

The intended change sequence is:

1. Populate `TaskContext.primaryArtifactId` with the canonical task instruction artifact when mission-control semantic state is built.
2. Carry session recency metadata through the semantic selection graph so preferred session resolution is based on timestamps rather than tree order.
3. Introduce a daemon-owned resolved mission-selection projection that turns a raw tree target into `activeInstruction`, `activeAgentSession`, and `activeStageResult`.
4. Update Tower to bind Briefing Room and Runway from that resolved selection instead of binding directly from the raw tree node kind.

The important implementation constraint is centralization.

Selection resolution must be implemented once in shared mission-control logic.

It must not be duplicated across:

- `panelBindings`
- `AirportShell`
- Briefing Room bootstrap code
- Runway bootstrap code

## Current Gap Summary

The current codebase already contains most of the necessary source data:

- task artifacts have stable file paths
- mission session records already carry `createdAt` and `lastUpdatedAt`
- stage product artifacts are already known through mission product files

The missing links are:

- `TaskContext.primaryArtifactId` is not yet populated by mission-control synchronization
- `AgentSessionContext` does not yet expose recency metadata for deterministic preferred-session selection
- Tower pane binding currently reacts to explicit artifact and session rows instead of resolved task or stage companion context