import type { RateLimitStoreFactory } from "../../rate-limit/postgres-store.js";
// Consent-based, aggregate-only camera metrics API.
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z, ZodError } from "zod";
import { rateLimit } from "express-rate-limit";
import { AppError } from "../../core/errors.js";
import { fail, ok } from "../../core/response.js";
import { currentUserId, requireUser } from "../../middleware/require-user.js";
import type { AuthService } from "../auth/auth-service.js";
import type { CameraService } from "./camera-service.js";
const count = z.number().int().min(0).max(18000);
const metricsSchema = z
  .object({
    samples: count.min(1),
    faceVisible: count,
    centered: count,
    centeredKnown: count,
    gazeNearCamera: count,
    gazeKnown: count,
    headMovements: count,
    poseSamples: count.default(0),
    postureKnown: count.default(0),
    postureAligned: count.default(0),
    wristKnown: count.default(0),
    wristMovements: count.default(0),
    handRaisedKnown: count.default(0),
    handRaised: count.default(0),
  })
  .strict()
  .refine(
    (m) =>
      m.faceVisible <= m.samples &&
      m.centeredKnown <= m.faceVisible &&
      m.centered <= m.centeredKnown &&
      m.gazeKnown <= m.faceVisible &&
      m.gazeNearCamera <= m.gazeKnown &&
      m.headMovements < m.samples &&
      m.poseSamples <= m.samples &&
      m.postureKnown <= m.poseSamples &&
      m.postureAligned <= m.postureKnown &&
      m.wristKnown <= m.poseSamples &&
      m.wristMovements <= m.wristKnown &&
      m.handRaisedKnown <= m.poseSamples &&
      m.handRaised <= m.handRaisedKnown,
  );
function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
}
/** Construct user-owned routes for explicit aggregate sharing and deletion. */
export function createCameraRoutes(
  auth: AuthService | undefined,
  service: CameraService | undefined,
  rateLimitStoreFactory?: RateLimitStoreFactory,
) {
  const router = Router();
  const path = "/interviews/:id/camera-metrics";
  router.use(path, (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  const limit = rateLimit({
    store: rateLimitStoreFactory?.("camera"),
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (_req, res) => String(res.locals.userId),
    handler: (_req, res) => {
      res
        .status(429)
        .json(fail("RATE_LIMITED", "Too many camera metrics requests"));
    },
  });
  function ready() {
    if (!service)
      throw new AppError(
        503,
        "CAMERA_METRICS_UNAVAILABLE",
        "Camera metrics are not configured",
      );
    return service;
  }
  router.get(
    path,
    requireUser(auth),
    limit,
    asyncRoute(async (req, res) => {
      res.json(
        ok(
          await ready().get(currentUserId(res), z.uuid().parse(req.params.id)),
        ),
      );
    }),
  );
  router.put(
    path,
    requireUser(auth),
    limit,
    asyncRoute(async (req, res) => {
      res.json(
        ok(
          await ready().save(
            currentUserId(res),
            z.uuid().parse(req.params.id),
            metricsSchema.parse(req.body),
          ),
        ),
      );
    }),
  );
  router.delete(
    path,
    requireUser(auth),
    limit,
    asyncRoute(async (req, res) => {
      await ready().delete(currentUserId(res), z.uuid().parse(req.params.id));
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
