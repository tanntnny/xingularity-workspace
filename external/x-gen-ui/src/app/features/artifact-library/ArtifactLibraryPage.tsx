import { useEffect, useMemo, useState } from "react";
import { Copy, Files, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useAppStore } from "../../lib/store";
import { deleteArtifact, duplicateArtifact, loadArtifacts, SavedArtifact, upsertArtifact } from "../../lib/storage";
import { sampleArtifacts } from "../../samples/sampleArtifacts";

export function ArtifactLibraryPage() {
  const [items, setItems] = useState<SavedArtifact[]>([]);
  const [query, setQuery] = useState("");
  const openArtifact = useAppStore((state) => state.openArtifact);

  function refresh() {
    setItems(loadArtifacts());
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const haystack = [item.artifact.metadata.title, item.artifact.metadata.description, ...(item.artifact.metadata.tags ?? [])].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query]);

  function addSample(index: number) {
    const saved = upsertArtifact(sampleArtifacts[index]);
    refresh();
    openArtifact(saved.artifact, saved.id);
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-panel">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-extrabold">Artifact Library</h2>
            <p className="text-slate-600">Saved artifacts persist in localStorage after refresh.</p>
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or tags..." className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-bold md:w-80" />
        </div>
      </section>

      <section className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-panel">
        <h3 className="font-display text-xl font-extrabold">Samples</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {sampleArtifacts.map((artifact, index) => (
            <button key={artifact.metadata.title} onClick={() => addSample(index)} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
              <p className="font-extrabold">{artifact.metadata.title}</p>
              <p className="mt-1 text-sm text-slate-600">{artifact.metadata.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <article key={item.id} className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-panel">
            <div className="mb-3">
              <p className="font-display text-xl font-extrabold">{item.artifact.metadata.title}</p>
              {item.artifact.metadata.description ? <p className="mt-1 text-sm text-slate-600">{item.artifact.metadata.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.artifact.metadata.tags?.map((tag) => (
                  <span key={tag} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">#{tag}</span>
                ))}
              </div>
            </div>
            <p className="mb-4 font-mono text-xs text-slate-500">Updated {new Date(item.updatedAt).toLocaleString()}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => openArtifact(item.artifact, item.id)}>Open</Button>
              <Button onClick={() => navigator.clipboard.writeText(JSON.stringify(item.artifact, null, 2))}><Copy className="mr-2 h-4 w-4" />Copy</Button>
              <Button onClick={() => { duplicateArtifact(item.id); refresh(); }}><Files className="mr-2 h-4 w-4" />Duplicate</Button>
              <Button variant="danger" onClick={() => { deleteArtifact(item.id); refresh(); }}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
            </div>
          </article>
        ))}
      </section>

      {!filtered.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-slate-600">
          <p className="font-display text-2xl font-extrabold text-slate-800">No saved artifacts</p>
          <p className="mt-2">Save an artifact or load a sample.</p>
        </div>
      ) : null}
    </div>
  );
}
