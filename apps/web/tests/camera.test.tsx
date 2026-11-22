// Check conservative visual estimates and the consented camera lifecycle.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FaceAnalyzer,
  FaceMetricsAggregator,
  type Point,
} from "../src/vision/analyzers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CameraCoaching } from "../src/components/camera-coaching";
const detector = vi.hoisted(() => ({
  close: vi.fn(),
  detect: vi.fn(() => []),
}));
vi.mock("../src/vision/landmarker", () => ({
  createFaceLandmarker: vi.fn(async () => detector),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (navigator as Navigator & { mediaDevices?: MediaDevices })
    .mediaDevices;
  vi.restoreAllMocks();
});
describe("camera observations", () => {
  it("does not invent observations without landmarks and aggregates known samples", () => {
    const analyzer = new FaceAnalyzer();
    expect(analyzer.analyze([])).toEqual({
      faceVisible: false,
      centered: null,
      gazeNearCamera: null,
      headX: null,
    });
    const points: Point[] = Array.from({ length: 478 }, () => ({
      x: 0.5,
      y: 0.5,
    }));
    points[234] = { x: 0.2, y: 0.5 };
    points[454] = { x: 0.8, y: 0.5 };
    points[33] = { x: 0.3, y: 0.4 };
    points[133] = { x: 0.4, y: 0.4 };
    points[468] = { x: 0.35, y: 0.4 };
    points[362] = { x: 0.6, y: 0.4 };
    points[263] = { x: 0.7, y: 0.4 };
    points[473] = { x: 0.65, y: 0.4 };
    const result = analyzer.analyze(points);
    expect(result).toMatchObject({
      faceVisible: true,
      centered: true,
      gazeNearCamera: true,
    });
    const aggregate = new FaceMetricsAggregator();
    aggregate.add(result);
    aggregate.add(analyzer.analyze([]));
    expect(aggregate.snapshot()).toMatchObject({
      samples: 2,
      faceVisible: 1,
      gazeKnown: 1,
      gazeNearCamera: 1,
    });
  });
  it("requires consent and explicit start, and stops camera tracks", async () => {
    const stop = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockResolvedValue({ getTracks: () => [{ stop }] });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { metrics: null, suggestions: [] },
          error: null,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <CameraCoaching interviewId="abc" />
      </QueryClientProvider>,
    );
    const actor = userEvent.setup();
    expect(
      (
        screen.getByRole("button", {
          name: /start camera/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(getUserMedia).not.toHaveBeenCalled();
    await actor.click(screen.getByRole("checkbox"));
    await actor.click(screen.getByRole("button", { name: /start camera/i }));
    await screen.findByRole("button", { name: /stop camera/i });
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
    await actor.click(screen.getByRole("button", { name: /stop camera/i }));
    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(detector.close).toHaveBeenCalled();
    expect(
      fetcher.mock.calls.every(
        ([, options]) => !options.method || options.method === "GET",
      ),
    ).toBe(true);
  });
});
it("sends only aggregate counts after a separate save action", async () => {
  const stopTrack = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi
        .fn()
        .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(4);
  let time = 0;
  vi.spyOn(HTMLMediaElement.prototype, "currentTime", "get").mockImplementation(
    () => ++time,
  );
  const fetcher = vi
    .fn()
    .mockImplementation((_url: string, options: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data:
              options.method === "PUT"
                ? {
                    metrics: JSON.parse(options.body as string),
                    suggestions: [],
                  }
                : { metrics: null, suggestions: [] },
            error: null,
          }),
        ),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <CameraCoaching interviewId="abc" />
    </QueryClientProvider>,
  );
  const actor = userEvent.setup();
  await actor.click(screen.getByRole("checkbox"));
  await actor.click(screen.getByRole("button", { name: /start camera/i }));
  await screen.findByRole("button", { name: /stop camera/i });
  await screen.findByText(/sampled frames/i, {}, { timeout: 3000 });
  await actor.click(screen.getByRole("button", { name: /stop camera/i }));
  expect(
    fetcher.mock.calls.some(
      ([, opts]: [string, RequestInit]) => opts.method === "PUT",
    ),
  ).toBe(false);
  await actor.click(screen.getByRole("button", { name: /save aggregate/i }));
  await screen.findByText("Aggregate counts saved for this interview.");
  const [, options] = fetcher.mock.calls.find(
    ([, opts]: [string, RequestInit]) => opts.method === "PUT",
  )!;
  expect(Object.keys(JSON.parse(options.body as string)).sort()).toEqual(
    [
      "centered",
      "centeredKnown",
      "faceVisible",
      "gazeKnown",
      "gazeNearCamera",
      "headMovements",
      "samples",
    ].sort(),
  );
  expect(stopTrack).toHaveBeenCalled();
}, 10000);
