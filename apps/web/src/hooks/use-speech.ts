// Browser-native dictation and speech synthesis; microphones require an explicit user action.
import { useCallback, useEffect, useRef, useState } from "react";
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: RecognitionResult;
  };
}
interface RecognitionError {
  readonly error: string;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;
interface SpeechWindow extends Window {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
}
/** Approximate measurements based on a single browser dictation session. */
export interface SpeechMetrics {
  durationSeconds: number;
  wordCount: number;
  fillerCount: number;
  pauseCount: number;
}
/** Count approximate English filler words in text. */
export function countFillers(text: string) {
  return (text.match(/\b(?:um+|uh+|erm+|ah+)\b/gi) ?? []).length;
}
/** Manage one explicit browser dictation session and stop it on unmount. */
export function useSpeech(
  onTranscript: (text: string, metrics: SpeechMetrics | null) => void,
) {
  const browser = window as SpeechWindow;
  const Constructor =
    browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  useEffect(
    () => () => {
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
        recognition.current.abort();
        recognition.current = null;
      }
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const start = useCallback(() => {
    if (!Constructor || recognition.current) return;
    const instance = new Constructor();
    recognition.current = instance;
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "en-US";
    let final = "";
    const started = Date.now();
    let lastFinal = started;
    let pauses = 0;
    let hadError = false;
    setError("");
    setListening(true);
    instance.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.[0]) continue;
        const text = result[0].transcript.trim();
        if (result.isFinal) {
          const now = Date.now();
          if (final && now - lastFinal >= 2000) pauses++;
          final = [final, text].filter(Boolean).join(" ");
          lastFinal = now;
        } else interim = [interim, text].filter(Boolean).join(" ");
      }
      callback.current([final, interim].filter(Boolean).join(" "), null);
    };
    instance.onerror = (event) => {
      hadError = true;
      setError(
        event.error === "not-allowed"
          ? "Microphone permission was denied. You can still type your answer."
          : "Dictation stopped. You can try again or type your answer.",
      );
    };
    instance.onend = () => {
      recognition.current = null;
      setListening(false);
      const duration = Math.max(0.1, (Date.now() - started) / 1000);
      if (final && !hadError)
        callback.current(final, {
          durationSeconds: Math.min(7200, duration),
          wordCount: final.trim().split(/\s+/).length,
          fillerCount: countFillers(final),
          pauseCount: pauses,
        });
    };
    try {
      instance.start();
    } catch {
      recognition.current = null;
      setListening(false);
      setError("Could not start dictation. You can still type your answer.");
    }
  }, [Constructor]);
  const stop = useCallback(() => recognition.current?.stop(), []);
  return { supported: Boolean(Constructor), listening, error, start, stop };
}
/** Read using an available browser voice; availability and quality vary by device. */
export function speakQuestion(
  text: string,
  voice?: SpeechSynthesisVoice,
  onError?: () => void,
) {
  if (
    !window.speechSynthesis ||
    typeof SpeechSynthesisUtterance === "undefined"
  )
    return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted")
        onError?.();
    };
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
