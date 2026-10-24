import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The daemon trusts this origin when started with `--dev` (DEV_ORIGIN in
// crates/dronex/src/daemon/mod.rs), and listens on 45100 then. Its API and
// socket are proxied through, so the page's cookie is this origin's.
const daemon = process.env.DRONEX_DAEMON ?? "http://127.0.0.1:45100";

export default defineConfig({
  plugins: [react()],
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
  build: { outDir: "dist", emptyOutDir: true },
});
