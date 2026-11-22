// Verify opt-in browser speech lifecycle and approximate metrics.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { countFillers, useSpeech } from "../src/hooks/use-speech";
class FakeRecognition {
  static instance: FakeRecognition;
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.instance = this;
  }
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("browser voice", () => {
  it("does not use the microphone until requested and cleans up on unmount", () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    const update = vi.fn();
    const { result, unmount } = renderHook(() => useSpeech(update));
    expect(result.current.supported).toBe(true);
    expect(FakeRecognition.instance).toBeUndefined();
    act(() => result.current.start());
    expect(FakeRecognition.instance.start).toHaveBeenCalledOnce();
    expect(result.current.listening).toBe(true);
    unmount();
    expect(FakeRecognition.instance.abort).toHaveBeenCalledOnce();
  });
  it("reports final text and approximate metrics after stopping", () => {
    vi.useFakeTimers();
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    const update = vi.fn();
    const { result } = renderHook(() => useSpeech(update));
    act(() => result.current.start());
    const item = Object.assign([{ transcript: "Um this is an answer" }], {
      isFinal: true,
    });
    act(() => {
      FakeRecognition.instance.onresult?.({ resultIndex: 0, results: [item] });
      vi.advanceTimersByTime(5000);
      result.current.stop();
    });
    expect(update).toHaveBeenLastCalledWith("Um this is an answer", {
      durationSeconds: 5,
      wordCount: 5,
      fillerCount: 1,
      pauseCount: 0,
    });
    expect(result.current.listening).toBe(false);
    expect(countFillers("Um, uh and erm")).toBe(3);
  });
  it("surfaces microphone denial with a typing fallback", () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    const { result } = renderHook(() => useSpeech(vi.fn()));
    act(() => result.current.start());
    act(() => {
      FakeRecognition.instance.onerror?.({ error: "not-allowed" });
      FakeRecognition.instance.onend?.();
    });
    expect(result.current.error).toContain("permission was denied");
    expect(result.current.listening).toBe(false);
  });
});
