import { createQuestionFeedbackRoutes } from "./modules/question-feedback/routes.js";
import { createMockTestRoutes } from "./modules/mock-tests/routes.js";
// Assemble the HTTP middleware and public health endpoint.
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { createCameraRoutes } from "./modules/camera/routes.js";
import { createResumeRoutes } from "./modules/resumes/routes.js";
import { createSpeechRoutes } from "./modules/speech/routes.js";
import { createInterviewRoutes } from "./modules/interviews/routes.js";
import { createReportRoutes } from "./modules/reports/routes.js";
import { createAnalyticsRoutes } from "./modules/analytics/routes.js";
import { createAuthRoutes } from "./modules/auth/routes.js";
import { rateLimit } from "express-rate-limit";
import type { Container } from "./container.js";
import { fail, ok } from "./core/response.js";
import { errorHandler } from "./middleware/error-handler.js";
/** Build an Express app without starting a listener, for easy testing. */
export function createApp(container: Container) {
  const app = express();
  if (container.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: container.env.CLIENT_URL, credentials: true }));
  app.use(
    compression({
      filter: (req, res) => {
        if (/\/interviews\/[^/]+\/(next-question|answers)$/.test(req.path))
          return false;
        return compression.filter(req, res);
      },
    }),
  );
  app.use(
    rateLimit({
      store: container.rateLimitStoreFactory?.("global"),
      skip: (req) => req.path === "/api/health",
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json(fail("RATE_LIMITED", "Too many requests"));
      },
    }),
  );
  app.use((req, res, next) => {
    const origin = req.get("origin");
    // These GET endpoints can start generation and therefore need origin protection.
    const changesState =
      !["GET", "HEAD", "OPTIONS"].includes(req.method) ||
      (req.method === "GET" &&
        (/\/interviews\/[^/]+\/next-question$/.test(req.path) ||
          /\/reports\/[^/]+$/.test(req.path)));
    if (
      changesState &&
      ((origin && origin !== container.env.CLIENT_URL) ||
        (!origin && req.get("sec-fetch-site") === "cross-site"))
    ) {
      res
        .status(403)
        .json(fail("ORIGIN_FORBIDDEN", "Request origin is not allowed"));
      return;
    }
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    "/api",
    createAuthRoutes(
      container.auth,
      container.env,
      container.rateLimitStoreFactory,
    ),
  );
  app.use(
    "/api",
    createMockTestRoutes(
      container.auth,
      container.mockTests,
      container.rateLimitStoreFactory,
    ),
  );
  app.use(
    "/api",
    createResumeRoutes(
      container.resumes,
      container.auth,
      container.rateLimitStoreFactory,
    ),
  );
  app.use(
    "/api",
    createCameraRoutes(
      container.auth,
      container.camera,
      container.rateLimitStoreFactory,
    ),
  );
  app.use(
    "/api",
    createQuestionFeedbackRoutes(
      container.auth,
      container.questionFeedback,
      container.rateLimitStoreFactory,
    ),
  );
  app.use(
    "/api",
    createSpeechRoutes(
      container.auth,
      container.interviews,
      container.transcriber,
      container.rateLimitStoreFactory,
    ),
  );
  app.use(
    "/api",
    createInterviewRoutes(
      container.interviews,
      container.auth,
      container.rateLimitStoreFactory,
    ),
  );
  app.use(
    "/api",
    createReportRoutes(
      container.reports,
      container.auth,
      container.rateLimitStoreFactory,
    ),
  );
  app.use("/api", createAnalyticsRoutes(container.analytics, container.auth));
  app.get("/api/health", (_req, res) => {
    res.json(ok({ status: "ok" }));
  });
  app.use((_req, res) => {
    res.status(404).json(fail("NOT_FOUND", "Route not found"));
  });
  app.use(errorHandler);
  return app;
}
