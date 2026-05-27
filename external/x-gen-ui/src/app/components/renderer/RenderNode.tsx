import { Artifact, UINode } from "../../lib/schema";
import { cn } from "../../lib/cn";
import { componentRegistry } from "./registry";

const accentClass: Record<Artifact["theme"]["accent"], string> = {
  blue: "from-blue-600 to-cyan-500",
  green: "from-emerald-600 to-lime-500",
  purple: "from-violet-600 to-fuchsia-500",
  orange: "from-orange-600 to-amber-400",
  gray: "from-slate-700 to-slate-400",
};

export function ArtifactRenderer({ artifact }: { artifact: Artifact }) {
  const isDark = artifact.theme.mode === "dark";
  return (
    <article
      className={cn(
        "rounded-xl border p-4 shadow-panel",
        isDark ? "border-slate-700 bg-slate-950 text-slate-50" : "border-white bg-white text-slate-950",
        artifact.theme.density === "compact" && "text-sm",
        artifact.theme.density === "spacious" && "text-lg",
      )}
    >
      <div className={cn("mb-4 h-2 rounded-md bg-gradient-to-r", accentClass[artifact.theme.accent])} />
      <div className="mb-4">
        <h2 className="font-display text-3xl font-extrabold tracking-tight">{artifact.metadata.title}</h2>
        {artifact.metadata.description ? <p className={cn("mt-2", isDark ? "text-slate-300" : "text-slate-600")}>{artifact.metadata.description}</p> : null}
        {artifact.metadata.tags?.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {artifact.metadata.tags.map((tag) => (
              <span key={tag} className={cn("rounded-lg px-2.5 py-1 text-xs font-bold", isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600")}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <RenderNode node={artifact.layout} />
    </article>
  );
}

export function RenderNode({ node }: { node: UINode }) {
  const Renderer = componentRegistry[node.type];
  if (!Renderer) {
    return <UnsupportedNode type={(node as { type?: string }).type ?? "unknown"} />;
  }
  return <Renderer node={node as never} renderNode={(child, key) => <RenderNode key={key} node={child} />} />;
}

function UnsupportedNode({ type }: { type: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
      <p className="font-extrabold">Unsupported component</p>
      <p className="font-mono text-sm">{type}</p>
    </div>
  );
}
