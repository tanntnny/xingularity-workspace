import { useMemo, useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { artifactTypes, ArtifactType, ArtifactStyle, buildPrompt, styles } from "../../lib/promptTemplates";
import { PROMPT_COMPONENT_TYPES } from "../../lib/schema";

export function PromptBuilderPage() {
  const [artifactType, setArtifactType] = useState<ArtifactType>("Study UI");
  const [style, setStyle] = useState<ArtifactStyle>("Clean");
  const [topic, setTopic] = useState("Design an interactive artifact explaining a complex concept clearly.");
  const [allowedComponents, setAllowedComponents] = useState<string[]>([...PROMPT_COMPONENT_TYPES]);
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => buildPrompt({ artifactType, style, allowedComponents, topic }), [artifactType, style, allowedComponents, topic]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function reset() {
    setArtifactType("Study UI");
    setStyle("Clean");
    setTopic("Design an interactive artifact explaining a complex concept clearly.");
    setAllowedComponents([...PROMPT_COMPONENT_TYPES]);
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-panel">
        <h2 className="font-display text-2xl font-extrabold">Prompt Controls</h2>
        <p className="mt-1 text-slate-600">Generate strict instructions for external chatbot browsers.</p>

        <label className="mt-4 block text-sm font-extrabold">Topic or job</label>
        <textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3" value={topic} onChange={(event) => setTopic(event.target.value)} />

        <label className="mt-4 block text-sm font-extrabold">Artifact type</label>
        <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold" value={artifactType} onChange={(event) => setArtifactType(event.target.value as ArtifactType)}>
          {artifactTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-extrabold">Style</label>
        <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold" value={style} onChange={(event) => setStyle(event.target.value as ArtifactStyle)}>
          {styles.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <div className="mt-4">
          <p className="text-sm font-extrabold">Allowed components</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PROMPT_COMPONENT_TYPES.map((component) => {
              const checked = allowedComponents.includes(component);
              return (
                <label key={component} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setAllowedComponents((current) => (checked ? current.filter((item) => item !== component) : [...current, component]))}
                  />
                  {component}
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={copyPrompt}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy Prompt"}
          </Button>
          <Button onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Template
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-white/70 bg-slate-950 p-4 text-white shadow-panel">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-extrabold">Generated Prompt</h2>
          <span className="rounded-lg bg-white/10 px-3 py-1 font-mono text-xs font-bold">{allowedComponents.length} components</span>
        </div>
        <textarea className="min-h-[650px] w-full resize-y rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-sm leading-relaxed text-slate-100" value={prompt} onChange={() => undefined} readOnly />
      </section>
    </div>
  );
}
