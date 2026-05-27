import { UINode } from "../../../lib/schema";
import { cn } from "../../../lib/cn";
import { RenderNodeFn } from "../registry";

const gridClasses = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

export function GridNode({ node, renderNode }: { node: Extract<UINode, { type: "grid" }>; renderNode: RenderNodeFn }) {
  return <div className={cn("grid gap-3", gridClasses[node.columns ?? 2])}>{node.children.map((child, index) => renderNode(child, index))}</div>;
}
