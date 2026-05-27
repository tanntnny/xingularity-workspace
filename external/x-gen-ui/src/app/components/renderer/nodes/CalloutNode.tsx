import { UINode } from "../../../lib/schema";
import { cn } from "../../../lib/cn";

const tones = {
  info: "border-blue-200 bg-blue-50 text-blue-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  danger: "border-rose-200 bg-rose-50 text-rose-950",
};

export function CalloutNode({ node }: { node: Extract<UINode, { type: "callout" }> }) {
  return (
    <div className={cn("rounded-xl border p-4", tones[node.tone ?? "info"])}>
      {node.title ? <p className="font-extrabold">{node.title}</p> : null}
      <p className="mt-1 leading-relaxed">{node.body}</p>
    </div>
  );
}
