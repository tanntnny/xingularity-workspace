import { Artifact } from "./schema";

const STORAGE_KEY = "generative-ui-workbench:artifacts";

export type SavedArtifact = {
  id: string;
  artifact: Artifact;
  createdAt: string;
  updatedAt: string;
};

export function loadArtifacts(): SavedArtifact[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveArtifacts(artifacts: SavedArtifact[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(artifacts));
}

export function upsertArtifact(artifact: Artifact, id?: string): SavedArtifact {
  const artifacts = loadArtifacts();
  const now = new Date().toISOString();
  const existing = id ? artifacts.find((item) => item.id === id) : undefined;
  const saved: SavedArtifact = {
    id: existing?.id ?? crypto.randomUUID(),
    artifact,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const next = existing ? artifacts.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...artifacts];
  saveArtifacts(next);
  return saved;
}

export function deleteArtifact(id: string): void {
  saveArtifacts(loadArtifacts().filter((artifact) => artifact.id !== id));
}

export function duplicateArtifact(id: string): SavedArtifact | null {
  const source = loadArtifacts().find((artifact) => artifact.id === id);
  if (!source) return null;
  const copy: Artifact = {
    ...source.artifact,
    metadata: {
      ...source.artifact.metadata,
      title: `${source.artifact.metadata.title} Copy`,
    },
  };
  return upsertArtifact(copy);
}
