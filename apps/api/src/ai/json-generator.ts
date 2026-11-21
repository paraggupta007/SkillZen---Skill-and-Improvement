// Validate generated JSON and attempt one repair using a dedicated prompt.
import { z } from "zod";
import type { LLMRequest, LLMResponse } from "./types.js";
import { PromptBuilder } from "../domain/prompts/prompt-builder.js";
/** Minimal generation interface enables testing without a concrete router. */
export interface ITextGenerator {
  generate(req: LLMRequest): Promise<LLMResponse>;
  stream?(req: LLMRequest): AsyncIterable<string>;
}
/** Generate validated JSON, with exactly one repair attempt on invalid output. */
export class JsonGenerator {
  /** Inject a text generator and prompt builder. */
  constructor(
    private readonly generator: ITextGenerator,
    private readonly prompts: PromptBuilder,
  ) {}
  /** Parse and validate generated JSON against the supplied schema. */
  async generate<T>(
    request: LLMRequest,
    schema: z.ZodType<T>,
    onChunk?: (chunk: string) => void,
  ): Promise<T> {
    let text = "";
    if (onChunk && this.generator.stream) {
      for await (const chunk of this.generator.stream(request)) {
        text += chunk;
        if (text.length > 40000) throw new Error("AI output too large");
        onChunk(chunk);
      }
    } else {
      text = (await this.generator.generate(request)).text;
      if (text.length > 40000) throw new Error("AI output too large");
    }
    try {
      return schema.parse(JSON.parse(text) as unknown);
    } catch {
      const repaired = await this.generator.generate(
        this.prompts.repair(request, text),
      );
      try {
        return schema.parse(JSON.parse(repaired.text) as unknown);
      } catch {
        throw new Error("AI returned invalid structured output after repair");
      }
    }
  }
}
