---
layout: default
title: Spec-Driven Development
parent: Core Workflows
nav_order: 1
---

# Spec-Driven Development

Mission is built on a simple belief: AI produces better software when the work is constrained by explicit artifacts instead of improvised inside one endless session.

That is what “spec-driven” means in Mission. It does not mean “write more documents for the sake of it.” It means every important phase of work leaves behind an artifact that the next phase can trust.

## Why This Feels Better Than Prompt-Driven Coding

In a prompt-driven workflow, the same session often tries to do all of this at once:

- interpret the problem
- invent the architecture
- write the code
- decide what counts as verification
- summarize itself as complete

That is where AI coding gets brittle.

Mission splits those responsibilities apart so the operator can inspect and correct them separately.

## The Product Artifacts

The core artifact chain in the current workflow is:

| Artifact | What it is for |
| --- | --- |
| `BRIEF.md` | Intake context for the mission |
| `PRD.md` | Requirements, goals, and constraints |
| `SPEC.md` | Architecture and implementation plan |
| `VERIFY.md` | Verification evidence gathered during implementation |
| `AUDIT.md` | Findings and residual risks |
| `DELIVERY.md` | Final handoff and delivery summary |

This structure gives the operator a crisp answer to a crucial question: what exactly are we trusting right now?

## How Mission Uses Those Artifacts

Mission does not create artifacts as a side effect of one agent conversation. It uses them as the handoff points between phases of work.

That changes the character of the product:

- the brief becomes a requirements document
- requirements become a technical spec
- the spec becomes a set of bounded implementation tasks
- implementation produces verification evidence
- verification feeds audit and delivery

In other words, Mission turns “AI coding” into an inspectable supply chain.

## Bounded Tasks Instead Of One Giant Session

Mission does not want implementation to begin as one giant blob of intent.

By the time a mission reaches implementation, the system is already set up to work through bounded tasks. In the current workflow, implementation also has paired verification behavior: verification tasks are prefixed with `verify-` and depend on their matching implementation tasks.

That pairing is one of the reasons Mission feels disciplined. Verification is not something the agent gets to vaguely claim. It is part of the workflow structure.

## Why Architects Like This Model

Spec-driven execution gives teams leverage in exactly the places where AI usually creates risk:

- scope becomes explicit before coding starts
- architecture becomes reviewable before files change
- verification becomes a named deliverable instead of a promise
- audit and delivery become real stages instead of cleanup chores

For a Principal Architect, that means Mission is not only fast. It is legible.

## A Better Way To Trust AI Output

Mission does not ask you to trust the last thing the agent said. It asks you to trust a chain of increasingly concrete artifacts.

That is a much stronger operating model:

1. The brief states the intent.
2. The PRD defines the target outcome.
3. The SPEC constrains the implementation.
4. Implementation tasks do bounded work.
5. Verification proves what happened.
6. Audit and delivery make the result reviewable.

This is the core product promise behind Mission's workflow.