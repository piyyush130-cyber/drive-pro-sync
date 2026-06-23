import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Key, ArrowRight, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

const PROVINCES = ["BC", "AB", "SK", "MB", "ON", "QC", "NB", "NS", "PE", "NL", "YT", "NT", "NU"];
const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];
const TIMES = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 22; h++)
    for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
  return out;
})();
const DEFAULT_TYPES = [
  { name: "1 Hour Lesson", duration_minutes: 60, price_cents: 6500, active: true },
  { name: "1.5 Hour Lesson", duration_minutes: 90, price_cents: 9500, active: true },
  { name: "2 Hour Lesson", duration_minutes: 120, price_cents: 12000, active: true },
  { name: "Road Test Package", duration_minutes: 90, price_cents: 18000, active: true },
  { name: "Custom Package", duration_minutes: 60, price_cents: 0, active: true },
];
const DEFAULT_AVAIL = DAYS.reduce<Record<string, { enabled: boolean; start: string; end: string }>>(
  (acc, d) => {
    const wk = !["saturday", "sunday"].includes(d.key);
    acc[d.key] = { enabled: wk, start: "09:00", end: "17:00" };
    return acc;
  },
  {},
);

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuthUser();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [school, setSchool] = useState({
    school_name: "",
    city: "",
    province: "MB",
    contact_phone: "",
    contact_email: "",
    service_area: "",
  });
  // Step 2
  const [rules, setRules] = useState({
    cancellation_notice_hours: 24,
    cancellation_fee_cents: 5000,
    deposit_required: true,
    deposit_cents: 5000,
    require_approval: true,
  });
  // Step 3
  const [types, setTypes] = useState(DEFAULT_TYPES);
  // Step 4
  const [instructor, setInstructor] = useState({ full_name: "", email: "", phone: "" });
  const [instructorId, setInstructorId] = useState<string | null>(null);
  // Step 5
  const [avail, setAvail] = useState(DEFAULT_AVAIL);
  // Step 6
  const [copied, setCopied] = useState(false);
  const bookingUrl = typeof window !== "undefined" ? window.location.origin + "/" : "";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    supabase
      .from("school_settings")
      .select("onboarding_complete,school_name")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarding_complete) navigate({ to: "/dashboard", replace: true });
        if (data?.school_name && data.school_name !== "My Driving School")
          setSchool((s) => ({ ...s, school_name: data.school_name }));
      });
  }, [loading, user, navigate]);

  async function saveStep1() {
    if (!school.school_name || !school.city || !school.province) {
      toast.error("School name, city, and province are required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("school_settings").update(school).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    setStep(2);
  }
  async function saveStep2() {
    setBusy(true);
    const { error } = await supabase.from("school_settings").update(rules).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    setStep(3);
  }
  async function saveStep3() {
    setBusy(true);
    try {
      // Deactivate any types not in the new list (by name), then upsert the new set.
      const names = types.filter((t) => t.name).map((t) => t.name);
      const { data: existing } = await supabase.from("lesson_types").select("id,name");
      const toDeactivate = (existing ?? []).filter((e) => !names.includes(e.name));
      for (const row of toDeactivate) {
        await supabase.from("lesson_types").update({ active: false }).eq("id", row.id);
      }
      for (let i = 0; i < types.length; i++) {
        const t = types[i];
        if (!t.name) continue;
        const match = (existing ?? []).find((e) => e.name === t.name);
        const payload = {
          name: t.name,
          duration_minutes: t.duration_minutes,
          price_cents: t.price_cents,
          active: t.active,
          sort_order: i,
          category: "lesson",
        };
        if (match) {
          await supabase.from("lesson_types").update(payload).eq("id", match.id);
        } else {
          await supabase.from("lesson_types").insert(payload);
        }
      }
      setStep(4);
    } catch (err: any) {
      toast.error(err?.message || "Could not save services");
    } finally {
      setBusy(false);
    }
  }
  async function saveStep4() {
    if (!instructor.full_name) {
      toast.error("Instructor name is required");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("instructors")
      .insert({
        full_name: instructor.full_name,
        email: instructor.email || null,
        phone: instructor.phone || null,
        active: true,
      })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setInstructorId(data.id);
    setStep(5);
  }
  async function saveStep5() {
    if (!instructorId) {
      setStep(6);
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("instructors")
      .update({ weekly_availability: avail })
      .eq("id", instructorId);
    setBusy(false);
    if (error) return toast.error(error.message);
    setStep(6);
  }
  async function finish() {
    setBusy(true);
    await supabase.from("school_settings").update({ onboarding_complete: true }).eq("id", 1);
    setBusy(false);
    window.location.href = "/dashboard";
  }

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return null;

  return (
    <div className="glass-bg">
      <div className="glow-blob-tl" />
      <div className="glow-blob-br" />
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-start py-12 px-4">
        <StepDots step={step} />
        <div className="glass-card w-full max-w-[560px] p-8 mt-8">
          {step === 1 && (
            <Step title="Tell us about your school" subtitle="This appears on your booking page and student communications.">
              <Input label="School name" required value={school.school_name} onChange={(v) => setSchool({ ...school, school_name: v })} placeholder="e.g. Winnipeg Pro Driving School" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" required value={school.city} onChange={(v) => setSchool({ ...school, city: v })} placeholder="e.g. Winnipeg" />
                <div>
                  <Label>Province *</Label>
                  <select className="glass-input" value={school.province} onChange={(e) => setSchool({ ...school, province: e.target.value })}>
                    {PROVINCES.map((p) => <option key={p} value={p} className="bg-[#0D1424]">{p}</option>)}
                  </select>
                </div>
              </div>
              <Input label="Contact phone" value={school.contact_phone} onChange={(v) => setSchool({ ...school, contact_phone: v })} placeholder="(204) 555-0100" />
              <Input label="Contact email" value={school.contact_email} onChange={(v) => setSchool({ ...school, contact_email: v })} placeholder="hello@yourschool.ca" />
              <Input label="Service area" value={school.service_area} onChange={(v) => setSchool({ ...school, service_area: v })} placeholder="Within 15km of downtown Winnipeg" />
              <NextRow onNext={saveStep1} busy={busy} />
            </Step>
          )}

          {step === 2 && (
            <Step title="Set your booking rules" subtitle="These protect your time and set expectations with students.">
              <div>
                <Label>Cancellation notice required</Label>
                <select className="glass-input" value={rules.cancellation_notice_hours} onChange={(e) => setRules({ ...rules, cancellation_notice_hours: Number(e.target.value) })}>
                  <option value={12} className="bg-[#0D1424]">12 hours</option>
                  <option value={24} className="bg-[#0D1424]">24 hours</option>
                  <option value={48} className="bg-[#0D1424]">48 hours</option>
                </select>
              </div>
              <Input label="Cancellation fee" prefix="$" type="number" value={String(rules.cancellation_fee_cents / 100)} onChange={(v) => setRules({ ...rules, cancellation_fee_cents: Math.round(Number(v) * 100) })} />
              <Toggle label="Require deposit at booking" checked={rules.deposit_required} onChange={(c) => setRules({ ...rules, deposit_required: c })} />
              {rules.deposit_required && (
                <Input label="Deposit amount" prefix="$" type="number" value={String(rules.deposit_cents / 100)} onChange={(v) => setRules({ ...rules, deposit_cents: Math.round(Number(v) * 100) })} />
              )}
              <div>
                <Label>Booking approval</Label>
                <div className="space-y-2">
                  <RadioRow checked={!rules.require_approval} onChange={() => setRules({ ...rules, require_approval: false })} title="Auto-confirm bookings" desc="Booking confirmed instantly" />
                  <RadioRow checked={rules.require_approval} onChange={() => setRules({ ...rules, require_approval: true })} title="Manual review" desc="Admin approves each booking" />
                </div>
              </div>
              <NextRow onBack={() => setStep(1)} onNext={saveStep2} busy={busy} />
            </Step>
          )}

          {step === 3 && (
            <Step title="Your lesson packages" subtitle="Edit the defaults or keep them. You can always change these later.">
              <div className="space-y-2">
                {types.map((t, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input className="glass-input col-span-5 text-sm" value={t.name} onChange={(e) => { const c = [...types]; c[i] = { ...t, name: e.target.value }; setTypes(c); }} />
                    <select className="glass-input col-span-3 text-sm" value={t.duration_minutes} onChange={(e) => { const c = [...types]; c[i] = { ...t, duration_minutes: Number(e.target.value) }; setTypes(c); }}>
                      {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m} className="bg-[#0D1424]">{m} min</option>)}
                    </select>
                    <input type="number" className="glass-input col-span-3 text-sm" value={t.price_cents / 100} onChange={(e) => { const c = [...types]; c[i] = { ...t, price_cents: Math.round(Number(e.target.value) * 100) }; setTypes(c); }} />
                    <button onClick={() => setTypes(types.filter((_, x) => x !== i))} className="col-span-1 text-slate-400 hover:text-red-400"><Trash2 className="size-4 mx-auto" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setTypes([...types, { name: "", duration_minutes: 60, price_cents: 0, active: true }])} className="btn-secondary text-sm w-full"><Plus className="size-4" /> Add another service</button>
              <NextRow onBack={() => setStep(2)} onNext={saveStep3} busy={busy} />
            </Step>
          )}

          {step === 4 && (
            <Step title="Add your first instructor" subtitle="You can add more anytime from the Instructors page.">
              <Input label="Full name" required value={instructor.full_name} onChange={(v) => setInstructor({ ...instructor, full_name: v })} />
              <Input label="Email" value={instructor.email} onChange={(v) => setInstructor({ ...instructor, email: v })} />
              <Input label="Phone" value={instructor.phone} onChange={(v) => setInstructor({ ...instructor, phone: v })} />
              <div className="glass-card p-4 flex gap-3 items-start" style={{ borderRadius: 14 }}>
                <Key className="size-5 text-[#60A5FA] shrink-0 mt-0.5" />
                <p className="text-sm text-slate-300">After setup, your instructor invite code will be shown in the Instructors section. Share it with your instructors so they can create their login.</p>
              </div>
              <NextRow onBack={() => setStep(3)} onNext={saveStep4} busy={busy} />
            </Step>
          )}

          {step === 5 && (
            <Step title={`When does ${instructor.full_name || "your instructor"} work?`} subtitle="Set their regular weekly schedule. They can request changes later.">
              <div className="space-y-2">
                {DAYS.map((d) => {
                  const v = avail[d.key];
                  return (
                    <div key={d.key} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 w-32 text-sm">
                        <input type="checkbox" checked={v.enabled} onChange={(e) => setAvail({ ...avail, [d.key]: { ...v, enabled: e.target.checked } })} className="accent-[#3B82F6]" />
                        {d.label}
                      </label>
                      {v.enabled ? (
                        <>
                          <select className="glass-input flex-1 text-sm" value={v.start} onChange={(e) => setAvail({ ...avail, [d.key]: { ...v, start: e.target.value } })}>
                            {TIMES.map((t) => <option key={t} value={t} className="bg-[#0D1424]">{t}</option>)}
                          </select>
                          <span className="text-slate-500 text-xs">to</span>
                          <select className="glass-input flex-1 text-sm" value={v.end} onChange={(e) => setAvail({ ...avail, [d.key]: { ...v, end: e.target.value } })}>
                            {TIMES.map((t) => <option key={t} value={t} className="bg-[#0D1424]">{t}</option>)}
                          </select>
                        </>
                      ) : (
                        <span className="text-slate-500 text-xs flex-1">Off</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <NextRow onBack={() => setStep(4)} onNext={saveStep5} busy={busy} />
            </Step>
          )}

          {step === 6 && (
            <Step title="Your school is live!" subtitle="DriveProSync is ready. Here's your public booking link.">
              <div className="glass-card p-5" style={{ borderRadius: 14 }}>
                <div className="text-[10px] uppercase tracking-widest text-[#60A5FA] mb-2">Public booking link</div>
                <div className="font-mono text-sm text-white break-all mb-4">{bookingUrl}</div>
                <div className="flex gap-2">
                  <button onClick={copyLink} className="btn-secondary text-sm flex-1">
                    {copied ? <><Check className="size-4" /> Copied!</> : <><Copy className="size-4" /> Copy link</>}
                  </button>
                  <a href={bookingUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm flex-1">
                    <ExternalLink className="size-4" /> Preview
                  </a>
                </div>
              </div>
              <button onClick={finish} disabled={busy} className="btn-primary w-full">
                Open my dashboard <ArrowRight className="size-4" />
              </button>
            </Step>
          )}
        </div>
        <Link to="/dashboard" className="text-xs text-slate-500 hover:text-slate-300 mt-6">
          Skip for now
        </Link>
      </div>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5, 6].map((i, idx) => (
        <div key={i} className="flex items-center">
          <div
            className={`size-7 rounded-full grid place-items-center text-xs font-semibold border ${
              i < step
                ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                : i === step
                  ? "bg-[#3B82F6] border-[#3B82F6] text-white ring-4 ring-[#3B82F6]/20"
                  : "bg-transparent border-slate-700 text-slate-500"
            }`}
          >
            {i < step ? <Check className="size-3.5" /> : i}
          </div>
          {idx < 5 && <div className={`h-px w-8 ${i < step ? "bg-[#3B82F6]" : "bg-slate-700"}`} />}
        </div>
      ))}
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#60A5FA] mb-2">DriveProSync setup</div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-300 mb-1.5">{children}</label>;
}

function Input({ label, required, value, onChange, placeholder, prefix, type = "text" }: { label: string; required?: boolean; value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string; type?: string }) {
  return (
    <div>
      <Label>{label}{required && " *"}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{prefix}</span>}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="glass-input" style={prefix ? { paddingLeft: 24 } : undefined} />
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-300">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={`w-11 h-6 rounded-full transition ${checked ? "bg-[#3B82F6]" : "bg-slate-700"} relative`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function RadioRow({ checked, onChange, title, desc }: { checked: boolean; onChange: () => void; title: string; desc: string }) {
  return (
    <button type="button" onClick={onChange} className={`w-full text-left p-3 rounded-lg border transition ${checked ? "border-[#3B82F6] bg-[#3B82F6]/10" : "border-slate-700 bg-transparent"}`}>
      <div className="flex items-start gap-3">
        <div className={`size-4 rounded-full border-2 mt-0.5 ${checked ? "border-[#3B82F6] bg-[#3B82F6]" : "border-slate-600"}`} />
        <div>
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="text-xs text-slate-400">{desc}</div>
        </div>
      </div>
    </button>
  );
}

function NextRow({ onBack, onNext, busy }: { onBack?: () => void; onNext: () => void; busy: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      {onBack && <button onClick={onBack} className="btn-secondary text-sm">Back</button>}
      <button onClick={onNext} disabled={busy} className="btn-primary flex-1">
        {busy ? "Saving…" : <>Continue <ArrowRight className="size-4" /></>}
      </button>
    </div>
  );
}
