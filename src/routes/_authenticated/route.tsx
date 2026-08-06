import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import {
  useAuthUser,
  useRoles,
  useSchoolId,
  useLatestPolicyAcceptance,
  useSchoolBilling,
} from "@/lib/auth";
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal";
import { recordPolicyAcceptance } from "@/lib/legal.functions";
import { createBillingPortalSession } from "@/lib/billing.functions";
import { PlanPicker } from "@/components/PlanPicker";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const rolesQ = useRoles(user?.id);
  const schoolIdQ = useSchoolId(user?.id);
  const acceptanceQ = useLatestPolicyAcceptance(user?.id);
  const billingQ = useSchoolBilling(schoolIdQ.data);
  const roles = rolesQ.data ?? [];
  const isAdmin = roles.includes("admin");
  const isInstructor = roles.includes("instructor");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settingsQ = useQuery({
    queryKey: ["settings", schoolIdQ.data],
    enabled: !!schoolIdQ.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("school_name")
        .eq("school_id", schoolIdQ.data as string)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  // Instructor (non-admin) is locked to /instructor
  useEffect(() => {
    if (!loading && !rolesQ.isLoading && !isAdmin && isInstructor && pathname !== "/instructor") {
      navigate({ to: "/instructor", replace: true });
    }
  }, [loading, rolesQ.isLoading, isAdmin, isInstructor, pathname, navigate]);

  if (loading || rolesQ.isLoading || acceptanceQ.isLoading || billingQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>
    );
  }

  if (roles.length === 0) {
    return (
      <NoRoleScreen
        email={user?.email}
        onSignOut={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
        }}
        onRecovered={() => {
          void rolesQ.refetch();
        }}
      />
    );
  }

  const hasCurrentTerms = acceptanceQ.data?.some(
    (a) => a.policy_type === "terms_of_service" && a.version === CURRENT_TERMS_VERSION,
  );
  const hasCurrentPrivacy = acceptanceQ.data?.some(
    (a) => a.policy_type === "privacy_policy" && a.version === CURRENT_PRIVACY_VERSION,
  );

  if (user && (!hasCurrentTerms || !hasCurrentPrivacy)) {
    return <AcceptPoliciesScreen userId={user.id} onAccepted={() => acceptanceQ.refetch()} />;
  }

  // free_forever is structurally exempt from every billing check below.
  const billing = billingQ.data;
  const isFreeForever = billing?.billing_status === "free_forever";
  const isSuspended = billing?.billing_status === "suspended";
  const isCanceled = billing?.billing_status === "locked";
  const gracePastDue =
    billing?.billing_status === "grace_period" &&
    !!billing.grace_period_ends_at &&
    new Date(billing.grace_period_ends_at) < new Date();
  const inGracePeriod = billing?.billing_status === "grace_period" && !gracePastDue;
  const needsPlan = !!schoolIdQ.data && !billingQ.isLoading && !billing;

  if (!isFreeForever && isSuspended) {
    return <SuspendedScreen />;
  }
  if (!isFreeForever && (isCanceled || gracePastDue)) {
    return <BillingLockedScreen isAdmin={isAdmin} pastDue={gracePastDue} />;
  }
  if (!isFreeForever && needsPlan) {
    return <NeedsPlanScreen isAdmin={isAdmin} />;
  }

  const graceBanner = inGracePeriod && billing?.grace_period_ends_at && (
    <GracePeriodBanner isAdmin={isAdmin} gracePeriodEndsAt={billing.grace_period_ends_at} />
  );

  // Instructor-only view skips the admin sidebar
  if (!isAdmin && isInstructor) {
    return (
      <>
        {graceBanner}
        <Outlet />
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-[color:var(--color-mist)]">
      <AppSidebar schoolName={settingsQ.data?.school_name ?? "Standard Driving School"} />
      <main className="relative flex-1 min-w-0">
        <div className="ambient-glow" />
        <div className="relative">
          {graceBanner}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function AcceptPoliciesScreen({ userId, onAccepted }: { userId: string; onAccepted: () => void }) {
  const acceptPolicies = useServerFn(recordPolicyAcceptance);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleAccept() {
    setBusy(true);
    try {
      await acceptPolicies({ data: { userId } });
      onAccepted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-50">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Our Terms of Service and Privacy Policy have been updated
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Please review the updated policies and accept them to continue using DrivingOps.
        </p>
        <div className="mt-4 flex flex-col gap-1 text-sm">
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            Read the Terms of Service →
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            Read the Privacy Policy →
          </a>
        </div>
        <label className="flex items-start gap-2 mt-5 text-xs text-left text-slate-600">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            className="mt-0.5"
          />
          <span>I have reviewed and agree to the updated Terms of Service and Privacy Policy.</span>
        </label>
        <button
          disabled={!agreed || busy}
          onClick={handleAccept}
          className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "I agree — continue"}
        </button>
      </div>
    </div>
  );
}

function NoRoleScreen({
  email,
  onSignOut,
  onRecovered,
}: {
  email: string | undefined | null;
  onSignOut: () => void;
  onRecovered: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-50">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">No access yet</h1>
        <p className="text-sm text-slate-500 mt-2">
          This account does not have access yet. Ask the school admin to assign a role.
        </p>
        {email && <p className="mt-3 text-xs text-slate-400">Signed in as {email}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onRecovered} className="text-xs text-slate-500 hover:text-slate-700">
            Refresh access
          </button>
          <button
            onClick={onSignOut}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function GracePeriodBanner({
  isAdmin,
  gracePeriodEndsAt,
}: {
  isAdmin: boolean;
  gracePeriodEndsAt: string;
}) {
  const hoursLeft = (new Date(gracePeriodEndsAt).getTime() - Date.now()) / 3600000;
  const daysLeft = Math.max(0, Math.ceil(hoursLeft / 24));
  const urgent = hoursLeft <= 24;
  return (
    <div
      className={`px-4 py-2.5 text-sm text-center font-medium ${
        urgent ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"
      }`}
    >
      We couldn't process your payment.{" "}
      {isAdmin ? (
        <>
          Update your payment method within {daysLeft} day{daysLeft === 1 ? "" : "s"} to avoid
          losing access —{" "}
          <a href="/settings" className="underline font-semibold">
            fix billing now
          </a>
          .
        </>
      ) : (
        <>
          Your admin needs to update the school's payment method within {daysLeft} day
          {daysLeft === 1 ? "" : "s"}.
        </>
      )}
    </div>
  );
}

function BillingLockedScreen({ isAdmin, pastDue }: { isAdmin: boolean; pastDue: boolean }) {
  const openPortal = useServerFn(createBillingPortalSession);
  const [busy, setBusy] = useState(false);

  async function manageBilling() {
    setBusy(true);
    try {
      const { url } = await openPortal({});
      window.location.href = url;
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-50">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {pastDue ? "Payment needed to continue" : "Subscription inactive"}
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {pastDue
            ? "Your payment couldn't be processed and the grace period has ended. Your data is safe — nothing has been deleted."
            : "Your subscription is no longer active. Your data is safe — nothing has been deleted."}
        </p>
        {isAdmin ? (
          pastDue ? (
            <button
              onClick={manageBilling}
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Opening…" : "Update payment method"}
            </button>
          ) : (
            <div className="mt-5 text-left">
              <PlanPicker ctaLabel="Resubscribe" variant="light" />
            </div>
          )
        ) : (
          <p className="mt-4 text-xs text-slate-400">Ask your school admin to update billing.</p>
        )}
      </div>
    </div>
  );
}

function NeedsPlanScreen({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-50">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Choose a plan to continue
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {isAdmin
            ? "Pick a plan to start your 14-day free trial."
            : "Your school admin needs to finish setting up billing before you can continue."}
        </p>
        {isAdmin && (
          <div className="mt-5 text-left">
            <PlanPicker variant="light" />
          </div>
        )}
      </div>
    </div>
  );
}

function SuspendedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-50">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Account suspended</h1>
        <p className="text-sm text-slate-500 mt-2">
          This account has been suspended. Your data is safe — nothing has been deleted. Contact
          support if you believe this is a mistake.
        </p>
      </div>
    </div>
  );
}
