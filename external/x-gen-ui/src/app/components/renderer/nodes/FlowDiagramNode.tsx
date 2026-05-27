import ReactFlow, { Background, Controls, Edge, MarkerType, Node } from "reactflow";
import { UINode } from "../../../lib/schema";

export function FlowDiagramNode({ node }: { node: Extract<UINode, { type: "flowDiagram" }> }) {
  const nodes: Node[] = node.nodes.map((flowNode, index) => ({
    id: flowNode.id,
    data: { label: flowNode.label },
    position: { x: (index % 3) * 220, y: Math.floor(index / 3) * 120 },
  }));

  const edges: Edge[] = node.edges.map((edge, index) => ({
    id: `${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 2 },
  }));

  return (
    <div className="h-80 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
