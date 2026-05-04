---
title: "VERIFY: #31 - Adopt Sandcastle `AgentProviderAdapter` for four agent coders without sandboxing"
artifact: "verify"
createdAt: "2026-05-04T07:01:50.223Z"
 updatedAt: "2026-05-04T11:58:59Z"
stage: "implementation"
---

Branch: mission/31-adopt-sandcastle-agentprovideradapter-for-four-a

## Unit Test Evidence

- TODO: Aggregate the focused verification logs for completed implementation tasks.

## Task Verification Ledger

- TODO: For each verification task, record task id, checks, result, fixes, and ignored unrelated failures.

### `verification/01-dependency-and-runner-id-boundary-verify`

- **Paired task:** `implementation/01-dependency-and-runner-id-boundary`
- **Result:** **Passed with deferred validation**
- **Checks:**
  - Confirmed `@ai-hero/sandcastle` appears in exactly one workspace manifest, `packages/core/package.json`, and `pnpm-lock.yaml` records it only under the `packages/core` importer.
  - Confirmed the canonical Mission runner-id enum in `packages/core/src/entities/Mission/MissionSchema.ts` includes `copilot-cli`, `claude-code`, `pi`, `codex`, and `opencode`.
  - Confirmed workflow task and runtime schemas in `packages/core/src/workflow/WorkflowSchema.ts` both reuse `MissionAgentRunnerSchema`, so all four added runner ids are legal in workflow definitions.
  - Confirmed `packages/core/src/daemon/runtime/agent/runtimes/AgentRuntimeIds.ts` re-exports `MISSION_AGENT_RUNNER_IDS` as `SUPPORTED_AGENT_RUNNER_IDS`, and `isSupportedAgentRunner()` checks that shared list rather than a divergent allowlist.
  - Confirmed `packages/core/src/daemon/runtime/agent/runtimes/AgentRuntimeIds.test.ts` explicitly covers all five supported runner ids in the guard and schema assertions.
  - Confirmed no direct `@ai-hero/sandcastle`, `Sandcastle`, or `AgentProviderAdapter` usage exists under `packages/core/src`, so this slice has not introduced provider initialization or orchestration behavior ahead of the adapter boundary.
  - Ran `pnpm --filter @flying-pillow/mission-core check` and `pnpm --filter @flying-pillow/mission-core test`.
- **Validation note:**
  - `pnpm --filter @flying-pillow/mission-core check` passes.
  - `pnpm --filter @flying-pillow/mission-core test` remains **to be checked** and is not treated as a blocker for this verification entry.
- **Fixes applied:** None. Verification only.
- **Ignored unrelated failures:** Filtered core test results deferred for follow-up.

#### Reverification at `2026-05-04T10:47:03Z`

- **Result:** **Passed with deferred validation**
- **Checks:**
  - Confirmed `@ai-hero/sandcastle` appears only in `packages/core/package.json`, and `pnpm-lock.yaml` records it only under the `packages/core` importer.
  - Confirmed `packages/core/src/entities/Mission/MissionSchema.ts` defines the legal Mission runner ids as `copilot-cli`, `claude-code`, `pi`, `codex`, and `opencode`.
  - Confirmed `packages/core/src/workflow/WorkflowSchema.ts` reuses `MissionAgentRunnerSchema` for both generated workflow tasks and workflow runtime settings, so all four added ids are legal in workflow definitions.
  - Confirmed `packages/core/src/daemon/runtime/agent/runtimes/AgentRuntimeIds.ts` derives `SUPPORTED_AGENT_RUNNER_IDS` from `MISSION_AGENT_RUNNER_IDS`, and `isSupportedAgentRunner()` recognizes all supported ids through that shared list.
  - Confirmed `packages/core/src/daemon/runtime/agent/runtimes/AgentRuntimeIds.test.ts` exercises all supported runner ids against the guard plus Mission and workflow schema parsing.
  - Confirmed no `@ai-hero/sandcastle`, `Sandcastle`, or `AgentProviderAdapter` references exist under `packages/core/src`, so this slice still does not introduce provider initialization or direct Sandcastle orchestration before the adapter boundary.
  - Ran `pnpm --filter @flying-pillow/mission-core check` and `pnpm --filter @flying-pillow/mission-core test`.
- **Validation note:**
  - `pnpm --filter @flying-pillow/mission-core check` passes.
  - `pnpm --filter @flying-pillow/mission-core test` is **to be checked** in follow-up and is not treated as a blocker for this entry.
- **Fixes applied:** None. Verification only.
- **Ignored unrelated failures:** Filtered core test results deferred for follow-up.

### `verification/02-mission-owned-sandcastle-provider-initialization-boundary-verify`

