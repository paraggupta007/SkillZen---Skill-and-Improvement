// Typed browser API client; credentials stay in httpOnly cookies.
export interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}
/** An API failure with a safe user-facing message and HTTP status. */
export class ApiError extends Error {
  /** Create a typed HTTP failure. */
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
/** API base uses the Vite proxy locally or the configured HTTPS backend in deployment. */
export const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(
  /\/$/,
  "",
);
/** Send a JSON request and unwrap its standard response envelope. */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body && !(options.body instanceof Blob)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Could not connect to the server. Please try again.",
    );
  }
  let envelope: Envelope<T>;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "The server returned an unexpected response.",
    );
  }
  if (!response.ok || !envelope.success || envelope.data === null)
    throw new ApiError(
      response.status,
      envelope.error?.code ?? "REQUEST_FAILED",
      envelope.error?.message ?? "Something went wrong.",
    );
  return envelope.data;
}
