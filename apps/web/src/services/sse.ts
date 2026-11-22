// Parse server-sent events from fetch, including POST responses and split chunks.
import { apiBase, ApiError, type Envelope } from "./api";
/** Return the partial value of a JSON string field without interpreting it as HTML. */
export function partialJsonString(text: string, field: string): string {
  const match = new RegExp(`"${field}"\\s*:\\s*"`).exec(text);
  if (!match) return "";
  let output = "";
  for (let i = match.index + match[0].length; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') break;
    if (char !== "\\") {
      output += char;
      continue;
    }
    const next = text[i + 1];
    if (!next) break;
    if (next === "u") {
      const code = text.slice(i + 2, i + 6);
      if (!/^[0-9a-f]{4}$/i.test(code)) break;
      output += String.fromCharCode(parseInt(code, 16));
      i += 5;
    } else {
      const escapes: Record<string, string> = {
        '"': '"',
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      };
      if (!(next in escapes)) break;
      output += escapes[next];
      i++;
    }
  }
  return output;
}
/** Stream provisional text and return only the validated completion payload. */
export async function streamRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    signal?: AbortSignal;
    onDelta?: (chunk: string) => void;
  },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      signal: options.signal,
      headers: options.body
        ? { "Content-Type": "application/json", Accept: "text/event-stream" }
        : { Accept: "text/event-stream" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Could not connect to the server.");
  }
  if (!response.ok || !response.body) {
    let message = "Could not start the interview request.";
    let code = "REQUEST_FAILED";
    try {
      const data = (await response.json()) as Envelope<unknown>;
      message = data.error?.message ?? message;
      code = data.error?.code ?? code;
    } catch {
      /* Keep the safe fallback. */
    }
    throw new ApiError(response.status, code, message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;
  let finished = false;
  try {
    while (!finished) {
      const next = await reader.read();
      buffer = (
        buffer + decoder.decode(next.value, { stream: !next.done })
      ).replace(/\r\n/g, "\n");
      if (buffer.length > 80000)
        throw new ApiError(
          0,
          "STREAM_TOO_LARGE",
          "The interview response was too large.",
        );
      let end = buffer.indexOf("\n\n");
      while (end !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const lines = frame.split("\n");
        const kind = lines
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim();
        const data = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) {
          let parsed: Envelope<unknown>;
          try {
            parsed = JSON.parse(data) as Envelope<unknown>;
          } catch {
            throw new ApiError(
              0,
              "INVALID_STREAM",
              "The interview response was interrupted.",
            );
          }
          if (kind === "error" || !parsed.success)
            throw new ApiError(
              0,
              parsed.error?.code ?? "STREAM_ERROR",
              parsed.error?.message ?? "The interview request failed.",
            );
          if (
            kind === "delta" &&
            parsed.data &&
            typeof parsed.data === "object" &&
            "text" in parsed.data &&
            typeof parsed.data.text === "string"
          )
            options.onDelta?.(parsed.data.text);
          if (kind === "complete" && parsed.data !== null) {
            result = parsed.data as T;
            finished = true;
          }
        }
        end = buffer.indexOf("\n\n");
      }
      if (next.done) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (!finished)
    throw new ApiError(
      0,
      "STREAM_INCOMPLETE",
      "The interview response was interrupted. Please retry.",
    );
  return result as T;
}
