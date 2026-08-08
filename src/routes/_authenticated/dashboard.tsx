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
  Sparkles,
  Circle,
  Scale,
} from "lucide-react";
import { startOfWeek, endOfWeek } from "date-fns";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useSchoolId } from "@/lib/auth";
import { StatCard, StatusPill } from "@/components/StatCard";
import { fmtTime, money, statusLabel, statusTone } from "@/lib/format";
import { cancelTodayBookings } from "@/lib/bulk-cancel.functions";
import { isBookingConflictError } from "@/lib/booking-conflict-error";
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
  const { user } = useAuthUser();
  const schoolIdQ = useSchoolId(user?.id);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancelPanelOpen, setCancelPanelOpen] = useState(false);
  const [cancelInstructorId, setCancelInstructorId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const cancelToday = useServerFn(cancelTodayBookings);
  const start = startOfDay().toISOString();
  const end = new Date(startOfDay().getTime() + 86400000).toISOString();
  const weekStart = new Date(startOfDay().getTime() - 7 * 86400000).toISOString();

  const todayQ = useQuery({
    queryKey: ["today-lessons", start],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, students(full_name, phone), instructors(full_name), lesson_types(name)")
        .is("deleted_at", null)
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
        .is("deleted_at", null)
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
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const statsQ = useQuery({
    queryKey: ["dashboard-stats", weekStart],
    queryFn: async () => {
      const [pending, unpaid, students, instructors, cancels, completed] = await Promise.all([
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("status", "pending"),
        supabase
          .from("bookings")
          .select("price_cents")
          .is("deleted_at", null)
          .eq("payment_status", "unpaid"),
        supabase
          .from("students")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("instructors")
          .select("*", { count: "exact", head: true })
          .eq("active", true)
          .is("deleted_at", null),
        supabase
          .from("cancellation_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "requested"),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
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

  const weekLoadStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  const weekLoadEnd = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

  const instructorLoadQ = useQuery({
    queryKey: ["instructor-load", weekLoadStart],
    queryFn: async () => {
      const [{ data: instructors, error: iErr }, { data: bookings, error: bErr }] =
        await Promise.all([
          supabase
            .from("instructors")
            .select("id, full_name")
            .eq("active", true)
            .is("deleted_at", null)
            .order("full_name"),
          supabase
            .from("bookings")
            .select("instructor_id")
            .is("deleted_at", null)
            .not("instructor_id", "is", null)
            .not("status", "in", "(cancelled,declined)")
            .gte("scheduled_at", weekLoadStart)
            .lte("scheduled_at", weekLoadEnd),
        ]);
      if (iErr) throw iErr;
      if (bErr) throw bErr;
      const counts = new Map<string, number>();
      for (const b of bookings ?? []) {
        counts.set(b.instructor_id as string, (counts.get(b.instructor_id as string) ?? 0) + 1);
      }
      const rows = (instructors ?? []).map((i) => ({
        id: i.id,
        name: i.full_name,
        count: counts.get(i.id) ?? 0,
      }));
      const total = rows.reduce((a, r) => a + r.count, 0);
      const avg = rows.length > 0 ? total / rows.length : 0;
      rows.sort((a, b) => b.count - a.count);
      return { rows, avg };
    },
  });

  const setupQ = useQuery({
    queryKey: ["setup-checklist", schoolIdQ.data],
    enabled: !!schoolIdQ.data,
    queryFn: async () => {
      const [settings, instructors, types] = await Promise.all([
        supabase
          .from("school_settings")
          .select("school_name, contact_phone, contact_email, service_area")
          .eq("school_id", schoolIdQ.data as string)
          .maybeSingle(),
        supabase
          .from("instructors")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .is("deleted_at", null),
        supabase
          .from("lesson_types")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
      ]);
      const s = settings.data ?? ({} as any);
      return {
        hasSchoolName: !!s.school_name && s.school_name !== "Standard Driving School",
        hasContact: !!s.contact_phone && !!s.contact_email,
        hasServiceArea: !!s.service_area,
        hasInstructor: (instructors.count ?? 0) > 0,
        hasLessonTypes: (types.count ?? 0) > 0,
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
      const { error } = await supabase
        .from("bookings")
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pending-bookings"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        qc.invalidateQueries({ queryKey: ["today-lessons"] }),
        qc.invalidateQueries({ queryKey: ["bookings"] }),
      ]);
      toast.success("Booking updated");
    } catch (err: any) {
      toast.error(
        isBookingConflictError(err)
          ? "That instructor already has an overlapping lesson at this time."
          : err?.message || "Could not update booking",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCancelToday() {
    if (!cancelReason.trim()) {
      toast.error("Add a short reason — it's included in the message to affected students.");
      return;
    }
    const scope = cancelInstructorId
      ? instructorsQ.data?.find((i) => i.id === cancelInstructorId)?.full_name ?? "this instructor"
      : "the whole school";
    if (!window.confirm(`Cancel all of today's remaining lessons for ${scope}? This can't be undone.`))
      return;
    setCancelling(true);
    try {
      const result = await cancelToday({
        data: {
          instructorId: cancelInstructorId || undefined,
          reason: cancelReason.trim(),
        },
      });
      toast.success(
        result.count === 0
          ? "No bookings needed cancelling."
          : `Cancelled ${result.count} booking${result.count === 1 ? "" : "s"}.`,
      );
      setCancelPanelOpen(false);
      setCancelReason("");
      setCancelInstructorId("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["today-lessons"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        qc.invalidateQueries({ queryKey: ["pending-bookings"] }),
        qc.invalidateQueries({ queryKey: ["bookings"] }),
        qc.invalidateQueries({ queryKey: ["instructor-load"] }),
      ]);
    } catch (err: any) {
      toast.error(err?.message || "Could not cancel today's bookings");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 shrink-0" style={{ background: "#C9A84C" }} />
            <div className="eyebrow">Daily Dispatch</div>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1.5">
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
        <Link to="/bookings" className="block">
          <StatCard
            label="Cancel requests"
            value={statsQ.data?.cancels ?? "—"}
            icon={XCircle}
            tone={statsQ.data && statsQ.data.cancels > 0 ? "danger" : "default"}
          />
        </Link>
        <StatCard
          label="Completed (7d)"
          value={statsQ.data?.completed ?? "—"}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      {setupQ.data &&
        (() => {
          const items = [
            {
              done: setupQ.data.hasSchoolName,
              label: "Set your school name",
              to: "/settings" as const,
            },
            {
              done: setupQ.data.hasContact,
              label: "Add contact phone & email",
              to: "/settings" as const,
            },
            {
              done: setupQ.data.hasServiceArea,
              label: "Describe your service area",
              to: "/settings" as const,
            },
            {
              done: setupQ.data.hasInstructor,
              label: "Add at least one instructor",
              to: "/instructors" as const,
            },
            {
              done: setupQ.data.hasLessonTypes,
              label: "Publish your lesson types & pricing",
              to: "/settings" as const,
            },
          ];
          const remaining = items.filter((i) => !i.done);
          if (remaining.length === 0) return null;
          const doneCount = items.length - remaining.length;
          return (
            <div
              className="rounded-2xl p-5 mb-8 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(201,168,76,0.10), rgba(27,43,75,0.06))",
                border: "1px solid rgba(201,168,76,0.30)",
              }}
            >
              <div
                className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full opacity-60 blur-2xl"
                style={{ background: "radial-gradient(circle, rgba(201,168,76,0.35) 0%, transparent 70%)" }}
              />
              <div className="relative flex items-center justify-between mb-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="size-8 rounded-lg text-white grid place-items-center shrink-0"
                    style={{ background: "#1B2B4B" }}
                  >
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#1B2B4B] truncate">
                      Finish setting up your school
                    </div>
                    <div className="text-xs text-[#6B6B7B]">
                      {doneCount} of {items.length} complete
                    </div>
                  </div>
                </div>
              </div>
              <ul className="relative grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {items.map((it) => (
                  <li key={it.label}>
                    <Link
                      to={it.to}
                      className={`flex items-center gap-2 text-sm py-1 ${it.done ? "text-slate-400 line-through" : "text-[#1B2B4B] hover:text-[#C9A84C]"}`}
                    >
                      {it.done ? (
                        <CheckCircle2 className="size-4 shrink-0" style={{ color: "#0F9D6D" }} />
                      ) : (
                        <Circle className="size-4 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{it.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card-premium overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold tracking-tight">Dispatch queue</h3>
                <div className="text-xs text-slate-500 mt-0.5">Today's scheduled lessons</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
                </span>
                {lessons.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCancelPanelOpen((v) => !v)}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Cancel all today
                  </button>
                )}
              </div>
            </div>
            {cancelPanelOpen && (
              <div className="px-6 py-4 border-b border-slate-200 bg-red-50/50 space-y-2.5">
                <select
                  value={cancelInstructorId}
                  onChange={(e) => setCancelInstructorId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="">Whole school (all instructors)</option>
                  {(instructorsQ.data ?? []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.full_name} only
                    </option>
                  ))}
                </select>
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason (e.g. weather closure, instructor sick) — sent to students"
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleCancelToday}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {cancelling ? "Cancelling…" : "Confirm cancellation"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelPanelOpen(false)}
                    className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
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
            <Link
              to="/bookings"
              className="text-[11px] font-semibold text-blue-700 hover:underline"
            >
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
              <Link
                to="/bookings"
                className="mt-3 inline-flex text-[11px] font-semibold text-blue-700 hover:underline"
              >
                Open full queue →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {instructorLoadQ.data && instructorLoadQ.data.rows.length > 1 && (
        <div className="card-premium p-5 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="size-4 text-slate-400" />
            <h3 className="font-semibold tracking-tight">Instructor load this week</h3>
          </div>
          <div className="space-y-2.5">
            {instructorLoadQ.data.rows.map((r) => {
              const { avg } = instructorLoadQ.data;
              const max = Math.max(1, instructorLoadQ.data.rows[0]?.count ?? 1);
              const isOver = r.count - avg >= 2;
              const isUnder = avg - r.count >= 2;
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-slate-700 truncate">{r.name}</div>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(r.count / max) * 100}%`,
                        background: isOver ? "#DC2626" : isUnder ? "#94A3B8" : "#3B82F6",
                      }}
                    />
                  </div>
                  <div className="w-10 shrink-0 text-right text-sm font-semibold text-slate-900">
                    {r.count}
                  </div>
                  <div className="w-20 shrink-0">
                    {isOver && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                        Over
                      </span>
                    )}
                    {isUnder && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                        Under
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Lessons scheduled Mon–Sun this week, {Math.round(instructorLoadQ.data.avg * 10) / 10}{" "}
            average per instructor.
          </p>
        </div>
      )}
    </div>
  );
}
