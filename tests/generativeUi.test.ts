import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GenerativeUiArtifactStore } from '../src/main/generativeUiArtifactStore'
import {
  buildGenerativeUiCorrectionPrompt,
  buildGenerativeUiPrompt,
  GENERATIVE_UI_ARTIFACT_TYPES,
  GENERATIVE_UI_DOMAIN_PRESETS,
  extractGenerativeUiJsonFromText,
  stringifyGenerativeUiArtifact,
  tryRepairGenerativeUiJson,
  validateGenerativeUiArtifactJson,
  type GenerativeUiArtifact
} from '../src/shared/generativeUi'
import { generativeUiSampleArtifacts } from '../src/renderer/src/lib/generativeUiSamples'

const tempRoots: string[] = []

const sampleArtifact: GenerativeUiArtifact = {
  version: '2.0',
  metadata: {
    title: 'Sample',
    tags: ['test']
  },
  layout: {
    type: 'page',
    children: [{ type: 'text', body: 'Hello' }]
  }
}

async function makeStore(): Promise<{
  root: string
  store: GenerativeUiArtifactStore
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-generative-ui-'))
  tempRoots.push(root)
  return {
    root,
    store: new GenerativeUiArtifactStore(root)
  }
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('Generative UI artifact helpers', () => {
  it('extracts valid JSON from fenced chatbot output', () => {
    const result = extractGenerativeUiJsonFromText(
      `Here is output:\n\`\`\`json\n${stringifyGenerativeUiArtifact(sampleArtifact)}\n\`\`\``
    )

    expect(result.source).toBe('fenced-json')
    expect(validateGenerativeUiArtifactJson(result.text).ok).toBe(true)
  })

  it('repairs smart quotes and trailing commas', () => {
    const result = tryRepairGenerativeUiJson('{ “version”: “2.0”, }')

    expect(JSON.parse(result.text)).toEqual({ version: '2.0' })
  })

  it('reports unsupported component types before rendering', () => {
    const invalid = {
      ...sampleArtifact,
      layout: {
        type: 'page',
        children: [{ type: 'html', body: '<script />' }]
      }
    }

    const result = validateGenerativeUiArtifactJson(JSON.stringify(invalid))

    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.includes('unsupported'))).toBe(true)
  })

  it('validates all bundled sample artifacts', () => {
    generativeUiSampleArtifacts.forEach((artifact) => {
      const result = validateGenerativeUiArtifactJson(stringifyGenerativeUiArtifact(artifact))
      expect(result, artifact.metadata.title).toMatchObject({ ok: true })
    })
  })

  it('bundles samples that cover every domain-specific node type', () => {
    const expectedTypes = [
      'formulaBlock',
      'formulaDerivation',
      'signalPlot',
      'stemPlot',
      'spectrumPlot',
      'complexPlane',
      'poleZeroPlot',
      'convolutionVisualizer',
      'transformPairCard',
      'confusionMatrix',
      'lossCurve',
      'decisionBoundary',
      'clusterPlot',
      'featureImportance',
      'modelPipeline',
      'neuralNetworkDiagram',
      'transformerBlockDiagram',
      'attentionMap',
      'tokenFlow',
      'embeddingPlot',
      'ragPipeline',
      'agentWorkflow'
    ]
    const actualTypes = new Set(
      generativeUiSampleArtifacts.flatMap((artifact) => collectTypes(artifact.layout))
    )

    expectedTypes.forEach((type) => expect(actualTypes.has(type), type).toBe(true))
  })

  it('includes new supported nodes in generated prompts and correction prompts', () => {
    const preset = GENERATIVE_UI_DOMAIN_PRESETS.find((item) => item.id === 'modern-ai')!
    const prompt = buildGenerativeUiPrompt({
      artifactType: GENERATIVE_UI_ARTIFACT_TYPES[0],
      topic: 'attention and retrieval',
      allowedComponents: [...preset.components],
      domainPresetLabel: preset.label
    })
    const correctionPrompt = buildGenerativeUiCorrectionPrompt('bad node')

    expect(prompt).toContain('Return only one fenced codeblock labeled json')
    expect(prompt).toContain('Do not generate JavaScript functions')
    expect(prompt).toContain('The app owns all visual styling and theme choices')
    expect(prompt).not.toContain('"theme"')
    expect(prompt).toContain('attentionMap')
    expect(prompt).toContain('ragPipeline')
    expect(correctionPrompt).toContain('attentionMap')
    expect(correctionPrompt).toContain('poleZeroPlot')
    expect(correctionPrompt).toContain('data, preprocess, feature, model, evaluation, deployment')
    expect(correctionPrompt).toContain('Replace generic kinds like process')
  })

  it('rejects old 1.0 artifacts with theme fields', () => {
    const legacyArtifact = {
      version: '1.0',
      metadata: { title: 'Legacy' },
      theme: {
        mode: 'light',
        accent: 'blue',
        density: 'normal'
      },
      layout: {
        type: 'page',
        children: [{ type: 'text', body: 'Legacy content' }]
      }
    }

    const result = validateGenerativeUiArtifactJson(JSON.stringify(legacyArtifact))

    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('2.0')
  })

  it('rejects malformed matrix dimensions with readable errors', () => {
    const invalid = {
      ...sampleArtifact,
      layout: {
        type: 'page',
        children: [
          {
            type: 'attentionMap',
            tokens: ['a', 'b'],
            weights: [[1, 0.2]]
          }
        ]
      }
    }

    const result = validateGenerativeUiArtifactJson(JSON.stringify(invalid))

    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('tokens length')
  })

  it('includes line and nearby JSON context for validation errors', () => {
    const invalid = {
      ...sampleArtifact,
      layout: {
        type: 'page',
        children: [
          { type: 'text', body: 'ok' },
          {
            type: 'modelPipeline',
            stages: [
              { id: 'data', label: 'Data', kind: 'data' },
              { id: 'train', label: 'Train', kind: 'training' }
            ],
            edges: [{ source: 'data', target: 'train' }]
          },
          { type: 'html', body: '<div />' }
        ]
      }
    }

    const result = validateGenerativeUiArtifactJson(JSON.stringify(invalid, null, 2))

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('layout.children[1].stages[1].kind')
    expect(result.errors.join('\n')).toContain('(line ')
    expect(result.errors.join('\n')).toContain('|             "kind": "training"')
    expect(result.errors.join('\n')).toContain('layout.children[2].type')
    expect(result.errors.join('\n')).toContain('"type": "html"')
  })
})

