import type { MathOperation, MathQuestion } from "../types.js";

export interface MathQuestionOptions {
  difficulty: number;
  operation?: MathOperation;
  random?: () => number;
  idFactory?: () => string;
}

function clampDifficulty(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function intBetween(min: number, max: number, random: () => number): number {
  const r = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
  return min + Math.floor(r * (max - min + 1));
}

function ceilingForDifficulty(difficulty: number): number {
  if (difficulty <= 1) return 10;
  if (difficulty === 2) return 20;
  if (difficulty === 3) return 50;
  if (difficulty === 4) return 100;
  return Math.min(500, 100 + (difficulty - 4) * 80);
}

export function generateMathQuestion(options: MathQuestionOptions): MathQuestion {
  const difficulty = clampDifficulty(options.difficulty);
  const random = options.random ?? Math.random;
  const operation = options.operation ?? "addition";
  const max = ceilingForDifficulty(difficulty);

  if (operation === "multiplication") {
    const tableMax = difficulty <= 2 ? 5 : difficulty <= 4 ? 9 : 12;
    const left = intBetween(2, Math.max(2, tableMax), random);
    const right = intBetween(1, difficulty <= 1 ? 5 : 10, random);
    return {
      id: options.idFactory?.() ?? `math-multiplication-${left}-${right}-${difficulty}`,
      operation,
      left,
      right,
      answer: left * right,
      difficulty,
    };
  }

  if (operation === "comparison") {
    const left = intBetween(0, max, random);
    let right = intBetween(0, max, random);
    if (right === left) right = left === max ? Math.max(0, left - 1) : left + 1;
    return {
      id: options.idFactory?.() ?? `math-comparison-${left}-${right}-${difficulty}`,
      operation,
      left,
      right,
      answer: Math.max(left, right),
      difficulty,
    };
  }

  if (operation === "number_bond") {
    const target = intBetween(Math.min(5, max), max, random);
    const left = intBetween(0, Math.max(0, target - 1), random);
    return {
      id: options.idFactory?.() ?? `math-number-bond-${left}-${target}-${difficulty}`,
      operation,
      left,
      right: target,
      answer: target - left,
      difficulty,
    };
  }

  let left = intBetween(1, Math.max(2, max - 1), random);
  let right = intBetween(1, Math.max(1, max - left), random);

  if (operation === "subtraction") {
    left = intBetween(2, max, random);
    right = intBetween(1, left, random);
  }

  const answer = operation === "addition" ? left + right : left - right;
  return {
    id: options.idFactory?.() ?? `math-${operation}-${left}-${right}-${difficulty}`,
    operation,
    left,
    right,
    answer,
    difficulty,
  };
}
