---
taskKind: "verification"
pairedTaskId: "implementation/09-documentation-and-final-cleanup"
dependsOn: ["implementation/09-documentation-and-final-cleanup"]
agent: "copilot-cli"
---

# Verify Documentation And Final Cleanup

Paired task: `implementation/09-documentation-and-final-cleanup`.

Focused checks: confirm the runtime documentation states Sandcastle is a provider-adapter dependency, Mission still owns lifecycle, logs, PTY transport, interaction-mode semantics, local MCP signaling, runner-specific provisioning, and capability-gated non-interactive UX, and that no legacy Pi-only path remains active; verify the slice satisfies `pnpm --filter @flying-pillow/mission-core check`, `pnpm --filter @flying-pillow/mission-core test`, plus `pnpm --filter @flying-pillow/mission-core build`.

Failure signals: stale Pi path still active, PTY launch bypassed in the documented ownership model, agent claim treated as deterministic verification, direct Sandcastle orchestration import reintroduced as active truth, or cleanup leaving dual runtime paths behind.

Ignored baseline failures: none.

Evidence location: append a task-specific section to `03-IMPLEMENTATION/VERIFY.md`. Do not add features.
