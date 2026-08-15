import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const buildVersionCandidate = process.env.BUILD_VERSION?.trim() ?? ""
const publicBuildVersion = /^[a-f0-9]{40}$/u.test(buildVersionCandidate)
  ? buildVersionCandidate
  : "unknown"

export default defineConfig({
  // The storefront is mounted at the domain root and exposes nested SPA routes
  // such as /product/:slug. Root-absolute build assets keep direct navigation to
  // those routes from incorrectly requesting /product/assets/*.
  base: "/",
  define: {
    __BUILD_VERSION__: JSON.stringify(publicBuildVersion),
  },
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: false,
      },
    },
  },
  test: {
    css: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 15_000,
  },
})
