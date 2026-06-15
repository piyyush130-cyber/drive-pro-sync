import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  CarFront,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CircleCheck,
  MapPin,
  User,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Hourglass,
} from "lucide-react";
import {
  addMonths,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  addDays,
} from "date-fns";
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
type Settings = { school_name: string };

// Demo time slots (8:00 AM – 10:00 PM). Some are flagged unavailable.
const TIME_SLOTS: { time: string; label: string }[] = [
  { time: "08:00", label: "8:00 AM" },
  { time: "09:30", label: "9:30 AM" },
  { time: "11:00", label: "11:00 AM" },
  { time: "12:30", label: "12:30 PM" },
  { time: "14:00", label: "2:00 PM" },
  { time: "15:30", label: "3:30 PM" },
  { time: "17:00", label: "5:00 PM" },
  { time: "18:30", label: "6:30 PM" },
  { time: "20:00", label: "8:00 PM" },
  { time: "21:00", label: "9:00 PM" },
];

// Deterministic demo availability so the UI feels real but stable per date.
function unavailableForDate(d: Date): Set<string> {
  const seed = (d.getFullYear() * 1000 + d.getMonth() * 50 + d.getDate()) % 7;
  const blocked = new Set<string>();
  // Sundays: morning slots taken
  if (d.getDay() === 0) {
    blocked.add("08:00");
    blocked.add("09:30");
  }
  // Rotate two slots based on seed
  blocked.add(TIME_SLOTS[seed % TIME_SLOTS.length].time);
  blocked.add(TIME_SLOTS[(seed + 3) % TIME_SLOTS.length].time);
  return blocked;
}

const STEPS = [
  { id: 1, label: "Lesson", icon: CarFront },
  { id: 2, label: "Time", icon: CalendarDays },
  { id: 3, label: "Details", icon: User },
  { id: 4, label: "Review", icon: ShieldCheck },
];

