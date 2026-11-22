// Check conservative visual estimates and the consented camera lifecycle.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FaceAnalyzer,
  FaceMetricsAggregator,
  PoseAnalyzer,
  type Point,
} from "../src/vision/analyzers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CameraCoaching } from "../src/components/camera-coaching";
import { createPoseLandmarker } from "../src/vision/landmarker";
const detector = vi.hoisted(() => ({
  close: vi.fn(),
  detect: vi.fn(() => []),
}));
const poseDetector = vi.hoisted(() => ({
  close: vi.fn(),
  detect: vi.fn(() => []),
}));
vi.mock("../src/vision/landmarker", () => ({
  createFaceLandmarker: vi.fn(async () => detector),
  createPoseLandmarker: vi.fn(async () => poseDetector),
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
  it("requires visible shoulders and hips and counts coarse wrist movement", () => {
    const analyzer = new PoseAnalyzer();
    expect(analyzer.analyze([])).toEqual({
      postureAligned: null,
      handRaised: null,
      wrists: [null, null],
    });
    const points: Point[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0,
    }));
    points[11] = { x: 0.3, y: 0.3, visibility: 0.9 };
    points[12] = { x: 0.7, y: 0.3, visibility: 0.9 };
    points[23] = { x: 0.4, y: 0.7, visibility: 0.9 };
    points[24] = { x: 0.6, y: 0.7, visibility: 0.9 };
    points[15] = { x: 0.2, y: 0.5, visibility: 0.9 };
    const aggregator = new FaceMetricsAggregator();
    aggregator.addPose(analyzer.analyze(points));
    points[15] = { x: 0.4, y: 0.2, visibility: 0.9 };
    aggregator.addPose(analyzer.analyze(points));
    expect(aggregator.snapshot()).toMatchObject({
      poseSamples: 2,
      postureKnown: 2,
      postureAligned: 2,
      wristKnown: 1,
      wristMovements: 1,
      handRaisedKnown: 1,
      handRaised: 1,
    });
    points[23] = { x: 0.4, y: 0.7, visibility: 0.1 };
    expect(analyzer.analyze(points).postureAligned).toBeNull();
  });
  it("continues face-only when the pose model cannot load", async () => {
    vi.mocked(createPoseLandmarker).mockRejectedValueOnce(
      new Error("model unavailable"),
    );
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop, addEventListener: vi.fn() }],
        }),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: { metrics: null, suggestions: [] },
            error: null,
          }),
        ),
      ),
    );
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
    await actor.click(
      screen.getByRole("checkbox", {
        name: /i agree to local camera analysis/i,
      }),
    );
    await actor.click(screen.getByRole("button", { name: /start camera/i }));
    await screen.findByText(/body and wrist observations are unavailable/i);
    await screen.findByRole("button", { name: /stop camera/i });
    await actor.click(screen.getByRole("button", { name: /stop camera/i }));
    expect(stop).toHaveBeenCalled();
  });
  it("requires consent and explicit start, and stops camera tracks", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop, addEventListener: vi.fn() }],
    });
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
    await actor.click(
      screen.getByRole("checkbox", {
        name: /i agree to local camera analysis/i,
      }),
    );
    await actor.click(screen.getByRole("button", { name: /start camera/i }));
    await screen.findByRole("button", { name: /stop camera/i });
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
    await actor.click(screen.getByRole("button", { name: /stop camera/i }));
    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(detector.close).toHaveBeenCalled();
    expect(poseDetector.close).toHaveBeenCalled();
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
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: stopTrack, addEventListener: vi.fn() }],
      }),
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
  await actor.click(
    screen.getByRole("checkbox", { name: /i agree to local camera analysis/i }),
  );
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
      "poseSamples",
      "postureKnown",
      "postureAligned",
      "wristKnown",
      "wristMovements",
      "handRaisedKnown",
      "handRaised",
    ].sort(),
  );
  expect(stopTrack).toHaveBeenCalled();
}, 10000);

