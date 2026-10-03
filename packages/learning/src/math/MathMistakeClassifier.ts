import type { LearningMistakeKind, MathQuestion } from "../types.js";

/**
 * Small deterministic diagnosis layer. It never decides grades or progression;
 * it only labels a locally-graded wrong answer so the tutor policy can choose
 * an appropriate support shape.
 */
export function classifyMathMistake(question: MathQuestion, childAnswer: number): LearningMistakeKind {
  if (!Number.isFinite(childAnswer)) return "unknown";
  if (childAnswer === question.answer) return "unknown";

  if (question.operation === "comparison") {
    const smaller = Math.min(question.left, question.right);
    return childAnswer === smaller ? "comparison_reversal" : "unknown";
  }

  if (question.operation === "number_bond") {
    if (childAnswer === question.left || childAnswer === question.right) return "number_bond_slip";
    const delta = Math.abs(question.answer - childAnswer);
    if (delta === 1) return "near_miss";
    if (delta <= 2) return "counting_slip";
    return "unknown";
  }

  if (question.operation === "multiplication") {
    if (childAnswer === question.left + question.right) return "operation_confusion";
    const delta = Math.abs(question.answer - childAnswer);
    if (delta === question.left || delta === question.right) return "skip_counting_slip";
    if (delta === 1) return "near_miss";
    if (delta <= 2) return "counting_slip";
    return "unknown";
  }

  const opposite = question.operation === "addition"
    ? question.left - question.right
    : question.left + question.right;
  if (childAnswer === opposite) return "operation_confusion";

  const delta = Math.abs(question.answer - childAnswer);
  if (delta === 1) return "near_miss";
  if (delta <= 2) return "counting_slip";
  return "unknown";
}
