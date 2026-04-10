---
layout: default
title: Handling Emergencies
parent: Core Workflows
nav_order: 4
---

# Handling Emergencies

Mission takes emergencies seriously because real AI operations need a real stop button.

If an agent starts drifting, ignores scope, or behaves in a way you no longer trust, Mission gives the operator a hard containment path instead of hoping the model will cooperate.

## Pause Versus Panic

Mission makes a clear distinction:

| Control | Use it when | Effect |
| --- | --- | --- |
| Pause | You want a controlled stop for review or pacing | Work stops without emergency semantics |
| Panic | You need immediate containment | The mission enters a panicked state and Mission can halt launches and terminate sessions |

This difference is important. A pause is normal governance. Panic is emergency response.

## What Panic Does

In the current workflow model, panic is not only a visual badge in Tower. It changes mission state in a concrete way:

- the mission becomes `panicked`
- the pause reason becomes `panic`
- the panic policy becomes active

By default, that panic policy is configured to:

- terminate active sessions
- clear queued launches
- halt further mission progression until a human recovers the mission

That is exactly the behavior an operator wants in a serious incident.

## Why This Matters

Many AI tools have no real emergency model. At best they let you close a tab and hope the session is gone.

Mission is better than that because the emergency state is part of the mission runtime itself. The stop is durable, visible, and recoverable. If Tower reconnects later, it can still tell that the mission was panicked.

## What Recovery Looks Like

Clearing panic does not automatically throw the system back into motion. Mission leaves the mission paused so the operator can decide what comes next.

That is the right product behavior. When something has gone wrong badly enough to justify panic, the system should not restart itself optimistically.

## A Practical Operator Checklist

When something feels wrong:

1. Panic the mission.
2. Confirm that active sessions are no longer running.
3. Review which tasks were in flight and what changed in the mission workspace.
4. Decide whether to relaunch work, reopen a task, or change the plan.
5. Resume only after the mission is trustworthy again.

This is one of Mission's strongest operational ideas: it assumes AI workflows sometimes need containment, and it designs for that reality instead of ignoring it.