import { UINode } from "../../../lib/schema";
import { RenderNodeFn } from "../registry";

export function CardNode({ node, renderNode }: { node: Extract<UINode, { type: "card" }>; renderNode: RenderNodeFn }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-950 shadow-sm">
      {node.title ? <h4 className="font-display text-xl font-extrabold">{node.title}</h4> : null}
      {node.body ? <p className="mt-2 leading-relaxed text-slate-600">{node.body}</p> : null}
      {node.children?.length ? <div className="mt-3 space-y-2">{node.children.map((child, index) => renderNode(child, index))}</div> : null}
    </div>
  );
}
