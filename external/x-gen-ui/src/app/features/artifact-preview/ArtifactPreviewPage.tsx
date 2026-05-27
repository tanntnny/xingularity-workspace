import { ChangeEvent } from "react";
import { Copy, Download, Files, Save, Upload } from "lucide-react";
import { ArtifactRenderer } from "../../components/renderer/RenderNode";
import { Button } from "../../components/ui/Button";
import { JsonEditor } from "../../components/ui/JsonEditor";
import { buildCorrectionPrompt } from "../../lib/promptTemplates";
import { useAppStore } from "../../lib/store";
import { stringifyArtifact, validateArtifactJson } from "../../lib/validateArtifact";
import { upsertArtifact } from "../../lib/storage";

export function ArtifactPreviewPage() {
  const { currentArtifact, currentSavedId, editorText, setEditorText, validationErrors, setValidationErrors, setCurrentArtifact, setStatus } = useAppStore();

  function validateEditor() {
    const result = validateArtifactJson(editorText);
    if (result.ok) {
      setCurrentArtifact(result.artifact, currentSavedId);
      setValidationErrors([]);
      setStatus("Valid");
    } else {
      setValidationErrors(result.errors);
      setStatus("Invalid");
    }
  }

  function save() {
    if (!currentArtifact) return;
    const saved = upsertArtifact(currentArtifact, currentSavedId);
    setCurrentArtifact(saved.artifact, saved.id);
    setStatus("Saved");
  }

  function duplicate() {
    if (!currentArtifact) return;
    const saved = upsertArtifact({
      ...currentArtifact,
      metadata: { ...currentArtifact.metadata, title: `${currentArtifact.metadata.title} Copy` },
    });
    setCurrentArtifact(saved.artifact, saved.id);
    setEditorText(stringifyArtifact(saved.artifact));
    setStatus("Saved");
  }

  async function copyJson() {
    await navigator.clipboard.writeText(editorText);
  }

  async function copyCorrectionPrompt() {
    await navigator.clipboard.writeText(buildCorrectionPrompt(validationErrors.join("; ")));
  }

  function exportJson() {
    const blob = new Blob([editorText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${currentArtifact?.metadata.title ?? "artifact"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditorText(await file.text());
  }

  if (!currentArtifact) {
    return (
      <div className="rounded-xl border border-white/70 bg-white/85 p-6 text-center shadow-panel">
        <h2 className="font-display text-3xl font-extrabold">No artifact selected</h2>
        <p className="mt-2 text-slate-600">Validate JSON or open a saved artifact first.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_520px]">
      <section className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-panel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-extrabold">Artifact Preview</h2>
            <p className="text-slate-600">Rendered from validated schema data.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} variant="primary"><Save className="mr-2 h-4 w-4" />Save</Button>
            <Button onClick={duplicate}><Files className="mr-2 h-4 w-4" />Duplicate</Button>
            <Button onClick={exportJson}><Download className="mr-2 h-4 w-4" />Export JSON</Button>
            <Button onClick={copyJson}><Copy className="mr-2 h-4 w-4" />Copy JSON</Button>
          </div>
        </div>
        <ArtifactRenderer artifact={currentArtifact} />
      </section>

      <section className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-panel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-extrabold">Edit JSON</h2>
            <p className="text-slate-600">Validate after editing to update preview.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold hover:bg-slate-50">
              <Upload className="mr-2 h-4 w-4" />
              Import JSON
              <input className="hidden" type="file" accept="application/json,.json" onChange={importJson} />
            </label>
            <Button onClick={validateEditor} variant="primary">Validate</Button>
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
    </div>
  );
}
