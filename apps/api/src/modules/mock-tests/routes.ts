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
import type { MockTestService } from "./mock-test-service.js";
function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
}
/** Authenticated practice test endpoints. */
export function createMockTestRoutes(
  auth: AuthService | undefined,
  service: MockTestService | undefined,
) {
  const router = Router();
  router.use(
    "/mock-tests",
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
      res.status(429).json(fail("RATE_LIMITED", "Too many mock test requests"));
    },
  });
  router.use("/mock-tests", limit);
  function ready() {
    if (!service)
      throw new AppError(
        503,
        "MOCK_TESTS_UNAVAILABLE",
        "Mock tests are not configured",
      );
    return service;
  }
  router.post(
    "/mock-tests",
    asyncRoute(async (req, res) => {
      const input = z
        .object({
          topic: z.enum(["javascript", "web"]),
          count: z.union([z.literal(3), z.literal(5)]),
        })
        .strict()
        .parse(req.body);
      res
        .status(201)
        .json(
          ok(
            await ready().create(currentUserId(res), input.topic, input.count),
          ),
        );
    }),
  );
  router.get(
    "/mock-tests",
    asyncRoute(async (_req, res) => {
      res.json(ok(await ready().list(currentUserId(res))));
    }),
  );
  router.get(
    "/mock-tests/:id",
    asyncRoute(async (req, res) => {
      res.json(
        ok(
          await ready().get(currentUserId(res), z.uuid().parse(req.params.id)),
        ),
      );
    }),
  );
  router.post(
    "/mock-tests/:id/submit",
    asyncRoute(async (req, res) => {
      const { answers } = z
        .object({
          answers: z
            .array(z.number().int().min(0).max(3).nullable())
            .min(1)
            .max(5),
        })
        .strict()
        .parse(req.body);
      res.json(
        ok(
          await ready().submit(
            currentUserId(res),
            z.uuid().parse(req.params.id),
            answers,
          ),
        ),
      );
    }),
  );
  router.delete(
    "/mock-tests/:id",
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
