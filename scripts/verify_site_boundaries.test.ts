// @vitest-environment node

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest"
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoots: string[] = []

function makeFixture(): string {
  const temporaryRoot = mkdtempSync(
    path.join(tmpdir(), "poizon-site-boundary-"),
  )
  temporaryRoots.push(temporaryRoot)
  const fixture = path.join(temporaryRoot, "site")
  mkdirSync(fixture)

  for (const relative of [
    ".dockerignore",
    ".env.example",
    "Dockerfile",
    "index.html",
    "nginx.conf",
    "package.json",
    "vite.config.ts",
  ]) {
    copyFileSync(path.join(siteRoot, relative), path.join(fixture, relative))
  }
  cpSync(path.join(siteRoot, "src"), path.join(fixture, "src"), {
    recursive: true,
  })
  cpSync(path.join(siteRoot, "public"), path.join(fixture, "public"), {
    recursive: true,
  })
  mkdirSync(path.join(fixture, "scripts"))
  copyFileSync(
    path.join(siteRoot, "scripts", "verify_site_boundaries.mjs"),
    path.join(fixture, "scripts", "verify_site_boundaries.mjs"),
  )

  return fixture
}

function runVerifier(fixture: string) {
  return spawnSync(process.execPath, ["scripts/verify_site_boundaries.mjs"], {
    cwd: fixture,
    encoding: "utf8",
    timeout: 20_000,
  })
}

afterEach(() => {
  for (const temporaryRoot of temporaryRoots.splice(0)) {
    rmSync(temporaryRoot, { force: true, recursive: true })
  }
})

describe("standalone site runtime boundary", () => {
  it("rejects a browser runtime network call", () => {
    const fixture = makeFixture()
    writeFileSync(
      path.join(fixture, "src", "runtime-call.ts"),
      'fetch("https://crm.example.test/private-api")\n',
      "utf8",
    )

    const result = runVerifier(fixture)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("forbidden runtime network call")
  })

  it("rejects a price reader that loses the 12-hour verified-response gate", () => {
    const fixture = makeFixture()
    const priceReader = path.join(fixture, "src", "landing", "catalog-price-api.ts")
    writeFileSync(
      priceReader,
      readFileSync(priceReader, "utf8").replace('response.snapshot_hours !== 12', "false"),
      "utf8",
    )

    const result = runVerifier(fixture)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("forbidden runtime network call")
  })

  it("requires the named release-rights command", () => {
    const fixture = makeFixture()
    const packagePath = path.join(fixture, "package.json")
    const packageManifest = JSON.parse(readFileSync(packagePath, "utf8"))
    delete packageManifest.scripts["verify:release-rights"]
    writeFileSync(packagePath, `${JSON.stringify(packageManifest, null, 2)}\n`)

    const result = runVerifier(fixture)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("verify:release-rights")
  })
})
