// Server-only SMS sending via Twilio.
// Load inside server handlers: const { sendSms } = await import("@/lib/sms.server");
import type { Twilio } from "twilio";

let _client: Twilio | null | undefined;

async function getClient(): Promise<Twilio | null> {
  if (_client !== undefined) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.error("[sms] TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set — skipping SMS send.");
    _client = null;
    return null;
  }
  const twilio = (await import("twilio")).default;
  _client = twilio(sid, token);
  return _client;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const client = await getClient();
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!client || !from) {
    console.error("[sms] not configured — skipping send to", to);
    return;
  }
  try {
    await client.messages.create({ to, from, body });
  } catch (err) {
    // Best-effort — a failed text should never break the booking/invitation
    // flow that triggered it.
    console.error("[sms] send failed:", err);
  }
}
