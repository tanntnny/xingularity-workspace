import { useState } from "react";
import { UINode } from "../../../lib/schema";
import { cn } from "../../../lib/cn";

export function QuizNode({ node }: { node: Extract<UINode, { type: "quiz" }> }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  return (
    <div className="space-y-3">
      {node.questions.map((question, questionIndex) => {
        const selected = answers[questionIndex];
        const answered = selected !== undefined;
        return (
          <div key={question.question} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-950">
            <p className="font-display text-lg font-extrabold">{question.question}</p>
            <div className="mt-3 grid gap-2">
              {question.choices.map((choice, choiceIndex) => (
                <button
                  key={choice}
                  onClick={() => setAnswers((current) => ({ ...current, [questionIndex]: choiceIndex }))}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left font-bold",
                    selected === choiceIndex && choiceIndex === question.answerIndex && "border-emerald-300 bg-emerald-50 text-emerald-800",
                    selected === choiceIndex && choiceIndex !== question.answerIndex && "border-rose-300 bg-rose-50 text-rose-800",
                    selected !== choiceIndex && "border-slate-200 hover:bg-slate-50",
                  )}
                >
                  {choice}
                </button>
              ))}
            </div>
            {answered ? <p className="mt-3 text-sm font-bold text-slate-600">{selected === question.answerIndex ? "Correct. " : "Not quite. "}{question.explanation}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
