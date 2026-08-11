import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, money, statusLabel, statusTone } from "@/lib/format";
import { StatusPill } from "@/components/StatCard";
import { recordBookingPayment, type PaymentMethod } from "@/lib/booking-payments";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

type Filter = "unpaid" | "deposit" | "paid";

function PaymentsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("unpaid");

  const bookingsQ = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, students(full_name, phone), lesson_types(name)")
        .is("deleted_at", null)
        .order("scheduled_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const paymentsQ = useQuery({
    queryKey: ["booking-payments-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("booking_payments").select("booking_id, amount_cents");
      if (error) throw error;
      return data ?? [];
    },
  });

  const paidByBooking = new Map<string, number>();
  for (const p of paymentsQ.data ?? []) {
    paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) ?? 0) + p.amount_cents);
  }

  const all = bookingsQ.data ?? [];
  const filtered = all.filter((b: any) => {
    if (filter === "unpaid")
      return b.payment_status !== "paid" && b.payment_status !== "deposit_paid";
    if (filter === "deposit") return b.payment_status === "deposit_paid";
    return b.payment_status === "paid";
  });

  const totals = filtered.reduce(
    (acc, b: any) => {
      acc.count += 1;
      const paid = paidByBooking.get(b.id) ?? 0;
      acc.amount += filter === "deposit" ? Math.max(0, b.price_cents - paid) : b.price_cents;
      return acc;
    },
    { count: 0, amount: 0 },
  );

  async function handleRecordPayment(b: any, method: PaymentMethod) {
    const remaining = Math.max(0, b.price_cents - (paidByBooking.get(b.id) ?? 0));
    const input = window.prompt(
      `Amount received (${method})?`,
      (remaining / 100).toFixed(2),
    );
    if (input === null) return;
    const amountCents = Math.round(Number(input) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    try {
      const result = await recordBookingPayment(
        { id: b.id, school_id: b.school_id, price_cents: b.price_cents },
        amountCents,
        method,
      );
      qc.invalidateQueries({ queryKey: ["payments-all"] });
      qc.invalidateQueries({ queryKey: ["booking-payments-all"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(
        result.status === "paid"
          ? "Marked fully paid"
          : `Payment recorded — ${money(result.remaining)} remaining`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Could not record payment");
    }
  }

  const tabs: { id: Filter; label: string }[] = [
    { id: "unpaid", label: "All unpaid" },
    { id: "deposit", label: "Deposit paid" },
    { id: "paid", label: "Paid" },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Payments</h1>
        <p className="text-sm text-slate-500 mt-1">
          {totals.count}{" "}
          {filter === "paid"
            ? "paid"
            : filter === "deposit"
              ? "partially paid — balance remaining"
              : "unpaid"}{" "}
          · {money(totals.amount)}
        </p>
      </div>

      <div className="flex gap-1 mb-4 p-1 bg-slate-100 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              filter === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-5 py-3">Student</th>
              <th className="text-left px-5 py-3">Lesson</th>
              <th className="text-left px-5 py-3">Amount</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Record payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((b: any) => {
              const paid = paidByBooking.get(b.id) ?? 0;
              const remaining = Math.max(0, b.price_cents - paid);
              return (
                <tr key={b.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{b.students?.full_name}</div>
                    <div className="text-xs text-slate-500">{b.students?.phone}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {b.lesson_types?.name}
                    <div className="text-xs text-slate-400">{fmtDateTime(b.scheduled_at)}</div>
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {money(b.price_cents)}
                    {paid > 0 && b.payment_status !== "paid" && (
                      <div className="text-xs font-normal text-slate-500">
                        {money(paid)} paid · {money(remaining)} remaining
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill tone={statusTone[b.payment_status]}>
                      {statusLabel(b.payment_status)}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {b.payment_status !== "paid" ? (
                      <div className="inline-flex gap-1">
                        {(["cash", "etransfer", "card"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => handleRecordPayment(b, m)}
                            className="text-xs bg-slate-100 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition-colors"
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-sm text-slate-500">
            {filter === "unpaid" ? "All paid up. 🎉" : "Nothing here."}
          </div>
        )}
      </div>
    </div>
  );
}
