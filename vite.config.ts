import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // The SPA is served from the domain root while product pages use history
  // routes such as /product/:slug. Root-relative assets keep direct/deep-link
  // loads from incorrectly requesting /product/assets/*.
  base: process.env.VITE_DEPLOY_BASE || "/",
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
