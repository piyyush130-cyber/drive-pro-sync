import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  Users,
  GraduationCap,
  DollarSign,
  Settings,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Today", url: "/dashboard", icon: LayoutDashboard },
  { title: "New Bookings", url: "/bookings", icon: Inbox },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Students", url: "/students", icon: Users },
  { title: "Instructors", url: "/instructors", icon: GraduationCap },
  { title: "Payments", url: "/payments", icon: DollarSign },
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
    <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-zinc-100">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-emerald-800">
          Dispatcher
        </div>
        <div className="text-sm font-semibold mt-0.5 truncate">{schoolName}</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const active = pathname === item.url || pathname.startsWith(item.url + "/");
          return (
            <Link
              key={item.url}
              to={item.url}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-emerald-800 text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <item.icon className="size-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-zinc-100">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-zinc-600 hover:bg-zinc-100"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
