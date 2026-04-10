---
layout: default
title: Retrospective Replay Workflow
parent: Plans
nav_order: 4
---

# Retrospective Replay Workflow

This document defines how Mission should reconstruct its own historical development as a curated sequence of retrospective missions.

The purpose is not to replay old implementation mechanically.

The purpose is to rebuild the historical mission trail in a way that is:

- issue-backed
- repository-tracked
- workflow-consistent
- reproducible from repo state alone
- compatible with Mission's current architecture direction

This document is the durable process reference for retrospective replay work.

If short-term memory, session context, or operator notes are lost, this document should still be enough to resume the replay process correctly.

## Core Law

Retrospective replay must follow current Mission workflow semantics as closely as possible.

That means:

1. Replayed missions must be anchored to a real GitHub issue whenever the real Mission intake flow would have required one.
2. Replayed mission dossiers must use the canonical tracked dossier path `.mission/missions/<mission-id>/`.
3. Replayed artifacts must use the same filesystem shape the workflow engine writes today.
4. Replayed product artifacts must be materialized in the same shape the engine would write: rendered template body plus artifact-writer frontmatter.
5. Replayed generated task files must match `writeTaskRecord(...)` output rather than raw template file contents.
6. Replayed `mission.json` state must reflect the workflow events and runtime projections implied by the replayed stage, not an approximate or contradictory hand-written state.
7. Artifact enrichment must happen after initial materialization. First create the engine-shaped artifact, then update that artifact as the outcome of the replayed task.
8. No compatibility shim, alias, fallback reader, or dual-path support should be introduced for obsolete dossier layouts while doing replay work.

## Replay Scope

The current retrospective decomposition is intentionally small and coarse-grained.

The identified missions, in canonical replay order, are:

1. Repository Adoption And Mission Dossier Layout.
2. Mission Semantic Model.
3. Workflow Engine And Repository Workflow Settings.
4. Agent Runtime Unification.
5. Airport Control Plane.

These missions are not a claim about the exact chronological commit history.

They are the current best curated reconstruction of the major isolated architectural outcomes that led to the repository state now present in Mission.

If later evidence shows a cleaner grouping, this list may be revised. The mission count should stay small unless a split materially improves clarity.

## Replay Inputs

Each replayed mission should be derived from current repository sources, not guesswork.

Allowed inputs include:

- specification documents
- implementation plans
- checklists
- current code that confirms the intended runtime contract
- current docs that confirm the intended operator flow
- real GitHub issue state created for the replay

The replay should not invent artifacts that are unsupported by the current code or current specifications.

## Replay Sequence

### 1. Select The Mission

Choose one mission from the curated retrospective mission list.

Before creating any dossier files:

- identify the authoritative source specifications
- identify the intended issue title
- identify the intended outcome and constraints
- confirm whether current code exposes additional constraints that the specs do not yet state explicitly

### 2. Create The GitHub Issue First

If the real Mission intake flow would create an issue first, the replay must do the same.

This is the current rule for brief-based GitHub-backed mission start.

The issue is not optional metadata. It is the intake anchor.

The issue should contain:

- mission goal
- mission scope
- expected outcome
- acceptance criteria
- constraints
- source material references
- a note that the mission is a retrospective reconstruction

### 3. Derive Canonical Mission Identity

After the issue exists, derive:

- `missionId`
- `branchRef`
- mission dossier path

These should follow the same naming logic the codebase uses for issue-backed mission creation.

Do not invent alternate naming schemes just for replay.

### 4. Materialize The Minimal Mission Root

Create the mission dossier root at:

```text
.mission/missions/<mission-id>/
```

The minimal initial dossier must contain:

- `BRIEF.md`
- `mission.json`

`BRIEF.md` should match the canonical descriptor artifact shape.

`mission.json` should match the current workflow runtime schema and should reflect the replay point truthfully.

### 5. Replay Workflow Progression Stage By Stage

When a stage is replayed, do not skip directly to a hand-authored final artifact.

Replay it in the same conceptual order as the workflow engine:

1. create or confirm the correct runtime state and event sequence for reaching the stage
2. materialize stage product artifacts in engine-shaped form
3. materialize generated task files in engine-shaped form
4. enrich the product artifact as the task outcome
5. only then advance the runtime state toward task completion or next-stage eligibility

For example, PRD replay should follow this pattern:

