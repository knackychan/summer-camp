import type { ReadingLevel } from "../../core/src/interaction-profile.js";

export type LearningDomain = "math" | "language" | "logic" | "science" | "geography" | "history";
export type MathOperation = "addition" | "subtraction" | "multiplication" | "comparison" | "number_bond";
export type VocabularyMode = "copy" | "recall" | "translate" | "sentences" | "bopomofo";
export type LearningAdaptationSignal = "level_up" | "maintain" | "support" | "level_down";

export type LearningMistakeKind =
  | "near_miss"
  | "counting_slip"
  | "operation_confusion"
  | "skip_counting_slip"
  | "comparison_reversal"
  | "number_bond_slip"
  | "unknown";

export type VocabularyMistakeKind =
  | "single_letter_slip"
  | "repeated_letter_confusion"
  | "recall_stall"
  | "unknown";

export type LearningAttemptMistake = LearningMistakeKind | VocabularyMistakeKind;

export type TutorInterventionKind =
  | "continue"
  | "tiny_hint"
  | "visual_explanation"
  | "easier_follow_up";

export type VocabularyTutorInterventionKind =
  | "continue"
  | "tiny_clue"
  | "picture_audio"
  | "reveal_letter"
  | "easier_recall";

export interface LearnerProfile {
  kidId: string;
  age: number;
  language: string;
  readingLevel: ReadingLevel;
  levels: Record<LearningDomain, number>;
}

export interface LearningAttempt {
  attemptId?: string;
  questionId: string;
  correct: boolean;
  responseMs: number;
  hintsUsed: number;
  difficulty: number;
  answeredAt: number;
  mistake?: LearningAttemptMistake;
}

export interface LearningSessionState {
  id: string;
  learnerId: string;
  domain: LearningDomain;
  skill: string;
  level: number;
  attempts: LearningAttempt[];
  startedAt: number;
  updatedAt: number;
  lastAdaptedAttemptCount: number;
  lastAdaptation?: LearningAdaptationSignal;
}

export interface RecordAttemptInput {
  attemptId?: string;
  questionId: string;
  correct: boolean;
  responseMs: number;
  hintsUsed?: number;
  difficulty?: number;
  answeredAt?: number;
  mistake?: LearningAttemptMistake;
}

/**
 * Compact numeric math representation shared by Brain Gym, the tutor policy and
 * the LLM hint boundary. `right` has operation-specific meaning:
 * - addition/subtraction/multiplication: second operand
 * - comparison: second quantity (answer is the larger quantity)
 * - number_bond: target total (left is the known part; answer is the missing part)
 */
export interface MathQuestion {
  id: string;
  operation: MathOperation;
  left: number;
  right: number;
  answer: number;
  difficulty: number;
}

export type MathHintStrategy =
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
  | "retry";

export interface MathHintPresentation {
  mode: "text_visual" | "visual_audio";
  strategy: MathHintStrategy;
  showText: boolean;
  objectGroups?: [number, number];
  operator?: "+" | "−" | "×";
  numberLine?: {
    start: number;
    direction: 1 | -1;
    steps: number;
  };
  equalGroups?: {
    groups: number;
    each: number;
    layout: "groups" | "array";
  };
  skipCount?: {
    step: number;
    count: number;
  };
  comparison?: [number, number];
  numberBond?: {
    known: number;
    target: number;
  };
}

export type VocabularyHintStrategy =
  | "first_letter"
  | "next_letter"
  | "word_shape"
  | "picture_clue"
  | "repeat_prompt"
  | "sound_it_out"
  | "retry";

export interface VocabularyExercise {
  id: string;
  mode: VocabularyMode;
  target: string;
  difficulty: number;
  position: number;
  revealed: number;
  emoji?: string;
  sourceFrench?: string;
  sourceChinese?: string;
  promptMode?: string;
}

export interface VocabularyHintPresentation {
  mode: "text_visual" | "visual_audio";
  strategy: VocabularyHintStrategy;
  showText: boolean;
  emoji?: string;
  letter?: string;
  revealThrough?: number;
  wordShape?: string;
  promptCue?: string;
  speakTarget?: boolean;
}

export interface MathTutorIntervention {
  kind: TutorInterventionKind;
  mistake: LearningMistakeKind;
  reason: "isolated_error" | "near_miss_after_success" | "repeated_pattern" | "repeated_errors" | "operation_confusion" | "needs_support";
  preferredStrategies: MathHintStrategy[];
  easierQuestion?: MathQuestion;
}

export interface VocabularyTutorIntervention {
  kind: VocabularyTutorInterventionKind;
  mistake: VocabularyMistakeKind;
  reason:
    | "isolated_slip"
    | "slip_after_success"
    | "same_position_repeated"
    | "recall_stalled"
    | "repeated_support"
    | "needs_support";
  preferredStrategies: VocabularyHintStrategy[];
  revealThrough?: number;
  showPicture?: boolean;
  speakTarget?: boolean;
}
