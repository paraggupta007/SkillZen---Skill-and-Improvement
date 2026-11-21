// HTTP validation, cookies and route wiring for authentication and profiles.
import {
  Router,
  type CookieOptions,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { rateLimit } from "express-rate-limit";
import { z, ZodError } from "zod";
import type { Env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { fail, ok } from "../../core/response.js";
import type { AuthService } from "./auth-service.js";
const email = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(8)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must be at most 72 bytes",
  );
const registration = z
  .object({ email, password, name: z.string().trim().min(1).max(120) })
  .strict();
const login = z.object({ email, password }).strict();
const profile = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    targetRole: z.string().trim().max(120).nullable().optional(),
    experienceLevel: z.string().trim().max(80).nullable().optional(),
    skills: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field",
  );
const cookieName = "skillzen_session";
function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}
/** Construct auth and profile routes around an injected service. */
export function createAuthRoutes(service: AuthService | undefined, env: Env) {
  const router = Router();
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 60 * 60 * 1000,
  };
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json(fail("RATE_LIMITED", "Too many authentication attempts"));
    },
  });
  function ready(): AuthService {
    if (!service)
      throw new AppError(
        503,
        "AUTH_UNAVAILABLE",
        "Authentication is not configured",
      );
    return service;
  }
  function current(req: Request) {
    const token: unknown = req.cookies?.[cookieName];
    if (typeof token !== "string")
      throw new AppError(401, "UNAUTHENTICATED", "Please log in");
    return ready().verify(token);
  }
  router.post(
    "/auth/register",
    authLimit,
    asyncRoute(async (req, res) => {
      const result = await ready().register(registration.parse(req.body));
      res
        .cookie(cookieName, result.token, cookieOptions)
        .status(201)
        .json(ok(result.user));
    }),
  );
  router.post(
    "/auth/login",
    authLimit,
    asyncRoute(async (req, res) => {
      const result = await ready().login(login.parse(req.body));
      res.cookie(cookieName, result.token, cookieOptions).json(ok(result.user));
    }),
  );
  router.post("/auth/logout", (_req, res) => {
    res
      .clearCookie(cookieName, {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
      })
      .json(ok({ loggedOut: true }));
  });
  router.get(
    "/users/me",
    asyncRoute(async (req, res) => {
      res.json(ok(await ready().me(current(req))));
    }),
  );
  router.patch(
    "/users/me",
    asyncRoute(async (req, res) => {
      res.json(ok(await ready().update(current(req), profile.parse(req.body))));
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
