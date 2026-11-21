// Shared parsers for vendor HTTP responses and SSE events.
import { z } from "zod";
/** Turn a non-success provider response into a safe exception without leaking its body. */
export function ensureSuccess(response: Response): void {
  if (!response.ok)
    throw new Error(`AI provider returned HTTP ${response.status}`);
}
/** Decode data fields from a provider SSE response, including split network chunks. */
export async function* readSSE(response: Response): AsyncIterable<string> {
  ensureSuccess(response);
  if (!response.body) throw new Error("Provider returned no stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let index = buffer.indexOf("\n\n");
      while (index !== -1) {
        const event = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const data = event
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data && data !== "[DONE]") yield data;
        index = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    if (buffer.trim()) throw new Error("Incomplete provider stream");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
/** OpenAI-compatible completion response shape. */
export const completionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .optional(),
});
/** OpenAI-compatible streamed delta shape. */
export const deltaSchema = z.object({
  choices: z.array(
    z.object({
      delta: z.object({ content: z.string().nullable().optional() }),
    }),
  ),
});
