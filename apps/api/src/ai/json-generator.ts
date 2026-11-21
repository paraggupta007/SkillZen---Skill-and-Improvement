// Validate generated JSON and attempt one repair using a dedicated prompt.
import { z } from "zod";
import type { LLMRequest, LLMResponse } from "./types.js";
import { PromptBuilder } from "../domain/prompts/prompt-builder.js";
/** Minimal generation interface enables testing without a concrete router. */
export interface ITextGenerator {
  generate(req: LLMRequest): Promise<LLMResponse>;
}
/** Generate validated JSON, with exactly one repair attempt on invalid output. */
export class JsonGenerator {
  /** Inject a text generator and prompt builder. */
  constructor(
    private readonly generator: ITextGenerator,
    private readonly prompts: PromptBuilder,
  ) {}
  /** Parse and validate generated JSON against the supplied schema. */
  async generate<T>(request: LLMRequest, schema: z.ZodType<T>): Promise<T> {
    const first = await this.generator.generate(request);
    try {
      return schema.parse(JSON.parse(first.text) as unknown);
    } catch {
      const repaired = await this.generator.generate(
        this.prompts.repair(request, first.text),
      );
      try {
        return schema.parse(JSON.parse(repaired.text) as unknown);
      } catch {
        throw new Error("AI returned invalid structured output after repair");
      }
    }
  }
}
