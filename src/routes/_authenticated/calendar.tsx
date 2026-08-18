import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtTime, statusLabel, statusTone } from "@/lib/format";
import { StatusPill } from "@/components/StatCard";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

// Same hex values as statusTone in @/lib/format, so a lesson chip's tint
// always agrees with the StatusPill rendered inside it — the two were
// previously driven by separate, inconsistent color maps (e.g. "confirmed"
// showed blue here but emerald on its own pill).
const STATUS_HEX: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#10B981",
  completed: "#3B82F6",
  cancelled: "#EF4444",
  declined: "#EF4444",
  no_show: "#EF4444",
  rescheduled: "#3B82F6",
};

function lessonChipStyle(status: string): React.CSSProperties {
  const hex = STATUS_HEX[status] ?? "#94A3B8";
  return {
    background: `${hex}1A`,
    borderLeft: `3px solid ${hex}`,
    color: "#1A1A2E",
  };
}

function CalendarPage() {
  const [offset, setOffset] = useState(0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() + offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const [instructorId, setInstructorId] = useState<string>("");
  const instructorsQ = useQuery({
    queryKey: ["instructors-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("instructors")
        .select("id, full_name")
        .is("deleted_at", null)
        .order("full_name");
      return data ?? [];
    },
  });

  const lessonsQ = useQuery({
    queryKey: ["calendar", start.toISOString(), instructorId],
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select("*, students(full_name), instructors(full_name)")
        .is("deleted_at", null)
        .gte("scheduled_at", start.toISOString())
        .lt("scheduled_at", end.toISOString())
        .order("scheduled_at");
      if (instructorId) q = q.eq("instructor_id", instructorId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Week of {start.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={instructorId}
            onChange={(e) => setInstructorId(e.target.value)}
            className="text-sm btn-secondary py-1.5"
          >
            <option value="">All instructors</option>
            {instructorsQ.data?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.full_name}
              </option>
            ))}
          </select>
          <button onClick={() => setOffset(offset - 1)} className="text-sm btn-secondary py-1.5 px-3">
            ←
          </button>
          <button onClick={() => setOffset(0)} className="text-sm btn-secondary py-1.5 px-3">
            Today
          </button>
          <button onClick={() => setOffset(offset + 1)} className="text-sm btn-secondary py-1.5 px-3">
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((day) => {
          const dayStr = day.toDateString();
          const dayLessons = (lessonsQ.data ?? []).filter(
            (b: any) => new Date(b.scheduled_at).toDateString() === dayStr,
          );
          const isToday = dayStr === new Date().toDateString();
          return (
            <div
              key={dayStr}
              className="rounded-xl p-3 min-h-[180px] transition-shadow hover:shadow-md"
              style={{
                background: isToday ? "rgba(201,168,76,0.06)" : "#FAF8F4",
                border: isToday ? "1.5px solid #C9A84C" : "1px solid rgba(201,168,76,0.20)",
                boxShadow: "0 2px 12px rgba(27,43,75,0.05)",
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="text-slate-500">
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span
                  className={isToday ? "rounded-full px-1.5 text-white" : "text-slate-400"}
                  style={isToday ? { background: "#C9A84C" } : undefined}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-2">
                {dayLessons.map((b: any) => (
                  <div
                    key={b.id}
                    className="text-xs p-2 rounded-md shadow-sm"
                    style={lessonChipStyle(b.status)}
                  >
                    <div className="font-semibold">{fmtTime(b.scheduled_at)}</div>
                    <div className="truncate">{b.students?.full_name}</div>
                    <div className="truncate opacity-75">
                      {b.instructors?.full_name ?? "Unassigned"}
                    </div>
                    <div className="mt-1">
                      <StatusPill tone={statusTone[b.status]}>{statusLabel(b.status)}</StatusPill>
                    </div>
                  </div>
                ))}
                {dayLessons.length === 0 && (
                  <div className="text-xs text-slate-400">No lessons</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
