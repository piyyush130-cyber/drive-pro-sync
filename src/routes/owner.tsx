import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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

const STATUS_TONE: Record<string, string> = {
  trialing: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  past_due: "bg-amber-100 text-amber-700",
  grace_period: "bg-amber-100 text-amber-700",
  locked: "bg-red-100 text-red-700",
  free_forever: "bg-purple-100 text-purple-700",
  suspended: "bg-slate-200 text-slate-700",
};

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
      <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>
    );
  }

  const allSchools = schoolsQ.data ?? [];
  const dormantCount = allSchools.filter((s) => s.isDormant).length;
  const visibleSchools = dormantOnly ? allSchools.filter((s) => s.isDormant) : allSchools;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Owner Dashboard</h1>
          <p className="text-xs text-slate-500">Every school on DriveProSync, in one place.</p>
        </div>
        <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">
          Sign out
        </button>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={dormantOnly}
              onChange={(e) => setDormantOnly(e.target.checked)}
              className="size-4 rounded border-slate-300"
            />
            Dormant only — locked out 12+ months, never auto-deleted
          </label>
          <span className="text-xs text-slate-400">
            {dormantCount} dormant school{dormantCount === 1 ? "" : "s"}
          </span>
        </div>
        {schoolsQ.isLoading ? (
          <p className="text-sm text-slate-500">Loading schools…</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-5 py-3">School</th>
                  <th className="text-left px-5 py-3">Plan</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Instructors</th>
                  <th className="text-left px-5 py-3">Signed up</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleSchools.map((s) => {
                  const status = s.billing?.billing_status ?? "no billing set up";
                  const plan = s.billing?.plan as PlanKey | undefined;
                  const isSuspended = status === "suspended";
                  const isBusy = busyId === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-400">/{s.slug}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{plan ? PLANS[plan].name : "—"}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_TONE[status] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {STATUS_LABEL[status] ?? status}
                        </span>
                        {s.isDormant && (
                          <span className="ml-1.5 text-xs px-2 py-1 rounded-full font-medium bg-slate-800 text-white">
                            Dormant
                          </span>
                        )}
                        {s.billing?.trial_ends_at && status === "trialing" && (
                          <div className="text-xs text-slate-400 mt-1">
                            ends {new Date(s.billing.trial_ends_at).toLocaleDateString()}
                          </div>
                        )}
                        {s.billing?.grace_period_ends_at && status === "grace_period" && (
                          <div className="text-xs text-slate-400 mt-1">
                            grace ends{" "}
                            {new Date(s.billing.grace_period_ends_at).toLocaleDateString()}
                          </div>
                        )}
                        {s.lockedOutSince && (
                          <div className="text-xs text-slate-400 mt-1">
                            locked out since {new Date(s.lockedOutSince).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{s.instructorCount}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            disabled={isBusy}
                            onClick={() => handleExtendTrial(s.id)}
                            className="text-xs border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-50 disabled:opacity-50"
                          >
                            Extend trial
                          </button>
                          <button
                            disabled={isBusy || status === "free_forever"}
                            onClick={() => handleMarkFreeForever(s.id, s.name)}
                            className="text-xs border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-50 disabled:opacity-50"
                          >
                            Free forever
                          </button>
                          {isSuspended ? (
                            <button
                              disabled={isBusy}
                              onClick={() => handleReactivate(s.id, s.name)}
                              className="text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              disabled={isBusy}
                              onClick={() => handleSuspend(s.id, s.name)}
                              className="text-xs text-red-600 border border-red-200 px-2.5 py-1.5 rounded-md hover:bg-red-50 disabled:opacity-50"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            disabled={isBusy}
                            onClick={() => handleDelete(s.id, s.name)}
                            className="text-xs text-red-700 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-md hover:bg-red-100 disabled:opacity-50"
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
