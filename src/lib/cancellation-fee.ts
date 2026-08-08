export type FeeType = "none" | "flat" | "percentage";

// "flat" feeValue is cents (matches every other money field in this app);
// "percentage" feeValue is an integer 0-100 applied to the lesson's own
// price_cents. Never auto-charged — the caller writes the result onto the
// booking's price_cents so it surfaces as an amount owed in Payment
// Tracking, same as everything else already works.
export function computeCancellationFeeCents(
  feeType: FeeType | string,
  feeValue: number,
  lessonPriceCents: number,
): number {
  if (feeType === "flat") return Math.max(0, Math.round(feeValue));
  if (feeType === "percentage") return Math.max(0, Math.round((lessonPriceCents * feeValue) / 100));
  return 0;
}
