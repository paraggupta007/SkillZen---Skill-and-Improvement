// Shared HTTP transport for Groq and OpenRouter's compatible chat APIs.
import type { ILLMProvider, LLMRequest, LLMResponse } from "../types.js";
import {
  completionSchema,
  deltaSchema,
  ensureSuccess,
  readSSE,
} from "./http-utils.js";
/** Base strategy for OpenAI-compatible free-model endpoints. */
export abstract class OpenAICompatibleProvider implements ILLMProvider {
  abstract readonly name: string;
  /** Configure the endpoint, secret and model choices. */
  constructor(
    private readonly key: string | undefined,
    private readonly url: string,
    private readonly models: { reasoning: string; quick: string },
  ) {}
  /** Check whether this provider has credentials configured. */
  async isHealthy() {
    return Boolean(this.key);
  }
  private async request(req: LLMRequest, stream: boolean) {
    if (!this.key) throw new Error("AI provider is not configured");
    return fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.models[req.task],
        temperature: req.temperature ?? 0.7,
        stream,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
      }),
      signal: req.signal,
    });
  }
  /** Generate a complete answer. */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    const response = await this.request(req, false);
    ensureSuccess(response);
    const body = completionSchema.parse(await response.json());
    return {
      text: body.choices[0]!.message.content,
      provider: this.name,
      model: this.models[req.task],
      tokensIn: body.usage?.prompt_tokens,
      tokensOut: body.usage?.completion_tokens,
    };
  }
  /** Stream text deltas from a compatible provider. */
  async *stream(req: LLMRequest): AsyncIterable<string> {
    const response = await this.request(req, true);
    for await (const data of readSSE(response)) {
      const delta = deltaSchema.parse(JSON.parse(data) as unknown);
      const content = delta.choices[0]?.delta.content;
      if (content) yield content;
    }
  }
}
