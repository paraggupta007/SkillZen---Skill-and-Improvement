// Authenticated report retrieval and retry HTTP endpoints.
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
import { currentUserId, requireUser } from "../../middleware/require-user.js";
import type { AuthService } from "../auth/auth-service.js";
import type { ReportService } from "./report-service.js";
function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
}
/** Expose report status and explicit retry routes. */
export function createReportRoutes(
  service: ReportService | undefined,
  auth: AuthService | undefined,
) {
  const router = Router();
  router.use("/reports", requireUser(auth));
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (_req, res) => String(res.locals.userId),
    handler: (_req, res) => {
      res.status(429).json(fail("RATE_LIMITED", "Too many report requests"));
    },
  });
  function ready() {
    if (!service)
      throw new AppError(
        503,
        "REPORTS_UNAVAILABLE",
        "Reports are not configured",
      );
    return service;
  }
  router.get(
    "/reports/:id",
    limit,
    asyncRoute(async (req, res) => {
      const result = await ready().get(
        currentUserId(res),
        z.uuid().parse(req.params.id),
      );
      res.status(result.status === "pending" ? 202 : 200).json(ok(result));
    }),
  );
  router.post(
    "/reports/:id/retry",
    limit,
    asyncRoute(async (req, res) => {
      const result = await ready().retry(
        currentUserId(res),
        z.uuid().parse(req.params.id),
      );
      res.status(result.status === "pending" ? 202 : 200).json(ok(result));
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
