import { create } from "zustand";
import { Artifact } from "./schema";
import { stringifyArtifact } from "./validateArtifact";
import { sampleArtifacts } from "../samples/sampleArtifacts";

export type AppPage = "prompt" | "editor" | "preview" | "library";
export type ArtifactStatus = "Draft" | "Valid" | "Invalid" | "Saved";

type AppStore = {
  page: AppPage;
  editorText: string;
  currentArtifact: Artifact | null;
  currentSavedId?: string;
  validationErrors: string[];
  status: ArtifactStatus;
  setPage: (page: AppPage) => void;
  setEditorText: (text: string) => void;
  setCurrentArtifact: (artifact: Artifact | null, savedId?: string) => void;
  setValidationErrors: (errors: string[]) => void;
  setStatus: (status: ArtifactStatus) => void;
  openArtifact: (artifact: Artifact, savedId?: string) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  page: "prompt",
  editorText: stringifyArtifact(sampleArtifacts[0]),
  currentArtifact: sampleArtifacts[0],
  currentSavedId: undefined,
  validationErrors: [],
  status: "Draft",
  setPage: (page) => set({ page }),
  setEditorText: (editorText) => set({ editorText, status: "Draft" }),
  setCurrentArtifact: (currentArtifact, currentSavedId) => set({ currentArtifact, currentSavedId }),
  setValidationErrors: (validationErrors) => set({ validationErrors, status: validationErrors.length ? "Invalid" : "Valid" }),
  setStatus: (status) => set({ status }),
  openArtifact: (artifact, savedId) =>
    set({
      page: "preview",
      editorText: stringifyArtifact(artifact),
      currentArtifact: artifact,
      currentSavedId: savedId,
      validationErrors: [],
      status: savedId ? "Saved" : "Valid",
    }),
}));
