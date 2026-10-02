import type { ReadingLevel } from "../../../core/src/interaction-profile.js";
import { getCurriculumSkill, isCurriculumSkillId, type CurriculumSkillId } from "../curriculum/SkillCatalog.js";
import type { MathHintStrategy, MathQuestion } from "../types.js";

export type MathTeachVisual =
  | { kind: "objects"; left: number; right: number; operator: "+" | "−" }
  | { kind: "number_line"; start: number; end: number; jump: number; direction: 1 | -1 }
  | { kind: "comparison"; left: number; right: number }
  | { kind: "number_bond"; known: number; missing: number; total: number }
  | { kind: "equal_groups"; groups: number; each: number; total: number }
  | { kind: "array"; rows: number; columns: number; total: number };

export interface MathTeachScene {
  skill: CurriculumSkillId;
  strategy: MathHintStrategy;
  title: string;
  titleZh: string;
  message: string;
  messageZh: string;
  example: MathQuestion;
  exampleLabel: string;
  visual: MathTeachVisual;
  readingLevel: ReadingLevel;
}

interface SceneSeed {
  strategy: MathHintStrategy;
  question: MathQuestion;
  message: string;
  messageZh: string;
  visual: MathTeachVisual;
}

function seedForSkill(skill: CurriculumSkillId): SceneSeed | null {
  switch (skill) {
    case "math.addition.within_5":
      return {
        strategy: "objects",
        question: { id: "teach:add-5", operation: "addition", left: 2, right: 3, answer: 5, difficulty: 1 },
        message: "Put the two groups together, then count the whole group.",
        messageZh: "把兩組放在一起，再數一數全部有多少。",
        visual: { kind: "objects", left: 2, right: 3, operator: "+" },
      };
    case "math.addition.within_20":
      return {
        strategy: "number_line",
        question: { id: "teach:add-20", operation: "addition", left: 8, right: 5, answer: 13, difficulty: 2 },
        message: "Start at 8 and move 5 steps forward. Addition moves you to a larger number.",
        messageZh: "從 8 開始往前走 5 步。加法會把你帶到更大的數。",
        visual: { kind: "number_line", start: 8, end: 13, jump: 5, direction: 1 },
      };
    case "math.addition.within_100":
      return {
        strategy: "number_line",
        question: { id: "teach:add-100", operation: "addition", left: 34, right: 20, answer: 54, difficulty: 4 },
        message: "Add tens as one big jump: 34 plus 20 lands on 54.",
        messageZh: "把十位數當成大跳躍：34 加 20 會到 54。",
        visual: { kind: "number_line", start: 34, end: 54, jump: 20, direction: 1 },
      };
    case "math.addition.within_200":
      return {
        strategy: "number_line",
        question: { id: "teach:add-200", operation: "addition", left: 96, right: 30, answer: 126, difficulty: 6 },
        message: "Keep the ones in place and jump forward by tens: 96 plus 30 is three tens farther.",
        messageZh: "個位先不變，往前跳三個十：96 加 30 就是往前 3 個十。",
        visual: { kind: "number_line", start: 96, end: 126, jump: 30, direction: 1 },
      };
    case "math.subtraction.within_20":
      return {
        strategy: "number_line",
        question: { id: "teach:sub-20", operation: "subtraction", left: 14, right: 6, answer: 8, difficulty: 2 },
        message: "Subtraction moves backward. Start at 14 and move back 6 steps.",
        messageZh: "減法是往回走。從 14 開始往回走 6 步。",
        visual: { kind: "number_line", start: 14, end: 8, jump: 6, direction: -1 },
      };
    case "math.subtraction.within_100":
      return {
        strategy: "number_line",
        question: { id: "teach:sub-100", operation: "subtraction", left: 63, right: 20, answer: 43, difficulty: 4 },
        message: "Subtract tens with one backward jump: 63 minus 20 lands on 43.",
        messageZh: "減掉十位數可以往回大跳：63 減 20 會到 43。",
        visual: { kind: "number_line", start: 63, end: 43, jump: 20, direction: -1 },
      };
    case "math.number_comparison.within_20":
      return {
        strategy: "compare_quantity",
        question: { id: "teach:compare-20", operation: "comparison", left: 12, right: 17, answer: 17, difficulty: 2 },
        message: "The larger number makes the longer quantity. Compare how far each bar reaches.",
        messageZh: "比較大的數量會比較長。看看哪一條延伸得更遠。",
        visual: { kind: "comparison", left: 12, right: 17 },
      };
    case "math.number_comparison.within_100":
      return {
        strategy: "compare_quantity",
        question: { id: "teach:compare-100", operation: "comparison", left: 42, right: 71, answer: 71, difficulty: 3 },
        message: "Compare the tens first. Seven tens is more than four tens, so 71 is larger.",
        messageZh: "先比十位數。7 個十比 4 個十多，所以 71 比較大。",
        visual: { kind: "comparison", left: 42, right: 71 },
      };
    case "math.number_bonds.to_10":
      return {
        strategy: "missing_part",
        question: { id: "teach:bond-10", operation: "number_bond", left: 6, right: 10, answer: 4, difficulty: 2 },
        message: "A number bond has a whole and two parts. Ask what is missing to make the whole 10.",
        messageZh: "數字分合有一個整體和兩個部分。想想還差多少才能湊成 10。",
        visual: { kind: "number_bond", known: 6, missing: 4, total: 10 },
      };
    case "math.number_bonds.to_20":
      return {
        strategy: "missing_part",
        question: { id: "teach:bond-20", operation: "number_bond", left: 8, right: 17, answer: 9, difficulty: 2 },
        message: "Keep the whole in mind and find the missing part: 8 and 9 join to make 17.",
        messageZh: "先記住整體，再找缺少的部分：8 和 9 合起來是 17。",
        visual: { kind: "number_bond", known: 8, missing: 9, total: 17 },
      };
    case "math.multiplication.tables_2_5_10":
      return {
        strategy: "equal_groups",
        question: { id: "teach:times-foundation", operation: "multiplication", left: 5, right: 4, answer: 20, difficulty: 3 },
        message: "Multiplication means equal groups. Five groups of four have 20 altogether.",
        messageZh: "乘法就是一樣大的幾組。5 組、每組 4 個，全部是 20。",
        visual: { kind: "equal_groups", groups: 5, each: 4, total: 20 },
      };
    case "math.multiplication.tables_2_to_9":
      return {
        strategy: "array",
        question: { id: "teach:times-2-9", operation: "multiplication", left: 6, right: 4, answer: 24, difficulty: 4 },
        message: "An array keeps equal groups organized. Six rows of four make 24 dots.",
        messageZh: "陣列可以把相同大小的組排整齊。6 排、每排 4 個，一共有 24 個點。",
        visual: { kind: "array", rows: 6, columns: 4, total: 24 },
      };
    default:
      return null;
  }
}

