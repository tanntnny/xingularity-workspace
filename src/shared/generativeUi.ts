import { z } from 'zod'

export const GENERATIVE_UI_COMPONENT_TYPES = [
  'page',
  'section',
  'text',
  'callout',
  'card',
  'grid',
  'tabs',
  'accordion',
  'table',
  'chart',
  'quiz',
  'timeline',
  'flowDiagram',
  'sliderSimulator',
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
] as const

export const GENERATIVE_UI_PROMPT_COMPONENT_TYPES = GENERATIVE_UI_COMPONENT_TYPES.filter(
  (type) => type !== 'page' && type !== 'section'
)

export const GENERATIVE_UI_ARTIFACT_TYPES = [
  'Study UI',
  'Dashboard',
  'Comparison UI',
  'Interactive Explainer',
  'Flow Diagram',
  'Quiz',
  'Simulator'
] as const

export const GENERATIVE_UI_DOMAIN_PRESETS = [
  {
    id: 'general',
    label: 'General',
    components: GENERATIVE_UI_PROMPT_COMPONENT_TYPES
  },
  {
    id: 'signal-processing',
    label: 'Signal Processing / Transforms',
    components: [
      'formulaBlock',
      'formulaDerivation',
      'signalPlot',
      'stemPlot',
      'spectrumPlot',
      'complexPlane',
      'poleZeroPlot',
      'convolutionVisualizer',
      'transformPairCard',
      'tabs',
      'accordion',
      'quiz',
      'table',
      'callout'
    ]
  },
  {
    id: 'ai-ml',
    label: 'AI / ML',
    components: [
      'modelPipeline',
      'clusterPlot',
      'decisionBoundary',
      'confusionMatrix',
      'lossCurve',
      'featureImportance',
      'table',
      'chart',
      'quiz',
      'flowDiagram',
      'callout'
    ]
  },
  {
    id: 'modern-ai',
    label: 'Modern AI / LLM',
    components: [
      'neuralNetworkDiagram',
      'transformerBlockDiagram',
      'attentionMap',
      'tokenFlow',
      'embeddingPlot',
      'ragPipeline',
      'agentWorkflow',
      'table',
      'tabs',
      'accordion',
      'quiz',
      'callout'
    ]
  }
] as const

export type GenerativeUiArtifactType = (typeof GENERATIVE_UI_ARTIFACT_TYPES)[number]
export type GenerativeUiDomainPresetId = (typeof GENERATIVE_UI_DOMAIN_PRESETS)[number]['id']