function BookingPage() {
  const settingsQ = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("school_name")
        .eq("id", 1)
        .maybeSingle();
      return (data as Settings | null) ?? { school_name: "Standard Driving School" };
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

  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<LessonType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    pickup_address: "",
    dropoff_same: true,
    dropoff_address: "",
    pickup_notes: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = useServerFn(submitPublicBooking);
  const school = settingsQ.data?.school_name ?? "Standard Driving School";

  function next() {
    if (step === 1 && !selected) return toast.error("Choose a lesson to continue.");
    if (step === 2 && (!selectedDate || !selectedTime))
      return toast.error("Pick a date and an available time slot.");
    if (step === 3) {
      if (!form.full_name || !form.phone || !form.pickup_address)
        return toast.error("Name, phone and pickup address are required.");
    }
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!selected || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    try {
      const [h, m] = selectedTime.split(":").map(Number);
      const dt = new Date(selectedDate);
      dt.setHours(h, m, 0, 0);
      await submit({
        data: {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          pickup_address: form.pickup_address,
          dropoff_address: form.dropoff_same ? form.pickup_address : form.dropoff_address,
          notes:
            [form.pickup_notes && `Pickup: ${form.pickup_notes}`, form.notes]
              .filter(Boolean)
              .join("\n") || null,
          lesson_type_id: selected.id,
          scheduled_at: dt.toISOString(),
        },
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted && selected && selectedDate && selectedTime) {
    return (
      <ConfirmationScreen
        school={school}
        lesson={selected}
        date={selectedDate}
        time={TIME_SLOTS.find((s) => s.time === selectedTime)?.label ?? selectedTime}
        pickup={form.pickup_address}
        name={form.full_name}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-mist)]">
      <TopBar school={school} />
      <ProgressBar step={step} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        {step === 1 && (
          <StepShell
            eyebrow="Step 1"
            title="Choose your lesson"
            subtitle="Pick the session that fits where you are in your driving journey."
          >
            <LessonGrid
              types={typesQ.data ?? []}
              selected={selected}
              onSelect={setSelected}
            />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            eyebrow="Step 2"
            title="Pick your time"
            subtitle="Choose a day, then pick from open time slots between 8 AM and 10 PM."
          >
            <Scheduler
              date={selectedDate}
              time={selectedTime}
              onDate={(d) => {
                setSelectedDate(d);
                setSelectedTime(null);
              }}
              onTime={setSelectedTime}
            />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            eyebrow="Step 3"
            title="Add pickup details"
            subtitle="Your instructor uses these to find you on lesson day."
          >
            <DetailsForm form={form} setForm={setForm} />
          </StepShell>
        )}

        {step === 4 && selected && selectedDate && selectedTime && (
          <StepShell
            eyebrow="Step 4"
            title="Review request"
            subtitle="Double-check the details. The school will confirm by phone, text, or email."
          >
            <ReviewSummary
              lesson={selected}
              date={selectedDate}
              time={TIME_SLOTS.find((s) => s.time === selectedTime)?.label ?? selectedTime}
              form={form}
            />
          </StepShell>
        )}

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button onClick={back} className="btn-secondary">
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : (
            <div />
          )}
          {step < 4 ? (
            <button onClick={next} className="btn-primary">
              Continue <ArrowRight className="size-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? "Sending…" : "Request Lesson Time"}
              {!submitting && <ArrowRight className="size-4" />}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Powered by <span className="font-semibold text-slate-700">DriveProSync</span>
        </p>
      </main>
    </div>
  );
}

/* ---------------- Top bar + progress ---------------- */

function TopBar({ school }: { school: string }) {
  return (
    <header className="brand-gradient text-white border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-xl bg-white/10 ring-1 ring-white/15 grid place-items-center shrink-0">
            <CarFront className="size-4.5 text-blue-300" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight leading-none truncate">
              DriveProSync Booking
            </div>
            <div className="text-[10px] text-blue-200/80 uppercase tracking-widest mt-1 truncate">
              For {school}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-100 bg-white/5 ring-1 ring-white/15 rounded-full px-2.5 py-1 whitespace-nowrap">
          <Hourglass className="size-3" />
          Booking Request
        </span>
      </div>
    </header>
  );
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="bg-[color:var(--color-navy)]/95 border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        <ol className="flex items-center gap-2 sm:gap-3">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <li key={s.id} className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div
                  className={`size-8 rounded-full grid place-items-center text-xs font-semibold ring-1 transition-colors shrink-0 ${
                    done
                      ? "bg-emerald-500 text-white ring-emerald-400"
                      : active
                        ? "bg-blue-500 text-white ring-blue-300 shadow-[0_0_0_4px_rgba(59,130,246,0.18)]"
                        : "bg-white/5 text-blue-200/70 ring-white/10"
                  }`}
                >
                  {done ? <Check className="size-4" /> : s.id}
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium truncate ${
                    active ? "text-white" : done ? "text-emerald-200" : "text-blue-200/60"
                  }`}
                >
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block flex-1 h-px bg-white/10" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 sm:mt-10">
      <div className="text-center mb-6">
        <div className="eyebrow text-blue-700">{eyebrow}</div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1.5 text-slate-900">
          {title}
        </h1>
        <p className="text-sm text-slate-500 mt-1.5 max-w-lg mx-auto text-pretty">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

/* ---------------- Step 1 — lessons ---------------- */

function LessonGrid({
  types,
  selected,
  onSelect,
}: {
  types: LessonType[];
  selected: LessonType | null;
  onSelect: (t: LessonType) => void;
}) {
  const blurbs: Record<string, string> = {
    "1 Hour Driving Lesson": "Focused single-hour driving session.",
    "1.5 Hour Driving Lesson": "More time for steady practice and confidence.",
    "2 Hour Driving Lesson": "Longer session for deeper practice and preparation.",
    "Road Test Package": "Warm-up lesson, test-day support, and vehicle use.",
    "Custom Package": "Let the school help choose the right option.",
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {types.map((t) => {
        const active = selected?.id === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={`relative text-left rounded-2xl p-5 transition-all overflow-hidden bg-white ${
              active
                ? "ring-2 ring-[color:var(--color-electric)] shadow-[0_0_0_4px_rgba(37,99,235,0.12),0_18px_36px_-22px_rgba(37,99,235,0.55)] -translate-y-px"
                : "ring-1 ring-[color:var(--color-silver)] hover:ring-slate-300 hover:-translate-y-px"
            }`}
          >
            {active && (
              <div className="absolute top-3 right-3 size-6 rounded-full bg-[color:var(--color-electric)] grid place-items-center text-white shadow-md">
                <Check className="size-3.5" strokeWidth={3} />
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              <Clock className="size-3.5" />
              {t.duration_minutes} min
            </div>
            <div className="mt-2 font-semibold tracking-tight text-slate-900 text-lg">
              {t.name.replace(" Driving Lesson", " Lesson")}
            </div>
            <p className="text-sm text-slate-500 mt-1 min-h-[40px]">
              {blurbs[t.name] ?? t.description ?? ""}
            </p>
            <div className="mt-4 flex items-end justify-between">
              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {t.price_cents > 0 ? money(t.price_cents) : "Quote"}
              </div>
              <span
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  active
                    ? "bg-[color:var(--color-electric)] text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {active ? "Selected" : "Select"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Step 2 — calendar + slots ---------------- */

function Scheduler({
  date,
  time,
  onDate,
  onTime,
}: {
  date: Date | null;
  time: string | null;
  onDate: (d: Date) => void;
  onTime: (t: string) => void;
}) {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(startOfMonth(date ?? today));
  const days = useMemo(() => buildMonthGrid(month), [month]);
  const blocked = useMemo(() => (date ? unavailableForDate(date) : new Set<string>()), [date]);

  return (
    <div className="card-premium overflow-hidden grid md:grid-cols-[1.1fr_1fr]">
      {/* Calendar */}
      <div className="p-5 sm:p-6 border-b md:border-b-0 md:border-r border-[color:var(--color-silver)]">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold tracking-tight text-slate-900">
            {format(month, "MMMM yyyy")}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={isSameMonth(month, today)}
              className="size-8 rounded-md grid place-items-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              className="size-8 rounded-md grid place-items-center text-slate-600 hover:bg-slate-100"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center py-1 font-semibold">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const inMonth = isSameMonth(d, month);
            const isPast = isBefore(d, today);
            const isToday = isSameDay(d, today);
            const isSel = date && isSameDay(d, date);
            const disabled = !inMonth || isPast;
            return (
              <button
                key={d.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => onDate(d)}
                className={`relative h-10 rounded-lg text-sm font-medium transition-colors ${
                  isSel
                    ? "bg-[color:var(--color-electric)] text-white shadow-[0_6px_18px_-8px_rgba(37,99,235,0.6)]"
                    : disabled
                      ? "text-slate-300 cursor-not-allowed"
                      : isToday
                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
                        : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      <div className="p-5 sm:p-6 bg-[color:var(--color-mist)]/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="eyebrow text-slate-500">Available times</div>
            <div className="font-semibold tracking-tight text-slate-900 mt-0.5">
              {date ? format(date, "EEEE, MMM d") : "Select a day"}
            </div>
          </div>
          <Clock className="size-4 text-slate-400" />
        </div>
        {!date ? (
          <div className="text-sm text-slate-500 py-8 text-center">
            Choose a date to see open slots.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {TIME_SLOTS.map((s) => {
              const unavailable = blocked.has(s.time);
              const active = time === s.time;
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={unavailable}
                  onClick={() => onTime(s.time)}
                  className={`relative rounded-lg px-3 py-2.5 text-sm font-medium border transition-all ${
                    active
                      ? "bg-[color:var(--color-electric)] text-white border-[color:var(--color-electric)] shadow-[0_6px_18px_-8px_rgba(37,99,235,0.6)]"
                      : unavailable
                        ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed"
                        : "bg-white text-slate-800 border-[color:var(--color-silver)] hover:border-blue-300 hover:bg-blue-50/40"
                  }`}
                >
                  <div>{s.label}</div>
                  {unavailable && (
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
                      Booked
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-5 text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[color:var(--color-electric)]" /> Selected
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-slate-200" /> Unavailable
          </span>
        </div>
      </div>
    </div>
  );
}

function buildMonthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const last = endOfMonth(month);
  const days: Date[] = [];
  let cur = first;
  while (cur <= addDays(last, 6 - last.getDay())) {
    days.push(cur);
    cur = addDays(cur, 1);
    if (days.length > 42) break;
  }
  return days;
}

/* ---------------- Step 3 — details ---------------- */

function DetailsForm({
  form,
  setForm,
}: {
  form: any;
  setForm: (f: any) => void;
}) {
  return (
    <div className="grid gap-5">
      <GroupCard icon={User} title="Student details">
        <div className="grid sm:grid-cols-2 gap-4">
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
      </GroupCard>

      <GroupCard icon={MapPin} title="Pickup & drop-off">
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
            className="size-4 accent-[color:var(--color-electric)]"
          />
          Drop-off same as pickup
        </label>
        {!form.dropoff_same && (
          <Field label="Drop-off address">
            <input
              value={form.dropoff_address}
              onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })}
              className="input-premium"
              placeholder="Drop-off address"
            />
          </Field>
        )}
        <Field label="Pickup notes">
          <textarea
            value={form.pickup_notes}
            onChange={(e) => setForm({ ...form, pickup_notes: e.target.value })}
            className="input-premium min-h-[72px]"
            placeholder="Apartment buzzer, school entrance, meet outside, or other pickup instructions"
          />
        </Field>
      </GroupCard>

      <GroupCard icon={ShieldCheck} title="Anything else?">
        <Field label="Notes for the instructor">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input-premium min-h-[80px]"
            placeholder="License level, goals, focus areas…"
          />
        </Field>
      </GroupCard>
    </div>
  );
}

function GroupCard({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-premium p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="size-7 rounded-md bg-blue-50 ring-1 ring-blue-100 grid place-items-center">
          <Icon className="size-3.5 text-blue-700" />
        </div>
        <div className="font-semibold tracking-tight text-slate-900">{title}</div>
      </div>
      <div className="space-y-4">{children}</div>
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

/* ---------------- Step 4 — review ---------------- */

function ReviewSummary({
  lesson,
  date,
  time,
  form,
}: {
  lesson: LessonType;
  date: Date;
  time: string;
  form: any;
}) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="brand-gradient text-white p-6 flex items-center justify-between gap-3">
        <div>
          <div className="eyebrow text-blue-200">Your request</div>
          <div className="text-xl font-semibold tracking-tight mt-1">
            {lesson.name.replace(" Driving Lesson", " Lesson")}
          </div>
          <div className="text-blue-200/80 text-sm mt-0.5">
            {format(date, "EEEE, MMM d")} · {time} · {lesson.duration_minutes} min
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-blue-200">Total</div>
          <div className="text-2xl font-semibold tracking-tight">
            {lesson.price_cents > 0 ? money(lesson.price_cents) : "Quote"}
          </div>
        </div>
      </div>
      <div className="p-6 grid sm:grid-cols-2 gap-x-8 gap-y-4">
        <Row label="Student">{form.full_name}</Row>
        <Row label="Phone">{form.phone}</Row>
        {form.email && <Row label="Email">{form.email}</Row>}
        <Row label="Pickup">{form.pickup_address}</Row>
        {!form.dropoff_same && form.dropoff_address && (
          <Row label="Drop-off">{form.dropoff_address}</Row>
        )}
        {form.pickup_notes && <Row label="Pickup notes">{form.pickup_notes}</Row>}
        {form.notes && <Row label="Notes">{form.notes}</Row>}
      </div>
      <div className="px-6 py-4 bg-amber-50/70 border-t border-amber-100 text-sm text-amber-900 flex items-start gap-2">
        <Hourglass className="size-4 mt-0.5 shrink-0" />
        Your request will be reviewed by the driving school before it is confirmed.
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
        {label}
      </div>
      <div className="text-sm text-slate-800 mt-0.5">{children}</div>
    </div>
  );
}

/* ---------------- Confirmation ---------------- */

function ConfirmationScreen({
  school,
  lesson,
  date,
  time,
  pickup,
  name,
}: {
  school: string;
  lesson: LessonType;
  date: Date;
  time: string;
  pickup: string;
  name: string;
}) {
  return (
    <div className="min-h-screen bg-[color:var(--color-mist)]">
      <TopBar school={school} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="card-premium overflow-hidden">
          <div className="p-8 text-center">
            <div className="mx-auto size-14 rounded-full bg-emerald-50 ring-1 ring-emerald-200 grid place-items-center">
              <CircleCheck className="size-7 text-emerald-600" />
            </div>
            <div className="eyebrow text-emerald-700 mt-5">Booking request received</div>
            <h1 className="text-2xl font-semibold tracking-tight mt-2">
              Thanks, {name.split(" ")[0] || "driver"}!
            </h1>
            <p className="text-slate-600 mt-2 text-pretty max-w-md mx-auto">
              {school} will review your request and confirm by phone, text, or email.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-full px-3 py-1">
              <Hourglass className="size-3" /> Pending school approval
            </span>
          </div>
          <div className="border-t border-[color:var(--color-silver)] p-6 grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <Row label="Lesson">{lesson.name.replace(" Driving Lesson", " Lesson")}</Row>
            <Row label="Date">{format(date, "EEEE, MMM d")}</Row>
            <Row label="Time">{time}</Row>
            <Row label="Pickup">{pickup}</Row>
          </div>
        </div>
        <div className="text-center mt-6">
          <Link to="/" className="text-sm font-medium text-blue-700 hover:underline">
            Book another lesson
          </Link>
        </div>
        <p className="text-center text-xs text-slate-500 mt-8">
          Powered by <span className="font-semibold text-slate-700">DriveProSync</span>
        </p>
      </main>
    </div>
  );
}
