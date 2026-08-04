import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CarFront } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });
    // The recovery link may have already been consumed (and the session
    // established) before this listener attached — check directly too.
    supabase.auth.getSession().then(({ data }) => {
      setStatus((s) => (s === "checking" ? (data.session ? "ready" : "invalid") : s));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus("done");
      toast.success("Password updated.");
    } catch (err: any) {
      toast.error(friendlyAuthError(err.message || "Could not update password."));
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
        <div className="flex items-center gap-2.5 mb-2">
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

        {status === "checking" && (
          <p className="text-sm mt-4" style={{ color: "#6B6B7B" }}>
            Verifying your reset link…
          </p>
        )}

        {status === "invalid" && (
          <>
            <h1 className="text-2xl font-semibold mt-3 mb-1" style={{ color: "#1A1A2E" }}>
              This link has expired
            </h1>
            <p className="text-sm mb-6" style={{ color: "#6B6B7B" }}>
              Password reset links are only valid for a short time. Request a new one below.
            </p>
            <Link
              to="/forgot-password"
              className="block w-full text-center rounded-xl py-3 font-semibold text-white transition-all duration-150 hover:brightness-110"
              style={{ background: "linear-gradient(90deg, #1B2B4B, #243660)" }}
            >
              Request a new link
            </Link>
          </>
        )}

        {status === "done" && (
          <>
            <h1 className="text-2xl font-semibold mt-3 mb-1" style={{ color: "#1A1A2E" }}>
              Password updated
            </h1>
            <p className="text-sm mb-6" style={{ color: "#6B6B7B" }}>
              You can now sign in with your new password.
            </p>
            <Link
              to="/auth"
              className="block w-full text-center rounded-xl py-3 font-semibold text-white transition-all duration-150 hover:brightness-110"
              style={{ background: "linear-gradient(90deg, #1B2B4B, #243660)" }}
            >
              Go to login →
            </Link>
          </>
        )}

        {status === "ready" && (
          <>
            <h1 className="text-2xl font-semibold mt-3 mb-1" style={{ color: "#1A1A2E" }}>
              Set a new password
            </h1>
            <p className="text-sm mb-6" style={{ color: "#6B6B7B" }}>
              Choose a new password for your account.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#1A1A2E" }}>
                  New password
                </label>
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#1A1A2E" }}>
                  Confirm new password
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-150"
                  style={{
                    background: "#F5F1EA",
                    border: "1px solid rgba(201,168,76,0.2)",
                    color: "#1A1A2E",
                  }}
                />
              </div>
              <button
                disabled={loading}
                className="w-full rounded-xl py-3 font-semibold text-white transition-all duration-150 hover:brightness-110"
                style={{ background: "linear-gradient(90deg, #1B2B4B, #243660)" }}
              >
                {loading ? "…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
