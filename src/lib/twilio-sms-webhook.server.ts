// Raw Twilio inbound-SMS webhook handler, intercepted directly in
// server.ts before the TanStack Start router — mirrors the Stripe webhook
// pattern (stripe-webhook.server.ts), since Twilio's request signature is
// computed over the exact webhook URL and raw form body.
//
// This is the CASL/STOP-compliance backstop: whatever Twilio does at the
// platform/carrier level, this app-level handler is the one thing we
// actually control, so it's the source of truth `sendSms` checks against.
import { normalizePhoneDigits } from "@/lib/booking-validation";

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START_KEYWORDS = new Set(["START", "UNSTOP", "YES"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(body, { status: 200, headers: { "content-type": "text/xml" } });
}

export async function handleTwilioSmsWebhook(request: Request): Promise<Response> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[twilio-webhook] TWILIO_AUTH_TOKEN not set — rejecting");
    return new Response("Webhook not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const twilio = (await import("twilio")).default;
  const valid = twilio.validateRequest(authToken, signature, request.url, params);
  if (!valid) {
    console.error("[twilio-webhook] signature verification failed");
    return new Response("Invalid signature", { status: 403 });
  }

  const digits = normalizePhoneDigits(params.From ?? "");
  const keyword = (params.Body ?? "").trim().toUpperCase();
  if (!digits) return twiml();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (STOP_KEYWORDS.has(keyword)) {
    await supabaseAdmin
      .from("sms_opt_outs")
      .upsert(
        { phone_digits: digits, opted_out_at: new Date().toISOString() },
        { onConflict: "phone_digits" },
      );
    return twiml(
      "You've been unsubscribed and won't receive further texts. Reply START to resubscribe.",
    );
  }

  if (START_KEYWORDS.has(keyword)) {
    await supabaseAdmin.from("sms_opt_outs").delete().eq("phone_digits", digits);
    return twiml("You're resubscribed and will receive texts about your bookings again.");
  }

  if (HELP_KEYWORDS.has(keyword)) {
    return twiml("DrivingOps sends texts about your driving lesson bookings. Reply STOP to unsubscribe.");
  }

  return twiml();
}
