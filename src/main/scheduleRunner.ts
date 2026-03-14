import { spawn } from 'node:child_process'
import vm from 'node:vm'
import type { ScheduleJob, ScriptAction } from '../shared/scheduleTypes'

export interface RunResult {
  stdout: string
  stderr: string
  actions: ScriptAction[]
  error?: string
}

const SCRIPT_TIMEOUT_MS = 30_000

export async function runScript(job: ScheduleJob): Promise<RunResult> {
  if (job.runtime === 'javascript') {
    return runJavaScript(job)
  }
  if (job.runtime === 'python') {
    return runPython(job)
  }
  return { stdout: '', stderr: '', actions: [], error: `Unknown runtime: ${job.runtime}` }
}

// ── JavaScript runner ──────────────────────────────────────────────────────

function runJavaScript(job: ScheduleJob): RunResult {
  let stdout = ''
  let stderr = ''
  const collectedActions: ScriptAction[] = []

  const consoleApi = {
    log: (...args: unknown[]) => {
      stdout += args.map(String).join(' ') + '\n'
    },
    error: (...args: unknown[]) => {
      stderr += args.map(String).join(' ') + '\n'
    },
    warn: (...args: unknown[]) => {
      stderr += '[warn] ' + args.map(String).join(' ') + '\n'
    }
  }

  const beaconApi = {
    emit: (actionsOrAction: ScriptAction | ScriptAction[]) => {
      const list = Array.isArray(actionsOrAction) ? actionsOrAction : [actionsOrAction]
      collectedActions.push(...list)
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
    undefined,
    null: null
  }

  // Optionally expose fetch for network permission
  if (job.permissions.includes('network') && typeof fetch !== 'undefined') {
    sandbox['fetch'] = fetch
  }

  try {
    vm.runInNewContext(job.code, sandbox, {
      timeout: SCRIPT_TIMEOUT_MS,
      filename: `schedule-${job.id}.js`
    })
    return { stdout, stderr, actions: collectedActions }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { stdout, stderr, actions: collectedActions, error: message }
  }
}

// ── Python runner ──────────────────────────────────────────────────────────

function runPython(job: ScheduleJob): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false

    // Try common Python executables
    const pythonBin = process.platform === 'win32' ? 'python' : 'python3'

    const child = spawn(pythonBin, ['-c', job.code], {
      timeout: SCRIPT_TIMEOUT_MS,
      env: {
        ...process.env,
        // Restrict: unset potentially dangerous env vars
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONUNBUFFERED: '1'
      }
    })

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, SCRIPT_TIMEOUT_MS)

    child.on('close', (code) => {
      clearTimeout(timer)

      if (timedOut) {
        resolve({
          stdout,
          stderr,
          actions: [],
          error: `Script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s`
        })
        return
      }

      // Parse JSON output from stdout
      const actions = parseActionsFromStdout(stdout)

      if (code !== 0) {
        resolve({
          stdout,
          stderr,
          actions,
          error: `Script exited with code ${code}`
        })
        return
      }

      resolve({ stdout, stderr, actions })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr,
        actions: [],
        error: `Failed to start Python: ${err.message}. Ensure python3 is installed.`
      })
    })
  })
}

function parseActionsFromStdout(stdout: string): ScriptAction[] {
  // Expect the last line (or any line) containing valid JSON with an "actions" array
  const lines = stdout.trim().split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line.startsWith('{')) continue
    try {
      const parsed = JSON.parse(line) as { actions?: unknown }
      if (Array.isArray(parsed.actions)) {
        return parsed.actions as ScriptAction[]
      }
    } catch {
      // not valid JSON, try previous line
    }
  }
  return []
}
