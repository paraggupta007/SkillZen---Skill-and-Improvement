// Deterministic fake for domain and integration tests, without paid APIs.
import type { ILLMProvider, LLMRequest, LLMResponse } from "../types.js";
/** Test double that returns scripted outputs in order. */
export class FakeLLMProvider implements ILLMProvider {
  readonly name = "fake";
  private index = 0;
  /** Supply one or more scripted responses. */
  constructor(private readonly outputs: string[]) {}
  /** A fake is healthy while it has outputs. */
  async isHealthy() {
    return this.outputs.length > 0;
  }
  /** Return the next scripted output. */
  async generate(_req: LLMRequest): Promise<LLMResponse> {
    const text = this.outputs[this.index++];
    if (text === undefined) throw new Error("No fake response remains");
    return { text, provider: this.name, model: "fake" };
  }
  /** Yield a fake answer as a single chunk. */
  async *stream(req: LLMRequest) {
    yield (await this.generate(req)).text;
  }
}
