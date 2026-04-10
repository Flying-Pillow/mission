---
title: PRD: Workflow Scaffold Refactor
artifact: prd
stage: prd
createdAt: 2026-04-04T20:11:01.876Z
updatedAt: 2026-04-04T20:11:01.876Z
---

# PRD: Workflow Scaffold Refactor

Branch: mission/4-audit-issue-1-architecture-refactor-on-merged-ma

## Outcome

Mission should stop encoding workflow structure across multiple engine modules and instead move toward one declarative workflow scaffold.

## Problem Statement

The current system duplicates stage order, stage directories, artifact names, template registration, and gate logic across the runtime. That makes workflow changes expensive and error-prone.

## Success Criteria

- the mission workspace preserves the architectural decisions already made
- the flight deck shows the intended staged scaffold clearly
- the refactor direction is durable even if chat history is lost

## Constraints

- `.missions` is runtime only
- workflow source must not live in runtime state
- no compatibility or fallback layer should be added

## Non-Goals

- do not finalize the entire new workflow engine in this planning scaffold alone
- do not preserve legacy layout rules just to ease migration