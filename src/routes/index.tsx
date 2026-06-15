import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CarFront,
  MapPin,
  CalendarClock,
  ShieldCheck,
  CircleCheck,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitPublicBooking } from "@/lib/public-booking.functions";
import { money } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: BookingPage,
});

type LessonType = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
};
type Settings = {
  school_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  service_area: string | null;
  cancellation_policy: string | null;
};

function BookingPage() {
  const settingsQ = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_settings")
        .select("school_name,contact_phone,contact_email,service_area,cancellation_policy")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });
  const typesQ = useQuery({
    queryKey: ["public-lesson-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_types")
        .select("id,name,description,duration_minutes,price_cents")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as LessonType[];
    },
  });

  const [selected, setSelected] = useState<LessonType | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    pickup_address: "",
    dropoff_same: true,
    dropoff_address: "",
    date: "",
    time: "",
    notes: "",
  });

  const submit = useServerFn(submitPublicBooking);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error("Please select a lesson package first.");
      window.scrollTo({ top: 400, behavior: "smooth" });
      return;
    }
    if (!form.date || !form.time) return toast.error("Pick a date and time.");
    setSubmitting(true);
    try {
      const scheduled_at = new Date(`${form.date}T${form.time}`).toISOString();
      await submit({
        data: {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          pickup_address: form.pickup_address,
          dropoff_address: form.dropoff_same ? form.pickup_address : form.dropoff_address,
          notes: form.notes || null,
          lesson_type_id: selected.id,
          scheduled_at,
        },
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  }

  const school = settingsQ.data?.school_name ?? "Standard Driving School";

  if (submitted) {
    return (
      <div className="min-h-screen bg-[color:var(--color-mist)] flex items-center justify-center p-6">
        <div className="max-w-md text-center card-premium p-10">
          <div className="mx-auto size-14 rounded-full bg-emerald-50 ring-1 ring-emerald-200 grid place-items-center">
            <CircleCheck className="size-7 text-emerald-600" />
          </div>
          <div className="eyebrow text-emerald-700 mt-5">Booking request received</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">
            Thanks, {form.full_name.split(" ")[0] || "driver"}!
          </h1>
          <p className="text-slate-600 mt-3 text-pretty">
            {school} will review your request and confirm by phone or email shortly.
          </p>
          <Link to="/" className="mt-6 inline-block text-blue-700 underline text-sm font-medium">
            Book another lesson
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-mist)]">
      {/* Top nav */}
      <nav className="brand-gradient text-slate-100 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-white/10 ring-1 ring-white/15 grid place-items-center">
              <CarFront className="size-4.5 text-blue-300" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-white leading-none">
                DriveProSync
              </div>
              <div className="text-[10px] text-blue-200/80 uppercase tracking-widest mt-1">
                {school}
              </div>
            </div>
          </div>
          <Link
            to="/auth"
            className="text-xs font-medium text-slate-200 hover:text-white px-3 py-1.5 rounded-md ring-1 ring-white/15 hover:bg-white/5"
          >
            Staff sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="brand-gradient brand-grid-bg text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-[color:var(--color-mist)]/0" />
        <div className="max-w-6xl mx-auto px-6 pt-14 md:pt-20 pb-20 md:pb-28 relative">
          <div className="eyebrow text-blue-300">Online booking · {school}</div>
          <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-balance leading-[1.05] max-w-[22ch]">
            Book your next driving lesson in minutes
          </h1>
          <p className="mt-5 text-slate-300 text-pretty max-w-[60ch] text-base md:text-lg">
            Choose a lesson package, add your pickup details, and request a time. The school
            confirms your booking after review.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { icon: MapPin, label: "Pickup coordination" },
              { icon: CalendarClock, label: "Instructor scheduling" },
              { icon: ShieldCheck, label: "Clear pricing" },
              { icon: CarFront, label: "Road test prep" },
            ].map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-2 text-xs font-medium text-blue-100 bg-white/5 ring-1 ring-white/10 rounded-full px-3 py-1.5"
              >
                <b.icon className="size-3.5 text-blue-300" />
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Lesson packages */}
      <section className="-mt-14 md:-mt-20 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="card-premium p-6 md:p-8">
            <div className="flex items-end justify-between mb-5 flex-wrap gap-2">
              <div>
                <div className="eyebrow text-blue-700">Step 1</div>
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight mt-1">
                  Choose a lesson package
                </h2>
              </div>
              <div className="text-xs text-slate-500">
                Transparent pricing · No hidden fees
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {typesQ.data?.map((t, i) => {
                const popular = i === 2;
                const active = selected?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t)}
                    className={`relative text-left rounded-xl p-5 transition-all overflow-hidden ${
                      active
                        ? "bg-blue-50/60 ring-2 ring-blue-600 shadow-[0_10px_24px_-12px_rgba(37,99,235,0.45)]"
                        : "bg-white ring-1 ring-slate-200 hover:ring-slate-300 hover:-translate-y-px"
                    }`}
                  >
                    {popular && (
                      <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-2 py-1 font-bold uppercase tracking-wider rounded-bl-lg">
                        Popular
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold tracking-tight text-slate-900">{t.name}</h3>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 mb-4 min-h-[40px]">
                      {t.description || `${t.duration_minutes} min session`}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <div className="text-2xl font-semibold tracking-tight text-slate-900">
                        {t.price_cents > 0 ? money(t.price_cents) : "Quote"}
                      </div>
                      <div className="text-xs text-slate-500">· {t.duration_minutes} min</div>
                    </div>
                    <div
                      className={`mt-4 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {active ? (
                        <>
                          <CircleCheck className="size-4" /> Selected
                        </>
                      ) : (
                        <>
                          Select <ArrowRight className="size-4" />
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Booking form */}
      <section className="py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          <form onSubmit={handleSubmit} className="card-premium p-6 md:p-8">
            <div className="eyebrow text-blue-700">Step 2</div>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight mt-1 mb-6">
              Your booking details
            </h2>

            <FormSection title="Student details">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full name" required>
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="input-premium"
                    placeholder="Sarah Jenkins"
                  />
                </Field>
                <Field label="Phone" required>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input-premium"
                    placeholder="(555) 000-0000"
                  />
                </Field>
              </div>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-premium"
                  placeholder="you@example.com"
                />
              </Field>
            </FormSection>

            <FormSection title="Pickup & drop-off">
              <Field label="Pickup address" required>
                <input
                  required
                  value={form.pickup_address}
                  onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                  className="input-premium"
                  placeholder="123 Street Name, City"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={form.dropoff_same}
                  onChange={(e) => setForm({ ...form, dropoff_same: e.target.checked })}
                  className="size-4 accent-blue-600"
                />
                Drop-off same as pickup
              </label>
              {!form.dropoff_same && (
                <Field label="Drop-off address">
                  <input
                    value={form.dropoff_address}
                    onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })}
                    className="input-premium"
                  />
                </Field>
              )}
              <p className="text-xs text-slate-500">
                Pickup is available within the school's service area. Your booking is confirmed only
                after the school approves the request.
              </p>
            </FormSection>

            <FormSection title="Preferred lesson time">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Preferred date" required>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="input-premium"
                  />
                </Field>
                <Field label="Preferred time" required>
                  <input
                    required
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="input-premium"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Notes" last>
              <Field label="Special instructions (apartment buzzer, school pickup, preferred instructor…)">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input-premium min-h-[90px]"
                />
              </Field>
            </FormSection>

            <button type="submit" disabled={submitting} className="btn-primary w-full mt-6">
              {submitting ? "Submitting…" : "Request lesson time"}
              {!submitting && <ArrowRight className="size-4" />}
            </button>
            <p className="text-xs text-slate-500 text-center mt-3">
              No payment required to request. The school will confirm before charging.
            </p>
          </form>

          {/* Side summary */}
          <aside className="lg:sticky lg:top-6 space-y-4">
            <div className="card-premium p-5">
              <div className="eyebrow text-slate-500 mb-3">Your selection</div>
              {selected ? (
                <>
                  <div className="font-semibold tracking-tight">{selected.name}</div>
                  <div className="text-xs text-slate-500">{selected.duration_minutes} minutes</div>
                  <div className="hairline my-4" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-slate-600">Total</span>
                    <span className="text-2xl font-semibold tracking-tight">
                      {selected.price_cents > 0 ? money(selected.price_cents) : "Quote"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500">
                  Select a lesson package above to see your summary.
                </div>
              )}
            </div>

            {settingsQ.data?.cancellation_policy && (
              <div className="card-premium p-5">
                <div className="eyebrow text-slate-500 mb-2">Cancellation policy</div>
                <p className="text-xs text-slate-600">{settingsQ.data.cancellation_policy}</p>
                <Link
                  to="/cancel"
                  className="mt-3 inline-block text-xs font-medium text-blue-700 underline"
                >
                  Request a cancellation or reschedule
                </Link>
              </div>
            )}

            {(settingsQ.data?.contact_phone || settingsQ.data?.contact_email) && (
              <div className="card-premium p-5">
                <div className="eyebrow text-slate-500 mb-2">Contact the school</div>
                {settingsQ.data?.contact_phone && (
                  <div className="text-sm text-slate-700">{settingsQ.data.contact_phone}</div>
                )}
                {settingsQ.data?.contact_email && (
                  <div className="text-xs text-slate-500">{settingsQ.data.contact_email}</div>
                )}
              </div>
            )}
          </aside>
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-slate-500">
        Powered by <span className="font-semibold text-slate-700">DriveProSync</span>
      </footer>
    </div>
  );
}

function FormSection({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "pb-6 mb-6 hairline-bottom"}>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {title}
      </div>
      <div className="space-y-4">{children}</div>
      <style>{`.hairline-bottom { border-bottom: 1px solid var(--color-silver); }`}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
