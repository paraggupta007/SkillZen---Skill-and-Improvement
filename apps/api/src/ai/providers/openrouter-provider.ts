// OpenRouter adapter restricted to a free model identifier.
import { OpenAICompatibleProvider } from "./openai-compatible-provider.js";
/** Fallback provider using only an explicitly free model. */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly name = "openrouter";
  /** Create the provider with a server-only API key. */
  constructor(key?: string) {
    super(key, "https://openrouter.ai/api/v1/chat/completions", {
      reasoning: "meta-llama/llama-3.3-70b-instruct:free",
      quick: "meta-llama/llama-3.3-70b-instruct:free",
    });
  }
}