export type GenerativeUiNode =
  | { type: 'page'; children: GenerativeUiNode[] }
  | {
      type: 'section'
      title?: string
      description?: string
      children: GenerativeUiNode[]
    }
  | {
      type: 'text'
      body: string
      variant?: 'paragraph' | 'heading' | 'muted' | 'caption'
    }
  | {
      type: 'callout'
      title?: string
      body: string
      tone?: 'info' | 'warning' | 'success' | 'danger'
    }
  | { type: 'card'; title?: string; body?: string; children?: GenerativeUiNode[] }
  | { type: 'grid'; columns?: 1 | 2 | 3 | 4; children: GenerativeUiNode[] }
  | { type: 'tabs'; tabs: Array<{ label: string; children: GenerativeUiNode[] }> }
  | { type: 'accordion'; items: Array<{ title: string; children: GenerativeUiNode[] }> }
  | {
      type: 'table'
      columns: string[]
      rows: Array<Record<string, string | number | boolean | null>>
    }
  | {
      type: 'chart'
      chartType: 'bar' | 'line' | 'area' | 'pie'
      xKey: string
      yKey: string
      data: Array<Record<string, string | number>>
    }
  | {
      type: 'quiz'
      questions: Array<{
        question: string
        choices: string[]
        answerIndex: number
        explanation?: string
      }>
    }
  | { type: 'timeline'; items: Array<{ title: string; description?: string; date?: string }> }
  | {
      type: 'flowDiagram'
      nodes: Array<{ id: string; label: string }>
      edges: Array<{ source: string; target: string; label?: string }>
    }
  | {
      type: 'sliderSimulator'
      title: string
      description?: string
      inputs: Array<{
        id: string
        label: string
        min: number
        max: number
        step: number
        defaultValue: number
      }>
      outputs: Array<{ label: string; formula: string }>
    }
  | {
      type: 'formulaBlock'
      title?: string
      formula: string
      description?: string
      variables?: Array<{ symbol: string; meaning: string; unit?: string }>
    }
  | {
      type: 'formulaDerivation'
      title?: string
      steps: Array<{ label?: string; expression: string; explanation?: string }>
    }
  | {
      type: 'signalPlot'
      title?: string
      xLabel?: string
      yLabel?: string
      signalType: 'continuous' | 'discrete'
      data: Array<{ x: number; y: number }>
    }
  | {
      type: 'stemPlot'
      title?: string
      nLabel?: string
      valueLabel?: string
      data: Array<{ n: number; value: number }>
    }
  | {
      type: 'spectrumPlot'
      title?: string
      domain: 'frequency' | 'omega' | 'normalized'
      showMagnitude?: boolean
      showPhase?: boolean
      magnitude?: Array<{ x: number; value: number }>
      phase?: Array<{ x: number; value: number }>
      xLabel?: string
    }
  | {
      type: 'complexPlane'
      title?: string
      points: Array<{
        label?: string
        re: number
        im: number
        kind?: 'point' | 'vector' | 'root'
      }>
      showUnitCircle?: boolean
      xRange?: [number, number]
      yRange?: [number, number]
    }
  | {
      type: 'poleZeroPlot'
      title?: string
      poles: Array<{ re: number; im: number; label?: string }>
      zeros: Array<{ re: number; im: number; label?: string }>
      showUnitCircle?: boolean
      xRange?: [number, number]
      yRange?: [number, number]
      stabilityNote?: string
    }
  | {
      type: 'convolutionVisualizer'
      title?: string
      x: Array<{ n: number; value: number }>
      h: Array<{ n: number; value: number }>
      y?: Array<{ n: number; value: number }>
      explanation?: string
    }
  | {
      type: 'transformPairCard'
      title?: string
      leftLabel?: string
      rightLabel?: string
      timeExpression: string
      transformExpression: string
      conditions?: string
      notes?: string
    }
  | {
      type: 'confusionMatrix'
      title?: string
      labels: string[]
      matrix: number[][]
      normalize?: boolean
      notes?: string
    }
  | {
      type: 'lossCurve'
      title?: string
      xLabel?: string
      yLabel?: string
      data: Array<{
        epoch: number
        trainLoss?: number
        valLoss?: number
        trainMetric?: number
        valMetric?: number
      }>
    }
  | {
      type: 'decisionBoundary'
      title?: string
      xLabel?: string
      yLabel?: string
      points: Array<{ x: number; y: number; label: string }>
      regions?: Array<{
        label: string
        colorHint?: string
        polygon: Array<{ x: number; y: number }>
      }>
    }
  | {
      type: 'clusterPlot'
      title?: string
      xLabel?: string
      yLabel?: string
      points: Array<{ x: number; y: number; cluster?: string | number }>
      centroids?: Array<{ x: number; y: number; cluster?: string | number }>
    }
  | {
      type: 'featureImportance'
      title?: string
      features: Array<{ name: string; importance: number; description?: string }>
    }
  | {
      type: 'modelPipeline'
      title?: string
      stages: Array<{
        id: string
        label: string
        description?: string
        kind?: 'data' | 'preprocess' | 'feature' | 'model' | 'evaluation' | 'deployment'
      }>
      edges?: Array<{ source: string; target: string; label?: string }>
    }
  | {
      type: 'neuralNetworkDiagram'
      title?: string
      layers: Array<{
        id: string
        label: string
        units?: number
        activation?: string
        description?: string
      }>
    }
  | {
      type: 'transformerBlockDiagram'
      title?: string
      blocks: Array<{ label: string; description?: string }>
      showResiduals?: boolean
      notes?: string
    }
  | {
      type: 'attentionMap'
      title?: string
      tokens: string[]
      weights: number[][]
      headLabel?: string
      notes?: string
    }
  | {
      type: 'tokenFlow'
      title?: string
      steps: Array<{ label: string; description?: string; tokens?: string[] }>
    }
  | {
      type: 'embeddingPlot'
      title?: string
      xLabel?: string
      yLabel?: string
      points: Array<{ x: number; y: number; label: string; group?: string }>
      notes?: string
    }
  | {
      type: 'ragPipeline'
      title?: string
      stages: Array<{ id: string; label: string; description?: string }>
      edges?: Array<{ source: string; target: string; label?: string }>
      notes?: string
    }
  | {
      type: 'agentWorkflow'
      title?: string
      agents?: Array<{ id: string; name: string; role?: string }>
      steps: Array<{ id: string; label: string; description?: string; agentId?: string }>
      edges?: Array<{ source: string; target: string; label?: string }>
      notes?: string
    }

export type GenerativeUiArtifact = {
  version: '2.0'
  metadata: {
    title: string
    description?: string
    tags?: string[]
  }
  layout: GenerativeUiNode
}

export type FormulaBlockNode = Extract<GenerativeUiNode, { type: 'formulaBlock' }>
export type FormulaDerivationNode = Extract<GenerativeUiNode, { type: 'formulaDerivation' }>
export type SignalPlotNode = Extract<GenerativeUiNode, { type: 'signalPlot' }>
export type StemPlotNode = Extract<GenerativeUiNode, { type: 'stemPlot' }>
export type SpectrumPlotNode = Extract<GenerativeUiNode, { type: 'spectrumPlot' }>
export type ComplexPlaneNode = Extract<GenerativeUiNode, { type: 'complexPlane' }>
export type PoleZeroPlotNode = Extract<GenerativeUiNode, { type: 'poleZeroPlot' }>
export type ConvolutionVisualizerNode = Extract<GenerativeUiNode, { type: 'convolutionVisualizer' }>
export type TransformPairCardNode = Extract<GenerativeUiNode, { type: 'transformPairCard' }>
export type ConfusionMatrixNode = Extract<GenerativeUiNode, { type: 'confusionMatrix' }>
export type LossCurveNode = Extract<GenerativeUiNode, { type: 'lossCurve' }>
export type DecisionBoundaryNode = Extract<GenerativeUiNode, { type: 'decisionBoundary' }>
export type ClusterPlotNode = Extract<GenerativeUiNode, { type: 'clusterPlot' }>
export type FeatureImportanceNode = Extract<GenerativeUiNode, { type: 'featureImportance' }>
export type ModelPipelineNode = Extract<GenerativeUiNode, { type: 'modelPipeline' }>
export type NeuralNetworkDiagramNode = Extract<GenerativeUiNode, { type: 'neuralNetworkDiagram' }>
export type TransformerBlockDiagramNode = Extract<
  GenerativeUiNode,
  { type: 'transformerBlockDiagram' }
