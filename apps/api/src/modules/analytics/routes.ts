// Authenticated dashboard analytics HTTP endpoint.
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { AppError } from "../../core/errors.js";
import { ok } from "../../core/response.js";
import { currentUserId, requireUser } from "../../middleware/require-user.js";
import type { AuthService } from "../auth/auth-service.js";
import type { AnalyticsService } from "./analytics-service.js";
/** Expose the user's dashboard summary. */
export function createAnalyticsRoutes(
  service: AnalyticsService | undefined,
  auth: AuthService | undefined,
) {
  const router = Router();
  router.use("/analytics", requireUser(auth));
  router.get(
    "/analytics/summary",
    (_req: Request, res: Response, next: NextFunction) => {
      void (async () => {
        if (!service)
          throw new AppError(
            503,
            "ANALYTICS_UNAVAILABLE",
            "Analytics are not configured",
          );
        res.json(ok(await service.summary(currentUserId(res))));
      })().catch(next);
    },
  );
  return router;
}
