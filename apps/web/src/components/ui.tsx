// Shared accessible visual primitives used across the application.
import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
/** Display a centered loading indicator. */
export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="state-box" role="status">
      <LoaderCircle size={20} className="spin" />
      {label}
    </div>
  );
}
/** Display a safe error with an optional retry action. */
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={19} />
      <div>
        <strong>Something went wrong</strong>
        <p>{message}</p>
        {retry && (
          <button type="button" className="text-link" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
/** Compact label above a page or section title. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="eyebrow">
      <span className="eyebrow-dot" />
      {children}
    </span>
  );
}
/** Render a concise time or date. */
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
