// Google Gemini Flash adapter with server-side API key handling.
import { z } from "zod";
import type { ILLMProvider, LLMRequest, LLMResponse } from "../types.js";
import { ensureSuccess, readSSE } from "./http-utils.js";
const schema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })),
        }),
      }),
    )
    .min(1),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
    })
    .optional(),
});
/** Gemini Flash fallback provider. */
export class GeminiProvider implements ILLMProvider {
  readonly name = "gemini";
  private readonly model = "gemini-2.5-flash";
  /** Create the provider with a server-only API key. */
  constructor(private readonly key?: string) {}
  /** Check whether a server-side key is configured. */
  async isHealthy() {
    return Boolean(this.key);
  }
  private async request(req: LLMRequest, stream: boolean) {
    if (!this.key) throw new Error("AI provider is not configured");
    const endpoint = stream
      ? "streamGenerateContent?alt=sse"
      : "generateContent";
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:${endpoint}`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.prompt }] }],
          generationConfig: { temperature: req.temperature ?? 0.7 },
        }),
        signal: req.signal,
      },
    );
  }
  /** Generate a complete answer. */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    const response = await this.request(req, false);
    ensureSuccess(response);
    const body = schema.parse(await response.json());
    return {
      text: body.candidates[0]!.content.parts.map(
        (part) => part.text ?? "",
      ).join(""),
      provider: this.name,
      model: this.model,
      tokensIn: body.usageMetadata?.promptTokenCount,
      tokensOut: body.usageMetadata?.candidatesTokenCount,
    };
  }
  /** Stream text chunks from Gemini. */
  async *stream(req: LLMRequest): AsyncIterable<string> {
    const response = await this.request(req, true);
    for await (const data of readSSE(response)) {
      const body = schema.parse(JSON.parse(data) as unknown);
      const text = body.candidates[0]!.content.parts.map(
        (part) => part.text ?? "",
      ).join("");
      if (text) yield text;
    }
  }
}
