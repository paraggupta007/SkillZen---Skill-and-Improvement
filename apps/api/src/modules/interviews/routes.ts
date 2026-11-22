// Authenticated HTTP and SSE adapters for interview use cases.
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { rateLimit } from "express-rate-limit";
import { z, ZodError } from "zod";
import { AppError } from "../../core/errors.js";
import { fail, ok } from "../../core/response.js";
import { requireUser, currentUserId } from "../../middleware/require-user.js";
import type { AuthService } from "../auth/auth-service.js";
import type { InterviewService } from "./interview-service.js";
const createSchema = z
  .object({
    role: z.string().trim().min(1).max(120),
    roundType: z.string().trim().min(1).max(40),
    difficulty: z.enum(["easy", "medium", "hard"]),
    totalQuestions: z.number().int().min(1).max(20),
    jdText: z.string().max(12000).optional(),
  })
  .strict();
const speechSchema = z
  .object({
    durationSeconds: z.number().positive().max(7200),
    wordCount: z.number().int().min(0).max(50000),
    fillerCount: z.number().int().min(0).max(50000),
    pauseCount: z.number().int().min(0).max(50000),
  })
  .strict();
const answerSchema = z
  .object({
    questionId: z.uuid(),
    answerText: z.string().trim().min(1).max(12000),
    speech: speechSchema.optional(),
  })
  .strict();
const idSchema = z.uuid();
function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
}
/** Build routes around injected auth and interview services. */
export function createInterviewRoutes(
  service: InterviewService | undefined,
  auth: AuthService | undefined,
) {
  const router = Router();
  function ready() {
    if (!service)
      throw new AppError(
        503,
        "INTERVIEWS_UNAVAILABLE",
        "Interviews are not configured",
      );
    return service;
  }
  router.use("/interviews", requireUser(auth));
  const aiLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (_req, res) => String(res.locals.userId),
    handler: (_req, res) => {
      res.status(429).json(fail("RATE_LIMITED", "Too many interview requests"));
    },
  });
  function startStream(res: Response) {
    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
  }
  function send(res: Response, event: string, data: unknown) {
    if (!res.destroyed)
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  async function stream(
    res: Response,
    task: (options: {
      onChunk: (chunk: string) => void;
      signal: AbortSignal;
    }) => Promise<unknown>,
  ) {
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    startStream(res);
    send(res, "status", ok({ state: "processing" }));
    try {
      const result = await task({
        signal: controller.signal,
        onChunk: (chunk) =>
          send(res, "delta", ok({ text: chunk, provisional: true })),
      });
      send(res, "complete", ok(result));
    } catch (error: unknown) {
      if (!controller.signal.aborted)
        send(
          res,
          "error",
          error instanceof AppError
            ? fail(error.code, error.message)
            : fail("AI_ERROR", "Unable to process interview request"),
        );
    } finally {
      if (!res.destroyed) res.end();
    }
  }
  router.post(
    "/interviews",
    asyncRoute(async (req, res) => {
      const input = createSchema.parse(req.body);
      res.status(201).json(ok(await ready().create(currentUserId(res), input)));
    }),
  );
  router.get(
    "/interviews",
    asyncRoute(async (_req, res) => {
      res.json(ok(await ready().list(currentUserId(res))));
    }),
  );
  router.get(
    "/interviews/:id",
    asyncRoute(async (req, res) => {
      res.json(
        ok(
          await ready().get(currentUserId(res), idSchema.parse(req.params.id)),
        ),
      );
    }),
  );
  router.get(
    "/interviews/:id/next-question",
    aiLimit,
    asyncRoute(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const service = ready();
      await service.get(currentUserId(res), id);
      await stream(res, (options) =>
        service.next(currentUserId(res), id, options),
      );
    }),
  );
  router.post(
    "/interviews/:id/answers",
    aiLimit,
    asyncRoute(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const input = answerSchema.parse(req.body);
      const service = ready();
      await service.get(currentUserId(res), id);
      await stream(res, (options) =>
        service.answer(
          currentUserId(res),
          id,
          input.questionId,
          input.answerText,
          input.speech,
          options,
        ),
      );
    }),
  );
  router.post(
    "/interviews/:id/complete",
    asyncRoute(async (req, res) => {
      res.json(
        ok(
          await ready().complete(
            currentUserId(res),
            idSchema.parse(req.params.id),
          ),
        ),
      );
    }),
  );
  router.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (error instanceof ZodError) {
        res.status(400).json(fail("VALIDATION_ERROR", "Invalid request"));
        return;
      }
      next(error);
    },
  );
  return router;
}
