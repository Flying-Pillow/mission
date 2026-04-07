---
issueId: 6
title: "Start a mission from an existing GitHub issue"
type: "task"
branchRef: "mission/6-start-a-mission-from-an-existing-github-issue"
createdAt: "2026-04-07T00:06:15.588Z"
updatedAt: "2026-04-07T00:06:15.588Z"
url: "https://github.com/Flying-Pillow/mission/issues/6"
---

Issue: #6

## Goal

Validate Mission flow to generate an mission by selecting an open issue on Github,   in a real repository that is already initialized.

This repository is already using Mission control. The purpose of this issue is to test whether a new mission can be started from an existing GitHub issue through the daemon-driven GitHub authorization flow.

## What We Want To Validate

Starting from this GitHub issue, Mission should:

1. Detect that the current repository is already initialized.
2. Accept this issue as the source for a new mission.
3. Create a mission-preparation branch and pull request for this issue.
4. Scaffold the tracked mission artifacts in the repository.
5. After the PR is merged into `main` and the local checkout is updated, allow the daemon to discover and report the prepared mission from the repository state.

## Expected Flow

1. Operator selects this GitHub issue as the source for a new mission.
2. Mission daemon creates a mission-preparation branch.
3. Mission daemon opens a PR against `main`.
4. The PR contains the minimal tracked mission scaffold for this issue.
5. The PR is merged.
6. Local `main` is pulled.
7. Mission daemon reports the new mission in repository status and makes it available for further work.

## Expected Initial Output

The preparation PR should create the minimal tracked mission scaffold for a new mission, including at least:

- a mission directory under the repository Mission control structure
- a minimal `mission.json`
- the initial tracked mission dossier / flight-deck scaffold
- linkage back to this GitHub issue

## Acceptance Criteria

- Mission intake from an existing GitHub issue succeeds.
- A mission-preparation PR is created successfully.
- The PR targets `main`.
- The PR contains the minimal mission scaffold only.
- After merge and pull, the daemon can detect the prepared mission from the repository context.
- The prepared mission is available to continue through Mission surfaces such as CLI or cockpit.

## Constraints

- Do not rely on brief-entry UI behavior for this test.
- Treat this as a system validation issue for the repo-to-mission flow.
- Keep the initial scaffold minimal and deterministic.
- The daemon must operate from the current repository context and not depend on hardcoded repository-specific behavior.

## Notes

This issue is intentionally focused on validating Mission's repository-independent control flow.

The main question is whether an already initialized repository can accept an issue-driven mission request and move cleanly through:

issue -> mission-preparation PR -> merge to main -> daemon discovers prepared mission
