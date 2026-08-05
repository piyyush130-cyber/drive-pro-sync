import { createFileRoute, Link } from "@tanstack/react-router";
import { CarFront, CalendarCheck, Users, CreditCard, Clock, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Online booking",
    body: "A branded booking page for every school — students book lessons without calling.",
    tint: "#C9A84C",
    tintBg: "rgba(201,168,76,0.14)",
  },
  {
    icon: Users,
    title: "Instructor scheduling",
    body: "Availability, pickup coordination, and conflict-free assignment, handled for you.",
    tint: "#60A5FA",
    tintBg: "rgba(96,165,250,0.14)",
  },
  {
    icon: CreditCard,
    title: "Payments built in",
    body: "Track lesson packages and payments in one place, no spreadsheets required.",
    tint: "#34D399",
    tintBg: "rgba(52,211,153,0.14)",
  },
];

const PREVIEW_ROWS = [
  { time: "9:00 AM", name: "Liam Tremblay", status: "Confirmed" },
  { time: "11:30 AM", name: "Olivia Chen", status: "Confirmed" },
  { time: "2:00 PM", name: "Noah Kowalski", status: "Pending" },
];

function LandingPage() {
  return (
    <div className="relative min-h-screen brand-gradient brand-grid-bg text-white flex flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 -left-24 size-[420px] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.5) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute top-1/3 -right-32 size-[480px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(96,165,250,0.5) 0%, transparent 70%)" }}
      />

      <header className="relative px-6 py-6 flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-white/10 ring-1 ring-white/15 grid place-items-center">
            <CarFront className="size-4.5 text-blue-300" />
          </div>
          <div className="text-lg font-bold tracking-tight">DrivingOps</div>
        </div>
        <Link to="/auth" className="text-sm font-medium text-white/80 hover:text-white transition">
          Log In
        </Link>
      </header>

      <main className="relative flex-1 flex items-center px-6 py-10">
        <div className="max-w-6xl w-full mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <div
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] rounded-full px-3 py-1 mb-5"
              style={{ background: "rgba(201,168,76,0.14)", color: "#C9A84C" }}
            >
              Built for driving schools
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">DrivingOps</h1>
            <p className="mt-4 text-lg text-white/70 max-w-lg mx-auto lg:mx-0">
              Booking, scheduling, and payments — built for driving schools.
            </p>
            <div className="mt-9 flex items-center justify-center lg:justify-start gap-3 flex-wrap">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-xl px-6 py-3 text-sm font-semibold text-[#1B2B4B] shadow-lg shadow-black/20 hover:brightness-105 transition"
                style={{ background: "#C9A84C" }}
              >
                Get Started
              </Link>
            </div>

            <div className="mt-16 grid sm:grid-cols-3 gap-4 text-left">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl p-5 bg-white/5 border border-white/10 hover:bg-white/[0.07] transition"
                >
                  <div
                    className="size-9 rounded-lg grid place-items-center"
                    style={{ background: f.tintBg }}
                  >
                    <f.icon className="size-4.5" style={{ color: f.tint }} />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white">{f.title}</div>
                  <p className="mt-1 text-xs text-white/60 leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block relative">
            <div
              className="absolute -inset-6 rounded-3xl opacity-40 blur-2xl"
              style={{ background: "radial-gradient(circle, rgba(201,168,76,0.25) 0%, transparent 70%)" }}
            />
            <div
              className="relative rounded-2xl overflow-hidden rotate-1"
              style={{
                background: "#FAF8F4",
                border: "1px solid rgba(201,168,76,0.25)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div
                className="px-4 py-3 flex items-center gap-1.5 border-b"
                style={{ borderColor: "rgba(201,168,76,0.2)" }}
              >
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-[11px] font-medium" style={{ color: "#6B6B7B" }}>
                  Today's Bookings
                </span>
              </div>
              <div className="p-5 space-y-2.5">
                {PREVIEW_ROWS.map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ background: "#F0EBE1" }}
                  >
                    <Clock className="size-3.5 shrink-0" style={{ color: "#C9A84C" }} />
                    <span className="text-xs font-medium w-16 shrink-0" style={{ color: "#3A3A4A" }}>
                      {r.time}
                    </span>
                    <span className="text-xs flex-1" style={{ color: "#1A1A2E" }}>
                      {r.name}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      style={
                        r.status === "Confirmed"
                          ? { background: "rgba(52,211,153,0.16)", color: "#0F9D6D" }
                          : { background: "rgba(201,168,76,0.16)", color: "#A3821F" }
                      }
                    >
                      {r.status === "Confirmed" && <Check className="size-2.5" />}
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative px-6 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} DrivingOps ·{" "}
        <Link to="/terms" className="hover:text-white/70">
          Terms
        </Link>{" "}
        ·{" "}
        <Link to="/privacy" className="hover:text-white/70">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
