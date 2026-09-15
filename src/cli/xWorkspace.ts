import { stdout } from 'node:process'
import { runXWorkspace, serializeXWorkspaceResponse } from './xWorkspaceCli'

const argv = process.argv.slice(2)
const pretty = argv.includes('--pretty')

runXWorkspace(argv)
  .then((response) => {
    stdout.write(`${serializeXWorkspaceResponse(response, { pretty })}\n`)
    process.exitCode = response.exitCode
  })
  .catch((error) => {
    stdout.write(
      `${JSON.stringify({
        ok: false,
        command: 'x-workspace',
        exitCode: 4,
        error: {
          code: 'operational-error',
          message: error instanceof Error ? error.message : String(error)
        }
      })}\n`
    )
    process.exitCode = 4
  })
