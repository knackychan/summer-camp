import type { AgentTaskResponse, LessonHintAgentResponse, LessonHintStrategy, SummerAgentProxyRequest } from "../types.js";

export type EvalReadingLevel = "pre_reader" | "early_reader" | "reader";
export type EvalMathOperation = "addition" | "subtraction" | "multiplication";
export type LessonHintEvalDomain = "math" | "language";

export interface LessonHintEvalBaseInput {
  profileId: string;
  age: number;
  language: string;
  readingLevel: EvalReadingLevel;
  level: number;
}

export interface LessonHintEvalInput extends LessonHintEvalBaseInput {
  domain?: "math";
  operation: EvalMathOperation;
  left: number;
  right: number;
  childAnswer: number;
}

export interface VocabularyLessonHintEvalInput extends LessonHintEvalBaseInput {
  domain: "language";
  target: string;
  mode?: "recall" | "translate" | "sentences";
  emoji?: string;
  sourceFrench?: string;
  sourceChinese?: string;
  promptMode?: "fr" | "zh" | "both" | "picture";
  position?: number;
  revealed?: number;
}

export type AnyLessonHintEvalInput = LessonHintEvalInput | VocabularyLessonHintEvalInput;
export type LessonHintEvalScenarioInput = Omit<LessonHintEvalInput, "profileId"> | Omit<VocabularyLessonHintEvalInput, "profileId">;

export interface LessonHintEvalClient {
  request(request: SummerAgentProxyRequest): Promise<AgentTaskResponse>;
}

export interface LessonHintGuardrailResult {
  passed: boolean;
  score: number;
  strategyFitsDomain: boolean;
  answerLeakFree: boolean;
  textBudgetPass: boolean;
  issues: string[];
}

export interface LessonHintEvalResult {
  requestedProfileId: string;
  actualProfileId?: string;
  profileMatched: boolean;
  latencyMs: number;
  response: Extract<AgentTaskResponse, { kind: "lesson_hint" }>;
  guardrails: LessonHintGuardrailResult;
}

export interface LessonHintEvalScenario {
  id: string;
  label: string;
  description: string;
  input: LessonHintEvalScenarioInput;
}

const MATH_STRATEGIES = new Set<LessonHintStrategy>([
  "count_forward",
  "count_backward",
  "make_ten",
  "objects",
  "number_line",
  "equal_groups",
  "array",
  "skip_count",
  "compare_quantity",
  "missing_part",
  "retry",
]);

const LANGUAGE_STRATEGIES = new Set<LessonHintStrategy>([
  "first_letter",
  "next_letter",
  "word_shape",
  "picture_clue",
  "repeat_prompt",
  "sound_it_out",
  "retry",
]);

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

function ageBand(age: number): string {
  if (age <= 4) return "3-4";
  if (age <= 6) return "5-6";
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  return "13+";
}

function sanitizeLanguage(value: string): string {
  return String(value || "en").trim().slice(0, 12) || "en";
}

function requireProfileId(value: string): string {
  const profileId = String(value || "").trim();
  if (!profileId) throw new Error("A model profile is required");
  return profileId;
}

