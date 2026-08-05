import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { createCheckoutSession } from "@/lib/billing.functions";
import {
  PLANS,
  PLAN_ORDER,
  annualCents,
  ANNUAL_DISCOUNT_PERCENT,
  type PlanKey,
  type BillingInterval,
} from "@/lib/plans";
import { money } from "@/lib/format";
import { toast } from "sonner";

const THEME = {
  dark: {
    toggleTrack: "bg-black/20",
    toggleActive: "bg-[#3B82F6] text-white",
    toggleInactive: "text-slate-400 hover:text-white",
    cardBorder: "border-slate-700",
    cardBorderSelected: "border-[#3B82F6] bg-[#3B82F6]/10",
    radioBorder: "border-slate-600",
    planName: "text-white",
    tagline: "text-slate-400",
    price: "text-white",
    priceInterval: "text-slate-500",
  },
  light: {
    toggleTrack: "bg-slate-100",
    toggleActive: "bg-blue-600 text-white",
    toggleInactive: "text-slate-500 hover:text-slate-900",
    cardBorder: "border-slate-200",
    cardBorderSelected: "border-blue-600 bg-blue-50",
    radioBorder: "border-slate-300",
    planName: "text-slate-900",
    tagline: "text-slate-500",
    price: "text-slate-900",
    priceInterval: "text-slate-400",
  },
} as const;

export function PlanPicker({
  ctaLabel = "Start my free trial",
  variant = "dark",
}: {
  ctaLabel?: string;
  variant?: "dark" | "light";
}) {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("starter");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [busy, setBusy] = useState(false);
  const checkout = useServerFn(createCheckoutSession);
  const t = THEME[variant];

  async function startCheckout() {
    setBusy(true);
    try {
      const { url } = await checkout({ data: { plan: selectedPlan, interval: billingInterval } });
      window.location.href = url;
    } catch (err: any) {
      toast.error(err?.message || "Could not start checkout");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className={`flex gap-1 ${t.toggleTrack} rounded-lg p-1 w-fit mx-auto`}>
        {(["monthly", "annual"] as const).map((iv) => (
          <button
            key={iv}
            onClick={() => setBillingInterval(iv)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              billingInterval === iv ? t.toggleActive : t.toggleInactive
            }`}
          >
            {iv === "monthly" ? "Monthly" : `Annual — Save ${ANNUAL_DISCOUNT_PERCENT}%`}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const cents = billingInterval === "monthly" ? plan.monthlyCents : annualCents(key);
          const checked = selectedPlan === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedPlan(key)}
              className={`w-full text-left p-4 rounded-lg border transition ${
                checked ? t.cardBorderSelected : `${t.cardBorder} bg-transparent`
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`size-4 rounded-full border-2 mt-0.5 shrink-0 ${
                      checked ? "border-[#3B82F6] bg-[#3B82F6]" : t.radioBorder
                    }`}
                  />
                  <div>
                    <div className={`text-sm font-semibold ${t.planName}`}>{plan.name}</div>
                    <div className={`text-xs mt-0.5 ${t.tagline}`}>{plan.tagline}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-semibold ${t.price}`}>
                    {money(cents)}
                    <span className={`font-normal ${t.priceInterval}`}>
                      /{billingInterval === "monthly" ? "mo" : "yr"}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button onClick={startCheckout} disabled={busy} className="btn-primary w-full">
        {busy ? (
          "Redirecting…"
        ) : (
          <>
            {ctaLabel} <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </div>
  );
}
