import type { GenerativeUiArtifact } from '../../../shared/generativeUi'

export const generativeUiSampleArtifacts: GenerativeUiArtifact[] = [
  {
    version: '2.0',
    metadata: {
      title: 'Revenue Quality Dashboard',
      description: 'Interactive dashboard for inspecting acquisition channels.',
      tags: ['dashboard', 'sample']
    },
    layout: {
      type: 'page',
      children: [
        { type: 'text', variant: 'heading', body: 'Channel Quality Review' },
        {
          type: 'grid',
          columns: 3,
          children: [
            { type: 'card', title: 'Pipeline', body: '$420k qualified' },
            { type: 'card', title: 'Conversion', body: '18.4% trial to paid' },
            {
              type: 'callout',
              tone: 'success',
              title: 'Signal',
              body: 'Partner traffic has the highest retained revenue.'
            }
          ]
        },
        {
          type: 'chart',
          chartType: 'bar',
          xKey: 'channel',
          yKey: 'revenue',
          data: [
            { channel: 'Search', revenue: 120 },
            { channel: 'Partner', revenue: 180 },
            { channel: 'Social', revenue: 72 },
            { channel: 'Email', revenue: 96 }
          ]
        },
        {
          type: 'tabs',
          tabs: [
            {
              label: 'Actions',
              children: [
                {
                  type: 'text',
                  body: 'Shift budget toward partner programs and search retargeting.'
                },
                {
                  type: 'table',
                  columns: ['channel', 'priority'],
                  rows: [
                    { channel: 'Partner', priority: 'High' },
                    { channel: 'Social', priority: 'Low' }
                  ]
                }
              ]
            },
            {
              label: 'Risks',
              children: [
                {
                  type: 'callout',
                  tone: 'warning',
                  body: 'Attribution is incomplete for 11% of partner leads.'
                }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    version: '2.0',
    metadata: {
      title: 'Learning Loop Explainer',
      description: 'Study UI with quiz, accordion, timeline, and flow diagram.',
      tags: ['study', 'quiz', 'flow']
    },
    layout: {
      type: 'page',
      children: [
        {
          type: 'section',
          title: 'How Retrieval-Augmented Generation Works',
          description: 'A compact conceptual artifact.',
          children: [
            {
              type: 'flowDiagram',
              nodes: [
                { id: 'query', label: 'Query' },
                { id: 'retrieve', label: 'Retrieve' },
                { id: 'rank', label: 'Rank' },
                { id: 'answer', label: 'Answer' }
              ],
              edges: [
                { source: 'query', target: 'retrieve' },
                { source: 'retrieve', target: 'rank' },
                { source: 'rank', target: 'answer' }
              ]
            },
            {
              type: 'accordion',
              items: [
                {
                  title: 'Retrieval',
                  children: [
                    {
                      type: 'text',
                      body: 'Find candidate documents with lexical, vector, or hybrid search.'
                    }
                  ]
                },
                {
                  title: 'Grounding',
                  children: [
                    { type: 'text', body: 'Use retrieved context to constrain the answer.' }
                  ]
                }
              ]
            },
            {
              type: 'quiz',
              questions: [
                {
                  question: 'Why avoid arbitrary code execution in generated artifacts?',
                  choices: ['It is slower', 'It reduces security risk', 'It removes styling'],
                  answerIndex: 1,
                  explanation: 'Schema rendering treats model output as data, not executable code.'
                }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    version: '2.0',
    metadata: {
      title: 'Pricing Simulator',
      description: 'Safe formula demo using slider inputs.',
      tags: ['simulator', 'sample']
    },
    layout: {
      type: 'page',
      children: [
        {
          type: 'sliderSimulator',
          title: 'Monthly Revenue Model',
          description: 'Adjust acquisition and pricing assumptions.',
          inputs: [
            { id: 'users', label: 'Users', min: 100, max: 10000, step: 100, defaultValue: 2500 },
            { id: 'price', label: 'Price', min: 5, max: 99, step: 1, defaultValue: 29 },
            {
              id: 'conversion',
              label: 'Conversion %',
              min: 1,
              max: 20,
              step: 1,
              defaultValue: 7
            }
          ],
          outputs: [{ label: 'MRR', formula: 'users * price * conversion / 100' }]
        }
      ]
    }
  },
  {
    version: '2.0',
    metadata: {
      title: 'Fourier Transform Study UI',
      description: 'Signal and spectrum views for a simple transform pair.',
      tags: ['signal-processing', 'fourier']
    },
    layout: {
      type: 'page',
      children: [
        {
          type: 'formulaBlock',
          title: 'Discrete-time Fourier transform',
          formula: 'X(e^{j omega}) = sum_{n=-infty}^{infty} x[n] e^{-j omega n}',
          description: 'The DTFT maps a discrete sequence into a continuous frequency response.',
          variables: [
            { symbol: 'x[n]', meaning: 'input sequence' },
            { symbol: 'omega', meaning: 'digital angular frequency', unit: 'rad/sample' }
          ]
        },
        {
          type: 'signalPlot',
          title: 'Windowed cosine',
          signalType: 'discrete',
          xLabel: 'n',
          yLabel: 'x[n]',
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 0.71 },
            { x: 2, y: 1 },
            { x: 3, y: 0.71 },
            { x: 4, y: 0 },
            { x: 5, y: -0.71 },
            { x: 6, y: -1 },
            { x: 7, y: -0.71 }
          ]
        },
        {
          type: 'stemPlot',
          title: 'Impulse response samples',
          nLabel: 'n',
          valueLabel: 'h[n]',
          data: [
            { n: 0, value: 1 },
            { n: 1, value: 0.5 },
            { n: 2, value: 0.25 },
            { n: 3, value: 0.125 },
            { n: 4, value: 0.06 }
          ]
        },
        {
          type: 'convolutionVisualizer',
          title: 'Short convolution example',
          x: [
            { n: 0, value: 1 },
            { n: 1, value: 2 },
            { n: 2, value: 1 }
          ],
          h: [
            { n: 0, value: 1 },
            { n: 1, value: -1 }
          ],
          explanation:
            'The app computes y[n] safely from the supplied sequences when the output is omitted.'
        },
        {
          type: 'spectrumPlot',
          title: 'Magnitude and phase spectrum',
          domain: 'omega',
          xLabel: 'omega',
          magnitude: [
            { x: -3.14, value: 0.1 },
            { x: -1.57, value: 1 },
            { x: 0, value: 0.1 },
            { x: 1.57, value: 1 },
            { x: 3.14, value: 0.1 }
          ],
          phase: [
            { x: -3.14, value: 0 },
            { x: -1.57, value: -1.57 },
            { x: 0, value: 0 },
            { x: 1.57, value: 1.57 },
            { x: 3.14, value: 0 }
          ]
        },
        {
          type: 'transformPairCard',
          title: 'Canonical pair',
          timeExpression: 'a^n u[n]',
          transformExpression: '1 / (1 - a z^{-1})',
          conditions: '|z| > |a|',
          notes: 'Useful bridge between time-domain decay and transform-domain poles.'
        },
        {
          type: 'quiz',
          questions: [
            {
              question: 'What does a sharp spectrum peak usually indicate?',
              choices: ['A dominant frequency', 'A missing sample', 'A nonlinear activation'],
              answerIndex: 0,
              explanation: 'Large magnitude at a frequency indicates strong sinusoidal content.'
            }
          ]
        }
      ]
    }
  },
  {
    version: '2.0',
    metadata: {
      title: 'Z-Transform Pole Zero UI',
      description: 'Pole-zero stability and derivation walkthrough.',
      tags: ['z-transform', 'poles']
    },
    layout: {
      type: 'page',
      children: [
        {
          type: 'poleZeroPlot',
          title: 'System poles and zeros',
          poles: [
            { re: 0.72, im: 0.25, label: 'p1' },
            { re: 0.72, im: -0.25, label: 'p2' }
          ],
          zeros: [{ re: 0, im: 0, label: 'z0' }],
          showUnitCircle: true,
          stabilityNote: 'Poles are inside the unit circle, so this causal IIR example is stable.'
        },
        {
          type: 'complexPlane',
          title: 'Reference phasors',
          showUnitCircle: true,
          points: [
            { label: 'e^{j omega}', re: 0.71, im: 0.71, kind: 'vector' },
            { label: 'root', re: -0.5, im: 0.5, kind: 'root' }
          ]
        },
        {
          type: 'formulaDerivation',
          title: 'Geometric sequence transform',
          steps: [
            { label: 'Sequence', expression: 'x[n] = a^n u[n]' },
            { label: 'Definition', expression: 'X(z) = sum_{n=0}^{infty} a^n z^{-n}' },
            {
              label: 'Closed form',
              expression: 'X(z) = 1 / (1 - a z^{-1})',
              explanation: 'Valid outside the pole radius.'
            }
          ]
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Stability rule',
          body: 'For a causal LTI system, all poles must lie inside the unit circle.'
        }
      ]
    }
  },
  {
    version: '2.0',
    metadata: {
      title: 'K-Means Clustering Visual UI',
      description: 'Cluster assignments, centroids, and pipeline stages.',
      tags: ['ml', 'clustering']
    },
    layout: {
      type: 'page',
      children: [
        {
          type: 'clusterPlot',
          title: 'Two-cluster embedding',
          xLabel: 'feature 1',
          yLabel: 'feature 2',
          points: [
            { x: 1, y: 1, cluster: 'A' },
            { x: 1.4, y: 1.2, cluster: 'A' },
            { x: 4, y: 4.2, cluster: 'B' },
            { x: 4.4, y: 3.8, cluster: 'B' }
          ],
          centroids: [
            { x: 1.2, y: 1.1, cluster: 'A' },
            { x: 4.2, y: 4, cluster: 'B' }
          ]
        },
        {
          type: 'modelPipeline',
          title: 'K-means workflow',
          stages: [
            { id: 'scale', label: 'Scale features', kind: 'preprocess' },
            { id: 'init', label: 'Initialize centroids', kind: 'model' },
            { id: 'assign', label: 'Assign clusters', kind: 'model' },
            { id: 'update', label: 'Update centroids', kind: 'evaluation' }
          ]
        },
        {
          type: 'table',
          columns: ['cluster', 'centroid', 'interpretation'],
          rows: [
            { cluster: 'A', centroid: '(1.2, 1.1)', interpretation: 'low-value group' },
            { cluster: 'B', centroid: '(4.2, 4.0)', interpretation: 'high-value group' }
          ]
        },
        {
          type: 'quiz',
          questions: [
            {
              question: 'What does K-means minimize?',
              choices: ['Within-cluster squared distance', 'Cross-entropy', 'Attention entropy'],
              answerIndex: 0
            }
          ]
        }
      ]
    }
  },
  {
    version: '2.0',
    metadata: {
      title: 'Classification Metrics UI',
      description: 'Metrics and decision regions for a classifier.',
      tags: ['classification', 'metrics']
    },
    layout: {
      type: 'page',
      children: [
        {
          type: 'confusionMatrix',
          title: 'Validation confusion matrix',
          labels: ['cat', 'dog'],
          matrix: [
            [42, 6],
            [4, 48]
          ],
          normalize: true,
          notes: 'Rows are actual labels; columns are predicted labels.'
        },
        {
          type: 'lossCurve',
          title: 'Training curve',
          data: [
            { epoch: 1, trainLoss: 0.9, valLoss: 1.0 },
            { epoch: 2, trainLoss: 0.62, valLoss: 0.72 },
            { epoch: 3, trainLoss: 0.45, valLoss: 0.55 },
            { epoch: 4, trainLoss: 0.35, valLoss: 0.5 }
          ]
        },
        {
          type: 'decisionBoundary',
          title: 'Decision regions',
          points: [
            { x: 0.8, y: 1.1, label: 'cat' },
            { x: 1.2, y: 0.7, label: 'cat' },
            { x: 3.6, y: 3.8, label: 'dog' },
            { x: 4.1, y: 3.2, label: 'dog' }
          ],
          regions: [
            {
              label: 'cat',
              colorHint: 'blue',
              polygon: [
                { x: 0, y: 0 },
                { x: 2.4, y: 0 },
                { x: 2.4, y: 5 },
                { x: 0, y: 5 }
              ]
            },
            {
              label: 'dog',
              colorHint: 'orange',
              polygon: [
                { x: 2.4, y: 0 },
                { x: 5, y: 0 },
                { x: 5, y: 5 },
                { x: 2.4, y: 5 }
              ]
            }
          ]
        },
        {
          type: 'featureImportance',
          title: 'Feature importance',
          features: [
            { name: 'edge contrast', importance: 0.42 },
            { name: 'texture score', importance: 0.31 },
            { name: 'shape ratio', importance: 0.18 }
          ]
        }
      ]
    }
  },
  {
    version: '2.0',
    metadata: {
      title: 'Transformer Attention UI',
      description: 'Transformer block and attention-map explainer.',
      tags: ['transformer', 'attention']
    },
    layout: {
      type: 'page',
      children: [
        {
          type: 'transformerBlockDiagram',
          title: 'Transformer decoder block',
          showResiduals: true,
          blocks: [
            { label: 'Input embeddings' },
            { label: 'Masked multi-head attention' },
            { label: 'Add and norm' },
            { label: 'Feed-forward network' },
            { label: 'Add and norm' }
          ],
          notes: 'Each sublayer is wrapped by a residual connection and normalization.'
        },
        {
          type: 'attentionMap',
          title: 'Attention head',
          headLabel: 'Head 3',
          tokens: ['The', 'signal', 'peaks'],
          weights: [
            [0.7, 0.2, 0.1],
            [0.2, 0.65, 0.15],
            [0.1, 0.35, 0.55]
          ]
        },
        {
          type: 'tokenFlow',
          title: 'Token processing flow',
          steps: [
            { label: 'Prompt', tokens: ['The', 'signal', 'peaks'] },
            { label: 'Embeddings', description: 'Tokens become dense vectors.' },
            { label: 'Transformer', description: 'Attention mixes contextual information.' },
            { label: 'Logits', description: 'Next-token scores are produced.' }
          ]
        },
        {
          type: 'neuralNetworkDiagram',
          title: 'Classifier head',
          layers: [
            { id: 'input', label: 'Hidden state', units: 6 },
            { id: 'dense', label: 'Dense', units: 4, activation: 'GELU' },
            { id: 'out', label: 'Logits', units: 3, activation: 'linear' }
          ]
        }
      ]
    }
  },
  {
    version: '2.0',
    metadata: {
      title: 'RAG Agent Workflow UI',
      description: 'Retrieval-augmented generation and agent loop.',
      tags: ['rag', 'agents']
    },
    layout: {
      type: 'page',
      children: [
        {
          type: 'ragPipeline',
          title: 'RAG pipeline',
          stages: [
            { id: 'query', label: 'User query' },
            { id: 'embed', label: 'Embed query' },
            { id: 'search', label: 'Vector search' },
            { id: 'rerank', label: 'Rerank' },
            { id: 'answer', label: 'Answer with citations' }
          ],
          notes: 'The generator receives retrieved context rather than arbitrary hidden knowledge.'
        },
        {
          type: 'agentWorkflow',
          title: 'Research agent loop',
          agents: [
            { id: 'planner', name: 'Planner', role: 'decomposes task' },
            { id: 'researcher', name: 'Researcher', role: 'collects evidence' }
          ],
          steps: [
            { id: 'plan', label: 'Plan', agentId: 'planner' },
            { id: 'retrieve', label: 'Retrieve', agentId: 'researcher' },
            { id: 'critique', label: 'Critique evidence', agentId: 'planner' },
            { id: 'respond', label: 'Respond', agentId: 'researcher' }
          ],
          edges: [
            { source: 'plan', target: 'retrieve' },
            { source: 'retrieve', target: 'critique' },
            { source: 'critique', target: 'respond' }
          ]
        },
        {
          type: 'embeddingPlot',
          title: 'Embedding neighborhood',
          points: [
            { x: 0.1, y: 0.2, label: 'query', group: 'query' },
            { x: 0.2, y: 0.3, label: 'doc A', group: 'relevant' },
            { x: 0.25, y: 0.35, label: 'doc B', group: 'relevant' },
            { x: 0.85, y: 0.8, label: 'doc C', group: 'distant' }
          ],
          notes: 'Nearby points indicate semantic similarity in this simplified projection.'
        },
        {
          type: 'callout',
          tone: 'warning',
          title: 'Grounding check',
          body: 'The app renders JSON data only. It does not call an LLM API or execute generated code.'
        }
      ]
    }
  }
]
