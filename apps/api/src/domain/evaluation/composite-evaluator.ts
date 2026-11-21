// Compose independent evaluation strategies without changing their implementations.
import type { EvalInput, Evaluation, IEvaluator } from "./evaluator.js";
/** Merge the results of registered evaluator strategies. */
export class CompositeEvaluator implements IEvaluator {
  /** Inject an ordered list of evaluator strategies. */
  constructor(private readonly evaluators: IEvaluator[]) {}
  /** Run evaluators in parallel and merge their non-overlapping metrics. */
  async evaluate(input: EvalInput): Promise<Evaluation> {
    const results = await Promise.all(
      this.evaluators.map((evaluator) => evaluator.evaluate(input)),
    );
    const merged: Evaluation = { metrics: {}, feedback: [] };
    for (const result of results) {
      for (const [key, value] of Object.entries(result.metrics)) {
        if (key in merged.metrics)
          throw new Error(`Duplicate evaluator metric: ${key}`);
        merged.metrics[key] = value;
      }
      merged.feedback.push(...result.feedback);
      if (result.idealAnswer) {
        if (merged.idealAnswer) throw new Error("Duplicate ideal answer");
        merged.idealAnswer = result.idealAnswer;
      }
    }
    return merged;
  }
}
