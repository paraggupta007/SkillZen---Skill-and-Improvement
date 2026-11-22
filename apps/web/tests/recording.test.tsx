// Test recording consent, upload and resource cleanup with browser fakes.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useRecording } from "../src/hooks/use-recording";
class FakeRecorder {
  static instance: FakeRecorder;
  static isTypeSupported(type: string) {
    return type === "audio/webm";
  }
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeRecorder.instance = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["fake audio"], { type: "audio/webm" }),
    });
    this.onstop?.();
  }
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (navigator as Navigator & { mediaDevices?: MediaDevices })
    .mediaDevices;
});
describe("recording fallback", () => {
  it("records only on request, then uploads and stops microphone tracks", async () => {
    const stopTrack = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: { text: "A spoken answer" },
            error: null,
          }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    const callback = vi.fn();
    const { result } = renderHook(() => useRecording("interview-1", callback));
    expect(getUserMedia).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");
    act(() => result.current.stop());
    await waitFor(() =>
      expect(callback).toHaveBeenCalledWith("A spoken answer"),
    );
    expect(stopTrack).toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/interviews/interview-1/transcription",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
  it("discards the recording on unmount without upload", async () => {
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    });
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { result, unmount } = renderHook(() =>
      useRecording("interview-1", vi.fn()),
    );
    await act(async () => {
      await result.current.start();
    });
    unmount();
    expect(stopTrack).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
