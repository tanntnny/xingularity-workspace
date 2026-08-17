/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */

const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const sourceRoots = [
  path.join(rootDir, 'src'),
  path.join(rootDir, 'packages', 'workspace-template', 'src'),
  path.join(rootDir, 'packages', 'workspace-template', 'starter', 'src'),
  path.join(rootDir, 'tests')
]
const registryFiles = new Set([
  path.join(rootDir, 'src', 'renderer', 'src', 'components', 'ui', 'icons.tsx'),
  path.join(rootDir, 'packages', 'workspace-template', 'src', 'ui', 'icons.tsx')
])
const directTablerImportAllowlist = new Set([
  path.join(rootDir, 'src', 'renderer', 'src', 'lib', 'projectIconCatalog.ts')
])

const violations = []

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      visit(filePath)
      continue
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue
    }

    const source = fs.readFileSync(filePath, 'utf8')
    if (source.includes('lucide-react')) {
      violations.push(`${path.relative(rootDir, filePath)} still references lucide-react`)
    }

    if (
      !registryFiles.has(filePath) &&
      !directTablerImportAllowlist.has(filePath) &&
      source.includes("from '@tabler/icons-react'")
    ) {
      violations.push(
        `${path.relative(rootDir, filePath)} imports Tabler icons outside the registry`
      )
    }
  }
}

for (const sourceRoot of sourceRoots) {
  visit(sourceRoot)
}

if (violations.length > 0) {
  console.error('Icon-set verification failed:')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log('All app and template icons use the shared Tabler icon registries.')