export function createLocalMathTeachScene(skill: string, readingLevel: ReadingLevel): MathTeachScene | null {
  if (!isCurriculumSkillId(skill)) return null;
  const definition = getCurriculumSkill(skill);
  if (!definition || definition.domain !== "math") return null;
  const seed = seedForSkill(skill);
  if (!seed) return null;
  const exampleLabel = seed.question.operation === "number_bond"
    ? `${seed.question.left} + ? = ${seed.question.right}`
    : seed.question.operation === "comparison"
    ? `${seed.question.left}  ?  ${seed.question.right}`
    : `${seed.question.left} ${seed.question.operation === "addition" ? "+" : seed.question.operation === "subtraction" ? "−" : "×"} ${seed.question.right} = ${seed.question.answer}`;
  let message = seed.message;
  let messageZh = seed.messageZh;
  if (readingLevel === "pre_reader") {
    if (seed.visual.kind === "objects") { message = "Put together. Count all."; messageZh = "合起來，數全部。"; }
    else if (seed.visual.kind === "number_line") { message = seed.visual.direction > 0 ? "Jump forward." : "Jump backward."; messageZh = seed.visual.direction > 0 ? "往前跳。" : "往回跳。"; }
    else if (seed.visual.kind === "comparison") { message = "Which is longer?"; messageZh = "哪一個比較長？"; }
    else if (seed.visual.kind === "number_bond") { message = "Find the missing part."; messageZh = "找缺少的一塊。"; }
    else { message = "Same groups. Count all."; messageZh = "一樣多的組，數全部。"; }
  }
  return {
    skill,
    strategy: seed.strategy,
    title: `Learn · ${definition.shortLabel}`,
    titleZh: `先學會 · ${definition.shortLabelZh}`,
    message,
    messageZh,
    example: { ...seed.question },
    exampleLabel,
    visual: { ...seed.visual } as MathTeachVisual,
    readingLevel,
  };
}