- **Paired task:** `implementation/02-mission-owned-sandcastle-provider-initialization-boundary`
- **Result:** **Focused adapter checks passed; package validation gate blocked by failures outside this task change**
- **Checks:**
  - Confirmed `packages/core/src/daemon/runtime/agent/providers/AgentProviderAdapter.ts` defines the Mission-owned runner-id contract as exactly `claude-code`, `pi`, `codex`, and `opencode`, and its default provider factory map binds only those runner ids to Sandcastle's public `claudeCode`, `pi`, `codex`, and `opencode` factories.
  - Confirmed `initialize(...)` resolves Mission-owned settings first, validates non-empty model/launch mode/provider env, constructs the selected provider with Mission-resolved model plus provider env, and reports capabilities from upstream facts without inventing support: interactive capability follows `buildInteractiveArgs`, print is always available, `opencode` reports `streamParsing: false`, session capture follows `provider.captureSessions`, and session usage is exposed only when `parseSessionUsage` exists.
  - Confirmed provider-specific option mapping stays inside the adapter boundary: Claude Code alone accepts `reasoningEffort`, `dangerouslySkipPermissions`, `resumeSession` for print mode, and optional `captureSessions`; Codex accepts its own reasoning effort values; Pi and OpenCode reject unsupported options through `ProviderInitializationError`.
  - Confirmed launch-plan validation is explicit before runtime spawn: `buildInteractiveLaunch(...)` rejects interactive resume, rejects providers without `buildInteractiveArgs`, validates non-empty argv and executable command, and returns command/args separately; `buildPrintLaunch(...)` rejects empty commands and preserves provider-returned `stdin`.
  - Confirmed env precedence is explicit and preserved as `runtimeEnv -> provider.env -> launchEnv`, so per-session launch env wins over provider defaults and runtime env.
  - Confirmed structured observation handling remains Mission-owned: parsed provider events are normalized into Mission message/signal/usage observations, and unsupported parsing yields `{ kind: 'none' }` instead of a false positive capability claim.
  - Confirmed Sandcastle remains confined to the provider adapter boundary in tracked source: the only `@ai-hero/sandcastle` source import is `packages/core/src/daemon/runtime/agent/providers/AgentProviderAdapter.ts`; no direct sandbox/worktree/orchestration import was introduced elsewhere under `packages/core/src`.
  - Ran `pnpm --filter @flying-pillow/mission-core check`, `pnpm exec vp test run --config vitest.config.ts src/daemon/runtime/agent/providers/AgentProviderAdapter.test.ts`, and `pnpm --filter @flying-pillow/mission-core test`.
- **Validation note:**
  - `pnpm --filter @flying-pillow/mission-core check` passes.
  - Focused adapter coverage passes in `src/daemon/runtime/agent/providers/AgentProviderAdapter.test.ts` with 10/10 tests passing, including exact mappings for `claude-code`, `pi`, `codex`, and `opencode`; env precedence; stdin preservation; capability honesty; and explicit provider-initialization / unsupported-capability failures.
  - `pnpm --filter @flying-pillow/mission-core test` does **not** satisfy this task's validation gate in the current workspace: beyond the two approved baseline failures in `src/lib/config.test.ts` and `src/daemon/runtime/agent/TerminalAgentTransport.test.ts`, the run also fails in `src/daemon/runtime/agent/runtimes/PiAgentRunner.test.ts`, `src/system/SystemStatus.test.ts`, `src/daemon/runtime/agent/runtimes/CopilotCliAgentRunner.test.ts`, and `src/entities/Repository/Repository.test.ts`.
- **Fixes applied:** None. Verification only.
- **Ignored unrelated failures:** `src/lib/config.test.ts` (`scaffolds a default config in XDG config home`) and `src/daemon/runtime/agent/TerminalAgentTransport.test.ts` (`resolves the Copilot CLI from the VS Code global storage fallback when PATH is missing it`) per task instructions.

#### Reverification at `2026-05-04T11:39:07Z`

- **Result:** **Failed**
- **Checks:**
  - Confirmed the current adapter implementation in `packages/core/src/daemon/runtime/agent/providers/AgentProviderAdapter.ts` still keeps Sandcastle confined to the provider boundary and imports only the public provider factories `claudeCode`, `pi`, `codex`, and `opencode` from `@ai-hero/sandcastle`.
  - Confirmed the adapter contract still maps exactly to the four required runner ids, resolves Mission-owned model/settings/env before provider construction, validates launch mode and provider options before process launch, preserves `runtimeEnv -> provider.env -> launchEnv` precedence, preserves provider-returned `stdin` for print launches, and reports capabilities from upstream facts rather than inferred support.
  - Confirmed launch-plan validation remains explicit: interactive launch rejects unsupported resume behavior, missing `buildInteractiveArgs`, empty argv, and invalid commands; print launch rejects empty commands.
  - Confirmed runtime observation parsing remains Mission-owned and normalizes provider output into Mission message/signal/usage observations, with `{ kind: 'none' }` returned when parsing yields no structured events.
  - Confirmed no direct `@ai-hero/sandcastle/*` subpath import or sandbox/worktree/orchestration import exists under `packages/core/src`.
  - Ran `pnpm --filter @flying-pillow/mission-core check`, `pnpm exec vitest run packages/core/src/daemon/runtime/agent/providers/AgentProviderAdapter.test.ts`, and `pnpm --filter @flying-pillow/mission-core test`.
