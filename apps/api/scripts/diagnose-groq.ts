// Diagnose Groq connectivity without printing API keys, responses or prompts.
import "dotenv/config";
import { GroqProvider } from "../src/ai/providers/groq-provider.js";
import type { LLMRequest } from "../src/ai/types.js";

function safeError(error: unknown): string {
  if (error instanceof Error) {
    const match = /^AI provider returned HTTP (\d{3})$/.exec(error.message);
    if (match) return `HTTP ${match[1]}`;
    if (error.name === "TimeoutError" || error.name === "AbortError")
      return "timed out";
  }
  return "network, response-format, or stream error";
}
async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key?.trim()) {
    console.error("GROQ_API_KEY is missing from apps/api/.env");
    process.exitCode = 1;
    return;
  }
  const groq = new GroqProvider(key);
  const req: LLMRequest = {
    system: "Answer briefly.",
    prompt: "Say hello.",
    task: "reasoning",
    temperature: 0,
  };
  try {
    await groq.generate({ ...req, signal: AbortSignal.timeout(20000) });
    console.log("Groq non-streaming: OK");
  } catch (error) {
    console.error(`Groq non-streaming: ${safeError(error)}`);
    process.exitCode = 1;
    return;
  }
  try {
    let chunks = 0;
    for await (const chunk of groq.stream({
      ...req,
      signal: AbortSignal.timeout(20000),
    }))
      if (chunk.length) chunks++;
    if (!chunks) throw new Error("Empty stream");
    console.log("Groq streaming: OK");
  } catch (error) {
    console.error(`Groq streaming: ${safeError(error)}`);
    process.exitCode = 1;
  }
}
void main().catch(() => {
  console.error("Groq diagnostic failed unexpectedly.");
  process.exitCode = 1;
});
