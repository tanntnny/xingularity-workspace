const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { downloadArtifact } = require('@electron/get')

function getElectronPaths() {
  const packageJsonPath = require.resolve('electron/package.json')
  const packageDirectory = path.dirname(packageJsonPath)
  const electronPackage = require(packageJsonPath)
  const pathFile = path.join(packageDirectory, 'path.txt')
  const relativeExecutablePath = fs.existsSync(pathFile)
    ? fs.readFileSync(pathFile, 'utf8').trim()
    : ''

  return {
    packageDirectory,
    electronPackage,
    executablePath: relativeExecutablePath
      ? path.join(packageDirectory, 'dist', relativeExecutablePath)
      : null
  }
}

function getPlatformPath(platform) {
  if (platform === 'darwin' || platform === 'mas') {
    return 'Electron.app/Contents/MacOS/Electron'
  }

  if (platform === 'win32') {
    return 'electron.exe'
  }

  if (platform === 'linux' || platform === 'freebsd' || platform === 'openbsd') {
    return 'electron'
  }

  throw new Error(`Electron builds are not available on platform: ${platform}`)
}

function hasElectronRuntime() {
  const { executablePath } = getElectronPaths()
  return executablePath !== null && fs.existsSync(executablePath)
}

function extractArchive(archivePath, destinationPath, platform) {
  const command =
    platform === 'darwin'
      ? {
          file: 'ditto',
          args: ['-x', '-k', archivePath, destinationPath]
        }
      : platform === 'win32'
        ? {
            file: 'powershell.exe',
            args: [
              '-NoProfile',
              '-NonInteractive',
              '-Command',
              `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`
            ]
          }
        : {
            file: 'unzip',
            args: ['-q', archivePath, '-d', destinationPath]
          }
  const result = spawnSync(command.file, command.args, { stdio: 'inherit' })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command.file} exited with code ${result.status ?? 'unknown'}`)
  }
}

async function installElectronRuntime() {
  const { packageDirectory, electronPackage } = getElectronPaths()
  const platform = process.env.npm_config_platform || process.platform
  const arch = process.env.npm_config_arch || process.arch
  const distPath = path.join(packageDirectory, 'dist')
  console.warn('Electron runtime is incomplete. Restoring the native Electron binary…')

  await fs.promises.rm(distPath, { recursive: true, force: true })
  await fs.promises.mkdir(distPath, { recursive: true })

  const archivePath = await downloadArtifact({
    version: electronPackage.version,
    artifactName: 'electron',
    platform,
    arch,
    force: process.env.force_no_cache === 'true',
    cacheRoot: process.env.electron_config_cache,
    checksums: require(path.join(packageDirectory, 'checksums.json'))
  })

  extractArchive(archivePath, distPath, platform)

  const bundledTypes = path.join(distPath, 'electron.d.ts')
  if (fs.existsSync(bundledTypes)) {
    await fs.promises.rename(bundledTypes, path.join(packageDirectory, 'electron.d.ts'))
  }

  await fs.promises.writeFile(path.join(packageDirectory, 'path.txt'), getPlatformPath(platform))
}

async function main() {
  if (!hasElectronRuntime()) {
    await installElectronRuntime()
  }

  if (!hasElectronRuntime()) {
    throw new Error('Electron installer completed without creating its native executable')
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error)
  console.error(`Unable to prepare Electron: ${detail}`)
  console.error('Check your network or proxy settings, then run: npm rebuild electron')
  process.exitCode = 1
})
