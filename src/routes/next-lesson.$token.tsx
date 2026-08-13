import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CarFront, Check, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
  addMonths,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { getInvitationForToken, submitTokenBooking } from "@/lib/token-booking.functions";
import { TIME_SLOTS, unavailableForDate, buildMonthGrid } from "@/lib/booking-calendar";
import { money } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/next-lesson/$token")({
  component: NextLessonPage,
});

type LessonType = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  category: string;
};

function NextLessonPage() {
  const { token } = Route.useParams();
  const getInvitation = useServerFn(getInvitationForToken);
  const bookLesson = useServerFn(submitTokenBooking);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<{
    firstName: string;
    remaining: number;
    schoolName: string;
    lessonTypes: LessonType[];
    bookingPaused: boolean;
    mpiTestLocations: string[];
    onlinePaymentUrl: string | null;
    hasFemaleInstructor: boolean;
  } | null>(null);

  useEffect(() => {
    getInvitation({ data: { token } })
      .then((data) => setInfo(data))
      .catch((err: any) => setLoadError(err?.message || "This link is no longer valid."))
      .finally(() => setLoading(false));
  }, [token]);

  const [selected, setSelected] = useState<LessonType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [mpiLocation, setMpiLocation] = useState("");
  const [femaleInstructorOnly, setFemaleInstructorOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const needsMpiLocation =
    selected?.category === "road_test" ||
    selected?.category === "tsr_retest" ||
    selected?.category === "car_rental";

  const today = startOfDay(new Date());
  const [month, setMonth] = useState(startOfMonth(today));
  const days = useMemo(() => buildMonthGrid(month), [month]);
  const blocked = useMemo(
    () => (selectedDate ? unavailableForDate(selectedDate) : new Set<string>()),
    [selectedDate],
  );

  async function handleSubmit() {
    if (!selected || !selectedDate || !selectedTime) {
      toast.error("Please choose a lesson, date, and time.");
      return;
    }
    setSubmitting(true);
    try {
      const [h, m] = selectedTime.split(":").map(Number);
      const dt = new Date(selectedDate);
      dt.setHours(h, m, 0, 0);
      await bookLesson({
        data: {
          token,
          lesson_type_id: selected.id,
          scheduled_at: dt.toISOString(),
          mpi_test_location: mpiLocation.trim() || null,
          female_instructor_only: femaleInstructorOnly,
        },
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not book your lesson");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="text-lg font-semibold text-slate-900">Link unavailable</div>
          <p className="mt-2 text-sm text-slate-500">{loadError}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="size-14 rounded-full bg-emerald-100 grid place-items-center mx-auto mb-4">
            <Check className="size-7 text-emerald-600" />
          </div>
          <div className="text-lg font-semibold text-slate-900">You're all set!</div>
          <p className="mt-2 text-sm text-slate-500">
            {info.schoolName} will be in touch to confirm your lesson.
          </p>
          {info.onlinePaymentUrl && (
            <a
              href={info.onlinePaymentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Pay online
            </a>
          )}
        </div>
      </div>
    );
  }

  if (info.bookingPaused) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="text-lg font-semibold text-slate-900">Not accepting bookings</div>
          <p className="mt-2 text-sm text-slate-500">
            {info.schoolName} isn't accepting new bookings right now. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  if (info.remaining <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="text-lg font-semibold text-slate-900">No remaining lessons</div>
          <p className="mt-2 text-sm text-slate-500">
            Contact {info.schoolName} directly to purchase more lessons.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-indigo-600 grid place-items-center">
            <CarFront className="size-4.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{info.schoolName}</div>
            <div className="text-xs text-slate-500">
              Hi {info.firstName} — you have {info.remaining} lesson
              {info.remaining === 1 ? "" : "s"} remaining
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Choose your lesson</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {info.lessonTypes.map((lt) => {
              const active = selected?.id === lt.id;
              return (
                <button
                  key={lt.id}
                  type="button"
                  onClick={() => setSelected(lt)}
                  className={`text-left rounded-lg p-3 border transition ${
                    active
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                    <Clock className="size-3" /> {lt.duration_minutes} min
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{lt.name}</div>
                  <div className="text-sm text-indigo-600 font-medium mt-1">
                    {lt.price_cents > 0 ? money(lt.price_cents) : "Custom quote"}
                  </div>
                </button>
              );
            })}
          </div>
          {selected?.description && (
            <p className="mt-3 text-xs text-slate-500 whitespace-pre-wrap">
              {selected.description}
            </p>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Pick a date & time</h2>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm text-slate-900">{format(month, "MMMM yyyy")}</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMonth(addMonths(month, -1))}
                disabled={isSameMonth(month, today)}
                className="size-8 rounded-lg grid place-items-center border border-slate-200 disabled:opacity-25"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMonth(addMonths(month, 1))}
                className="size-8 rounded-lg grid place-items-center border border-slate-200"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div
                key={i}
                className="text-center py-1 text-[10px] uppercase font-semibold text-slate-400"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {days.map((d) => {
              const inMonth = isSameMonth(d, month);
              const isPast = isBefore(d, today);
              const isSel = selectedDate && isSameDay(d, selectedDate);
              const disabled = !inMonth || isPast;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setSelectedDate(d);
                    setSelectedTime(null);
                  }}
                  className={`h-9 rounded-full text-sm font-medium transition ${
                    disabled ? "opacity-25 cursor-not-allowed" : ""
                  } ${isSel ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {selectedDate && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {TIME_SLOTS.map((s) => {
                const unavailable = blocked.has(s.time);
                const active = selectedTime === s.time;
                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={unavailable}
                    onClick={() => setSelectedTime(s.time)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold border transition ${
                      active
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : unavailable
                          ? "opacity-40 line-through border-slate-200"
                          : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {needsMpiLocation && (
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">MPI test location</h2>
            {info.mpiTestLocations.length > 0 ? (
              <select
                value={mpiLocation}
                onChange={(e) => setMpiLocation(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select a location…</option>
                {info.mpiTestLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={mpiLocation}
                onChange={(e) => setMpiLocation(e.target.value)}
                placeholder="Which MPI office is your test at?"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            )}
          </section>
        )}

        {info.hasFemaleInstructor && (
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <label className="flex items-center gap-2.5 text-sm text-slate-700 select-none">
              <input
                type="checkbox"
                checked={femaleInstructorOnly}
                onChange={(e) => setFemaleInstructorOnly(e.target.checked)}
                className="size-4 accent-indigo-600"
              />
              Female instructor only
            </label>
          </section>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Booking…" : "Book this lesson"}
        </button>
        <p className="text-[11px] text-center text-slate-400">
          By booking, you agree to our{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
            Privacy Policy
          </a>
          , including receiving text messages about your booking. Reply STOP to opt out anytime.
        </p>
      </main>
    </div>
  );
}