function collectTypes(node: { type: string; [key: string]: unknown }): string[] {
  const children = Array.isArray(node.children) ? node.children : []
  const tabChildren = Array.isArray(node.tabs)
    ? node.tabs.flatMap((tab) =>
        typeof tab === 'object' && tab && Array.isArray((tab as { children?: unknown }).children)
          ? (tab as { children: Array<{ type: string; [key: string]: unknown }> }).children
          : []
      )
    : []
  const itemChildren = Array.isArray(node.items)
    ? node.items.flatMap((item) =>
        typeof item === 'object' && item && Array.isArray((item as { children?: unknown }).children)
          ? (item as { children: Array<{ type: string; [key: string]: unknown }> }).children
          : []
      )
    : []

  return [
    node.type,
    ...[...children, ...tabChildren, ...itemChildren].flatMap((child) =>
      collectTypes(child as { type: string; [key: string]: unknown })
    )
  ]
}

describe('GenerativeUiArtifactStore', () => {
  it('returns an empty list when the store file is missing', async () => {
    const { store } = await makeStore()

    await expect(store.listArtifacts()).resolves.toEqual([])
  })

  it('saves and lists artifacts by most recent update', async () => {
    const { store } = await makeStore()

    const older = await store.saveArtifact({ artifact: sampleArtifact })
    await new Promise((resolve) => setTimeout(resolve, 2))
    const newer = await store.saveArtifact({
      artifact: { ...sampleArtifact, metadata: { title: 'Newer' } }
    })

    const artifacts = await store.listArtifacts()

    expect(artifacts.map((artifact) => artifact.id)).toEqual([newer.id, older.id])
  })

  it('updates an existing artifact id instead of duplicating it', async () => {
    const { store } = await makeStore()
    const saved = await store.saveArtifact({ artifact: sampleArtifact })

    await store.saveArtifact({
      id: saved.id,
      artifact: { ...sampleArtifact, metadata: { title: 'Renamed' } }
    })

    const artifacts = await store.listArtifacts()

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0]?.artifact.metadata.title).toBe('Renamed')
  })

  it('deletes only the requested artifact', async () => {
    const { store } = await makeStore()
    const keep = await store.saveArtifact({ artifact: sampleArtifact })
    const remove = await store.saveArtifact({
      artifact: { ...sampleArtifact, metadata: { title: 'Remove' } }
    })

    await store.deleteArtifact(remove.id)

    expect((await store.listArtifacts()).map((artifact) => artifact.id)).toEqual([keep.id])
  })

  it('falls back to an empty list for invalid JSON', async () => {
    const { root, store } = await makeStore()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const filePath = path.join(root, 'generative-ui', 'artifacts.json')
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, '{ invalid', 'utf-8')

    try {
      await expect(store.listArtifacts()).resolves.toEqual([])
    } finally {
      errorSpy.mockRestore()
    }
  })
})
