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
  Sparkles,
  LogIn,
  Lock,
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

// Luxury palette
const C = {
  bg: "#F5F3EF",
  surface: "#FFFFFF",
  formBg: "#FAFAF8",
  navy: "#1B2B4B",
  gold: "#C9A84C",
  text: "#1A1A2E",
  muted: "#6B6B7B",
  border: "#E8E4DC",
};

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
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      <TopBar school={school} />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24">
        <div className="grid gap-7 lg:grid-cols-[1.15fr_1fr]">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            <Panel eyebrow="Select service" title="Choose your lesson" icon={Sparkles}>
              <ServicePicker
                types={typesQ.data ?? []}
                selected={selected}
                onSelect={(t) => {
                  setSelected(t);
                  setSelectedTime(null);
                }}
              />
            </Panel>

            <Panel eyebrow="Student" title="Your details" icon={User} tinted>
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

            <Panel eyebrow="Pickup & drop-off" title="Where shall we meet?" icon={MapPin} tinted>
              <Field label="Pickup address" required>
                <LuxInput
                  value={form.pickup_address}
                  onChange={(v) => setForm({ ...form, pickup_address: v })}
                  placeholder="123 Street Name, City"
                />
              </Field>
              <label
                className="flex items-center gap-2.5 text-sm select-none"
                style={{ color: C.muted }}
              >
                <input
                  type="checkbox"
                  checked={form.dropoff_same}
                  onChange={(e) => setForm({ ...form, dropoff_same: e.target.checked })}
                  className="size-4"
                  style={{ accentColor: C.navy }}
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

            <Panel eyebrow="Notes" title="Anything else?" icon={ShieldCheck} tinted>
              <LuxTextarea
                value={form.notes}
                onChange={(v) => setForm({ ...form, notes: v })}
                placeholder="License level, goals, focus areas…"
              />
            </Panel>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
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

        <div className="text-center mt-12 space-y-2">
          <p className="text-xs" style={{ color: C.muted }}>
            Powered by{" "}
            <span className="font-semibold" style={{ color: C.navy }}>
              DriveProSync
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}

/* ---------------- Header ---------------- */

function TopBar({ school }: { school: string }) {
  return (
    <header
      className="bg-white"
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="size-9 rounded-lg grid place-items-center shrink-0"
            style={{ background: C.navy }}
          >
            <CarFront className="size-4.5 text-white" />
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="font-semibold tracking-tight text-[15px] truncate"
              style={{ color: C.navy }}
            >
              DriveProSync
            </span>
            <span className="h-4 w-px" style={{ background: C.border }} />
            <span
              className="text-[13px] truncate hidden sm:inline"
              style={{ color: C.muted }}
            >
              {school}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="hidden sm:inline-flex items-center gap-1.5 text-[12px]"
            style={{ color: C.muted }}
          >
            <Lock className="size-3" />
            Secure booking
          </span>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: C.navy }}
          >
            <LogIn className="size-3.5" />
            Staff login
          </Link>
        </div>
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
  tinted,
}: {
  eyebrow: string;
  title: string;
  icon?: any;
  children: React.ReactNode;
  tinted?: boolean;
}) {
  return (
    <section
      className="rounded-2xl p-6 sm:p-7"
      style={{
        background: tinted ? C.formBg : C.surface,
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 2px rgba(27,43,75,0.04), 0 8px 32px -16px rgba(27,43,75,0.08)",
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        {Icon && (
          <div
            className="size-8 rounded-lg grid place-items-center"
            style={{ background: "rgba(201,168,76,0.12)" }}
          >
            <Icon className="size-4" style={{ color: C.gold }} />
          </div>
        )}
        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: C.gold }}
          >
            {eyebrow}
          </div>
          <div
            className="font-semibold tracking-tight text-[17px] mt-1"
            style={{ color: C.text }}
          >
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
    return (
      <div className="text-sm" style={{ color: C.muted }}>
        Loading services…
      </div>
    );
  }
  const isCustom = (t: LessonType) =>
    /custom|not sure/i.test(t.name) || t.price_cents === 0;
  const regular = types.filter((t) => !isCustom(t));
  const customs = types.filter(isCustom);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {regular.map((t) => (
          <ServiceCard
            key={t.id}
            t={t}
            blurb={blurbs[t.name] ?? t.description ?? ""}
            active={selected?.id === t.id}
            onSelect={() => onSelect(t)}
          />
        ))}
      </div>
      {customs.map((t) => (
        <ServiceCard
          key={t.id}
          t={t}
          blurb={blurbs[t.name] ?? t.description ?? ""}
          active={selected?.id === t.id}
          onSelect={() => onSelect(t)}
          full
        />
      ))}
    </div>
  );
}

