/**
 * @file apps/vscode-extension/vite.config.ts
 * @description Builds the Mission Svelte webview bundle into deterministic media assets for VS Code packaging.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	build: {
		outDir: path.resolve(__dirname, 'media/webview'),
		emptyOutDir: true,
		cssCodeSplit: false,
		rollupOptions: {
			input: {
				timeline: path.resolve(__dirname, 'src/webview/main.ts'),
				cockpit: path.resolve(__dirname, 'src/webview/cockpit-main.ts')
			},
			output: {
				entryFileNames: (chunkInfo) =>
					chunkInfo.name === 'cockpit'
						? 'mission-cockpit.js'
						: 'mission-timeline.js',
				chunkFileNames: 'assets/[name]-[hash].js',
				assetFileNames: (assetInfo) => {
					if (assetInfo.names.some((name) => name.includes('cockpit-main'))) {
						return 'mission-cockpit.css';
					}
					if (assetInfo.names.some((name) => name.endsWith('.css'))) {
						return 'mission-timeline.css';
					}
					return 'assets/[name][extname]';
				}
			}
		}
	}
});