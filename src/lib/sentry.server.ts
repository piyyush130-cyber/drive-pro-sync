// Server-side Sentry init. Import for its side effect as early as possible
// in the server request lifecycle (see start.ts / server.ts), then use
// captureServerError() from catch blocks.
import * as Sentry from "@sentry/node";

let initialized = false;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

ensureInit();

export function captureServerError(error: unknown) {
  ensureInit();
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(error);
}
