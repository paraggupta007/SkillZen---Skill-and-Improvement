// Abstract interview round contract and shared prompt-building flow.
import { PromptBuilder } from "../prompts/prompt-builder.js";
import type { LLMRequest } from "../../ai/types.js";
/** Context provided to a round; all candidate-supplied data is untrusted. */
export interface RoundContext {
  role: string;
  difficulty: string;
  resume?: string;
  jobDescription?: string;
  history: { question: string; answer: string }[];
}
/** Context needed to evaluate an answer. */
export interface EvalContext extends RoundContext {
  question: string;
  answer: string;
}
/** Describes how the round assesses a candidate. */
export interface Rubric {
  description: string;
}
/** Shared flow for specialized interview strategies. */
export abstract class InterviewRound {
  abstract readonly type: string;
  /** Return the assessment criteria for this round. */
  abstract get rubric(): Rubric;
  /** Build a JSON question prompt using shared safety boundaries. */
  buildQuestionPrompt(
    context: RoundContext,
    builder: PromptBuilder,
  ): LLMRequest {
    return builder.build({
      task: `Generate one ${this.type} interview question for the candidate. Avoid repeating prior questions.`,
      context,
      rubric: this.rubric.description,
      outputDescription:
        '{"question": string, "category": string, "isFollowup": boolean}',
      temperature: 0.7,
    });
  }
  /** Build a JSON evaluation prompt for the answer. */
  buildEvaluationPrompt(
    context: EvalContext,
    builder: PromptBuilder,
  ): LLMRequest {
    return builder.build({
      task: `Assess the answer to the ${this.type} interview question.`,
      context,
      rubric: this.rubric.description,
      outputDescription:
        '{"correctness": number 0-10, "clarity": number 0-10, "depth": number 0-10, "relevance": number 0-10, "overall": number 0-10, "feedback": string, "idealAnswer": string}',
      temperature: 0.2,
    });
  }
}
