const fs = require('node:fs/promises')
const path = require('node:path')

const args = process.argv.slice(2)
const destinationIndex = args.indexOf('--destination')
const destination = destinationIndex >= 0 ? args[destinationIndex + 1] : process.env.CODEX_HOME

if (!destination) {
  console.error('Usage: npm run install:x-workspace-skill -- --destination <agent-skills-dir>')
  process.exitCode = 2
} else {
  const projectRoot = path.resolve(__dirname, '..')
  const source = path.join(projectRoot, '.agents', 'skills', 'x-workspace')
  const target = path.resolve(destination, 'x-workspace')
  fs.mkdir(target, { recursive: true })
    .then(() => fs.cp(source, target, { recursive: true }))
    .then(() => {
      console.log(`Installed x-workspace skill at ${target}`)
    })
    .catch((error) => {
      console.error(`Unable to install x-workspace skill: ${error.message}`)
      process.exitCode = 1
    })
}
