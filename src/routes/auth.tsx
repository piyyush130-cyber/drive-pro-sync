import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CarFront } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { seedDemoAccounts } from "@/lib/seed-demo.functions";
import { createAdminRole } from "@/lib/create-admin-role.functions";
import { recordPolicyAcceptance } from "@/lib/legal.functions";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

async function redirectByRole(_navigate: ReturnType<typeof useNavigate>, userId: string) {
  const { data: isOwner } = await supabase.rpc("is_platform_owner", { _user_id: userId });
  if (isOwner) {
    window.location.href = "/owner";
    return;
  }
  const { data } = await supabase.from("user_roles").select("role,school_id").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("admin")) {
    const schoolId = (data ?? []).find((r) => r.role === "admin")?.school_id;
    // Check onboarding state — incomplete admins go to setup.
    const { data: settings } = await supabase
      .from("school_settings")
      .select("onboarding_complete")
      .eq("school_id", schoolId)
      .maybeSingle();
    window.location.href = settings?.onboarding_complete ? "/dashboard" : "/onboarding";
  } else if (roles.includes("instructor")) {
    window.location.href = "/instructor";
  } else {
    window.location.href = "/no-access";
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signin" | "signup" } => ({
    mode: search.mode === "signup" ? "signup" : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const seed = useServerFn(seedDemoAccounts);
  const assignAdminRole = useServerFn(createAdminRole);
  const acceptPolicies = useServerFn(recordPolicyAcceptance);

  async function resendConfirmation() {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: unconfirmedEmail });
      if (error) throw error;
      toast.success(`Confirmation email sent to ${unconfirmedEmail}.`);
    } catch (err: any) {
      toast.error(friendlyAuthError(err.message || "Could not resend the confirmation email."));
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !agreedToPolicies) {
      toast.error("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setUnconfirmedEmail(null);
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
            data: { userId: data.user.id, fullName, schoolName },
          });
          await acceptPolicies({ data: { userId: data.user.id } });
          toast.success("Welcome! Let's set up your school.");
          window.location.href = "/onboarding";
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await redirectByRole(navigate, data.user.id);
      }
    } catch (err: any) {
      const message = err.message || "Authentication failed";
      if (mode === "signin" && message.toLowerCase().includes("email not confirmed")) {
        setUnconfirmedEmail(email);
      }
      toast.error(friendlyAuthError(message));
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
          ← Back to home
        </Link>
        <div className="flex items-center gap-2.5 mt-4 mb-2">
          <div
            className="size-9 rounded-xl grid place-items-center"
            style={{ background: "#1B2B4B" }}
          >
            <CarFront className="size-4.5 text-white" />
          </div>
          <div className="text-xl font-bold" style={{ color: "#1B2B4B" }}>
            DrivingOps
          </div>
        </div>
        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#C9A84C" }}>
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
        {unconfirmedEmail && (
          <div
            className="mb-4 rounded-xl p-4 text-sm"
            style={{
              background: "rgba(201,168,76,0.1)",
              border: "1px solid rgba(201,168,76,0.3)",
              color: "#1A1A2E",
            }}
          >
            Your email isn't confirmed yet. Check your inbox for the link, or{" "}
            <button
              type="button"
              disabled={resending}
              onClick={resendConfirmation}
              className="font-semibold underline"
            >
              {resending ? "sending…" : "resend the confirmation email"}
            </button>
            .
          </div>
        )}
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
          {mode === "signup" && (
            <Field label="School name">
              <input
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. Winnipeg Pro Driving School"
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
            {mode === "signin" && (
              <Link
                to="/forgot-password"
                className="mt-1.5 inline-block text-xs hover:underline"
                style={{ color: "#1B2B4B" }}
              >
                Forgot password?
              </Link>
            )}
          </Field>
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-xs" style={{ color: "#6B6B7B" }}>
              <Checkbox
                checked={agreedToPolicies}
                onCheckedChange={(v) => setAgreedToPolicies(v === true)}
                className="mt-0.5"
              />
              <span>
                I agree to the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#1B2B4B", textDecoration: "underline" }}
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#1B2B4B", textDecoration: "underline" }}
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
          )}
          <button
            disabled={loading || (mode === "signup" && !agreedToPolicies)}
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
          className="mt-5 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors duration-150"
          style={{ border: "1px solid rgba(27,43,75,0.25)", color: "#1B2B4B" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(27,43,75,0.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {mode === "signin" ? "Create an account" : "Already have an account? Sign in"}
        </button>

        <div className="mt-5 flex items-center justify-center gap-4 text-xs">
          <Link
            to="/instructor-signup"
            className="hover:underline"
            style={{ color: "#6B6B7B" }}
          >
            Instructor invite code
          </Link>
          <span style={{ color: "rgba(201,168,76,0.4)" }}>·</span>
          <button
            type="button"
            disabled={loading}
            onClick={() => loadDemo("admin")}
            className="hover:underline"
            style={{ color: "#6B6B7B" }}
          >
            Try admin demo
          </button>
          <span style={{ color: "rgba(201,168,76,0.4)" }}>·</span>
          <button
            type="button"
            disabled={loading}
            onClick={() => loadDemo("instructor")}
            className="hover:underline"
            style={{ color: "#6B6B7B" }}
          >
            Try instructor demo
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
