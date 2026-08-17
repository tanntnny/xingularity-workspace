import { spawn } from 'node:child_process'
import vm from 'node:vm'
import type { ScheduleJob, ScriptAction } from '../shared/scheduleTypes'
import { resolveCondaExecutable } from './pythonEnvironmentService'
import { parseScriptActions } from './scheduleActionValidation'

export interface RunResult {
  stdout: string
  stderr: string
  actions: ScriptAction[]
  error?: string
}

export interface PythonRuntimeOptions {
  condaEnvironmentPath?: string | null
  condaExecutablePath?: string | null
}

export interface PythonSpawnCommand {
  command: string
  args: string[]
}

const SCRIPT_TIMEOUT_MS = 30_000
const MAX_OUTPUT_CHARS = 2_000_000

export async function runScript(
  job: ScheduleJob,
  secretEnv: Record<string, string> = {},
  options: PythonRuntimeOptions = {}
): Promise<RunResult> {
  if (job.runtime === 'javascript') {
    return runJavaScript(job, secretEnv)
  }
  if (job.runtime === 'python') {
    return runPython(job, secretEnv, options)
  }
  return { stdout: '', stderr: '', actions: [], error: `Unknown runtime: ${job.runtime}` }
}

// ── JavaScript runner ──────────────────────────────────────────────────────

async function runJavaScript(
  job: ScheduleJob,
  secretEnv: Record<string, string>
): Promise<RunResult> {
  let stdout = ''
  let stderr = ''
  const collectedActions: unknown[] = []
  let active = true
  let outputLimitExceeded = false

  const appendConsoleOutput = (current: string, next: string): string =>
    appendOutput(current, next, () => {
      outputLimitExceeded = true
    })

  const consoleApi = {
    log: (...args: unknown[]) => {
      stdout = appendConsoleOutput(stdout, args.map(String).join(' ') + '\n')
    },
    error: (...args: unknown[]) => {
      stderr = appendConsoleOutput(stderr, args.map(String).join(' ') + '\n')
    },
    warn: (...args: unknown[]) => {
      stderr = appendConsoleOutput(stderr, '[warn] ' + args.map(String).join(' ') + '\n')
    }
  }

  const beaconApi = {
    emit: (actionsOrAction: ScriptAction | ScriptAction[]) => {
      const list = Array.isArray(actionsOrAction) ? actionsOrAction : [actionsOrAction]
      if (active) {
        collectedActions.push(...list)
      }
    }
  }

  // Build sandbox — only expose what's safe
  const sandbox: Record<string, unknown> = {
    beacon: beaconApi,
    console: consoleApi,
    JSON,
    Math,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    Promise,
    setTimeout,
    clearTimeout,
    URL,
    AbortController,
    undefined,
    null: null
  }

  if (job.permissions.includes('useSecrets')) {
    sandbox['secrets'] = {
      get: (name: unknown): string | undefined =>
        typeof name === 'string' ? secretEnv[name] : undefined
    }
  }

  // Optionally expose fetch for network permission
  if (job.permissions.includes('network') && typeof fetch !== 'undefined') {
    sandbox['fetch'] = fetch
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  try {
    const execution = vm.runInNewContext(`(async () => {\n${job.code}\n})()`, sandbox, {
      timeout: SCRIPT_TIMEOUT_MS,
      filename: `schedule-${job.id}.js`,
      contextCodeGeneration: { strings: false, wasm: false }
    })
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`Script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s`)),
        SCRIPT_TIMEOUT_MS
      )
    })
    await Promise.race([execution, timeoutPromise])
    if (outputLimitExceeded) {
      return {
        stdout: redactOutput(stdout, secretEnv),
        stderr: redactOutput(stderr, secretEnv),
        actions: [],
        error: `Script output exceeded ${MAX_OUTPUT_CHARS} characters`
      }
    }
    const parsed = parseScriptActions(collectedActions)
    return {
      stdout: redactOutput(stdout, secretEnv),
      stderr: redactOutput(stderr, secretEnv),
      actions: parsed.actions,
      error: parsed.error
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      stdout: redactOutput(stdout, secretEnv),
      stderr: redactOutput(stderr, secretEnv),
      actions: [],
      error: message
    }
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
    active = false
  }
}

// ── Python runner ──────────────────────────────────────────────────────────

export function buildPythonSpawnCommand(
  condaEnvironmentPath: string | null,
  condaExecutablePath: string | null = null
): PythonSpawnCommand {
  const normalizedPath = condaEnvironmentPath?.trim() ?? ''
  if (!normalizedPath) {
    return {
      command: process.platform === 'win32' ? 'python' : 'python3',
      args: ['-c']
    }
  }

  return {
    command: condaExecutablePath?.trim() || (process.platform === 'win32' ? 'conda.exe' : 'conda'),
    args: ['run', '--no-capture-output', '--prefix', normalizedPath, 'python', '-c']
  }
}

