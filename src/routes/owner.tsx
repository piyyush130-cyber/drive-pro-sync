import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth";
import {
  listSchoolsForOwner,
  ownerExtendTrial,
  ownerMarkFreeForever,
  ownerSuspendSchool,
  ownerReactivateSchool,
  ownerDeleteSchool,
} from "@/lib/owner.functions";
import { PLANS, type PlanKey } from "@/lib/plans";
import { fmtLongDate } from "@/lib/format";
import { StatusPill } from "@/components/StatCard";
import { toast } from "sonner";

export const Route = createFileRoute("/owner")({
  component: OwnerPage,
});

const STATUS_LABEL: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  grace_period: "Grace period",
  locked: "Locked",
  free_forever: "Free forever",
  suspended: "Suspended",
};

// Dark, glassy pill tones — this page runs a cooler "mission control" theme
// distinct from the warm cream/gold surface used everywhere else, so these
// tones are local to owner.tsx rather than reusing the app-wide statusTone
// map (which assumes a light background). Deliberately spread across
// several hues (not just blue) so each status reads as visually distinct
// at a glance — past_due and grace_period in particular used to share the
// exact same amber tone, which was part of why the page felt monochrome.
const STATUS_TONE: Record<string, string> = {
  trialing: "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30",
  active: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30",
  past_due: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30",
  grace_period: "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30",
  locked: "bg-red-500/20 text-red-300 ring-1 ring-red-500/30",
  free_forever: "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30",
  suspended: "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30",
};

const ACTION_BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 text-xs font-semibold h-8 px-3 rounded-lg transition-all duration-150 hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed";

function OwnerPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuthUser();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    supabase.rpc("is_platform_owner", { _user_id: user.id }).then(({ data }) => {
      setIsOwner(!!data);
      if (!data) navigate({ to: "/no-access", replace: true });
    });
  }, [loading, user, navigate]);

  const qc = useQueryClient();
  const listSchools = useServerFn(listSchoolsForOwner);
  const schoolsQ = useQuery({
    queryKey: ["owner-schools"],
    enabled: isOwner === true,
    queryFn: () => listSchools({}),
  });

  const extendTrial = useServerFn(ownerExtendTrial);
  const markFreeForever = useServerFn(ownerMarkFreeForever);
  const suspend = useServerFn(ownerSuspendSchool);
  const reactivate = useServerFn(ownerReactivateSchool);
  const deleteSchool = useServerFn(ownerDeleteSchool);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dormantOnly, setDormantOnly] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  function copyPortalLink(slug: string) {
    const url = `${window.location.origin}/portal/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug((s) => (s === slug ? null : s)), 2000);
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["owner-schools"] });
  }

  async function handleExtendTrial(schoolId: string) {
    const daysStr = window.prompt("Extend trial by how many days?", "14");
    if (!daysStr) return;
    const days = Number(daysStr);
    if (!Number.isFinite(days) || days <= 0) return toast.error("Enter a positive number of days");
    setBusyId(schoolId);
    try {
      await extendTrial({ data: { schoolId, days } });
      toast.success(`Trial extended by ${days} days`);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not extend trial");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkFreeForever(schoolId: string, name: string) {
    if (!window.confirm(`Mark ${name} as free forever? Any active subscription will be canceled.`))
      return;
    setBusyId(schoolId);
    try {
      await markFreeForever({ data: { schoolId } });
      toast.success(`${name} is now free forever`);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not update");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSuspend(schoolId: string, name: string) {
    if (!window.confirm(`Suspend ${name}? They'll lose access until reactivated.`)) return;
    setBusyId(schoolId);
    try {
      await suspend({ data: { schoolId } });
      toast.success(`${name} suspended`);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not suspend");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(schoolId: string, name: string) {
    setBusyId(schoolId);
    try {
      await reactivate({ data: { schoolId } });
      toast.success(`${name} reactivated`);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not reactivate");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(schoolId: string, name: string) {
    const typed = window.prompt(
      `This permanently deletes "${name}" and every student, booking, instructor, and billing record tied to it. This cannot be undone.\n\nType the school name exactly to confirm:`,
    );
    if (typed === null) return;
    if (typed !== name) {
      toast.error("Name didn't match — nothing was deleted.");
      return;
    }
    setBusyId(schoolId);
    try {
      const res = await deleteSchool({ data: { schoolId, confirmName: typed } });
      toast.success(
        `${name} permanently deleted` +
          (res.accountsRemoved > 0
            ? ` — also removed ${res.accountsRemoved} login${res.accountsRemoved === 1 ? "" : "s"} with no remaining access`
            : ""),
      );
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not delete school");
    } finally {
      setBusyId(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || isOwner !== true) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-slate-400"
        style={{ background: "linear-gradient(160deg, #0A0F1E 0%, #0D1428 50%, #0A0F1E 100%)" }}
      >
        Loading…
      </div>
    );
  }

  const allSchools = schoolsQ.data ?? [];
  const dormantCount = allSchools.filter((s) => s.isDormant).length;
  const visibleSchools = dormantOnly ? allSchools.filter((s) => s.isDormant) : allSchools;

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0A0F1E 0%, #0D1428 50%, #0A0F1E 100%)" }}
    >
      {/* Background depth: cool-toned grid + two off-hue glow blobs, kept
          well away from the blue used everywhere else so the page doesn't
          read as a single repeated color. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(96,165,250,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        className="pointer-events-none absolute -top-32 -right-24 size-[480px] rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, rgba(168,85,247,0.35) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute top-1/3 -left-40 size-[420px] rounded-full blur-3xl opacity-25"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.3) 0%, transparent 70%)" }}
      />

      <header className="relative border-b border-white/5 px-6 py-4 flex items-center justify-between bg-white/[0.02]">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(90deg, #FFFFFF 0%, #93C5FD 60%, #67E8F9 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Owner Dashboard
          </h1>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-0.5">
            Every school on DrivingOps, in one place.
          </p>
        </div>
        <button onClick={signOut} className="text-sm text-slate-400 hover:text-white transition-colors">
          Sign out
        </button>
      </header>

      <main className="relative p-6 max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={dormantOnly}
              onChange={(e) => setDormantOnly(e.target.checked)}
              className="size-4 rounded border-white/20 bg-white/5 accent-blue-500"
            />
            Dormant only — locked out 12+ months, never auto-deleted
          </label>
          <span className="text-xs text-slate-500 font-mono">
            {dormantCount} dormant school{dormantCount === 1 ? "" : "s"}
          </span>
        </div>
        {schoolsQ.isLoading ? (
          <p className="text-sm text-slate-500">Loading schools…</p>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "#0F1729",
              border: "1px solid rgba(96,165,250,0.14)",
              boxShadow:
                "0 0 40px rgba(59,130,246,0.05), 0 0 70px rgba(168,85,247,0.04), 0 8px 32px rgba(0,0,0,0.45)",
            }}
          >
            <table
              className="w-full text-sm border-separate"
              style={{ borderSpacing: "0 6px" }}
            >
              <thead className="text-slate-500">
                <tr
                  style={{
                    boxShadow: "inset 0 -1px 0 0 rgba(96,165,250,0.18)",
                  }}
                >
                  <th className="text-left px-5 py-2 pb-3 text-[11px] font-bold uppercase tracking-[0.14em]">
                    School
                  </th>
                  <th className="text-left px-5 py-2 pb-3 text-[11px] font-bold uppercase tracking-[0.14em]">
                    Plan
                  </th>
                  <th className="text-left px-5 py-2 pb-3 text-[11px] font-bold uppercase tracking-[0.14em]">
                    Status
                  </th>
                  <th className="text-left px-5 py-2 pb-3 text-[11px] font-bold uppercase tracking-[0.14em]">
                    Instructors
                  </th>
                  <th className="text-left px-5 py-2 pb-3 text-[11px] font-bold uppercase tracking-[0.14em]">
                    Signed up
                  </th>
                  <th className="text-right px-5 py-2 pb-3 text-[11px] font-bold uppercase tracking-[0.14em]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleSchools.map((s) => {
                  const status = s.billing?.billing_status ?? "no billing set up";
                  const plan = s.billing?.plan as PlanKey | undefined;
                  const isSuspended = status === "suspended";
                  const isBusy = busyId === s.id;
                  return (
                    <tr
                      key={s.id}
                      className="odd:bg-white/[0.02] even:bg-white/[0.04] hover:bg-cyan-500/[0.06] hover:shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_4px_20px_rgba(34,211,238,0.1)] transition-all [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl"
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-white">{s.name}</div>
                        <div className="text-xs text-slate-500">/{s.slug}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{plan ? PLANS[plan].name : "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusPill tone={STATUS_TONE[status] ?? "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25"}>
                            {STATUS_LABEL[status] ?? status}
                          </StatusPill>
                          {s.isDormant && (
                            <StatusPill tone="bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/25">
                              Dormant
                            </StatusPill>
                          )}
                        </div>
                        {s.billing?.trial_ends_at && status === "trialing" && (
                          <div className="text-xs text-slate-500 mt-1 font-mono">
                            ends {fmtLongDate(s.billing.trial_ends_at)}
                          </div>
                        )}
                        {s.billing?.grace_period_ends_at && status === "grace_period" && (
                          <div className="text-xs text-slate-500 mt-1 font-mono">
                            grace ends {fmtLongDate(s.billing.grace_period_ends_at)}
                          </div>
                        )}
                        {s.lockedOutSince && (
                          <div className="text-xs text-slate-500 mt-1 font-mono">
                            locked out since {fmtLongDate(s.lockedOutSince)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-300 font-mono">{s.instructorCount}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs font-mono">
                        {fmtLongDate(s.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => copyPortalLink(s.slug)}
                            className={`${ACTION_BTN_BASE} text-white ${
                              copiedSlug === s.slug
                                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                                : "bg-gradient-to-r from-blue-600 to-cyan-500 shadow-[0_0_16px_rgba(34,211,238,0.3)] hover:shadow-[0_0_28px_rgba(34,211,238,0.55)] hover:brightness-110"
                            }`}
                          >
                            {copiedSlug === s.slug ? (
                              <>
                                <Check className="size-3.5" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5" /> Portal link
                              </>
                            )}
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => handleExtendTrial(s.id)}
                            className={`${ACTION_BTN_BASE} bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20`}
                          >
                            Extend trial
                          </button>
                          <button
                            disabled={isBusy || status === "free_forever"}
                            onClick={() => handleMarkFreeForever(s.id, s.name)}
                            className={`${ACTION_BTN_BASE} bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/20 hover:bg-purple-500/15 hover:ring-purple-500/35`}
                          >
                            Free forever
                          </button>
                          {isSuspended ? (
                            <button
                              disabled={isBusy}
                              onClick={() => handleReactivate(s.id, s.name)}
                              className={`${ACTION_BTN_BASE} text-white bg-gradient-to-r from-emerald-600 to-teal-500 shadow-[0_0_16px_rgba(20,184,166,0.3)] hover:shadow-[0_0_28px_rgba(20,184,166,0.55)] hover:brightness-110`}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              disabled={isBusy}
                              onClick={() => handleSuspend(s.id, s.name)}
                              className={`${ACTION_BTN_BASE} bg-red-500/10 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/15 hover:ring-red-500/30`}
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            disabled={isBusy}
                            onClick={() => handleDelete(s.id, s.name)}
                            className={`${ACTION_BTN_BASE} bg-red-500/15 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20 hover:shadow-[0_0_14px_rgba(239,68,68,0.3)]`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleSchools.length === 0 && (
              <div className="text-center py-10 text-sm text-slate-500">
                {dormantOnly ? "No dormant schools." : "No schools yet."}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
