import type { ReadingLevel } from "../../../core/src/interaction-profile.js";
import { getKnowledgeLesson, type KnowledgeLessonDefinition, type KnowledgeLessonQuestion } from "./KnowledgeLessonCatalog.js";

import { knowledgeCheckHelpView, knowledgeHelpView, type KnowledgeHelpState, type KnowledgeHelpView } from "./KnowledgeHelpContract.js";

export type KnowledgeLessonPresentation = "visual_first" | "compare_first" | "story_first";
export type KnowledgeLessonEncouragement = "curious" | "detective" | "explorer";
export type KnowledgeLessonPhase = "intro" | "question" | "complete";
export type KnowledgeLessonMode = "explore" | "check";
export type KnowledgeLessonFlow = "free" | "director";

export interface KnowledgeLessonPlan {
  source: "remote" | "local_fallback";
  factIds: string[];
  questionIds: string[];
  presentation: KnowledgeLessonPresentation;
  encouragement: KnowledgeLessonEncouragement;
  provider?: string;
  model?: string;
  profileId?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  remoteError?: string;
}

export interface KnowledgeLessonAnswer {
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
  responseMs: number;
  answeredAt: number;
}

export interface KnowledgeLessonSession {
  version: 1;
  id: string;
  learnerId: string;
  lessonId: string;
  skill: string;
  readingLevel: ReadingLevel;
  mode: KnowledgeLessonMode;
  flow: KnowledgeLessonFlow;
  directorSessionId?: string;
  directorStepId?: string;
  directorRunId?: string;
  phase: KnowledgeLessonPhase;
  plan: KnowledgeLessonPlan;
  questionIndex: number;
  answers: KnowledgeLessonAnswer[];
  adaptationAttempted: boolean;
  help?: KnowledgeHelpState;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface KnowledgeLessonSnapshot {
  session: KnowledgeLessonSession;
  lesson: KnowledgeLessonDefinition;
  facts: KnowledgeLessonDefinition["facts"];
  help?: KnowledgeHelpView;
  currentQuestion: KnowledgeLessonQuestion | null;
  currentAnswer: KnowledgeLessonAnswer | null;
  score: number;
  totalQuestions: number;
}

function cleanIds(ids: string[], allowed: Set<string>, min: number, max: number): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!allowed.has(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out.length >= min ? out : [];
}

function presentationFor(lesson: KnowledgeLessonDefinition): KnowledgeLessonPresentation {
  if (["classify", "states", "land_water", "environment", "past_present", "sources", "civilization"].includes(lesson.visual.kind)) return "compare_first";
  if (["cycle", "sequence", "orbit", "compass", "map", "globe", "timeline", "change"].includes(lesson.visual.kind)) return "visual_first";
  return "story_first";
}

export function createLocalKnowledgeLessonPlan(lesson: KnowledgeLessonDefinition): KnowledgeLessonPlan {
  return {
    source: "local_fallback",
    factIds: lesson.facts.map((fact) => fact.id).slice(0, 3),
    questionIds: lesson.questions.map((question) => question.id).slice(0, 3),
    presentation: presentationFor(lesson),
    encouragement: lesson.domain === "history" || (lesson.domain === "science" && (lesson.topic === "animals" || lesson.topic === "body")) ? "detective" : "explorer",
  };
}

export function createKnowledgeLessonSession(input: {
  learnerId: string;
  lessonId: string;
  readingLevel: ReadingLevel;
  mode?: KnowledgeLessonMode;
  flow?: KnowledgeLessonFlow;
  directorSessionId?: string;
  directorStepId?: string;
  directorRunId?: string;
  now?: number;
}): KnowledgeLessonSession | null {
  const lesson = getKnowledgeLesson(input.lessonId);
  if (!lesson) return null;
  const now = input.now ?? Date.now();
  const mode: KnowledgeLessonMode = input.mode === "check" ? "check" : "explore";
  const flow: KnowledgeLessonFlow = input.flow === "director" ? "director" : "free";
  return {
    version: 1,
    id: `knowledge-${input.learnerId}-${lesson.id}-${now.toString(36)}`,
    learnerId: input.learnerId,
    lessonId: lesson.id,
    skill: lesson.skill,
    readingLevel: input.readingLevel,
    mode,
    flow,
    ...(flow === "director" && input.directorSessionId ? { directorSessionId: input.directorSessionId } : {}),
    ...(flow === "director" && input.directorStepId ? { directorStepId: input.directorStepId } : {}),
    ...(flow === "director" && input.directorRunId ? { directorRunId: input.directorRunId } : {}),
    phase: mode === "check" ? "question" : "intro",
    plan: createLocalKnowledgeLessonPlan(lesson),
    questionIndex: 0,
    answers: [],
    adaptationAttempted: mode === "check",
    startedAt: now,
    updatedAt: now,
  };
}

export function applyKnowledgeLessonPlan(
  session: KnowledgeLessonSession,
  plan: KnowledgeLessonPlan,
  now = Date.now(),
): KnowledgeLessonSession {
  const lesson = getKnowledgeLesson(session.lessonId);
  if (!lesson || session.mode === "check" || session.phase !== "intro" || session.answers.length) return session;
  const factIds = cleanIds(plan.factIds, new Set(lesson.facts.map((fact) => fact.id)), 2, 3);
  const questionIds = cleanIds(plan.questionIds, new Set(lesson.questions.map((question) => question.id)), 2, 3);
  if (!factIds.length || !questionIds.length) return { ...session, adaptationAttempted: true, updatedAt: now };
  return {
    ...session,
    plan: { ...plan, factIds, questionIds },
    adaptationAttempted: true,
    updatedAt: now,
  };
}

export function markKnowledgeAdaptationAttempted(session: KnowledgeLessonSession, now = Date.now()): KnowledgeLessonSession {
  if (session.adaptationAttempted) return session;
  return { ...session, adaptationAttempted: true, updatedAt: now };
}

export function currentKnowledgeQuestion(session: KnowledgeLessonSession): KnowledgeLessonQuestion | null {
  if (session.phase !== "question") return null;
  const lesson = getKnowledgeLesson(session.lessonId);
  if (!lesson) return null;
  const id = session.plan.questionIds[session.questionIndex];
  return lesson.questions.find((question) => question.id === id) ?? null;
}

export function answerKnowledgeQuestion(
  session: KnowledgeLessonSession,
  selectedOptionId: string,
  responseMs: number,
  now = Date.now(),
): KnowledgeLessonSession {
  const question = currentKnowledgeQuestion(session);
  if (!question) return session;
  if (session.answers.some((answer) => answer.questionId === question.id)) return session;
  const optionExists = question.options.some((option) => option.id === selectedOptionId);
  if (!optionExists) return session;
  const answer: KnowledgeLessonAnswer = {
    questionId: question.id,
    selectedOptionId,
    correct: selectedOptionId === question.correctOptionId,
    responseMs: Math.max(0, Math.min(3_600_000, Math.round(Number(responseMs) || 0))),
    answeredAt: now,
  };
  return { ...session, answers: [...session.answers, answer], updatedAt: now };
}

export function advanceKnowledgeLesson(session: KnowledgeLessonSession, now = Date.now()): KnowledgeLessonSession {
  if (session.phase === "complete") return session;
  if (session.phase === "intro") return { ...session, phase: "question", questionIndex: 0, updatedAt: now };
  const question = currentKnowledgeQuestion(session);
  if (!question) return { ...session, phase: "complete", completedAt: now, updatedAt: now };
  const answered = session.answers.some((answer) => answer.questionId === question.id);
  if (!answered) return session;
  if (session.questionIndex + 1 >= session.plan.questionIds.length) {
    return { ...session, phase: "complete", completedAt: now, updatedAt: now };
  }
  const { help: _help, ...rest } = session;
  return { ...rest, questionIndex: session.questionIndex + 1, updatedAt: now };
}

export function knowledgeLessonSnapshot(session: KnowledgeLessonSession): KnowledgeLessonSnapshot | null {
  const lesson = getKnowledgeLesson(session.lessonId);
  if (!lesson) return null;
  const factMap = new Map(lesson.facts.map((fact) => [fact.id, fact]));
  const facts = session.plan.factIds.map((id) => factMap.get(id)).filter((fact): fact is KnowledgeLessonDefinition["facts"][number] => !!fact);
  const currentQuestion = currentKnowledgeQuestion(session);
  const currentAnswer = currentQuestion ? session.answers.find((answer) => answer.questionId === currentQuestion.id) ?? null : null;
  const help = session.mode === "explore" && session.phase === "intro"
    ? knowledgeHelpView(lesson, session.help)
    : session.mode === "check" && session.phase === "question" && currentQuestion && !currentAnswer
      ? knowledgeCheckHelpView(currentQuestion, session.help) : null;
  return {
    ...(help ? { help } : {}),
    session,
    lesson,
    facts,
    currentQuestion,
    currentAnswer,
    score: session.answers.filter((answer) => answer.correct).length,
    totalQuestions: session.plan.questionIds.length,
  };
}
