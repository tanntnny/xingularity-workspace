import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

export function JsonEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      extensions={[json()]}
      basicSetup={{
        foldGutter: true,
        lineNumbers: true,
        highlightActiveLine: true,
        autocompletion: true,
      }}
      onChange={onChange}
    />
  );
}
