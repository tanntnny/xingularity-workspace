import { useMemo, useState } from "react";
import { UINode } from "../../../lib/schema";

export function SliderSimulatorNode({ node }: { node: Extract<UINode, { type: "sliderSimulator" }> }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(node.inputs.map((input) => [input.id, input.defaultValue])));

  const outputs = useMemo(
    () =>
      node.outputs.map((output) => ({
        ...output,
        value: evaluateFormula(output.formula, values),
      })),
    [node.outputs, values],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-950">
      <h3 className="font-display text-2xl font-extrabold">{node.title}</h3>
      {node.description ? <p className="mt-1 text-slate-600">{node.description}</p> : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          {node.inputs.map((input) => (
            <label key={input.id} className="block">
              <div className="mb-2 flex justify-between text-sm font-extrabold">
                <span>{input.label}</span>
                <span>{values[input.id]}</span>
              </div>
              <input
                className="w-full accent-slate-950"
                type="range"
                min={input.min}
                max={input.max}
                step={input.step}
                value={values[input.id]}
                onChange={(event) => setValues((current) => ({ ...current, [input.id]: Number(event.target.value) }))}
              />
            </label>
          ))}
        </div>
        <div className="grid gap-3">
          {outputs.map((output) => (
            <div key={output.label} className="rounded-xl bg-slate-950 p-4 text-white">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">{output.label}</p>
              <p className="mt-2 font-display text-3xl font-extrabold">{output.value.ok ? formatNumber(output.value.value) : "Formula"}</p>
              {!output.value.ok ? <p className="mt-2 font-mono text-xs text-slate-300">{output.formula}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Token = number | string;

function evaluateFormula(formula: string, values: Record<string, number>): { ok: true; value: number } | { ok: false } {
  if (!/^[A-Za-z0-9_+\-*/^().\s]+$/.test(formula)) return { ok: false };
  const tokens = tokenize(formula);
  if (!tokens) return { ok: false };
  const rpn = toRpn(tokens);
  if (!rpn) return { ok: false };
  const value = evalRpn(rpn, values);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false };
}

function tokenize(formula: string): Token[] | null {
  const tokens: Token[] = [];
  const matches = formula.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[+\-*/^()]/g);
  if (!matches) return null;
  for (const match of matches) {
    tokens.push(/^\d/.test(match) ? Number(match) : match);
  }
  return tokens;
}

const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };

function toRpn(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const operators: string[] = [];

  for (const token of tokens) {
    if (typeof token === "number" || /^[A-Za-z_]/.test(token)) {
      output.push(token);
    } else if (token in precedence) {
      while (operators.length && operators[operators.length - 1] in precedence && precedence[operators[operators.length - 1]] >= precedence[token]) {
        output.push(operators.pop()!);
      }
      operators.push(token);
    } else if (token === "(") {
      operators.push(token);
    } else if (token === ")") {
      while (operators.length && operators[operators.length - 1] !== "(") output.push(operators.pop()!);
      if (operators.pop() !== "(") return null;
    }
  }

  while (operators.length) {
    const operator = operators.pop()!;
    if (operator === "(") return null;
    output.push(operator);
  }

  return output;
}

function evalRpn(tokens: Token[], values: Record<string, number>): number {
  const stack: number[] = [];
  for (const token of tokens) {
    if (typeof token === "number") {
      stack.push(token);
    } else if (token in precedence) {
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) return Number.NaN;
      if (token === "+") stack.push(left + right);
      if (token === "-") stack.push(left - right);
      if (token === "*") stack.push(left * right);
      if (token === "/") stack.push(left / right);
      if (token === "^") stack.push(left ** right);
    } else {
      stack.push(values[token] ?? Number.NaN);
    }
  }
  return stack.length === 1 ? stack[0] : Number.NaN;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
