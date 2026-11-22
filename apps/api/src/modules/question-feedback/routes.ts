import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { rateLimit } from "express-rate-limit";
import { z, ZodError } from "zod";
import { AppError } from "../../core/errors.js";
import { fail, ok } from "../../core/response.js";
import { currentUserId, requireUser } from "../../middleware/require-user.js";
import type { AuthService } from "../auth/auth-service.js";
import type { QuestionFeedbackService } from "./question-feedback-service.js";
function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
}
/** Owner-only routes for a candidate's rating and comment on a question. */
export function createQuestionFeedbackRoutes(
  auth: AuthService | undefined,
  service: QuestionFeedbackService | undefined,
) {
  const router = Router();
  const path = "/interviews/:id/questions/:questionId/feedback";
  router.use(
    path,
    (_req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      next();
    },
    requireUser(auth),
  );
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (_req, res) => String(res.locals.userId),
    handler: (_req, res) => {
      res.status(429).json(fail("RATE_LIMITED", "Too many feedback requests"));
    },
  });
  function ready() {
    if (!service)
      throw new AppError(
        503,
        "FEEDBACK_UNAVAILABLE",
        "Question feedback is not configured",
      );
    return service;
  }
  function ids(req: Request) {
    return {
      interviewId: z.uuid().parse(req.params.id),
      questionId: z.uuid().parse(req.params.questionId),
    };
  }
  router.get(
    path,
    limit,
    asyncRoute(async (req, res) => {
      const { interviewId, questionId } = ids(req);
      res.json(
        ok(await ready().get(currentUserId(res), interviewId, questionId)),
      );
    }),
  );
  router.put(
    path,
    limit,
    asyncRoute(async (req, res) => {
      const { interviewId, questionId } = ids(req);
      const input = z
        .object({
          rating: z.number().int().min(1).max(5),
          comment: z.string().trim().max(1000).default(""),
        })
        .strict()
        .parse(req.body);
      res.json(
        ok(
          await ready().save(
            currentUserId(res),
            interviewId,
            questionId,
            input.rating,
            input.comment,
          ),
        ),
      );
    }),
  );
  router.delete(
    path,
    limit,
    asyncRoute(async (req, res) => {
      const { interviewId, questionId } = ids(req);
      await ready().delete(currentUserId(res), interviewId, questionId);
      res.json(ok({ deleted: true }));
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
