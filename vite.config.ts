import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      // Local-only development proxy to FastAPI CRM. It is not bundled; the
      // production browser uses the Nginx same-origin /api proxy below.
      "/api": {
        target: process.env.CRM_API_UPSTREAM || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    css: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
})
