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
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { submitPublicBooking } from "@/lib/public-booking.functions";
import { money } from "@/lib/format";
import { type BookingFormErrors, formatPhone, validateBookingForm } from "@/lib/booking-validation";
import { TIME_SLOTS, unavailableForDate, buildMonthGrid } from "@/lib/booking-calendar";
import { toast } from "sonner";

export const Route = createFileRoute("/$schoolSlug")({
  component: BookingPage,
});

type LessonType = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  pickup_available: boolean;
  category: string;
};
type Settings = {
  school_name: string;
  booking_paused?: boolean;
  pickup_service_areas?: string[];
  cancellation_policy?: string | null;
  mpi_test_locations?: string[];
  theory_lessons_enabled?: boolean;
  vehicle_rental_enabled?: boolean;
};

// Light premium glass palette
const C = {
  pageBg: "linear-gradient(160deg, #EFF6FF 0%, #F8FAFC 45%, #EEF2FF 100%)",
  surface: "rgba(255,255,255,0.78)",
  surfaceSolid: "#FFFFFF",
  surfaceTint: "rgba(248,250,252,0.85)",
  primary: "#4F46E5", // indigo-600
  primaryDark: "#4338CA", // indigo-700
  primarySoft: "rgba(79,70,229,0.08)",
  accent: "#0EA5E9", // sky-500
  text: "#0F172A", // slate-900
  muted: "#64748B", // slate-500
  mutedSoft: "#94A3B8", // slate-400
  border: "rgba(226,232,240,0.9)", // slate-200
  borderStrong: "#CBD5E1", // slate-300
  danger: "#DC2626",
  dangerBg: "rgba(254,226,226,0.7)",
};

type Errors = BookingFormErrors;

