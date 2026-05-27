# Generative UI Workbench

Schema-first MVP for a browser-chat-based generative UI workflow. It does not call OpenAI, Anthropic, Gemini, Vercel AI SDK, or any LLM API.

## Run

```bash
npm install
npm run dev
```

## Workflow

1. Open Prompt Builder.
2. Pick artifact type, style, and allowed safe components.
3. Copy the generated prompt.
4. Paste it into an external chatbot browser such as ChatGPT, Claude, or Gemini.
5. Paste the chatbot's fenced `json` codeblock into Paste + Validate.
6. Extract, validate, render, save, duplicate, export, or repair the artifact locally.

## Why No Arbitrary Code Execution

The app renders JSON through a fixed component registry. Pasted chatbot output is treated as data, not code. The renderer never executes JavaScript, React code, raw HTML, or functions from model output. Unsupported node types render as safe fallback panels instead of crashing.

## Add New Components

1. Add the node type to `src/app/lib/schema.ts`.
2. Create a renderer in `src/app/components/renderer/nodes/`.
3. Register it in `src/app/components/renderer/registry.ts`.
4. Add the component name to `SUPPORTED_COMPONENT_TYPES` and prompt template guidance in `src/app/lib/promptTemplates.ts`.
5. Add a sample artifact covering the component.

## Storage

Saved artifacts use `localStorage` only. No backend, auth, database, or API key is required.
