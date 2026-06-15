export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const fmtDateTime = (iso: string) => `${fmtDate(iso)} · ${fmtTime(iso)}`;

export const statusLabel = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Status pill tones — premium automotive palette
export const statusTone: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  completed: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  cancelled: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  declined: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  no_show: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  rescheduled: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  unpaid: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  deposit_paid: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  refunded: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  overdue: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};
