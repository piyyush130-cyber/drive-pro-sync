import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { captureServerError } from "./lib/sentry.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const error = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(error);
  captureServerError(error);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Raw HTTP endpoints that must not go through TanStack Start's router —
// Stripe's webhook needs the unparsed body for signature verification, and
// this is called before any TanStack request handling touches it.
async function handleRawRoute(request: Request): Promise<Response | null> {
  const { pathname, origin } = new URL(request.url);
  if (pathname === "/api/stripe-webhook" && request.method === "POST") {
    const { handleStripeWebhook } = await import("./lib/stripe-webhook.server");
    return handleStripeWebhook(request);
  }
  if (pathname === "/api/invitation-sweep" && request.method === "POST") {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("x-cron-secret") !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
    try {
      const { supabaseAdmin } = await import("./integrations/supabase/client.server");
      const { runInvitationSweep } = await import("./lib/lesson-invitations.server");
      const result = await runInvitationSweep(supabaseAdmin, origin);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      console.error("[invitation-sweep] failed:", error);
      captureServerError(error);
      return new Response(JSON.stringify({ error: "sweep failed" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }
  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const rawResponse = await handleRawRoute(request);
      if (rawResponse) return rawResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      captureServerError(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
