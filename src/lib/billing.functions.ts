import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { priceIdFor, TRIAL_DAYS, type PlanKey, type BillingInterval } from "@/lib/plans";

async function requireAdminSchoolId(context: { supabase: any; userId: string }): Promise<string> {
  const { data: roleRow } = await context.supabase
    .from("user_roles")
    .select("school_id")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (!roleRow?.school_id) throw new Error("Forbidden");
  return roleRow.school_id;
}

function originFromRequest(): string {
  const request = getRequest();
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function ensureStripeCustomer(supabaseAdmin: any, schoolId: string): Promise<string> {
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const { data: billing } = await supabaseAdmin
    .from("school_billing")
    .select("stripe_customer_id")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (billing?.stripe_customer_id) return billing.stripe_customer_id;

  const { data: school } = await supabaseAdmin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  const customer = await stripe.customers.create({
    name: school?.name ?? undefined,
    metadata: { school_id: schoolId },
  });
  await supabaseAdmin
    .from("school_billing")
    .upsert({ school_id: schoolId, stripe_customer_id: customer.id }, { onConflict: "school_id" });
  return customer.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: PlanKey; interval: BillingInterval }) => d)
  .handler(async ({ data, context }) => {
    const schoolId = await requireAdminSchoolId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const customerId = await ensureStripeCustomer(supabaseAdmin, schoolId);
    const origin = originFromRequest();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdFor(data.plan, data.interval), quantity: 1 }],
      payment_method_collection: "always",
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { school_id: schoolId },
      },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/onboarding?step=7`,
      metadata: { school_id: schoolId, plan: data.plan, interval: data.interval },
    });

    if (!session.url) throw new Error("Could not start checkout");
    return { url: session.url };
  });

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await requireAdminSchoolId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const { data: billing } = await supabaseAdmin
      .from("school_billing")
      .select("stripe_customer_id")
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!billing?.stripe_customer_id) throw new Error("No billing account on file yet");

    const origin = originFromRequest();
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${origin}/settings`,
    });
    return { url: session.url };
  });

// Friendly pre-flight check used before every instructor-creation UI action
// (the DB trigger enforce_instructor_limit is the hard backstop).
export const checkInstructorLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await requireAdminSchoolId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PLANS } = await import("@/lib/plans");

    const [{ data: billing }, { count }] = await Promise.all([
      supabaseAdmin
        .from("school_billing")
        .select("plan, billing_status")
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from("instructors")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .is("deleted_at", null),
    ]);

    const current = count ?? 0;
    if (!billing?.plan || billing.billing_status === "free_forever") {
      return { atLimit: false, current, limit: null as number | null };
    }
    const limit = PLANS[billing.plan as keyof typeof PLANS].instructorLimit;
    return { atLimit: current >= limit, current, limit };
  });