>
export type AttentionMapNode = Extract<GenerativeUiNode, { type: 'attentionMap' }>
export type TokenFlowNode = Extract<GenerativeUiNode, { type: 'tokenFlow' }>
export type EmbeddingPlotNode = Extract<GenerativeUiNode, { type: 'embeddingPlot' }>
export type RagPipelineNode = Extract<GenerativeUiNode, { type: 'ragPipeline' }>
export type AgentWorkflowNode = Extract<GenerativeUiNode, { type: 'agentWorkflow' }>

export type SavedGenerativeUiArtifact = {
  id: string
  artifact: GenerativeUiArtifact
  createdAt: string
  updatedAt: string
}

const rowValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const chartValueSchema = z.union([z.string(), z.number()])
const numericPointSchema = z.object({ x: z.number(), y: z.number() }).strict()
const sequencePointSchema = z.object({ n: z.number(), value: z.number() }).strict()
const complexPointSchema = z
  .object({
    label: z.string().optional(),
    re: z.number(),
    im: z.number()
  })
  .strict()
const rangeSchema = z.tuple([z.number(), z.number()])
const graphEdgeSchema = z
  .object({
    source: z.string(),
    target: z.string(),
    label: z.string().optional()
  })
  .strict()
const flowStageSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional()
  })
  .strict()
const confusionMatrixSchema = z
  .object({
    type: z.literal('confusionMatrix'),
    title: z.string().optional(),
    labels: z.array(z.string()).min(1),
    matrix: z.array(z.array(z.number())),
    normalize: z.boolean().optional(),
    notes: z.string().optional()
  })
  .strict()
  .superRefine((node, context) => {
    if (node.matrix.length !== node.labels.length) {
      context.addIssue({
        code: 'custom',
        path: ['matrix'],
        message: 'Matrix row count must match labels length.'
      })
    }
    node.matrix.forEach((row, index) => {
      if (row.length !== node.labels.length) {
        context.addIssue({
          code: 'custom',
          path: ['matrix', index],
          message: 'Matrix must be square and match labels length.'
        })
      }
    })
  })
const attentionMapSchema = z
  .object({
    type: z.literal('attentionMap'),
    title: z.string().optional(),
    tokens: z.array(z.string()).min(1),
    weights: z.array(z.array(z.number())),
    headLabel: z.string().optional(),
    notes: z.string().optional()
  })
  .strict()
  .superRefine((node, context) => {
    if (node.weights.length !== node.tokens.length) {
      context.addIssue({
        code: 'custom',
        path: ['weights'],
        message: 'Attention weights row count must match tokens length.'
      })
    }
    node.weights.forEach((row, index) => {
      if (row.length !== node.tokens.length) {
        context.addIssue({
          code: 'custom',
          path: ['weights', index],
          message: 'Attention weights must be square and match tokens length.'
        })
      }
    })
  })

