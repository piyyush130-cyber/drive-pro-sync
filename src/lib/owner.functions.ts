import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GRACE_PERIOD_DAYS } from "@/lib/plans";

async function requireOwner(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_platform_owner", {
    _user_id: context.userId,
  });
  if (error || !data) throw new Error("Forbidden");
}

export const listSchoolsForOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: schools }, { data: billing }, { data: instructors }] = await Promise.all([
      supabaseAdmin.from("schools").select("id, name, slug, created_at").order("created_at"),
      supabaseAdmin.from("school_billing").select("*"),
      supabaseAdmin.from("instructors").select("school_id").is("deleted_at", null),
    ]);

    const billingBySchool = new Map((billing ?? []).map((b: any) => [b.school_id, b]));
    const instructorCounts = new Map<string, number>();
    for (const i of instructors ?? []) {
      instructorCounts.set(i.school_id, (instructorCounts.get(i.school_id) ?? 0) + 1);
    }

    return (schools ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      createdAt: s.created_at,
      instructorCount: instructorCounts.get(s.id) ?? 0,
      billing: billingBySchool.get(s.id) ?? null,
    }));
  });

export const ownerExtendTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { schoolId: string; days: number }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("school_billing")
      .select("trial_ends_at")
      .eq("school_id", data.schoolId)
      .maybeSingle();
    const base = existing?.trial_ends_at ? new Date(existing.trial_ends_at) : new Date();
    const newTrialEnd = new Date(Math.max(base.getTime(), Date.now()) + data.days * 86400000);

    const { error } = await supabaseAdmin.from("school_billing").upsert(
      {
        school_id: data.schoolId,
        billing_status: "trialing",
        trial_ends_at: newTrialEnd.toISOString(),
      },
      { onConflict: "school_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, trialEndsAt: newTrialEnd.toISOString() };
  });

export const ownerMarkFreeForever = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { schoolId: string }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: billing } = await supabaseAdmin
      .from("school_billing")
      .select("stripe_subscription_id")
      .eq("school_id", data.schoolId)
      .maybeSingle();

    // Structurally exempt from billing means no live Stripe subscription can
    // exist for this school, not just a status flag saying so.
    if (billing?.stripe_subscription_id) {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      try {
        await stripe.subscriptions.cancel(billing.stripe_subscription_id);
      } catch (err: any) {
        if (err?.code !== "resource_missing") throw err;
      }
    }

    const { error } = await supabaseAdmin.from("school_billing").upsert(
      {
        school_id: data.schoolId,
        billing_status: "free_forever",
        stripe_subscription_id: null,
        trial_ends_at: null,
        grace_period_ends_at: null,
      },
      { onConflict: "school_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ownerSuspendSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { schoolId: string }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("school_billing")
      .upsert(
        { school_id: data.schoolId, billing_status: "suspended" },
        { onConflict: "school_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ownerDeleteSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { schoolId: string; confirmName: string }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("id, name")
      .eq("id", data.schoolId)
      .maybeSingle();
    if (!school) throw new Error("School not found");
    if (data.confirmName !== school.name)
      throw new Error("Name didn't match — nothing was deleted.");

    const { data: billing } = await supabaseAdmin
      .from("school_billing")
      .select("stripe_subscription_id")
      .eq("school_id", data.schoolId)
      .maybeSingle();
    if (billing?.stripe_subscription_id) {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      try {
        await stripe.subscriptions.cancel(billing.stripe_subscription_id);
      } catch (err: any) {
        if (err?.code !== "resource_missing") throw err;
      }
    }

    // schools is the root of an ON DELETE CASCADE chain covering every
    // school-scoped table, so this one delete purges all related data.
    const { error } = await supabaseAdmin.from("schools").delete().eq("id", data.schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ownerReactivateSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { schoolId: string }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: billing } = await supabaseAdmin
      .from("school_billing")
      .select("stripe_subscription_id")
      .eq("school_id", data.schoolId)
      .maybeSingle();

    let newStatus: string = "locked"; // no subscription — needs to (re)subscribe
    let graceEndsAt: string | null = null;
    if (billing?.stripe_subscription_id) {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      try {
        const sub = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
        if (sub.status === "trialing") newStatus = "trialing";
        else if (sub.status === "active") newStatus = "active";
        else if (sub.status === "past_due") {
          newStatus = "grace_period";
          graceEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 86400000).toISOString();
        } else newStatus = "locked";
      } catch {
        newStatus = "locked";
      }
    }

    const { error } = await supabaseAdmin
      .from("school_billing")
      .upsert(
        { school_id: data.schoolId, billing_status: newStatus, grace_period_ends_at: graceEndsAt },
        { onConflict: "school_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, status: newStatus };
  });
