// Centralized prompt construction for final interview reports.
import type { LLMRequest } from "../../ai/types.js";
import type { PromptBuilder } from "./prompt-builder.js";
/** Build a bounded, structured report prompt from untrusted interview data. */
export class ReportPrompt {
  /** Inject the common prompt builder. */
  constructor(private readonly builder: PromptBuilder) {}
  /** Ask for evidence-based coaching without generating numerical scores. */
  build(context: unknown): LLMRequest {
    return this.builder.build({
      task: "Summarize the interview with evidence-based, constructive coaching. Do not infer personality or protected traits.",
      context,
      rubric:
        "Use the provided answer evaluations. Give specific, practical suggestions. Avoid unsupported claims.",
      outputDescription:
        '{"strengths": string[], "weaknesses": string[], "tips": string[], "summary": string}',
      temperature: 0.2,
    });
  }
}
