// Raw Stripe webhook handler. Intercepted directly in server.ts, before the
// TanStack Start router, so we get the unparsed request body Stripe's
// signature verification requires.
import { TRIAL_DAYS, GRACE_PERIOD_DAYS } from "@/lib/plans";

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — rejecting");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    const schoolId = session.metadata?.school_id;
    const plan = session.metadata?.plan;
    const interval = session.metadata?.interval;
    if (schoolId && session.subscription) {
      const { error } = await supabaseAdmin.from("school_billing").upsert(
        {
          school_id: schoolId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan: plan ?? null,
          billing_interval: interval ?? null,
          billing_status: "trialing",
          trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
          grace_period_ends_at: null,
        },
        { onConflict: "school_id" },
      );
      if (error) console.error("[stripe-webhook] failed to record checkout completion:", error);
    }
  }

  // Failed charge (trial ending with no valid card, or a renewal charge
  // failing) starts our own 3-day grace period — independent of Stripe's
  // own retry/dunning schedule, so we control the exact window promised
  // to schools ("3-day grace period").
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as import("stripe").Stripe.Invoice;
    const subDetails = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = typeof subDetails === "string" ? subDetails : subDetails?.id;
    if (subscriptionId) {
      const { error } = await supabaseAdmin
        .from("school_billing")
        .update({
          billing_status: "grace_period",
          grace_period_ends_at: new Date(Date.now() + GRACE_PERIOD_DAYS * 86400000).toISOString(),
        })
        .eq("stripe_subscription_id", subscriptionId)
        .neq("billing_status", "free_forever")
        .neq("billing_status", "suspended");
      if (error) console.error("[stripe-webhook] failed to record payment failure:", error);
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as import("stripe").Stripe.Invoice;
    const subDetails = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = typeof subDetails === "string" ? subDetails : subDetails?.id;
    if (subscriptionId) {
      const { error } = await supabaseAdmin
        .from("school_billing")
        .update({ billing_status: "active", grace_period_ends_at: null })
        .eq("stripe_subscription_id", subscriptionId)
        .neq("billing_status", "free_forever")
        .neq("billing_status", "suspended");
      if (error) console.error("[stripe-webhook] failed to record payment success:", error);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as import("stripe").Stripe.Subscription;
    const { error } = await supabaseAdmin
      .from("school_billing")
      .update({ billing_status: "locked" })
      .eq("stripe_subscription_id", sub.id)
      .neq("billing_status", "free_forever")
      .neq("billing_status", "suspended");
    if (error) console.error("[stripe-webhook] failed to record subscription deletion:", error);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
