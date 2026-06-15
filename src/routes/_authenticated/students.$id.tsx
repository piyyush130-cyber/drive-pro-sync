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
  "Turns",
  "Lane changes",
  "Parking",
  "Parallel parking",
  "Highway driving",
  "School zones",
  "Shoulder checks",
];

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

  const [skills, setSkills] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = studentQ.data?.student_progress?.[0];
    if (p) {
      setSkills(p.skills ?? {});
      setNotes(p.general_notes ?? "");
      setReady(p.road_test_ready ?? false);
    }
  }, [studentQ.data]);

  async function saveProgress() {
    const { error } = await supabase.from("student_progress").upsert(
      {
        student_id: id,
        skills,
        general_notes: notes,
        road_test_ready: ready,
      },
      { onConflict: "student_id" },
    );
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["student", id] });
    toast.success("Progress saved");
  }

  if (studentQ.isLoading) return <div className="p-10 text-zinc-500">Loading...</div>;
  const s = studentQ.data;
  if (!s) return <div className="p-10">Not found</div>;

  const bookings = (s.bookings ?? []).sort(
    (a: any, b: any) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at),
  );
  const completed = bookings.filter((b: any) => b.status === "completed").length;

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <Link to="/students" className="text-xs text-zinc-500">← All students</Link>
      <div className="flex items-start justify-between mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">{s.full_name}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {s.phone} · {s.email ?? "no email"}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="text-zinc-500">Lessons</div>
          <div className="font-medium">
            {completed} of {s.lessons_purchased || "—"} completed
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white ring-1 ring-black/5 rounded-xl p-5">
          <h2 className="font-medium mb-4">Progress</h2>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {SKILLS.map((skill) => (
              <label key={skill} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!skills[skill]}
                  onChange={(e) => setSkills({ ...skills, [skill]: e.target.checked })}
                />
                {skill}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} />
            <span className="font-medium">Road-test ready</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="General notes..."
            className="w-full text-sm border border-zinc-200 rounded-md p-2 min-h-[100px] mb-3"
          />
          <button
            onClick={saveProgress}
            className="bg-emerald-800 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            Save progress
          </button>
        </section>

        <section className="bg-white ring-1 ring-black/5 rounded-xl p-5">
          <h2 className="font-medium mb-4">Pickup & notes</h2>
          <div className="text-sm space-y-2">
            <div>
              <span className="text-zinc-400 text-xs uppercase tracking-wider">Pickup</span>
              <div>{s.pickup_address ?? "—"}</div>
            </div>
            <div>
              <span className="text-zinc-400 text-xs uppercase tracking-wider">Notes</span>
              <div className="text-zinc-700">{s.notes ?? "—"}</div>
            </div>
            <div>
              <span className="text-zinc-400 text-xs uppercase tracking-wider">Road-test notes</span>
              <div className="text-zinc-700">{s.road_test_notes ?? "—"}</div>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white ring-1 ring-black/5 rounded-xl mt-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 font-medium">Lesson history</div>
        <div className="divide-y divide-zinc-100">
          {bookings.map((b: any) => (
            <div key={b.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{fmtDateTime(b.scheduled_at)}</div>
                <div className="text-xs text-zinc-500">
                  {b.lesson_types?.name} · {b.instructors?.full_name ?? "Unassigned"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{money(b.price_cents)}</span>
                <StatusPill tone={statusTone[b.status]}>{statusLabel(b.status)}</StatusPill>
              </div>
            </div>
          ))}
          {bookings.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-zinc-500">No lessons yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
