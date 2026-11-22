// Authenticated, size-limited audio transcription endpoint.
import express, {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { AppError } from "../../core/errors.js";
import { fail, ok } from "../../core/response.js";
import { currentUserId, requireUser } from "../../middleware/require-user.js";
import type { AuthService } from "../auth/auth-service.js";
import type { InterviewService } from "../interviews/interview-service.js";
import type { AudioType, ITranscriber } from "./transcriber.js";
function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
}
function asyncMiddleware(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res)
      .then(() => next())
      .catch(next);
  };
}
function audioType(req: Request): AudioType | undefined {
  const type = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  return type === "audio/webm" || type === "audio/ogg" || type === "audio/mp4"
    ? type
    : undefined;
}
function validContainer(audio: Buffer, type: AudioType) {
  if (type === "audio/webm")
    return audio.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (type === "audio/ogg")
    return audio.subarray(0, 4).toString("ascii") === "OggS";
  return audio.subarray(4, 8).toString("ascii") === "ftyp";
}
/** Create an owner-checked transcription route with strict request limits. */
export function createSpeechRoutes(
  auth: AuthService | undefined,
  interviews: InterviewService | undefined,
  transcriber: ITranscriber | undefined,
) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (_req, res) => String(res.locals.userId),
    handler: (_req, res) => {
      res
        .status(429)
        .json(fail("RATE_LIMITED", "Too many transcription requests"));
    },
  });
  router.post(
    "/interviews/:id/transcription",
    requireUser(auth),
    limiter,
    asyncMiddleware(async (req, res) => {
      if (!z.uuid().safeParse(req.params.id).success)
        throw new AppError(400, "VALIDATION_ERROR", "Invalid request");
      if (!interviews)
        throw new AppError(
          503,
          "INTERVIEWS_UNAVAILABLE",
          "Interviews are not configured",
        );
      if (!transcriber)
        throw new AppError(
          503,
          "TRANSCRIPTION_UNAVAILABLE",
          "Transcription is not configured",
        );
      const interview = await interviews.get(
        currentUserId(res),
        req.params.id!,
      );
      if (interview.interview.status !== "in_progress")
        throw new AppError(
          409,
          "INTERVIEW_CLOSED",
          "Interview is not in progress",
        );
      if (!audioType(req))
        throw new AppError(
          415,
          "UNSUPPORTED_AUDIO",
          "Use a WebM, Ogg or MP4 recording",
        );
    }),
    express.raw({
      type: ["audio/webm", "audio/ogg", "audio/mp4"],
      limit: "4mb",
    }),
    asyncRoute(async (req, res) => {
      const type = audioType(req);
      if (
        !type ||
        !Buffer.isBuffer(req.body) ||
        req.body.length < 100 ||
        !validContainer(req.body, type)
      )
        throw new AppError(
          400,
          "INVALID_AUDIO",
          "Invalid or empty audio recording",
        );
      const abort = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) abort.abort();
      });
      const text = await transcriber!.transcribe(
        req.body,
        type,
        AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]),
      );
      res.json(ok({ text }));
    }),
  );
  return router;
}