describe("live coaching", () => {
  it("waits for persistent face and framing observations, then clears them", async () => {
    const { LiveCoaching } = await import("../src/vision/live-coaching");
    const coach = new LiveCoaching();
    const off = {
      faceVisible: true,
      centered: false,
      gazeNearCamera: null,
      headX: 0.1,
    };
    for (let i = 0; i < 14; i++) coach.face(1, off, null);
    expect(coach.cues()).toEqual([]);
    coach.face(1, off, null);
    expect(coach.cues().join(" ")).toMatch(/center of the frame/);
    for (let i = 0; i < 15; i++)
      coach.face(1, { ...off, centered: true }, null);
    expect(coach.cues()).toEqual([]);
    for (let i = 0; i < 3; i++) coach.face(2, off, null);
    expect(coach.cues()).toEqual([]);
    coach.face(2, off, null);
    expect(coach.cues().join(" ")).toMatch(/more than one face/i);
    for (let i = 0; i < 10; i++)
      coach.face(0, { ...off, faceVisible: false, centered: null }, null);
    expect(coach.cues().join(" ")).toMatch(/not clearly visible/);
    expect(coach.cues().join(" ")).not.toMatch(/more than one face/i);
  });
  it("requires repeated iris changes and clears when landmarks are missing", async () => {
    const { LiveCoaching, irisDirection } =
      await import("../src/vision/live-coaching");
    const points: Point[] = Array.from({ length: 478 }, () => ({
      x: 0.5,
      y: 0.5,
    }));
    points[33] = points[362] = { x: 0.3, y: 0.5 };
    points[133] = points[263] = { x: 0.7, y: 0.5 };
    points[468] = points[473] = { x: 0.4, y: 0.5 };
    expect(irisDirection(points)).toBe(-1);
    points[468] = points[473] = { x: 0.6, y: 0.5 };
    expect(irisDirection(points)).toBe(1);
    expect(irisDirection([])).toBeNull();
    const coach = new LiveCoaching();
    const face = {
      faceVisible: true,
      centered: true,
      gazeNearCamera: true,
      headX: 0.5,
    };
    for (const direction of [-1, -1, 1, 1, -1, -1, 1, 1] as const)
      coach.face(1, face, direction);
    expect(coach.cues().join(" ")).toMatch(/iris position/i);
    coach.face(0, face, null);
    expect(coach.cues()).toEqual([]);
  });
  it("only reports repeated visible wrist movement and resets when pose is unavailable", async () => {
    const { LiveCoaching } = await import("../src/vision/live-coaching");
    const coach = new LiveCoaching();
    for (let i = 0; i < 7; i++)
      coach.pose({
        postureAligned: null,
        handRaised: null,
        wrists: [{ x: i % 2 ? 0.2 : 0.5, y: 0.5 }, null],
      });
    expect(coach.cues().join(" ")).toMatch(/wrist movement/i);
    coach.pose(null);
    expect(coach.cues()).toEqual([]);
  });
});

it("shows and clears a sustained live tip, without uploading camera data", async () => {
  const points: Point[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
  }));
  points[1] = { x: 0.1, y: 0.5 };
  points[234] = { x: 0.1, y: 0.5 };
  points[454] = { x: 0.6, y: 0.5 };
  detector.detect.mockImplementation(() => [points, points] as never[]);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi
        .fn()
        .mockResolvedValue({
          getTracks: () => [{ stop: vi.fn(), addEventListener: vi.fn() }],
        }),
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
    .mockResolvedValue(
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
  await actor.click(
    screen.getByRole("checkbox", { name: /i agree to local/i }),
  );
  await actor.click(screen.getByRole("button", { name: /start camera/i }));
  await screen.findByText(
    /more than one face-like shape may be in the frame/i,
    {},
    { timeout: 4000 },
  );
  await actor.click(
    screen.getByRole("checkbox", { name: /show optional live/i }),
  );
  expect(
    screen.queryByText(/more than one face-like shape may be in the frame/i),
  ).toBeNull();
  await actor.click(screen.getByRole("button", { name: /stop camera/i }));
  expect(
    fetcher.mock.calls.every(
      ([, options]) => !options.method || options.method === "GET",
    ),
  ).toBe(true);
  detector.detect.mockReset();
  detector.detect.mockReturnValue([]);
}, 10000);