function BookingPage() {
  const { schoolSlug } = Route.useParams();

  const schoolQ = useQuery({
    queryKey: ["public-school", schoolSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id,name,slug")
        .eq("slug", schoolSlug)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; slug: string } | null;
    },
  });
  const schoolId = schoolQ.data?.id;

  const settingsQ = useQuery({
    queryKey: ["public-settings", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select(
          "school_name, booking_paused, pickup_service_areas, cancellation_policy, mpi_test_locations, theory_lessons_enabled, vehicle_rental_enabled",
        )
        .eq("school_id", schoolId as string)
        .maybeSingle();
      return (data as Settings | null) ?? { school_name: schoolQ.data?.name ?? "Driving School" };
    },
  });
  const typesQ = useQuery({
    queryKey: ["public-lesson-types", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_types")
        .select("id,name,description,duration_minutes,price_cents,pickup_available,category")
        .eq("school_id", schoolId as string)
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
    postal_code: "",
    mpi_test_location: "",
    dropoff_same: true,
    dropoff_address: "",
    pickup_notes: "",
    notes: "",
    website: "", // honeypot — real users never see or fill this field
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formRenderedAt] = useState(() => Date.now());

  const submit = useServerFn(submitPublicBooking);
  const school = settingsQ.data?.school_name ?? "Standard Driving School";

  if (!schoolQ.isLoading && schoolQ.data === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: C.pageBg }}
      >
        <div className="text-center max-w-sm">
          <div className="text-lg font-semibold" style={{ color: C.text }}>
            We couldn't find that driving school.
          </div>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>
            Double-check the link your school gave you, or contact them directly to confirm your
            booking page.
          </p>
        </div>
      </div>
    );
  }

  if (settingsQ.data?.booking_paused) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: C.pageBg }}
      >
        <div className="text-center max-w-sm">
          <div className="text-lg font-semibold" style={{ color: C.text }}>
            {school} isn't accepting new bookings right now.
          </div>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>
            Please check back later, or contact the school directly.
          </p>
        </div>
      </div>
    );
  }

  const pickupAvailable = selected?.pickup_available !== false;

  function validate(): Errors {
    return validateBookingForm({
      hasSelectedService: !!selected,
      hasSelectedDate: !!selectedDate,
      hasSelectedTime: !!selectedTime,
      full_name: form.full_name,
      phone: form.phone,
      email: form.email,
      pickup_address: form.pickup_address,
      postal_code: form.postal_code,
      pickupAvailable: selected?.pickup_available !== false,
      serviceAreas: settingsQ.data?.pickup_service_areas ?? [],
    });
  }

  async function handleSubmit() {
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) {
      return;
    }
    setSubmitting(true);
    try {
      const [h, m] = selectedTime!.split(":").map(Number);
      const dt = new Date(selectedDate!);
      dt.setHours(h, m, 0, 0);
      await submit({
        data: {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email.trim(),
          pickup_address: form.pickup_address.trim(),
          postal_code: form.postal_code.trim(),
          mpi_test_location: form.mpi_test_location.trim() || null,
          dropoff_address: form.dropoff_same ? form.pickup_address : form.dropoff_address,
          notes:
            [form.pickup_notes && `Pickup: ${form.pickup_notes}`, form.notes]
              .filter(Boolean)
              .join("\n") || null,
          lesson_type_id: selected!.id,
          scheduled_at: dt.toISOString(),
          school_id: schoolId as string,
          website: form.website,
          formRenderedAt,
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
    <div
      className="public-booking-page min-h-screen"
      style={{ background: C.pageBg, color: C.text }}
    >
      <TopBar school={school} />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24">
        <div
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 size-[420px] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(79,70,229,0.16) 0%, rgba(14,165,233,0.08) 55%, transparent 75%)",
          }}
        />
        <div className="relative mb-9 sm:mb-11 max-w-2xl">
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] rounded-full px-3 py-1 mb-4"
            style={{
              background: C.primarySoft,
              color: C.primary,
              border: `1px solid rgba(79,70,229,0.18)`,
            }}
          >
            <CarFront className="size-3" />
            {school}
          </div>
          <h1
            className="text-[32px] sm:text-[40px] leading-[1.08] tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: C.text }}
          >
            Book your driving lesson
            <span style={{ color: C.primary }}>.</span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: C.muted }}>
            Pick a lesson, choose a time, and you're on the road — no calls, no waiting on a
            callback.
          </p>
        </div>

        <div className="relative grid gap-7 lg:grid-cols-[1.15fr_1fr]">
          {/* LEFT */}
          <div className="space-y-6">
            <Panel eyebrow="Select service" title="Choose your lesson" icon={Sparkles}>
              <ServicePicker
                types={(typesQ.data ?? []).filter((t) => {
                  if (t.category === "theory") return !!settingsQ.data?.theory_lessons_enabled;
                  if (t.category === "road_test" || t.category === "car_rental")
                    return !!settingsQ.data?.vehicle_rental_enabled;
                  return true;
                })}
                selected={selected}
                onSelect={(t) => {
                  setSelected(t);
                  setSelectedTime(null);
                  setErrors((e) => ({ ...e, service: undefined }));
                }}
              />
              {errors.service && <InlineError msg={errors.service} />}
            </Panel>

            <Panel eyebrow="Student" title="Your details" icon={User}>
              {/* Honeypot — invisible to real users, tempting to bots that auto-fill every field */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                }}
              >
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name" required error={errors.full_name}>
                  <GlassInput
                    value={form.full_name}
                    invalid={!!errors.full_name}
                    onChange={(v) => {
                      setForm({ ...form, full_name: v });
                      if (errors.full_name) setErrors((e) => ({ ...e, full_name: undefined }));
                    }}
                    placeholder="Sarah Jenkins"
                  />
                </Field>
                <Field label="Phone" required error={errors.phone}>
                  <GlassInput
                    type="tel"
                    value={form.phone}
                    invalid={!!errors.phone}
                    onChange={(v) => {
                      setForm({ ...form, phone: formatPhone(v) });
                      if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
                    }}
                    placeholder="(555) 000-0000"
                  />
                </Field>
              </div>
              <Field label="Email" required error={errors.email}>
                <GlassInput
                  type="email"
                  value={form.email}
                  invalid={!!errors.email}
                  onChange={(v) => {
                    setForm({ ...form, email: v });
                    if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                  }}
                  placeholder="you@example.com"
                />
              </Field>
            </Panel>

            {pickupAvailable ? (
              <Panel eyebrow="Pickup & drop-off" title="Where shall we meet?" icon={MapPin}>
                <Field label="Pickup address" required error={errors.pickup_address}>
                  <GlassInput
                    value={form.pickup_address}
                    invalid={!!errors.pickup_address}
                    onChange={(v) => {
                      setForm({ ...form, pickup_address: v });
                      if (errors.pickup_address)
                        setErrors((e) => ({ ...e, pickup_address: undefined }));
                    }}
                    placeholder="123 Street Name, City"
                  />
                </Field>
                <Field label="Postal code" required error={errors.postal_code}>
                  <GlassInput
                    value={form.postal_code}
                    invalid={!!errors.postal_code}
                    onChange={(v) => {
                      setForm({ ...form, postal_code: v });
                      if (errors.postal_code) setErrors((e) => ({ ...e, postal_code: undefined }));
                    }}
                    onBlur={() => {
                      if (!form.postal_code.trim()) return;
                      const { postal_code } = validateBookingForm({
                        hasSelectedService: true,
                        hasSelectedDate: true,
                        hasSelectedTime: true,
                        full_name: "x",
                        phone: "1234567890",
                        email: "x@x.com",
                        pickup_address: "x",
                        postal_code: form.postal_code,
                        pickupAvailable: true,
                        serviceAreas: settingsQ.data?.pickup_service_areas ?? [],
                      });
                      setErrors((e) => ({ ...e, postal_code }));
                    }}
                    placeholder="R2C 1A1"
                  />
                </Field>
                {(selected?.category === "road_test" ||
                  selected?.category === "tsr_retest" ||
                  selected?.category === "car_rental") && (
                  <Field label="MPI test location">
                    {(settingsQ.data?.mpi_test_locations?.length ?? 0) > 0 ? (
                      <select
                        value={form.mpi_test_location}
                        onChange={(e) => setForm({ ...form, mpi_test_location: e.target.value })}
                        className={inputClass}
                        style={{ background: C.surfaceSolid, border: `1px solid ${C.border}`, color: C.text }}
                      >
                        <option value="">Select a location…</option>
                        {settingsQ.data!.mpi_test_locations!.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <GlassInput
                        value={form.mpi_test_location}
                        onChange={(v) => setForm({ ...form, mpi_test_location: v })}
                        placeholder="Which MPI office is your test at?"
                      />
                    )}
                  </Field>
                )}
                <label
                  className="flex items-center gap-2.5 text-sm select-none"
                  style={{ color: C.muted }}
                >
                  <input
                    type="checkbox"
                    checked={form.dropoff_same}
                    onChange={(e) => setForm({ ...form, dropoff_same: e.target.checked })}
                    className="size-4"
                    style={{ accentColor: C.primary }}
                  />
                  Drop-off same as pickup
                </label>
                {!form.dropoff_same && (
                  <Field label="Drop-off address">
                    <GlassInput
                      value={form.dropoff_address}
                      onChange={(v) => setForm({ ...form, dropoff_address: v })}
                      placeholder="Drop-off address"
                    />
                  </Field>
                )}
                <Field label="Pickup notes">
                  <GlassTextarea
                    value={form.pickup_notes}
                    onChange={(v) => setForm({ ...form, pickup_notes: v })}
                    placeholder="Apartment buzzer, school entrance, meet outside…"
                  />
                </Field>
              </Panel>
            ) : (
              <Panel eyebrow="Pickup & drop-off" title="Where shall we meet?" icon={MapPin}>
                <p className="text-sm" style={{ color: C.muted }}>
                  This lesson requires in-person pickup at our location — no drive-to-you service
                  for this one.
                </p>
              </Panel>
            )}

            <Panel eyebrow="Notes" title="Anything else?" icon={ShieldCheck}>
              <GlassTextarea
                value={form.notes}
                onChange={(v) => setForm({ ...form, notes: v })}
                placeholder="License level, goals, focus areas…"
              />
            </Panel>
          </div>

          {/* RIGHT */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <Panel eyebrow="Schedule" title="Pick a date & time">
              <Scheduler
                date={selectedDate}
                time={selectedTime}
                onDate={(d) => {
                  setSelectedDate(d);
                  setSelectedTime(null);
                  setErrors((e) => ({ ...e, date: undefined, time: undefined }));
                }}
                onTime={(t) => {
                  setSelectedTime(t);
                  setErrors((e) => ({ ...e, time: undefined }));
                }}
              />
              {errors.date && <InlineError msg={errors.date} />}
              {errors.time && <InlineError msg={errors.time} />}
            </Panel>

            {settingsQ.data?.cancellation_policy && (
              <div
                className="rounded-2xl p-4 text-xs"
                style={{ background: C.surfaceTint, border: `1px solid ${C.border}`, color: C.muted }}
              >
                <span className="font-semibold" style={{ color: C.text }}>
                  Cancellation policy:
                </span>{" "}
                {settingsQ.data.cancellation_policy}
              </div>
            )}

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
            <span className="font-semibold" style={{ color: C.primary }}>
              DrivingOps
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
      style={{
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="size-9 rounded-xl grid place-items-center shrink-0"
            style={{ background: C.primary, boxShadow: "0 6px 16px -6px rgba(79,70,229,0.55)" }}
          >
            <CarFront className="size-4.5" style={{ color: "#fff" }} />
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="font-semibold tracking-tight text-[15px] truncate"
              style={{ color: C.text }}
            >
              DrivingOps
            </span>
            <span className="h-4 w-px" style={{ background: C.border }} />
            <span className="text-[13px] truncate hidden sm:inline" style={{ color: C.muted }}>
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
            style={{ color: C.primary }}
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
}: {
  eyebrow: string;
  title: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl p-6 sm:p-7"
      style={{
        background: C.surface,
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 12px 40px -20px rgba(15,23,42,0.08)",
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        {Icon && (
          <div
            className="size-8 rounded-lg grid place-items-center"
            style={{ background: C.primarySoft }}
          >
            <Icon className="size-4" style={{ color: C.primary }} />
          </div>
        )}
        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: C.primary }}
          >
            {eyebrow}
          </div>
          <div
            className="tracking-tight text-[19px] mt-1"
            style={{ fontFamily: "var(--font-display)", color: C.text }}
          >
            {title}
          </div>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function InlineError({ msg }: { msg: string }) {
  return (
    <p className="text-xs mt-2" style={{ color: C.danger }}>
      {msg}
    </p>
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
    "TSR / Retest Package": "MPI-required instruction hours after a road test fail.",
    "Custom / Not Sure": "Let the school help you decide.",
  };
  if (!types.length) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-5 h-[118px]"
            style={{ background: C.surfaceTint, border: `1px solid ${C.border}` }}
          />
        ))}
      </div>
    );
  }
  const isCustom = (t: LessonType) => /custom|not sure/i.test(t.name) || t.price_cents === 0;
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
      className={`group relative text-left rounded-2xl p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 ${
        full ? "w-full" : ""
      }`}
      style={{
        background: active ? C.primarySoft : C.surfaceSolid,
        border: `1px solid ${active ? C.primary : C.border}`,
        boxShadow: active
          ? "0 14px 32px -14px rgba(79,70,229,0.4)"
          : "0 1px 2px rgba(15,23,42,0.04)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = C.borderStrong;
          e.currentTarget.style.boxShadow = "0 12px 24px -14px rgba(15,23,42,0.12)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,0.04)";
        }
      }}
    >
      {active && (
        <div
          className="absolute top-3 right-3 size-6 rounded-full grid place-items-center"
          style={{ background: C.primary, color: "#fff" }}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </div>
      )}
      <div
        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] rounded-full px-2.5 py-1"
        style={{
          background: C.primarySoft,
          color: C.primary,
          border: `1px solid rgba(79,70,229,0.18)`,
        }}
      >
        <Clock className="size-3" />
        {t.duration_minutes} MIN
      </div>
      <div className="mt-3 font-semibold tracking-tight text-[16px] pr-7" style={{ color: C.text }}>
        {name}
      </div>
      <div className="text-[12px] mt-1 line-clamp-1" style={{ color: C.muted }}>
        {blurb}
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight" style={{ color: C.text }}>
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
        style={{ background: C.surfaceSolid, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold tracking-tight text-[15px]" style={{ color: C.text }}>
            {format(month, "MMMM yyyy")}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={isSameMonth(month, today)}
              className="size-8 rounded-lg grid place-items-center transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
              style={{ color: C.primary, border: `1px solid ${C.border}` }}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              className="size-8 rounded-lg grid place-items-center transition-colors"
              style={{ color: C.primary, border: `1px solid ${C.border}` }}
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
              base.background = C.primary;
              base.color = "#FFFFFF";
            } else if (isToday) {
              base.border = `1.5px solid ${C.primary}`;
              base.color = C.primary;
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
                  disabled ? "opacity-25 cursor-not-allowed" : ""
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
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: C.primary }}
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
              background: C.surfaceTint,
              border: `1px dashed ${C.border}`,
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
                    background: C.primary,
                    color: "#FFFFFF",
                    border: `1px solid ${C.primary}`,
                  }
                : unavailable
                  ? {
                      background: C.surfaceSolid,
                      color: C.muted,
                      border: `1px solid ${C.border}`,
                      opacity: 0.45,
                    }
                  : {
                      background: C.surfaceSolid,
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
                    unavailable ? "cursor-not-allowed line-through" : ""
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

/* ---------------- Summary ---------------- */

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

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{
        background: C.surface,
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 16px 40px -20px rgba(15,23,42,0.12)",
      }}
    >
      <div
        className="px-6 py-4"
        style={{
          background: C.surfaceTint,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: C.primary }}
        >
          Booking Summary
        </div>
      </div>

      <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-lg font-semibold tracking-tight" style={{ color: C.text }}>
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
        <div className="mt-4 text-3xl font-bold tracking-tight" style={{ color: C.text }}>
          {lesson ? (lesson.price_cents > 0 ? money(lesson.price_cents) : "Custom Quote") : "—"}
        </div>
      </div>

      <div className="p-6 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
        <Row label="Name">{form.full_name || "—"}</Row>
        <Row label="Phone">{form.phone || "—"}</Row>
        <Row label="Email" full>
          {form.email || "—"}
        </Row>
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
            background: C.primarySoft,
            color: C.primary,
            borderLeft: `3px solid ${C.primary}`,
          }}
        >
          Pending school approval
        </div>
      </div>

      <div className="px-6 pb-6">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold tracking-wide transition-all duration-200 ease-out hover:enabled:-translate-y-0.5 active:enabled:translate-y-0"
          style={{
            background: submitting
              ? C.mutedSoft
              : `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`,
            color: "#FFFFFF",
            boxShadow: submitting ? "none" : "0 12px 28px -12px rgba(79,70,229,0.55)",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!submitting)
              e.currentTarget.style.boxShadow = "0 16px 34px -12px rgba(79,70,229,0.65)";
          }}
          onMouseLeave={(e) => {
            if (!submitting)
              e.currentTarget.style.boxShadow = "0 12px 28px -12px rgba(79,70,229,0.55)";
          }}
        >
          {submitting ? "Sending…" : "Request Lesson Time"}
          {!submitting && <ArrowRight className="size-4" />}
        </button>
        <p className="text-[11px] text-center mt-3" style={{ color: C.muted }}>
          Your spot is held for 10 minutes after submitting.
        </p>
        <p className="text-[11px] text-center mt-2" style={{ color: C.mutedSoft }}>
          By requesting this lesson, you agree to our{" "}
          <a href="/terms" target="_blank" rel="noreferrer" style={{ color: C.muted, textDecoration: "underline" }}>
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: C.muted, textDecoration: "underline" }}>
            Privacy Policy
          </a>
          , including receiving text messages about your booking. Reply STOP to opt out anytime.
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
        style={{ color: C.mutedSoft }}
      >
        {label}
      </div>
      <div className="text-sm mt-1 truncate" style={{ color: C.text }}>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Inputs ---------------- */

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[11px] font-semibold mb-2 uppercase tracking-[0.14em]"
        style={{ color: C.muted }}
      >
        {label}
        {required && <span style={{ color: C.danger }}> *</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs mt-1.5" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:opacity-50";

function GlassInput({
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  invalid?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputClass}
      style={{
        background: C.surfaceSolid,
        border: `1px solid ${invalid ? C.danger : C.border}`,
        color: C.text,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = invalid ? C.danger : C.primary;
        e.currentTarget.style.boxShadow = invalid
          ? `0 0 0 3px rgba(220,38,38,0.12)`
          : `0 0 0 3px rgba(79,70,229,0.12)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = invalid ? C.danger : C.border;
        e.currentTarget.style.boxShadow = "none";
        onBlur?.();
      }}
    />
  );
}

function GlassTextarea({
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
        background: C.surfaceSolid,
        border: `1px solid ${C.border}`,
        color: C.text,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = C.primary;
        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(79,70,229,0.12)`;
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
    <div
      className="public-booking-page min-h-screen"
      style={{ background: C.pageBg, color: C.text }}
    >
      <TopBar school={school} />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-14">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: C.surface,
            backdropFilter: "saturate(180%) blur(12px)",
            WebkitBackdropFilter: "saturate(180%) blur(12px)",
            border: `1px solid ${C.border}`,
            boxShadow: "0 16px 40px -20px rgba(15,23,42,0.18)",
          }}
        >
          <div className="p-10 text-center">
            <div
              className="mx-auto size-16 rounded-full grid place-items-center"
              style={{
                background: C.primary,
                boxShadow: "0 12px 32px -12px rgba(79,70,229,0.55)",
              }}
            >
              <CircleCheck className="size-8" style={{ color: "#fff" }} />
            </div>
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.18em] mt-5"
              style={{ color: C.primary }}
            >
              Booking request received
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-3" style={{ color: C.text }}>
              Thank you, {name.split(" ")[0] || "driver"}
            </h1>
            <p className="mt-3 text-pretty max-w-md mx-auto text-sm" style={{ color: C.muted }}>
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
            style={{ color: C.primary }}
          >
            Book another lesson
          </Link>
        </div>
        <p className="text-center text-xs mt-8" style={{ color: C.muted }}>
          Powered by{" "}
          <span className="font-semibold" style={{ color: C.primary }}>
            DrivingOps
          </span>
        </p>
      </main>
    </div>
  );
}
