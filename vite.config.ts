import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // The storefront is mounted at the domain root and exposes nested SPA routes
  // such as /product/:slug. Root-absolute build assets keep direct navigation to
  // those routes from incorrectly requesting /product/assets/*.
  base: "/",
  plugins: [react()],
  test: {
    css: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
})
