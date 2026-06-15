import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, money, statusLabel, statusTone } from "@/lib/format";
import { StatusPill } from "@/components/StatCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bookings")({
  component: BookingsPage,
});

function BookingsPage() {
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const qc = useQueryClient();
  const bookingsQ = useQuery({
    queryKey: ["bookings", filter],
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select("*, students(*), instructors(id, full_name), lesson_types(name, price_cents)")
        .order("scheduled_at", { ascending: true });
      if (filter === "pending") q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const instructorsQ = useQuery({
    queryKey: ["instructors-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("instructors")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      return data ?? [];
    },
  });

  async function update(id: string, patch: any) {
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["pending-bookings"] });
    toast.success("Updated");
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">Bookings</h1>
          <p className="text-sm text-zinc-500 mt-1">Approve, assign instructors, and confirm.</p>
        </div>
        <div className="flex gap-1 bg-white rounded-md p-1 ring-1 ring-black/5">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded ${
                filter === f ? "bg-emerald-800 text-white" : "text-zinc-600"
              }`}
            >
              {f === "pending" ? "Pending" : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {(bookingsQ.data ?? []).map((b: any) => (
          <div key={b.id} className="bg-white ring-1 ring-black/5 rounded-xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
              <div>
                <div className="text-sm font-semibold">{b.students?.full_name}</div>
                <div className="text-xs text-zinc-500">
                  {b.students?.phone} · {b.students?.email ?? "no email"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{fmtDateTime(b.scheduled_at)}</div>
                <div className="text-xs text-zinc-500">
                  {b.lesson_types?.name} · {money(b.price_cents)}
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-xs text-zinc-600 mb-3">
              <div>
                <span className="text-zinc-400">Pickup:</span> {b.pickup_address ?? "—"}
              </div>
              <div>
                <span className="text-zinc-400">Drop-off:</span> {b.dropoff_address ?? "—"}
              </div>
              {b.notes && (
                <div className="sm:col-span-2">
                  <span className="text-zinc-400">Notes:</span> {b.notes}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100">
              <StatusPill tone={statusTone[b.status]}>{statusLabel(b.status)}</StatusPill>
              <StatusPill tone={statusTone[b.payment_status]}>
                {statusLabel(b.payment_status)}
              </StatusPill>
              <select
                value={b.instructor_id ?? ""}
                onChange={(e) => update(b.id, { instructor_id: e.target.value || null })}
                className="text-xs border border-zinc-200 rounded px-2 py-1 bg-white"
              >
                <option value="">— Assign instructor —</option>
                {(instructorsQ.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.full_name}
                  </option>
                ))}
              </select>
              <div className="flex-1" />
              {b.status === "pending" && (
                <>
                  <button
                    onClick={() => update(b.id, { status: "confirmed" })}
                    className="text-xs bg-emerald-800 text-white px-3 py-1.5 rounded font-medium"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => update(b.id, { status: "declined" })}
                    className="text-xs bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded font-medium"
                  >
                    Decline
                  </button>
                </>
              )}
              {b.status === "confirmed" && (
                <>
                  <button
                    onClick={() => update(b.id, { status: "completed" })}
                    className="text-xs bg-emerald-800 text-white px-3 py-1.5 rounded font-medium"
                  >
                    Mark completed
                  </button>
                  <button
                    onClick={() => update(b.id, { status: "no_show" })}
                    className="text-xs bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded font-medium"
                  >
                    No-show
                  </button>
                </>
              )}
              {b.payment_status !== "paid" && (
                <button
                  onClick={() =>
                    update(b.id, { payment_status: "paid", paid_at: new Date().toISOString() })
                  }
                  className="text-xs border border-zinc-200 px-3 py-1.5 rounded font-medium"
                >
                  Mark paid
                </button>
              )}
            </div>
          </div>
        ))}
        {(bookingsQ.data ?? []).length === 0 && (
          <div className="text-center text-sm text-zinc-500 py-12">
            No {filter === "pending" ? "pending" : ""} bookings.
          </div>
        )}
      </div>
    </div>
  );
}
