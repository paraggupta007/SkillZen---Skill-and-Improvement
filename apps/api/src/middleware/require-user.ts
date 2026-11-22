// Shared cookie authentication for protected HTTP modules.
import type { RequestHandler, Response } from "express";
import { AppError } from "../core/errors.js";
import type { AuthService } from "../modules/auth/auth-service.js";
/** Authenticate the session and ensure its user still exists. */
export function requireUser(auth: AuthService | undefined): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      if (!auth)
        throw new AppError(
          503,
          "AUTH_UNAVAILABLE",
          "Authentication is not configured",
        );
      const token: unknown = req.cookies?.skillzen_session;
      if (typeof token !== "string")
        throw new AppError(401, "UNAUTHENTICATED", "Please log in");
      const userId = await auth.verify(token);
      res.locals.userId = userId;
      next();
    })().catch(next);
  };
}
/** Retrieve the authenticated ID established by requireUser. */
export function currentUserId(res: Response): string {
  return String(res.locals.userId);
}
