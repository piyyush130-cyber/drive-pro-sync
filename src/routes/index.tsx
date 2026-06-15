import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return toast.error("Please select a lesson type first.");
    if (!form.date || !form.time) return toast.error("Pick a date and time.");
    setSubmitting(true);
    try {
      const { data: student, error: e1 } = await supabase
        .from("students")
        .insert({
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          pickup_address: form.pickup_address,
          notes: form.notes || null,
        })
        .select("id")
        .single();
      if (e1) throw e1;
      const scheduled_at = new Date(`${form.date}T${form.time}`).toISOString();
      const { error: e2 } = await supabase.from("bookings").insert({
        student_id: student.id,
        lesson_type_id: selected.id,
        scheduled_at,
        duration_minutes: selected.duration_minutes,
        pickup_address: form.pickup_address,
        dropoff_address: form.dropoff_same ? form.pickup_address : form.dropoff_address,
        notes: form.notes || null,
        price_cents: selected.price_cents,
        status: "pending",
      });
      if (e2) throw e2;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  }

  const school = settingsQ.data?.school_name ?? "Driving School";

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white ring-1 ring-black/5 rounded-xl p-10">
          <div className="text-emerald-800 font-semibold uppercase tracking-wider text-xs">
            Request received
          </div>
          <h1 className="text-2xl font-medium mt-3">Thanks, {form.full_name.split(" ")[0]}!</h1>
          <p className="text-zinc-600 mt-3 text-pretty">
            Your booking request was sent to {school}. They'll review and confirm by phone or
            email shortly.
          </p>
          <Link to="/" className="mt-6 inline-block text-emerald-800 underline text-sm">
            Book another lesson
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="border-b border-zinc-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="font-semibold text-emerald-900">{school}</div>
          <Link to="/auth" className="text-xs text-zinc-500 hover:text-zinc-900">
            Staff sign in
          </Link>
        </div>
      </nav>

      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6">
          <header className="mb-12">
            <div className="text-emerald-800 font-semibold tracking-wide uppercase text-xs mb-3">
              {school}
            </div>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-balance leading-tight max-w-[20ch]">
              Book your driving lesson in minutes
            </h1>
            <p className="mt-4 text-zinc-600 text-pretty max-w-[56ch]">
              Professional instruction for new drivers. Select a package below, fill in your
              details, and we'll confirm by phone or email.
            </p>
          </header>

          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {typesQ.data?.map((t, i) => {
              const popular = i === 2;
              const active = selected?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(t)}
                  className={`text-left bg-white rounded-xl p-5 transition-all relative overflow-hidden ${
                    active
                      ? "ring-2 ring-emerald-800"
                      : "ring-1 ring-black/5 hover:ring-zinc-300"
                  }`}
                >
                  {popular && (
                    <div className="absolute top-0 right-0 bg-emerald-800 text-white text-[10px] px-2 py-1 font-bold uppercase tracking-wider">
                      Popular
                    </div>
                  )}
                  <h3 className="font-medium text-emerald-900">{t.name}</h3>
                  <p className="text-sm text-zinc-500 mt-1 mb-4">
                    {t.description || `${t.duration_minutes} min`}
                  </p>
                  <div className="text-2xl font-semibold text-zinc-900">
                    {t.price_cents > 0 ? money(t.price_cents) : "Quote"}
                  </div>
                  <div
                    className={`mt-4 w-full text-center py-2 rounded-md text-sm font-medium ${
                      active
                        ? "bg-emerald-800 text-white"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {active ? "Selected" : "Select"}
                  </div>
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white ring-1 ring-black/5 rounded-xl p-8 max-w-[56ch]"
          >
            <h2 className="text-xl font-medium mb-6">Your Information</h2>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name" required>
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="input"
                    placeholder="Sarah Jenkins"
                  />
                </Field>
                <Field label="Phone" required>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input"
                    placeholder="(555) 000-0000"
                  />
                </Field>
              </div>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Pickup Address" required>
                <input
                  required
                  value={form.pickup_address}
                  onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                  className="input"
                  placeholder="123 Street Name, City"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.dropoff_same}
                  onChange={(e) => setForm({ ...form, dropoff_same: e.target.checked })}
                />
                Drop-off same as pickup
              </label>
              {!form.dropoff_same && (
                <Field label="Drop-off Address">
                  <input
                    value={form.dropoff_address}
                    onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })}
                    className="input"
                  />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Preferred Date" required>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Preferred Time" required>
                  <input
                    required
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Notes (apartment buzzer, school pickup, preferred instructor...)">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input min-h-[80px]"
                />
              </Field>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-800 text-white py-3 rounded-md font-medium text-sm transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Booking Request"}
              </button>
              <p className="text-xs text-zinc-500 text-center">
                Booking is confirmed once the school reviews and approves it.
              </p>
            </div>
          </form>

          {settingsQ.data?.cancellation_policy && (
            <div className="max-w-[56ch] mt-8 text-xs text-zinc-500">
              <strong className="text-zinc-700">Cancellation policy:</strong>{" "}
              {settingsQ.data.cancellation_policy}{" "}
              <Link to="/cancel" className="text-emerald-800 underline">
                Request a cancellation
              </Link>
            </div>
          )}
        </div>
      </section>

      <style>{`
        .input {
          width: 100%;
          background: #fafafa;
          border: 1px solid #e4e4e7;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
        }
        .input:focus { border-color: #064e3b; background: #fff; }
      `}</style>
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
      <label className="block text-sm font-medium text-zinc-700 mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
