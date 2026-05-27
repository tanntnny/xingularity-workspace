import { UINode } from "../../../lib/schema";

export function TimelineNode({ node }: { node: Extract<UINode, { type: "timeline" }> }) {
  return (
    <div className="space-y-2">
      {node.items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 text-slate-950">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-3 w-3 rounded-full bg-slate-950" />
            {index < node.items.length - 1 ? <span className="mt-1 h-full min-h-10 w-px bg-slate-300" /> : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {item.date ? <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{item.date}</p> : null}
            <p className="font-extrabold">{item.title}</p>
            {item.description ? <p className="mt-1 text-slate-600">{item.description}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
