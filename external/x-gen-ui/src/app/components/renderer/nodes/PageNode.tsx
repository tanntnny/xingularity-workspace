import { UINode } from "../../../lib/schema";
import { RenderNodeFn } from "../registry";

export function PageNode({ node, renderNode }: { node: Extract<UINode, { type: "page" }>; renderNode: RenderNodeFn }) {
  return <div className="space-y-3">{node.children.map((child, index) => renderNode(child, index))}</div>;
}
