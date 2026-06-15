import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warn" | "success" | "danger" | "info";
  hint?: string;
  icon?: LucideIcon;
}) {
  const toneRing: Record<string, string> = {
    default: "ring-slate-200",
    warn: "ring-amber-200",
    success: "ring-emerald-200",
    danger: "ring-rose-200",
    info: "ring-blue-200",
  };
  const toneText: Record<string, string> = {
    default: "text-slate-900",
    warn: "text-amber-700",
    success: "text-emerald-700",
    danger: "text-rose-700",
    info: "text-blue-700",
  };
  const toneIcon: Record<string, string> = {
    default: "bg-slate-100 text-slate-600",
    warn: "bg-amber-50 text-amber-600",
    success: "bg-emerald-50 text-emerald-600",
    danger: "bg-rose-50 text-rose-600",
    info: "bg-blue-50 text-blue-600",
  };
  return (
    <div className={`card-premium p-5 ring-1 ${toneRing[tone]}`}>
      <div className="flex items-start justify-between">
        <div className="eyebrow text-slate-500">{label}</div>
        {Icon && (
          <div className={`size-8 grid place-items-center rounded-lg ${toneIcon[tone]}`}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className={`text-3xl font-semibold mt-3 tracking-tight ${toneText[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export function StatusPill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center ${tone}`}>
      {children}
    </span>
  );
}
