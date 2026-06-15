import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, MapPin, Phone, CheckCircle2, XCircle, CarFront, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtTime, fmtDate, statusTone, statusLabel } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/instructor")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: InstructorPage,
});

function InstructorPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"today" | "upcoming" | "past">("today");

  const meQ = useQuery({
    queryKey: ["instructor-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("instructors")
        .select("*")
        .eq("profile_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const bookingsQ = useQuery({
    queryKey: ["instructor-bookings", meQ.data?.id, tab],
    enabled: !!meQ.data?.id,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const tomorrow = new Date(start.getTime() + 86400000);
      let q = supabase
        .from("bookings")
        .select("*, students(full_name, phone, email), lesson_types(name)")
        .eq("instructor_id", meQ.data!.id)
        .order("scheduled_at");
      if (tab === "today")
        q = q.gte("scheduled_at", start.toISOString()).lt("scheduled_at", tomorrow.toISOString());
      else if (tab === "upcoming") q = q.gte("scheduled_at", tomorrow.toISOString());
      else q = q.lt("scheduled_at", start.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function setStatus(id: string, status: "completed" | "no_show") {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["instructor-bookings"] });
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (meQ.isLoading) return <div className="p-10 text-slate-500">Loading…</div>;
  if (!meQ.data)
    return (
      <div className="min-h-screen p-10">
        <div className="card-premium max-w-md p-8">
          <h1 className="text-xl font-semibold">Not linked to an instructor profile</h1>
          <p className="text-sm text-slate-500 mt-2">
            Ask the school admin to link your account on the Instructors page.
          </p>
          <button onClick={signOut} className="btn-secondary mt-4">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </div>
    );

  const list = bookingsQ.data ?? [];

  return (
    <div className="min-h-screen bg-[color:var(--color-mist)]">
      <header className="brand-gradient brand-grid-bg text-white">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/10 ring-1 ring-white/15 grid place-items-center">
              <CarFront className="size-5 text-blue-300" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-blue-200">
                DriveProSync · Instructor
              </div>
              <div className="font-semibold tracking-tight">{meQ.data.full_name}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-slate-200 hover:text-white inline-flex items-center gap-2"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          {(["today", "upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                tab === t
                  ? "bg-[color:var(--color-electric)] text-white"
                  : "bg-white text-slate-600 ring-1 ring-[color:var(--color-silver)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="card-premium p-10 text-center text-slate-500">
            No lessons in this view.
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((b: any) => (
              <div key={b.id} className="card-premium p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">
                      {fmtDate(b.scheduled_at)}
                    </div>
                    <div className="text-lg font-semibold tracking-tight mt-0.5 flex items-center gap-2">
                      <CalendarClock className="size-4 text-blue-600" />
                      {fmtTime(b.scheduled_at)} · {b.lesson_types?.name ?? "Lesson"}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                      {b.students?.full_name}
                      {b.students?.phone && (
                        <a
                          href={`tel:${b.students.phone}`}
                          className="ml-3 text-blue-700 inline-flex items-center gap-1"
                        >
                          <Phone className="size-3.5" />
                          {b.students.phone}
                        </a>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-slate-600 inline-flex items-start gap-1.5">
                      <MapPin className="size-3.5 mt-0.5 text-slate-400" />
                      <span>
                        Pickup: {b.pickup_address}
                        {b.dropoff_address && b.dropoff_address !== b.pickup_address && (
                          <span className="block text-slate-500">
                            Drop-off: {b.dropoff_address}
                          </span>
                        )}
                      </span>
                    </div>
                    {b.notes && (
                      <div className="mt-2 text-xs text-slate-500 italic">"{b.notes}"</div>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusTone[b.status] ?? ""}`}
                  >
                    {statusLabel(b.status)}
                  </span>
                </div>
                {b.status !== "completed" && b.status !== "no_show" && (
                  <div className="mt-4 pt-4 border-t border-[color:var(--color-silver)] flex gap-2 flex-wrap">
                    <button
                      onClick={() => setStatus(b.id, "completed")}
                      className="text-xs btn-secondary"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-600" /> Completed
                    </button>
                    <button
                      onClick={() => setStatus(b.id, "no_show")}
                      className="text-xs btn-secondary"
                    >
                      <XCircle className="size-3.5 text-rose-600" /> No-show
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
