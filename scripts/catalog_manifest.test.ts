import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { catalogProducts } from "../src/catalog/catalog"

const repoRoot = resolve(import.meta.dirname, "..")

describe("catalog manifest integrity", () => {
  it("keeps manifest items, product slugs and disk WebP files in one-to-one sync", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(repoRoot, "public", "catalog", "sources.json"), "utf8"),
    ) as { items: { slug: string; file: string }[] }
    const fallbackFiles = catalogProducts
      .map((product) => product.fallbackImage.replace(/^catalog\//, ""))
      .sort()
    const manifestSlugs = manifest.items.map((item) => item.slug).sort()
    const diskFiles = readdirSync(resolve(repoRoot, "public", "catalog"))
      .filter((file) => file.endsWith(".webp"))
      .sort()
    const usedFiles = catalogProducts
      .map((product) => product.fallbackImage.replace(/^catalog\//, ""))
      .sort()

    expect(manifest.items).toHaveLength(100)
    expect(manifestSlugs).toEqual(
      fallbackFiles.map((file) => file.replace(/\.webp$/, "")).sort(),
    )
    expect(diskFiles).toHaveLength(100)
    expect(diskFiles).toEqual(usedFiles)
    expect(manifest.items.map((item) => item.file).sort()).toEqual(diskFiles)
  })
})
