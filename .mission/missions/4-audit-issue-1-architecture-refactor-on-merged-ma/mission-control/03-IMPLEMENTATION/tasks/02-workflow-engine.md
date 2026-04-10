# Build Reducer-Driven Workflow Engine

Implement the next-generation Mission workflow engine as a clean-break replacement for the legacy stage-driven runtime.

Execution contract:

- treat `02-SPEC/SPEC.md` and the existing scaffold task as the architectural boundary for this slice
- make workflow behavior configuration-driven, mission-local, event-driven, reducer-based, and explicit about effects
- keep `mission.json` as the only authoritative workflow runtime record
- treat stages as structural and derived; tasks and sessions own execution semantics
- do not preserve legacy stage runtime control, imperative gate evaluation, autopilot-driven semantics, or compatibility aliases
- delete or replace legacy workflow semantics instead of wrapping them behind new names

Primary requirements:

- introduce one workflow settings model covering stage order, gates, task generation, task launch defaults, human-in-loop policy, panic policy, and concurrency policy
- snapshot effective workflow settings into `mission.json` when the mission starts so mission behavior stays reproducible after repository settings change
- define mission lifecycle as `draft`, `ready`, `running`, `paused`, `panicked`, `completed`, and `delivered`
- derive stage lifecycle as `pending`, `ready`, `active`, `blocked`, and `completed`
- make task runtime state authoritative, including `dependsOn`, `blockedByTaskIds`, launch policy, lifecycle, retries, and completion or failure timestamps
- make session runtime state authoritative for launches and reconciliation, with at most one active session per task
- keep launch requests in an explicit `launchQueue` instead of inferring them from task files or daemon loops
- recompute task readiness, blocked-by sets, stage projections, gate projections, and mission completion after every accepted event

Event and reducer rules:

- accept runtime changes only through explicit workflow events
- deduplicate by `eventId` before reduction and reject invalid events before appending them to the event log
- persist the accepted event and normalized next state together before executing external effects
- keep the reducer pure; it returns normalized state, emitted signals, and requested effects
- use the effect runner only for external work such as task generation, session launch, prompt submission, command submission, cancel, terminate, and reconciliation
- make reconciliation after restart feed the engine with normal workflow events instead of mutating runtime state directly

Operational invariants:

- mission pause suppresses auto-launch of new work without implying session termination or queue clearing
- panic suppresses new launches and may terminate sessions or clear the launch queue according to workflow policy
- task launch policy is copied from stage defaults at generation time and may then diverge per task
- task generation must be deterministic from the snapshotted workflow configuration and the target stage
- stage eligibility is determined strictly by `stageOrder`, and reopening earlier work must invalidate later stage eligibility without inventing stage rollback state
- mission completion is derived and delivery is an explicit follow-up event

Implementation outcomes:

- replace the current workflow runtime model with a reducer, event ingestion layer, generator, effect runner, validation layer, and mission-local runtime document
- remove legacy stage runtime behavior, imperative transition evaluators, and filesystem-reconstruction workflow truth
- rewrite tests around reducer behavior, event validation, task and session transition contracts, launch queue scheduling, projections, and reconciliation

Use the product artifacts in this mission folder as the canonical context boundary.