// Domain-facing persistence contracts for interview state and atomic writes.
import type {
  interviews,
  questions,
  answers,
  evaluations,
} from "../../db/schema.js";
import type {
  Evaluation,
  SpeechMetrics,
} from "../../domain/evaluation/evaluator.js";
/** Persisted interview data. */
export type Interview = typeof interviews.$inferSelect;
/** One question and its optional answer and evaluation. */
export interface InterviewTurn {
  question: typeof questions.$inferSelect;
  answer: typeof answers.$inferSelect | null;
  evaluation: typeof evaluations.$inferSelect | null;
}
/** Inputs accepted when creating an interview. */
export interface CreateInterview {
  role: string;
  roundType: string;
  difficulty: string;
  totalQuestions: number;
  jdText?: string;
}
/** Validated question produced by the AI. */
export interface QuestionCandidate {
  question: string;
  category: string;
  isFollowup: boolean;
}
/** Interface for user-owned interview persistence. */
export interface IInterviewRepository {
  create(userId: string, input: CreateInterview): Promise<Interview>;
  get(userId: string, id: string): Promise<Interview | undefined>;
  list(userId: string): Promise<Interview[]>;
  turns(interviewId: string): Promise<InterviewTurn[]>;
  addQuestion(
    userId: string,
    id: string,
    candidate: QuestionCandidate,
  ): Promise<InterviewTurn>;
  saveAnswer(
    userId: string,
    id: string,
    questionId: string,
    answerText: string,
    evaluation: Evaluation,
    speech?: SpeechMetrics,
  ): Promise<void>;
  complete(
    userId: string,
    id: string,
  ): Promise<{ interview: Interview; changed: boolean }>;
}
