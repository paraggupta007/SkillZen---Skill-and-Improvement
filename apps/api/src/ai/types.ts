// Vendor-neutral contracts for text generation and usage records.
/** A provider-independent generation request. */
export interface LLMRequest {
  system: string;
  prompt: string;
  task: "reasoning" | "quick";
  temperature?: number;
  signal?: AbortSignal;
  cacheScope?: string;
}
/** The generated text and optional token counts. */
export interface LLMResponse {
  text: string;
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
}
/** A swappable language-model strategy. */
export interface ILLMProvider {
  readonly name: string;
  generate(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<string>;
  isHealthy(): Promise<boolean>;
}
/** A privacy-preserving usage record; it never includes prompt text or keys. */
export interface UsageRecord {
  provider: string;
  model: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  success: boolean;
}
/** Persists usage without tying the router to database details. */
export interface IUsageRepository {
  record(usage: UsageRecord): Promise<void>;
}
