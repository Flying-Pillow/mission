---
title: SPEC: Workflow Scaffold Refactor
artifact: spec
stage: spec
createdAt: 2026-04-04T20:11:01.876Z
updatedAt: 2026-04-04T20:11:01.876Z
---

# SPEC: Workflow Scaffold Refactor

Branch: mission/4-audit-issue-1-architecture-refactor-on-merged-ma

## Goal

Refactor Mission so workflow structure is defined in one place, templates are editable without code changes, and runtime state is cleanly separated from workflow source.

## Locked Decisions

- `.missions` remains runtime-only.
- Workflow configuration does not live under `.missions`.
- The current hardcoded workflow model is not acceptable because stage order, artifact paths, gate rules, and templates are duplicated across the engine.
- The new scaffold should remove fallback and compatibility behavior rather than preserving history.
- The implementation/verification split should be revisited in the workflow model rather than hardcoded into the runtime engine.

## Target Architecture

The system should be split into a fixed kernel and a declarative workflow definition.

The fixed kernel owns:

- mission runtime layout
- mission control state
- task lifecycle
- template rendering
- strict schema validation

The workflow definition owns:

- ordered stages
- stage directory names
- artifacts per stage
- seeded tasks per stage
- gate progression rules
- autopilot progression rules

## Non-Negotiable Requirements

- one canonical workflow manifest
- no duplicated workflow constants across engine subsystems
- plain Markdown templates
- explicit schema validation with hard failure on invalid workflow definitions
- no runtime-owned workflow source

## Initial Refactor Sequence

1. Introduce a workflow manifest and schema.
2. Move path and stage resolution behind that manifest.
3. Replace hardcoded template registration with file-backed templates.
4. Convert `.md.ts` templates to Markdown template files.
5. Rebuild tests around the new contract.
6. Delete legacy constants and compatibility branches.

## Definition Of Done

- A workflow change is expressed through workflow config or template edits, not engine edits.
- The engine no longer hardcodes stage order, artifact placement, and seeded templates in multiple files.
- The repo can preserve workflow intent even if chat context is lost.