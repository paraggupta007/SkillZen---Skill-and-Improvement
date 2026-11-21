// Groq free-tier language model adapter.
import { OpenAICompatibleProvider } from "./openai-compatible-provider.js";
/** Groq uses a larger reasoning model and smaller fast model. */
export class GroqProvider extends OpenAICompatibleProvider {
  readonly name = "groq";
  /** Create the provider with a server-only API key. */
  constructor(key?: string) {
    super(key, "https://api.groq.com/openai/v1/chat/completions", {
      reasoning: "llama-3.3-70b-versatile",
      quick: "llama-3.1-8b-instant",
    });
  }
}
