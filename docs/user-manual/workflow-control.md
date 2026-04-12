---
layout: default
title: Tower Control Surface
parent: User Manual
nav_order: 2
---

# Tower Control Surface

Tower is the left-side control surface inside the Airport layout where the product becomes operational.

It is the place where you watch a mission advance, decide what should happen next, and intervene when the workflow needs human judgment.

## What You Can Monitor

When a mission is selected, Tower gives the operator visibility into the most important runtime questions:

- which stage is active
- which tasks are ready, running, blocked, or done
- which artifact belongs to the current stage
- whether a live agent session is attached to a task
- whether the mission is paused, panicked, or ready to proceed

That is the difference between Mission and generic AI tooling: the system is built to make runtime state observable.

## What You Can Steer

The control surface exposes operator actions at several levels.

### Repository-Level Actions

In discovery and repository flows, the current control plane exposes actions for:

- configuring repository setup
- preparing a new mission brief
- opening an existing local mission
- switching repositories
- registering a repository
- browsing open GitHub issues when issue intake is configured

Those are the actions that make Mission feel like a product instead of a low-level runtime API.

### Mission-Level Actions

At mission level, the operator can govern the whole run:

- pause the mission
- resume the mission
- panic-stop the mission
- clear panic
- deliver the mission

These are not cosmetic buttons. They correspond to real mission lifecycle transitions.

### Task-Level Actions

Tasks are where actual work moves.

The implemented task action surface includes:

- start a task
- launch a task session
- mark a task done
- mark a task blocked
- reopen a task
- enable or disable autostart
- switch launch mode between `automatic` and `manual`

This is a crucial product design choice. Tower speaks in stage language because humans think that way, but the real runtime authority lives at the task level.

### Session-Level Actions

When a task has a live agent attached, the operator can also act on the session itself:

- prompt it
- interrupt it
- cancel it
- terminate it

That gives the human a direct supervisory path into live execution.

## How To Read The Stage Rail

The stage rail is your strategic view, not the execution engine.

Use it to answer questions like:

- are we still turning the brief into requirements?
- are we ready to move from specification to implementation?
- are we blocked in audit?
- has delivery actually happened?

The important nuance is that stages are projections. Tasks are the executable units underneath them.

## A Good Mental Model For Operators

Think about Tower inside the Airport layout like this:

- the stage rail tells you where the mission is
- the task tree tells you what concrete work exists
- the artifact view tells you what evidence the stage has produced
- the session view tells you what an agent is doing right now

That model is one of Mission's best design choices because it keeps strategy, execution, evidence, and runtime supervision connected without collapsing them into one pane of terminal noise.