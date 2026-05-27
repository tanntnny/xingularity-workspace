export type ExtractResult = {
  text: string;
  source: "fenced-json" | "fenced" | "object" | "raw";
  error?: string;
};

export function extractJsonFromText(input: string): ExtractResult {
  const trimmed = input.trim();
  const jsonFences = [...trimmed.matchAll(/```json\s*([\s\S]*?)```/gi)];
  const validJsonFence = jsonFences.find((match) => canParseJson(match[1].trim()));
  if (validJsonFence?.[1]) {
    return { text: validJsonFence[1].trim(), source: "fenced-json" };
  }

  if (jsonFences[0]?.[1]) {
    return { text: jsonFences[0][1].trim(), source: "fenced-json" };
  }

  const anyFences = [...trimmed.matchAll(/```\s*([\s\S]*?)```/g)];
  const validFence = anyFences.find((match) => canParseJson(match[1].trim()));
  if (validFence?.[1]) {
    return { text: validFence[1].trim(), source: "fenced" };
  }

  if (anyFences[0]?.[1]) {
    return { text: anyFences[0][1].trim(), source: "fenced" };
  }

  const objectText = extractFirstJsonObject(trimmed);
  if (objectText) {
    return { text: objectText, source: "object" };
  }

  return { text: trimmed, source: "raw", error: "No fenced JSON codeblock or JSON object found." };
}

export function tryRepairJson(input: string): ExtractResult {
  const extracted = extractJsonFromText(input);
  const repaired = extracted.text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();

  return { text: repaired, source: extracted.source, error: extracted.error };
}

function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return input.slice(start, index + 1).trim();
    }
  }

  return null;
}

function canParseJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
