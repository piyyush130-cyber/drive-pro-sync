import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { createCheckoutSession } from "@/lib/billing.functions";
import { PLANS, PLAN_ORDER, annualCents, type PlanKey, type BillingInterval } from "@/lib/plans";
import { money } from "@/lib/format";
import { toast } from "sonner";

export function PlanPicker({ ctaLabel = "Start my free trial" }: { ctaLabel?: string }) {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("starter");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [busy, setBusy] = useState(false);
  const checkout = useServerFn(createCheckoutSession);

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
      <div className="flex gap-1 bg-black/20 rounded-lg p-1 w-fit mx-auto">
        {(["monthly", "annual"] as const).map((iv) => (
          <button
            key={iv}
            onClick={() => setBillingInterval(iv)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              billingInterval === iv ? "bg-[#3B82F6] text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {iv === "monthly" ? "Monthly" : "Annual — 2 months free"}
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
                checked ? "border-[#3B82F6] bg-[#3B82F6]/10" : "border-slate-700 bg-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`size-4 rounded-full border-2 mt-0.5 shrink-0 ${
                      checked ? "border-[#3B82F6] bg-[#3B82F6]" : "border-slate-600"
                    }`}
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">{plan.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{plan.tagline}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-white">
                    {money(cents)}
                    <span className="text-slate-500 font-normal">
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
