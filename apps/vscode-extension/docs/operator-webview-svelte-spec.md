# Mission Operator Webview Spec

## Goal

Replace the roadmap webview's hand-authored HTML with a minimal Svelte 5 client bundle while preserving the existing extension-side orchestration in the session controller and operator client.

## Scope

- Keep all mission logic, operator execution, snapshot refresh, and file mutation in the extension host.
- Introduce one bundled Svelte 5 app rendered inside the existing timeline panel.
- Style the webview with Tailwind utilities and a thin set of VS Code-aware utility classes.
- Provide three tabs: `Roadmap`, `Console`, and `Graph`.

## Host And Client Contract

- The extension host remains the single source of truth for the `MissionTimelineModel`.
- The webview sends the same command messages already supported by the panel:
  - `guide-slice`
  - `toggle-task`
  - `console-reply`
- The host continues to push `console-event` updates into the webview.

## Non-Goals For This Pass

- No migration of session logic into Svelte stores.
- No shadcn-svelte adoption yet.
- No `@xyflow/svelte` dependency yet; the graph tab is a lightweight dependency view that can be upgraded later.

## Build Shape

- Add a Vite build that emits deterministic assets into `media/webview/`.
- Keep `tsc` as the extension-host build.
- Make the extension `build` script run the webview bundle first so packaged VSIX output always contains the current webview assets.

## Acceptance

- The Mission Roadmap opens and renders from the bundled Svelte app.
- Roadmap actions, task toggles, and console replies keep working.
- The console continues to receive streamed operator updates from the host.
- The extension packages without hand-editing generated assets.
