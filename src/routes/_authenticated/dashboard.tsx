import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarClock,
  Inbox,
  Wallet,
  Users,
  XCircle,
  CheckCircle2,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, StatusPill } from "@/components/StatCard";
import { fmtTime, money, statusLabel, statusTone } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function Dashboard() {
  const qc = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const start = startOfDay().toISOString();
  const end = new Date(startOfDay().getTime() + 86400000).toISOString();
  const weekStart = new Date(startOfDay().getTime() - 7 * 86400000).toISOString();

  const todayQ = useQuery({
    queryKey: ["today-lessons", start],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, students(full_name, phone), instructors(full_name), lesson_types(name)")
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .order("scheduled_at");
      if (error) throw error;
      return data;
    },
  });

  const pendingQ = useQuery({
    queryKey: ["pending-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, students(full_name), lesson_types(name, price_cents)")
        .eq("status", "pending")
        .order("scheduled_at")
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const instructorsQ = useQuery({
    queryKey: ["instructors-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const statsQ = useQuery({
    queryKey: ["dashboard-stats", weekStart],
    queryFn: async () => {
      const [pending, unpaid, students, instructors, cancels, completed] = await Promise.all([
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("bookings").select("price_cents").eq("payment_status", "unpaid"),
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("instructors").select("*", { count: "exact", head: true }).eq("active", true),
        supabase
          .from("cancellation_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "requested"),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("scheduled_at", weekStart),
      ]);
      const unpaidTotal = (unpaid.data ?? []).reduce((a, b) => a + b.price_cents, 0);
      return {
        pending: pending.count ?? 0,
        unpaidTotal,
        students: students.count ?? 0,
        instructors: instructors.count ?? 0,
        cancels: cancels.count ?? 0,
        completed: completed.count ?? 0,
      };
    },
  });

  const lessons = todayQ.data ?? [];
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  async function updateBooking(id: string, patch: Record<string, unknown>) {
    setUpdatingId(id);
    try {
      const { error } = await supabase.from("bookings").update(patch as any).eq("id", id);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pending-bookings"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        qc.invalidateQueries({ queryKey: ["today-lessons"] }),
        qc.invalidateQueries({ queryKey: ["bookings"] }),
      ]);
      toast.success("Booking updated");
    } catch (err: any) {
      toast.error(err?.message || "Could not update booking");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 mb-8">
        <div className="min-w-0">
          <div className="eyebrow text-blue-700">Daily Dispatch</div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">
            Today at a glance
          </h1>
          <p className="text-sm text-slate-500 mt-1">{today}</p>
        </div>
        <Link to="/bookings" className="btn-primary">
          Review queue <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        <StatCard label="Today's lessons" value={lessons.length} icon={CalendarClock} tone="info" />
        <StatCard
          label="Pending requests"
          value={statsQ.data?.pending ?? "—"}
          tone="warn"
          icon={Inbox}
        />
        <StatCard
          label="Unpaid balance"
          value={statsQ.data ? money(statsQ.data.unpaidTotal) : "—"}
          icon={Wallet}
          tone={statsQ.data && statsQ.data.unpaidTotal > 0 ? "warn" : "default"}
        />
        <StatCard label="Active instructors" value={statsQ.data?.instructors ?? "—"} icon={Users} />
        <StatCard
          label="Cancel requests"
          value={statsQ.data?.cancels ?? "—"}
          icon={XCircle}
          tone={statsQ.data && statsQ.data.cancels > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Completed (7d)"
          value={statsQ.data?.completed ?? "—"}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card-premium overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-semibold tracking-tight">Dispatch queue</h3>
                <div className="text-xs text-slate-500 mt-0.5">Today's scheduled lessons</div>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
              </span>
            </div>
            {lessons.length === 0 && (
              <div className="px-6 py-14 text-center text-sm text-slate-500">
                No lessons scheduled today.
              </div>
            )}
            <div className="divide-y divide-slate-100">
              {lessons.map((b: any) => (
                <div key={b.id} className="px-6 py-4 flex items-center gap-4 min-w-0">
                  <div className="w-20 shrink-0">
                    <div className="text-sm font-semibold text-slate-900">
                      {fmtTime(b.scheduled_at)}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">
                      {b.lesson_types?.name?.split(" ")[0] ?? "Lesson"}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {b.students?.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-slate-500 truncate inline-flex items-center gap-1">
                      <MapPin className="size-3 shrink-0 text-slate-400" />
                      {b.pickup_address ?? "No pickup set"}
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                    <StatusPill tone={statusTone[b.status]}>{statusLabel(b.status)}</StatusPill>
                    {b.instructors ? (
                      <span className="text-[11px] text-slate-600">{b.instructors.full_name}</span>
                    ) : (
                      <span className="text-[11px] text-amber-700">Unassigned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="eyebrow text-slate-500">Booking Queue</h3>
            <Link to="/bookings" className="text-[11px] font-semibold text-blue-700 hover:underline">
              View all →
            </Link>
          </div>
          {(pendingQ.data ?? []).length === 0 && (
            <div className="card-premium p-5 text-sm text-slate-500">No pending requests.</div>
          )}
          {(pendingQ.data ?? []).map((b: any) => (
            <div key={b.id} className="card-premium p-4">
              <div className="flex justify-between items-start mb-1 gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{b.students?.full_name}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(b.scheduled_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="text-xs font-semibold text-blue-700 shrink-0">
                  {money(b.lesson_types?.price_cents ?? 0)}
                </div>
              </div>
              <div className="text-xs text-slate-500">{b.lesson_types?.name}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill tone={statusTone.pending}>Awaiting review</StatusPill>
                <select
                  value={b.instructor_id ?? ""}
                  disabled={updatingId === b.id || instructorsQ.isLoading}
                  onChange={(e) => updateBooking(b.id, { instructor_id: e.target.value || null })}
                  className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="">Assign instructor</option>
                  {(instructorsQ.data ?? []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={updatingId === b.id}
                  onClick={() => updateBooking(b.id, { status: "confirmed" })}
                  className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={updatingId === b.id}
                  onClick={() => updateBooking(b.id, { status: "declined" })}
                  className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
                >
                  Deny
                </button>
              </div>
              <Link to="/bookings" className="mt-3 inline-flex text-[11px] font-semibold text-blue-700 hover:underline">
                Open full queue →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
