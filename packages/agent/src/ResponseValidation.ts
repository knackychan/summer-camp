import type {
  AgentTaskKind,
  AgentTaskResponse,
  LessonExplanationAgentResponse,
  LessonHintAgentResponse,
  LessonHintStrategy,
  KnowledgeLessonAgentResponse,
  KnowledgeHelpAgentResponse,
  SummerAgentProxyResponse,
  SummerAgentUsage,
} from "./types.js";

const KINDS = new Set(["question", "recommendation", "companion", "status"]);
const EMOTIONS = new Set(["neutral", "thinking", "happy", "excited", "proud", "encouraging", "surprised", "celebrate", "sleepy", "attention"]);
const LESSON_EMOTIONS = new Set(["thinking", "happy", "encouraging"]);
const LESSON_STRATEGIES = new Set<LessonHintStrategy>(["count_forward", "count_backward", "make_ten", "objects", "number_line", "equal_groups", "array", "skip_count", "compare_quantity", "missing_part", "first_letter", "next_letter", "word_shape", "picture_clue", "repeat_prompt", "sound_it_out", "retry"]);
const ANIMATIONS = new Set(["idle", "blink", "lean_in", "small_hop", "double_hop", "thinking_loop", "celebrate", "wave"]);
const ACTIONS = new Set(["resume_quest", "quest_board", "activity_help", "today", "close"]);
const KNOWLEDGE_PRESENTATIONS = new Set(["visual_first", "compare_first", "story_first"]);
const KNOWLEDGE_ENCOURAGEMENTS = new Set(["curious", "detective", "explorer"]);


