// Authenticated resume upload and analysis HTTP adapters.
import express, {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { rateLimit } from "express-rate-limit";
import { z, ZodError } from "zod";
import { AppError } from "../../core/errors.js";
import { fail, ok } from "../../core/response.js";
import { currentUserId, requireUser } from "../../middleware/require-user.js";
import type { AuthService } from "../auth/auth-service.js";
import type { ResumeService } from "./resume-service.js";
function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
}
/** Build authenticated resume routes. */
export function createResumeRoutes(
  service: ResumeService | undefined,
  auth: AuthService | undefined,
) {
  const router = Router();
  router.use("/resumes", requireUser(auth));
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (_req, res) => String(res.locals.userId),
    handler: (_req, res) => {
      res.status(429).json(fail("RATE_LIMITED", "Too many resume requests"));
    },
  });
  function ready() {
    if (!service)
      throw new AppError(
        503,
        "RESUMES_UNAVAILABLE",
        "Resumes are not configured",
      );
    return service;
  }
  router.post(
    "/resumes",
    limit,
    (req, _res, next) => {
      if (!req.is("application/pdf"))
        return next(
          new AppError(415, "UNSUPPORTED_FILE", "Please upload a PDF file"),
        );
      next();
    },
    express.raw({ type: "application/pdf", limit: "5mb" }),
    asyncRoute(async (req, res) => {
      if (!Buffer.isBuffer(req.body))
        throw new AppError(400, "INVALID_PDF", "Please upload a valid PDF");
      res
        .status(201)
        .json(ok(await ready().upload(currentUserId(res), req.body)));
    }),
  );
  router.get(
    "/resumes",
    asyncRoute(async (_req, res) => {
      res.json(ok(await ready().list(currentUserId(res))));
    }),
  );
  router.delete(
    "/resumes/:id",
    asyncRoute(async (req, res) => {
      await ready().delete(currentUserId(res), z.uuid().parse(req.params.id));
      res.json(ok({ deleted: true }));
    }),
  );
  router.post(
    "/resumes/:id/analyze",
    limit,
    asyncRoute(async (req, res) => {
      const { jobDescription } = z
        .object({ jobDescription: z.string().trim().max(12000).default("") })
        .strict()
        .parse(req.body);
      res.json(
        ok(
          await ready().analyze(
            currentUserId(res),
            z.uuid().parse(req.params.id),
            jobDescription,
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
