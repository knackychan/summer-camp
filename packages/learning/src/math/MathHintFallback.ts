import type { LessonHintAgentResponse } from "../../../agent/src/types.js";
import type { MathHintStrategy, MathQuestion } from "../types.js";

function fallbackStrategy(question: MathQuestion, preferred: MathHintStrategy[]): MathHintStrategy {
  const first = preferred.find((strategy) => strategy !== "retry");
  if (first) return first;
  if (question.operation === "multiplication") return "equal_groups";
  if (question.operation === "comparison") return "compare_quantity";
  if (question.operation === "number_bond") return "missing_part";
  return question.operation === "addition" ? "count_forward" : "count_backward";
}

export function createLocalMathHint(
  question: MathQuestion,
  childAnswer: number,
  preferredStrategies: MathHintStrategy[] = [],
): LessonHintAgentResponse {
  const close = Math.abs(question.answer - childAnswer) === 1;
  const strategy = fallbackStrategy(question, preferredStrategies);

  if (strategy === "equal_groups" || strategy === "array") {
    return {
      kind: "lesson_hint",
      message: "Think of equal groups. How many are in all the groups together?",
      messageZh: "想成一樣大的幾組。全部合起來有多少？",
      strategy,
      emotion: "encouraging",
    };
  }
  if (strategy === "skip_count") {
    return {
      kind: "lesson_hint",
      message: "Skip-count by the first number, one group at a time.",
      messageZh: "每次跳第一個數字，一組一組往上數。",
      strategy,
      emotion: "encouraging",
    };
  }
  if (strategy === "compare_quantity") {
    return {
      kind: "lesson_hint",
      message: "Compare the two quantities. Which one reaches farther?",
      messageZh: "比較兩個數量。哪一個比較大？",
      strategy,
      emotion: "encouraging",
    };
  }
  if (strategy === "missing_part") {
    return {
      kind: "lesson_hint",
      message: "You know one part and the whole. What part is missing?",
      messageZh: "你知道一部分和總數。少了哪一部分？",
      strategy,
      emotion: "encouraging",
    };
  }
  if (strategy === "objects") {
    return {
      kind: "lesson_hint",
      message: question.operation === "number_bond"
        ? "Use the known part to find what is missing from the whole."
        : "Look at the groups. What does the sign ask you to do?",
      messageZh: question.operation === "number_bond"
        ? "用已知的一部分，找出總數裡還缺多少。"
        : "看看這些組。這個符號要你怎麼做？",
      strategy,
      emotion: "encouraging",
    };
  }
  if (strategy === "number_line") {
    let message = "Start at the first number and hop forward.";
    let messageZh = "從第一個數字開始，往前跳。";
    if (question.operation === "subtraction") {
      message = "Start at the first number and hop backward.";
      messageZh = "從第一個數字開始，往後跳。";
    } else if (question.operation === "comparison") {
      message = "Put both numbers on the line. Which one is farther to the right?";
      messageZh = "把兩個數字放到數線上。哪個比較靠右？";
    } else if (question.operation === "number_bond") {
      message = "Start with the known part and count up to the whole.";
      messageZh = "從已知部分開始，數到總數。";
    }
    return { kind: "lesson_hint", message, messageZh, strategy, emotion: "encouraging" };
  }
  if (close) {
    return {
      kind: "lesson_hint",
      message: "Very close. Count one step at a time.",
      messageZh: "很接近了，一步一步慢慢數。",
      strategy,
      emotion: "encouraging",
    };
  }
  return {
    kind: "lesson_hint",
    message: question.operation === "addition" ? "Start with the first number and count on." : "Try one smaller step and check the relationship between the numbers.",
    messageZh: question.operation === "addition" ? "從第一個數字開始，再往前數。" : "先做一個更小的步驟，再看看數字之間的關係。",
    strategy,
    emotion: "encouraging",
  };
}