export const GenerativeUiNodeSchema: z.ZodType<GenerativeUiNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('page'), children: z.array(GenerativeUiNodeSchema) }),
    z.object({
      type: z.literal('section'),
      title: z.string().optional(),
      description: z.string().optional(),
      children: z.array(GenerativeUiNodeSchema)
    }),
    z.object({
      type: z.literal('text'),
      body: z.string(),
      variant: z.enum(['paragraph', 'heading', 'muted', 'caption']).optional()
    }),
    z.object({
      type: z.literal('callout'),
      title: z.string().optional(),
      body: z.string(),
      tone: z.enum(['info', 'warning', 'success', 'danger']).optional()
    }),
    z.object({
      type: z.literal('card'),
      title: z.string().optional(),
      body: z.string().optional(),
      children: z.array(GenerativeUiNodeSchema).optional()
    }),
    z.object({
      type: z.literal('grid'),
      columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
      children: z.array(GenerativeUiNodeSchema)
    }),
    z.object({
      type: z.literal('tabs'),
      tabs: z.array(z.object({ label: z.string(), children: z.array(GenerativeUiNodeSchema) }))
    }),
    z.object({
      type: z.literal('accordion'),
      items: z.array(z.object({ title: z.string(), children: z.array(GenerativeUiNodeSchema) }))
    }),
    z.object({
      type: z.literal('table'),
      columns: z.array(z.string()),
      rows: z.array(z.record(z.string(), rowValueSchema))
    }),
    z.object({
      type: z.literal('chart'),
      chartType: z.enum(['bar', 'line', 'area', 'pie']),
      xKey: z.string(),
      yKey: z.string(),
      data: z.array(z.record(z.string(), chartValueSchema))
    }),
    z.object({
      type: z.literal('quiz'),
      questions: z.array(
        z.object({
          question: z.string(),
          choices: z.array(z.string()).min(2),
          answerIndex: z.number().int().nonnegative(),
          explanation: z.string().optional()
        })
      )
    }),
    z.object({
      type: z.literal('timeline'),
      items: z.array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          date: z.string().optional()
        })
      )
    }),
    z.object({
      type: z.literal('flowDiagram'),
      nodes: z.array(z.object({ id: z.string(), label: z.string() })),
      edges: z.array(
        z.object({ source: z.string(), target: z.string(), label: z.string().optional() })
      )
    }),
    z.object({
      type: z.literal('sliderSimulator'),
      title: z.string(),
      description: z.string().optional(),
      inputs: z.array(
        z.object({
          id: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Use safe variable IDs like revenue.'),
          label: z.string(),
          min: z.number(),
          max: z.number(),
          step: z.number().positive(),
          defaultValue: z.number()
        })
      ),
      outputs: z.array(z.object({ label: z.string(), formula: z.string() }))
    }),
    z
      .object({
        type: z.literal('formulaBlock'),
        title: z.string().optional(),
        formula: z.string(),
        description: z.string().optional(),
        variables: z
          .array(
            z
              .object({
                symbol: z.string(),
                meaning: z.string(),
                unit: z.string().optional()
              })
              .strict()
          )
          .optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('formulaDerivation'),
        title: z.string().optional(),
        steps: z
          .array(
            z
              .object({
                label: z.string().optional(),
                expression: z.string(),
                explanation: z.string().optional()
              })
              .strict()
          )
          .min(1)
      })
      .strict(),
    z
      .object({
        type: z.literal('signalPlot'),
        title: z.string().optional(),
        xLabel: z.string().optional(),
        yLabel: z.string().optional(),
        signalType: z.enum(['continuous', 'discrete']),
        data: z.array(numericPointSchema).min(1)
      })
      .strict(),
    z
      .object({
        type: z.literal('stemPlot'),
        title: z.string().optional(),
        nLabel: z.string().optional(),
        valueLabel: z.string().optional(),
        data: z.array(sequencePointSchema).min(1)
      })
      .strict(),
    z
      .object({
        type: z.literal('spectrumPlot'),
        title: z.string().optional(),
        domain: z.enum(['frequency', 'omega', 'normalized']),
        showMagnitude: z.boolean().optional(),
        showPhase: z.boolean().optional(),
        magnitude: z.array(z.object({ x: z.number(), value: z.number() }).strict()).optional(),
        phase: z.array(z.object({ x: z.number(), value: z.number() }).strict()).optional(),
        xLabel: z.string().optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('complexPlane'),
        title: z.string().optional(),
        points: z
          .array(
            complexPointSchema.extend({
              kind: z.enum(['point', 'vector', 'root']).optional()
            })
          )
          .min(1),
        showUnitCircle: z.boolean().optional(),
        xRange: rangeSchema.optional(),
        yRange: rangeSchema.optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('poleZeroPlot'),
        title: z.string().optional(),
        poles: z.array(complexPointSchema),
        zeros: z.array(complexPointSchema),
        showUnitCircle: z.boolean().optional(),
        xRange: rangeSchema.optional(),
        yRange: rangeSchema.optional(),
        stabilityNote: z.string().optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('convolutionVisualizer'),
        title: z.string().optional(),
        x: z.array(sequencePointSchema).min(1),
        h: z.array(sequencePointSchema).min(1),
        y: z.array(sequencePointSchema).optional(),
        explanation: z.string().optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('transformPairCard'),
        title: z.string().optional(),
        leftLabel: z.string().optional(),
        rightLabel: z.string().optional(),
        timeExpression: z.string(),
        transformExpression: z.string(),
        conditions: z.string().optional(),
        notes: z.string().optional()
      })
      .strict(),
    confusionMatrixSchema,
    z
      .object({
        type: z.literal('lossCurve'),
        title: z.string().optional(),
        xLabel: z.string().optional(),
        yLabel: z.string().optional(),
        data: z
          .array(
            z
              .object({
                epoch: z.number(),
                trainLoss: z.number().optional(),
                valLoss: z.number().optional(),
                trainMetric: z.number().optional(),
                valMetric: z.number().optional()
              })
              .strict()
          )
          .min(1)
      })
      .strict(),
    z
      .object({
        type: z.literal('decisionBoundary'),
        title: z.string().optional(),
        xLabel: z.string().optional(),
        yLabel: z.string().optional(),
        points: z
          .array(z.object({ x: z.number(), y: z.number(), label: z.string() }).strict())
          .min(1),
        regions: z
          .array(
            z
              .object({
                label: z.string(),
                colorHint: z.string().optional(),
                polygon: z.array(numericPointSchema).min(3)
              })
              .strict()
          )
          .optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('clusterPlot'),
        title: z.string().optional(),
        xLabel: z.string().optional(),
        yLabel: z.string().optional(),
        points: z
          .array(
            z
              .object({
                x: z.number(),
                y: z.number(),
                cluster: z.union([z.string(), z.number()]).optional()
              })
              .strict()
          )
          .min(1),
        centroids: z
          .array(
            z
              .object({
                x: z.number(),
                y: z.number(),
                cluster: z.union([z.string(), z.number()]).optional()
              })
              .strict()
          )
          .optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('featureImportance'),
        title: z.string().optional(),
        features: z
          .array(
            z
              .object({
                name: z.string(),
                importance: z.number(),
                description: z.string().optional()
              })
              .strict()
          )
          .min(1)
      })
      .strict(),
    z
      .object({
        type: z.literal('modelPipeline'),
        title: z.string().optional(),
        stages: z
          .array(
            flowStageSchema.extend({
              kind: z
                .enum(['data', 'preprocess', 'feature', 'model', 'evaluation', 'deployment'])
                .optional()
            })
          )
          .min(1),
        edges: z.array(graphEdgeSchema).optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('neuralNetworkDiagram'),
        title: z.string().optional(),
        layers: z
          .array(
            z
              .object({
                id: z.string(),
                label: z.string(),
                units: z.number().int().positive().optional(),
                activation: z.string().optional(),
                description: z.string().optional()
              })
              .strict()
          )
          .min(1)
      })
      .strict(),
    z
      .object({
        type: z.literal('transformerBlockDiagram'),
        title: z.string().optional(),
        blocks: z
          .array(
            z
              .object({
                label: z.string(),
                description: z.string().optional()
              })
              .strict()
          )
          .min(1),
        showResiduals: z.boolean().optional(),
        notes: z.string().optional()
      })
      .strict(),
    attentionMapSchema,
    z
      .object({
        type: z.literal('tokenFlow'),
        title: z.string().optional(),
        steps: z
          .array(
            z
              .object({
                label: z.string(),
                description: z.string().optional(),
                tokens: z.array(z.string()).optional()
              })
              .strict()
          )
          .min(1)
      })
      .strict(),
    z
      .object({
        type: z.literal('embeddingPlot'),
        title: z.string().optional(),
        xLabel: z.string().optional(),
        yLabel: z.string().optional(),
        points: z
          .array(
            z
              .object({
                x: z.number(),
                y: z.number(),
                label: z.string(),
                group: z.string().optional()
              })
              .strict()
          )
          .min(1),
        notes: z.string().optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('ragPipeline'),
        title: z.string().optional(),
        stages: z.array(flowStageSchema).min(1),
        edges: z.array(graphEdgeSchema).optional(),
        notes: z.string().optional()
      })
      .strict(),
    z
      .object({
        type: z.literal('agentWorkflow'),
        title: z.string().optional(),
        agents: z
          .array(
            z.object({ id: z.string(), name: z.string(), role: z.string().optional() }).strict()
          )
          .optional(),
        steps: z
          .array(
            flowStageSchema.extend({
              agentId: z.string().optional()
            })
          )
          .min(1),
        edges: z.array(graphEdgeSchema).optional(),
        notes: z.string().optional()
      })
      .strict()
  ])
)

