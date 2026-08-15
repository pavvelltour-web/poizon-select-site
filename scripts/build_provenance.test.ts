// @vitest-environment node

import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fullSha = "0123456789abcdef0123456789abcdef01234567"

function read(relativePath: string): string {
  return readFileSync(path.join(siteRoot, relativePath), "utf8")
}

function verifyBuildVersion(value?: string) {
  const env = { ...process.env }
  if (value === undefined) delete env.BUILD_VERSION
  else env.BUILD_VERSION = value
  return spawnSync(process.execPath, ["scripts/verify_build_version.mjs"], {
    cwd: siteRoot,
    encoding: "utf8",
    env,
  })
}

describe("immutable build provenance", () => {
  it("fails production builds without a full lowercase Git SHA", () => {
    expect(verifyBuildVersion().status).toBe(1)
    expect(verifyBuildVersion("0377334").status).toBe(1)
    expect(verifyBuildVersion(fullSha.toUpperCase()).status).toBe(1)
  })

  it("accepts the full SHA and threads it through build, image and deploy config", () => {
    const verified = verifyBuildVersion(fullSha)
    expect(verified.status).toBe(0)
    expect(verified.stdout).toContain(fullSha.slice(0, 12))

    expect(read("vite.config.ts")).toContain("__BUILD_VERSION__")
    expect(read("Dockerfile")).toContain('ARG BUILD_VERSION="unknown"')
    expect(read("Dockerfile")).toContain("ENV BUILD_VERSION=$BUILD_VERSION")
    expect(read(".github/workflows/deploy-pages.yml")).toContain(
      "BUILD_VERSION: ${{ github.sha }}",
    )
    expect(read("src/landing/sections/footer.tsx")).toContain(
      "Сборка {buildVersion.slice(0, 12)}",
    )
    expect(read("scripts/verify_dist_portability.mjs")).toContain(
      "bundle is missing the immutable build version",
    )
  })
})
