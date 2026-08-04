import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CarFront } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
    } catch (err: any) {
      // Don't leak whether the email exists — show the same success state either way.
      console.error("[forgot-password]", err);
    } finally {
      setLoading(false);
      setSent(true);
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
        <Link to="/auth" className="text-xs" style={{ color: "#6B6B7B" }}>
          ← Back to login
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

        {sent ? (
          <>
            <h1 className="text-2xl font-semibold mt-3 mb-1" style={{ color: "#1A1A2E" }}>
              Check your email
            </h1>
            <p className="text-sm" style={{ color: "#6B6B7B" }}>
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your
              password. It may take a minute to arrive — check your spam folder too.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mt-1 mb-1" style={{ color: "#1A1A2E" }}>
              Reset your password
            </h1>
            <p className="text-sm mb-6" style={{ color: "#6B6B7B" }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#1A1A2E" }}>
                  Email
                </label>
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
                />
              </div>
              <button
                disabled={loading}
                className="w-full rounded-xl py-3 font-semibold text-white transition-all duration-150 hover:brightness-110"
                style={{ background: "linear-gradient(90deg, #1B2B4B, #243660)" }}
              >
                {loading ? "…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
