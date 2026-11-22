// Opt-in browser recording; audio is uploaded only for explicit Groq transcription.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiBase, ApiError, type Envelope } from "../services/api";
/** Record up to two minutes or five megabytes and transcribe after the user stops. */
export function useRecording(
  interviewId: string,
  onText: (text: string) => void,
) {
  const [status, setStatus] = useState<
    "idle" | "starting" | "recording" | "uploading"
  >("idle");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const disposed = useRef(false);
  const generation = useRef(0);
  const cancelled = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const callback = useRef(onText);
  callback.current = onText;
  useEffect(() => {
    disposed.current = false;
    generation.current++;
    return () => {
      generation.current++;
      disposed.current = true;
      cancelled.current = true;
      abort.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [interviewId]);
  const start = useCallback(async () => {
    if (status !== "idle") return;
    setError("");
    setStatus("starting");
    cancelled.current = false;
    const token = generation.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (
        disposed.current ||
        cancelled.current ||
        token !== generation.current
      ) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mime = ["audio/webm", "audio/ogg", "audio/mp4"].find((item) =>
        MediaRecorder.isTypeSupported(item),
      );
      if (!mime) {
        media.getTracks().forEach((track) => track.stop());
        throw new Error("This browser cannot record a supported audio format.");
      }
      const instance = new MediaRecorder(media, { mimeType: mime });
      recorder.current = instance;
      let size = 0;
      const chunks: Blob[] = [];
      let exceeded = false;
      instance.ondataavailable = (event) => {
        if (event.data.size) {
          size += event.data.size;
          if (size > 5 * 1024 * 1024) {
            exceeded = true;
            chunks.length = 0;
            if (instance.state === "recording") instance.stop();
          } else if (!exceeded) chunks.push(event.data);
        }
      };
      const timer = window.setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 120000);
      instance.onerror = () => {
        cancelled.current = true;
        if (instance.state === "recording") instance.stop();
        if (!disposed.current && token === generation.current)
          setError("Recording failed. Please try again or type your answer.");
      };
      instance.onstop = () => {
        window.clearTimeout(timer);
        media.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        if (disposed.current || token !== generation.current) return;
        if (cancelled.current || exceeded || !chunks.length) {
          setStatus("idle");
          if (exceeded)
            setError(
              "Recording exceeded the 5 MB limit. Please try a shorter answer.",
            );
          return;
        }
        setStatus("uploading");
        const controller = new AbortController();
        abort.current = controller;
        void fetch(`${apiBase}/interviews/${interviewId}/transcription`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": mime },
          body: new Blob(chunks, { type: mime }),
          signal: controller.signal,
        })
          .then(async (response) => {
            const result = (await response.json()) as Envelope<{
              text: string;
            }>;
            if (!response.ok || !result.success || !result.data)
              throw new ApiError(
                response.status,
                result.error?.code ?? "TRANSCRIPTION_FAILED",
                result.error?.message ?? "Transcription failed.",
              );
            if (!disposed.current && token === generation.current)
              callback.current(result.data.text);
          })
          .catch((err: unknown) => {
            if (
              !disposed.current &&
              token === generation.current &&
              !controller.signal.aborted
            )
              setError(
                err instanceof ApiError
                  ? err.message
                  : "Could not transcribe the recording. Please try again or type your answer.",
              );
          })
          .finally(() => {
            if (!disposed.current && token === generation.current)
              setStatus("idle");
          });
      };
      instance.start(1000);
      setStatus("recording");
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      recorder.current = null;
      if (!disposed.current && token === generation.current) {
        setStatus("idle");
        setError(
          "Could not access your microphone. Check permission or type your answer.",
        );
      }
    }
  }, [interviewId, status]);
  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);
  const supported =
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);
  return { supported, status, error, start, stop };
}