1. replay `mission.created`
2. replay `mission.started`
3. replay `tasks.generated` for `prd`
4. materialize `01-PRD/PRD.md` with the product template plus artifact-writer frontmatter
5. materialize `01-PRD/tasks/01-prd-from-brief.md` with the task-writer output shape
6. enrich `PRD.md` as the outcome of the PRD task
7. only then replay the task completion transition if that is the chosen replay point

### 6. Use Current Engine Semantics As The Reference Model

Retrospective replay should prefer the current workflow engine code as the reference for materialization semantics when the question is:

- what frontmatter is written
- how a task file is normalized on disk
- what event sequence is required for a runtime state
- what stage projection should exist after a given event
- what task lifecycle should appear in `mission.json`

This does not mean the replay must execute the engine directly.

It means the replayed repository state should be indistinguishable from what the engine would have produced for that replay point.

### 7. Preserve Clean-Break Architecture Decisions

Replay work must not reintroduce obsolete architecture.

Specifically:

- do not recreate the old top-level `missions/` repository layout
- do not recreate the nested `mission-control/` dossier layout
- do not add compatibility paths for either obsolete shape
- do not preserve obsolete field names when the current architecture already made a clean rename

Replay is not a justification for re-encoding dead architecture.

### 8. Validate After Each Replay Step

After each major replay step, validate with the current codebase whenever practical.

Preferred validation methods include:

- reading artifacts through `FilesystemAdapter`
- reading task state through `FilesystemAdapter.readTaskState(...)`
- reading runtime state through `FilesystemAdapter.readMissionRuntimeRecord(...)`
- building the affected packages
- running focused tests when a replay step required code changes

### 9. Record Replay State Back To The Issue

The replay issue should be updated as meaningful milestones occur.

At minimum, record:

- spec clarification decisions that affected the replay contract
- mission dossier scaffold completion
- stage materialization milestones
- important replay-law clarifications that future replays must follow

### 10. Handle Product Omissions Explicitly

If retrospective replay uncovers a real product omission, record that omission as a real GitHub issue.

Examples include:

- a missing deterministic workflow contract
- a missing engine materialization path
- a mismatch between documented workflow behavior and implemented runtime behavior
- a missing schema or event path required to continue replay faithfully

The omission issue should be created even if the replay cannot yet be executed through Mission's own workflow machinery.

This is a chicken-and-egg case and should be treated explicitly, not hidden.

### 11. Continue In Emulation Mode When Justified

Once the omission is recorded as a real GitHub issue, retrospective replay may continue in emulation mode if both of the following are true:

1. the missing behavior is now explicitly documented as an omission
2. the current brief, PRD, and SPEC are specific enough to derive the next artifact or task inventory without guesswork

In emulation mode:

- prefer the current workflow schema and event shapes even if some transitions must be replayed manually
- scaffold the next artifacts and task files in the canonical engine-written shapes
- keep `mission.json` coherent with the emulated replay point
- do not pretend the omission does not exist

If the current stage artifacts are not specific enough to derive the next inventory honestly, stop and record that as the reason.

## Current Replay Baseline

The current replay baseline established during mission `11-reconstruct-repository-adoption-and-mission-doss` is:

1. Mission dossiers live directly under `.mission/missions/<mission-id>/`.
2. `BRIEF.md` is a root artifact.
3. `mission.json` is a root runtime document.
4. Stage artifacts live under root-level stage folders such as `01-PRD/` and `02-SPEC/`.
5. Product artifacts should use the same generated frontmatter shape the workflow engine writes.
6. Task artifacts should use the same normalized document shape that `writeTaskRecord(...)` writes.
7. Replay should move in engine-consistent increments rather than jumping to a hand-authored finished state.

## Operator Guidance

When performing retrospective replay manually:

- prefer deriving shapes from current code over improvising file structures
- prefer exact event-aligned runtime state over approximate runtime summaries
- prefer smaller, valid replay increments over large speculative jumps
- prefer clean architectural cutovers over compatibility-preserving replay patches
- when an omission is discovered, open the issue first, then decide whether the replay can continue in explicit emulation mode without guessing

## Non-Goals

This workflow does not attempt to:

- recreate exact historical commit order
- preserve obsolete runtime formats for documentary purposes
- replay every small implementation task as its own mission
- let replay convenience override current Mission architecture
