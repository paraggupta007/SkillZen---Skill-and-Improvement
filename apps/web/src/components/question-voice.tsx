import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { speakQuestion } from "../hooks/use-speech";

/** Prefer explicitly enhanced English voices when available; never infer gender from a name. */
export function preferredVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((voice) => /^en(?:-|$)/i.test(voice.lang));
  return (
    english.find((voice) =>
      /natural|neural|enhanced|premium/i.test(voice.name),
    ) ??
    english.find((voice) => voice.default) ??
    english[0]
  );
}

export function QuestionVoice({
  text,
  disabled,
}: {
  text: string;
  disabled: boolean;
}) {
  const supported =
    typeof window !== "undefined" &&
    !!window.speechSynthesis &&
    typeof SpeechSynthesisUtterance !== "undefined";
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const refresh = () =>
      setVoices(
        synth.getVoices().filter((voice) => /^en(?:-|$)/i.test(voice.lang)),
      );
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => {
      synth.removeEventListener("voiceschanged", refresh);
      synth.cancel();
    };
  }, [supported]);
  // Cancel a previous question when it changes or this component unmounts.
  useEffect(
    () => () => {
      if (supported) window.speechSynthesis.cancel();
    },
    [text, supported],
  );
  const voice =
    voices.find((item) => item.voiceURI === selected) ?? preferredVoice(voices);
  return (
    <div className="question-voice">
      {supported ? (
        <>
          <label htmlFor="question-voice-select">Interviewer voice</label>
          <select
            id="question-voice-select"
            value={voice?.voiceURI ?? ""}
            onChange={(event) => setSelected(event.target.value)}
          >
            {!voices.length && <option value="">Browser default</option>}
            {voices.map((item) => (
              <option key={item.voiceURI} value={item.voiceURI}>
                {item.name} ({item.lang})
              </option>
            ))}
          </select>
          <div className="voice-controls">
            <button
              type="button"
              className="voice-button"
              disabled={disabled}
              onClick={() => {
                setError("");
                if (
                  !speakQuestion(text, voice, () =>
                    setError(
                      "Could not play this voice. Try another available voice or read the question.",
                    ),
                  )
                )
                  setError(
                    "Speech playback is unavailable. You can read the question instead.",
                  );
              }}
            >
              <Volume2 size={16} /> Read question aloud
            </button>
            <button
              type="button"
              className="voice-button"
              onClick={() => window.speechSynthesis.cancel()}
            >
              Stop reading
            </button>
          </div>
          <p>
            Voice options and quality depend on your browser and device. Choose
            the voice you prefer.
          </p>
        </>
      ) : (
        <p>
          Speech playback is unavailable in this browser. You can read the
          question instead.
        </p>
      )}
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
