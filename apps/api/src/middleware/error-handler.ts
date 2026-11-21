// Central HTTP error translation; internal details stay in server logs.
import type { ErrorRequestHandler } from "express";
import { AppError } from "../core/errors.js";
import { fail } from "../core/response.js";
import { logger } from "../core/logger.js";
/** Convert thrown errors into the standard envelope. */
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  if (error instanceof AppError) {
    res.status(error.status).json(fail(error.code, error.message));
    return;
  }
  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    res.status(400).json(fail("INVALID_JSON", "Malformed JSON body"));
    return;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 413
  ) {
    res.status(413).json(fail("PAYLOAD_TOO_LARGE", "Request body too large"));
    return;
  }
  logger.error(
    { name: error instanceof Error ? error.name : "UnknownError" },
    "Unhandled request error",
  );
  res.status(500).json(fail("INTERNAL_ERROR", "Internal server error"));
};
