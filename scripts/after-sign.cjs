const { execFile } = require('node:child_process')
const fs = require('node:fs/promises')
const { promisify } = require('node:util')
const path = require('node:path')

const execFileAsync = promisify(execFile)

async function detectExistingIdentity(appPath) {
  try {
    const { stderr } = await execFileAsync('codesign', ['-dv', appPath])
    const identityLine = stderr
      .split('\n')
      .find((line) => line.startsWith('Authority=Developer ID Application'))
    return identityLine ? identityLine.replace('Authority=', '').trim() : null
  } catch (error) {
    return null
  }
}

async function resolveAppBundlePath(context) {
  const productFilename = context.packager?.appInfo?.productFilename
  if (productFilename) {
    return path.join(context.appOutDir, `${productFilename}.app`)
  }

  const entries = await fs.readdir(context.appOutDir)
  const appDir = entries.find((entry) => entry.endsWith('.app'))
  if (!appDir) {
    throw new Error(`Unable to find a .app bundle in ${context.appOutDir}`)
  }

  return path.join(context.appOutDir, appDir)
}

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appPath = await resolveAppBundlePath(context)
  const projectDir =
    context.projectDir || context.packager?.projectDir || context.packager?.info?.projectDir || process.cwd()
  const entitlementsPath = path.join(projectDir, 'build', 'entitlements.mac.plist')

  const envIdentity =
    process.env.MAC_CODE_SIGN_IDENTITY || process.env.CSC_NAME || process.env.CSC_IDENTITY_NAME
  const detectedIdentity = envIdentity || (await detectExistingIdentity(appPath))
  const identity = detectedIdentity || '-'

  console.info(`  • macOS after-sign: re-signing ${appPath} with identity "${identity}"`)

  try {
    await execFileAsync('codesign', [
      '--force',
      '--deep',
      '--options',
      'runtime',
      '--entitlements',
      entitlementsPath,
      '--sign',
      identity,
      appPath,
    ])
    await execFileAsync('codesign', ['--verify', '--deep', '--strict', appPath])
  } catch (error) {
    console.error('  • macOS after-sign failed:', error?.stderr || error)
    throw error
  }
}
