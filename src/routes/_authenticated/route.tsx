import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuthUser, useRoles } from "@/lib/auth";
import { claimAdminIfFirst } from "@/lib/claim-admin.functions";
import { toast } from "sonner";

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
  const [demoRoleRetrying, setDemoRoleRetrying] = useState(false);
  const [demoRoleRetried, setDemoRoleRetried] = useState(false);
  const roles = rolesQ.data ?? [];
  const isDemoUser = user?.email === "admin@demo.com" || user?.email === "instructor@demo.com";
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

  useEffect(() => {
    if (roles.length === 0 || (!demoRoleRetrying && !demoRoleRetried)) return;
    setDemoRoleRetrying(false);
    setDemoRoleRetried(false);
  }, [roles.length, demoRoleRetrying, demoRoleRetried]);

  useEffect(() => {
    if (roles.length !== 0 || !isDemoUser || demoRoleRetrying || demoRoleRetried) return;
    setDemoRoleRetrying(true);
    const timer = window.setTimeout(() => {
      rolesQ.refetch().finally(() => {
        setDemoRoleRetrying(false);
        setDemoRoleRetried(true);
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [roles.length, isDemoUser, demoRoleRetrying, demoRoleRetried, rolesQ]);

  // Instructor (non-admin) is locked to /instructor
  useEffect(() => {
    if (!loading && !rolesQ.isLoading && !isAdmin && isInstructor && pathname !== "/instructor") {
      navigate({ to: "/instructor", replace: true });
    }
  }, [loading, rolesQ.isLoading, isAdmin, isInstructor, pathname, navigate]);

  if (loading || rolesQ.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  }

  if (roles.length === 0 && isDemoUser && !demoRoleRetried) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  }

  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md card-premium p-8">
          <h1 className="text-xl font-semibold tracking-tight">No role assigned yet</h1>
          <p className="text-sm text-slate-500 mt-2">
            Your account exists but doesn't have a role. Ask the school admin to grant access from
            the Instructors page.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
            className="mt-4 text-sm text-blue-700 underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
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
