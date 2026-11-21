// Consistent JSON envelopes for successful and failed HTTP requests.
/** Build the standard success response. */
export function ok<T>(data: T) {
  return { success: true as const, data, error: null };
}
/** Build the standard error response without leaking internal exceptions. */
export function fail(code: string, message: string) {
  return { success: false as const, data: null, error: { code, message } };
}
