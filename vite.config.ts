import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
