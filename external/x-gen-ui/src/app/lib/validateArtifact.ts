import { ZodError } from "zod";
import { Artifact, ArtifactSchema, SUPPORTED_COMPONENT_TYPES } from "./schema";

export type ValidationResult =
  | { ok: true; artifact: Artifact; errors: [] }
  | { ok: false; artifact?: undefined; errors: string[] };

export function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}

export function validateArtifactJson(text: string): ValidationResult {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return { ok: false, errors: [`JSON parse error: ${parsed.error}`] };
  }

  const unsupported = findUnsupportedNodeTypes(parsed.value);
  const result = ArtifactSchema.safeParse(parsed.value);

  if (result.success && unsupported.length === 0) {
    return { ok: true, artifact: result.data, errors: [] };
  }

  const zodErrors = result.success ? [] : formatZodErrors(result.error);
  return { ok: false, errors: [...unsupported, ...zodErrors] };
}

export function stringifyArtifact(artifact: Artifact): string {
  return JSON.stringify(artifact, null, 2);
}

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".").replace(/\.(\d+)(?=\.|$)/g, "[$1]") : "artifact";
    if (issue.code === "invalid_union_discriminator") {
      const received = "received" in issue ? issue.received : "unknown";
      return `${path} is unsupported: ${JSON.stringify(received)}`;
    }
    return `${path}: ${issue.message}`;
  });
}

function findUnsupportedNodeTypes(value: unknown): string[] {
  const errors: string[] = [];
  walkNode((value as { layout?: unknown })?.layout, "layout", errors);
  return errors;
}

function walkNode(value: unknown, path: string, errors: string[]): void {
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, unknown>;

  if (typeof node.type === "string" && !SUPPORTED_COMPONENT_TYPES.includes(node.type as never)) {
    errors.push(`${path}.type is unsupported: ${JSON.stringify(node.type)}`);
    return;
  }

  const children = node.children;
  if (Array.isArray(children)) {
    children.forEach((child, index) => walkNode(child, `${path}.children[${index}]`, errors));
  }

  const tabs = node.tabs;
  if (Array.isArray(tabs)) {
    tabs.forEach((tab, tabIndex) => {
      const tabChildren = (tab as Record<string, unknown>)?.children;
      if (Array.isArray(tabChildren)) {
        tabChildren.forEach((child, index) => walkNode(child, `${path}.tabs[${tabIndex}].children[${index}]`, errors));
      }
    });
  }

  const items = node.items;
  if (Array.isArray(items)) {
    items.forEach((item, itemIndex) => {
      const itemChildren = (item as Record<string, unknown>)?.children;
      if (Array.isArray(itemChildren)) {
        itemChildren.forEach((child, index) => walkNode(child, `${path}.items[${itemIndex}].children[${index}]`, errors));
      }
    });
  }
}
