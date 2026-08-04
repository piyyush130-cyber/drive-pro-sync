import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GRACE_PERIOD_DAYS, DORMANT_AFTER_DAYS } from "@/lib/plans";

// A school counts as "locked out" the moment its data becomes inaccessible
// to it: either Stripe fully canceled the subscription (billing_status
// flips to "locked" immediately, so school_billing.updated_at is that
// moment), or the grace period after a failed payment ran out without
// billing_status ever changing (nothing flips it — see the shared
// architecture note about lazily-computed lockout — so grace_period_ends_at
// itself is the lockout moment).
function lockedOutSince(billing: {
  billing_status: string;
  grace_period_ends_at: string | null;
  updated_at: string;
} | null): string | null {
  if (!billing) return null;
  if (billing.billing_status === "locked") return billing.updated_at;
  if (
    billing.billing_status === "grace_period" &&
    billing.grace_period_ends_at &&
    new Date(billing.grace_period_ends_at) < new Date()
  ) {
    return billing.grace_period_ends_at;
  }
  return null;
}

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

    return (schools ?? []).map((s: any) => {
      const billing = (billingBySchool.get(s.id) as any) ?? null;
      const since = lockedOutSince(billing);
      const isDormant = !!since && Date.now() - new Date(since).getTime() >= DORMANT_AFTER_DAYS * 86400000;
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        createdAt: s.created_at,
        instructorCount: instructorCounts.get(s.id) ?? 0,
        billing,
        lockedOutSince: since,
        isDormant,
      };
    });
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

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("school_id", data.schoolId);
    const affectedUserIds = [...new Set((roleRows ?? []).map((r: any) => r.user_id as string))];

    // schools is the root of an ON DELETE CASCADE chain covering every
    // school-scoped table, so this one delete purges all related data.
    const { error } = await supabaseAdmin.from("schools").delete().eq("id", data.schoolId);
    if (error) throw new Error(error.message);

    // Anyone who only had a role at this school now has none anywhere —
    // remove that dangling login too. Never touches the acting owner or
    // any platform owner account (owner access isn't a user_roles row, so
    // it wouldn't be caught by the role-count check below on its own).
    let accountsRemoved = 0;
    for (const uid of affectedUserIds) {
      if (uid === context.userId) continue;
      const { data: isOwnerAccount } = await supabaseAdmin.rpc("is_platform_owner", {
        _user_id: uid,
      });
      if (isOwnerAccount) continue;
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);
      if ((count ?? 0) === 0) {
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
        if (!delErr) accountsRemoved++;
      }
    }

    return { ok: true, accountsRemoved };
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
