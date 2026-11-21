// Evaluate answer quality using validated AI output.
import { z } from "zod";
import type { JsonGenerator } from "../../ai/json-generator.js";
import type { PromptBuilder } from "../prompts/prompt-builder.js";
import type { EvalInput, Evaluation, IEvaluator } from "./evaluator.js";
const score = z.number().finite().min(0).max(10);
const evaluationSchema = z.object({
  correctness: score,
  clarity: score,
  depth: score,
  relevance: score,
  overall: score,
  feedback: z.string().min(1).max(4000),
  idealAnswer: z.string().min(1).max(4000),
});
/** Score an answer against its round's rubric. */
export class LLMAnswerEvaluator implements IEvaluator {
  /** Inject structured generation and prompt building. */
  constructor(
    private readonly generator: Pick<JsonGenerator, "generate">,
    private readonly prompts: PromptBuilder,
  ) {}
  /** Return validated quality scores and constructive feedback. */
  async evaluate(input: EvalInput): Promise<Evaluation> {
    const result = await this.generator.generate(
      input.round.buildEvaluationPrompt(input.context, this.prompts),
      evaluationSchema,
    );
    return {
      metrics: {
        correctness: result.correctness,
        clarity: result.clarity,
        depth: result.depth,
        relevance: result.relevance,
        overall: result.overall,
      },
      feedback: [result.feedback],
      idealAnswer: result.idealAnswer,
    };
  }
}
