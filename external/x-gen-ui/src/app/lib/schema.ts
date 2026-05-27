import { z } from "zod";

export const SUPPORTED_COMPONENT_TYPES = [
  "page",
  "section",
  "text",
  "callout",
  "card",
  "grid",
  "tabs",
  "accordion",
  "table",
  "chart",
  "quiz",
  "timeline",
  "flowDiagram",
  "sliderSimulator",
] as const;

export const PROMPT_COMPONENT_TYPES = SUPPORTED_COMPONENT_TYPES.filter((type) => type !== "page" && type !== "section");

export type ThemeMode = "light" | "dark";
export type Accent = "blue" | "green" | "purple" | "orange" | "gray";
export type Density = "compact" | "normal" | "spacious";

export type UINode =
  | { type: "page"; children: UINode[] }
  | { type: "section"; title?: string; description?: string; children: UINode[] }
  | { type: "text"; body: string; variant?: "paragraph" | "heading" | "muted" | "caption" }
  | { type: "callout"; title?: string; body: string; tone?: "info" | "warning" | "success" | "danger" }
  | { type: "card"; title?: string; body?: string; children?: UINode[] }
  | { type: "grid"; columns?: 1 | 2 | 3 | 4; children: UINode[] }
  | { type: "tabs"; tabs: Array<{ label: string; children: UINode[] }> }
  | { type: "accordion"; items: Array<{ title: string; children: UINode[] }> }
  | { type: "table"; columns: string[]; rows: Array<Record<string, string | number | boolean | null>> }
  | {
      type: "chart";
      chartType: "bar" | "line" | "area" | "pie";
      xKey: string;
      yKey: string;
      data: Array<Record<string, string | number>>;
    }
  | {
      type: "quiz";
      questions: Array<{ question: string; choices: string[]; answerIndex: number; explanation?: string }>;
    }
  | { type: "timeline"; items: Array<{ title: string; description?: string; date?: string }> }
  | { type: "flowDiagram"; nodes: Array<{ id: string; label: string }>; edges: Array<{ source: string; target: string; label?: string }> }
  | {
      type: "sliderSimulator";
      title: string;
      description?: string;
      inputs: Array<{ id: string; label: string; min: number; max: number; step: number; defaultValue: number }>;
      outputs: Array<{ label: string; formula: string }>;
    };

export type Artifact = {
  version: "1.0";
  metadata: {
    title: string;
    description?: string;
    tags?: string[];
  };
  theme: {
    mode: ThemeMode;
    accent: Accent;
    density: Density;
  };
  layout: UINode;
};

const rowValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const chartValueSchema = z.union([z.string(), z.number()]);

export const UINodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("page"),
      children: z.array(UINodeSchema),
    }),
    z.object({
      type: z.literal("section"),
      title: z.string().optional(),
      description: z.string().optional(),
      children: z.array(UINodeSchema),
    }),
    z.object({
      type: z.literal("text"),
      body: z.string(),
      variant: z.enum(["paragraph", "heading", "muted", "caption"]).optional(),
    }),
    z.object({
      type: z.literal("callout"),
      title: z.string().optional(),
      body: z.string(),
      tone: z.enum(["info", "warning", "success", "danger"]).optional(),
    }),
    z.object({
      type: z.literal("card"),
      title: z.string().optional(),
      body: z.string().optional(),
      children: z.array(UINodeSchema).optional(),
    }),
    z.object({
      type: z.literal("grid"),
      columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
      children: z.array(UINodeSchema),
    }),
    z.object({
      type: z.literal("tabs"),
      tabs: z.array(
        z.object({
          label: z.string(),
          children: z.array(UINodeSchema),
        }),
      ),
    }),
    z.object({
      type: z.literal("accordion"),
      items: z.array(
        z.object({
          title: z.string(),
          children: z.array(UINodeSchema),
        }),
      ),
    }),
    z.object({
      type: z.literal("table"),
      columns: z.array(z.string()),
      rows: z.array(z.record(rowValueSchema)),
    }),
    z.object({
      type: z.literal("chart"),
      chartType: z.enum(["bar", "line", "area", "pie"]),
      xKey: z.string(),
      yKey: z.string(),
      data: z.array(z.record(chartValueSchema)),
    }),
    z.object({
      type: z.literal("quiz"),
      questions: z.array(
        z.object({
          question: z.string(),
          choices: z.array(z.string()).min(2),
          answerIndex: z.number().int().nonnegative(),
          explanation: z.string().optional(),
        }),
      ),
    }),
    z.object({
      type: z.literal("timeline"),
      items: z.array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          date: z.string().optional(),
        }),
      ),
    }),
    z.object({
      type: z.literal("flowDiagram"),
      nodes: z.array(z.object({ id: z.string(), label: z.string() })),
      edges: z.array(z.object({ source: z.string(), target: z.string(), label: z.string().optional() })),
    }),
    z.object({
      type: z.literal("sliderSimulator"),
      title: z.string(),
      description: z.string().optional(),
      inputs: z.array(
        z.object({
          id: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use safe variable IDs like revenue or conversion_rate."),
          label: z.string(),
          min: z.number(),
          max: z.number(),
          step: z.number().positive(),
          defaultValue: z.number(),
        }),
      ),
      outputs: z.array(z.object({ label: z.string(), formula: z.string() })),
    }),
  ]),
);

export const ArtifactSchema: z.ZodType<Artifact> = z.object({
  version: z.literal("1.0"),
  metadata: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  theme: z.object({
    mode: z.enum(["light", "dark"]),
    accent: z.enum(["blue", "green", "purple", "orange", "gray"]),
    density: z.enum(["compact", "normal", "spacious"]),
  }),
  layout: UINodeSchema,
});
