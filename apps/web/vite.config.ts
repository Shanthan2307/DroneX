import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

// The daemon trusts this origin when started with `--dev` (DEV_ORIGIN in
// crates/dronex/src/daemon/mod.rs), and listens on 45100 then. Its API and
// socket are proxied through, so the page's cookie is this origin's.
const daemon = process.env.DRONEX_DAEMON ?? "http://127.0.0.1:45100";

// Each build gets its own id. The daemon tags the page with it (ETag), so
// a browser asks for a new build instead of keeping the last one, and the
// page reports it at `/interface/ready`.
const builtAt = new Date().toISOString();
const buildId = `${pkg.version}+${builtAt.replace(/[-:]/g, "").replace(/\..*$/, "")}`;

function versionFile(): Plugin {
  return {
    name: "dronex-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ id: buildId, version: pkg.version, builtAt }, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  server: {
    host: "localhost",
    port: 45101,
    strictPort: true,
    proxy: {
      "/api": { target: daemon, changeOrigin: false },
      "/rpc": { target: daemon, ws: true, changeOrigin: false },
      "/interface": { target: daemon, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // MapLibre is most of the bundle and changes least: its own file.
    chunkSizeWarningLimit: 1100,
    rollupOptions: { output: { manualChunks: { maplibre: ["maplibre-gl"] } } },
  },
});
