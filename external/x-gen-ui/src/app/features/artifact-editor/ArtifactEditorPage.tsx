import { CheckCircle2, Code2, Copy, Wand2 } from "lucide-react";
import { ArtifactRenderer } from "../../components/renderer/RenderNode";
import { Button } from "../../components/ui/Button";
import { JsonEditor } from "../../components/ui/JsonEditor";
import { buildCorrectionPrompt } from "../../lib/promptTemplates";
import { useAppStore } from "../../lib/store";
import { extractJsonFromText, tryRepairJson } from "../../lib/extractJson";
import { validateArtifactJson } from "../../lib/validateArtifact";

export function ArtifactEditorPage() {
  const { editorText, setEditorText, currentArtifact, setCurrentArtifact, validationErrors, setValidationErrors, setPage, setStatus } = useAppStore();

  function extract() {
    const result = extractJsonFromText(editorText);
    setEditorText(result.text);
  }

  function validate() {
    const result = validateArtifactJson(editorText);
    if (result.ok) {
      setCurrentArtifact(result.artifact);
      setValidationErrors([]);
      setStatus("Valid");
    } else {
      setCurrentArtifact(null);
      setValidationErrors(result.errors);
      setStatus("Invalid");
    }
  }

  function repair() {
    const repaired = tryRepairJson(editorText);
    setEditorText(repaired.text);
  }

  async function copyCorrectionPrompt() {
    await navigator.clipboard.writeText(buildCorrectionPrompt(validationErrors.join("; ")));
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <section className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-panel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-extrabold">Paste & Validate</h2>
            <p className="text-slate-600">Paste raw chatbot text or a fenced JSON codeblock.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={extract}><Code2 className="mr-2 h-4 w-4" />Extract JSON</Button>
            <Button onClick={validate} variant="primary"><CheckCircle2 className="mr-2 h-4 w-4" />Validate</Button>
            <Button onClick={repair}><Wand2 className="mr-2 h-4 w-4" />Repair JSON</Button>
          </div>
        </div>
        <JsonEditor value={editorText} onChange={setEditorText} />
        {validationErrors.length ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold">Validation errors</p>
              <Button onClick={copyCorrectionPrompt}><Copy className="mr-2 h-4 w-4" />Copy Correction Prompt</Button>
            </div>
            <ul className="mt-3 space-y-2 font-mono text-sm">
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-panel">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-extrabold">Live Preview</h2>
            <p className="text-slate-600">Valid artifacts render through safe registry components.</p>
          </div>
          <Button disabled={!currentArtifact} onClick={() => setPage("preview")} variant="primary">Render Artifact</Button>
        </div>
        {currentArtifact ? <ArtifactRenderer artifact={currentArtifact} /> : <EmptyPreview />}
      </section>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
      <div>
        <p className="font-display text-2xl font-extrabold text-slate-700">No valid artifact yet</p>
        <p className="mt-2">Extract and validate JSON before rendering.</p>
      </div>
    </div>
  );
}
