import { Shell } from "./components/layout/Shell";
import { ArtifactEditorPage } from "./features/artifact-editor/ArtifactEditorPage";
import { ArtifactLibraryPage } from "./features/artifact-library/ArtifactLibraryPage";
import { ArtifactPreviewPage } from "./features/artifact-preview/ArtifactPreviewPage";
import { PromptBuilderPage } from "./features/prompt-builder/PromptBuilderPage";
import { useAppStore } from "./lib/store";

export function App() {
  const page = useAppStore((state) => state.page);

  return (
    <Shell>
      {page === "prompt" ? <PromptBuilderPage /> : null}
      {page === "editor" ? <ArtifactEditorPage /> : null}
      {page === "preview" ? <ArtifactPreviewPage /> : null}
      {page === "library" ? <ArtifactLibraryPage /> : null}
    </Shell>
  );
}
