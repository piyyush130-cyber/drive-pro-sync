import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CircleCheck,
  MapPin,
  User,
  ArrowRight,
  ShieldCheck,
  Hourglass,
  Sparkles,
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

// Demo time slots (8:00 AM – 10:00 PM).
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

function unavailableForDate(d: Date): Set<string> {
  const seed = (d.getFullYear() * 1000 + d.getMonth() * 50 + d.getDate()) % 7;
  const blocked = new Set<string>();
  if (d.getDay() === 0) {
    blocked.add("08:00");
    blocked.add("09:30");
  }
  blocked.add(TIME_SLOTS[seed % TIME_SLOTS.length].time);
  blocked.add(TIME_SLOTS[(seed + 3) % TIME_SLOTS.length].time);
  return blocked;
}

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

  async function handleSubmit() {
    if (!selected) return toast.error("Choose a lesson first.");
    if (!selectedDate || !selectedTime)
      return toast.error("Pick a date and an available time.");
    if (!form.full_name || !form.phone || !form.pickup_address)
      return toast.error("Name, phone and pickup address are required.");
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
      window.scrollTo({ top: 0, behavior: "smooth" });
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
    <div className="min-h-screen bg-[#070b1c] text-slate-100 relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[900px] rounded-full bg-blue-600/20 blur-[140px]" />
        <div className="absolute top-20 right-0 size-[420px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <TopBar school={school} />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* LEFT COLUMN */}
          <div className="space-y-5">
            <Panel
              eyebrow="Select service"
              title="Choose a lesson"
              icon={Sparkles}
            >
              <ServicePicker
                types={typesQ.data ?? []}
                selected={selected}
                onSelect={(t) => {
                  setSelected(t);
                  setSelectedTime(null);
                }}
              />
            </Panel>

            <Panel eyebrow="Student" title="Your details" icon={User}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name" required>
                  <LuxInput
                    value={form.full_name}
                    onChange={(v) => setForm({ ...form, full_name: v })}
                    placeholder="Sarah Jenkins"
                  />
                </Field>
                <Field label="Phone" required>
                  <LuxInput
                    type="tel"
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                    placeholder="(555) 000-0000"
                  />
                </Field>
              </div>
              <Field label="Email">
                <LuxInput
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  placeholder="you@example.com"
                />
              </Field>
            </Panel>

            <Panel eyebrow="Location" title="Pickup & drop-off" icon={MapPin}>
              <Field label="Pickup address" required>
                <LuxInput
                  value={form.pickup_address}
                  onChange={(v) => setForm({ ...form, pickup_address: v })}
                  placeholder="123 Street Name, City"
                />
              </Field>
              <label className="flex items-center gap-2.5 text-sm text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={form.dropoff_same}
                  onChange={(e) => setForm({ ...form, dropoff_same: e.target.checked })}
                  className="size-4 accent-blue-500"
                />
                Drop-off same as pickup
              </label>
              {!form.dropoff_same && (
                <Field label="Drop-off address">
                  <LuxInput
                    value={form.dropoff_address}
                    onChange={(v) => setForm({ ...form, dropoff_address: v })}
                    placeholder="Drop-off address"
                  />
                </Field>
              )}
              <Field label="Pickup notes">
                <LuxTextarea
                  value={form.pickup_notes}
                  onChange={(v) => setForm({ ...form, pickup_notes: v })}
                  placeholder="Apartment buzzer, school entrance, meet outside…"
                />
              </Field>
            </Panel>

            <Panel eyebrow="Optional" title="Notes for the instructor" icon={ShieldCheck}>
              <LuxTextarea
                value={form.notes}
                onChange={(v) => setForm({ ...form, notes: v })}
                placeholder="License level, goals, focus areas…"
              />
            </Panel>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <Panel eyebrow="Schedule" title="Pick a date & time">
              <Scheduler
                date={selectedDate}
                time={selectedTime}
                onDate={(d) => {
                  setSelectedDate(d);
                  setSelectedTime(null);
                }}
                onTime={setSelectedTime}
              />
            </Panel>

            <SummaryCard
              lesson={selected}
              date={selectedDate}
              time={selectedTime}
              form={form}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-10">
          Powered by <span className="font-semibold text-slate-300">DriveProSync</span>
        </p>
      </main>
    </div>
  );
}

/* ---------------- Header ---------------- */

function TopBar({ school }: { school: string }) {
  return (
    <header className="relative border-b border-white/[0.06] bg-[#050818]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 ring-1 ring-white/15 grid place-items-center shrink-0 shadow-[0_8px_24px_-8px_rgba(59,130,246,0.6)]">
            <CarFront className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight leading-none truncate text-white">
              DriveProSync Booking
            </div>
            <div className="text-[10px] text-blue-300/80 uppercase tracking-[0.18em] mt-1.5 truncate">
              For {school}
            </div>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-100 bg-white/5 ring-1 ring-white/10 rounded-full px-3 py-1.5 whitespace-nowrap">
          <ShieldCheck className="size-3" />
          Secure booking
        </span>
      </div>
    </header>
  );
}

