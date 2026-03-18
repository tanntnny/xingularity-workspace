const { execFile } = require('node:child_process')
const fs = require('node:fs/promises')
const { promisify } = require('node:util')
const path = require('node:path')

const execFileAsync = promisify(execFile)

async function signTarget(targetPath, identity, { entitlements, deep } = {}) {
  const args = ['--force', '--options', 'runtime']

  if (deep) {
    args.push('--deep')
  }

  if (entitlements) {
    args.push('--entitlements', entitlements)
  }

  args.push('--sign', identity, targetPath)

  await execFileAsync('codesign', args)
}

async function listChildren(baseDir, matcher) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    return entries
      .filter((entry) => matcher(entry))
      .map((entry) => path.join(baseDir, entry.name))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function detectExistingIdentity(appPath) {
  try {
    const { stderr } = await execFileAsync('codesign', ['-dv', appPath])
    const identityLine = stderr
      .split('\n')
      .find((line) => line.startsWith('Authority='))
    return identityLine ? identityLine.replace('Authority=', '').trim() : null
  } catch (error) {
    return null
  }
}

async function getTeamIdentifier(targetPath) {
  try {
    const { stderr } = await execFileAsync('codesign', ['-dv', targetPath])
    const teamLine = stderr
      .split('\n')
      .find((line) => line.startsWith('TeamIdentifier='))
    if (!teamLine) {
      return null
    }

    const teamValue = teamLine.replace('TeamIdentifier=', '').trim()
    return teamValue && teamValue !== 'not set' ? teamValue : null
  } catch (error) {
    return null
  }
}

async function resolveFrameworkBinary(frameworkPath) {
  const frameworkName = path.basename(frameworkPath, '.framework')
  const defaultBinaryPath = path.join(frameworkPath, frameworkName)

  try {
    return await fs.realpath(defaultBinaryPath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return defaultBinaryPath
    }
    throw error
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

async function verifyTeamIdentifiers(appPath, childPaths) {
  const expectedTeamId = await getTeamIdentifier(appPath)
  if (!expectedTeamId) {
    return
  }

  for (const childPath of childPaths) {
    const teamIdentifier = await getTeamIdentifier(childPath)
    if (teamIdentifier && teamIdentifier !== expectedTeamId) {
      throw new Error(
        `TeamIdentifier mismatch for ${childPath}. Expected ${expectedTeamId}, received ${teamIdentifier}.`
      )
    }
  }
}

async function afterSign(context) {
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

  if (!envIdentity && !detectedIdentity) {
    console.warn('  • macOS after-sign: no signing identity detected, defaulting to ad-hoc "-"')
  }

  console.info(`  • macOS after-sign: re-signing ${appPath} with identity "${identity}"`)

  const frameworksDir = path.join(appPath, 'Contents', 'Frameworks')
  const frameworks = await listChildren(frameworksDir, (entry) => entry.isDirectory() && entry.name.endsWith('.framework'))
  const helperApps = await listChildren(frameworksDir, (entry) => entry.isDirectory() && entry.name.endsWith('.app'))

  try {
    for (const frameworkPath of frameworks) {
      console.info(`    • signing framework ${path.basename(frameworkPath)}`)
      const frameworkBinary = await resolveFrameworkBinary(frameworkPath)
      await signTarget(frameworkBinary, identity, { deep: true })
      await signTarget(frameworkPath, identity, { deep: true })
    }

    for (const helperAppPath of helperApps) {
      console.info(`    • signing helper ${path.basename(helperAppPath)}`)
      await signTarget(helperAppPath, identity, { entitlements: entitlementsPath, deep: true })
    }

    await signTarget(appPath, identity, { entitlements: entitlementsPath, deep: true })
    await execFileAsync('codesign', ['--verify', '--deep', '--strict', appPath])
    await verifyTeamIdentifiers(appPath, [...frameworks, ...helperApps])
  } catch (error) {
    console.error('  • macOS after-sign failed:', error?.stderr || error)
    throw error
  }
}

exports.default = afterSign
module.exports = afterSign
