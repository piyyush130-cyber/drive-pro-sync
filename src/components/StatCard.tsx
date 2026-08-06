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
    default: "text-[#1B2B4B]",
    warn: "text-[#C9A84C]",
    success: "text-[#0F9D6D]",
    danger: "text-[#DC2626]",
    info: "text-[#2563A8]",
  };
  const toneIcon: Record<string, string> = {
    default: "bg-[rgba(27,43,75,0.08)] text-[#1B2B4B]",
    warn: "bg-[rgba(201,168,76,0.16)] text-[#C9A84C]",
    success: "bg-[rgba(15,157,109,0.14)] text-[#0F9D6D]",
    danger: "bg-[rgba(220,38,38,0.12)] text-[#DC2626]",
    info: "bg-[rgba(37,99,168,0.12)] text-[#2563A8]",
  };
  const toneBorder: Record<string, string> = {
    default: "border-t-[#C9A84C]",
    warn: "border-t-[#C9A84C]",
    success: "border-t-[#0F9D6D]",
    danger: "border-t-[#DC2626]",
    info: "border-t-[#2563A8]",
  };
  return (
    <div
      className={`stat-card p-5 ${toneBorder[tone]}`}
      style={{ borderTopWidth: 2 }}
    >
      <div className="flex items-start justify-between">
        <div className="eyebrow">{label}</div>
        {Icon && (
          <div className={`size-8 grid place-items-center rounded-lg ${toneIcon[tone]}`}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className={`text-3xl font-semibold mt-3 tracking-tight font-mono ${toneText[tone]}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-[#6B6B7B] mt-1">{hint}</div>}
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
