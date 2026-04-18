<!-- /apps/airport/web/src/routes/+layout.svelte: Root layout that seeds app-wide client context and renders route content. -->
<script lang="ts">
	import "../app.css";
	import { ModeWatcher } from "mode-watcher";
	import type { Snippet } from "svelte";
	import { asset } from "$app/paths";
	import type { LayoutData } from "./$types";

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<svelte:head>
	<link rel="icon" href={asset("/favicon.ico")} sizes="any" />
	<link rel="icon" type="image/png" href={asset("/favicon.png")} />
	<link rel="apple-touch-icon" href={asset("/apple-touch-icon.png")} />
</svelte:head>

<ModeWatcher />

{@render children()}
