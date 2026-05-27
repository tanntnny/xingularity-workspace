import { useState } from "react";
import { UINode } from "../../../lib/schema";
import { RenderNodeFn } from "../registry";

export function AccordionNode({ node, renderNode }: { node: Extract<UINode, { type: "accordion" }>; renderNode: RenderNodeFn }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {node.items.map((item, index) => (
        <div key={item.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950">
          <button className="flex w-full items-center justify-between px-4 py-3 text-left font-extrabold" onClick={() => setOpen(open === index ? null : index)}>
            {item.title}
            <span>{open === index ? "-" : "+"}</span>
          </button>
          {open === index ? <div className="space-y-2 border-t border-slate-100 p-3">{item.children.map((child, childIndex) => renderNode(child, childIndex))}</div> : null}
        </div>
      ))}
    </div>
  );
}
