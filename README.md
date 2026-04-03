# 🌍 Mission

**The orchestration engine for AI-driven software development.**

Mission is a local state machine and governance layer that sits between your issue tracker and your AI coding agents. It brings predictability, architectural strictness, and deterministic verification to AI-assisted development.

If you have ever spent hours untangling AI-generated "spaghetti code" or fighting context rot in a long chat session, Mission provides the structural guardrails to make AI development safe, scalable, and maintainable.

---

## The Problem

AI coding agents (like GitHub Copilot CLI, Claude Code, or Cursor) excel at generating code quickly. However, they lack architectural awareness. Left unmanaged, AI agents tend to:
*   Bypass established design patterns and object-oriented boundaries.
*   Modify out-of-scope files, creating unintended blast radiuses.
*   Lose context over long sessions, leading to hallucinated logic.
*   Require constant human micromanagement to stay on task.

The result is a fast-growing accumulation of silent technical debt.

## The Solution

Mission acts as Air Traffic Control for your repository. It does not replace your AI agents; it manages them.

By shifting the workflow from **prompt-driven** to **spec-driven**, Mission locks the AI into a strict execution loop. It pulls your issues, compiles them into explicit Implementation Blueprints, and forces the AI to execute one bounded task at a time. Most importantly, it intercepts the AI's actions to ensure they comply with your repository's unique architectural rules before any code is permanently saved.

---

## Core Capabilities

*   📜 **Architectural Governance (The Constitution)** 
    Define your repository's specific engineering standards in a single `.agents/constitution.md` file. Mission injects these laws into every session, ensuring the AI respects your tech stack, formatting, and structural boundaries.
*   🗺️ **Spec-Driven Execution** 
    Stop chatting and start building. Mission translates your GitHub or Jira issues into strict `SPEC.md` blueprints and `TASKS.md` ledgers. The AI is mathematically constrained to the approved file-impact matrix.
*   🛑 **Deterministic CI Gating** 
    Mission disables AI self-praise. An agent cannot simply claim a task is "done." Mission gates all progress behind your actual CI pipeline (linters, unit tests). If the AI's code fails, Mission rolls back the state and forces the agent to try again.
*   🤖 **Agent-Agnostic** 
    Avoid vendor lock-in. Mission manages the state machine, allowing you to seamlessly swap the underlying compute engine (Copilot, Claude, etc.) as the AI landscape evolves.
*   🎛️ **Operator Surfaces** 
    Steer missions from the `mission` CLI and the VS Code cockpit while keeping one governed mission model.

---

## Installation & Quick Start

Mission is designed to be lightweight and frictionless to install in any existing repository.

**1. Install workspace dependencies:**
```bash
pnpm install
pnpm build
```

**2. Initialize your repository:**
This command safely scaffolds the `.mission/` state directory and the default Mission settings file.
```bash
./mission init
```

**3. Start a Mission:**
Open the cockpit. Mission will auto-start the daemon, and you can bootstrap a mission from the tracker inside the interactive surface.
```bash
./mission
```

**4. Inspect and steer the mission:**
```bash
./mission
mission daemon:stop
```

## Command Surface

Run `mission help` for the current command surface. As of this release, the implemented commands are:

- `mission [--issue <id>] [--branch <ref>]`
- `mission --hmr [--issue <id>] [--branch <ref>]`
- `mission init`
- `mission daemon:stop [--json]`

Notes:

- Bare `mission` is the primary entrypoint and launches the interactive cockpit.
- `mission --hmr` runs the cockpit with automatic restart when CLI cockpit source files change.
- Mission bootstrap, status, gates, transitions, delivery, and agent execution are now cockpit-driven RPC actions instead of standalone top-level CLI commands.

---

## How It Changes the Developer Experience (DX)

Mission restores the traditional balance of software engineering: **The Human acts as the Principal Architect, and the AI acts as the Developer.**

You no longer have to review every line of code as it is being typed. You define the rules, you approve the blueprint, and you review the final, CI-verified Pull Request. Mission handles the chaotic execution in the middle.

## License

..