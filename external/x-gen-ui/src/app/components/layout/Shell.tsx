import { Database, FileJson2, Library, Sparkles } from "lucide-react";
import { AppPage, useAppStore } from "../../lib/store";
import { cn } from "../../lib/cn";
import { Badge } from "../ui/Badge";

const navItems: Array<{ page: AppPage; label: string; icon: React.ReactNode }> = [
  { page: "prompt", label: "Prompt Builder", icon: <Sparkles className="h-4 w-4" /> },
  { page: "editor", label: "Paste & Validate", icon: <FileJson2 className="h-4 w-4" /> },
  { page: "preview", label: "Preview", icon: <Database className="h-4 w-4" /> },
  { page: "library", label: "Library", icon: <Library className="h-4 w-4" /> },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { page, setPage, status } = useAppStore();
  const tone = status === "Valid" || status === "Saved" ? "good" : status === "Invalid" ? "bad" : "warn";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_32rem),linear-gradient(135deg,#f7f3df,#e8efe5_42%,#f8fafc)] px-3 py-4 text-slate-950 md:px-6">
      <header className="mx-auto mb-4 flex max-w-7xl flex-col gap-3 rounded-xl border border-white/70 bg-white/70 p-4 shadow-panel backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.28em] text-slate-500">Schema-first artifact renderer</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-4xl">Generative UI Workbench</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{status}</Badge>
          <span className="rounded-lg bg-slate-950 px-3 py-1.5 font-mono text-xs font-bold text-white">No LLM API</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="h-fit rounded-xl border border-white/70 bg-white/80 p-2 shadow-panel backdrop-blur">
          {navItems.map((item) => (
            <button
              key={item.page}
              onClick={() => setPage(item.page)}
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-extrabold transition",
                page === item.page ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <section>{children}</section>
      </main>
    </div>
  );
}
