import type { ReadingLevel } from "../../../core/src/interaction-profile.js";
import type { MathHintPresentation, MathHintStrategy, MathQuestion } from "../types.js";

export function buildMathHintPresentation(
  question: MathQuestion,
  strategy: MathHintStrategy,
  readingLevel: ReadingLevel,
): MathHintPresentation {
  const showText = readingLevel !== "pre_reader";
  const mode = showText ? "text_visual" : "visual_audio";
  const out: MathHintPresentation = { mode, strategy, showText };

  if (strategy === "equal_groups" || strategy === "array") {
    out.equalGroups = {
      groups: question.left,
      each: question.right,
      layout: strategy === "array" ? "array" : "groups",
    };
  }
  if (strategy === "skip_count") {
    out.skipCount = { step: question.left, count: question.right };
  }
  if (strategy === "compare_quantity") {
    out.comparison = [question.left, question.right];
  }
  if (strategy === "missing_part") {
    out.numberBond = { known: question.left, target: question.right };
  }
  if (strategy === "objects") {
    if (question.operation === "multiplication") {
      out.equalGroups = { groups: question.left, each: question.right, layout: "groups" };
    } else if (question.operation === "comparison") {
      out.comparison = [question.left, question.right];
    } else if (question.operation === "number_bond") {
      out.numberBond = { known: question.left, target: question.right };
    } else {
      out.objectGroups = [question.left, question.right];
      out.operator = question.operation === "addition" ? "+" : "−";
    }
  }
  if (strategy === "count_forward" || strategy === "count_backward" || strategy === "number_line") {
    if (question.operation === "comparison") {
      out.numberLine = {
        start: Math.min(question.left, question.right),
        direction: 1,
        steps: Math.abs(question.left - question.right),
      };
    } else if (question.operation === "number_bond") {
      out.numberLine = {
        start: question.left,
        direction: 1,
        steps: question.answer,
      };
    } else {
      out.numberLine = {
        start: question.left,
        direction: question.operation === "addition" ? 1 : -1,
        steps: question.right,
      };
    }
  }
  return out;
}
