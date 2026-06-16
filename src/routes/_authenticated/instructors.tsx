import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Check, Key, RefreshCw, Link as LinkIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateInviteCode } from "@/lib/invite-code.functions";
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

  const instructorsQ = useQuery({
    queryKey: ["instructors-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("*, bookings(id, status)")
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
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("instructors").insert({
      full_name: String(fd.get("full_name") || ""),
      phone: String(fd.get("phone") || "") || null,
      email: String(fd.get("email") || "") || null,
    });
    if (error) return toast.error(error.message);
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["instructors-all"] });
    toast.success("Instructor added");
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("instructors").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["instructors-all"] });
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

  const signupUrl = typeof window !== "undefined" ? window.location.origin + "/instructor-signup" : "";
  const code = codeQ.data?.code;

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Instructors</h1>
          <p className="text-sm text-slate-400 mt-1">Manage your teaching team.</p>
        </div>
        <button onClick={() => setAdding(!adding)} className="btn-primary text-sm">
          {adding ? "Cancel" : "+ Add instructor"}
        </button>
      </div>

      {/* Invite Code Card */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-9 rounded-lg bg-[#3B82F6]/15 grid place-items-center shrink-0">
            <Key className="size-4 text-[#60A5FA]" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Instructor Invite Code</h2>
            <p className="text-sm text-slate-400">Share this code with instructors so they can create their login account.</p>
          </div>
        </div>
        {code ? (
          <>
            <div className="bg-[#0D1424] border border-slate-700 rounded-xl p-4 mb-3">
              <div className="font-mono text-2xl text-[#60A5FA] tracking-wider">{code}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copy(code, "code")} className="btn-secondary text-xs">
                {copied === "code" ? <><Check className="size-3.5" /> Copied!</> : <><Copy className="size-3.5" /> Copy code</>}
              </button>
              <button onClick={() => copy(signupUrl, "link")} className="btn-secondary text-xs">
                {copied === "link" ? <><Check className="size-3.5" /> Copied!</> : <><LinkIcon className="size-3.5" /> Copy signup link</>}
              </button>
              <button onClick={generate} className="btn-secondary text-xs">
                <RefreshCw className="size-3.5" /> Generate new code
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">{codeQ.data?.used_count ?? 0} instructors have used this code</p>
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
                    {!i.active && <span className="ml-2 text-[10px] uppercase tracking-wider bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">Inactive</span>}
                    {i.status === "pending_approval" && <span className="ml-2 text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">Pending</span>}
                    {i.profile_id && <span className="ml-2 text-[10px] uppercase tracking-wider bg-[#3B82F6]/15 text-[#60A5FA] px-2 py-0.5 rounded-full">Login linked</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {i.phone ?? "—"} · {i.email ?? "—"}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 font-mono">{summary}</div>
                </div>
                <div className="text-right text-xs text-slate-500">{(i.bookings ?? []).length} lessons</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                <button onClick={() => setEditing(isEditing ? null : i.id)} className="btn-secondary text-xs">
                  {isEditing ? "Close" : "Edit availability"}
                </button>
                <button onClick={() => toggle(i.id, i.active)} className="btn-secondary text-xs">
                  {i.active ? "Deactivate" : "Activate"}
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

function formatAvail(avail: any): string {
  if (!avail || Object.keys(avail).length === 0) return "Availability not set";
  const days = DAYS.filter((d) => avail[d.key]?.enabled);
  if (days.length === 0) return "No days enabled";
  const first = avail[days[0].key];
  const allSame = days.every((d) => avail[d.key].start === first.start && avail[d.key].end === first.end);
  if (allSame) return `${days[0].label}–${days[days.length - 1].label}, ${first.start} – ${first.end}`;
  return `${days.length} days configured`;
}

function AvailabilityEditor({ initial, onSave }: { initial: any; onSave: (v: any) => void }) {
  const [v, setV] = useState<Record<string, { enabled: boolean; start: string; end: string }>>(() => {
    const base: any = {};
    for (const d of DAYS) {
      base[d.key] = initial?.[d.key] ?? { enabled: false, start: "09:00", end: "17:00" };
    }
    return base;
  });
  return (
    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
      {DAYS.map((d) => {
        const day = v[d.key];
        return (
          <div key={d.key} className="flex items-center gap-3">
            <label className="flex items-center gap-2 w-28 text-sm text-slate-300">
              <input type="checkbox" checked={day.enabled} onChange={(e) => setV({ ...v, [d.key]: { ...day, enabled: e.target.checked } })} className="accent-[#3B82F6]" />
              {d.label}
            </label>
            {day.enabled ? (
              <>
                <select value={day.start} onChange={(e) => setV({ ...v, [d.key]: { ...day, start: e.target.value } })} className="glass-input flex-1 text-sm">
                  {TIMES.map((t) => <option key={t} value={t} className="bg-[#0D1424]">{t}</option>)}
                </select>
                <span className="text-slate-500 text-xs">to</span>
                <select value={day.end} onChange={(e) => setV({ ...v, [d.key]: { ...day, end: e.target.value } })} className="glass-input flex-1 text-sm">
                  {TIMES.map((t) => <option key={t} value={t} className="bg-[#0D1424]">{t}</option>)}
                </select>
              </>
            ) : (
              <span className="text-xs text-slate-500 flex-1">Off</span>
            )}
          </div>
        );
      })}
      <button onClick={() => onSave(v)} className="btn-primary text-sm mt-3">Save availability</button>
    </div>
  );
}
