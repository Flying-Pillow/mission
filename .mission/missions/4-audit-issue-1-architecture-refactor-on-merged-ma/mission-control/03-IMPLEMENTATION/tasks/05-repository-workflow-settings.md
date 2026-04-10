# Implement Repository Workflow Settings

Build the daemon-owned repository workflow settings path so workflow policy is initialized, validated, patched, persisted, and snapshotted consistently across all control surfaces.

Execution contract:

- keep `.missions/settings.json` as the only repository-level source of truth for workflow defaults
- make the daemon the only authority allowed to initialize, validate, patch, and persist repository workflow settings
- require RFC 6902 JSON Patch for workflow policy updates; do not allow deep-partial merge semantics
- derive revision tokens from on-disk file state and reject stale writes after out-of-band edits
- write settings atomically using temp-file-plus-rename semantics
- keep mission workflow snapshots linked to repository settings while a mission is `draft`, then capture the mission-local snapshot exactly at `draft` to `ready`

Required behavior:

- expose dedicated daemon methods for `control.workflow.settings.get`, `control.workflow.settings.initialize`, and `control.workflow.settings.update`
- return effective settings, metadata, revision, and validation or conflict details through one shared contract
- normalize missing workflow fields from default workflow settings before validation and persistence
- validate execution limits, stage order, stage dictionary consistency, gate stage references, task generation stage references, and launch policy enums deterministically
- emit a control-plane settings-updated notification after successful workflow-setting mutations
- keep old scalar setup methods narrow and separate from workflow policy editing

Implementation sequence:

1. add a dedicated settings namespace with types, patch helpers, validation, and revision logic
2. build the workflow settings store and daemon API routing
3. fix mission snapshot timing so repository workflow settings apply to `draft` missions only until start
4. add CLI workflow settings client and patch-construction flows
5. wire the extension and cockpit or web surfaces to the same daemon API
6. remove leftover assumptions that workflow settings can be edited through scalar field or value flows

Primary file actions:

- add `packages/core/src/settings` for types, JSON Patch helpers, validation, revision, store, and tests
- refactor daemon config helpers to leave workflow mutation ownership with the settings store
- extend daemon protocol, workspace routing, and client operations for workflow settings methods
- refactor mission initialization and workflow controller code to delay snapshot capture until the ready transition
- split scalar control settings UI flows from workflow policy flows in CLI and extension surfaces

Verification requirements:

- unit tests for allowed and forbidden patch operations, semantic validation failures, and deterministic revision derivation
- integration tests for initialize, get, valid update, stale revision conflict, out-of-band edit detection, and update event emission
- mission snapshot tests proving repository settings affect `draft` missions until `ready`, then stop affecting started missions
- surface tests proving CLI and cockpit or web code use daemon APIs only and never write the settings file directly

Use the product artifacts in this mission folder as the canonical context boundary.