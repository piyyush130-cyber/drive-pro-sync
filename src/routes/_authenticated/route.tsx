import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
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

  if (loading || rolesQ.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">Loading...</div>;
  }

  const roles = rolesQ.data ?? [];
  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-medium">No role assigned yet</h1>
          <p className="text-sm text-zinc-500 mt-2">
            Your account exists but doesn't have a role. Ask the school admin to grant access from
            the Instructors page.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
            className="mt-4 text-sm text-emerald-800 underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-zinc-100">
      <AppSidebar schoolName={settingsQ.data?.school_name ?? "Driving School"} />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
