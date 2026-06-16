import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CarFront } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { seedDemoAccounts } from "@/lib/seed-demo.functions";
import { createAdminRole } from "@/lib/create-admin-role.functions";
import { toast } from "sonner";

async function redirectByRole(navigate: ReturnType<typeof useNavigate>, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("admin")) {
    const { data: s } = await supabase
      .from("school_settings")
      .select("onboarding_complete")
      .eq("id", 1)
      .maybeSingle();
    navigate({ to: s?.onboarding_complete ? "/dashboard" : "/onboarding", replace: true });
  } else if (roles.includes("instructor")) {
    navigate({ to: "/instructor", replace: true });
  } else {
    navigate({ to: "/dashboard", replace: true });
  }
}

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const seed = useServerFn(seedDemoAccounts);
  const assignAdminRole = useServerFn(createAdminRole);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) redirectByRole(navigate, data.session.user.id);
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin + "/onboarding",
          },
        });
        if (error) throw error;
        if (data.user) {
          const result = await assignAdminRole({
            data: { userId: data.user.id, fullName },
          });
          if (result.role === "admin") {
            toast.success("Welcome! Let's set up your school.");
            navigate({ to: "/onboarding", replace: true });
          } else {
            toast.message("Account created. Ask your school admin for access.");
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await redirectByRole(navigate, data.user.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadDemo(role: "admin" | "instructor") {
    setLoading(true);
    try {
      await seed({});
      const demoEmail = role === "admin" ? "admin@demo.com" : "instructor@demo.com";
      const { data, error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: "Demo12345",
      });
      if (error) throw error;
      if (data.user) await redirectByRole(navigate, data.user.id);
    } catch (err: any) {
      toast.error(err.message || "Could not start demo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-bg">
      <div className="glow-blob-tl" />
      <div className="glow-blob-br" />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md glass-card p-8">
          <Link to="/" className="text-xs text-slate-500 hover:text-slate-300">
            ← Back to booking
          </Link>
          <div className="flex items-center gap-2.5 mt-4 mb-4">
            <div className="size-9 rounded-xl bg-[#3B82F6]/20 grid place-items-center">
              <CarFront className="size-4.5 text-[#60A5FA]" />
            </div>
            <div className="text-sm font-semibold text-white">DriveProSync</div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#60A5FA]">
            {mode === "signin" ? "Staff sign in" : "New staff account"}
          </div>
          <h1 className="text-2xl font-semibold text-white mt-1 mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            {mode === "signin"
              ? "Admin & instructor access."
              : "First account becomes the school admin."}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <Field label="Full name">
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="glass-input"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input"
              />
              <p className="text-[11px] text-slate-500 mt-1">Minimum 6 characters.</p>
            </Field>
            <button disabled={loading} className="btn-primary w-full">
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 text-xs text-slate-400 hover:text-white w-full text-center"
          >
            {mode === "signin"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
          <Link
            to="/instructor-signup"
            className="block mt-2 text-xs text-[#60A5FA] hover:text-white w-full text-center"
          >
            Are you an instructor? Create your account with an invite code →
          </Link>

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-500">
            <div className="h-px flex-1 bg-slate-700" />
            or explore a live demo
            <div className="h-px flex-1 bg-slate-700" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => loadDemo("admin")}
              className="btn-secondary text-xs"
            >
              Admin demo
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => loadDemo("instructor")}
              className="btn-secondary text-xs"
            >
              Instructor demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
