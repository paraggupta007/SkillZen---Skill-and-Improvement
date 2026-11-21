// Shared contracts for composable answer and communication evaluators.
import type { EvalContext, InterviewRound } from "../rounds/interview-round.js";
/** Optional client-calculated speech measurements. */
export interface SpeechMetrics {
  durationSeconds: number;
  wordCount: number;
  fillerCount: number;
  pauseCount: number;
}
/** Input passed to each registered evaluator. */
export interface EvalInput {
  context: EvalContext;
  round: InterviewRound;
  speech?: SpeechMetrics;
}
/** A namespaced evaluation component; missing metrics are not fabricated. */
export interface Evaluation {
  metrics: Record<string, number>;
  feedback: string[];
  idealAnswer?: string;
}
/** A strategy that produces an evaluation from interview input. */
export interface IEvaluator {
  evaluate(input: EvalInput): Promise<Evaluation>;
}
