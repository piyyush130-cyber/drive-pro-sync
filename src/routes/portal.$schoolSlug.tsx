import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogOut,
  MapPin,
  X,
} from "lucide-react";
import {
  requestPortalLogin,
  verifyPortalLogin,
  logoutPortalSession,
} from "@/lib/student-portal.functions";
import {
  getPortalHome,
  getPortalHistory,
  getPortalBookingOptions,
  submitPortalBooking,
  submitPortalCancellation,
} from "@/lib/student-portal-data.functions";
import { TIME_SLOTS, unavailableForDate, buildMonthGrid } from "@/lib/booking-calendar";
import { money, fmtDate, fmtTime, statusLabel, statusTone } from "@/lib/format";
import { toast } from "sonner";
import { addMonths, format, isBefore, isSameDay, isSameMonth, startOfDay, startOfMonth } from "date-fns";

export const Route = createFileRoute("/portal/$schoolSlug")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: PortalPage,
});

const C = {
  pageBg: "linear-gradient(160deg, #EFF6FF 0%, #F8FAFC 45%, #EEF2FF 100%)",
  surfaceSolid: "#FFFFFF",
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  primarySoft: "rgba(79,70,229,0.08)",
  text: "#0F172A",
  muted: "#64748B",
  mutedSoft: "#94A3B8",
  border: "rgba(226,232,240,0.9)",
  danger: "#DC2626",
  dangerBg: "rgba(254,226,226,0.7)",
};

function sessionKey(schoolSlug: string) {
  return `portal_session_${schoolSlug}`;
}

// Handles both the login-link click (?token=... in the URL, exchanged for a
// session once) and normal return visits (an existing session in
// localStorage) in one route — kept as a single file rather than a nested
// "verify" child route, since TanStack Router's file-based nesting would
// otherwise require this component to render a child via <Outlet />, which
// doesn't fit a page that's sometimes the login screen and sometimes the
// full dashboard.
function PortalPage() {
  const { schoolSlug } = Route.useParams();
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const verify = useServerFn(verifyPortalLogin);
  const verifyingRef = useRef(false);
  const [sessionToken, setSessionToken] = useState<string | null | undefined>(undefined);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      verify({ data: { token } })
        .then(({ sessionToken: newToken }) => {
          localStorage.setItem(sessionKey(schoolSlug), newToken);
          setSessionToken(newToken);
          navigate({ to: "/portal/$schoolSlug", params: { schoolSlug }, replace: true });
        })
        .catch((err: any) => setVerifyError(err?.message || "This link is invalid or has expired."));
      return;
    }
    setSessionToken(localStorage.getItem(sessionKey(schoolSlug)));
  }, [schoolSlug, token, verify, navigate]);

  function handleSignedOut() {
    localStorage.removeItem(sessionKey(schoolSlug));
    setSessionToken(null);
  }

  if (verifyError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: C.pageBg }}
      >
        <div className="text-center max-w-sm">
          <div className="text-lg font-semibold" style={{ color: C.text }}>
            Link unavailable
          </div>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>
            {verifyError}
          </p>
        </div>
      </div>
    );
  }

  if (token || sessionToken === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: C.pageBg, color: C.muted }}
      >
        {token ? "Logging you in…" : ""}
      </div>
    );
  }

  if (!sessionToken) {
    return <LoginScreen schoolSlug={schoolSlug} />;
  }

  return (
    <PortalDashboard
      schoolSlug={schoolSlug}
      sessionToken={sessionToken}
      onSignedOut={handleSignedOut}
    />
  );
}

