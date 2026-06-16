export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const fmtDateTime = (iso: string) => `${fmtDate(iso)} · ${fmtTime(iso)}`;

export const statusLabel = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Status pill tones — dark luxury palette (15% bg + matching text)
export const statusTone: Record<string, string> = {
  pending: "bg-[#F59E0B]/15 text-[#F59E0B]",
  confirmed: "bg-[#10B981]/15 text-[#10B981]",
  completed: "bg-[#3B82F6]/15 text-[#60A5FA]",
  cancelled: "bg-[#EF4444]/15 text-[#EF4444]",
  declined: "bg-[#EF4444]/15 text-[#EF4444]",
  no_show: "bg-[#EF4444]/15 text-[#EF4444]",
  rescheduled: "bg-[#3B82F6]/15 text-[#60A5FA]",
  paid: "bg-[#10B981]/15 text-[#10B981]",
  unpaid: "bg-[#F59E0B]/15 text-[#F59E0B]",
  deposit_paid: "bg-[#3B82F6]/15 text-[#60A5FA]",
  refunded: "bg-[#94A3B8]/15 text-[#94A3B8]",
  overdue: "bg-[#EF4444]/15 text-[#EF4444]",
  active: "bg-[#10B981]/15 text-[#10B981]",
  pending_approval: "bg-[#F59E0B]/15 text-[#F59E0B]",
  deactivated: "bg-[#94A3B8]/15 text-[#94A3B8]",
  rejected: "bg-[#EF4444]/15 text-[#EF4444]",
  approved: "bg-[#10B981]/15 text-[#10B981]",
};

