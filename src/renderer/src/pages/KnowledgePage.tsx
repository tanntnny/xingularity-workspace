import { ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useViewport
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import * as d3 from 'd3'
import { Sparkles } from 'lucide-react'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3'
import type { NoteListItem } from '../../../shared/types'
import { buildKnowledgeGraph } from '../lib/knowledgeGraph'

interface KnowledgePageProps {
  notes: NoteListItem[]
  onOpenNote: (relPath: string) => void
}

interface GraphNodeDatum extends SimulationNodeDatum {
  id: string
  relPath: string
  label: string
  degree: number
  isOrphan: boolean
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  targetX?: number
  targetY?: number
}

interface GraphLinkDatum extends SimulationLinkDatum<GraphNodeDatum> {
  source: string | GraphNodeDatum
  target: string | GraphNodeDatum
}

export function KnowledgePage({ notes, onOpenNote }: KnowledgePageProps): ReactElement {
  return (
    <ReactFlowProvider>
      <KnowledgeCanvas notes={notes} onOpenNote={onOpenNote} />
    </ReactFlowProvider>
  )
}

function KnowledgeCanvas({ notes, onOpenNote }: KnowledgePageProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const graph = useMemo(() => buildKnowledgeGraph(notes), [notes])
  const viewport = useViewport()

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const element = containerRef.current
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      })
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current) {
      return
    }

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    if (size.width === 0 || size.height === 0 || graph.nodes.length === 0) {
      return
    }

    const root = svg.attr('viewBox', `0 0 ${size.width} ${size.height}`).append('g')
    const centerX = size.width / 2
    const centerY = size.height / 2
    const outerRadius = Math.max(72, Math.min(size.width, size.height) / 2 - 72)
    const orphanNodes = graph.nodes.filter((node) => node.isOrphan)

    const simulationNodes: GraphNodeDatum[] = graph.nodes.map((node, index) => {
      const angle = (index / Math.max(graph.nodes.length, 1)) * Math.PI * 2
      const orphanIndex = orphanNodes.findIndex((orphanNode) => orphanNode.id === node.id)
      const isOrphan = orphanIndex >= 0
      const radius = isOrphan ? outerRadius : 48 + (index % 7) * 18
      const positionedAngle = isOrphan
        ? (orphanIndex / Math.max(orphanNodes.length, 1)) * Math.PI * 2 - Math.PI / 2
        : angle
      const x = centerX + Math.cos(positionedAngle) * radius
      const y = centerY + Math.sin(positionedAngle) * radius
      return {
        ...node,
        x,
        y,
        targetX: isOrphan ? x : centerX,
        targetY: isOrphan ? y : centerY
      }
    })

    const simulationLinks: GraphLinkDatum[] = graph.links.map((link) => ({
      source: link.source,
      target: link.target
    }))

    const linkSelection = root
      .append('g')
      .attr('stroke', 'var(--line-strong)')
      .attr('stroke-opacity', 0.5)
      .selectAll('line')
      .data(simulationLinks)
      .join('line')
      .attr('stroke-width', 1.25)

    const nodeSelection = root
      .append('g')
      .attr('stroke', 'var(--panel)')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(simulationNodes)
      .join('circle')
      .attr('r', (node) => 5 + Math.min(node.degree, 6))
      .attr('fill', (node) => (node.isOrphan ? 'var(--muted)' : 'var(--accent)'))
      .attr('fill-opacity', (node) => (node.isOrphan ? 0.72 : 0.92))
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .on('click', (_event, node) => {
        onOpenNote(node.relPath)
      })

    nodeSelection.append('title').text((node) => `${node.label}\n${node.relPath}`)

    const labelSelection = root
      .append('g')
      .selectAll('text')
      .data(simulationNodes)
      .join('text')
      .attr('fill', 'var(--text)')
      .attr('font-size', 12)
      .attr('font-weight', 500)
      .attr('text-anchor', 'middle')
      .attr('paint-order', 'stroke')
      .attr('stroke', 'var(--panel)')
      .attr('stroke-width', 4)
      .attr('stroke-linejoin', 'round')
      .style('pointer-events', 'none')
      .text((node) => node.label)

    const simulation = d3
      .forceSimulation(simulationNodes)
      .force(
        'link',
        d3
          .forceLink<GraphNodeDatum, GraphLinkDatum>(simulationLinks)
          .id((node) => node.id)
          .distance(72)
          .strength(0.6)
      )
      .force('charge', d3.forceManyBody<GraphNodeDatum>().strength(-220))
      .force(
        'x',
        d3
          .forceX<GraphNodeDatum>((node) => node.targetX ?? centerX)
          .strength((node) => (node.isOrphan ? 0.42 : 0.035))
      )
      .force(
        'y',
        d3
          .forceY<GraphNodeDatum>((node) => node.targetY ?? centerY)
          .strength((node) => (node.isOrphan ? 0.42 : 0.035))
      )
      .force(
        'collision',
        d3
          .forceCollide<GraphNodeDatum>()
          .radius((node) => (node.isOrphan ? 24 : 16 + node.degree * 2))
      )
      .on('tick', () => {
        linkSelection
          .attr('x1', (link) => (link.source as GraphNodeDatum).x ?? 0)
          .attr('y1', (link) => (link.source as GraphNodeDatum).y ?? 0)
          .attr('x2', (link) => (link.target as GraphNodeDatum).x ?? 0)
          .attr('y2', (link) => (link.target as GraphNodeDatum).y ?? 0)

        nodeSelection.attr('cx', (node) => node.x ?? 0).attr('cy', (node) => node.y ?? 0)
        labelSelection
          .attr('x', (node) => node.x ?? 0)
          .attr('y', (node) => (node.y ?? 0) - (14 + Math.min(node.degree, 6)))
      })

    const drag = d3
      .drag<SVGCircleElement, GraphNodeDatum>()
      .on('start', (event, node) => {
        if (!event.active) {
          simulation.alphaTarget(0.18).restart()
        }
        node.fx = node.x
        node.fy = node.y
      })
      .on('drag', (event, node) => {
        node.fx = event.x
        node.fy = event.y
      })
      .on('end', (event, node) => {
        if (!event.active) {
          simulation.alphaTarget(0)
        }
        node.fx = null
        node.fy = null
      })

    nodeSelection.call(drag)

    return () => {
      simulation.stop()
    }
  }, [graph, onOpenNote, size.height, size.width])

  useEffect(() => {
    if (!svgRef.current) {
      return
    }

    d3.select(svgRef.current)
      .select('g')
      .attr('transform', `translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`)
  }, [viewport.x, viewport.y, viewport.zoom])

  const hasGraphNodes = graph.nodes.length > 0

  return (
    <div
      ref={containerRef}
      data-testid="knowledge-page"
      className="workspace-clear-surface relative h-full min-w-0 flex-1 overflow-hidden"
    >
      <ReactFlow
        data-testid="knowledge-canvas"
        nodes={[]}
        edges={[]}
        fitView={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnPinch
        zoomOnScroll
        panOnScroll
        panOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background
          id="knowledge-background"
          color="var(--accent)"
          gap={48}
          size={1.8}
          style={{ opacity: 0.24 }}
          variant={BackgroundVariant.Dots}
        />
      </ReactFlow>
      {hasGraphNodes ? (
        <svg
          ref={svgRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          role="img"
          aria-label="Knowledge graph"
        />
      ) : (
        <div
          data-testid="knowledge-empty-state"
          className="absolute inset-0 flex items-center justify-center p-10"
        >
          <div className="workspace-subtle-surface max-w-xl rounded-[32px] px-8 py-10 text-center shadow-[0_24px_64px_rgba(15,23,42,0.08)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Sparkles size={24} />
            </div>
            <h3 className="text-3xl font-semibold text-[var(--text)]">No note connections yet</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Link notes together with note mentions to populate the knowledge graph.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
