import { constants as fsConstants } from 'node:fs'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import type {
  CondaEnvironment,
  CondaEnvironmentListResult,
  CondaExecutablePickerResult
} from '../shared/types'

const CONDA_COMMAND_TIMEOUT_MS = 10_000

interface CondaEnvironmentListResponse {
  envs?: unknown
}

export interface CondaResolverOptions {
  configuredPath?: string | null
  env?: NodeJS.ProcessEnv
  homePath?: string
  platform?: NodeJS.Platform
}

export class CondaResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CondaResolutionError'
  }
}

function getCondaCommandName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'conda.exe' : 'conda'
}

function getPathModule(platform: NodeJS.Platform): typeof path.posix | typeof path.win32 {
  return platform === 'win32' ? path.win32 : path.posix
}

function getPathDelimiter(platform: NodeJS.Platform): string {
  return platform === 'win32' ? ';' : ':'
}

function getHomePath(options: CondaResolverOptions): string {
  const env = options.env ?? process.env
  return options.homePath ?? env.HOME ?? env.USERPROFILE ?? os.homedir()
}

function isCommandName(candidate: string, commandName: string): boolean {
  return candidate === commandName || candidate === commandName.replace(/\.exe$/, '')
}

function pushCandidate(candidates: string[], candidate: string | null | undefined): void {
  const normalized = candidate?.trim()
  if (normalized && !candidates.includes(normalized)) {
    candidates.push(normalized)
  }
}

export function getCondaExecutableCandidates(options: CondaResolverOptions = {}): string[] {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const pathModule = getPathModule(platform)
  const commandName = getCondaCommandName(platform)
  const candidates: string[] = []

  pushCandidate(candidates, options.configuredPath)
  pushCandidate(candidates, env.CONDA_EXE)

  for (const pathEntry of (env.PATH ?? '').split(getPathDelimiter(platform))) {
    if (pathEntry.trim()) {
      pushCandidate(candidates, pathModule.join(pathEntry.trim(), commandName))
    }
  }

  const home = getHomePath(options)
  if (platform === 'win32') {
    const roots = [home, env.LOCALAPPDATA, env.ProgramData].filter((value): value is string =>
      Boolean(value?.trim())
    )
    for (const root of roots) {
      for (const distribution of ['miniconda3', 'anaconda3', 'miniforge3', 'mambaforge']) {
        pushCandidate(candidates, pathModule.join(root, distribution, 'Scripts', commandName))
      }
    }
  } else if (platform === 'darwin') {
    for (const distribution of ['miniconda3', 'anaconda3', 'miniforge3', 'mambaforge']) {
      pushCandidate(candidates, pathModule.join(home, distribution, 'bin', commandName))
      pushCandidate(candidates, pathModule.join(home, distribution, 'condabin', commandName))
    }

    for (const candidate of [
      '/opt/homebrew/bin/conda',
      '/opt/homebrew/Caskroom/miniforge/base/bin/conda',
      '/opt/homebrew/Caskroom/miniforge/base/condabin/conda',
      '/opt/homebrew/Caskroom/miniconda/base/bin/conda',
      '/opt/homebrew/Caskroom/mambaforge/base/bin/conda',
      '/usr/local/bin/conda',
      '/usr/local/Caskroom/miniforge/base/bin/conda',
      '/usr/local/Caskroom/miniconda/base/bin/conda',
      '/usr/local/Caskroom/mambaforge/base/bin/conda',
      '/opt/anaconda3/bin/conda',
      '/opt/miniconda3/bin/conda',
      '/opt/miniforge3/bin/conda'
    ]) {
      pushCandidate(candidates, candidate)
    }
  } else {
    for (const distribution of ['miniconda3', 'anaconda3', 'miniforge3', 'mambaforge']) {
      pushCandidate(candidates, pathModule.join(home, distribution, 'bin', commandName))
      pushCandidate(candidates, pathModule.join(home, distribution, 'condabin', commandName))
    }

    for (const candidate of ['/opt/conda/bin/conda', '/usr/local/conda/bin/conda']) {
      pushCandidate(candidates, candidate)
    }
  }

  return candidates
}

