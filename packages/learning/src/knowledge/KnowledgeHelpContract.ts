import type { ReadingLevel } from "../../../core/src/interaction-profile.js";
import type { SummerAgentProxyRequest } from "../../../agent/src/types.js";
import { getKnowledgeLesson, type KnowledgeLessonDefinition, type KnowledgeLessonQuestion } from "./KnowledgeLessonCatalog.js";

/** All rendered words are resolved from the shipped catalogue/runtime, never model prose. */
export interface KnowledgeHelpCue {
  id: string;
  kind: "visual" | "fact" | "strategy";
  targetId: string;
  icon: string;
  title: string;
  titleZh: string;
  text: string;
  textZh: string;
}
export type KnowledgeHelpFallback = "not_requested" | "disabled" | "timeout" | "provider_error" | "invalid_response" | "cancelled" | "interrupted" | "stale_context" | "local_choice";
export interface KnowledgeHelpResult {
  cueId: string;
  source: "local" | "remote";
  fallbackReason: KnowledgeHelpFallback | null;
  latencyMs: number | null;
  provider: string | null;
  model: string | null;
  profileId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
}
export interface KnowledgeHelpState {
  version: 1;
  requestId: string;
  revision: number;
  status: "ready" | "pending";
  remoteAttempted: boolean;
  initialFocusId: string | null;
  result: KnowledgeHelpResult;
}
export interface KnowledgeHelpView {
  cue: KnowledgeHelpCue;
  status: KnowledgeHelpState["status"];
  source: KnowledgeHelpResult["source"];
}
export function knowledgeHelpCues(lesson: KnowledgeLessonDefinition): KnowledgeHelpCue[] {
  return [
    ...lesson.visual.items.map((item): KnowledgeHelpCue => ({ id: `visual:${item.id}`, kind: "visual", targetId: item.id,
      icon: item.icon, title: item.label, titleZh: item.labelZh, text: item.note, textZh: item.noteZh })),
    ...lesson.facts.map((fact): KnowledgeHelpCue => ({ id: `fact:${fact.id}`, kind: "fact", targetId: fact.id,
      icon: fact.icon, title: lesson.title, titleZh: lesson.titleZh, text: fact.text, textZh: fact.textZh })),
  ].filter((cue) => cue.text.trim() && cue.textZh.trim());
}
/** Check-mode cues are deliberately generic. They never contain an option label, correctOptionId or explanation. */
export function knowledgeCheckHelpCues(question: KnowledgeLessonQuestion): KnowledgeHelpCue[] {
  return [
    { id: "strategy:remember", kind: "strategy", targetId: question.id, icon: "🧠", title: "Remember the lesson", titleZh: "想想剛才學到的",
      text: "Think back to the lesson clue that matches what the question is asking.", textZh: "想一想剛才課程裡，哪個線索和題目問的事情最有關。" },
    { id: "strategy:compare", kind: "strategy", targetId: question.id, icon: "🔎", title: "Compare the choices", titleZh: "比較每個選項",
      text: "Read the question again, then compare each choice with what you remember.", textZh: "再讀一次題目，然後把每個選項和你記得的內容比一比。" },
    { id: "strategy:eliminate", kind: "strategy", targetId: question.id, icon: "✋", title: "Rule one out", titleZh: "先排除一個",
      text: "Find one choice that does not fit the question. Then look at the choices that remain.", textZh: "先找出一個不符合題目的選項，再看看剩下的選項。" },
  ];
}
function result(cueId: string): KnowledgeHelpResult {
  return { cueId, source: "local", fallbackReason: "not_requested", latencyMs: null,
    provider: null, model: null, profileId: null, inputTokens: null, outputTokens: null, estimatedCostUsd: null };
}
export function localKnowledgeHelp(lesson: KnowledgeLessonDefinition, readingLevel: ReadingLevel, focusId?: string | null): KnowledgeHelpResult {
  const cues = knowledgeHelpCues(lesson);
  const cue = cues.find((item) => item.id === focusId)
    ?? cues.find((item) => item.kind === (readingLevel === "pre_reader" ? "visual" : "fact")) ?? cues[0];
  if (!cue) throw new Error("No approved knowledge help cue");
  return result(cue.id);
}
export function localKnowledgeCheckHelp(question: KnowledgeLessonQuestion, focusId?: string | null): KnowledgeHelpResult {
  const cues = knowledgeCheckHelpCues(question);
  const cue = cues.find((item) => item.id === focusId) ?? cues[0];
  if (!cue) throw new Error("No approved knowledge check help cue");
  return result(cue.id);
}
export function knowledgeHelpView(lesson: KnowledgeLessonDefinition, help?: KnowledgeHelpState): KnowledgeHelpView | null {
  if (!help || help.version !== 1 || !help.result) return null;
  const cue = knowledgeHelpCues(lesson).find((item) => item.id === help.result.cueId);
  return cue ? { cue, status: help.status, source: help.result.source } : null;
}
export function knowledgeCheckHelpView(question: KnowledgeLessonQuestion, help?: KnowledgeHelpState): KnowledgeHelpView | null {
  if (!help || help.version !== 1 || !help.result) return null;
  const cue = knowledgeCheckHelpCues(question).find((item) => item.id === help.result.cueId);
  return cue ? { cue, status: help.status, source: help.result.source } : null;
}
export function knowledgeHelpAgeBand(age: number): string {
  return age <= 4 ? "3-4" : age <= 6 ? "5-6" : age <= 9 ? "7-9" : age <= 12 ? "10-12" : "13+";
}
/** Server and client share the authoritative projection. Unknown context is discarded. */
export function canonicalKnowledgeHelpRequest(raw: SummerAgentProxyRequest): SummerAgentProxyRequest {
  if (raw.stage !== "learning:knowledge_help" || (raw.task != null && raw.task !== "knowledge_help")) throw new Error("Invalid knowledge help task");
  const lesson = typeof raw.context.lessonId === "string" ? getKnowledgeLesson(raw.context.lessonId) : null;
  if (!lesson || raw.context.domain !== lesson.domain) throw new Error("Unknown knowledge lesson");
  const readingLevel = raw.context.readingLevel;
  if (readingLevel !== "pre_reader" && readingLevel !== "early_reader" && readingLevel !== "reader") throw new Error("Invalid reading level");
  const ageBand = raw.context.ageBand;
  if (typeof ageBand !== "string" || !["3-4", "5-6", "7-9", "10-12", "13+"].includes(ageBand)) throw new Error("Invalid age band");
  if (raw.context.mode === "explore" && raw.context.phase === "intro") {
    const cues = knowledgeHelpCues(lesson);
    const focusId = typeof raw.context.focusId === "string" && cues.some((cue) => cue.id === raw.context.focusId) ? raw.context.focusId : null;
    return { version: 1, task: "knowledge_help", stage: "learning:knowledge_help", context: {
      domain: lesson.domain, lessonId: lesson.id, mode: "explore", phase: "intro", readingLevel, ageBand,
      language: "en-zh-TW", focusId,
      cues: cues.map(({ id, kind, title, titleZh, text, textZh }) => ({ id, kind, title, titleZh, text, textZh })),
    }, ...(raw.routing ? { routing: raw.routing } : {}) };
  }
  if (raw.context.mode === "check" && raw.context.phase === "question") {
    const questionId = typeof raw.context.questionId === "string" ? raw.context.questionId : "";
    const question = lesson.questions.find((item) => item.id === questionId);
    if (!question) throw new Error("Unknown knowledge check question");
    const cues = knowledgeCheckHelpCues(question);
    const focusId = typeof raw.context.focusId === "string" && cues.some((cue) => cue.id === raw.context.focusId) ? raw.context.focusId : null;
    return { version: 1, task: "knowledge_help", stage: "learning:knowledge_help", context: {
      domain: lesson.domain, lessonId: lesson.id, mode: "check", phase: "question", questionId: question.id,
      question: question.prompt, questionZh: question.promptZh, readingLevel, ageBand, language: "en-zh-TW", focusId,
      cues: cues.map(({ id, kind, title, titleZh, text, textZh }) => ({ id, kind, title, titleZh, text, textZh })),
    }, ...(raw.routing ? { routing: raw.routing } : {}) };
  }
  throw new Error("Knowledge help requires Explore intro or unanswered Check question");
}
