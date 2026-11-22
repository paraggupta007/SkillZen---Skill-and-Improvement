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

describe("question playback", () => {
  it("chooses an enhanced English voice, allows selecting another and cleans up", async () => {
    const { render, screen, fireEvent } =
      await import("@testing-library/react");
    const { QuestionVoice } = await import("../src/components/question-voice");
    const voices = [
      { voiceURI: "one", name: "Standard voice", lang: "en-US", default: true },
      { voiceURI: "two", name: "Natural voice", lang: "en-GB", default: false },
      {
        voiceURI: "three",
        name: "French voice",
        lang: "fr-FR",
        default: false,
      },
    ];
    const synth = {
      getVoices: vi.fn(() => voices),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    class Utterance {
      text: string;
      voice?: unknown;
      lang = "";
      rate = 1;
      onerror: unknown;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    const { unmount } = render(
      <QuestionVoice text="Tell me more" disabled={false} />,
    );
    const select = screen.getByLabelText(
      /interviewer voice/i,
    ) as HTMLSelectElement;
    expect(select.value).toBe("two");
    expect(select.options.length).toBe(2);
    fireEvent.change(select, { target: { value: "one" } });
    fireEvent.click(
      screen.getByRole("button", { name: /read question aloud/i }),
    );
    expect(synth.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Tell me more",
        voice: voices[0],
        lang: "en-US",
        rate: 0.95,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /stop reading/i }));
    unmount();
    expect(synth.removeEventListener).toHaveBeenCalled();
    expect(synth.cancel).toHaveBeenCalled();
  });
  it("offers a text fallback when speech is unavailable", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { QuestionVoice } = await import("../src/components/question-voice");
    vi.stubGlobal("speechSynthesis", undefined);
    render(<QuestionVoice text="Question" disabled={false} />);
    expect(screen.getByText(/speech playback is unavailable/i)).toBeTruthy();
  });
});
