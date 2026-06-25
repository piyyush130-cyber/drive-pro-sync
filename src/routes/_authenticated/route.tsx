import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuthUser, useRoles } from "@/lib/auth";

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
  const roles = rolesQ.data ?? [];
  const isAdmin = roles.includes("admin");
  const isInstructor = roles.includes("instructor");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("school_name")
        .eq("id", 1)
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

  if (loading || rolesQ.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  }

  if (roles.length === 0) {
    return <NoRoleScreen email={user?.email} onSignOut={async () => {
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    }} onRecovered={() => { void rolesQ.refetch(); }} />;
  }

  // Instructor-only view skips the admin sidebar
  if (!isAdmin && isInstructor) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen flex bg-[color:var(--color-mist)]">
      <AppSidebar schoolName={settingsQ.data?.school_name ?? "Standard Driving School"} />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
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
          <button onClick={onSignOut} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
