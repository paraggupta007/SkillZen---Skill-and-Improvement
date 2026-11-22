// Provider contract and Groq transcription adapter; audio is never stored on disk.
import { z } from "zod";
import { AppError } from "../../core/errors.js";
/** Supported browser-recorded audio containers. */
export type AudioType = "audio/webm" | "audio/ogg" | "audio/mp4";
/** Speech transcription provider contract. */
export interface ITranscriber {
  transcribe(
    audio: Buffer,
    type: AudioType,
    signal: AbortSignal,
  ): Promise<string>;
}
/** Transcribe in-memory recordings using the Groq Whisper free-tier model. */
export class GroqTranscriber implements ITranscriber {
  /** Inject a server-only API key and replaceable HTTP transport. */
  constructor(
    private readonly key: string,
    private readonly transport: typeof fetch = fetch,
  ) {}
  /** Send one recording to Groq without logging audio or provider errors. */
  async transcribe(audio: Buffer, type: AudioType, signal: AbortSignal) {
    const form = new FormData();
    const ext = type.split("/")[1];
    form.append(
      "file",
      new Blob([new Uint8Array(audio)], { type }),
      `answer.${ext}`,
    );
    form.append("model", "whisper-large-v3-turbo");
    form.append("response_format", "json");
    try {
      const response = await this.transport(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.key}` },
          body: form,
          signal,
        },
      );
      if (!response.ok) throw new Error("provider failed");
      const result = z
        .object({ text: z.string().trim().min(1).max(12000) })
        .parse(await response.json());
      return result.text;
    } catch {
      throw new AppError(
        502,
        "TRANSCRIPTION_FAILED",
        "Could not transcribe this recording. Please retry or type your answer.",
      );
    }
  }
}
