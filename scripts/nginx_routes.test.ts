// @vitest-environment node

import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

describe("production SPA routes", () => {
  it("serves /catalog and canonicalizes /catalog/ without losing its query", async () => {
    const config = await readFile(path.join(siteRoot, "nginx.conf"), "utf8")

    expect(config).toContain("absolute_redirect off;")
    expect(config).toContain("port_in_redirect off;")
    expect(config).toMatch(/location = \/catalog\s*\{[^}]*try_files \/index\.html =404;/su)
    expect(config).toMatch(
      /location = \/catalog\/\s*\{\s*return 308 \/catalog\$is_args\$args;\s*\}/su,
    )
    expect(config).not.toMatch(/location = \/catalog\/\s*\{[^}]*try_files/su)
    expect(config).toMatch(/location \/\s*\{[^}]*try_files \$uri \/index\.html;/su)
    expect(config).not.toContain("try_files $uri $uri/ /index.html;")
  })
})