function text(value: unknown, max = 220): string {
  return typeof value === "string" ? value.replace(/[<>]/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

function applyMeta<T extends { provider?: string; usage?: SummerAgentUsage }>(value: Record<string, unknown>, out: T): void {
  const provider = text(value.provider, 80);
  if (provider) out.provider = provider;
  if (!value.usage || typeof value.usage !== "object") return;
  const usageRaw = value.usage as Record<string, unknown>;
  const providerId = usageRaw.provider;
  if (providerId !== "openai" && providerId !== "anthropic" && providerId !== "openrouter") return;
  const model = text(usageRaw.model, 120);
  const profileId = text(usageRaw.profileId, 120);
  if (!model || !profileId) return;
  const usage: SummerAgentUsage = { provider: providerId, model, profileId };
  const numeric = (key: "inputTokens" | "outputTokens" | "estimatedCostUsd") => {
    if (typeof usageRaw[key] !== "number") return;
    const n = usageRaw[key];
    if (Number.isFinite(n) && n >= 0) usage[key] = n;
  };
  numeric("inputTokens"); numeric("outputTokens"); numeric("estimatedCostUsd");
  out.usage = usage;
}

export function validateSummerResponse(raw: unknown): SummerAgentProxyResponse {
  if (!raw || typeof raw !== "object") throw new Error("Provider returned no object");
  const value = raw as Record<string, unknown>;
  const speech = text(value.speech);
  const speechZh = text(value.speechZh);
  if (!speech || !speechZh) throw new Error("Provider response requires bilingual speech");
  const kind = typeof value.kind === "string" && KINDS.has(value.kind) ? value.kind as SummerAgentProxyResponse["kind"] : "companion";
  const out: SummerAgentProxyResponse = { kind, speech, speechZh };
  if (typeof value.emotion === "string" && EMOTIONS.has(value.emotion)) out.emotion = value.emotion;
  if (typeof value.animation === "string" && ANIMATIONS.has(value.animation)) out.animation = value.animation;
  if (Array.isArray(value.questIds)) out.questIds = value.questIds.map((id) => text(id, 80)).filter(Boolean).slice(0, 4);
  if (Array.isArray(value.actions)) out.actions = value.actions.map((id) => text(id, 40)).filter((id) => ACTIONS.has(id)).slice(0, 4);
  if (typeof value.questionId === "string") out.questionId = text(value.questionId, 40);
  if (Array.isArray(value.choices)) {
    out.choices = value.choices.slice(0, 6).map((choice) => {
      const c = choice && typeof choice === "object" ? choice as Record<string, unknown> : {};
      const labelRaw = c.label;
      const label: string | [string, string] = Array.isArray(labelRaw)
        ? [text(labelRaw[0], 60), text(labelRaw[1], 60)]
        : text(labelRaw, 60);
      return { id: text(c.id, 40), icon: text(c.icon, 8), label };
    }).filter((choice) => choice.id && (Array.isArray(choice.label) ? choice.label[0] : choice.label));
  }
  applyMeta(value, out);
  return out;
}

export function validateLessonHintResponse(raw: unknown): LessonHintAgentResponse {
  if (!raw || typeof raw !== "object") throw new Error("Provider returned no lesson hint object");
  const value = raw as Record<string, unknown>;
  const message = text(value.message, 140);
  const messageZh = text(value.messageZh, 140);
  if (!message || !messageZh) throw new Error("Lesson hint response requires bilingual messages");
  if (value.kind !== "lesson_hint") throw new Error("Lesson hint response kind is invalid");
  if (typeof value.strategy !== "string" || !LESSON_STRATEGIES.has(value.strategy as LessonHintStrategy)) throw new Error("Lesson hint strategy is invalid");
  const out: LessonHintAgentResponse = {
    kind: "lesson_hint",
    message,
    messageZh,
    strategy: value.strategy as LessonHintStrategy,
  };
  if (typeof value.emotion === "string" && LESSON_EMOTIONS.has(value.emotion)) out.emotion = value.emotion as "thinking" | "happy" | "encouraging";
  applyMeta(value, out);
  return out;
}


export function validateLessonExplanationResponse(raw: unknown): LessonExplanationAgentResponse {
  if (!raw || typeof raw !== "object") throw new Error("Provider returned no lesson explanation object");
  const value = raw as Record<string, unknown>;
  const message = text(value.message, 220);
  const messageZh = text(value.messageZh, 220);
  if (!message || !messageZh) throw new Error("Lesson explanation requires bilingual messages");
  if (value.kind !== "lesson_explanation") throw new Error("Lesson explanation response kind is invalid");
  if (typeof value.strategy !== "string" || !LESSON_STRATEGIES.has(value.strategy as LessonHintStrategy)) throw new Error("Lesson explanation strategy is invalid");
  const out: LessonExplanationAgentResponse = {
    kind: "lesson_explanation",
    message,
    messageZh,
    strategy: value.strategy as LessonHintStrategy,
  };
  if (typeof value.emotion === "string" && LESSON_EMOTIONS.has(value.emotion)) out.emotion = value.emotion as "thinking" | "happy" | "encouraging";
  applyMeta(value, out);
  return out;
}


export function validateKnowledgeLessonResponse(raw: unknown): KnowledgeLessonAgentResponse {
  if (!raw || typeof raw !== "object") throw new Error("Provider returned no knowledge lesson object");
  const value = raw as Record<string, unknown>;
  if (value.kind !== "knowledge_lesson_plan") throw new Error("Knowledge lesson response kind is invalid");
  const ids = (rawIds: unknown, max: number): string[] => Array.isArray(rawIds)
    ? rawIds.map((id) => text(id, 100)).filter(Boolean).slice(0, max)
    : [];
  const factIds = ids(value.factIds, 3);
  const questionIds = ids(value.questionIds, 3);
  if (factIds.length < 2 || new Set(factIds).size !== factIds.length) throw new Error("Knowledge lesson fact IDs are invalid");
  if (questionIds.length < 2 || new Set(questionIds).size !== questionIds.length) throw new Error("Knowledge lesson question IDs are invalid");
  if (typeof value.presentation !== "string" || !KNOWLEDGE_PRESENTATIONS.has(value.presentation)) throw new Error("Knowledge lesson presentation is invalid");
  if (typeof value.encouragement !== "string" || !KNOWLEDGE_ENCOURAGEMENTS.has(value.encouragement)) throw new Error("Knowledge lesson encouragement is invalid");
  const out: KnowledgeLessonAgentResponse = {
    kind: "knowledge_lesson_plan",
    factIds,
    questionIds,
    presentation: value.presentation as KnowledgeLessonAgentResponse["presentation"],
    encouragement: value.encouragement as KnowledgeLessonAgentResponse["encouragement"],
  };
  applyMeta(value, out);
  return out;
}

export function validateKnowledgeHelpResponse(raw: unknown): KnowledgeHelpAgentResponse {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("No knowledge help object");
  const value = raw as Record<string, unknown>;
  if (value.kind !== "knowledge_help" || typeof value.cueId !== "string" || !/^(visual|fact|strategy):[a-zA-Z0-9_-]{1,100}$/.test(value.cueId)
    || Object.keys(value).some((key) => !["kind", "cueId", "provider", "usage"].includes(key))) throw new Error("Invalid knowledge help selection");
  const out: KnowledgeHelpAgentResponse = { kind: "knowledge_help", cueId: value.cueId };
  applyMeta(value, out);
  return out;
}
export const KNOWLEDGE_HELP_RESPONSE_JSON_SCHEMA = {
  type: "object", additionalProperties: false, required: ["kind", "cueId"],
  properties: { kind: { type: "string", const: "knowledge_help" }, cueId: { type: "string", maxLength: 107 } },
} as const;

export function validateAgentResponse(task: AgentTaskKind, raw: unknown): AgentTaskResponse {
  if (task === "knowledge_help") return validateKnowledgeHelpResponse(raw);
  if (task === "lesson_hint") return validateLessonHintResponse(raw);
  if (task === "lesson_explanation") return validateLessonExplanationResponse(raw);
  if (task === "knowledge_lesson") return validateKnowledgeLessonResponse(raw);
  return validateSummerResponse(raw);
}

export const SUMMER_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "speech", "speechZh"],
  properties: {
    kind: { type: "string", enum: ["question", "recommendation", "companion", "status"] },
    speech: { type: "string", maxLength: 220 },
    speechZh: { type: "string", maxLength: 220 },
    emotion: { type: "string", enum: ["neutral", "thinking", "happy", "excited", "proud", "encouraging", "surprised", "celebrate", "sleepy", "attention"] },
    animation: { type: "string", enum: ["idle", "blink", "lean_in", "small_hop", "double_hop", "thinking_loop", "celebrate", "wave"] },
    questIds: { type: "array", maxItems: 4, items: { type: "string" } },
    actions: { type: "array", maxItems: 4, items: { type: "string", enum: ["resume_quest", "quest_board", "activity_help", "today", "close"] } },
    questionId: { type: "string" },
    choices: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: {
          id: { type: "string" },
          icon: { type: "string" },
          label: {
            anyOf: [
              { type: "string" },
              { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } },
            ],
          },
        },
      },
    },
  },
} as const;

