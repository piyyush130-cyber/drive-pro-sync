import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CarFront,
  CalendarCheck,
  Zap,
  ClipboardList,
  ArrowRight,
  MessageSquareText,
  CheckCircle2,
} from "lucide-react";

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
    icon: Zap,
    title: "Fully automatic scheduling",
    body: "Availability, pickup coordination, and instructor assignment run themselves — no admin has to lift a finger.",
    tint: "#60A5FA",
    tintBg: "rgba(96,165,250,0.14)",
  },
  {
    icon: ClipboardList,
    title: "Payment tracking",
    body: "Every lesson package and payment tracked automatically in one place — no spreadsheets, ever.",
    tint: "#34D399",
    tintBg: "rgba(52,211,153,0.14)",
  },
];

const AUTOMATION_STEPS = [
  {
    icon: CalendarCheck,
    title: "Student books online",
    meta: "9:02 AM",
    tint: "#C9A84C",
  },
  {
    icon: Zap,
    title: "Auto-assigned to Sarah M.",
    meta: "Instant",
    tint: "#60A5FA",
  },
  {
    icon: MessageSquareText,
    title: "Reminder texted automatically",
    meta: "4 hrs before",
    tint: "#60A5FA",
  },
  {
    icon: CheckCircle2,
    title: "Lesson confirmed",
    meta: "No admin involved",
    tint: "#34D399",
  },
];

function LandingPage() {
  return (
    <div className="relative min-h-screen brand-gradient brand-grid-bg text-white flex flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 -left-32 size-[600px] rounded-full opacity-[0.35] blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.6) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute top-1/4 -right-48 size-[620px] rounded-full opacity-[0.28] blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(96,165,250,0.55) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 size-[420px] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.45) 0%, transparent 70%)" }}
      />

      <header
        className="relative px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
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

      <main className="relative flex-1 flex items-center px-6 py-14">
        <div className="max-w-6xl w-full mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
          <div className="text-center lg:text-left min-w-0">
            <div
              className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.1em] sm:tracking-[0.18em] rounded-full px-3 py-1.5 mb-7 max-w-full"
              style={{
                background: "rgba(201,168,76,0.14)",
                color: "#C9A84C",
                border: "1px solid rgba(201,168,76,0.25)",
              }}
            >
              <Zap className="size-3 shrink-0" />
              <span>Fully automated, start to finish</span>
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] sm:leading-[1.02]">
              Run your driving school
              <br className="hidden sm:block" /> on{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #C9A84C, #F0DFA0)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                autopilot
              </span>
              .
            </h1>
            <p className="mt-6 text-lg text-white/65 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Booking, scheduling, and instructor coordination happen automatically. No admin
              chasing a spreadsheet, no student waiting on a callback.
            </p>
            <div className="mt-10 flex flex-col items-center lg:items-start gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="group inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-[#1B2B4B] shadow-[0_8px_30px_rgba(201,168,76,0.35)] hover:shadow-[0_8px_36px_rgba(201,168,76,0.5)] hover:brightness-105 transition-all"
                style={{ background: "linear-gradient(135deg, #E8D48A, #C9A84C)" }}
              >
                Get Started
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <span className="text-xs text-white/40">14-day free trial · Set up in minutes</span>
            </div>

            <div className="mt-20 grid sm:grid-cols-3 gap-4 text-left">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl p-5 bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] hover:border-white/20 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div
                    className="size-10 rounded-xl grid place-items-center shadow-inner"
                    style={{ background: f.tintBg }}
                  >
                    <f.icon className="size-5" style={{ color: f.tint }} />
                  </div>
                  <div className="mt-3.5 text-sm font-semibold text-white">{f.title}</div>
                  <p className="mt-1.5 text-xs text-white/55 leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:block relative">
            <div
              className="absolute -inset-8 rounded-[2rem] opacity-40 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(201,168,76,0.3) 0%, transparent 70%)" }}
            />
            <div
              className="relative rounded-2xl overflow-hidden rotate-1"
              style={{
                background: "#FAF8F4",
                border: "1px solid rgba(201,168,76,0.25)",
                boxShadow: "0 32px 70px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="px-4 py-3.5 flex items-center gap-1.5 border-b"
                style={{ borderColor: "rgba(201,168,76,0.2)" }}
              >
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-[11px] font-medium" style={{ color: "#6B6B7B" }}>
                  What happens automatically
                </span>
              </div>
              <div className="p-6">
                <div className="relative">
                  <div
                    className="absolute left-[15px] top-2 bottom-2 w-px"
                    style={{ background: "rgba(201,168,76,0.25)" }}
                  />
                  <div className="space-y-5">
                    {AUTOMATION_STEPS.map((s) => (
                      <div key={s.title} className="relative flex items-start gap-3.5">
                        <div
                          className="relative z-10 size-[30px] rounded-full grid place-items-center shrink-0"
                          style={{ background: "#FAF8F4", border: `2px solid ${s.tint}` }}
                        >
                          <s.icon className="size-3.5" style={{ color: s.tint }} />
                        </div>
                        <div className="pt-1">
                          <div className="text-[13px] font-semibold" style={{ color: "#1A1A2E" }}>
                            {s.title}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: "#8A8A9A" }}>
                            {s.meta}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer
        className="relative px-6 py-6 text-center text-xs text-white/40 border-t"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
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
