import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { readNormalizedWebpDimensions } from "./catalog_webp.mjs"
import { verifyCatalogBundleUrls } from "./catalog_bundle_urls.mjs"
import { formatSupplierMediaReport, REQUIRED_ANGLES, verifySupplierCatalogMedia } from "./verify_supplier_catalog_media.mjs"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
const timestamp = "2026-09-08T12:00:00Z"
const slug = "test-supplier-trainer"
// Use real, distinct normalized WebPs. These fixtures prove integrity checks,
// not the invented fixture product identity or visual-review statements.
const samples = await Promise.all([
  "public/catalog/adidas-campus-00s-core-black.webp",
  ...[2, 3, 4, 5].map((position) => `public/catalog/gallery/adidas-campus-00s-core-black-${position}.webp`),
].map((file) => readFile(path.join(projectRoot, file))))

async function fixture() {
  const temporaryParent = path.resolve(os.tmpdir())
  const root = await mkdtemp(path.join(temporaryParent, "supplier-media-test-"))
  const frames = []
  await mkdir(path.join(root, "catalog-media/intake/test"), { recursive: true })
  await mkdir(path.join(root, "public/catalog/supplier"), { recursive: true })
  for (const [index, sample] of samples.entries()) {
    const position = index + 1
    const file = `/catalog/supplier/${slug}-${position}.webp`
    const source = `catalog-media/intake/test/source-${position}.webp`
    await writeFile(path.join(root, `public${file}`), sample)
    await writeFile(path.join(root, source), sample)
    frames.push({
      position, file, angle: REQUIRED_ANGLES[index], output_sha256: digest(sample), output_bytes: sample.length, output_dimensions: [1600, 1200],
      provenance: { kind: "supplier-normalized", official_product_photo: false, source_url: `https://cdn.poizon.com/test-${position}.webp`, source_download_path: source, source_sha256: digest(sample) },
      visual_review: { status: "approved", output_sha256: digest(sample), reviewed_at: timestamp, evidence: "Isolated test fixture review record; not product approval." },
    })
  }
  const product = { slug, product_ref: digest(slug), frames, missing_angles: [] }
  const manifest = {
    schema_version: 1, generated_at: timestamp,
    standard: { dimensions: [1600, 1200], background_rgb: [242, 243, 243], safe_margin_ratio: 0.08, required_angles: REQUIRED_ANGLES },
    expected_product_slugs: [slug], products: [product],
  }
  return {
    root, manifest, product, frames,
    async save() { await writeFile(path.join(root, "catalog-media/supplier-catalog-media.json"), JSON.stringify(manifest)) },
    async verify(options = {}) { await this.save(); return verifySupplierCatalogMedia({ projectRoot: root, ...options }) },
    async dispose() {
      // Check the absolute target before recursive cleanup on Windows.
      assert.equal(path.dirname(path.resolve(root)), temporaryParent)
      assert.ok(path.basename(root).startsWith("supplier-media-test-"))
      await rm(root, { recursive: true, force: true })
    },
  }
}

async function withFixture(run) {
  const state = await fixture()
  try { await run(state) } finally { await state.dispose() }
}

test("accepts complete dynamic supplier inventory and reports honest integrity scope", () => withFixture(async (state) => {
  const report = await state.verify({ requireComplete: true })
  assert.equal(report.product_count, 1)
  assert.equal(report.frame_count, 5)
  assert.equal(report.approved_frame_count, 5)
  assert.equal(report.standardized, true)
  assert.equal(report.provenance_counts["supplier-normalized"], 5)
  assert.match(report.note, /does not independently prove/u)
  assert.match(formatSupplierMediaReport(report), /1\/1 complete five-angle sets/u)
}))

test("reports incomplete supplier angles without misrepresenting standardization", () => withFixture(async (state) => {
  const removed = state.frames.pop()
  await rm(path.join(state.root, `public${removed.file}`))
  state.product.missing_angles = ["outsole"]
  state.frames[0].visual_review = { status: "pending" }
  const report = await state.verify()
  assert.equal(report.standardized, false)
  assert.equal(report.complete_product_count, 0)
  assert.deepEqual(report.incomplete[0].missing_angles, ["outsole"])
  assert.deepEqual(report.incomplete[0].pending_review_positions, [1])
  assert.match(formatSupplierMediaReport(report), /STANDARDIZATION INCOMPLETE/u)
  await assert.rejects(state.verify({ requireComplete: true }), /standardization incomplete/u)
}))

test("accepts an explicitly inventoried product with no accepted frames only in non-strict mode", () => withFixture(async (state) => {
  for (const frame of state.frames) await rm(path.join(state.root, `public${frame.file}`))
  state.product.frames = []
  state.product.missing_angles = REQUIRED_ANGLES
  const report = await state.verify()
  assert.equal(report.frame_count, 0)
  assert.equal(report.standardized, false)
  await assert.rejects(state.verify({ requireComplete: true }), /standardization incomplete/u)
}))

