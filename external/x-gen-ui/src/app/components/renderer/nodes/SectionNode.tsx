import { UINode } from "../../../lib/schema";
import { RenderNodeFn } from "../registry";

export function SectionNode({ node, renderNode }: { node: Extract<UINode, { type: "section" }>; renderNode: RenderNodeFn }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white/70 p-4 text-slate-950">
      {node.title ? <h3 className="font-display text-2xl font-extrabold">{node.title}</h3> : null}
      {node.description ? <p className="mt-1 text-slate-600">{node.description}</p> : null}
      <div className="mt-3 space-y-3">{node.children.map((child, index) => renderNode(child, index))}</div>
    </section>
  );
}