export const GenerativeUiArtifactSchema: z.ZodType<GenerativeUiArtifact> = z.object({
  version: z.literal('2.0'),
  metadata: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      tags: z.array(z.string()).optional()
    })
    .strict(),
  layout: GenerativeUiNodeSchema
}).strict()

export const SavedGenerativeUiArtifactSchema: z.ZodType<SavedGenerativeUiArtifact> = z.object({
  id: z.string().min(1).max(200),
  artifact: GenerativeUiArtifactSchema,
  createdAt: z.string().min(1).max(100),
  updatedAt: z.string().min(1).max(100)
})

export type GenerativeUiValidationResult =
  | { ok: true; artifact: GenerativeUiArtifact; errors: [] }
  | { ok: false; artifact?: undefined; errors: string[] }

export function parseGenerativeUiJson(
  text: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON.' }
  }
}

export function validateGenerativeUiArtifactJson(text: string): GenerativeUiValidationResult {
  const parsed = parseGenerativeUiJson(text)
  if (!parsed.ok) {
    return { ok: false, errors: [`JSON parse error: ${parsed.error}`] }
  }

  const locator = buildJsonPathLocator(text)
  const unsupported = findUnsupportedNodeTypes(parsed.value, locator)
  const result = GenerativeUiArtifactSchema.safeParse(parsed.value)
  if (result.success && unsupported.length === 0) {
    return { ok: true, artifact: result.data, errors: [] }
  }

  const zodErrors = result.success
    ? []
    : result.error.issues.map((issue) => {
        const path = issue.path.length
          ? issue.path.join('.').replace(/\.(\d+)(?=\.|$)/g, '[$1]')
          : 'artifact'
        return formatValidationError(path, issue.message, locator)
      })
  return { ok: false, errors: [...unsupported, ...zodErrors] }
}

export function stringifyGenerativeUiArtifact(artifact: GenerativeUiArtifact): string {
  return JSON.stringify(artifact, null, 2)
}

export type GenerativeUiExtractResult = {
  text: string
  source: 'fenced-json' | 'fenced' | 'object' | 'raw'
  error?: string
}

export function extractGenerativeUiJsonFromText(input: string): GenerativeUiExtractResult {
  const trimmed = input.trim()
  const jsonFences = [...trimmed.matchAll(/```json\s*([\s\S]*?)```/gi)]
  const validJsonFence = jsonFences.find((match) => canParseJson(match[1].trim()))
  if (validJsonFence?.[1]) {
    return { text: validJsonFence[1].trim(), source: 'fenced-json' }
  }

  if (jsonFences[0]?.[1]) {
    return { text: jsonFences[0][1].trim(), source: 'fenced-json' }
  }

  const anyFences = [...trimmed.matchAll(/```\s*([\s\S]*?)```/g)]
  const validFence = anyFences.find((match) => canParseJson(match[1].trim()))
  if (validFence?.[1]) {
    return { text: validFence[1].trim(), source: 'fenced' }
  }

  if (anyFences[0]?.[1]) {
    return { text: anyFences[0][1].trim(), source: 'fenced' }
  }

  const objectText = extractFirstJsonObject(trimmed)
  if (objectText) {
    return { text: objectText, source: 'object' }
  }

  return {
    text: trimmed,
    source: 'raw',
    error: 'No fenced JSON codeblock or JSON object found.'
  }
}