export const LESSON_HINT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "message", "messageZh", "strategy"],
  properties: {
    kind: { type: "string", const: "lesson_hint" },
    message: { type: "string", maxLength: 140 },
    messageZh: { type: "string", maxLength: 140 },
    strategy: {
      type: "string",
      enum: ["count_forward", "count_backward", "make_ten", "objects", "number_line", "equal_groups", "array", "skip_count", "compare_quantity", "missing_part", "first_letter", "next_letter", "word_shape", "picture_clue", "repeat_prompt", "sound_it_out", "retry"],
    },
    emotion: { type: "string", enum: ["thinking", "happy", "encouraging"] },
  },
} as const;


export const LESSON_EXPLANATION_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "message", "messageZh", "strategy"],
  properties: {
    kind: { type: "string", const: "lesson_explanation" },
    message: { type: "string", maxLength: 220 },
    messageZh: { type: "string", maxLength: 220 },
    strategy: {
      type: "string",
      enum: ["count_forward", "count_backward", "make_ten", "objects", "number_line", "equal_groups", "array", "skip_count", "compare_quantity", "missing_part", "first_letter", "next_letter", "word_shape", "picture_clue", "repeat_prompt", "sound_it_out", "retry"],
    },
    emotion: { type: "string", enum: ["thinking", "happy", "encouraging"] },
  },
} as const;


export const KNOWLEDGE_LESSON_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "factIds", "questionIds", "presentation", "encouragement"],
  properties: {
    kind: { type: "string", const: "knowledge_lesson_plan" },
    factIds: { type: "array", minItems: 2, maxItems: 3, uniqueItems: true, items: { type: "string", maxLength: 100 } },
    questionIds: { type: "array", minItems: 2, maxItems: 3, uniqueItems: true, items: { type: "string", maxLength: 100 } },
    presentation: { type: "string", enum: ["visual_first", "compare_first", "story_first"] },
    encouragement: { type: "string", enum: ["curious", "detective", "explorer"] },
  },
} as const;

export function responseJsonSchemaForTask(task: AgentTaskKind) {
  if (task === "knowledge_help") return KNOWLEDGE_HELP_RESPONSE_JSON_SCHEMA;
  if (task === "lesson_hint") return LESSON_HINT_RESPONSE_JSON_SCHEMA;
  if (task === "lesson_explanation") return LESSON_EXPLANATION_RESPONSE_JSON_SCHEMA;
  if (task === "knowledge_lesson") return KNOWLEDGE_LESSON_RESPONSE_JSON_SCHEMA;
  return SUMMER_RESPONSE_JSON_SCHEMA;
}