async function isUsableCondaExecutable(
  candidate: string,
  platform: NodeJS.Platform
): Promise<boolean> {
  try {
    const file = await fs.stat(candidate)
    if (!file.isFile()) {
      return false
    }

    await fs.access(candidate, platform === 'win32' ? fsConstants.F_OK : fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

export async function resolveCondaExecutable(options: CondaResolverOptions = {}): Promise<string> {
  const platform = options.platform ?? process.platform
  const configuredPath = options.configuredPath?.trim()

  if (configuredPath) {
    if (await isUsableCondaExecutable(configuredPath, platform)) {
      return configuredPath
    }

    throw new CondaResolutionError(
      `The configured Conda executable is unavailable: ${configuredPath}. Choose another executable or use automatic discovery.`
    )
  }

  for (const candidate of getCondaExecutableCandidates(options)) {
    if (isCommandName(candidate, getCondaCommandName(platform))) {
      continue
    }

    if (await isUsableCondaExecutable(candidate, platform)) {
      return candidate
    }
  }

  throw new CondaResolutionError(
    'Conda was not found in the app PATH or common installation locations. Install Conda or choose its executable. System Python remains available.'
  )
}

function runCondaCommand(executablePath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const child = spawn(executablePath, args, {
      env: process.env,
      shell: false,
      windowsHide: true
    })

    const timeout = setTimeout(() => {
      if (settled) {
        return
      }

      settled = true
      child.kill('SIGTERM')
      reject(new Error('Conda did not respond within 10 seconds.'))
    }, CONDA_COMMAND_TIMEOUT_MS)

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', (error) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      const code = (error as NodeJS.ErrnoException).code
      reject(
        code === 'ENOENT' ? new Error(`Conda could not be started from ${executablePath}.`) : error
      )
    })

    child.on('close', (code) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      if (code !== 0) {
        const detail = stderr.trim() || `Conda exited with code ${code ?? 'unknown'}.`
        reject(new Error(detail))
        return
      }

      resolve(stdout)
    })
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function validateCondaExecutable(
  executablePath: string
): Promise<CondaExecutablePickerResult> {
  const normalizedPath = executablePath.trim()
  if (!normalizedPath) {
    return { path: null, error: 'Choose a Conda executable.' }
  }

  try {
    const resolvedPath = await resolveCondaExecutable({ configuredPath: normalizedPath })
    await runCondaCommand(resolvedPath, ['--version'])
    return { path: resolvedPath, error: null }
  } catch (error) {
    return {
      path: null,
      error: `The selected file is not a usable Conda executable: ${getErrorMessage(error)}`
    }
  }
}

export function parseCondaEnvironments(stdout: string): CondaEnvironment[] {
  const jsonStart = stdout.indexOf('{')
  const jsonEnd = stdout.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error('Conda returned an invalid environment list.')
  }

  let parsed: CondaEnvironmentListResponse
  try {
    parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1)) as CondaEnvironmentListResponse
  } catch {
    throw new Error('Conda returned an invalid environment list.')
  }

  if (!Array.isArray(parsed.envs)) {
    throw new Error('Conda returned no environment paths.')
  }

  const paths = parsed.envs.filter((value): value is string => typeof value === 'string')
  const uniquePaths = Array.from(new Set(paths.map((value) => value.trim()).filter(Boolean)))

  return uniquePaths
    .map((environmentPath) => ({
      path: environmentPath,
      name: environmentPath.split(/[\\/]/).filter(Boolean).slice(-1)[0] ?? environmentPath
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function listCondaEnvironments(
  configuredPath?: string | null
): Promise<CondaEnvironmentListResult> {
  try {
    const executablePath = await resolveCondaExecutable({ configuredPath })
    const stdout = await runCondaCommand(executablePath, ['env', 'list', '--json'])
    return {
      environments: parseCondaEnvironments(stdout),
      executablePath,
      error: null
    }
  } catch (error) {
    return {
      environments: [],
      executablePath: null,
      error: `Could not list Conda environments: ${getErrorMessage(error)}`
    }
  }
}
