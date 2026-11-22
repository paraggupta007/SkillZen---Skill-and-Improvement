// Explicitly consented, browser-only experimental camera feedback.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../services/api";
import type { CameraResult } from "../services/types";
import { ErrorState } from "./ui";
import { Camera, CameraOff } from "lucide-react";
import { FaceAnalyzer, FaceMetricsAggregator } from "../vision/analyzers";
import type { IFaceLandmarker } from "../vision/landmarker";
type Metrics = ReturnType<FaceMetricsAggregator["snapshot"]>;
/** Offer optional local camera observations without uploading any frames or metrics. */
export function CameraCoaching({ interviewId }: { interviewId: string }) {
  const client = useQueryClient();
  const saved = useQuery({
    queryKey: ["camera", interviewId],
    queryFn: () =>
      apiRequest<CameraResult>(`/interviews/${interviewId}/camera-metrics`),
    retry: false,
  });
  const share = useMutation({
    mutationFn: (metrics: Metrics) =>
      apiRequest<CameraResult>(`/interviews/${interviewId}/camera-metrics`, {
        method: "PUT",
        body: JSON.stringify(metrics),
      }),
    onSuccess: (result) => client.setQueryData(["camera", interviewId], result),
  });
  const remove = useMutation({
    mutationFn: () =>
      apiRequest(`/interviews/${interviewId}/camera-metrics`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      share.reset();
      client.setQueryData(["camera", interviewId], {
        metrics: null,
        suggestions: [],
      });
    },
  });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "starting" | "active">("idle");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const landmarker = useRef<IFaceLandmarker | null>(null);
  const timer = useRef<number | null>(null);
  const generation = useRef(0);
  const aggregate = useRef<FaceMetricsAggregator | null>(null);
  function stop() {
    generation.current++;
    if (aggregate.current) {
      const finalMetrics = aggregate.current.snapshot();
      if (finalMetrics.samples) setMetrics(finalMetrics);
      aggregate.current = null;
    }
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    landmarker.current?.close();
    landmarker.current = null;
    if (video.current) video.current.srcObject = null;
    setState("idle");
  }
  useEffect(
    () => () => {
      generation.current++;
      if (timer.current !== null) window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      landmarker.current?.close();
    },
    [],
  );
  async function start() {
    if (!consent || state !== "idle") return;
    const token = ++generation.current;
    setState("starting");
    share.reset();
    setError("");
    setMetrics(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access requires a supported browser and a secure connection.",
        );
      const detector = await import("../vision/landmarker").then((module) =>
        module.createFaceLandmarker(),
      );
      if (generation.current !== token) {
        detector.close();
        return;
      }
      landmarker.current = detector;
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (generation.current !== token) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      if (!video.current) throw new Error("Camera preview is unavailable.");
      video.current.srcObject = media;
      await video.current.play();
      if (generation.current !== token) return;
      const analyzer = new FaceAnalyzer();
      const aggregator = new FaceMetricsAggregator();
      aggregate.current = aggregator;
      let lastVideoTime = -1;
      let updates = 0;
      timer.current = window.setInterval(() => {
        const current = video.current;
        if (
          !current ||
          current.readyState < 2 ||
          current.currentTime === lastVideoTime
        )
          return;
        lastVideoTime = current.currentTime;
        try {
          aggregator.add(
            analyzer.analyze(detector.detect(current, performance.now())),
          );
          if (++updates % 5 === 0) setMetrics(aggregator.snapshot());
          if (aggregator.snapshot().samples >= 18000) {
            stop();
            setError(
              "Camera practice stopped after reaching the session limit.",
            );
          }
        } catch {
          setError("Camera analysis stopped unexpectedly.");
          stop();
        }
      }, 200);
      setState("active");
    } catch {
      if (generation.current !== token) return;
      stop();
      setError(
        "Could not start camera coaching. Check permission, browser support and your connection, or continue without it.",
      );
    }
  }
  return (
    <section className="panel camera-panel">
      <div className="camera-title">
        <span>
          <Camera size={18} />
        </span>
        <div>
          <h2>Optional camera practice</h2>
          <p>Experimental, private visual coaching.</p>
        </div>
      </div>
      <p className="camera-notice">
        Video is analyzed in your browser, never uploaded. The face model
        downloads from Google when you start. Estimates are imperfect and are
        not retina scans, proof of attention, or cheating detection. You can
        skip or stop at any time.
      </p>
      <label className="resume-consent">
        <input
          type="checkbox"
          checked={consent}
          disabled={state !== "idle"}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          I agree to local camera analysis for optional practice feedback.
        </span>
      </label>
      <video
        ref={video}
        className={`camera-preview ${state === "active" ? "" : "camera-hidden"}`}
        muted
        playsInline
        aria-label="Local camera preview"
      />
      {state === "idle" ? (
        <button
          type="button"
          className="voice-button"
          disabled={!consent}
          onClick={() => void start()}
        >
          <Camera size={16} /> Start camera
        </button>
      ) : (
        <button type="button" className="voice-button" onClick={stop}>
          <CameraOff size={16} />{" "}
          {state === "starting" ? "Cancel" : "Stop camera"}
        </button>
      )}
      {state === "starting" && (
        <p className="camera-notice" role="status">
          Loading the model and requesting camera permission...
        </p>
      )}
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
      {metrics && (
        <div className="camera-metrics">
          <strong>Local session observations</strong>
          <p>
            Face visible in {metrics.faceVisible} of {metrics.samples} sampled
            frames.{" "}
            {metrics.centeredKnown
              ? `Face centered in ${metrics.centered} of ${metrics.centeredKnown} usable frames.`
              : "Not enough data to estimate framing."}
          </p>
          <p>
            {metrics.gazeKnown
              ? `Iris position near center in ${metrics.gazeNearCamera} of ${metrics.gazeKnown} usable frames.`
              : "Not enough data to estimate iris position."}{" "}
            Lighting, glasses, positioning and individual differences affect
            results.
          </p>
          <p>
            Only these aggregate counts can be shared; video and landmarks never
            leave this device. Unsaved observations are discarded when you
            leave.
          </p>
          {state === "idle" && (
            <button
              type="button"
              className="voice-button"
              disabled={share.isPending}
              onClick={() => share.mutate(metrics)}
            >
              Save aggregate counts to report
            </button>
          )}
          {share.isSuccess && (
            <p role="status">Aggregate counts saved for this interview.</p>
          )}
          {share.isError && <ErrorState message={share.error.message} />}
        </div>
      )}
      {saved.data?.metrics && (
        <div className="camera-metrics">
          <p>Saved camera counts are available on your report.</p>
          <button
            type="button"
            className="voice-button"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete saved camera counts
          </button>
          {remove.isError && <ErrorState message={remove.error.message} />}
        </div>
      )}
      {saved.isError && (
        <p className="voice-error">
          Could not load saved camera counts. Local camera practice is still
          available.
        </p>
      )}
    </section>
  );
}
