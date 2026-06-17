import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, money, statusLabel, statusTone } from "@/lib/format";
import { StatusPill } from "@/components/StatCard";
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
        .order("scheduled_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const all = bookingsQ.data ?? [];
  const filtered = all.filter((b: any) => {
    if (filter === "unpaid") return b.payment_status !== "paid" && b.payment_status !== "deposit_paid";
    if (filter === "deposit") return b.payment_status === "deposit_paid";
    return b.payment_status === "paid";
  });

  const totals = filtered.reduce(
    (acc, b: any) => {
      acc.count += 1;
      acc.amount += b.price_cents;
      return acc;
    },
    { count: 0, amount: 0 },
  );

  async function markPaid(id: string, method: string) {
    const { error } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        payment_method: method as "cash" | "etransfer" | "card" | "other",
        paid_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payments-all"] });
    toast.success("Marked paid");
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
          {totals.count} {filter === "paid" ? "paid" : filter === "deposit" ? "with deposit" : "unpaid"} · {money(totals.amount)}
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
              <th className="text-right px-5 py-3">Mark paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((b: any) => (
              <tr key={b.id}>
                <td className="px-5 py-3">
                  <div className="font-medium">{b.students?.full_name}</div>
                  <div className="text-xs text-slate-500">{b.students?.phone}</div>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {b.lesson_types?.name}
                  <div className="text-xs text-slate-400">{fmtDateTime(b.scheduled_at)}</div>
                </td>
                <td className="px-5 py-3 font-medium">{money(b.price_cents)}</td>
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
                          onClick={() => markPaid(b.id, m)}
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
            ))}
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
