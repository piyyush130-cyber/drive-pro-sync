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
  const toneText: Record<string, string> = {
    default: "text-[#F1F5F9]",
    warn: "text-[#F59E0B]",
    success: "text-[#10B981]",
    danger: "text-[#EF4444]",
    info: "text-[#60A5FA]",
  };
  const toneIcon: Record<string, string> = {
    default: "bg-[#1E2D4A] text-[#94A3B8]",
    warn: "bg-[#F59E0B]/15 text-[#F59E0B]",
    success: "bg-[#10B981]/15 text-[#10B981]",
    danger: "bg-[#EF4444]/15 text-[#EF4444]",
    info: "bg-[#3B82F6]/15 text-[#60A5FA]",
  };
  const toneBorder: Record<string, string> = {
    default: "border-t-[#3B82F6]",
    warn: "border-t-[#F59E0B]",
    success: "border-t-[#10B981]",
    danger: "border-t-[#EF4444]",
    info: "border-t-[#3B82F6]",
  };
  return (
    <div
      className={`stat-card p-5 ${toneBorder[tone]}`}
      style={{ borderTopWidth: 2 }}
    >
      <div className="flex items-start justify-between">
        <div className="eyebrow text-[#94A3B8]">{label}</div>
        {Icon && (
          <div className={`size-8 grid place-items-center rounded-lg ${toneIcon[tone]}`}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className={`text-3xl font-semibold mt-3 tracking-tight font-mono ${toneText[tone]}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-[#94A3B8] mt-1">{hint}</div>}
    </div>
  );
}

export function StatusPill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center ${tone}`}
    >
      {children}
    </span>
  );
}
