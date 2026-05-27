import { UINode } from "../../../lib/schema";
import { cn } from "../../../lib/cn";

export function TextNode({ node }: { node: Extract<UINode, { type: "text" }> }) {
  if (node.variant === "heading") {
    return <h3 className="font-display text-2xl font-extrabold tracking-tight">{node.body}</h3>;
  }
  return <p className={cn("leading-relaxed", node.variant === "muted" && "text-slate-500", node.variant === "caption" && "text-sm font-bold uppercase tracking-[0.18em] text-slate-500")}>{node.body}</p>;
}
