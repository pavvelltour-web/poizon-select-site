import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { catalogProducts } from "../src/catalog/catalog"

const repoRoot = resolve(import.meta.dirname, "..")

interface QueueItem {
  slug: string
  priority: number
  replacement_required: boolean
  quality_issue: string
  research_queries: string[]
  requested_views: string[]
}

interface Queue {
  schema_version: number
  model_policy: string
  items: QueueItem[]
}

interface PromptExport {
  schema_version: number
  product_count: number
  prompt_count: number
  products: {
    slug: string
    angle_set: string[]
    prompts: string[]
  }[]
  prompts: {
    product_slug: string
    view: string
    clean_parse_required: boolean
    public_output_file: string | null
    prompt: string
  }[]
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8")) as T
}

describe("product media regeneration pipeline", () => {
  const queue = readJson<Queue>("catalog-media/regeneration-queue.json")
  const promptExport = readJson<PromptExport>(
    "catalog-media/product-image-regeneration-prompts.json",
  )
  const catalogSlugs = new Set(catalogProducts.map((product) => product.slug))

  it("queues weak product assets that exist in the catalog", () => {
    expect(queue.schema_version).toBe(1)
    expect(queue.model_policy).toBe("gpt-image-2-or-newer")
    expect(queue.items.length).toBeGreaterThanOrEqual(20)
    expect(queue.items.filter((item) => item.priority === 1).length).toBeGreaterThanOrEqual(15)

    for (const item of queue.items) {
      expect(catalogSlugs.has(item.slug), item.slug).toBe(true)
      expect(item.replacement_required).toBe(true)
      expect(item.quality_issue.length).toBeGreaterThan(24)
      expect(item.research_queries.length).toBeGreaterThan(0)
      expect(item.requested_views.length).toBeGreaterThanOrEqual(4)
      expect(item.requested_views.length).toBeLessThanOrEqual(7)
      expect(new Set(item.requested_views).size).toBe(item.requested_views.length)
    }
  })

  it("exports GPT Image 2+ prompts from the committed queue", () => {
    const requestedViewCount = queue.items.reduce(
      (total, item) => total + item.requested_views.length,
      0,
    )
    expect(promptExport.schema_version).toBe(2)
    expect(promptExport.product_count).toBe(queue.items.length)
    expect(promptExport.prompt_count).toBe(requestedViewCount)
    expect(promptExport.prompts).toHaveLength(requestedViewCount)

    for (const item of queue.items) {
      const productPrompts = promptExport.prompts.filter(
        (prompt) => prompt.product_slug === item.slug,
      )
      expect(productPrompts.map((prompt) => prompt.view)).toEqual(item.requested_views)
      expect(productPrompts[0]?.public_output_file).toBe(`public/catalog/${item.slug}.webp`)
      expect(productPrompts[5]?.public_output_file).toBeNull()
    }
  })

  it("keeps every generated prompt strict enough for commerce packshots", () => {
    for (const prompt of promptExport.prompts) {
      expect(prompt.clean_parse_required).toBe(true)
      expect(prompt.prompt).toContain("clean-parse")
      expect(prompt.prompt).toContain("pure white studio background")
      expect(prompt.prompt).toContain("realistic studio product photograph")
      expect(prompt.prompt).toContain("not vector art")
      expect(prompt.prompt).toContain("not illustration")
      expect(prompt.prompt).toContain("one product only")
      expect(prompt.prompt).toContain("no watermark")
      expect(prompt.prompt).toContain("Verification after generation")
    }
  })
})
