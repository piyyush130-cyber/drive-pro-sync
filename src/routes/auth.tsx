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
    window.location.href = "/dashboard";
  } else if (roles.includes("instructor")) {
    window.location.href = "/instructor";
  } else {
    window.location.href = "/dashboard";
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
          await assignAdminRole({
            data: { userId: data.user.id, fullName, schoolName: "" },
          });
          toast.success("Welcome! Let's set up your school.");
          navigate({ to: "/onboarding", replace: true });
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
    <div
      className="relative min-h-screen flex items-center justify-center p-4 py-12"
      style={{ background: "linear-gradient(135deg, #EDE8DF 0%, #E4DDD0 40%, #EAE4D8 100%)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-10"
        style={{
          background: "#FAF8F4",
          border: "1px solid rgba(201,168,76,0.2)",
          boxShadow: "0 8px 40px rgba(27,43,75,0.12)",
        }}
      >
        <Link
          to="/"
          className="text-xs"
          style={{ color: "#6B6B7B" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1B2B4B")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6B6B7B")}
        >
          ← Back to booking
        </Link>
        <div className="flex items-center gap-2.5 mt-4 mb-2">
          <div
            className="size-9 rounded-xl grid place-items-center"
            style={{ background: "#1B2B4B" }}
          >
            <CarFront className="size-4.5 text-white" />
          </div>
          <div className="text-xl font-bold" style={{ color: "#1B2B4B" }}>
            DriveProSync
          </div>
        </div>
        <div
          className="text-xs uppercase tracking-widest mb-1"
          style={{ color: "#C9A84C" }}
        >
          Staff Portal
        </div>
        <h1 className="text-2xl font-semibold mt-1 mb-1" style={{ color: "#1A1A2E" }}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm mb-6" style={{ color: "#6B6B7B" }}>
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
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-150"
                style={{
                  background: "#F5F1EA",
                  border: "1px solid rgba(201,168,76,0.2)",
                  color: "#1A1A2E",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#1B2B4B";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(27,43,75,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(201,168,76,0.2)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </Field>
          )}
          <Field label="Email">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-150"
              style={{
                background: "#F5F1EA",
                border: "1px solid rgba(201,168,76,0.2)",
                color: "#1A1A2E",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#1B2B4B";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(27,43,75,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(201,168,76,0.2)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </Field>
          <Field label="Password">
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-150"
              style={{
                background: "#F5F1EA",
                border: "1px solid rgba(201,168,76,0.2)",
                color: "#1A1A2E",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#1B2B4B";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(27,43,75,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(201,168,76,0.2)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <p className="text-[11px] mt-1" style={{ color: "#6B6B7B" }}>
              Minimum 6 characters.
            </p>
          </Field>
          <button
            disabled={loading}
            className="w-full rounded-xl py-3 font-semibold text-white transition-all duration-150 hover:brightness-110"
            style={{
              background: "linear-gradient(90deg, #1B2B4B, #243660)",
            }}
          >
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-xs w-full text-center transition-colors duration-150"
          style={{ color: "#C9A84C" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1B2B4B")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#C9A84C")}
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
        <Link
          to="/instructor-signup"
          className="block mt-2 text-xs w-full text-center transition-colors duration-150 hover:underline"
          style={{ color: "#1B2B4B" }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = "#C9A84C")}
        >
          Are you an instructor? Create your account with an invite code →
        </Link>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: "rgba(201,168,76,0.3)" }} />
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "#C9A84C" }}
          >
            or explore a live demo
          </span>
          <div className="h-px flex-1" style={{ background: "rgba(201,168,76,0.3)" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => loadDemo("admin")}
            className="rounded-xl py-2.5 text-xs font-semibold transition-all duration-150"
            style={{
              background: "#F0EBE1",
              border: "1px solid rgba(201,168,76,0.3)",
              color: "#1B2B4B",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1B2B4B";
              e.currentTarget.style.color = "#FFFFFF";
              e.currentTarget.style.borderColor = "#C9A84C";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#F0EBE1";
              e.currentTarget.style.color = "#1B2B4B";
              e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)";
            }}
          >
            Admin demo
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => loadDemo("instructor")}
            className="rounded-xl py-2.5 text-xs font-semibold transition-all duration-150"
            style={{
              background: "#F0EBE1",
              border: "1px solid rgba(201,168,76,0.3)",
              color: "#1B2B4B",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1B2B4B";
              e.currentTarget.style.color = "#FFFFFF";
              e.currentTarget.style.borderColor = "#C9A84C";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#F0EBE1";
              e.currentTarget.style.color = "#1B2B4B";
              e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)";
            }}
          >
            Instructor demo
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "#1A1A2E" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
