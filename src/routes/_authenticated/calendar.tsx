import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtTime, statusLabel, statusTone } from "@/lib/format";
import { StatusPill } from "@/components/StatCard";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const [offset, setOffset] = useState(0); // weeks from this week
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
          <h1 className="text-2xl font-medium">Calendar</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Week of{" "}
            {start.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={instructorId}
            onChange={(e) => setInstructorId(e.target.value)}
            className="text-sm bg-white border border-zinc-200 rounded-md px-3 py-1.5"
          >
            <option value="">All instructors</option>
            {instructorsQ.data?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.full_name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setOffset(offset - 1)}
            className="px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md"
          >
            ←
          </button>
          <button
            onClick={() => setOffset(0)}
            className="px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md"
          >
            Today
          </button>
          <button
            onClick={() => setOffset(offset + 1)}
            className="px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md"
          >
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
              className={`bg-white ring-1 ring-black/5 rounded-xl p-3 min-h-[180px] ${
                isToday ? "ring-emerald-800/30" : ""
              }`}
            >
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                {day.toLocaleDateString(undefined, { weekday: "short" })}{" "}
                <span className={isToday ? "text-emerald-800" : "text-zinc-400"}>
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-2">
                {dayLessons.map((b: any) => (
                  <div key={b.id} className="text-xs p-2 rounded bg-zinc-50 border border-zinc-100">
                    <div className="font-semibold text-zinc-700">{fmtTime(b.scheduled_at)}</div>
                    <div className="truncate">{b.students?.full_name}</div>
                    <div className="text-zinc-500 truncate">
                      {b.instructors?.full_name ?? "Unassigned"}
                    </div>
                    <div className="mt-1">
                      <StatusPill tone={statusTone[b.status]}>{statusLabel(b.status)}</StatusPill>
                    </div>
                  </div>
                ))}
                {dayLessons.length === 0 && (
                  <div className="text-xs text-zinc-400">No lessons</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
