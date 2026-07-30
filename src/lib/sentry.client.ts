// Client-side Sentry init. Call once from the root component on mount.
import * as Sentry from "@sentry/react";

let initialized = false;

export function initClientSentry() {
  if (initialized) return;
  initialized = true;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export function captureClientError(error: unknown) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureException(error);
}
