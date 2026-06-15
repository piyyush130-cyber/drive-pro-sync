import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CarFront } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { seedDemoAccounts } from "@/lib/seed-demo.functions";
import { toast } from "sonner";

async function redirectByRole(navigate: ReturnType<typeof useNavigate>, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("admin")) navigate({ to: "/dashboard", replace: true });
  else if (roles.includes("instructor")) navigate({ to: "/instructor", replace: true });
  else navigate({ to: "/dashboard", replace: true });
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
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
            emailRedirectTo: window.location.origin + "/dashboard",
          },
        });
        if (error) throw error;
        if (data.user) {
          const { count } = await supabase
            .from("user_roles")
            .select("*", { count: "exact", head: true });
          if ((count ?? 0) === 0) {
            await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
            toast.success("Welcome! You're the school admin.");
          } else {
            toast.success("Account created. Ask the admin to assign your role.");
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="hidden lg:flex brand-gradient brand-grid-bg text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-white/10 ring-1 ring-white/15 grid place-items-center">
            <CarFront className="size-4.5 text-blue-300" />
          </div>
          <div className="text-sm font-semibold tracking-tight">DriveProSync</div>
        </div>
        <div>
          <div className="eyebrow text-blue-300">Operations Console</div>
          <h2 className="text-3xl xl:text-4xl font-semibold tracking-tight mt-3 max-w-[24ch] text-balance">
            Run the dispatch board, not the inbox.
          </h2>
          <p className="text-slate-300 mt-4 max-w-[42ch]">
            Bookings, pickups, instructor scheduling, and payments — all in one premium control
            center built for small driving schools.
          </p>
        </div>
        <div className="text-xs text-slate-400">© DriveProSync</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 bg-[color:var(--color-mist)]">
        <div className="w-full max-w-sm card-premium p-8">
          <Link to="/" className="text-xs text-slate-500 hover:text-slate-900">
            ← Back to booking
          </Link>
          <div className="eyebrow text-blue-700 mt-3">
            {mode === "signin" ? "Staff sign in" : "New staff account"}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-slate-500 mb-6">
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
                  className="input-premium"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-premium"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-premium"
              />
            </Field>
            <button disabled={loading} className="btn-primary w-full">
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 text-xs text-slate-500 hover:text-slate-900 w-full text-center"
          >
            {mode === "signin"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
