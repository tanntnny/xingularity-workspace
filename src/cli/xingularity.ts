import { runVaultCli, serializeVaultCliResponse } from './vaultCli'

const argv = process.argv.slice(2)
const pretty = argv.includes('--pretty')

runVaultCli(argv)
  .then((response) => {
    process.stdout.write(`${serializeVaultCliResponse(response, { pretty })}\n`)
    process.exitCode = response.exitCode
  })
  .catch((error: unknown) => {
    process.stdout.write(
      `${serializeVaultCliResponse(
        {
          ok: false,
          command: 'vault',
          exitCode: 4,
          error: {
            code: 'operational-error',
            message: error instanceof Error ? error.message : String(error)
          }
        },
        { pretty }
      )}\n`
    )
    process.exitCode = 4
  })