- **Validation note:**
  - `pnpm --filter @flying-pillow/mission-core check` fails with `TS2307` because `packages/core/src/daemon/runtime/agent/providers/AgentProviderAdapter.test.ts` imports `./AgentProviderAdapter.js`, but the implementation file present in the workspace is `AgentProviderAdapter.ts`.
  - The focused adapter test run fails before executing any tests for the same missing-module import, so the adapter behavior is not currently validated by executable test evidence in this workspace.
  - `pnpm --filter @flying-pillow/mission-core test` does not satisfy the validation gate: the run reports `7 failed | 29 passed` test files and `15 failed | 204 passed` tests, including the two approved baseline failures in `src/lib/config.test.ts` and `src/daemon/runtime/agent/TerminalAgentTransport.test.ts` plus the task-scoped `src/daemon/runtime/agent/providers/AgentProviderAdapter.test.ts` import failure.
- **Fixes applied:** None. Verification only.
- **Ignored unrelated failures:** `src/lib/config.test.ts` (`scaffolds a default config in XDG config home`) and `src/daemon/runtime/agent/TerminalAgentTransport.test.ts` (`resolves the Copilot CLI from the VS Code global storage fallback when PATH is missing it`) per task instructions.

#### Reverification at `2026-05-04T11:58:59Z`

- **Result:** **Focused adapter checks passed; package validation gate blocked by failures outside this task change**
- **Checks:**
  - Confirmed `packages/core/src/daemon/runtime/agent/providers/AgentProviderAdapter.ts` defines the Mission-owned runner-id boundary as exactly `claude-code`, `pi`, `codex`, and `opencode`, and the default factory map binds only those ids to Sandcastle's public `claudeCode`, `pi`, `codex`, and `opencode` exports.
  - Confirmed `initialize(...)` resolves Mission-owned settings before provider construction, validates non-empty model, launch mode, provider env, provider-specific option legality, and provider availability, then reports capabilities from upstream provider facts instead of inventing support.
  - Confirmed launch-plan validation stays inside the adapter boundary: interactive launch rejects resume, missing `buildInteractiveArgs`, empty argv, and invalid commands; print launch rejects empty commands and preserves provider-returned `stdin`; launch env precedence remains `runtimeEnv -> provider.env -> launchEnv`.
  - Confirmed runtime observations remain Mission-owned: structured provider output is normalized into Mission message/signal/usage observations, and unstructured output yields `{ kind: 'none' }`.
  - Confirmed Sandcastle remains confined to the adapter boundary in source: the only `@ai-hero/sandcastle` import under `packages/core/src` is `packages/core/src/daemon/runtime/agent/providers/AgentProviderAdapter.ts`, and no direct Sandcastle sandbox/worktree/orchestration import exists under `packages/core/src`.
  - Ran `pnpm --filter @flying-pillow/mission-core check`, `pnpm exec vitest run packages/core/src/daemon/runtime/agent/providers/AgentProviderAdapter.test.ts`, and `pnpm --filter @flying-pillow/mission-core test`.
- **Validation note:**
  - `pnpm --filter @flying-pillow/mission-core check` passes.
  - `pnpm exec vitest run packages/core/src/daemon/runtime/agent/providers/AgentProviderAdapter.test.ts` passes with 10/10 tests, covering exact runner mapping, Mission-resolved model/options/env initialization, env precedence, stdin preservation, structured observation handling, and explicit provider-initialization / unsupported-capability failures.
  - `pnpm --filter @flying-pillow/mission-core test` still fails with `6 failed | 30 passed` test files and `15 failed | 214 passed` tests, but the remaining red suites are outside this task change rather than regressions in the `AgentProviderAdapter` verification slice.
- **Fixes applied:** None. Verification only.
- **Ignored unrelated failures:** `src/lib/config.test.ts` (`scaffolds a default config in XDG config home`) and `src/daemon/runtime/agent/TerminalAgentTransport.test.ts` (`resolves the Copilot CLI from the VS Code global storage fallback when PATH is missing it`) per task instructions.
- **Outside this task change:** `src/system/SystemStatus.test.ts`, `src/entities/Repository/Repository.test.ts`, `src/daemon/runtime/agent/runtimes/CopilotCliAgentRunner.test.ts`, and `src/daemon/runtime/agent/runtimes/PiAgentRunner.test.ts` still fail in the workspace-wide core test run, but they are outside the provider-initialization boundary verified by this task.

## Boundary Evidence

- TODO: Record ownership, public interface, data contract, integration, or dependency-direction checks.

## Gaps

- TODO: Record verification gaps that must be resolved before audit.
- TODO: Separate task gaps from baseline failures.
