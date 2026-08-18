import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, StickyNote } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, money, statusLabel, statusTone } from "@/lib/format";
import { StatusPill } from "@/components/StatCard";
import { notifyBookingUpdated } from "@/lib/notifications.functions";
import { resolveCancellationRequest } from "@/lib/cancellation-requests.functions";
import { hasVehicleConflict } from "@/lib/booking-logic";
import { computeCancellationFeeCents } from "@/lib/cancellation-fee";
import { recordBookingPayment, getTotalPaid, type PaymentMethod } from "@/lib/booking-payments";
import { isBookingConflictError, BOOKING_CONFLICT_MESSAGE } from "@/lib/booking-conflict-error";
import { toast } from "sonner";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export const Route = createFileRoute("/_authenticated/bookings")({
  component: BookingsPage,
});

function BookingsPage() {
  const [filter, setFilter] = useState<"pending" | "all" | "cancellations">("pending");
  const qc = useQueryClient();

  const cancellationRequestsQ = useQuery({
    queryKey: ["cancellation-requests"],
    enabled: filter === "cancellations",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_requests")
        .select(
          "id, reason, created_at, bookings(id, scheduled_at, price_cents, students(full_name, phone, email), lesson_types(name))",
        )
        .eq("status", "requested")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const feeSettingsQ = useQuery({
    queryKey: ["fee-settings"],
    enabled: filter === "cancellations",
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("late_cancel_fee_type, late_cancel_fee_value")
        .maybeSingle();
      return data;
    },
  });
  const bookingsQ = useQuery({
    queryKey: ["bookings", filter],
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select("*, students(*), instructors(id, full_name), lesson_types(name, price_cents)")
        .is("deleted_at", null)
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
        .is("deleted_at", null)
        .order("full_name");
      return data ?? [];
    },
  });

  const vehiclesQ = useQuery({
    queryKey: ["vehicles-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("id, name")
        .eq("active", true)
        .is("deleted_at", null)
        .order("name");
      return data ?? [];
    },
  });

  const notifyUpdate = useServerFn(notifyBookingUpdated);

  async function update(id: string, patch: any) {
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    if (error && isBookingConflictError(error)) {
      return toast.error(
        "instructor_id" in patch
          ? "That instructor already has an overlapping lesson at this time."
          : BOOKING_CONFLICT_MESSAGE,
      );
    }
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["pending-bookings"] });
    toast.success("Updated");
    void notifyUpdate({ data: { bookingId: id, patch } });
  }

  async function markFullyPaid(b: any, method: PaymentMethod) {
    try {
      const alreadyPaid = await getTotalPaid(b.id);
      const remaining = Math.max(0, b.price_cents - alreadyPaid);
      if (remaining === 0) return;
      await recordBookingPayment(
        { id: b.id, school_id: b.school_id, price_cents: b.price_cents },
        remaining,
        method,
      );
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Marked paid");
    } catch (err: any) {
      toast.error(err?.message || "Could not record payment");
    }
  }

  async function assignVehicle(b: any, vehicleId: string) {
    if (!vehicleId) return update(b.id, { vehicle_id: null });
    const dayStart = startOfDay(new Date(b.scheduled_at));
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const { data: dayBookings } = await supabase
      .from("bookings")
      .select("id, vehicle_id, scheduled_at, duration_minutes")
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .not("status", "in", "(cancelled,declined)")
      .gte("scheduled_at", dayStart.toISOString())
      .lt("scheduled_at", dayEnd.toISOString());
    const conflict = hasVehicleConflict({
      vehicleId,
      dayBookings: (dayBookings ?? []) as any,
      scheduledAt: b.scheduled_at,
      durationMinutes: b.duration_minutes,
      excludeBookingId: b.id,
    });
    if (conflict) {
      toast.error("This vehicle is already booked over that time — pick another.");
      return;
    }
    update(b.id, { vehicle_id: vehicleId });
  }

  async function deleteBooking(id: string) {
    if (!window.confirm("Delete this booking? You can restore it from the recycle bin.")) return;
    const { error } = await supabase
      .from("bookings")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bookings"] });
    toast.success("Booking deleted");
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 mb-6">
        <div className="min-w-0">
          <div className="eyebrow text-blue-700">Booking Queue</div>
          <h1
            className="text-2xl md:text-3xl tracking-tight mt-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Review &amp; confirm bookings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Approve, decline, assign an instructor, and update payment.
          </p>
        </div>
        <div className="flex gap-1 bg-white rounded-lg p-1 ring-1 ring-[rgba(201,168,76,0.25)] shrink-0">
          {(["pending", "all", "cancellations"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                filter === f
                  ? "text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              style={filter === f ? { background: "#1B2B4B" } : undefined}
            >
              {f === "pending" ? "Pending" : f === "all" ? "All" : "Cancellation requests"}
            </button>
          ))}
        </div>
      </div>

      {filter === "cancellations" ? (
        <CancellationRequestsPanel
          requests={cancellationRequestsQ.data ?? []}
          feeSettings={feeSettingsQ.data}
          onResolved={() => {
            qc.invalidateQueries({ queryKey: ["cancellation-requests"] });
            qc.invalidateQueries({ queryKey: ["bookings"] });
            qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
          }}
        />
      ) : (
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
              {b.mpi_test_location && (
                <div className="inline-flex items-start gap-1.5 min-w-0">
                  <MapPin className="size-3.5 mt-0.5 shrink-0 text-slate-400" />
                  <span className="truncate">
                    <span className="text-slate-400">MPI test:</span> {b.mpi_test_location}
                  </span>
                </div>
              )}
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
              {b.female_instructor_requested && (
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    b.instructor_id
                      ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200"
                      : "bg-purple-600 text-white"
                  }`}
                  title={
                    b.instructor_id
                      ? "Student requested a female instructor"
                      : "Student requested a female instructor — not yet assigned, needs a matching instructor"
                  }
                >
                  Female instructor requested{!b.instructor_id && " · unassigned"}
                </span>
              )}
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
              <select
                value={b.vehicle_id ?? ""}
                onChange={(e) => assignVehicle(b, e.target.value)}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white font-medium"
              >
                <option value="">— Assign vehicle —</option>
                {(vehiclesQ.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <div className="flex-1" />
              {b.status === "pending" && (
                <>
                  <button
                    onClick={() => update(b.id, { status: "confirmed" })}
                    className="text-xs btn-primary py-1.5"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => update(b.id, { status: "declined" })}
                    className="text-xs btn-danger-soft py-1.5"
                  >
                    Deny
                  </button>
                </>
              )}
              {b.status === "confirmed" && (
                <>
                  <button
                    onClick={() => update(b.id, { status: "completed" })}
                    className="text-xs btn-primary py-1.5"
                  >
                    Mark completed
                  </button>
                  <button
                    onClick={() => update(b.id, { status: "no_show" })}
                    className="text-xs btn-danger-soft py-1.5"
                  >
                    No-show
                  </button>
                </>
              )}
              {(b.status === "pending" || b.status === "confirmed") && (
                <button
                  onClick={() => update(b.id, { status: "cancelled" })}
                  className="text-xs btn-danger-soft py-1.5"
                >
                  Cancel
                </button>
              )}
              {b.payment_status !== "paid" && (
                <div className="inline-flex gap-1">
                  {(["cash", "etransfer", "card", "cheque"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => markFullyPaid(b, m)}
                      className="text-xs btn-secondary py-1.5 px-2.5"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => deleteBooking(b.id)} className="text-xs btn-danger py-1.5">
                Delete
              </button>
            </div>
          </div>
        ))}
        {(bookingsQ.data ?? []).length === 0 && (
          <div className="card-premium text-center text-sm text-slate-500 py-12">
            No {filter === "pending" ? "pending" : ""} bookings.
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function CancellationRequestsPanel({
  requests,
  feeSettings,
  onResolved,
}: {
  requests: any[];
  feeSettings: { late_cancel_fee_type: string; late_cancel_fee_value: number } | null | undefined;
  onResolved: () => void;
}) {
  const resolve = useServerFn(resolveCancellationRequest);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [waive, setWaive] = useState<Record<string, boolean>>({});

  async function handle(requestId: string, decision: "approve" | "reject") {
    setBusyId(requestId);
    try {
      const result = await resolve({
        data: { requestId, decision, waiveFee: !!waive[requestId] },
      });
      if (decision === "approve") {
        toast.success(
          result.feeCents > 0
            ? `Cancellation confirmed — ${money(result.feeCents)} fee recorded as owed.`
            : "Cancellation confirmed — no fee applied.",
        );
      } else {
        toast.success("Request denied — the lesson stays scheduled.");
      }
      onResolved();
    } catch (err: any) {
      toast.error(err?.message || "Could not resolve this request");
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="card-premium text-center text-sm text-slate-500 py-12">
        No pending cancellation requests.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r: any) => {
        const b = r.bookings;
        const computedFee = feeSettings
          ? computeCancellationFeeCents(
              feeSettings.late_cancel_fee_type,
              feeSettings.late_cancel_fee_value,
              b?.price_cents ?? 0,
            )
          : 0;
        const waived = !!waive[r.id];
        return (
          <div key={r.id} className="card-premium p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 mb-3 items-start">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{b?.students?.full_name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {b?.students?.phone} · {b?.students?.email ?? "no email"}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold">
                  {b?.scheduled_at ? fmtDateTime(b.scheduled_at) : "—"}
                </div>
                <div className="text-xs text-slate-500">{b?.lesson_types?.name}</div>
              </div>
            </div>
            {r.reason && (
              <div className="text-xs text-slate-600 mb-3">
                <span className="text-slate-400">Reason:</span> {r.reason}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-600">
                Late cancellation fee:{" "}
                <span className="font-semibold text-slate-900">
                  {computedFee > 0 ? money(computedFee) : "None configured"}
                </span>
              </div>
              {computedFee > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={waived}
                    onChange={(e) => setWaive({ ...waive, [r.id]: e.target.checked })}
                    className="accent-blue-600"
                  />
                  Waive this fee
                </label>
              )}
              <div className="flex-1" />
              <button
                onClick={() => handle(r.id, "approve")}
                disabled={busyId === r.id}
                className="text-xs btn-primary py-1.5 disabled:opacity-50"
              >
                Approve cancellation
              </button>
              <button
                onClick={() => handle(r.id, "reject")}
                disabled={busyId === r.id}
                className="text-xs btn-danger-soft py-1.5 disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
