const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const source = path.join(rootDir, 'assets', 'workspace_letter.png')
const targets = [
  path.join(rootDir, 'build', 'icon.png'),
  path.join(rootDir, 'resources', 'icon.png')
]

if (!fs.existsSync(source)) {
  throw new Error(`Missing source icon: ${source}`)
}

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
  console.log(`Synced icon: ${path.relative(rootDir, target)}`)
}
