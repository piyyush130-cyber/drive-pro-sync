import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isBotSubmission } from "@/lib/booking-logic";

const RequestSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    message: z.string().trim().min(1).max(2000),
    school_id: z.string().uuid(),
    website: z.string().max(200).optional(),
    formRenderedAt: z.number().optional(),
  })
  .refine((d) => !!d.email || !!d.phone, {
    message: "Provide an email or phone number so the school can reach you",
    path: ["email"],
  });

export const submitCustomPackageRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RequestSchema.parse(data))
  .handler(async ({ data }) => {
    if (isBotSubmission(data)) {
      return { ok: true };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("id")
      .eq("id", data.school_id)
      .maybeSingle();
    if (!school) throw new Error("Invalid school");

    const { error } = await supabaseAdmin.from("custom_package_requests").insert({
      school_id: data.school_id,
      full_name: data.full_name,
      email: data.email || null,
      phone: data.phone || null,
      message: data.message,
    });
    if (error) throw new Error("Could not submit your request");

    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("school_name")
      .eq("school_id", data.school_id)
      .maybeSingle();
    const school_name = settings?.school_name ?? "your driving school";

    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("profiles(email)")
      .eq("school_id", data.school_id)
      .eq("role", "admin");

    const { sendEmail } = await import("@/lib/email.server");
    for (const a of admins ?? []) {
      const email = (a as any).profiles?.email;
      if (!email) continue;
      await sendEmail({
        to: email,
        subject: `Custom package request — ${data.full_name}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A2E;">
            <h2 style="margin-bottom: 8px;">A student is requesting a custom package</h2>
            <p style="color: #6B6B7B; font-size: 14px;">${school_name}</p>
            <ul style="list-style: none; padding: 0; font-size: 14px; line-height: 1.8;">
              <li><strong>Name:</strong> ${data.full_name}</li>
              ${data.email ? `<li><strong>Email:</strong> ${data.email}</li>` : ""}
              ${data.phone ? `<li><strong>Phone:</strong> ${data.phone}</li>` : ""}
            </ul>
            <p style="font-size: 14px; white-space: pre-wrap;">${data.message}</p>
            <p style="color: #94A3B8; font-size: 11px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #E2E8F0;">
              Sent via DrivingOps
            </p>
          </div>
        `,
      });
    }

    return { ok: true };
  });
