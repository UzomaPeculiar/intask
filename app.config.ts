import { defineConfig } from "@tanstack/react-start/config";

const serverPreset = process.env.VERCEL ? "vercel" : process.env.NETLIFY ? "netlify" : "node_server";

export default defineConfig({
  server: {
    preset: serverPreset,
  },
});