import { createFileRoute, Link } from "@tanstack/react-router";
import { CarFront, CalendarCheck, Users, CreditCard } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Online booking",
    body: "A branded booking page for every school — students book lessons without calling.",
  },
  {
    icon: Users,
    title: "Instructor scheduling",
    body: "Availability, pickup coordination, and conflict-free assignment, handled for you.",
  },
  {
    icon: CreditCard,
    title: "Payments built in",
    body: "Track lesson packages and payments in one place, no spreadsheets required.",
  },
];

function LandingPage() {
  return (
    <div className="relative min-h-screen brand-gradient brand-grid-bg text-white flex flex-col">
      <header className="px-6 py-6 flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-white/10 ring-1 ring-white/15 grid place-items-center">
            <CarFront className="size-4.5 text-blue-300" />
          </div>
          <div className="text-lg font-bold tracking-tight">DrivingOps</div>
        </div>
        <Link
          to="/auth"
          className="text-sm font-medium text-white/80 hover:text-white transition"
        >
          Log In
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full text-center py-16">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">DrivingOps</h1>
          <p className="mt-4 text-lg text-white/70 max-w-lg mx-auto">
            Booking, scheduling, and payments — built for driving schools.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-xl px-6 py-3 text-sm font-semibold text-[#1B2B4B]"
              style={{ background: "#C9A84C" }}
            >
              Get Started
            </Link>
            <Link
              to="/auth"
              className="rounded-xl px-6 py-3 text-sm font-semibold border border-white/20 text-white hover:bg-white/5 transition"
            >
              Log In
            </Link>
          </div>

          <div className="mt-16 grid sm:grid-cols-3 gap-6 text-left">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl p-5 bg-white/5 border border-white/10"
              >
                <f.icon className="size-5 text-[#C9A84C]" />
                <div className="mt-3 text-sm font-semibold text-white">{f.title}</div>
                <p className="mt-1 text-xs text-white/60 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-white/40">
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
