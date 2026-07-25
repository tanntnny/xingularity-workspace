const fs = require('node:fs')
const path = require('node:path')

const repositoryRoot = path.resolve(__dirname, '..')
const rendererRoot = path.join(repositoryRoot, 'src', 'renderer', 'src')
const packageRoot = path.join(repositoryRoot, 'packages', 'workspace-template')
const rendererUiRoot = path.join(rendererRoot, 'components', 'ui')
const packageUiRoot = path.join(packageRoot, 'src', 'ui')

function readNormalized(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .replaceAll("../../lib/utils", "../lib/utils")
    .replaceAll("../../lib/uiTone", "../lib/uiTone")
    .trimEnd()
}

const mismatches = []

for (const fileName of fs.readdirSync(rendererUiRoot)) {
  if (!fileName.endsWith('.ts') && !fileName.endsWith('.tsx')) {
    continue
  }

  const rendererFile = path.join(rendererUiRoot, fileName)
  const packageFile = path.join(packageUiRoot, fileName)

  if (!fs.existsSync(packageFile)) {
    mismatches.push(`missing package primitive: ${fileName}`)
    continue
  }

  if (readNormalized(rendererFile) !== readNormalized(packageFile)) {
    mismatches.push(`primitive differs: ${fileName}`)
  }
}

const rendererStyles = fs.readFileSync(path.join(rendererRoot, 'assets', 'main.css'), 'utf8').trimEnd()
const packageStyles = fs
  .readFileSync(path.join(packageRoot, 'styles', 'workspace.css'), 'utf8')
  .trimEnd()

if (rendererStyles !== packageStyles) {
  mismatches.push('stylesheet differs: styles/workspace.css')
}

const rendererUiTone = fs.readFileSync(path.join(rendererRoot, 'lib', 'uiTone.ts'), 'utf8').trimEnd()
const packageUiTone = fs.readFileSync(path.join(packageRoot, 'src', 'lib', 'uiTone.ts'), 'utf8').trimEnd()

if (rendererUiTone !== packageUiTone) {
  mismatches.push('shared tone helper differs: src/lib/uiTone.ts')
}

if (mismatches.length > 0) {
  console.error('Workspace template is no longer synchronized with the renderer source:')
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`)
  }
  process.exit(1)
}

console.log('Workspace template matches the renderer UI source.')
