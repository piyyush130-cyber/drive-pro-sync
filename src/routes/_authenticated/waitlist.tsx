import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useSchoolId } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/waitlist")({
  component: WaitlistPage,
});

const OFFER_STATUS_LABEL: Record<string, string> = {
  pending: "Offer sent",
  claimed: "Claimed",
  expired: "Expired / filled elsewhere",
};

function WaitlistPage() {
  const qc = useQueryClient();
  const { user } = useAuthUser();
  const schoolIdQ = useSchoolId(user?.id);
  const [studentId, setStudentId] = useState("");

  const entriesQ = useQuery({
    queryKey: ["waitlist-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist_entries")
        .select("id, status, created_at, students(id, full_name, phone)")
        .eq("status", "waiting")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentsQ = useQuery({
    queryKey: ["students-for-waitlist"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name")
        .is("deleted_at", null)
        .order("full_name");
      return data ?? [];
    },
  });

  const offersQ = useQuery({
    queryKey: ["waitlist-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist_offers")
        .select(
          "id, status, scheduled_at, expires_at, created_at, waitlist_entries(students(full_name))",
        )
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addToWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) return toast.error("Pick a student first");
    if (!schoolIdQ.data) return toast.error("Could not determine your school — try refreshing.");
    const { error } = await supabase.from("waitlist_entries").insert({
      student_id: studentId,
      school_id: schoolIdQ.data,
      status: "waiting",
    });
    if (error) return toast.error(error.message);
    setStudentId("");
    qc.invalidateQueries({ queryKey: ["waitlist-entries"] });
    toast.success("Added to waitlist");
  }

  async function removeEntry(id: string) {
    const { error } = await supabase
      .from("waitlist_entries")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["waitlist-entries"] });
    toast.success("Removed from waitlist");
  }

  const waitingIds = new Set((entriesQ.data ?? []).map((e: any) => e.students?.id));
  const eligibleStudents = (studentsQ.data ?? []).filter((s: any) => !waitingIds.has(s.id));

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Waitlist</h1>
      <p className="text-sm text-slate-400 mb-6">
        When a future lesson is cancelled, the freed slot is automatically offered by text/email to
        the longest-waiting eligible student here.
      </p>

      <form onSubmit={addToWaitlist} className="glass-card p-5 mb-6 flex flex-wrap gap-3">
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="glass-input flex-1 min-w-[200px]"
        >
          <option value="">Select a student…</option>
          {eligibleStudents.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
        <button className="btn-primary text-sm">Add to waitlist</button>
      </form>

      <div className="space-y-3 mb-8">
        {(entriesQ.data ?? []).map((e: any, i: number) => (
          <div key={e.id} className="glass-card p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">
                #{i + 1} · {e.students?.full_name ?? "—"}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {e.students?.phone ?? "—"} · Waiting since {fmtDateTime(e.created_at)}
              </div>
            </div>
            <button
              onClick={() => removeEntry(e.id)}
              className="text-xs text-red-400 hover:underline shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
        {entriesQ.data?.length === 0 && (
          <div className="glass-card p-8 text-center text-sm text-slate-400">
            No one's on the waitlist right now.
          </div>
        )}
      </div>

      <h2 className="font-semibold text-slate-900 mb-3">Recent offers</h2>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {(offersQ.data ?? []).map((o: any) => (
              <tr key={o.id}>
                <td className="px-5 py-3">
                  <div className="font-medium">
                    {o.waitlist_entries?.students?.full_name ?? "—"}
                  </div>
                  <div className="text-xs text-slate-400">
                    Slot: {fmtDateTime(o.scheduled_at)}
                  </div>
                </td>
                <td className="px-5 py-3 text-right text-xs text-slate-500 whitespace-nowrap">
                  {OFFER_STATUS_LABEL[o.status] ?? o.status}
                </td>
              </tr>
            ))}
            {offersQ.data?.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-center text-sm text-slate-400" colSpan={2}>
                  No offers sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
