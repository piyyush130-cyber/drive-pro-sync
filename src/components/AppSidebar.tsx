import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Gauge,
  Inbox,
  CalendarDays,
  Users,
  GraduationCap,
  Wallet,
  Settings,
  LogOut,
  CarFront,
  Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Daily Dispatch", url: "/dashboard", icon: Gauge },
  { title: "Booking Queue", url: "/bookings", icon: Inbox },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Students", url: "/students", icon: Users },
  { title: "Instructors", url: "/instructors", icon: GraduationCap },
  { title: "Services & Pricing", url: "/services", icon: Tag },
  { title: "Payment Watch", url: "/payments", icon: Wallet },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar({ schoolName }: { schoolName: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <aside className="w-64 shrink-0 brand-gradient text-slate-100 flex flex-col h-screen sticky top-0 border-r border-white/5">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-white/10 ring-1 ring-white/15 grid place-items-center">
            <CarFront className="size-4.5 text-blue-300" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-white truncate">
              DriveProSync
            </div>
            <div className="text-[10px] text-blue-200/80 uppercase tracking-widest truncate">
              {schoolName}
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const active = pathname === item.url || pathname.startsWith(item.url + "/");
          return (
            <Link
              key={item.url}
              to={item.url}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-white/10 text-white ring-1 ring-white/15"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-blue-400" />
              )}
              <item.icon className="size-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
