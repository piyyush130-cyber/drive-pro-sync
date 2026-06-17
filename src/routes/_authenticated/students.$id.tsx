import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, money, statusLabel, statusTone } from "@/lib/format";
import { StatusPill } from "@/components/StatCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students/$id")({
  component: StudentDetail,
});

const SKILLS = [
  "Basic vehicle control",
  "Turns & intersections",
  "Lane changes",
  "Parking",
  "Parallel parking",
  "Highway driving",
  "School zones",
  "Shoulder checks",
  "Speed control",
  "Defensive driving",
];

type SkillStatus = "not_started" | "practicing" | "confident";
type Readiness = "not_ready" | "improving" | "almost_ready" | "ready";

const READINESS_OPTIONS: { value: Readiness; label: string; cls: string }[] = [
  { value: "not_ready", label: "Not ready", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "improving", label: "Improving", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  { value: "almost_ready", label: "Almost ready", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "ready", label: "Ready to test", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
];

const STATUS_BTN: Record<SkillStatus, { label: string; on: string; off: string }> = {
  not_started: {
    label: "Not started",
    on: "bg-slate-200 text-slate-800 border-slate-300",
    off: "bg-white text-slate-500 border-slate-200 hover:bg-slate-50",
  },
  practicing: {
    label: "Practicing",
    on: "bg-amber-100 text-amber-800 border-amber-300",
    off: "bg-white text-slate-500 border-slate-200 hover:bg-amber-50",
  },
  confident: {
    label: "Confident",
    on: "bg-emerald-100 text-emerald-800 border-emerald-300",
    off: "bg-white text-slate-500 border-slate-200 hover:bg-emerald-50",
  },
};

function StudentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const studentQ = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, bookings(*, instructors(full_name), lesson_types(name)), student_progress(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [skills, setSkills] = useState<Record<string, SkillStatus>>({});
  const [readiness, setReadiness] = useState<Readiness>("not_ready");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const sp: any = studentQ.data?.student_progress;
    const p = Array.isArray(sp) ? sp[0] : sp;
    if (p) {
      const raw = (p.skills ?? {}) as Record<string, unknown>;
      const mapped: Record<string, SkillStatus> = {};
      for (const k of Object.keys(raw)) {
        const v = raw[k];
        if (v === "practicing" || v === "confident" || v === "not_started") mapped[k] = v;
        else if (v === true) mapped[k] = "confident";
        else mapped[k] = "not_started";
      }
      setSkills(mapped);
      setNotes(p.general_notes ?? "");
      const r = raw.__readiness;
      if (r === "improving" || r === "almost_ready" || r === "ready" || r === "not_ready") {
        setReadiness(r);
      } else if (p.road_test_ready) {
        setReadiness("ready");
      }
    }
  }, [studentQ.data]);

  async function saveProgress() {
    const payload = { ...skills, __readiness: readiness };
    const { error } = await supabase.from("student_progress").upsert(
      {
        student_id: id,
        skills: payload,
        general_notes: notes,
        road_test_ready: readiness === "ready",
      },
      { onConflict: "student_id" },
    );
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["student", id] });
    toast.success("Progress saved");
  }

  if (studentQ.isLoading) return <div className="p-10 text-slate-500">Loading...</div>;
  const s = studentQ.data;
  if (!s) return <div className="p-10">Not found</div>;

  const bookings = (s.bookings ?? []).sort(
    (a: any, b: any) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at),
  );
  const completed = bookings.filter((b: any) => b.status === "completed").length;
  const currentReadiness = READINESS_OPTIONS.find((o) => o.value === readiness)!;

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <Link to="/students" className="text-xs text-slate-500">← All students</Link>
      <div className="flex items-start justify-between mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium text-slate-900">{s.full_name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {s.phone} · {s.email ?? "no email"}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="text-slate-500">Lessons</div>
          <div className="font-medium">
            {completed} of {s.lessons_purchased || "—"} completed
          </div>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-medium text-slate-900">Progress</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Road-test readiness</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${currentReadiness.cls}`}>
              {currentReadiness.label}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {READINESS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setReadiness(o.value)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                readiness === o.value
                  ? o.cls
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-100">
          {SKILLS.map((skill) => {
            const current = skills[skill] ?? "not_started";
            return (
              <div key={skill} className="flex items-center justify-between gap-3 py-2.5 flex-wrap">
                <div className="text-sm text-slate-800">{skill}</div>
                <div className="inline-flex gap-1">
                  {(["not_started", "practicing", "confident"] as SkillStatus[]).map((st) => {
                    const cfg = STATUS_BTN[st];
                    const active = current === st;
                    return (
                      <button
                        key={st}
                        onClick={() => setSkills({ ...skills, [skill]: st })}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          active ? cfg.on : cfg.off
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="General notes..."
          className="mt-4 w-full text-sm border border-slate-200 rounded-md p-2 min-h-[80px] bg-white outline-none focus:border-blue-500"
        />

        <div className="flex justify-end mt-3">
          <button
            onClick={saveProgress}
            className="btn-primary text-sm font-medium px-4 py-2 rounded-md"
          >
            Save progress
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h2 className="font-medium text-slate-900 mb-4">Pickup & notes</h2>
        <div className="text-sm space-y-2">
          <div>
            <span className="text-slate-400 text-xs uppercase tracking-wider">Pickup</span>
            <div className="text-slate-800">{s.pickup_address ?? "—"}</div>
          </div>
          <div>
            <span className="text-slate-400 text-xs uppercase tracking-wider">Notes</span>
            <div className="text-slate-700">{s.notes ?? "—"}</div>
          </div>
          <div>
            <span className="text-slate-400 text-xs uppercase tracking-wider">Road-test notes</span>
            <div className="text-slate-700">{s.road_test_notes ?? "—"}</div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 font-medium text-slate-900">Lesson history</div>
        <div className="divide-y divide-slate-100">
          {bookings.map((b: any) => (
            <div key={b.id} className="px-5 py-3 flex items-center justify-between text-sm flex-wrap gap-2">
              <div>
                <div className="font-medium text-slate-800">{fmtDateTime(b.scheduled_at)}</div>
                <div className="text-xs text-slate-500">
                  {b.lesson_types?.name} · {b.instructors?.full_name ?? "Unassigned"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{money(b.price_cents)}</span>
                <StatusPill tone={statusTone[b.status]}>{statusLabel(b.status)}</StatusPill>
              </div>
            </div>
          ))}
          {bookings.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-500">No lessons yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
