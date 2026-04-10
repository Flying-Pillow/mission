---
layout: default
title: Mission Lifecycle
parent: Core Workflows
nav_order: 2
---

# Mission Lifecycle

Mission is easiest to understand when you stop thinking in terms of “one AI session” and start thinking in terms of a controlled delivery lifecycle.

In the current workflow manifest, every mission moves through five stages in order:

```text
prd -> spec -> implementation -> audit -> delivery
```

That sequence is not decorative. It is the backbone of the product.

## The Five Stages

| Stage id | What it is for | Main artifact |
| --- | --- | --- |
| `prd` | Turn the brief into a clear requirements document | `PRD.md` |
| `spec` | Turn requirements into a buildable technical plan | `SPEC.md` |
| `implementation` | Execute the work in bounded tasks and collect verification evidence | `VERIFY.md` |
| `audit` | Record findings, residual risks, and review outcomes | `AUDIT.md` |
| `delivery` | Package the handoff and final delivery summary | `DELIVERY.md` |

Before the first stage, the mission also carries the original `BRIEF.md`, which is the intake document for the whole operation.

## What Each Stage Gives The Operator

### PRD

The PRD stage answers: what exactly are we trying to achieve?

This is where Mission turns a rough brief or issue into a requirements document with success criteria and constraints. It is the point where ambiguous intent becomes explicit scope.

### SPEC

The spec stage answers: how should this be built?

This is where architecture, file boundaries, and implementation strategy become concrete. Mission uses this stage to prevent implementation from beginning inside a vague or under-specified problem space.

### Implementation

The implementation stage answers: can the work be executed in bounded slices and proven?

This stage is more than “write code.” In the current workflow manifest, implementation is paired with verification mechanics. Verification tasks are generated with a `verify-` prefix and depend on their corresponding implementation tasks. That pairing is one of Mission's strongest product ideas because it keeps proof close to the work instead of bolting it on afterward.

### Audit

The audit stage answers: what did we learn, what still worries us, and what should a reviewer know?

This is where Mission records findings and residual risk instead of pretending that green execution alone is enough.

### Delivery

The delivery stage answers: what is ready to hand off?

This produces the final delivery artifact and creates a clean ending to the mission rather than leaving completion implied by scattered files and terminal history.

## The Artifact Chain

The user-visible artifact chain is straightforward:

| Artifact | What it means |
| --- | --- |
| `BRIEF.md` | Intake context and mission intent |
| `PRD.md` | Requirements and success criteria |
| `SPEC.md` | Architecture and implementation plan |
| `VERIFY.md` | Verification evidence for completed work |
| `AUDIT.md` | Findings and residual risk |
| `DELIVERY.md` | Final handoff and delivery summary |

This is what makes Mission feel orderly. You can open the dossier and understand not just what happened, but why the system believes a mission is ready to advance.

## Tasks Drive Progress, Not Stage Labels

There is one important product truth behind the nice stage rail in Tower: stages do not execute work. Tasks do.

That distinction matters because it keeps the UI honest. When the Tower shows a stage becoming active, blocked, or done, that state is derived from task execution and mission runtime state, not from a vague human label.

For operators, the practical meaning is:

- stages are how you understand the mission
- tasks are how Mission actually moves it forward
- artifacts are the evidence that each stage produced something reviewable

## How A Mission Advances

In practice, a mission usually advances like this:

1. Intake creates the brief-backed mission.
2. PRD work defines the problem.
3. SPEC work defines the architecture and plan.
4. Implementation runs through bounded tasks and paired verification.
5. Audit records what a serious reviewer should know.
6. Delivery closes the mission with a final artifact.

That flow is why Mission can be used as a serious product tool rather than only a coding convenience.