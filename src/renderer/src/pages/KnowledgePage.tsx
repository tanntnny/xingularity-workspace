import { ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, useViewport } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import * as d3 from 'd3'
import { EmptyState } from '../components/ui/empty-state'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3'
import type { CalendarTask, NoteListItem, Project, ResourceRef } from '../../../shared/types'
import {
  buildKnowledgeGraph,
  createKnowledgeGraphEntities,
  filterKnowledgeGraph,
  type KnowledgeEntityKind
} from '../lib/knowledgeGraph'
import { APP_PAGE_ICONS } from '../lib/pageIcons'
import type { WorkspaceViewport } from '../lib/workspaceTabs'

interface KnowledgePageProps {
  notes: NoteListItem[]
  onOpenNote: (relPath: string) => void
  projects?: Project[]
  tasks?: CalendarTask[]
  resources?: ResourceRef[]
  onOpenEntity?: (kind: KnowledgeEntityKind, id: string) => void
  orphanRingRadiusPx?: number | null
  showOrphans?: boolean
  initialViewport?: WorkspaceViewport | null
  onViewportChange?: (viewport: WorkspaceViewport) => void
}

interface GraphNodeDatum extends SimulationNodeDatum {
  id: string
  relPath: string
  label: string
  degree: number
  isOrphan: boolean
  kind?: 'note' | KnowledgeEntityKind
  entityId?: string
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

export function KnowledgePage({
  notes,
  onOpenNote,
  projects = [],
  tasks = [],
  resources = [],
  onOpenEntity,
  orphanRingRadiusPx = null,
  showOrphans = true,
  initialViewport = null,
  onViewportChange
}: KnowledgePageProps): ReactElement {
  return (
    <ReactFlowProvider>
      <KnowledgeCanvas
        notes={notes}
        onOpenNote={onOpenNote}
        projects={projects}
        tasks={tasks}
        resources={resources}
        onOpenEntity={onOpenEntity}
        orphanRingRadiusPx={orphanRingRadiusPx}
        showOrphans={showOrphans}
        initialViewport={initialViewport}
        onViewportChange={onViewportChange}
      />
    </ReactFlowProvider>
  )
}

function KnowledgeCanvas({
  notes,
  onOpenNote,
  projects = [],
  tasks = [],
  resources = [],
  onOpenEntity,
  orphanRingRadiusPx = null,
  showOrphans = true,
  initialViewport = null,
  onViewportChange
}: KnowledgePageProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const graph = useMemo(
    () => buildKnowledgeGraph(notes, createKnowledgeGraphEntities(projects, tasks, resources)),
    [notes, projects, resources, tasks]
  )
  const visibleGraph = useMemo(() => filterKnowledgeGraph(graph, showOrphans), [graph, showOrphans])
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

    if (size.width === 0 || size.height === 0 || visibleGraph.nodes.length === 0) {
      return
    }

    const root = svg.attr('viewBox', `0 0 ${size.width} ${size.height}`).append('g')
    const centerX = size.width / 2
    const centerY = size.height / 2
    const maxOuterRadius = Math.max(72, Math.min(size.width, size.height) / 2 - 72)
    const outerRadius =
      orphanRingRadiusPx == null
        ? maxOuterRadius
        : Math.min(maxOuterRadius, Math.max(72, orphanRingRadiusPx))
    const orphanNodes = visibleGraph.nodes.filter((node) => node.isOrphan)

    const simulationNodes: GraphNodeDatum[] = visibleGraph.nodes.map((node, index) => {
      const angle = (index / Math.max(visibleGraph.nodes.length, 1)) * Math.PI * 2
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

    const simulationLinks: GraphLinkDatum[] = visibleGraph.links.map((link) => ({
      source: link.source,
      target: link.target
    }))

    const linkSelection = root
      .append('g')
      .attr('stroke', 'var(--border)')
      .attr('stroke-opacity', 0.5)
      .selectAll('line')
      .data(simulationLinks)
      .join('line')
      .attr('stroke-width', 1.25)

    const nodeSelection = root
      .append('g')
      .attr('stroke', 'var(--card)')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(simulationNodes)
      .join('circle')
      .attr('r', (node) => 5 + Math.min(node.degree, 6))
      .attr('fill', (node) => (node.isOrphan ? 'var(--muted-foreground)' : 'var(--primary)'))
      .attr('fill-opacity', (node) => (node.isOrphan ? 0.72 : 0.92))
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .on('click', (_event, node) => {
        if (node.kind && node.entityId) {
          onOpenEntity?.(node.kind, node.entityId)
        } else {
          onOpenNote(node.relPath)
        }
      })

    nodeSelection.append('title').text((node) => `${node.label}\n${node.relPath}`)

    const labelSelection = root
      .append('g')
      .selectAll('text')
      .data(simulationNodes)
      .join('text')
      .attr('fill', 'var(--foreground)')
      .attr('font-size', 12)
      .attr('font-weight', 500)
      .attr('text-anchor', 'middle')
      .attr('paint-order', 'stroke')
      .attr('stroke', 'var(--card)')
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
  }, [onOpenEntity, onOpenNote, orphanRingRadiusPx, size.height, size.width, visibleGraph])

  useEffect(() => {
    if (!svgRef.current) {
      return
    }

    d3.select(svgRef.current)
      .select('g')
      .attr('transform', `translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`)
  }, [viewport.x, viewport.y, viewport.zoom])

  const hasGraphNodes = visibleGraph.nodes.length > 0

  return (
    <div
      ref={containerRef}
      data-testid="knowledge-page"
      className="bg-transparent relative h-full min-w-0 flex-1 overflow-hidden"
    >
      <ReactFlow
        data-testid="knowledge-canvas"
        nodes={[]}
        edges={[]}
        fitView={false}
        defaultViewport={initialViewport ?? undefined}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnPinch
        zoomOnScroll
        panOnScroll
        panOnDrag
        onMoveEnd={(_event, viewport) => onViewportChange?.(viewport)}
        proOptions={{ hideAttribution: true }}
      />
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
          <EmptyState
            className="max-w-xl"
            icon={APP_PAGE_ICONS.knowledge}
            title="No note connections yet"
            description={
              showOrphans
                ? 'Link notes together with note mentions to populate the knowledge graph.'
                : 'Show orphan notes to include disconnected notes in the knowledge graph.'
            }
          />
        </div>
      )}
    </div>
  )
}
