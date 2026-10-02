import type { AgentTaskKind, ReasoningLevel } from "../types.js";

/**
 * Future automatic routing can use this table, but v0.2.7 does NOT auto-escalate.
 * It is advisory telemetry only until representative evals exist.
 */
export const TASK_REASONING_HINTS: Readonly<Record<AgentTaskKind, ReasoningLevel>> = {
  child_phrase: "low",
  quest_recommendation: "low",
  activity_help: "low",
  lesson_hint: "low",
  lesson_explanation: "medium",
  knowledge_lesson: "low",
  knowledge_help: "low",
  lesson_plan: "medium",
  curriculum_authoring: "high",
};

export function taskForStage(stage: string): AgentTaskKind {
  if (stage === "learning:knowledge_help") return "knowledge_help";
  if (stage === "activity_help") return "activity_help";
  if (stage === "energy" || stage === "intent" || stage === "companion" || stage === "quest_started" || stage === "quest_completed" || stage === "verification_requested") return "child_phrase";
  return "quest_recommendation";
}