test("treats unknown angles and wrong canonical order as incomplete", () => withFixture(async (state) => {
  state.frames[0].angle = "unknown"
  state.product.missing_angles = ["lateral"]
  assert.equal((await state.verify()).incomplete[0].order_mismatch, true)
  state.frames[0].angle = "medial"
  state.frames[1].angle = "lateral"
  state.product.missing_angles = []
  assert.equal((await state.verify()).standardized, false)
  await assert.rejects(state.verify({ requireComplete: true }), /standardization incomplete/u)
}))

for (const mismatch of ["slug", "position"]) {
  test(`rejects a wrong output ${mismatch} even when every file, hash and visual approval is consistent`, () => withFixture(async (state) => {
    for (const frame of state.frames) await rm(path.join(state.root, `public${frame.file}`))
    for (const [index, frame] of state.frames.entries()) {
      frame.file = mismatch === "slug"
        ? `/catalog/supplier/another-product-${frame.position}.webp`
        : `/catalog/supplier/${slug}-${frame.position % 5 + 1}.webp`
      await writeFile(path.join(state.root, `public${frame.file}`), samples[index])
    }
    await assert.rejects(state.verify({ requireComplete: true }), /exact product slug and frame position/u)
  }))
}

const rejectedMutations = [
  ["a missing expected product", (s) => { s.manifest.expected_product_slugs.push("missing-product") }, /exactly cover/u],
  ["a duplicated inventory slug", (s) => { s.manifest.expected_product_slugs.push(slug) }, /unique supplier-footwear inventory/u],
  ["an impossible UTC date", (s) => { s.manifest.generated_at = "2026-02-30T12:00:00Z" }, /real UTC date/u],
  ["a changed canvas standard", (s) => { s.manifest.standard.dimensions = [1200, 900] }, /LeBron/u],
  ["an incorrect frame position", (s) => { s.frames[1].position = 3 }, /consecutive/u],
  ["a repeated canonical angle", (s) => { s.frames[1].angle = "lateral" }, /repeats a canonical angle/u],
  ["a missing frame angle", (s) => { delete s.frames[0].angle }, /unsupported angle/u],
  ["a dishonest missing-angle declaration", (s) => { s.product.missing_angles = ["rear"] }, /truthfully list/u],
  ["a stale output hash", (s) => { s.frames[0].output_sha256 = "a".repeat(64) }, /output hash or byte size mismatch/u],
  ["a stale output size", (s) => { s.frames[0].output_bytes += 1 }, /output hash or byte size mismatch/u],
  ["a false dimension declaration", (s) => { s.frames[0].output_dimensions = [1200, 900] }, /normalized 1600/u],
  ["an unknown provenance kind", (s) => { s.frames[0].provenance.kind = "verified" }, /provenance kind/u],
  ["an official-photo claim from a supplier CDN", (s) => { s.frames[0].provenance.official_product_photo = true }, /not proof of official/u],
  ["a license claim from supplier discovery", (s) => { s.frames[0].provenance.rights = { status: "licensed" } }, /must not claim verified reuse rights/u],
  ["generated pixels classified as supplier photography", (s) => { s.frames[0].provenance.generator = "built-in image_gen" }, /must use generated-reference/u],
  ["a stale downloaded-source hash", (s) => { s.frames[0].provenance.source_sha256 = "a".repeat(64) }, /downloaded source hash mismatch/u],
  ["source path traversal", (s) => { s.frames[0].provenance.source_download_path = "catalog-media/intake/../../secret" }, /safe project-relative/u],
  ["an output traversal path", (s) => { s.frames[0].file = "/catalog/supplier/../../../secret.webp" }, /exact product slug and frame position/u],
  ["a source URL with credentials", (s) => { s.frames[0].provenance.source_url = "https://user:password@cdn.poizon.com/photo.jpg" }, /without credentials/u],
  ["a stale visual approval", (s) => { s.frames[0].visual_review.output_sha256 = "a".repeat(64) }, /visual approval is stale/u],
  ["a visual approval without evidence", (s) => { delete s.frames[0].visual_review.evidence }, /evidence must be nonempty/u],
  ["a silently missing visual review", (s) => { delete s.frames[0].visual_review }, /explicitly record visual review/u],
]

for (const [description, mutate, pattern] of rejectedMutations) {
  test(`rejects ${description}`, () => withFixture(async (state) => {
    mutate(state)
    await assert.rejects(state.verify(), pattern)
  }))
}

test("rejects extra public files and missing declared assets", () => withFixture(async (state) => {
  const extra = path.join(state.root, "public/catalog/supplier/untracked.webp")
  await writeFile(extra, samples[0])
  await assert.rejects(state.verify(), /exactly match all files/u)
  await rm(extra)
  await rm(path.join(state.root, `public${state.frames[0].file}`))
  await assert.rejects(state.verify(), /is missing/u)
}))

