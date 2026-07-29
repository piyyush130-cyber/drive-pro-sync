import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth";
import { friendlyAuthError } from "@/lib/auth-errors";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const qc = useQueryClient();
  const { user } = useAuthUser();

  const profileQ = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [resending, setResending] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (profileQ.data) {
      setFullName(profileQ.data.full_name ?? "");
      setPhone(profileQ.data.phone ?? "");
      setEmail(profileQ.data.email ?? user?.email ?? "");
    }
  }, [profileQ.data, user?.email]);

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
      toast.success("Profile updated.");
    } catch (err: any) {
      toast.error(friendlyAuthError(err.message || "Could not update your profile."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveEmail() {
    if (!user) return;
    const trimmed = email.trim();
    if (!trimmed || trimmed === user.email) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      toast.success(
        `Confirmation link sent to ${trimmed}. Your email won't change until you click it.`,
      );
    } catch (err: any) {
      toast.error(friendlyAuthError(err.message || "Could not update your email."));
    } finally {
      setSavingEmail(false);
    }
  }

  async function resendConfirmation() {
    if (!user?.email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) throw error;
      toast.success(`Confirmation email sent to ${user.email}.`);
    } catch (err: any) {
      toast.error(friendlyAuthError(err.message || "Could not resend the confirmation email."));
    } finally {
      setResending(false);
    }
  }

  async function sendPasswordReset() {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success(`Password reset link sent to ${user.email}.`);
    } catch (err: any) {
      toast.error(friendlyAuthError(err.message || "Could not send the reset link."));
    } finally {
      setSendingReset(false);
    }
  }

  if (profileQ.isLoading) {
    return <div className="p-6 lg:p-10 text-slate-500">Loading…</div>;
  }

  if (profileQ.isError) {
    return (
      <div className="p-6 lg:p-10">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Couldn't load your account details.{" "}
          <button onClick={() => profileQ.refetch()} className="font-semibold underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">My account</h1>

      <section className="glass-card p-6 mb-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Profile</h2>
        <Field label="Full name">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="glass-input"
          />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="glass-input" />
        </Field>
        <button disabled={savingProfile} onClick={saveProfile} className="btn-primary text-sm">
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </section>

      <section className="glass-card p-6 mb-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Email</h2>
        <Field label="Email address">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass-input"
          />
        </Field>
        <p className="text-xs text-slate-500">
          Changing your email sends a confirmation link to the new address. Your login email stays
          the same until you confirm it.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={savingEmail || email.trim() === (user?.email ?? "")}
            onClick={saveEmail}
            className="btn-primary text-sm"
          >
            {savingEmail ? "Sending…" : "Update email"}
          </button>
          <button
            disabled={resending}
            onClick={resendConfirmation}
            className="btn-secondary text-sm"
          >
            {resending ? "Sending…" : "Resend confirmation email"}
          </button>
        </div>
      </section>

      <section className="glass-card p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Password</h2>
        <p className="text-xs text-slate-500">
          We'll email you a secure link to set a new password.
        </p>
        <button
          disabled={sendingReset}
          onClick={sendPasswordReset}
          className="btn-secondary text-sm"
        >
          {sendingReset ? "Sending…" : "Send password reset link"}
        </button>
      </section>

      <Link
        to="/dashboard"
        className="inline-block mt-6 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Back
      </Link>
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
