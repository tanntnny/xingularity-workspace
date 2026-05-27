import { Artifact } from "../lib/schema";

export const sampleArtifacts: Artifact[] = [
  {
    version: "1.0",
    metadata: {
      title: "Revenue Quality Dashboard",
      description: "Interactive dashboard for inspecting acquisition channels.",
      tags: ["dashboard", "sample"],
    },
    theme: { mode: "light", accent: "green", density: "normal" },
    layout: {
      type: "page",
      children: [
        { type: "text", variant: "heading", body: "Channel Quality Review" },
        {
          type: "grid",
          columns: 3,
          children: [
            { type: "card", title: "Pipeline", body: "$420k qualified" },
            { type: "card", title: "Conversion", body: "18.4% trial to paid" },
            { type: "callout", tone: "success", title: "Signal", body: "Partner traffic has the highest retained revenue." },
          ],
        },
        {
          type: "chart",
          chartType: "bar",
          xKey: "channel",
          yKey: "revenue",
          data: [
            { channel: "Search", revenue: 120 },
            { channel: "Partner", revenue: 180 },
            { channel: "Social", revenue: 72 },
            { channel: "Email", revenue: 96 },
          ],
        },
        {
          type: "tabs",
          tabs: [
            {
              label: "Actions",
              children: [
                { type: "text", body: "Shift budget toward partner programs and search retargeting." },
                { type: "table", columns: ["channel", "priority"], rows: [{ channel: "Partner", priority: "High" }, { channel: "Social", priority: "Low" }] },
              ],
            },
            {
              label: "Risks",
              children: [{ type: "callout", tone: "warning", body: "Attribution is incomplete for 11% of partner leads." }],
            },
          ],
        },
      ],
    },
  },
  {
    version: "1.0",
    metadata: {
      title: "Learning Loop Explainer",
      description: "Study UI with quiz, accordion, timeline, and flow diagram.",
      tags: ["study", "quiz", "flow"],
    },
    theme: { mode: "light", accent: "blue", density: "spacious" },
    layout: {
      type: "page",
      children: [
        {
          type: "section",
          title: "How Retrieval-Augmented Generation Works",
          description: "A compact conceptual artifact.",
          children: [
            {
              type: "flowDiagram",
              nodes: [
                { id: "query", label: "Query" },
                { id: "retrieve", label: "Retrieve" },
                { id: "rank", label: "Rank" },
                { id: "answer", label: "Answer" },
              ],
              edges: [
                { source: "query", target: "retrieve" },
                { source: "retrieve", target: "rank" },
                { source: "rank", target: "answer" },
              ],
            },
            {
              type: "accordion",
              items: [
                { title: "Retrieval", children: [{ type: "text", body: "Find candidate documents with lexical, vector, or hybrid search." }] },
                { title: "Grounding", children: [{ type: "text", body: "Use retrieved context to constrain the answer." }] },
              ],
            },
            {
              type: "quiz",
              questions: [
                {
                  question: "Why avoid arbitrary code execution in generated artifacts?",
                  choices: ["It is slower", "It reduces security risk", "It removes styling"],
                  answerIndex: 1,
                  explanation: "Schema rendering treats model output as data, not executable code.",
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    version: "1.0",
    metadata: {
      title: "Pricing Simulator",
      description: "Safe formula demo using slider inputs.",
      tags: ["simulator", "sample"],
    },
    theme: { mode: "dark", accent: "orange", density: "normal" },
    layout: {
      type: "page",
      children: [
        {
          type: "sliderSimulator",
          title: "Monthly Revenue Model",
          description: "Adjust acquisition and pricing assumptions.",
          inputs: [
            { id: "users", label: "Users", min: 100, max: 10000, step: 100, defaultValue: 2500 },
            { id: "price", label: "Price", min: 5, max: 99, step: 1, defaultValue: 29 },
            { id: "conversion", label: "Conversion %", min: 1, max: 20, step: 1, defaultValue: 7 },
          ],
          outputs: [{ label: "MRR", formula: "users * price * conversion / 100" }],
        },
      ],
    },
  },
];
