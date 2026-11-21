// Rule-based coaching for optional client-calculated speech metrics.
import type { EvalInput, Evaluation, IEvaluator } from "./evaluator.js";
/** Turn speech measurements into non-diagnostic coaching hints. */
export class SpeechMetricsEvaluator implements IEvaluator {
  /** Return speech statistics and simple tips, or an empty result when unavailable. */
  async evaluate(input: EvalInput): Promise<Evaluation> {
    const speech = input.speech;
    if (!speech || speech.durationSeconds <= 0)
      return { metrics: {}, feedback: [] };
    const wordsPerMinute = Math.round(
      (speech.wordCount * 60) / speech.durationSeconds,
    );
    const tips: string[] = [];
    if (wordsPerMinute > 180)
      tips.push("Consider slowing down so your answer is easier to follow.");
    if (wordsPerMinute < 90 && speech.wordCount >= 10)
      tips.push("Consider a steadier pace when explaining your answer.");
    if (speech.fillerCount > 3)
      tips.push("Try replacing filler words with brief pauses.");
    return {
      metrics: {
        wordsPerMinute,
        fillerCount: speech.fillerCount,
        pauseCount: speech.pauseCount,
      },
      feedback: tips,
    };
  }
}
