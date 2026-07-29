// Server-only email sending via Resend.
// Load inside server handlers: const { sendEmail } = await import("@/lib/email.server");
import { Resend } from "resend";

// Resend's shared test sender — works with no domain setup, but Resend
// only actually delivers to the email address on the Resend account
// until a sending domain is verified. Swap this once a domain is added.
const FROM_ADDRESS = "DriveProSync <onboarding@resend.dev>";

let _resend: Resend | undefined;
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not set — skipping email send.");
    return null;
  }
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) console.error("[email] send failed:", error);
  } catch (err) {
    // Email delivery is best-effort — never let a notification failure
    // break the booking flow it was triggered from.
    console.error("[email] send threw:", err);
  }
}