async function runPython(
  job: ScheduleJob,
  secretEnv: Record<string, string>,
  options: PythonRuntimeOptions
): Promise<RunResult> {
  const condaEnvironmentPath = options.condaEnvironmentPath?.trim() || null
  const runtimeLabel = condaEnvironmentPath
    ? `the selected Conda environment (${condaEnvironmentPath})`
    : 'system Python'

  let spawnCommand: PythonSpawnCommand
  try {
    const condaExecutablePath = condaEnvironmentPath
      ? await resolveCondaExecutable({ configuredPath: options.condaExecutablePath })
      : null
    spawnCommand = buildPythonSpawnCommand(condaEnvironmentPath, condaExecutablePath)
  } catch (error) {
    return {
      stdout: '',
      stderr: '',
      actions: [],
      error: `Failed to start ${runtimeLabel}: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let outputLimitExceeded = false

    const child = spawn(spawnCommand.command, [...spawnCommand.args, job.code], {
      timeout: SCRIPT_TIMEOUT_MS,
      shell: false,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        TMP: process.env.TMP,
        TEMP: process.env.TEMP,
        LANG: process.env.LANG,
        LC_ALL: process.env.LC_ALL,
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONUNBUFFERED: '1',
        ...(condaEnvironmentPath ? { CONDA_EXE: spawnCommand.command } : {}),
        ...Object.fromEntries(
          job.permissions.includes('useSecrets')
            ? Object.entries(secretEnv).map(([name, value]) => [
                `XINGULARITY_SECRET_${normalizeSecretName(name)}`,
                value
              ])
            : []
        )
      }
    })

    child.stdout.on('data', (data: Buffer) => {
      stdout = appendOutput(stdout, data.toString(), () => {
        outputLimitExceeded = true
      })
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr = appendOutput(stderr, data.toString(), () => {
        outputLimitExceeded = true
      })
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, SCRIPT_TIMEOUT_MS)

    child.on('close', (code) => {
      clearTimeout(timer)

      if (timedOut) {
        resolve({
          stdout: redactOutput(stdout, secretEnv),
          stderr: redactOutput(stderr, secretEnv),
          actions: [],
          error: `Script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s`
        })
        return
      }

      if (outputLimitExceeded) {
        resolve({
          stdout: redactOutput(stdout, secretEnv),
          stderr: redactOutput(stderr, secretEnv),
          actions: [],
          error: `Script output exceeded ${MAX_OUTPUT_CHARS} characters`
        })
        return
      }

      // Parse JSON output from stdout
      const parsed = parseActionsFromStdout(stdout)

      if (code !== 0) {
        resolve({
          stdout: redactOutput(stdout, secretEnv),
          stderr: redactOutput(stderr, secretEnv),
          actions: parsed.actions,
          error: condaEnvironmentPath
            ? `Conda automation failed in ${runtimeLabel} with exit code ${code}. Verify the selected environment and Conda executable in Settings.`
            : `Script exited with code ${code}`
        })
        return
      }

      resolve({
        stdout: redactOutput(stdout, secretEnv),
        stderr: redactOutput(stderr, secretEnv),
        actions: parsed.actions,
        error: parsed.error
      })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        stdout: redactOutput(stdout, secretEnv),
        stderr: redactOutput(stderr, secretEnv),
        actions: [],
        error: `Failed to start ${runtimeLabel}: ${err.message}. ${
          condaEnvironmentPath
            ? 'Verify the selected environment and Conda executable in Settings.'
            : 'Ensure python3 is installed.'
        }`
      })
    })
  })
}

function parseActionsFromStdout(stdout: string): { actions: ScriptAction[]; error?: string } {
  // Expect the last line (or any line) containing valid JSON with an "actions" array
  const lines = stdout.trim().split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line.startsWith('{')) continue
    try {
      const parsed = JSON.parse(line) as { actions?: unknown }
      if (Array.isArray(parsed.actions)) {
        return parseScriptActions(parsed.actions)
      }
    } catch {
      // not valid JSON, try previous line
    }
  }
  return { actions: [], error: 'Script did not print a JSON object containing an actions array' }
}

function appendOutput(current: string, next: string, onLimit: () => void): string {
  const remaining = MAX_OUTPUT_CHARS - current.length
  if (remaining <= 0) {
    onLimit()
    return current
  }

  if (next.length > remaining) {
    onLimit()
    return current + next.slice(0, remaining)
  }

  return current + next
}

function normalizeSecretName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
}

function redactOutput(value: string, secretEnv: Record<string, string>): string {
  let redacted = value
  for (const secret of Object.values(secretEnv)) {
    if (secret.length >= 3) {
      redacted = redacted.split(secret).join('[REDACTED]')
    }
  }

  return redacted.replace(
    /(password|passwd|secret|token|api[_-]?key)\s*([=:])\s*["']?[^\s,"'}]+["']?/gi,
    '$1$2[REDACTED]'
  )
}