function ServiceCard({
  t,
  blurb,
  active,
  onSelect,
  full,
}: {
  t: LessonType;
  blurb: string;
  active: boolean;
  onSelect: () => void;
  full?: boolean;
}) {
  const name = t.name.replace(" Driving Lesson", " Lesson");
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative text-left rounded-2xl p-5 transition-all duration-200 ${
        full ? "w-full" : ""
      }`}
      style={{
        background: active ? C.navy : C.surface,
        border: `1px solid ${active ? C.navy : C.border}`,
        boxShadow: active
          ? "0 12px 32px -12px rgba(27,43,75,0.45), 0 0 0 1px rgba(201,168,76,0.25)"
          : "0 1px 2px rgba(27,43,75,0.04)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = C.formBg;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = C.surface;
      }}
    >
      {active && (
        <div
          className="absolute top-3 right-3 size-6 rounded-full grid place-items-center"
          style={{ background: C.gold, color: C.navy }}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </div>
      )}
      <div
        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] rounded-full px-2.5 py-1"
        style={{
          background: active ? "rgba(201,168,76,0.15)" : "rgba(201,168,76,0.10)",
          color: active ? C.gold : "#A8862E",
          border: `1px solid ${active ? "rgba(201,168,76,0.35)" : "rgba(201,168,76,0.20)"}`,
        }}
      >
        <Clock className="size-3" />
        {t.duration_minutes} MIN
      </div>
      <div
        className="mt-3 font-semibold tracking-tight text-[16px] pr-7"
        style={{ color: active ? "#FFFFFF" : C.text }}
      >
        {name}
      </div>
      <div
        className="text-[12px] mt-1 line-clamp-1"
        style={{ color: active ? "rgba(255,255,255,0.65)" : C.muted }}
      >
        {blurb}
      </div>
      <div
        className="mt-4 text-2xl font-bold tracking-tight"
        style={{ color: C.gold }}
      >
        {t.price_cents > 0 ? money(t.price_cents) : "Custom Quote"}
      </div>
    </button>
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
    <div className="space-y-6">
      {/* Calendar */}
      <div
        className="rounded-xl p-4"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div
            className="font-semibold tracking-tight text-[15px]"
            style={{ color: C.text }}
          >
            {format(month, "MMMM yyyy")}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={isSameMonth(month, today)}
              className="size-8 rounded-lg grid place-items-center transition-colors disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[#F5F3EF]"
              style={{ color: C.navy, border: `1px solid ${C.border}` }}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              className="size-8 rounded-lg grid place-items-center transition-colors hover:bg-[#F5F3EF]"
              style={{ color: C.navy, border: `1px solid ${C.border}` }}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div
              key={i}
              className="text-center py-1 text-[10px] tracking-widest uppercase font-semibold"
              style={{ color: C.muted }}
            >
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
            const base: React.CSSProperties = {};
            if (isSel) {
              base.background = C.navy;
              base.color = "#FFFFFF";
            } else if (isToday) {
              base.border = `1.5px solid ${C.gold}`;
              base.color = C.gold;
            } else {
              base.color = C.text;
            }
            return (
              <button
                key={d.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => onDate(d)}
                className={`relative h-10 rounded-full text-sm font-medium transition-all ${
                  disabled
                    ? "opacity-25 cursor-not-allowed"
                    : isSel
                      ? ""
                      : "hover:bg-[#F5F3EF]"
                }`}
                style={base}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: C.gold }}
          >
            Available times
          </div>
          <div className="text-xs" style={{ color: C.muted }}>
            {date ? format(date, "EEE, MMM d") : "Pick a date"}
          </div>
        </div>
        {!date ? (
          <div
            className="text-sm py-8 text-center rounded-xl"
            style={{
              color: C.muted,
              background: C.formBg,
              border: `1px solid ${C.border}`,
            }}
          >
            Choose a date to see open times.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {TIME_SLOTS.map((s) => {
              const unavailable = blocked.has(s.time);
              const active = time === s.time;
              const style: React.CSSProperties = active
                ? {
                    background: C.navy,
                    color: "#FFFFFF",
                    border: `1px solid ${C.gold}`,
                  }
                : unavailable
                  ? {
                      background: C.surface,
                      color: C.text,
                      border: `1px solid ${C.border}`,
                      opacity: 0.3,
                    }
                  : {
                      background: C.surface,
                      color: C.text,
                      border: `1px solid ${C.border}`,
                    };
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={unavailable}
                  onClick={() => onTime(s.time)}
                  className={`rounded-full px-3 py-2.5 text-xs font-semibold transition-all ${
                    unavailable
                      ? "cursor-not-allowed line-through"
                      : active
                        ? ""
                        : "hover:bg-[#FAFAF8]"
                  }`}
                  style={style}
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
    <section
      className="rounded-2xl overflow-hidden"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 2px rgba(27,43,75,0.04), 0 12px 40px -16px rgba(27,43,75,0.10)",
      }}
    >
      <div
        className="px-6 py-4"
        style={{ background: C.formBg, borderBottom: `1px solid ${C.border}` }}
      >
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: C.gold }}
        >
          Booking Summary
        </div>
      </div>

      <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div
          className="text-lg font-semibold tracking-tight"
          style={{ color: C.text }}
        >
          {lesson ? lesson.name.replace(" Driving Lesson", " Lesson") : "Select a service"}
        </div>
        <div className="text-sm mt-1" style={{ color: C.muted }}>
          {lesson ? `${lesson.duration_minutes} min` : "—"}
          {date && time && (
            <>
              {" · "}
              {format(date, "EEE, MMM d")} · {timeLabel}
            </>
          )}
        </div>
        <div
          className="mt-4 text-3xl font-bold tracking-tight"
          style={{ color: C.gold }}
        >
          {lesson ? (lesson.price_cents > 0 ? money(lesson.price_cents) : "Custom Quote") : "—"}
        </div>
      </div>

      <div className="p-6 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
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

      <div className="px-6 pb-4">
        <div
          className="rounded-lg px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{
            background: C.formBg,
            color: C.navy,
            borderLeft: `3px solid ${C.gold}`,
          }}
        >
          Pending school approval
        </div>
      </div>

      <div className="px-6 pb-6">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!ready || submitting}
          className="group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-semibold tracking-wide transition-all overflow-hidden"
          style={{
            background: C.navy,
            color: "#FFFFFF",
            border: ready && !submitting ? `1px solid ${C.gold}` : `1px solid transparent`,
            boxShadow:
              ready && !submitting
                ? "0 12px 32px -12px rgba(27,43,75,0.55), 0 0 0 1px rgba(201,168,76,0.20)"
                : "none",
            opacity: ready && !submitting ? 1 : 0.4,
            cursor: ready && !submitting ? "pointer" : "not-allowed",
          }}
        >
          {/* gold shimmer */}
          {ready && !submitting && (
            <span
              aria-hidden
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(201,168,76,0.25), transparent)",
              }}
            />
          )}
          <span className="relative">
            {submitting ? "Sending…" : "Request Lesson Time"}
          </span>
          {!submitting && <ArrowRight className="relative size-4" />}
        </button>
        <p className="text-[11px] text-center mt-3" style={{ color: C.muted }}>
          Your spot is held for 10 minutes after submitting.
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
      <div
        className="text-[10px] uppercase tracking-[0.18em] font-semibold"
        style={{ color: C.muted }}
      >
        {label}
      </div>
      <div className="text-sm mt-1 truncate" style={{ color: C.navy }}>
        {children}
      </div>
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
      <label
        className="block text-[11px] font-semibold mb-2 uppercase tracking-[0.14em]"
        style={{ color: C.muted }}
      >
        {label}
        {required && <span style={{ color: C.gold }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:opacity-50";

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
      className={inputClass}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        color: C.text,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = C.navy;
        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(27,43,75,0.10)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = "none";
      }}
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
      className={`${inputClass} min-h-[88px] resize-y`}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        color: C.text,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = C.navy;
        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(27,43,75,0.10)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = "none";
      }}
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
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      <TopBar school={school} />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-14">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            boxShadow: "0 12px 40px -16px rgba(27,43,75,0.15)",
          }}
        >
          <div className="p-10 text-center">
            <div
              className="mx-auto size-16 rounded-full grid place-items-center"
              style={{
                background: C.navy,
                boxShadow: "0 12px 32px -12px rgba(27,43,75,0.55)",
              }}
            >
              <CircleCheck className="size-8" style={{ color: C.gold }} />
            </div>
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.2em] mt-5"
              style={{ color: C.gold }}
            >
              Booking request received
            </div>
            <h1
              className="text-2xl font-semibold tracking-tight mt-3"
              style={{ color: C.text }}
            >
              Thank you, {name.split(" ")[0] || "driver"}
            </h1>
            <p
              className="mt-3 text-pretty max-w-md mx-auto text-sm"
              style={{ color: C.muted }}
            >
              {school} will review your request and confirm by phone, text, or email.
            </p>
          </div>
          <div
            className="p-7 grid sm:grid-cols-2 gap-x-8 gap-y-4"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            <Row label="Lesson">{lesson.name.replace(" Driving Lesson", " Lesson")}</Row>
            <Row label="Date">{format(date, "EEEE, MMM d")}</Row>
            <Row label="Time">{time}</Row>
            <Row label="Pickup" full>
              {pickup}
            </Row>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-sm font-semibold hover:opacity-70 transition-opacity"
            style={{ color: C.navy }}
          >
            Book another lesson
          </Link>
        </div>
        <p className="text-center text-xs mt-8" style={{ color: C.muted }}>
          Powered by{" "}
          <span className="font-semibold" style={{ color: C.navy }}>
            DriveProSync
          </span>
        </p>
      </main>
    </div>
  );
}
