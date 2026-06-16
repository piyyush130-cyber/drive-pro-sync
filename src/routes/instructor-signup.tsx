import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CarFront, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useInviteCode } from "@/lib/invite-code.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/instructor-signup")({
  component: InstructorSignupPage,
});

function InstructorSignupPage() {
  const navigate = useNavigate();
  const claim = useServerFn(useInviteCode);
  const [form, setForm] = useState({ code: "", fullName: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.fullName } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Signup failed");
      await claim({
        data: {
          code: form.code,
          userId: data.user.id,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
        },
      });
      await supabase.auth.signOut();
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-bg">
      <div className="glow-blob-tl" />
      <div className="glow-blob-br" />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="glass-card w-full max-w-md p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="size-9 rounded-xl bg-[#3B82F6]/20 grid place-items-center">
              <CarFront className="size-4.5 text-[#60A5FA]" />
            </div>
            <div className="text-sm font-semibold text-white">DriveProSync</div>
          </div>

          {done ? (
            <div className="text-center py-6">
              <div className="size-14 rounded-full bg-green-500/15 grid place-items-center mx-auto mb-4">
                <Check className="size-7 text-green-400" />
              </div>
              <h1 className="text-2xl font-semibold text-white mb-2">You're in!</h1>
              <p className="text-sm text-slate-400 mb-6">
                Your account is created. You can now log in and access your lesson schedule.
              </p>
              <button onClick={() => navigate({ to: "/auth" })} className="btn-primary w-full">
                Go to login →
              </button>
            </div>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#60A5FA] mb-2">Instructor signup</div>
              <h1 className="text-2xl font-semibold text-white">Join your driving school</h1>
              <p className="text-sm text-slate-400 mb-6">Enter the invite code your school admin gave you.</p>
              <form onSubmit={submit} className="space-y-4">
                <Field label="Invite code *">
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="DRIVE-XXXXXX"
                    className="glass-input font-mono tracking-wider"
                  />
                </Field>
                <Field label="Full name *">
                  <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="glass-input" />
                </Field>
                <Field label="Email *">
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="glass-input" />
                </Field>
                <Field label="Phone">
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="glass-input" />
                </Field>
                <Field label="Password *">
                  <input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="glass-input" />
                </Field>
                <button disabled={busy} className="btn-primary w-full">{busy ? "Creating…" : "Create account"}</button>
              </form>
              <Link to="/auth" className="block text-center mt-4 text-xs text-slate-500 hover:text-slate-300">
                ← Back to login
              </Link>
            </>
          )}
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
