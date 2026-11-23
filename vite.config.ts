import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const pagesBase = "/saenggibu-jangin/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? pagesBase : "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 47321,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 47321,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
}));