function normalizeWords(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function containsWholeNumber(value: string, number: number): boolean {
  const escaped = String(number).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^0-9-])${escaped}([^0-9]|$)`).test(value);
}

function leaksLanguageTarget(response: LessonHintAgentResponse, target: string): boolean {
  const cleanTarget = normalizeWords(target);
  if (cleanTarget.length < 2) return false;
  return normalizeWords(`${response.message} ${response.messageZh}`).includes(cleanTarget);
}

function isLanguageInput(input: AnyLessonHintEvalInput): input is VocabularyLessonHintEvalInput {
  return input.domain === "language";
}

function inputDomain(input: AnyLessonHintEvalInput): LessonHintEvalDomain {
  return isLanguageInput(input) ? "language" : "math";
}

export function buildLessonHintEvalRequest(input: LessonHintEvalInput): SummerAgentProxyRequest {
  const age = clampInt(input.age, 3, 17);
  const level = clampInt(input.level, 1, 10);
  const left = clampInt(input.left, 0, 999);
  const right = clampInt(input.right, 0, 999);
  const childAnswer = clampInt(input.childAnswer, -999, 1998);
  const correctAnswer = input.operation === "subtraction" ? left - right : input.operation === "multiplication" ? left * right : left + right;
  return {
    version: 1,
    stage: "learning:math_hint_eval",
    task: "lesson_hint",
    context: {
      ageBand: ageBand(age),
      language: sanitizeLanguage(input.language),
      readingLevel: input.readingLevel,
      domain: "math",
      skill: input.operation === "subtraction" ? "subtraction_eval" : input.operation === "multiplication" ? "multiplication_eval" : "addition_eval",
      level,
      question: { operation: input.operation, left, right, correctAnswer },
      childAnswer,
      recentAttempts: [],
      eval: true,
    },
    routing: { mode: "manual", profileId: requireProfileId(input.profileId) },
  };
}

export function buildVocabularyLessonHintEvalRequest(input: VocabularyLessonHintEvalInput): SummerAgentProxyRequest {
  const age = clampInt(input.age, 3, 17);
  const level = clampInt(input.level, 1, 10);
  const target = String(input.target || "").trim().slice(0, 80);
  if (!target) throw new Error("A vocabulary target is required");
  const position = clampInt(input.position ?? 0, 0, Math.max(0, [...target].length - 1));
  const revealed = clampInt(input.revealed ?? 0, 0, [...target].length);
  return {
    version: 1,
    stage: "learning:vocabulary_hint_eval",
    task: "lesson_hint",
    context: {
      ageBand: ageBand(age),
      language: sanitizeLanguage(input.language),
      readingLevel: input.readingLevel,
      domain: "language",
      skill: "vocabulary_eval",
      level,
      exercise: {
        type: "vocabulary",
        mode: input.mode ?? "recall",
        target,
        targetLength: [...target].length,
        isPhrase: target.includes(" "),
        ...(input.emoji ? { emoji: String(input.emoji).slice(0, 12) } : {}),
        ...(input.sourceFrench ? { sourceFrench: String(input.sourceFrench).slice(0, 80) } : {}),
        ...(input.sourceChinese ? { sourceChinese: String(input.sourceChinese).slice(0, 80) } : {}),
        promptMode: input.promptMode ?? "picture",
        position,
        revealed,
      },
      recentAttempts: [],
      eval: true,
    },
    routing: { mode: "manual", profileId: requireProfileId(input.profileId) },
  };
}

export function buildAnyLessonHintEvalRequest(input: AnyLessonHintEvalInput): SummerAgentProxyRequest {
  return input.domain === "language"
    ? buildVocabularyLessonHintEvalRequest(input)
    : buildLessonHintEvalRequest(input);
}

export function evaluateLessonHintGuardrails(
  input: AnyLessonHintEvalInput,
  response: LessonHintAgentResponse,
): LessonHintGuardrailResult {
  const domain = inputDomain(input);
  const strategyFitsDomain = domain === "language"
    ? LANGUAGE_STRATEGIES.has(response.strategy)
    : MATH_STRATEGIES.has(response.strategy);

  let answerLeakFree = true;
  if (isLanguageInput(input)) {
    answerLeakFree = !leaksLanguageTarget(response, input.target);
  } else {
    const left = clampInt(input.left, 0, 999);
    const right = clampInt(input.right, 0, 999);
    const correctAnswer = input.operation === "subtraction"
      ? left - right
      : input.operation === "multiplication"
      ? left * right
      : left + right;
    answerLeakFree = !containsWholeNumber(`${response.message} ${response.messageZh}`, correctAnswer);
  }

  const totalText = [...response.message, ...response.messageZh].length;
  const textBudget = input.readingLevel === "pre_reader" ? 90 : 220;
  const textBudgetPass = totalText <= textBudget;
  const issues: string[] = [];
  if (!strategyFitsDomain) issues.push("strategy_not_for_domain");
  if (!answerLeakFree) issues.push(domain === "language" ? "target_answer_leak" : "math_answer_leak");
  if (!textBudgetPass) issues.push("text_too_long_for_reading_level");

  const score = (strategyFitsDomain ? 35 : 0) + (answerLeakFree ? 45 : 0) + (textBudgetPass ? 20 : 0);
  return { passed: issues.length === 0, score, strategyFitsDomain, answerLeakFree, textBudgetPass, issues };
}

export async function runAnyLessonHintEval(
  client: LessonHintEvalClient,
  input: AnyLessonHintEvalInput,
  now: () => number = () => performance.now(),
): Promise<LessonHintEvalResult> {
  const started = now();
  const response = await client.request(buildAnyLessonHintEvalRequest(input));
  const latencyMs = Math.max(0, Math.round(now() - started));
  if (response.kind !== "lesson_hint") throw new Error("Evaluation returned the wrong response kind");
  const actualProfileId = response.usage?.profileId;
  return {
    requestedProfileId: input.profileId,
    ...(actualProfileId ? { actualProfileId } : {}),
    profileMatched: actualProfileId === input.profileId,
    latencyMs,
    response,
    guardrails: evaluateLessonHintGuardrails(input, response),
  };
}

export async function runLessonHintEval(
  client: LessonHintEvalClient,
  input: LessonHintEvalInput,
  now: () => number = () => performance.now(),
): Promise<LessonHintEvalResult> {
  return runAnyLessonHintEval(client, input, now);
}

export const LESSON_HINT_EVAL_SCENARIOS: readonly LessonHintEvalScenario[] = [
  {
    id: "math_add_early",
    label: "Math · near miss",
    description: "Early reader misses 8 + 7 by one.",
    input: {
      age: 7,
      language: "en",
      readingLevel: "early_reader",
      level: 2,
      operation: "addition",
      left: 8,
      right: 7,
      childAnswer: 14,
    },
  },
  {
    id: "math_multiply_groups",
    label: "Math · multiplication",
    description: "Early reader confuses multiplication with addition and needs equal-group support.",
    input: {
      age: 8,
      language: "en",
      readingLevel: "early_reader",
      level: 3,
      operation: "multiplication",
      left: 6,
      right: 4,
      childAnswer: 10,
    },
  },
  {
    id: "math_sub_prereader",
    label: "Math · pre-reader",
    description: "Pre-reader needs a very small visual/audio subtraction hint.",
    input: {
      age: 4,
      language: "en",
      readingLevel: "pre_reader",
      level: 1,
      operation: "subtraction",
      left: 9,
      right: 3,
      childAnswer: 7,
    },
  },
  {
    id: "vocab_picture_early",
    label: "Vocabulary · picture",
    description: "Early reader recalls apple from a picture without revealing the word.",
    input: {
      domain: "language",
      age: 7,
      language: "en",
      readingLevel: "early_reader",
      level: 2,
      target: "apple",
      mode: "recall",
      emoji: "🍎",
      sourceFrench: "pomme",
      sourceChinese: "蘋果",
      promptMode: "picture",
      position: 0,
      revealed: 0,
    },
  },
  {
    id: "vocab_prereader",
    label: "Vocabulary · pre-reader",
    description: "Pre-reader recalls dog with picture/audio-first guidance.",
    input: {
      domain: "language",
      age: 4,
      language: "en",
      readingLevel: "pre_reader",
      level: 1,
      target: "dog",
      mode: "recall",
      emoji: "🐶",
      sourceFrench: "chien",
      sourceChinese: "狗",
      promptMode: "picture",
      position: 0,
      revealed: 0,
    },
  },
] as const;
