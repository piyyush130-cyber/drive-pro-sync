import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Check, Key, RefreshCw, Link as LinkIcon, Lock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateInviteCode } from "@/lib/invite-code.functions";
import { checkInstructorLimit } from "@/lib/billing.functions";
import { notifyBookingUpdated } from "@/lib/notifications.functions";
import { useAuthUser, useSchoolId } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/format";
import { isBookingConflictError } from "@/lib/booking-conflict-error";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/instructors")({
  component: InstructorsPage,
});

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];
const TIMES = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 22; h++)
    for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
  return out;
})();

function InstructorsPage() {
  const qc = useQueryClient();
  const genCode = useServerFn(generateInviteCode);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [offboardingId, setOffboardingId] = useState<string | null>(null);
  const { user } = useAuthUser();
  const schoolIdQ = useSchoolId(user?.id);
  const checkLimit = useServerFn(checkInstructorLimit);
  const notifyUpdate = useServerFn(notifyBookingUpdated);

  const limitQ = useQuery({
    queryKey: ["instructor-limit"],
    queryFn: () => checkLimit({}),
  });

  const instructorsQ = useQuery({
    queryKey: ["instructors-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("*, bookings(id, status)")
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const codeQ = useQuery({
    queryKey: ["invite-code"],
    queryFn: async () => {
      const { data } = await supabase
        .from("instructor_invite_codes")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  async function generate() {
    try {
      await genCode({});
      qc.invalidateQueries({ queryKey: ["invite-code"] });
      toast.success("New invite code generated");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolIdQ.data) return toast.error("Could not determine your school — try refreshing.");
    if (limitQ.data?.atLimit) {
      return toast.error(
        `You've reached your plan's limit of ${limitQ.data.limit} instructors. Upgrade to add more.`,
      );
    }
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("instructors").insert({
      full_name: String(fd.get("full_name") || ""),
      phone: String(fd.get("phone") || "") || null,
      email: String(fd.get("email") || "") || null,
      school_id: schoolIdQ.data,
    });
    if (error) return toast.error(error.message);
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["instructors-all"] });
    qc.invalidateQueries({ queryKey: ["instructor-limit"] });
    toast.success("Instructor added");
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("instructors").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["instructors-all"] });
  }

  async function deleteInstructor(id: string, name: string) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", id)
      .is("deleted_at", null)
      .not("status", "in", "(cancelled,declined,completed,no_show)")
      .gte("scheduled_at", new Date().toISOString());
    if ((count ?? 0) > 0) {
      setOffboardingId(id);
      return;
    }
    if (!window.confirm(`Delete ${name}? You can restore them from the recycle bin.`)) return;
    await finishDelete(id, name);
  }

  async function finishDelete(id: string, name: string) {
    const { error } = await supabase
      .from("instructors")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["instructors-all"] });
    qc.invalidateQueries({ queryKey: ["instructor-limit"] });
    setOffboardingId(null);
    toast.success(`${name} deleted`);
  }

  async function saveAvailability(id: string, avail: any) {
    const { error } = await supabase
      .from("instructors")
      .update({ weekly_availability: avail })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["instructors-all"] });
    toast.success("Availability saved");
  }

  const signupUrl =
    typeof window !== "undefined" ? window.location.origin + "/instructor-signup" : "";
  const code = codeQ.data?.code;

  const atLimit = !!limitQ.data?.atLimit;

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Instructors</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your teaching team.
            {limitQ.data?.limit != null && (
              <span className="ml-1 text-slate-500">
                ({limitQ.data.current}/{limitQ.data.limit} used)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => (atLimit ? undefined : setAdding(!adding))}
          disabled={atLimit && !adding}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {adding ? "Cancel" : "+ Add instructor"}
        </button>
      </div>

      {atLimit && (
        <div className="glass-card p-4 mb-6 flex items-center gap-3 border border-amber-500/30">
          <Lock className="size-4 text-amber-400 shrink-0" />
          <p className="text-sm text-slate-300 flex-1">
            You've reached your plan's limit of {limitQ.data?.limit} instructors.
          </p>
          <Link to="/settings" className="btn-secondary text-xs shrink-0">
            Upgrade plan
          </Link>
        </div>
      )}

      {/* Invite Code Card */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-9 rounded-lg bg-[#3B82F6]/15 grid place-items-center shrink-0">
            <Key className="size-4 text-[#60A5FA]" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Instructor Invite Code</h2>
            <p className="text-sm text-slate-400">
              Share this code with instructors so they can create their login account.
            </p>
          </div>
        </div>
        {code ? (
          <>
            <div className="bg-[#0D1424] border border-slate-700 rounded-xl p-4 mb-3">
              <div className="font-mono text-2xl text-[#60A5FA] tracking-wider">{code}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copy(code, "code")} className="btn-secondary text-xs">
                {copied === "code" ? (
                  <>
                    <Check className="size-3.5" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" /> Copy code
                  </>
                )}
              </button>
              <button onClick={() => copy(signupUrl, "link")} className="btn-secondary text-xs">
                {copied === "link" ? (
                  <>
                    <Check className="size-3.5" /> Copied!
                  </>
                ) : (
                  <>
                    <LinkIcon className="size-3.5" /> Copy signup link
                  </>
                )}
              </button>
              <button onClick={generate} className="btn-secondary text-xs">
                <RefreshCw className="size-3.5" /> Generate new code
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              {codeQ.data?.used_count ?? 0} instructors have used this code
            </p>
          </>
        ) : (
          <button onClick={generate} className="btn-primary text-sm">
            <Key className="size-4" /> Generate invite code
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={add} className="glass-card p-5 mb-6 grid sm:grid-cols-3 gap-3">
          <input name="full_name" required placeholder="Full name" className="glass-input" />
          <input name="phone" placeholder="Phone" className="glass-input" />
          <input name="email" type="email" placeholder="Email" className="glass-input" />
          <button className="btn-primary sm:col-span-3 text-sm">Save</button>
        </form>
      )}

      {offboardingId && (
        <OffboardPanel
          instructorId={offboardingId}
          instructorName={
            (instructorsQ.data ?? []).find((i: any) => i.id === offboardingId)?.full_name ?? ""
          }
          otherInstructors={(instructorsQ.data ?? []).filter(
            (i: any) => i.id !== offboardingId && i.active,
          )}
          notifyUpdate={notifyUpdate}
          onDone={() => setOffboardingId(null)}
          onConfirmDelete={() =>
            finishDelete(
              offboardingId,
              (instructorsQ.data ?? []).find((i: any) => i.id === offboardingId)?.full_name ?? "",
            )
          }
        />
      )}

      <div className="space-y-3">
        {(instructorsQ.data ?? []).map((i: any) => {
          const summary = formatAvail(i.weekly_availability);
          const isEditing = editing === i.id;
          return (
            <div key={i.id} className="glass-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {i.full_name}
                    {!i.active && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                    {i.status === "pending_approval" && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                    {i.profile_id && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider bg-[#3B82F6]/15 text-[#60A5FA] px-2 py-0.5 rounded-full">
                        Login linked
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {i.phone ?? "—"} · {i.email ?? "—"}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 font-mono">{summary}</div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {(i.bookings ?? []).length} lessons
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setEditing(isEditing ? null : i.id)}
                  className="btn-secondary text-xs"
                >
                  {isEditing ? "Close" : "Edit availability"}
                </button>
                <button onClick={() => toggle(i.id, i.active)} className="btn-secondary text-xs">
                  {i.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => deleteInstructor(i.id, i.full_name)}
                  className="text-xs text-red-400 hover:underline ml-auto"
                >
                  Delete
                </button>
              </div>

              {isEditing && (
                <AvailabilityEditor
                  initial={i.weekly_availability}
                  onSave={(v) => saveAvailability(i.id, v)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OffboardPanel({
  instructorId,
  instructorName,
  otherInstructors,
  notifyUpdate,
  onDone,
  onConfirmDelete,
}: {
  instructorId: string;
  instructorName: string;
  otherInstructors: any[];
  notifyUpdate: (opts: { data: { bookingId: string; patch: Record<string, unknown> } }) => Promise<any>;
  onDone: () => void;
  onConfirmDelete: () => void;
}) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const bookingsQ = useQuery({
    queryKey: ["instructor-upcoming-bookings", instructorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, scheduled_at, students(full_name), lesson_types(name)")
        .eq("instructor_id", instructorId)
        .is("deleted_at", null)
        .not("status", "in", "(cancelled,declined,completed,no_show)")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function reassign(bookingId: string, newInstructorId: string) {
    if (!newInstructorId) return;
    setBusyId(bookingId);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ instructor_id: newInstructorId })
        .eq("id", bookingId);
      if (error) throw error;
      void notifyUpdate({ data: { bookingId, patch: { instructor_id: newInstructorId } } });
      toast.success("Lesson reassigned");
      await qc.invalidateQueries({ queryKey: ["instructor-upcoming-bookings", instructorId] });
    } catch (err: any) {
      toast.error(
        isBookingConflictError(err)
          ? "That instructor already has an overlapping lesson at this time."
          : err?.message || "Could not reassign lesson",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function cancelBooking(bookingId: string) {
    setBusyId(bookingId);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId);
      if (error) throw error;
      void notifyUpdate({
        data: {
          bookingId,
          patch: { status: "cancelled", cancellation_reason: `${instructorName} is no longer available.` },
        },
      });
      toast.success("Lesson cancelled");
      await qc.invalidateQueries({ queryKey: ["instructor-upcoming-bookings", instructorId] });
    } catch (err: any) {
      toast.error(err?.message || "Could not cancel lesson");
    } finally {
      setBusyId(null);
    }
  }

  const bookings = bookingsQ.data ?? [];
  const allResolved = !bookingsQ.isLoading && bookings.length === 0;

  return (
    <div className="glass-card p-5 mb-6 border border-amber-500/30">
      <h2 className="font-semibold text-slate-900">Offboard {instructorName}</h2>
      <p className="text-sm text-slate-400 mt-1 mb-4">
        {allResolved
          ? "All upcoming lessons are resolved — you can now remove this instructor."
          : `${bookings.length} upcoming lesson${bookings.length === 1 ? "" : "s"} need to be reassigned or cancelled before this instructor can be removed.`}
      </p>

      <div className="space-y-2">
        {bookings.map((b: any) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"
          >
            <div className="text-sm min-w-0">
              <div className="font-medium text-slate-900 truncate">
                {b.students?.full_name ?? "—"} · {b.lesson_types?.name ?? "Lesson"}
              </div>
              <div className="text-xs text-slate-500">
                {fmtDate(b.scheduled_at)} at {fmtTime(b.scheduled_at)}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                disabled={busyId === b.id}
                defaultValue=""
                onChange={(e) => reassign(b.id, e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="" disabled>
                  Reassign to…
                </option>
                {otherInstructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.full_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busyId === b.id}
                onClick={() => cancelBooking(b.id)}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
        <button
          type="button"
          disabled={!allResolved}
          onClick={onConfirmDelete}
          className="btn-primary text-sm disabled:opacity-50"
        >
          Confirm and remove instructor
        </button>
        <button type="button" onClick={onDone} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatAvail(avail: any): string {
  if (!avail || Object.keys(avail).length === 0) return "Availability not set";
  const days = DAYS.filter((d) => avail[d.key]?.enabled);
  if (days.length === 0) return "No days enabled";
  const first = avail[days[0].key];
  const allSame = days.every(
    (d) => avail[d.key].start === first.start && avail[d.key].end === first.end,
  );
  if (allSame)
    return `${days[0].label}–${days[days.length - 1].label}, ${first.start} – ${first.end}`;
  return `${days.length} days configured`;
}

function AvailabilityEditor({ initial, onSave }: { initial: any; onSave: (v: any) => void }) {
  const [v, setV] = useState<Record<string, { enabled: boolean; start: string; end: string }>>(
    () => {
      const base: any = {};
      for (const d of DAYS) {
        base[d.key] = initial?.[d.key] ?? { enabled: false, start: "09:00", end: "17:00" };
      }
      return base;
    },
  );
  return (
    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
      {DAYS.map((d) => {
        const day = v[d.key];
        return (
          <div key={d.key} className="flex items-center gap-3">
            <label className="flex items-center gap-2 w-28 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={day.enabled}
                onChange={(e) => setV({ ...v, [d.key]: { ...day, enabled: e.target.checked } })}
                className="accent-[#3B82F6]"
              />
              {d.label}
            </label>
            {day.enabled ? (
              <>
                <select
                  value={day.start}
                  onChange={(e) => setV({ ...v, [d.key]: { ...day, start: e.target.value } })}
                  className="glass-input flex-1 text-sm"
                >
                  {TIMES.map((t) => (
                    <option key={t} value={t} className="bg-[#0D1424]">
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500 text-xs">to</span>
                <select
                  value={day.end}
                  onChange={(e) => setV({ ...v, [d.key]: { ...day, end: e.target.value } })}
                  className="glass-input flex-1 text-sm"
                >
                  {TIMES.map((t) => (
                    <option key={t} value={t} className="bg-[#0D1424]">
                      {t}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <span className="text-xs text-slate-500 flex-1">Off</span>
            )}
          </div>
        );
      })}
      <button onClick={() => onSave(v)} className="btn-primary text-sm mt-3">
        Save availability
      </button>
    </div>
  );
}