function LoginScreen({ schoolSlug }: { schoolSlug: string }) {
  const requestLogin = useServerFn(requestPortalLogin);
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [formRenderedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact.trim()) return;
    setSubmitting(true);
    try {
      await requestLogin({ data: { schoolSlug, contact: contact.trim(), website, formRenderedAt } });
      setSent(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not send login link");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: C.pageBg, color: C.text }}
    >
      {sent ? (
        <div
          className="text-center max-w-sm rounded-2xl p-8"
          style={{ background: C.surfaceSolid, border: `1px solid ${C.border}` }}
        >
          <div
            className="size-12 rounded-full mx-auto mb-4 grid place-items-center"
            style={{ background: C.primarySoft }}
          >
            <Check className="size-6" style={{ color: C.primary }} />
          </div>
          <div className="text-lg font-semibold">Check your email or phone</div>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>
            If that email or phone is on file, we've sent a login link. It expires in 15 minutes.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-2xl p-8"
          style={{ background: C.surfaceSolid, border: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2.5 mb-6">
            <div
              className="size-9 rounded-xl grid place-items-center"
              style={{ background: C.primary }}
            >
              <CarFront className="size-4.5 text-white" />
            </div>
            <div className="text-lg font-bold">Student Portal</div>
          </div>
          <label className="block text-sm font-medium mb-1.5">Email or phone number</label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            required
            placeholder="you@example.com or (204) 555-0100"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, color: C.text }}
          />
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute opacity-0 pointer-events-none"
            style={{ left: "-9999px" }}
          />
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: C.primary }}
          >
            {submitting ? "Sending…" : "Send me a login link"}
          </button>
          <p className="mt-4 text-xs text-center" style={{ color: C.mutedSoft }}>
            No password needed — we'll text or email you a one-time link.
          </p>
          <p className="mt-2 text-[11px] text-center" style={{ color: C.mutedSoft }}>
            By continuing, you agree to our{" "}
            <a href="/terms" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              Privacy Policy
            </a>
            , including receiving texts about your bookings. Reply STOP to opt out anytime.
          </p>
        </form>
      )}
    </div>
  );
}

type PortalTab = "upcoming" | "book" | "history";

function PortalDashboard({
  schoolSlug,
  sessionToken,
  onSignedOut,
}: {
  schoolSlug: string;
  sessionToken: string;
  onSignedOut: () => void;
}) {
  const [tab, setTab] = useState<PortalTab>("upcoming");
  const getHome = useServerFn(getPortalHome);
  const logout = useServerFn(logoutPortalSession);

  const homeQ = useQuery({
    queryKey: ["portal-home", sessionToken],
    queryFn: () => getHome({ data: { sessionToken } }),
    retry: false,
  });

  useEffect(() => {
    if (homeQ.isError) onSignedOut();
  }, [homeQ.isError, onSignedOut]);

  async function handleSignOut() {
    try {
      await logout({ data: { sessionToken } });
    } catch {
      // sign out locally regardless — a failed revoke shouldn't trap the user
    }
    onSignedOut();
  }

  if (homeQ.isLoading || !homeQ.data) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: C.pageBg, color: C.muted }}
      >
        Loading…
      </div>
    );
  }

  const home = homeQ.data;

  return (
    <div className="min-h-screen" style={{ background: C.pageBg, color: C.text }}>
      <header
        className="sticky top-0 z-10"
        style={{ background: "rgba(255,255,255,0.85)", borderBottom: `1px solid ${C.border}` }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="size-9 shrink-0 rounded-xl grid place-items-center"
              style={{ background: C.primary }}
            >
              <CarFront className="size-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{home.schoolName}</div>
              <div className="text-xs truncate" style={{ color: C.muted }}>
                Hi {home.studentName?.split(" ")[0] || "there"}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm inline-flex items-center gap-1.5 shrink-0"
            style={{ color: C.muted }}
          >
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div
          className="rounded-2xl p-5 mb-6 flex items-center justify-between"
          style={{ background: C.surfaceSolid, border: `1px solid ${C.border}` }}
        >
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: C.mutedSoft }}>
              Lessons remaining
            </div>
            <div className="text-3xl font-bold mt-1" style={{ color: C.primary }}>
              {home.remaining}
            </div>
          </div>
          <button
            onClick={() => setTab("book")}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ background: C.primary }}
          >
            Book a lesson
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {(["upcoming", "book", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition"
              style={
                tab === t
                  ? { background: C.primary, color: "#fff" }
                  : { background: C.surfaceSolid, color: C.muted, border: `1px solid ${C.border}` }
              }
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "upcoming" && (
          <UpcomingTab home={home} sessionToken={sessionToken} onChanged={() => homeQ.refetch()} />
        )}
        {tab === "book" && (
          <BookTab
            sessionToken={sessionToken}
            onBooked={() => {
              homeQ.refetch();
              setTab("upcoming");
            }}
          />
        )}
        {tab === "history" && <HistoryTab sessionToken={sessionToken} />}
      </main>
    </div>
  );
}

