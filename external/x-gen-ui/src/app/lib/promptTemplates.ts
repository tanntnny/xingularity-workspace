import { PROMPT_COMPONENT_TYPES } from "./schema";

export const artifactTypes = [
  "Study UI",
  "Dashboard",
  "Comparison UI",
  "Interactive Explainer",
  "Flow Diagram",
  "Quiz",
  "Simulator",
] as const;

export const styles = ["Clean", "Academic", "Dense", "Playful", "Minimal"] as const;

export type ArtifactType = (typeof artifactTypes)[number];
export type ArtifactStyle = (typeof styles)[number];

export function buildPrompt(options: {
  artifactType: ArtifactType;
  style: ArtifactStyle;
  allowedComponents: string[];
  topic: string;
}): string {
  const allowed = options.allowedComponents.length ? options.allowedComponents : PROMPT_COMPONENT_TYPES;
  const topic = options.topic.trim() || "a useful interactive learning artifact";

  return `Create a ${options.style.toLowerCase()} ${options.artifactType.toLowerCase()} about: ${topic}.

Return only one fenced codeblock labeled json.
Do not include explanation outside the codeblock.
Do not generate React code.
Do not generate JavaScript functions.
Do not include raw HTML.
Use only these component types inside layout children: ${allowed.join(", ")}.
The top-level layout type must be "page".
Output valid JSON matching this schema:

{
  "version": "1.0",
  "metadata": {
    "title": "string",
    "description": "optional string",
    "tags": ["optional", "strings"]
  },
  "theme": {
    "mode": "light or dark",
    "accent": "blue or green or purple or orange or gray",
    "density": "compact or normal or spacious"
  },
  "layout": {
    "type": "page",
    "children": [
      {
        "type": "one of the allowed component types",
        "...": "Use the concrete node shapes below. Do not include a props wrapper."
      }
    ]
  }
}

Node shapes:
- section: { "type": "section", "title": "optional", "description": "optional", "children": [] }
- text: { "type": "text", "body": "string", "variant": "paragraph | heading | muted | caption" }
- callout: { "type": "callout", "title": "optional", "body": "string", "tone": "info | warning | success | danger" }
- card: { "type": "card", "title": "optional", "body": "optional", "children": [] }
- grid: { "type": "grid", "columns": 1, "children": [] }
- tabs: { "type": "tabs", "tabs": [{ "label": "string", "children": [] }] }
- accordion: { "type": "accordion", "items": [{ "title": "string", "children": [] }] }
- table: { "type": "table", "columns": ["string"], "rows": [{ "columnName": "string/number/boolean/null" }] }
- chart: { "type": "chart", "chartType": "bar | line | area | pie", "xKey": "string", "yKey": "string", "data": [{ "x": "label", "y": 10 }] }
- quiz: { "type": "quiz", "questions": [{ "question": "string", "choices": ["A", "B"], "answerIndex": 0, "explanation": "optional" }] }
- timeline: { "type": "timeline", "items": [{ "title": "string", "description": "optional", "date": "optional" }] }
- flowDiagram: { "type": "flowDiagram", "nodes": [{ "id": "a", "label": "A" }], "edges": [{ "source": "a", "target": "b", "label": "optional" }] }
- sliderSimulator: { "type": "sliderSimulator", "title": "string", "description": "optional", "inputs": [{ "id": "x", "label": "X", "min": 0, "max": 100, "step": 1, "defaultValue": 50 }], "outputs": [{ "label": "Result", "formula": "x * 2" }] }

For sliderSimulator formulas, use only numbers, input variable IDs, +, -, *, /, ^ operators, and parentheses.
Return exactly:
\`\`\`json
{ ...valid artifact JSON... }
\`\`\``;
}

export function buildCorrectionPrompt(errorMessage: string): string {
  return `The JSON artifact failed validation. Fix the JSON to match the schema. Return only one fenced json codeblock. Error: ${errorMessage}. Unsupported component types must be replaced with one of: ${PROMPT_COMPONENT_TYPES.join(", ")}. Do not generate React code, JavaScript functions, or raw HTML.`;
}
