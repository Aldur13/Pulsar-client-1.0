import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tauri expects the dev server on a fixed port (1420) so the webview can be
// pointed at it reliably; strictPort makes startup fail loudly instead of
// silently drifting to another port if 1420 is already taken.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_"],
});