function UpcomingTab({
  home,
  sessionToken,
  onChanged,
}: {
  home: Awaited<ReturnType<typeof getPortalHome>>;
  sessionToken: string;
  onChanged: () => void;
}) {
  const cancelBooking = useServerFn(submitPortalCancellation);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  async function handleCancel(bookingId: string, scheduledAt: string) {
    const hoursUntil = (new Date(scheduledAt).getTime() - Date.now()) / 3600000;
    const withinWindow = home.selfCancelHours > 0 && hoursUntil >= home.selfCancelHours;
    const confirmMsg = withinWindow
      ? "Cancel this lesson?"
      : `This is inside your school's ${home.selfCancelHours || 0}-hour cancellation window — this will be sent to your school for approval instead of cancelling right away. Continue?`;
    if (!window.confirm(confirmMsg)) return;

    setCancelingId(bookingId);
    try {
      const res = await cancelBooking({ data: { sessionToken, booking_id: bookingId } });
      toast.success(res.mode === "cancelled" ? "Lesson cancelled" : "Cancellation request sent to your school");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Could not cancel this lesson");
    } finally {
      setCancelingId(null);
    }
  }

  if (home.upcoming.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center text-sm"
        style={{ background: C.surfaceSolid, border: `1px solid ${C.border}`, color: C.muted }}
      >
        No upcoming lessons booked yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {home.upcoming.map((b: any) => (
        <div
          key={b.id}
          className="rounded-2xl p-4"
          style={{ background: C.surfaceSolid, border: `1px solid ${C.border}` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                {fmtDate(b.scheduled_at)} · {fmtTime(b.scheduled_at)}
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                {b.lesson_types?.name ?? "Lesson"}
                {b.instructors?.full_name ? ` · ${b.instructors.full_name}` : " · Unassigned"}
              </div>
              {b.pickup_address && (
                <div
                  className="text-xs mt-1.5 inline-flex items-center gap-1"
                  style={{ color: C.muted }}
                >
                  <MapPin className="size-3" /> {b.pickup_address}
                </div>
              )}
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${statusTone[b.status] ?? ""}`}
            >
              {statusLabel(b.status)}
            </span>
          </div>
          <button
            onClick={() => handleCancel(b.id, b.scheduled_at)}
            disabled={cancelingId === b.id}
            className="mt-3 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
            style={{ color: C.danger }}
          >
            <X className="size-3.5" /> {cancelingId === b.id ? "Cancelling…" : "Cancel lesson"}
          </button>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ sessionToken }: { sessionToken: string }) {
  const getHistory = useServerFn(getPortalHistory);
  const historyQ = useQuery({
    queryKey: ["portal-history", sessionToken],
    queryFn: () => getHistory({ data: { sessionToken } }),
  });

  const list = historyQ.data ?? [];
  if (historyQ.isLoading) return null;
  if (list.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center text-sm"
        style={{ background: C.surfaceSolid, border: `1px solid ${C.border}`, color: C.muted }}
      >
        No past lessons yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((b: any) => (
        <div
          key={b.id}
          className="rounded-2xl p-4"
          style={{ background: C.surfaceSolid, border: `1px solid ${C.border}` }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                {fmtDate(b.scheduled_at)} · {fmtTime(b.scheduled_at)}
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                {b.lesson_types?.name ?? "Lesson"}
                {b.instructors?.full_name ? ` · ${b.instructors.full_name}` : ""}
              </div>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusTone[b.status] ?? ""}`}>
              {statusLabel(b.status)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

type LessonType = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  category: string;
};

function BookTab({
  sessionToken,
  onBooked,
}: {
  sessionToken: string;
  onBooked: () => void;
}) {
  const getOptions = useServerFn(getPortalBookingOptions);
  const bookLesson = useServerFn(submitPortalBooking);

  const optionsQ = useQuery({
    queryKey: ["portal-book-options", sessionToken],
    queryFn: () => getOptions({ data: { sessionToken } }),
  });

  const [selected, setSelected] = useState<LessonType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [mpiLocation, setMpiLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
          sessionToken,
          lesson_type_id: selected.id,
          scheduled_at: dt.toISOString(),
          mpi_test_location: mpiLocation.trim() || null,
        },
      });
      toast.success("Lesson booked");
      onBooked();
    } catch (err: any) {
      toast.error(err?.message || "Could not book this lesson");
    } finally {
      setSubmitting(false);
    }
  }

  if (optionsQ.isLoading || !optionsQ.data) return null;

  if (optionsQ.data.bookingPaused) {
    return (
      <div
        className="rounded-2xl p-8 text-center text-sm"
        style={{ background: C.surfaceSolid, border: `1px solid ${C.border}`, color: C.muted }}
      >
        This school isn't accepting new bookings right now. Please check back later.
      </div>
    );
  }

  if (optionsQ.data.remaining <= 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center text-sm"
        style={{ background: C.surfaceSolid, border: `1px solid ${C.border}`, color: C.muted }}
      >
        You have no remaining lessons in your package. Contact your school to purchase more.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-5"
        style={{ background: C.surfaceSolid, border: `1px solid ${C.border}` }}
      >
        <h2 className="text-sm font-semibold mb-3">Choose your lesson</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {optionsQ.data.lessonTypes.map((lt: LessonType) => {
            const active = selected?.id === lt.id;
            return (
              <button
                key={lt.id}
                type="button"
                onClick={() => setSelected(lt)}
                className="text-left rounded-lg p-3 border transition"
                style={
                  active
                    ? { borderColor: C.primary, background: C.primarySoft }
                    : { borderColor: C.border }
                }
              >
                <div
                  className="text-xs inline-flex items-center gap-1"
                  style={{ color: C.muted }}
                >
                  <Clock className="size-3" /> {lt.duration_minutes} min
                </div>
                <div className="text-sm font-semibold mt-1">{lt.name}</div>
                <div className="text-sm font-medium mt-1" style={{ color: C.primary }}>
                  {lt.price_cents > 0 ? money(lt.price_cents) : "Included in package"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: C.surfaceSolid, border: `1px solid ${C.border}` }}
      >
        <h2 className="text-sm font-semibold mb-3">Pick a date &amp; time</h2>
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-sm">{format(month, "MMMM yyyy")}</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={isSameMonth(month, today)}
              className="size-8 rounded-lg grid place-items-center border disabled:opacity-25"
              style={{ borderColor: C.border }}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              className="size-8 rounded-lg grid place-items-center border"
              style={{ borderColor: C.border }}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div
              key={i}
              className="text-center py-1 text-[10px] uppercase font-semibold"
              style={{ color: C.mutedSoft }}
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
                }`}
                style={isSel ? { background: C.primary, color: "#fff" } : { color: C.text }}
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
                    unavailable ? "opacity-40 line-through" : ""
                  }`}
                  style={
                    active
                      ? { background: C.primary, color: "#fff", borderColor: C.primary }
                      : { borderColor: C.border }
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {needsMpiLocation && (
        <div
          className="rounded-2xl p-5"
          style={{ background: C.surfaceSolid, border: `1px solid ${C.border}` }}
        >
          <h2 className="text-sm font-semibold mb-3">MPI test location</h2>
          {optionsQ.data.mpiTestLocations.length > 0 ? (
            <select
              value={mpiLocation}
              onChange={(e) => setMpiLocation(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: C.border }}
            >
              <option value="">Select a location…</option>
              {optionsQ.data.mpiTestLocations.map((loc: string) => (
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
              className="w-full border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: C.border }}
            />
          )}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: C.primary }}
      >
        {submitting ? "Booking…" : "Book this lesson"}
      </button>
    </div>
  );
}
