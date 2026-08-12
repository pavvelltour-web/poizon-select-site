import { spawnSync } from "node:child_process"

const requestedArgs = process.argv.slice(2)
if (requestedArgs.length === 0) {
  console.error("Usage: node scripts/run_official_media_pipeline.mjs <command|test> [options]")
  process.exit(2)
}

const runTests = requestedArgs[0] === "test"
const script = runTests
  ? "scripts/test_official_media_pipeline.py"
  : "scripts/official_media_pipeline.py"
const scriptArgs = runTests ? requestedArgs.slice(1) : requestedArgs
const candidates = [
  { command: "uv", args: ["run", "--isolated", "--frozen", "python", "-B", script] },
  { command: "py", args: ["-3", "-B", script] },
  { command: "python", args: ["-B", script] },
  { command: "python3", args: ["-B", script] },
]

for (const candidate of candidates) {
  const result = spawnSync(candidate.command, [...candidate.args, ...scriptArgs], {
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    shell: false,
    stdio: "inherit",
  })
  if (result.error?.code === "ENOENT") continue
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

console.error("No Python runner found. Install uv or Python 3.")
process.exit(1)
