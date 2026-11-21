// Assemble the HTTP middleware and public health endpoint.
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
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
  app.use(compression());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json(fail("RATE_LIMITED", "Too many requests"));
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", (_req, res) => {
    res.json(ok({ status: "ok" }));
  });
  app.use((_req, res) => {
    res.status(404).json(fail("NOT_FOUND", "Route not found"));
  });
  app.use(errorHandler);
  return app;
}
