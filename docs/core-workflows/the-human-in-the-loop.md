---
layout: default
title: The Human In The Loop
parent: Core Workflows
nav_order: 3
---

# The Human In The Loop

Mission is designed for a world where the human operator stays above the automation, not behind it.

That principle shows up everywhere in the product:

- the mission can be paused
- active sessions can be interrupted or terminated
- implementation can stay manual while earlier stages remain more automatic
- panic is a first-class stop state, not a UI trick
- task execution happens inside bounded mission workspaces

## What Human Control Means In Practice

Mission separates three things that many tools blur together:

| Layer | What it controls |
| --- | --- |
| Mission lifecycle | Whether the whole mission is running, paused, panicked, completed, or delivered |
| Task execution | Which bounded units of work are ready, active, blocked, or done |
| Agent sessions | Which live provider-backed sessions are currently running |

That gives the operator real leverage. You are not forced to either “trust the agent” or “kill everything.” You can intervene at the right level.

## Manual Where It Matters Most

The default workflow policy already leans toward human control in the places where teams usually want it most:

| Stage | Default behavior |
| --- | --- |
| PRD | automatic launch policy |
| SPEC | automatic launch policy |
| Implementation | manual launch policy |
| Audit | automatic launch policy |
| Delivery | manual launch policy |

That is a good product choice. Most teams are comfortable letting Mission turn a brief into a PRD and SPEC. They are much less comfortable letting implementation and delivery happen without deliberate oversight.

One honest alpha note matters here: launch policy is modeled clearly in the runtime, but operator-driven task actions are still the reliable path in practice today.

## What The Agent Is Allowed To Do

Mission does not launch an agent into a vague prompt. It launches a session with bounded mission and task context.

The task launch prompt tells the agent:

- which task it is working on
- which mission it belongs to
- which workspace boundary it must stay inside
- which task file is authoritative

That is why Mission feels different from raw chat tooling. The agent is working inside an operating envelope that the human can inspect.

## The Operator's Real Powers

In current Mission flows, the human operator can meaningfully control:

1. whether a mission is running or paused
2. whether emergency panic is active
3. which mission is selected in Tower
4. which task is launched next
5. whether a session should be interrupted, cancelled, or terminated
6. whether work should continue to delivery

That is the shape of a serious AI operations product. The human is not reduced to reading logs after the fact.

## Why This Matters To Teams

Human-in-the-loop is not a slogan here. It is what makes Mission suitable for repositories where architectural correctness, verification quality, and delivery confidence matter more than raw token throughput.

Mission is trying to give you the best part of AI coding speed without handing over operational authority.