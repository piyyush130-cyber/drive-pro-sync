import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { isBotSubmission } from "@/lib/booking-logic";
import { normalizePhoneDigits } from "@/lib/booking-validation";
import { generateToken, hashToken } from "@/lib/student-portal-token.server";
import {
  requireStudentSession,
  LOGIN_LINK_TTL_MS,
  SESSION_TTL_MS,
  LOGIN_RATE_LIMIT_WINDOW_MINUTES,
  LOGIN_RATE_LIMIT_MAX,
} from "@/lib/student-portal-auth.server";

function originFromRequest(): string {
  const request = getRequest();
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function emailLayout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A2E;">
      <h2 style="margin-bottom: 8px;">${title}</h2>
      ${bodyHtml}
      <p style="color: #94A3B8; font-size: 11px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #E2E8F0;">
        Sent via DrivingOps
      </p>
    </div>
  `;
}

async function sendLoginLink(
  supabaseAdmin: any,
  student: { id: string; full_name: string; email: string | null; phone: string | null },
  schoolId: string,
  schoolSlug: string,
  schoolName: string,
  contactMethod: "email" | "sms",
) {
  // Rate limit: only meaningful once a real match is found — probing
  // non-existent contacts is a cheap read with no side effects, so it
  // doesn't need its own limit.
  const windowStart = new Date(Date.now() - LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60000).toISOString();
  const { count } = await supabaseAdmin
    .from("student_login_links")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .gte("created_at", windowStart);
  if ((count ?? 0) >= LOGIN_RATE_LIMIT_MAX) return;

  const rawToken = generateToken();
  const { error } = await supabaseAdmin.from("student_login_links").insert({
    student_id: student.id,
    school_id: schoolId,
    token_hash: hashToken(rawToken),
    contact_method: contactMethod,
    expires_at: new Date(Date.now() + LOGIN_LINK_TTL_MS).toISOString(),
  });
  if (error) return;

  const url = `${originFromRequest()}/${schoolSlug}/portal/verify?token=${rawToken}`;
  const firstName = student.full_name?.split(" ")[0] || "there";

  if (contactMethod === "email" && student.email) {
    const { sendEmail } = await import("@/lib/email.server");
    await sendEmail({
      to: student.email,
      subject: `Your ${schoolName} login link`,
      html: emailLayout(
        "Log in to your student portal",
        `<p style="font-size: 14px;">Hi ${firstName}, click below to log in to ${schoolName}. This link expires in 15 minutes and can only be used once.</p>
         <p style="margin: 20px 0;"><a href="${url}" style="background:#1B2B4B;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Log in</a></p>
         <p style="font-size: 12px; color: #6B6B7B;">If you didn't request this, you can safely ignore this email.</p>`,
      ),
    });
  } else if (contactMethod === "sms" && student.phone) {
    const { sendSms } = await import("@/lib/sms.server");
    await sendSms(
      student.phone,
      `Hi ${firstName}, here's your ${schoolName} login link: ${url} (expires in 15 min)`,
    );
  }
}

const RequestLoginSchema = z.object({
  schoolSlug: z.string(),
  contact: z.string().min(3),
  website: z.string().optional(),
  formRenderedAt: z.number().optional(),
});

// Public — always returns the same generic response regardless of whether
// the contact info matched a real student, an unmatched student, or a bad
// school slug, so the endpoint can't be used to enumerate who is or isn't
// a customer of this school.
export const requestPortalLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RequestLoginSchema.parse(d))
  .handler(async ({ data }) => {
    const genericResult = { ok: true as const };
    if (isBotSubmission(data)) return genericResult;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("id, name, slug")
      .eq("slug", data.schoolSlug)
      .maybeSingle();
    if (!school) return genericResult;

    const contact = data.contact.trim();
    const isEmail = contact.includes("@");

    let matches: { id: string; full_name: string; email: string | null; phone: string | null }[] = [];
    if (isEmail) {
      const { data: rows } = await supabaseAdmin
        .from("students")
        .select("id, full_name, email, phone")
        .eq("school_id", school.id)
        .is("deleted_at", null)
        .ilike("email", contact)
        .limit(5);
      matches = rows ?? [];
    } else {
      const digits = normalizePhoneDigits(contact);
      if (digits.length >= 7) {
        const { data: rows } = await supabaseAdmin
          .from("students")
          .select("id, full_name, email, phone")
          .eq("school_id", school.id)
          .is("deleted_at", null)
          .not("phone", "is", null);
        matches = (rows ?? []).filter((r: any) => normalizePhoneDigits(r.phone ?? "") === digits);
      }
    }

    for (const student of matches) {
      await sendLoginLink(
        supabaseAdmin,
        student,
        school.id,
        school.slug,
        school.name,
        isEmail ? "email" : "sms",
      );
    }

    return genericResult;
  });

const VerifySchema = z.object({ token: z.string().min(20) });

export const verifyPortalLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VerifySchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = hashToken(data.token);

    // Atomic single-use redemption — a plain SELECT-then-UPDATE would let a
    // double-click or an email-security-scanner prefetch race past the
    // used_at check and redeem the same link twice.
    const { data: link, error } = await supabaseAdmin
      .from("student_login_links")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("student_id, school_id")
      .maybeSingle();
    if (error || !link) throw new Error("This link is invalid or has expired.");

    const rawSessionToken = generateToken();
    const { error: sessionErr } = await supabaseAdmin.from("student_sessions").insert({
      student_id: link.student_id,
      school_id: link.school_id,
      token_hash: hashToken(rawSessionToken),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });
    if (sessionErr) throw new Error("Could not start your session. Please try again.");

    return { sessionToken: rawSessionToken };
  });

const LogoutSchema = z.object({ sessionToken: z.string() });

export const logoutPortalSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LogoutSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Confirm the session belongs to a real, still-valid token before
    // revoking — otherwise this becomes a way to guess-and-invalidate
    // arbitrary sessions.
    const { studentId } = await requireStudentSession(supabaseAdmin, data.sessionToken);
    await supabaseAdmin
      .from("student_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashToken(data.sessionToken))
      .eq("student_id", studentId);
    return { ok: true };
  });