export function tryRepairGenerativeUiJson(input: string): GenerativeUiExtractResult {
  const extracted = extractGenerativeUiJsonFromText(input)
  const repaired = extracted.text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim()

  return { text: repaired, source: extracted.source, error: extracted.error }
}

export function buildGenerativeUiPrompt(options: {
  artifactType: GenerativeUiArtifactType
  allowedComponents: string[]
  topic: string
  domainPresetLabel?: string
}): string {
  const allowed = options.allowedComponents.length
    ? options.allowedComponents
    : GENERATIVE_UI_PROMPT_COMPONENT_TYPES
  const topic = options.topic.trim() || 'a useful interactive learning artifact'

  const presetLine = options.domainPresetLabel
    ? `Domain preset: ${options.domainPresetLabel}.`
    : 'Domain preset: General.'

  return `Create a ${options.artifactType.toLowerCase()} about: ${topic}.
${presetLine}

Return only one fenced codeblock labeled json.
Do not include explanation outside the codeblock.
Do not generate React code.
Do not generate JavaScript functions.
Do not include raw HTML.
The app owns all visual styling and theme choices.
Do not include theme, mode, accent, density, CSS, class names, or styling metadata anywhere in the JSON.
Use only these component types inside layout children: ${allowed.join(', ')}.
Use domain-specific nodes such as signalPlot, spectrumPlot, poleZeroPlot, convolutionVisualizer, confusionMatrix, clusterPlot, transformerBlockDiagram, attentionMap, ragPipeline, and agentWorkflow when they fit the topic.
The top-level layout type must be "page".
Output valid JSON matching this schema:

{
  "version": "2.0",
  "metadata": {
    "title": "string",
    "description": "optional string",
    "tags": ["optional", "strings"]
  },
  "layout": {
    "type": "page",
    "children": [
      {
        "type": "one of the allowed component types",
        "...": "Use the concrete node shapes below. Do not include a props wrapper."
      }
    ]
  }
}

Node shapes:
- section: { "type": "section", "title": "optional", "description": "optional", "children": [] }
- text: { "type": "text", "body": "string", "variant": "paragraph | heading | muted | caption" }
- callout: { "type": "callout", "title": "optional", "body": "string", "tone": "info | warning | success | danger" }
- card: { "type": "card", "title": "optional", "body": "optional", "children": [] }
- grid: { "type": "grid", "columns": 1, "children": [] }
- tabs: { "type": "tabs", "tabs": [{ "label": "string", "children": [] }] }
- accordion: { "type": "accordion", "items": [{ "title": "string", "children": [] }] }
- table: { "type": "table", "columns": ["string"], "rows": [{ "columnName": "string/number/boolean/null" }] }
- chart: { "type": "chart", "chartType": "bar | line | area | pie", "xKey": "string", "yKey": "string", "data": [{ "x": "label", "y": 10 }] }
- quiz: { "type": "quiz", "questions": [{ "question": "string", "choices": ["A", "B"], "answerIndex": 0, "explanation": "optional" }] }
- timeline: { "type": "timeline", "items": [{ "title": "string", "description": "optional", "date": "optional" }] }
- flowDiagram: { "type": "flowDiagram", "nodes": [{ "id": "a", "label": "A" }], "edges": [{ "source": "a", "target": "b", "label": "optional" }] }
- sliderSimulator: { "type": "sliderSimulator", "title": "string", "description": "optional", "inputs": [{ "id": "x", "label": "X", "min": 0, "max": 100, "step": 1, "defaultValue": 50 }], "outputs": [{ "label": "Result", "formula": "x * 2" }] }
- formulaBlock: { "type": "formulaBlock", "title": "optional", "formula": "X(e^{j omega}) = ...", "description": "optional", "variables": [{ "symbol": "omega", "meaning": "angular frequency", "unit": "rad/sample" }] }
- formulaDerivation: { "type": "formulaDerivation", "title": "optional", "steps": [{ "label": "Step 1", "expression": "y[n] = ...", "explanation": "optional" }] }
- signalPlot: { "type": "signalPlot", "signalType": "continuous | discrete", "data": [{ "x": 0, "y": 1 }], "title": "optional", "xLabel": "optional", "yLabel": "optional" }
- stemPlot: { "type": "stemPlot", "data": [{ "n": 0, "value": 1 }], "title": "optional", "nLabel": "optional", "valueLabel": "optional" }
- spectrumPlot: { "type": "spectrumPlot", "domain": "frequency | omega | normalized", "magnitude": [{ "x": 0, "value": 1 }], "phase": [{ "x": 0, "value": 0 }], "showMagnitude": true, "showPhase": true }
- complexPlane: { "type": "complexPlane", "points": [{ "re": 0.5, "im": 0.5, "label": "z1", "kind": "vector" }], "showUnitCircle": true }
- poleZeroPlot: { "type": "poleZeroPlot", "poles": [{ "re": 0.7, "im": 0.2 }], "zeros": [{ "re": 0, "im": 0 }], "showUnitCircle": true, "stabilityNote": "optional" }
- convolutionVisualizer: { "type": "convolutionVisualizer", "x": [{ "n": 0, "value": 1 }], "h": [{ "n": 0, "value": 1 }], "y": "optional computed sequence", "explanation": "optional" }
- transformPairCard: { "type": "transformPairCard", "timeExpression": "x[n]", "transformExpression": "X(z)", "conditions": "optional", "notes": "optional" }
- confusionMatrix: { "type": "confusionMatrix", "labels": ["cat", "dog"], "matrix": [[8, 2], [1, 9]], "normalize": false, "notes": "optional" }
- lossCurve: { "type": "lossCurve", "data": [{ "epoch": 1, "trainLoss": 0.8, "valLoss": 0.9, "trainMetric": 0.7, "valMetric": 0.65 }] }
- decisionBoundary: { "type": "decisionBoundary", "points": [{ "x": 0, "y": 1, "label": "A" }], "regions": [{ "label": "A", "colorHint": "blue", "polygon": [{ "x": -1, "y": -1 }, { "x": 0, "y": 1 }, { "x": -1, "y": 1 }] }] }
- clusterPlot: { "type": "clusterPlot", "points": [{ "x": 1, "y": 2, "cluster": "A" }], "centroids": [{ "x": 1.5, "y": 2.5, "cluster": "A" }] }
- featureImportance: { "type": "featureImportance", "features": [{ "name": "age", "importance": 0.42, "description": "optional" }] }
- modelPipeline: { "type": "modelPipeline", "stages": [{ "id": "data", "label": "Data", "kind": "data" }], "edges": [{ "source": "data", "target": "model" }] }
- modelPipeline stage kind values: data | preprocess | feature | model | evaluation | deployment. Do not use generic values like process or output.
- neuralNetworkDiagram: { "type": "neuralNetworkDiagram", "layers": [{ "id": "input", "label": "Input", "units": 4, "activation": "linear" }] }
- transformerBlockDiagram: { "type": "transformerBlockDiagram", "blocks": [{ "label": "Multi-head attention", "description": "optional" }], "showResiduals": true }
- attentionMap: { "type": "attentionMap", "tokens": ["The", "cat"], "weights": [[1, 0.2], [0.3, 1]], "headLabel": "Head 1" }
- tokenFlow: { "type": "tokenFlow", "steps": [{ "label": "Tokenize", "description": "optional", "tokens": ["hello", "world"] }] }
- embeddingPlot: { "type": "embeddingPlot", "points": [{ "x": 0.1, "y": 0.2, "label": "king", "group": "royalty" }], "notes": "optional" }
- ragPipeline: { "type": "ragPipeline", "stages": [{ "id": "query", "label": "User query" }], "edges": [{ "source": "query", "target": "retrieve" }], "notes": "optional" }
- agentWorkflow: { "type": "agentWorkflow", "agents": [{ "id": "planner", "name": "Planner" }], "steps": [{ "id": "plan", "label": "Plan", "agentId": "planner" }], "edges": [{ "source": "plan", "target": "act" }] }

For sliderSimulator formulas, use only numbers, input variable IDs, +, -, *, /, ^ operators, and parentheses.
For all formulas, provide inert formula strings only. Do not include JavaScript functions or executable code.
Return exactly:
\`\`\`json
{ ...valid artifact JSON... }
\`\`\``
}

