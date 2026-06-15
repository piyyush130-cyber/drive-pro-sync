import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, StickyNote } from "lucide-react";
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 mb-6">
        <div className="min-w-0">
          <div className="eyebrow text-blue-700">Booking Queue</div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">
            Review &amp; confirm bookings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Approve, decline, assign an instructor, and update payment.
          </p>
        </div>
        <div className="flex gap-1 bg-white rounded-lg p-1 ring-1 ring-slate-200 shrink-0">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                filter === f ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f === "pending" ? "Pending" : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {(bookingsQ.data ?? []).map((b: any) => (
          <div key={b.id} className="card-premium p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 mb-3 items-start">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{b.students?.full_name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {b.students?.phone} · {b.students?.email ?? "no email"}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold">{fmtDateTime(b.scheduled_at)}</div>
                <div className="text-xs text-slate-500">
                  {b.lesson_types?.name} ·{" "}
                  <span className="text-blue-700 font-semibold">{money(b.price_cents)}</span>
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-600 mb-3">
              <div className="inline-flex items-start gap-1.5 min-w-0">
                <MapPin className="size-3.5 mt-0.5 shrink-0 text-slate-400" />
                <span className="truncate">
                  <span className="text-slate-400">Pickup:</span> {b.pickup_address ?? "—"}
                </span>
              </div>
              <div className="inline-flex items-start gap-1.5 min-w-0">
                <MapPin className="size-3.5 mt-0.5 shrink-0 text-slate-400" />
                <span className="truncate">
                  <span className="text-slate-400">Drop-off:</span> {b.dropoff_address ?? "—"}
                </span>
              </div>
              {b.notes && (
                <div className="sm:col-span-2 inline-flex items-start gap-1.5">
                  <StickyNote className="size-3.5 mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    <span className="text-slate-400">Notes:</span> {b.notes}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
              <StatusPill tone={statusTone[b.status]}>{statusLabel(b.status)}</StatusPill>
              <StatusPill tone={statusTone[b.payment_status]}>
                {statusLabel(b.payment_status)}
              </StatusPill>
              <select
                value={b.instructor_id ?? ""}
                onChange={(e) => update(b.id, { instructor_id: e.target.value || null })}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white font-medium"
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
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-blue-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => update(b.id, { status: "declined" })}
                    className="text-xs bg-white ring-1 ring-slate-200 text-slate-700 px-3 py-1.5 rounded-md font-semibold hover:bg-slate-50"
                  >
                    Decline
                  </button>
                </>
              )}
              {b.status === "confirmed" && (
                <>
                  <button
                    onClick={() => update(b.id, { status: "completed" })}
                    className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-emerald-700"
                  >
                    Mark completed
                  </button>
                  <button
                    onClick={() => update(b.id, { status: "no_show" })}
                    className="text-xs bg-white ring-1 ring-slate-200 text-slate-700 px-3 py-1.5 rounded-md font-semibold hover:bg-slate-50"
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
                  className="text-xs border border-slate-200 px-3 py-1.5 rounded-md font-semibold hover:bg-slate-50"
                >
                  Mark paid
                </button>
              )}
            </div>
          </div>
        ))}
        {(bookingsQ.data ?? []).length === 0 && (
          <div className="card-premium text-center text-sm text-slate-500 py-12">
            No {filter === "pending" ? "pending" : ""} bookings.
          </div>
        )}
      </div>
    </div>
  );
}
