# Replace The Split Agent Runtime Boundary

Unify Mission's runtime layer behind a single provider-neutral session contract that both the workflow engine and operator surfaces use.

Execution contract:

- treat this as a clean-break runtime rewrite, not a compatibility bridge
- define exactly one authoritative runtime boundary in core: `AgentRunner` plus `AgentSession`
- do not preserve `MissionAgentRuntime`, `WorkflowTaskRunner`, or split workflow-versus-interactive runtime paths in active code
- keep provider translation behind adapters and keep workflow semantics in the engine and orchestrator only
- require prompt submission, structured command submission, explicit cancel and terminate lifecycle methods, and restart reconciliation support

Required architecture:

- workflow engine owns when sessions start, prompt, command, cancel, terminate, and how runtime facts reduce into mission state
- a new session orchestrator owns runner registry, session registry, attach or reattach flow, prompt and command routing, MCP server attachment, event forwarding, and persisted session recovery
- provider adapters own translation to provider-native SDKs or CLIs and must reject unsupported behavior explicitly
- provider runtimes are implementation details and must not define core Mission runtime contracts

Core contract requirements:

- model normalized runner capabilities, prompt payloads, command payloads, MCP server references, snapshots, and runtime events in core
- make prompts first-class for running sessions and require explicit prompt rejection if a runtime cannot accept them
- make engine-defined commands first-class for running sessions, with minimal required support for `interrupt`, `continue`, and `checkpoint`
- keep `cancel()` and `terminate()` as lifecycle methods rather than command aliases
- ensure terminal sessions reject further prompts and commands
- guarantee every normalized snapshot carries authoritative `missionId` and `taskId` before it reaches the workflow engine

Implementation sequence:

1. define the new core runtime namespace and contracts before touching adapters
2. build the orchestrator and persisted session store
3. rewire workflow effect execution to use the orchestrator
4. rewire daemon and mission session operations to use that same orchestrator
5. rewrite the provider adapter against the new contract
6. delete legacy contracts, factories, exports, and tests that encode the split runtime model

Primary file actions:

- replace `packages/core/src/daemon/MissionAgentRuntime.ts`
- delete or replace `packages/core/src/workflow/engine/runner.ts`
- rewrite Copilot runtime code against the new `AgentRunner` contract only
- replace dual runtime loading in daemon startup with one configured runner registry
- expose the new runtime namespace from core and remove legacy runtime re-exports
- introduce dedicated runtime files for contracts, runner registry, orchestrator, event plumbing, and persisted session storage

Verification requirements:

- contract tests for start, snapshot, prompt, command, cancel, terminate, and terminal-state behavior
- explicit rejection tests for unsupported commands and prompts
- reconciliation tests for attach, list, and dead-session recovery after restart
- workflow-engine integration tests proving launch and control flow through the shared runtime path only
- daemon operator tests proving mission and session operations route through the same orchestrator path only

Use the product artifacts in this mission folder as the canonical context boundary.