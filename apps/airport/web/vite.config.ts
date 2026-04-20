import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import type { HttpServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { attachTerminalWebSocketServer } from "./src/lib/server/terminal-websocket.server";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const workspacePackageRoots = {
	"@flying-pillow/mission-core": path.resolve(currentDirectory, "../../../packages/core/src"),
	"@flying-pillow/mission": path.resolve(currentDirectory, "../../../packages/mission/src")
} as const;

function missionTerminalWebSocketPlugin() {
	return {
		name: "mission-terminal-websocket",
		configureServer(server: { httpServer?: HttpServer | null }) {
			if (server.httpServer) {
				attachTerminalWebSocketServer(server.httpServer);
			}
		},
		configurePreviewServer(server: { httpServer?: HttpServer | null }) {
			if (server.httpServer) {
				attachTerminalWebSocketServer(server.httpServer);
			}
		}
	};
}

export default defineConfig({
	cacheDir: "/tmp/mission-airport-vite-cache",
	plugins: [
		tailwindcss(),
		sveltekit(),
		missionTerminalWebSocketPlugin()
	],
	ssr: {
		noExternal: [
			"@flying-pillow/mission-core",
			"@flying-pillow/mission"
		]
	},
	server: {
		fs: {
			allow: [".", ...Object.values(workspacePackageRoots)]
		}
	}
});
