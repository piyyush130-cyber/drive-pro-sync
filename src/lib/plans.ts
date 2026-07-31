export type PlanKey = "starter" | "professional" | "enterprise";
export type BillingInterval = "monthly" | "annual";

export const PLANS: Record<
  PlanKey,
  {
    name: string;
    monthlyCents: number;
    instructorLimit: number;
    tagline: string;
    priceIds: Record<BillingInterval, string>;
  }
> = {
  starter: {
    name: "Starter",
    monthlyCents: 6900,
    instructorLimit: 3,
    tagline: "For solo instructors and small teams (1–3 instructors).",
    priceIds: {
      monthly: "price_1Tz5du9fekN82lV0kgzr0k59",
      annual: "price_1Tz5du9fekN82lV0jBWp0cGL",
    },
  },
  professional: {
    name: "Professional",
    monthlyCents: 14900,
    instructorLimit: 9,
    tagline: "For growing schools (4–9 instructors).",
    priceIds: {
      monthly: "price_1Tz5dv9fekN82lV0B7ULNexQ",
      annual: "price_1Tz5dv9fekN82lV0dyZAS96N",
    },
  },
  enterprise: {
    name: "Enterprise",
    monthlyCents: 29900,
    instructorLimit: 10,
    tagline: "White-label branding, priority support, and dedicated onboarding.",
    priceIds: {
      monthly: "price_1Tz5dv9fekN82lV0MvJkdDiT",
      annual: "price_1Tz5dv9fekN82lV0o8X6s3l4",
    },
  },
};

export const PLAN_ORDER: PlanKey[] = ["starter", "professional", "enterprise"];

export const TRIAL_DAYS = 14;
export const GRACE_PERIOD_DAYS = 3;

export function annualCents(plan: PlanKey): number {
  return PLANS[plan].monthlyCents * 10; // 2 months free
}

export function priceIdFor(plan: PlanKey, interval: BillingInterval): string {
  return PLANS[plan].priceIds[interval];
}

export function planForPriceId(priceId: string): PlanKey | null {
  for (const key of PLAN_ORDER) {
    if (PLANS[key].priceIds.monthly === priceId || PLANS[key].priceIds.annual === priceId)
      return key;
  }
  return null;
}