test("rejects an identical image occupying another active frame", () => withFixture(async (state) => {
  const original = state.frames[0]
  const duplicate = state.frames[1]
  await writeFile(path.join(state.root, `public${duplicate.file}`), samples[0])
  duplicate.output_sha256 = original.output_sha256
  duplicate.output_bytes = original.output_bytes
  await assert.rejects(state.verify(), /duplicates another active image/u)
}))

test("verifies official source evidence without upgrading a supplier URL automatically", () => withFixture(async (state) => {
  const source = state.frames[0].provenance
  source.kind = "official-original"
  source.official_product_photo = true
  source.source_provider = "Test manufacturer official product gallery"
  source.product_url = "https://www.nike.com/test-product"
  await assert.rejects(state.verify(), /explicit reuse evidence/u)
  source.rights = { status: "owner-authorized", evidence: "Test-only fixture authorization record" }
  assert.equal((await state.verify()).provenance_counts["official-original"], 1)
}))

test("binds generated references to the actual generator, prompt and exact downloaded references", () => withFixture(async (state) => {
  const reference = state.frames[0].provenance
  const prompt = "Use the exact test model and colour.\nPreserve its logos.\n"
  const generated = {
    kind: "generated-reference", official_product_photo: false, generator: "built-in image_gen", generated_at: timestamp,
    prompt_path: "catalog-media/test-prompt.txt", prompt_sha256: digest(prompt), references: [reference],
  }
  state.frames[0].provenance = generated
  await writeFile(path.join(state.root, generated.prompt_path), prompt.replaceAll("\n", "\r\n"))
  assert.equal((await state.verify()).provenance_counts["generated-reference"], 1)
  generated.official_product_photo = true
  await assert.rejects(state.verify(), /must not claim official photography/u)
  generated.official_product_photo = false
  generated.references = []
  await assert.rejects(state.verify(), /exact model\/colour reference/u)
  generated.references = [reference]
  await writeFile(path.join(state.root, generated.prompt_path), "Changed prompt")
  await assert.rejects(state.verify(), /generation prompt hash mismatch/u)
}))

test("independently compares supplier-footwear coverage and identity with a catalog snapshot", () => withFixture(async (state) => {
  const metadata = [{ slug, kind: "footwear", product_ref: state.product.product_ref, images: state.frames.map((frame) => frame.provenance.source_url) }, { slug: "unrelated-apparel", kind: "apparel" }]
  const catalogMetadataPath = path.join(state.root, "metadata.json")
  await writeFile(catalogMetadataPath, JSON.stringify(metadata))
  await state.verify({ catalogMetadataPath })
  metadata[0].product_ref = "a".repeat(64)
  await writeFile(catalogMetadataPath, JSON.stringify(metadata))
  await assert.rejects(state.verify({ catalogMetadataPath }), /product_ref differs/u)
  metadata.push({ slug: "missing-new-colourway", kind: "footwear", product_ref: "b".repeat(64) })
  await writeFile(catalogMetadataPath, JSON.stringify(metadata))
  await assert.rejects(state.verify({ catalogMetadataPath }), /independent supplier footwear metadata/u)
}))

