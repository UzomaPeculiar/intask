import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    react(),
    tailwindcss(),
  ],
  // Note: manualChunks / manual vendor splitting is deliberately avoided.
  // With this project's Rolldown-based Vite (v8) it inlines shared modules into
  // the entry chunk, inflating the initial load (136 KB -> 185+ KB gzip) and
  // defeating route-splitting. The default chunking already produces
  // content-hashed, cache-stable vendor chunks (e.g. the React/supabase/query
  // vendor chunk keeps the same hash across deploys as long as those versions
  // don't change), so we keep natural chunking.
});