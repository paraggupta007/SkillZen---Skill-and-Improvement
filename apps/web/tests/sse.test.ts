// Verify streaming parsing, provisional extraction and error handling.
import { afterEach, describe, expect, it, vi } from "vitest";
import { partialJsonString, streamRequest } from "../src/services/sse";
function stream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
}
afterEach(() => vi.unstubAllGlobals());
describe("SSE client", () => {
  it("extracts a partial JSON field including escaped characters", () => {
    expect(
      partialJsonString('{"question" : "Hello\\nworld\\u0021', "question"),
    ).toBe("Hello\nworld!");
    expect(partialJsonString('{"other": "text"}', "question")).toBe("");
  });
  it("handles split CRLF, JSON chunks and validated completion", async () => {
    const delta = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          stream([
            "event: delta\r",
            '\ndata: {"success":true,"data":{"text":"hello"},"error":null}\r\n\r',
            '\nevent: complete\r\ndata: {"success":true,"data":{"id":"q1"},"error":null}\r\n\r\n',
          ]),
        ),
    );
    await expect(streamRequest("/x", { onDelta: delta })).resolves.toEqual({
      id: "q1",
    });
    expect(delta).toHaveBeenCalledWith("hello");
  });
  it("surfaces SSE errors and rejects truncated streams", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        stream([
          'event: error\ndata: {"success":false,"data":null,"error":{"code":"AI_ERROR","message":"Try again"}}\n\n',
        ]),
      )
      .mockResolvedValueOnce(
        stream([
          'event: status\ndata: {"success":true,"data":{},"error":null}\n\n',
        ]),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(streamRequest("/x", {})).rejects.toMatchObject({
      code: "AI_ERROR",
      message: "Try again",
    });
    await expect(streamRequest("/x", {})).rejects.toMatchObject({
      code: "STREAM_INCOMPLETE",
    });
  });
});
