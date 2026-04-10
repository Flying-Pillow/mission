---
title: Audit issue 1 architecture refactor on merged main
artifact: brief
issueId: 4
type: task
branchRef: mission/4-audit-issue-1-architecture-refactor-on-merged-ma
createdAt: 2026-04-04T20:11:01.876Z
updatedAt: 2026-04-04T20:11:01.876Z
---

# BRIEF: Audit issue 1 architecture refactor on merged main

Issue: #4

This mission started from the audit issue created to review and harden the architecture introduced from issue 1.

The immediate concern is that the mission runtime layout was changed while the workflow and template system are still too hardcoded and too coupled to source code.

This mission is being used to lock the next clean architecture for Mission itself before the system accumulates more history.

Current operating assumptions:

- `.missions` is runtime state only.
- Workflow definition must live in source-owned or repo-owned configuration, not runtime.
- The system should have one source of truth for stage order, artifacts, directories, and seeded tasks.
- Templates should become plain Markdown files, not `.md.ts` modules.
- No compatibility layer or fallback model should be carried into the new scaffold.