export function buildGenerativeUiCorrectionPrompt(errorMessage: string): string {
  return `The JSON artifact failed validation. Fix the JSON to match the schema. Return only one fenced json codeblock. Error: ${errorMessage}. Unsupported component types must be replaced with one of: ${GENERATIVE_UI_COMPONENT_LIST}. For modelPipeline stage kinds, use only: data, preprocess, feature, model, evaluation, deployment. Replace generic kinds like process with the closest valid value, and replace output with deployment unless the stage clearly fits another allowed kind. Do not generate React code, JavaScript functions, raw HTML, theme fields, or styling metadata.`
}

const GENERATIVE_UI_COMPONENT_LIST = GENERATIVE_UI_PROMPT_COMPONENT_TYPES.join(', ')

function findUnsupportedNodeTypes(value: unknown, locator?: JsonPathLocator): string[] {
  const errors: string[] = []
  walkNode((value as { layout?: unknown })?.layout, 'layout', errors, locator)
  return errors
}

function walkNode(
  value: unknown,
  path: string,
  errors: string[],
  locator?: JsonPathLocator
): void {
  if (!value || typeof value !== 'object') return
  const node = value as Record<string, unknown>

  if (typeof node.type === 'string' && !GENERATIVE_UI_COMPONENT_TYPE_SET.has(node.type)) {
    errors.push(
      formatValidationError(`${path}.type`, `is unsupported: ${JSON.stringify(node.type)}`, locator)
    )
    return
  }

  const children = node.children
  if (Array.isArray(children)) {
    children.forEach((child, index) =>
      walkNode(child, `${path}.children[${index}]`, errors, locator)
    )
  }

  const tabs = node.tabs
  if (Array.isArray(tabs)) {
    tabs.forEach((tab, tabIndex) => {
      const tabChildren = (tab as Record<string, unknown>)?.children
      if (Array.isArray(tabChildren)) {
        tabChildren.forEach((child, index) =>
          walkNode(child, `${path}.tabs[${tabIndex}].children[${index}]`, errors, locator)
        )
      }
    })
  }

  const items = node.items
  if (Array.isArray(items)) {
    items.forEach((item, itemIndex) => {
      const itemChildren = (item as Record<string, unknown>)?.children
      if (Array.isArray(itemChildren)) {
        itemChildren.forEach((child, index) =>
          walkNode(child, `${path}.items[${itemIndex}].children[${index}]`, errors, locator)
        )
      }
    })
  }
}

