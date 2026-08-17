import { describe, expect, it } from 'vitest'
import {
  getCondaExecutableCandidates,
  listCondaEnvironments,
  parseCondaEnvironments
} from '../src/main/pythonEnvironmentService'

describe('python environment service', () => {
  it('parses, deduplicates, and sorts Conda environments', () => {
    expect(
      parseCondaEnvironments(
        JSON.stringify({
          envs: ['/opt/conda/envs/zeta', '/opt/conda/envs/alpha', '/opt/conda/envs/zeta']
        })
      )
    ).toEqual([
      { name: 'alpha', path: '/opt/conda/envs/alpha' },
      { name: 'zeta', path: '/opt/conda/envs/zeta' }
    ])
  })

  it('rejects malformed Conda output', () => {
    expect(() => parseCondaEnvironments('not json')).toThrow(
      'Conda returned an invalid environment list.'
    )
    expect(() => parseCondaEnvironments('{"envs":[]}')).not.toThrow()
  })

  it('includes PATH and standard macOS installation candidates', () => {
    const candidates = getCondaExecutableCandidates({
      env: { PATH: '/custom/bin', CONDA_EXE: '/custom/conda' },
      homePath: '/Users/tester',
      platform: 'darwin'
    })

    expect(candidates.slice(0, 3)).toEqual([
      '/custom/conda',
      '/custom/bin/conda',
      '/Users/tester/miniconda3/bin/conda'
    ])
    expect(candidates).toContain('/opt/homebrew/bin/conda')
    expect(candidates).toContain('/Users/tester/miniforge3/condabin/conda')
  })

  it('returns an inline error when the configured executable is unavailable', async () => {
    await expect(listCondaEnvironments('/tmp/missing-conda-executable')).resolves.toEqual({
      environments: [],
      executablePath: null,
      error: expect.stringContaining('/tmp/missing-conda-executable')
    })
  })
})
