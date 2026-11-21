// Known application errors carry safe HTTP-facing details.
/** A controlled error suitable for the API error envelope. */
export class AppError extends Error {
  /** Create a safe error with an HTTP status and stable code. */
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
