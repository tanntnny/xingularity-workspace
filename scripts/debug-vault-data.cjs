const { readFileSync, readdirSync } = require('node:fs')
const path = require('node:path')

const vaultRoot = process.argv[2]
if (!vaultRoot) {
  console.error('Usage: node scripts/debug-vault-data.cjs <vault-root>')
  process.exit(1)
}

const appDir = path.join(vaultRoot, '.xingularity')
console.log('Inspecting', appDir)
for (const file of readdirSync(appDir)) {
  const fullPath = path.join(appDir, file)
  console.log('---', file)
  try {
    const parsed = JSON.parse(readFileSync(fullPath, 'utf-8'))
    console.dir(parsed, { depth: 1 })
  } catch (error) {
    console.error('Failed to parse', file, error)
  }
}
