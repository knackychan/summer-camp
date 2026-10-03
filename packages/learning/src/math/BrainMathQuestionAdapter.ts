import type { MathOperation, MathQuestion } from "../types.js";

export interface BrainMathItemLike {
  answer?: unknown;
  prompt?: unknown;
}

export interface BrainMathQuestionContext {
  gameId: string;
  tier: string;
  index: number;
  item: BrainMathItemLike;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function tierDifficulty(tier: string): number {
  if (tier === "hard") return 6;
  if (tier === "mid") return 3;
  return 1;
}

function parsedOperands(prompt: Record<string, unknown>): { operation: MathOperation; left: number; right: number } | null {
  const a = Number(prompt.a);
  const b = Number(prompt.b);
  if (prompt.type === "emoji" && Number.isFinite(a) && Number.isFinite(b)) {
    return { operation: "addition", left: a, right: b };
  }
  if (prompt.type === "comparison" && Number.isFinite(a) && Number.isFinite(b)) {
    return { operation: "comparison", left: a, right: b };
  }
  if (prompt.type === "numberbond" && Number.isFinite(a) && Number.isFinite(b)) {
    return { operation: "number_bond", left: a, right: b };
  }

  const label = typeof prompt.en === "string" ? prompt.en.trim() : "";
  const match = label.match(/^(\d+)\s*([+×−-])\s*(\d+)\s*=\s*\?$/);
  if (!match) return null;
  const left = Number(match[1]);
  const right = Number(match[3]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  const symbol = match[2];
  return {
    operation: symbol === "+" ? "addition" : symbol === "×" ? "multiplication" : "subtraction",
    left,
    right,
  };
}

function computedAnswer(operation: MathOperation, left: number, right: number): number {
  if (operation === "addition") return left + right;
  if (operation === "subtraction") return left - right;
  if (operation === "multiplication") return left * right;
  if (operation === "comparison") return Math.max(left, right);
  return right - left;
}

function operationToken(operation: MathOperation): string {
  if (operation === "addition") return "+";
  if (operation === "subtraction") return "-";
  if (operation === "multiplication") return "x";
  if (operation === "comparison") return "compare";
  return "bond";
}

export function brainMathQuestionFromItem(context: BrainMathQuestionContext): MathQuestion | null {
  if (context.gameId !== "calc") return null;
  const prompt = record(context.item.prompt);
  if (!prompt) return null;
  const parsed = parsedOperands(prompt);
  if (!parsed) return null;

  const answer = Number(context.item.answer);
  if (!Number.isFinite(answer)) return null;
  const locallyComputed = computedAnswer(parsed.operation, parsed.left, parsed.right);
  if (locallyComputed !== answer) return null;

  const operator = operationToken(parsed.operation);
  return {
    id: `brain:calc:${context.tier}:${Math.max(0, Math.round(context.index))}:${parsed.left}${operator}${parsed.right}`,
    operation: parsed.operation,
    left: parsed.left,
    right: parsed.right,
    answer,
    difficulty: tierDifficulty(context.tier),
  };
}

export function canUseBrainMathHint(context: BrainMathQuestionContext): boolean {
  return brainMathQuestionFromItem(context) !== null;
}
