const buildVersion = process.env.BUILD_VERSION?.trim() ?? ""

if (!/^[a-f0-9]{40}$/u.test(buildVersion)) {
  console.error(
    "Production build requires BUILD_VERSION to be the full lowercase 40-character Git SHA.",
  )
  process.exit(1)
}

console.log(`Production build version verified: ${buildVersion.slice(0, 12)}`)
