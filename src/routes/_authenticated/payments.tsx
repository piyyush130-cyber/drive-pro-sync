import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, money, statusLabel, statusTone } from "@/lib/format";
import { StatusPill } from "@/components/StatCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const qc = useQueryClient();
  const unpaidQ = useQuery({
    queryKey: ["unpaid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, students(full_name, phone), lesson_types(name)")
        .neq("payment_status", "paid")
        .order("scheduled_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = (unpaidQ.data ?? []).reduce(
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
        payment_method: method,
        paid_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["unpaid"] });
    toast.success("Marked paid");
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Payments</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {totals.count} unpaid · {money(totals.amount)} outstanding
        </p>
      </div>

      <div className="bg-white ring-1 ring-black/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="text-left px-5 py-3">Student</th>
              <th className="text-left px-5 py-3">Lesson</th>
              <th className="text-left px-5 py-3">Amount</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Mark paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(unpaidQ.data ?? []).map((b: any) => (
              <tr key={b.id}>
                <td className="px-5 py-3">
                  <div className="font-medium">{b.students?.full_name}</div>
                  <div className="text-xs text-zinc-500">{b.students?.phone}</div>
                </td>
                <td className="px-5 py-3 text-zinc-600">
                  {b.lesson_types?.name}
                  <div className="text-xs text-zinc-400">{fmtDateTime(b.scheduled_at)}</div>
                </td>
                <td className="px-5 py-3 font-medium">{money(b.price_cents)}</td>
                <td className="px-5 py-3">
                  <StatusPill tone={statusTone[b.payment_status]}>
                    {statusLabel(b.payment_status)}
                  </StatusPill>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex gap-1">
                    {(["cash", "etransfer", "card"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => markPaid(b.id, m)}
                        className="text-xs bg-zinc-100 hover:bg-emerald-800 hover:text-white px-2 py-1 rounded transition-colors"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(unpaidQ.data ?? []).length === 0 && (
          <div className="text-center py-10 text-sm text-zinc-500">All paid up. 🎉</div>
        )}
      </div>
    </div>
  );
}