test("rejects a supplier source URL borrowed from another model or colourway", () => withFixture(async (state) => {
  const metadata = [{ slug, kind: "footwear", product_ref: state.product.product_ref, images: state.frames.map((frame) => frame.provenance.source_url) }]
  const catalogMetadataPath = path.join(state.root, "metadata.json")
  await writeFile(catalogMetadataPath, JSON.stringify(metadata))
  state.frames[0].provenance.source_url = "https://cdn.poizon.com/another-colourway.webp"
  await assert.rejects(state.verify({ catalogMetadataPath }), /not among this exact product's metadata images/u)
}))

test("permits separately documented official and generated references outside supplier row images", () => withFixture(async (state) => {
  const metadata = [{ slug, kind: "footwear", product_ref: state.product.product_ref, images: state.frames.slice(2).map((frame) => frame.provenance.source_url) }]
  const catalogMetadataPath = path.join(state.root, "metadata.json")
  await writeFile(catalogMetadataPath, JSON.stringify(metadata))
  const official = state.frames[0].provenance
  official.kind = "official-original"
  official.official_product_photo = true
  official.source_provider = "Test official manufacturer"
  official.source_url = "https://static.nike.com/official-test-reference.webp"
  official.product_url = "https://www.nike.com/test-product"
  official.rights = { status: "owner-authorized", evidence: "Isolated test authorization" }
  const source = state.frames[1].provenance
  source.source_url = "https://static.nike.com/another-official-reference.webp"
  const prompt = "Exact model and colour test reference"
  state.frames[1].provenance = {
    kind: "generated-reference", official_product_photo: false, generator: "built-in image_gen", generated_at: timestamp,
    prompt_path: "catalog-media/test-prompt.txt", prompt_sha256: digest(prompt), references: [source],
  }
  await writeFile(path.join(state.root, "catalog-media/test-prompt.txt"), prompt)
  assert.equal((await state.verify({ catalogMetadataPath, requireComplete: true })).standardized, true)
}))

test("structural WebP parser rejects corruption and appended metadata", () => {
  const original = samples[0]
  assert.deepEqual(readNormalizedWebpDimensions(original), [1600, 1200])
  const wrongLength = Buffer.from(original)
  wrongLength.writeUInt32LE(0, 4)
  assert.throws(() => readNormalizedWebpDimensions(wrongLength), /RIFF length/u)
  const metadata = Buffer.from("EXIF\0\0\0\0", "binary")
  const extended = Buffer.concat([original, metadata])
  extended.writeUInt32LE(extended.length - 8, 4)
  assert.throws(() => readNormalizedWebpDimensions(extended), /only one VP8\/VP8L/u)
  assert.throws(() => readNormalizedWebpDimensions(Buffer.from("not a WebP")), /not a RIFF/u)
})

test("permits only the bare supplier validation prefix in quoted or template bundle literals", () => {
  const empty = { products: [{ slug, frames: [] }] }
  for (const quote of ['"', "'", "`"]) {
    assert.deepEqual(verifyCatalogBundleUrls(`const prefix=${quote}/catalog/supplier/${quote};`, empty, []), [])
  }
  assert.deepEqual(verifyCatalogBundleUrls('const image="catalog/legacy.webp";', empty, []), [])
})

test("permits exact declared supplier frame literals only when those files exist in dist", () => {
  const frames = [1, 2, 3, 4, 5].map((position) => ({ position, file: `/catalog/supplier/${slug}-${position}.webp` }))
  const manifest = { products: [{ slug, frames }] }
  const files = frames.map((frame) => frame.file)
  for (const quote of ['"', "'", "`"]) {
    const bundle = files.map((file) => `${quote}${file}${quote}`).join(",")
    assert.deepEqual(verifyCatalogBundleUrls(bundle, manifest, files), files)
    assert.throws(() => verifyCatalogBundleUrls(bundle, manifest, files.slice(0, 4)), /missing supplier catalog file/u)
  }
  // Unreferenced manifest entries do not become invented bundle requirements.
  assert.deepEqual(verifyCatalogBundleUrls('"/catalog/supplier/"', manifest, []), [])
})

test("keeps legacy and undeclared root catalog URLs prohibited despite the supplier exception", () => {
  const file = `/catalog/supplier/${slug}-1.webp`
  const manifest = { products: [{ slug, frames: [{ position: 1, file }] }] }
  for (const reference of [
    "/catalog/legacy.webp", "/catalog/gallery/legacy-2.webp", "/catalog/thumbs/legacy-1.webp", "/catalog/",
    "/catalog/supplier", "/catalog/supplier/undeclared-1.webp", `/catalog/supplier/${slug}-2.webp`,
    `/catalog/supplier/${slug}-0.webp`, `/catalog/supplier/${slug}-6.webp`,
    "/catalog/supplier/../legacy.webp", "/catalog/supplier/%2e%2e/legacy.webp",
    `${file}?v=1`, `${file}#frame`, '/catalog/supplier/${product.slug}-${position}.webp',
  ]) {
    for (const quote of ['"', "'", "`"]) {
      assert.throws(() => verifyCatalogBundleUrls(`${quote}${reference}${quote}`, manifest, [file, reference]), /root-absolute catalog URL/u)
    }
  }
  assert.throws(() => verifyCatalogBundleUrls('"/catalog/supplier/', manifest, []), /root-absolute catalog URL/u)
  assert.throws(() => verifyCatalogBundleUrls('"/catalog/supplier/", "/catalog/legacy.webp"', manifest, []), /root-absolute catalog URL/u)
})

test("does not trust a manifest declaration with another slug, frame number or traversal path", () => {
  for (const product of [
    { slug, frames: [{ position: 1, file: "/catalog/supplier/another-slug-1.webp" }] },
    { slug, frames: [{ position: 1, file: `/catalog/supplier/${slug}-2.webp` }] },
    { slug, frames: [{ position: 6, file: `/catalog/supplier/${slug}-6.webp` }] },
    { slug: "../legacy", frames: [{ position: 1, file: "/catalog/supplier/../legacy-1.webp" }] },
  ]) {
    const file = product.frames[0].file
    assert.throws(() => verifyCatalogBundleUrls(JSON.stringify(file), { products: [product] }, [file]), /exact product slug/u)
  }
})
