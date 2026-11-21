// Shared structured logger; never log credentials or request bodies by default.
import pino from "pino";
/** Structured application logger. */
export const logger = pino({
  redact: [
    "password",
    "token",
    "authorization",
    "cookie",
    "DATABASE_URL",
    "JWT_SECRET",
    "GROQ_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
  ],
});
