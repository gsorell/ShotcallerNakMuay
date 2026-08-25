import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

import { version } from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // The one place the marketing version enters the bundle. Analytics used to
  // carry its own copy as a literal, which went stale at 1.5.0 and reported
  // that for eight releases; a build-time define cannot drift from the bump.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    watch: {
      // Capacitor copies the built web app into android/ (and its build
      // intermediates), which the dev-server watcher tries to scan and can
      // crash on (Windows scandir UNKNOWN). These folders aren't source.
      ignored: ["**/android/**", "**/ios/**"],
    },
  },
  build: {
    rollupOptions: {
      external: ["nosleep.js"],
    },
  },
});
