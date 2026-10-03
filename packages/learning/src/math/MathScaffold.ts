import type { MathQuestion } from "../types.js";

function clampDifficulty(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

/** Create a smaller deterministic practice step. It is never scored. */
export function createEasierMathFollowUp(question: MathQuestion): MathQuestion {
  const difficulty = clampDifficulty(question.difficulty - 1);

  if (question.operation === "multiplication") {
    const left = Math.max(2, Math.min(question.left, 5));
    const right = Math.max(1, Math.min(question.right <= 1 ? 1 : question.right - 1, 5));
    return {
      id: `${question.id}:scaffold:${left}x${right}`,
      operation: "multiplication",
      left,
      right,
      answer: left * right,
      difficulty,
    };
  }

  if (question.operation === "comparison") {
    const high = Math.max(question.left, question.right);
    const low = Math.min(question.left, question.right);
    const easierHigh = Math.max(2, Math.min(10, Math.ceil(high / 2)));
    const gap = Math.max(1, Math.min(3, high - low || 1));
    const easierLow = Math.max(0, easierHigh - gap);
    const leftWasHigh = question.left >= question.right;
    const left = leftWasHigh ? easierHigh : easierLow;
    const right = leftWasHigh ? easierLow : easierHigh;
    return {
      id: `${question.id}:scaffold:compare:${left}:${right}`,
      operation: "comparison",
      left,
      right,
      answer: Math.max(left, right),
      difficulty,
    };
  }

  if (question.operation === "number_bond") {
    const target = Math.max(3, Math.min(10, question.right - (question.right > 10 ? 5 : 1)));
    const left = Math.min(Math.max(0, question.left), Math.max(0, target - 1));
    return {
      id: `${question.id}:scaffold:bond:${left}:${target}`,
      operation: "number_bond",
      left,
      right: target,
      answer: target - left,
      difficulty,
    };
  }

  if (question.operation === "addition") {
    // Keep the same operation but shrink one addend. Zero is an intentional
    // floor for already-minimal 1 + 1 style questions.
    const right = question.right <= 1 ? 0 : Math.min(3, question.right - 1);
    const left = Math.max(1, Math.min(question.left, 10));
    return {
      id: `${question.id}:scaffold:${left}+${right}`,
      operation: "addition",
      left,
      right,
      answer: left + right,
      difficulty,
    };
  }

  const right = question.right <= 1 ? 0 : Math.min(2, question.right - 1);
  const left = Math.max(right, Math.min(question.left, 12));
  return {
    id: `${question.id}:scaffold:${left}-${right}`,
    operation: "subtraction",
    left,
    right,
    answer: left - right,
    difficulty,
  };
}
