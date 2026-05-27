import { useState } from "react";
import { UINode } from "../../../lib/schema";
import { cn } from "../../../lib/cn";
import { RenderNodeFn } from "../registry";

export function TabsNode({ node, renderNode }: { node: Extract<UINode, { type: "tabs" }>; renderNode: RenderNodeFn }) {
  const [active, setActive] = useState(0);
  const activeTab = node.tabs[active] ?? node.tabs[0];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-slate-950">
      <div className="flex flex-wrap gap-2">
        {node.tabs.map((tab, index) => (
          <button key={tab.label} onClick={() => setActive(index)} className={cn("rounded-xl px-3 py-2 text-sm font-extrabold", index === active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2">{activeTab?.children.map((child, index) => renderNode(child, index))}</div>
    </div>
  );
}
