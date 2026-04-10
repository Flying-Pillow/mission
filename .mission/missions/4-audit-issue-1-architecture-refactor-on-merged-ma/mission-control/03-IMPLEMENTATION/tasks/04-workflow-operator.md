# Refactor The Workflow Operator Surface

Rebuild Mission's operator command and status surfaces so they project reducer-valid workflow actions without reintroducing stage runtime control.

Execution contract:

- keep the daemon as the only authority for command availability, disabled reasons, targeting, and follow-up input flow
- treat stage selection as presentation only; executable authority must remain `mission`, `task`, `session`, or `generation`
- do not emit or preserve `stage.transition.*`, `stage.start.*`, `stage.restart.*`, `stage.pause.*`, or `stage.resume.*`
- do not allow CLI, VS Code, webview, or cockpit code to reconstruct workflow command availability from local heuristics
- keep stage-friendly language in UX copy, but map all execution semantics back to mission, task, session, or generation actions

Surface model requirements:

- stages may present `pending`, `ready`, `active`, `blocked`, and `completed` as derived status only
- generation is the only executable scope allowed to carry a stage identifier as its primary target
- stage cards and stage trees must resolve to daemon-projected mission, task, session, and generation commands rather than expecting stage-scoped commands
- batch start affordances and queue-clearing affordances are allowed only if the daemon contract actually supports them
- disabled states and reasons must come from daemon projection, not from UI guesses

Implementation sequence:

1. define a dedicated operator command namespace in core
2. add a daemon-owned projector that derives valid commands and disabled reasons from runtime state
3. expose the command model cleanly through daemon protocol and client APIs
4. refactor CLI cockpit behavior to consume only daemon-provided commands
5. refactor VS Code host, views, and cockpit code to consume the same command model
6. remove leftover stage-runtime command ids, helper code, and regression paths

Primary file actions:

- add `packages/core/src/commands` for command ids, types, projector, executor, and tests
- move command contract ownership out of ad hoc mission status typing
- refactor daemon mission, workspace, and protocol layers to use centralized command projection and execution
- rewrite CLI cockpit selection and filtering logic to stop depending on stage scope
- remove stage-oriented command construction and registrations from the VS Code extension
- either revive the webview cockpit against the daemon command contract or remove dead stage-driven behavior until it is real

Required verification:

- command projector tests covering generation, pause, panic, reopen, manual start, queue-clearing, and stage-presentation grouping
- command executor tests proving reducer-valid mission, task, session, and generation routing
- daemon integration tests for command fetch, execution, disabled rejection, and status rebroadcast
- CLI and VS Code tests proving stage selection still shows relevant commands without stage execution scope
- regression tests that fail if any active path emits stage-transition command ids again

Use the product artifacts in this mission folder as the canonical context boundary.