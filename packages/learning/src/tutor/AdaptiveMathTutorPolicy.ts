import type {
  LearningMistakeKind,
  LearningSessionState,
  MathHintStrategy,
  MathQuestion,
  MathTutorIntervention,
} from "../types.js";
import { classifyMathMistake } from "../math/MathMistakeClassifier.js";
import { createEasierMathFollowUp } from "../math/MathScaffold.js";

export interface AdaptiveMathTutorInput {
  session: LearningSessionState;
  question: MathQuestion;
  childAnswer: number;
}

function defaultTinyStrategies(question: MathQuestion, mistake: LearningMistakeKind): MathHintStrategy[] {
  if (question.operation === "multiplication") {
    if (mistake === "skip_counting_slip") return ["skip_count", "equal_groups"];
    return ["equal_groups", "skip_count"];
  }
  if (question.operation === "comparison") return ["compare_quantity", "number_line"];
  if (question.operation === "number_bond") return ["missing_part", "objects"];
  if (mistake === "near_miss" || mistake === "counting_slip") {
    return [question.operation === "addition" ? "count_forward" : "count_backward", "number_line"];
  }
  return [question.operation === "addition" ? "count_forward" : "count_backward", "retry"];
}

function visualStrategies(question: MathQuestion): MathHintStrategy[] {
  if (question.operation === "multiplication") return ["array", "equal_groups"];
  if (question.operation === "comparison") return ["compare_quantity", "number_line"];
  if (question.operation === "number_bond") return ["missing_part", "objects"];
  return ["objects", "number_line"];
}

/**
 * Deterministic tutoring policy. The model may phrase an approved hint later,
 * but cannot choose whether the learner advances, changes level, or receives
 * a scaffold question.
 */
export function chooseMathTutorIntervention(input: AdaptiveMathTutorInput): MathTutorIntervention {
  const mistake = classifyMathMistake(input.question, input.childAnswer);
  const recent = input.session.attempts.slice(-5);
  const recentThree = recent.slice(-3);
  const recentCorrect = recent.filter((attempt) => attempt.correct).length;
  const recentWrong = recentThree.filter((attempt) => !attempt.correct).length;
  const recentHinted = recentThree.filter((attempt) => attempt.hintsUsed > 0).length;
  const repeatedSame = recentThree.filter((attempt) => !attempt.correct && attempt.mistake === mistake).length;

  // One small slip after a strong run already received the game's corrective feedback.
  if (recent.length >= 4 && recentCorrect >= 4 && (mistake === "near_miss" || mistake === "counting_slip")) {
    return {
      kind: "continue",
      mistake,
      reason: "near_miss_after_success",
      preferredStrategies: [],
    };
  }

  // Using addition for multiplication, or mixing up + and −, deserves a concrete representation immediately.
  if (mistake === "operation_confusion") {
    return {
      kind: "visual_explanation",
      mistake,
      reason: "operation_confusion",
      preferredStrategies: visualStrategies(input.question),
    };
  }

  // Three struggling attempts including the current one -> reduce one step.
  if (recentWrong >= 2 || recentHinted >= 2 || (recent.length >= 3 && input.session.lastAdaptation === "level_down")) {
    return {
      kind: "easier_follow_up",
      mistake,
      reason: "repeated_errors",
      preferredStrategies: visualStrategies(input.question),
      easierQuestion: createEasierMathFollowUp(input.question),
    };
  }

  // The same diagnosed slip twice is likely a pattern, not random noise.
  if (repeatedSame >= 1 && mistake !== "unknown") {
    return {
      kind: "visual_explanation",
      mistake,
      reason: "repeated_pattern",
      preferredStrategies: visualStrategies(input.question),
    };
  }

  // First/isolated error: keep intervention small and optional.
  return {
    kind: "tiny_hint",
    mistake,
    reason: recent.length === 0 ? "isolated_error" : "needs_support",
    preferredStrategies: defaultTinyStrategies(input.question, mistake),
  };
}
