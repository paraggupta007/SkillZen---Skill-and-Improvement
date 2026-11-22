// Explicitly consented, browser-only experimental camera feedback.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../services/api";
import type { CameraResult } from "../services/types";
import { ErrorState } from "./ui";
import { Camera, CameraOff } from "lucide-react";
import {
  FaceAnalyzer,
  FaceMetricsAggregator,
  PoseAnalyzer,
} from "../vision/analyzers";
import { LiveCoaching, irisDirection } from "../vision/live-coaching";
import type { IFaceLandmarker, IPoseLandmarker } from "../vision/landmarker";
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
  const [poseWarning, setPoseWarning] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tipsEnabled, setTipsEnabled] = useState(true);
  const tipsRef = useRef(true);
  const [tips, setTips] = useState<string[]>([]);
  const coaching = useRef(new LiveCoaching());
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const landmarker = useRef<IFaceLandmarker | null>(null);
  const poseLandmarker = useRef<IPoseLandmarker | null>(null);
  const timer = useRef<number | null>(null);
  const generation = useRef(0);
  const aggregate = useRef<FaceMetricsAggregator | null>(null);
  function stop() {
    generation.current++;
    coaching.current = new LiveCoaching();
    setTips([]);
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
    poseLandmarker.current?.close();
    poseLandmarker.current = null;
    if (video.current) video.current.srcObject = null;
    setState("idle");
  }
  useEffect(
    () => () => {
      generation.current++;
      if (timer.current !== null) window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      landmarker.current?.close();
      poseLandmarker.current?.close();
    },
    [],
  );
  async function start() {
    if (!consent || state !== "idle") return;
    const token = ++generation.current;
    setState("starting");
    share.reset();
    setError("");
    setPoseWarning("");
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
      try {
        const pose = await import("../vision/landmarker").then((module) =>
          module.createPoseLandmarker(),
        );
        if (generation.current !== token) {
          pose.close();
          return;
        }
        poseLandmarker.current = pose;
      } catch {
        if (generation.current !== token) return;
        setPoseWarning(
          "Body and wrist observations are unavailable; face observations can still be used.",
        );
      }
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (generation.current !== token) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      media.getTracks().forEach((track) =>
        track.addEventListener(
          "ended",
          () => {
            if (generation.current === token) {
              stop();
              setError(
                "Camera access ended. You can restart it or continue without camera practice.",
              );
            }
          },
          { once: true },
        ),
      );
      if (!video.current) throw new Error("Camera preview is unavailable.");
      video.current.srcObject = media;
      await video.current.play();
      if (generation.current !== token) return;
      const analyzer = new FaceAnalyzer();
      const poseAnalyzer = new PoseAnalyzer();
      const aggregator = new FaceMetricsAggregator();
      aggregate.current = aggregator;
      let lastVideoTime = -1;
      let lastFrameAt = performance.now();
      let updates = 0;
      timer.current = window.setInterval(() => {
        const current = video.current;
        if (
          !current ||
          current.readyState < 2 ||
          current.currentTime === lastVideoTime
        ) {
          if (performance.now() - lastFrameAt > 2500) {
            coaching.current = new LiveCoaching();
            setTips((previous) => (previous.length ? [] : previous));
          }
          return;
        }
        lastVideoTime = current.currentTime;
        lastFrameAt = performance.now();
        try {
          const faces = detector.detect(current, performance.now());
          const points = faces[0] ?? [];
          const face = analyzer.analyze(points);
          // Do not attribute face or pose measurements when more than one face-like shape is visible.
          if (faces.length < 2) aggregator.add(face);
          if (tipsRef.current)
            coaching.current.face(faces.length, face, irisDirection(points));
          if (++updates % 5 === 0) {
            if (poseLandmarker.current && faces.length === 1) {
              try {
                const pose = poseAnalyzer.analyze(
                  poseLandmarker.current.detect(current, performance.now()),
                );
                aggregator.addPose(pose);
                if (tipsRef.current) coaching.current.pose(pose);
              } catch {
                poseLandmarker.current.close();
                poseLandmarker.current = null;
                coaching.current.pose(null);
                setPoseWarning(
                  "Body and wrist observations stopped; face observations remain active.",
                );
              }
            } else if (faces.length !== 1) coaching.current.pose(null);
            setMetrics(aggregator.snapshot());
          }
          if (tipsRef.current) {
            const next = coaching.current.cues();
            setTips((previous) =>
              previous.length === next.length &&
              previous.every((value, i) => value === next[i])
                ? previous
                : next,
            );
          }
          if (updates >= 18000) {
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
        Video is analyzed in your browser, never uploaded. Face and pose models
        download from Google when you start. Estimates are imperfect and are not
        retina scans, proof of attention, or cheating detection. You can skip or
        stop at any time. Live tips stay on this device and can be switched off.
        Multiple face-like shapes can be misdetected, including photos or
        screens; samples with multiple detected faces are excluded from saved
        counts.
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
      <label className="resume-consent camera-tips-toggle">
        <input
          type="checkbox"
          checked={tipsEnabled}
          onChange={(event) => {
            tipsRef.current = event.target.checked;
            setTipsEnabled(event.target.checked);
            coaching.current = new LiveCoaching();
            setTips([]);
          }}
        />
        <span>Show optional live framing and movement tips</span>
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
      {state === "active" && tipsEnabled && (
        <div
          className="camera-live-tips"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong>Live practice tips</strong>
          {tips.length ? (
            <ul>
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          ) : (
            <p>No current tips. Visual estimates can be inaccurate.</p>
          )}
        </div>
      )}
      {state === "starting" && (
        <p className="camera-notice" role="status">
          Loading the model and requesting camera permission...
        </p>
      )}
      {poseWarning && (
        <p className="voice-error" role="status">
          {poseWarning}
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
            {metrics.postureKnown
              ? `Shoulder and hip centers aligned in ${metrics.postureAligned} of ${metrics.postureKnown} usable pose samples.`
              : "Not enough visible shoulder and hip data for alignment estimates."}{" "}
            {metrics.wristKnown
              ? `Wrist movement was detected in ${metrics.wristMovements} of ${metrics.wristKnown} usable samples.`
              : "Wrists were not sufficiently visible to estimate movement."}{" "}
            {metrics.handRaisedKnown
              ? ` A hand appeared above shoulder height in ${metrics.handRaised} of ${metrics.handRaisedKnown} usable samples.`
              : " Hand-raise observations were unavailable."}{" "}
            These are rough geometry measurements, not judgments about posture,
            gesture quality, health or confidence.
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