type JsonPathLocation = {
  line: number
  column: number
  context: string
}

type JsonPathLocator = Map<string, JsonPathLocation>

function formatValidationError(path: string, message: string, locator?: JsonPathLocator): string {
  const location = locator?.get(path) ?? locator?.get(`artifact.${path}`)
  if (!location) {
    return `${path}: ${message}`
  }
  return `${path}: ${message} (line ${location.line}, col ${location.column})\n${location.context}`
}

function buildJsonPathLocator(text: string): JsonPathLocator {
  const locator: JsonPathLocator = new Map()
  const lineStarts = computeLineStarts(text)
  let index = 0

  function skipWhitespace(): void {
    while (index < text.length && /\s/.test(text[index]!)) {
      index += 1
    }
  }

  function getLineAndColumn(offset: number): { line: number; column: number } {
    let low = 0
    let high = lineStarts.length - 1
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const start = lineStarts[mid]!
      const nextStart = mid + 1 < lineStarts.length ? lineStarts[mid + 1]! : text.length + 1
      if (offset < start) {
        high = mid - 1
      } else if (offset >= nextStart) {
        low = mid + 1
      } else {
        return { line: mid + 1, column: offset - start + 1 }
      }
    }
    return { line: 1, column: 1 }
  }

  function buildContext(line: number): string {
    const startLine = Math.max(1, line - 2)
    const endLine = Math.min(lineStarts.length, line + 2)
    const lines = text.split('\n')
    return lines
      .slice(startLine - 1, endLine)
      .map((content, offset) => {
        const currentLine = startLine + offset
        const marker = currentLine === line ? '>' : ' '
        return `${marker}${String(currentLine).padStart(4, ' ')} | ${content}`
      })
      .join('\n')
  }

  function record(path: string, offset: number): void {
    const { line, column } = getLineAndColumn(offset)
    locator.set(path, {
      line,
      column,
      context: buildContext(line)
    })
  }

  function parseString(): string {
    if (text[index] !== '"') throw new Error('Expected string')
    index += 1
    let value = ''
    while (index < text.length) {
      const char = text[index]!
      if (char === '\\') {
        value += char
        index += 1
        if (index < text.length) {
          value += text[index]!
          index += 1
        }
        continue
      }
      if (char === '"') {
        index += 1
        return value
      }
      value += char
      index += 1
    }
    throw new Error('Unterminated string')
  }

  function parsePrimitive(): void {
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|^(?:true|false|null)/)
    if (!match?.[0]) throw new Error('Expected primitive')
    index += match[0].length
  }

  function parseValue(path: string): void {
    skipWhitespace()
    record(path, index)
    const char = text[index]
    if (char === '{') {
      parseObject(path)
      return
    }
    if (char === '[') {
      parseArray(path)
      return
    }
    if (char === '"') {
      parseString()
      return
    }
    parsePrimitive()
  }

  function parseObject(path: string): void {
    if (text[index] !== '{') throw new Error('Expected object')
    index += 1
    skipWhitespace()
    if (text[index] === '}') {
      index += 1
      return
    }
    while (index < text.length) {
      skipWhitespace()
      const keyOffset = index
      const key = parseString()
      const childPath = path ? `${path}.${key}` : key
      record(childPath, keyOffset)
      skipWhitespace()
      if (text[index] !== ':') throw new Error('Expected colon')
      index += 1
      parseValue(childPath)
      skipWhitespace()
      if (text[index] === '}') {
        index += 1
        return
      }
      if (text[index] !== ',') throw new Error('Expected comma')
      index += 1
    }
    throw new Error('Unterminated object')
  }

  function parseArray(path: string): void {
    if (text[index] !== '[') throw new Error('Expected array')
    index += 1
    skipWhitespace()
    if (text[index] === ']') {
      index += 1
      return
    }
    let itemIndex = 0
    while (index < text.length) {
      parseValue(`${path}[${itemIndex}]`)
      itemIndex += 1
      skipWhitespace()
      if (text[index] === ']') {
        index += 1
        return
      }
      if (text[index] !== ',') throw new Error('Expected comma')
      index += 1
    }
    throw new Error('Unterminated array')
  }

  try {
    parseValue('artifact')
  } catch {
    return locator
  }

  return locator
}

function computeLineStarts(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') {
      starts.push(i + 1)
    }
  }
  return starts
}

function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let index = start; index < input.length; index += 1) {
    const char = input[index]
    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      escape = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) {
      return input.slice(start, index + 1).trim()
    }
  }

  return null
}

function canParseJson(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

const GENERATIVE_UI_COMPONENT_TYPE_SET = new Set<string>(GENERATIVE_UI_COMPONENT_TYPES)
