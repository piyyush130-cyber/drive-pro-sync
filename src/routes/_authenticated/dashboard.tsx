import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, StatusPill } from "@/components/StatCard";
import { fmtTime, money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function Dashboard() {
  const start = startOfDay().toISOString();
  const end = new Date(startOfDay().getTime() + 86400000).toISOString();

  const todayQ = useQuery({
    queryKey: ["today-lessons", start],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, students(full_name, phone), instructors(full_name)")
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

  const statsQ = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [pending, unpaid, students] = await Promise.all([
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("bookings").select("price_cents").eq("payment_status", "unpaid"),
        supabase.from("students").select("*", { count: "exact", head: true }),
      ]);
      const unpaidTotal = (unpaid.data ?? []).reduce((a, b) => a + b.price_cents, 0);
      return {
        pending: pending.count ?? 0,
        unpaidTotal,
        students: students.count ?? 0,
      };
    },
  });

  const lessons = todayQ.data ?? [];
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium">Dispatcher Overview</h1>
          <p className="text-sm text-zinc-500 mt-1">{today}</p>
        </div>
        <Link
          to="/bookings"
          className="flex items-center bg-white ring-1 ring-black/5 py-2 px-3 rounded-md text-sm font-medium hover:ring-zinc-300"
        >
          Review queue
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Today's Lessons" value={lessons.length} />
        <StatCard label="Pending Requests" value={statsQ.data?.pending ?? "—"} tone="warn" />
        <StatCard label="Unpaid Total" value={statsQ.data ? money(statsQ.data.unpaidTotal) : "—"} />
        <StatCard label="Active Students" value={statsQ.data?.students ?? "—"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white ring-1 ring-black/5 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-950/5 flex justify-between items-center bg-zinc-50/50">
              <h3 className="font-medium">Today's Schedule</h3>
              <span className="text-xs font-medium text-zinc-400">{today}</span>
            </div>
            {lessons.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-zinc-500">
                No lessons scheduled today.
              </div>
            )}
            <div className="divide-y divide-zinc-950/5">
              {lessons.map((b: any) => (
                <div key={b.id} className="px-6 py-4 flex items-center">
                  <div className="w-20 shrink-0 text-sm font-medium text-zinc-500">
                    {fmtTime(b.scheduled_at)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {b.students?.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      Pickup: {b.pickup_address ?? "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    {b.instructors ? (
                      <StatusPill tone="bg-emerald-100 text-emerald-800">
                        {b.instructors.full_name}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="bg-zinc-100 text-zinc-500">Unassigned</StatusPill>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-sm uppercase tracking-wider text-zinc-500 px-1">
            Pending Requests
          </h3>
          {(pendingQ.data ?? []).length === 0 && (
            <div className="text-sm text-zinc-500 px-1">No pending requests.</div>
          )}
          {(pendingQ.data ?? []).map((b: any) => (
            <Link
              to="/bookings"
              key={b.id}
              className="block bg-white ring-1 ring-black/5 rounded-xl p-4 hover:ring-zinc-300"
            >
              <div className="flex justify-between items-start mb-1">
                <div>
                  <div className="font-medium text-sm">{b.students?.full_name}</div>
                  <div className="text-xs text-zinc-500">
                    {new Date(b.scheduled_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="text-xs font-semibold text-emerald-700">
                  {money(b.lesson_types?.price_cents ?? 0)}
                </div>
              </div>
              <div className="text-xs text-zinc-500">{b.lesson_types?.name}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