/* ---------------- Panel ---------------- */

function Panel({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07] backdrop-blur-xl p-5 sm:p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-2.5 mb-4">
        {Icon && (
          <div className="size-7 rounded-lg bg-blue-500/15 ring-1 ring-blue-400/30 grid place-items-center">
            <Icon className="size-3.5 text-blue-300" />
          </div>
        )}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300/80">
            {eyebrow}
          </div>
          <div className="font-semibold tracking-tight text-white text-base mt-0.5">
            {title}
          </div>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/* ---------------- Service picker ---------------- */

function ServicePicker({
  types,
  selected,
  onSelect,
}: {
  types: LessonType[];
  selected: LessonType | null;
  onSelect: (t: LessonType) => void;
}) {
  const blurbs: Record<string, string> = {
    "1 Hour Driving Lesson": "Focused single-hour session.",
    "1.5 Hour Driving Lesson": "Steady practice and confidence.",
    "2 Hour Driving Lesson": "Deeper practice and preparation.",
    "Road Test Package": "Warm-up, test support, vehicle use.",
    "Custom / Not Sure": "Let the school help you decide.",
  };
  if (!types.length) {
    return <div className="text-sm text-slate-400">Loading services…</div>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {types.map((t) => {
        const active = selected?.id === t.id;
        const name = t.name.replace(" Driving Lesson", " Lesson");
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={`group relative text-left rounded-xl p-3.5 transition-all overflow-hidden ${
              active
                ? "bg-blue-500/10 ring-2 ring-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.12),0_18px_40px_-20px_rgba(59,130,246,0.55)]"
                : "bg-white/[0.02] ring-1 ring-white/[0.08] hover:ring-white/20 hover:bg-white/[0.04]"
            }`}
          >
            {active && (
              <div className="absolute top-2.5 right-2.5 size-5 rounded-full bg-blue-500 grid place-items-center text-white shadow-md">
                <Check className="size-3" strokeWidth={3} />
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300/80">
              <Clock className="size-3" />
              {t.duration_minutes} min
            </div>
            <div className="mt-1.5 font-semibold tracking-tight text-white text-sm pr-6">
              {name}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
              {blurbs[t.name] ?? t.description ?? ""}
            </div>
            <div
              className={`mt-2 text-base font-semibold tracking-tight ${
                active ? "text-blue-200" : "text-white"
              }`}
            >
              {t.price_cents > 0 ? money(t.price_cents) : "Custom Quote"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Scheduler ---------------- */

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
    <div className="space-y-5">
      {/* Calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold tracking-tight text-white text-sm">
            {format(month, "MMMM yyyy")}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={isSameMonth(month, today)}
              className="size-8 rounded-md grid place-items-center text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              className="size-8 rounded-md grid place-items-center text-slate-300 hover:bg-white/10"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-500 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center py-1 font-semibold tracking-wider uppercase">
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
                className={`relative h-9 rounded-lg text-sm font-medium transition-all ${
                  isSel
                    ? "bg-blue-500 text-white shadow-[0_0_0_2px_rgba(59,130,246,0.3),0_8px_24px_-8px_rgba(59,130,246,0.7)]"
                    : disabled
                      ? "text-slate-700 cursor-not-allowed"
                      : isToday
                        ? "bg-blue-500/10 text-blue-200 ring-1 ring-blue-400/40 hover:bg-blue-500/20"
                        : "text-slate-200 hover:bg-white/10"
                }`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300/80">
            Available times
          </div>
          <div className="text-xs text-slate-400">
            {date ? format(date, "EEE, MMM d") : "Pick a date"}
          </div>
        </div>
        {!date ? (
          <div className="text-sm text-slate-500 py-6 text-center rounded-lg bg-white/[0.02] ring-1 ring-white/[0.05]">
            Choose a date to see open slots.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {TIME_SLOTS.map((s) => {
              const unavailable = blocked.has(s.time);
              const active = time === s.time;
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={unavailable}
                  onClick={() => onTime(s.time)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition-all ${
                    active
                      ? "bg-blue-500 text-white shadow-[0_0_0_2px_rgba(59,130,246,0.3),0_8px_20px_-8px_rgba(59,130,246,0.7)]"
                      : unavailable
                        ? "bg-white/[0.02] text-slate-600 ring-1 ring-white/[0.04] cursor-not-allowed line-through"
                        : "bg-white/[0.03] text-slate-200 ring-1 ring-white/[0.08] hover:ring-blue-400/50 hover:bg-blue-500/10"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
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

/* ---------------- Live Summary + submit ---------------- */

function SummaryCard({
  lesson,
  date,
  time,
  form,
  onSubmit,
  submitting,
}: {
  lesson: LessonType | null;
  date: Date | null;
  time: string | null;
  form: any;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const timeLabel = TIME_SLOTS.find((s) => s.time === time)?.label;
  const ready = !!(lesson && date && time && form.full_name && form.phone && form.pickup_address);

  return (
    <section className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-gradient-to-br from-[#0c1430] via-[#0a1028] to-[#070b1c] shadow-[0_30px_80px_-30px_rgba(37,99,235,0.45)]">
      <div className="p-5 sm:p-6 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300/80">
            Live summary
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-200 bg-amber-500/10 ring-1 ring-amber-400/30 rounded-full px-2.5 py-1">
            <Hourglass className="size-3" /> Pending school approval
          </span>
        </div>
        <div className="mt-3 text-lg font-semibold tracking-tight text-white">
          {lesson ? lesson.name.replace(" Driving Lesson", " Lesson") : "Select a service"}
        </div>
        <div className="text-sm text-slate-400 mt-0.5">
          {lesson ? `${lesson.duration_minutes} min` : "—"}
          {date && time && (
            <>
              {" · "}
              {format(date, "EEE, MMM d")} · {timeLabel}
            </>
          )}
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
          {lesson ? (lesson.price_cents > 0 ? money(lesson.price_cents) : "Custom Quote") : "—"}
        </div>
      </div>

      <div className="p-5 sm:p-6 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
        <Row label="Name">{form.full_name || "—"}</Row>
        <Row label="Phone">{form.phone || "—"}</Row>
        <Row label="Pickup" full>
          {form.pickup_address || "—"}
        </Row>
        {!form.dropoff_same && form.dropoff_address && (
          <Row label="Drop-off" full>
            {form.dropoff_address}
          </Row>
        )}
      </div>

      <div className="p-5 sm:p-6 pt-0">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!ready || submitting}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all ${
            ready && !submitting
              ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-400 hover:to-indigo-400 shadow-[0_12px_30px_-10px_rgba(59,130,246,0.7)]"
              : "bg-white/5 text-slate-500 ring-1 ring-white/10 cursor-not-allowed"
          }`}
        >
          {submitting ? "Sending…" : "Request Lesson Time"}
          {!submitting && <ArrowRight className="size-4" />}
        </button>
        <p className="text-[11px] text-slate-500 text-center mt-3">
          The school will confirm by phone, text, or email.
        </p>
      </div>
    </section>
  );
}

function Row({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        {label}
      </div>
      <div className="text-sm text-slate-200 mt-0.5 truncate">{children}</div>
    </div>
  );
}

/* ---------------- Inputs ---------------- */

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
      <label className="block text-xs font-medium text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-rose-400"> *</span>}
      </label>
      {children}
    </div>
  );
}

function LuxInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-2 focus:ring-blue-400/60 focus:bg-white/[0.06] outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 transition-all"
    />
  );
}

function LuxTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-2 focus:ring-blue-400/60 focus:bg-white/[0.06] outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[80px] transition-all"
    />
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
    <div className="min-h-screen bg-[#070b1c] text-slate-100 relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[700px] rounded-full bg-emerald-500/15 blur-[140px]" />
      </div>
      <TopBar school={school} />
      <main className="relative max-w-xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(16,185,129,0.4)]">
          <div className="p-8 text-center">
            <div className="mx-auto size-14 rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40 grid place-items-center">
              <CircleCheck className="size-7 text-emerald-300" />
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300 mt-5">
              Booking request received
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-2 text-white">
              Thanks, {name.split(" ")[0] || "driver"}!
            </h1>
            <p className="text-slate-400 mt-2 text-pretty max-w-md mx-auto text-sm">
              {school} will review your request and confirm by phone, text, or email.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 bg-amber-500/10 ring-1 ring-amber-400/30 rounded-full px-3 py-1">
              <Hourglass className="size-3" /> Pending school approval
            </span>
          </div>
          <div className="border-t border-white/[0.06] p-6 grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <Row label="Lesson">{lesson.name.replace(" Driving Lesson", " Lesson")}</Row>
            <Row label="Date">{format(date, "EEEE, MMM d")}</Row>
            <Row label="Time">{time}</Row>
            <Row label="Pickup" full>
              {pickup}
            </Row>
          </div>
        </div>
        <div className="text-center mt-6">
          <Link to="/" className="text-sm font-medium text-blue-300 hover:text-blue-200">
            Book another lesson
          </Link>
        </div>
        <p className="text-center text-xs text-slate-500 mt-8">
          Powered by <span className="font-semibold text-slate-300">DriveProSync</span>
        </p>
      </main>
    </div>
  );
}
