import { cn } from "../../lib/cn";

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-extrabold uppercase tracking-[0.18em]",
        tone === "neutral" && "border-slate-200 bg-white text-slate-600",
        tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "bad" && "border-rose-200 bg-rose-50 text-rose-700",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {children}
    </span>
  );
}
