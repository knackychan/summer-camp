export type LlmProviderId = "openai" | "anthropic" | "openrouter";
export type ReasoningLevel = "none" | "low" | "medium" | "high";
export type ModelCostClass = "free" | "ultra_low" | "low" | "standard" | "premium";

export type AgentTaskKind =
  | "child_phrase"
  | "quest_recommendation"
  | "activity_help"
  | "lesson_hint"
  | "lesson_explanation"
  | "knowledge_lesson"
  | "knowledge_help"
  | "lesson_plan"
  | "curriculum_authoring";

export interface ModelProfile {
  id: string;
  provider: LlmProviderId;
  model: string;
  reasoning: ReasoningLevel;
  costClass: ModelCostClass;
  productionAllowed: boolean;
  label: string;
  notes?: string;
  pricing?: {
    currency: "USD";
    inputPerMillion: number;
    outputPerMillion: number;
    reviewedOn: string;
  };
}

export interface ManualRoutingConfig {
  mode: "manual";
  profileId: string;
  allowDevelopmentProfiles?: boolean;
}

export interface AgentRoutingDecision {
  profile: ModelProfile;
  task: AgentTaskKind;
  reason: "manual_profile";
}

export interface SummerAgentProxyRequest {
  version: 1;
  stage: string;
  context: Record<string, unknown>;
  task?: AgentTaskKind;
  routing?: Partial<ManualRoutingConfig>;
}

export interface SummerAgentUsage {
  provider: LlmProviderId;
  model: string;
  profileId: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

export interface AgentResponseMeta {
  provider?: string;
  usage?: SummerAgentUsage;
}

export interface SummerAgentProxyResponse extends AgentResponseMeta {
  kind: "question" | "recommendation" | "companion" | "status";
  speech: string;
  speechZh: string;
  emotion?: string;
  animation?: string;
  questIds?: string[];
  actions?: string[];
  questionId?: string;
  choices?: Array<{
    id: string;
    icon?: string;
    label: string | [string, string];
  }>;
}

export type LessonHintStrategy =
  | "count_forward"
  | "count_backward"
  | "make_ten"
  | "objects"
  | "number_line"
  | "equal_groups"
  | "array"
  | "skip_count"
  | "compare_quantity"
  | "missing_part"
  | "first_letter"
  | "next_letter"
  | "word_shape"
  | "picture_clue"
  | "repeat_prompt"
  | "sound_it_out"
  | "retry";

export interface LessonHintAgentResponse extends AgentResponseMeta {
  kind: "lesson_hint";
  message: string;
  messageZh: string;
  strategy: LessonHintStrategy;
  emotion?: "thinking" | "happy" | "encouraging";
}

export interface LessonExplanationAgentResponse extends AgentResponseMeta {
  kind: "lesson_explanation";
  message: string;
  messageZh: string;
  strategy: LessonHintStrategy;
  emotion?: "thinking" | "happy" | "encouraging";
}


export type KnowledgeLessonPresentation = "visual_first" | "compare_first" | "story_first";
export type KnowledgeLessonEncouragement = "curious" | "detective" | "explorer";

export interface KnowledgeLessonAgentResponse extends AgentResponseMeta {
  kind: "knowledge_lesson_plan";
  factIds: string[];
  questionIds: string[];
  presentation: KnowledgeLessonPresentation;
  encouragement: KnowledgeLessonEncouragement;
}

export interface KnowledgeHelpAgentResponse extends AgentResponseMeta {
  kind: "knowledge_help";
  cueId: string;
}

export type AgentTaskResponse = SummerAgentProxyResponse | LessonHintAgentResponse | LessonExplanationAgentResponse | KnowledgeLessonAgentResponse | KnowledgeHelpAgentResponse;
