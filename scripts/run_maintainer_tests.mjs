import { spawnSync } from "node:child_process"

const pythonArgs = [
  "-B",
  "-m",
  "unittest",
  "discover",
  "-s",
  "scripts",
  "-p",
  "test_*.py",
]

const candidates = [
  { command: "uv", args: ["run", "--isolated", "--frozen", "python", ...pythonArgs] },
  { command: "py", args: ["-3", ...pythonArgs] },
  { command: "python", args: pythonArgs },
  { command: "python3", args: pythonArgs },
]

for (const candidate of candidates) {
  const result = spawnSync(candidate.command, candidate.args, {
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

console.error("No Python runner found. Install uv or Python 3 to run maintainer tests.")
process.exit(1)
