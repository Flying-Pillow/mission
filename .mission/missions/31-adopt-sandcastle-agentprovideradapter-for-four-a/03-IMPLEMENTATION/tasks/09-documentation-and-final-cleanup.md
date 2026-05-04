---
taskKind: "implementation"
pairedTaskId: "implementation/09-documentation-and-final-cleanup-verify"
dependsOn: ["implementation/08-agent-session-execution-ux-verify"]
agent: "copilot-cli"
---

# Documentation And Final Cleanup

Objective: publish the preserved ownership model and remove any obsolete direct-provider runner truth left behind by the migration.

Context: use `02-SPEC/SPEC.md` for the required documentation points, cleanup rules, and remaining boundary assertions so the repository ends with one active provider-neutral runtime path and no stale Pi-only truth.

Allowed files: `specifications/mission/execution/agent-runtime.md` plus any cleanup files from Slice 3 that remain obsolete.

Forbidden files: `apps/airport/**` outside the Agent session interaction-mode projection; `packages/core/src/daemon/runtime/agent/TerminalAgentTransport.ts`; `packages/core/src/entities/**` outside runner-id schema updates and provider-neutral Agent session interaction-mode projection; `docs/adr/**`; any Sandcastle sandbox/worktree/orchestration integration files; workflow gate or verification code; any parser that directly mutates workflow state; remote MCP services or hosted endpoints; `.agents/mcp.json` as a presumed universal agent config; tracked files containing per-session MCP credentials.

Expected change: document that Sandcastle is a provider-adapter dependency while Mission still owns lifecycle, logs, PTY transport, interaction modes, MCP server lifecycle, session registration, acknowledgement semantics, and capability-gated non-interactive UX; remove any obsolete runner or signal artifacts left from earlier slices so no legacy Pi-only path remains active.

Compatibility policy: preserve Mission runtime ownership and current Airport terminal behavior, but do not preserve obsolete direct Pi command-building or duplicate runtime truths once the Sandcastle-backed path is active.

Validation gate: `pnpm --filter @flying-pillow/mission-core check`, `pnpm --filter @flying-pillow/mission-core test`, `pnpm --filter @flying-pillow/mission-core build`.
