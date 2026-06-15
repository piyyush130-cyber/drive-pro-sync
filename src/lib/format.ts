export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const fmtDateTime = (iso: string) => `${fmtDate(iso)} · ${fmtTime(iso)}`;

export const statusLabel = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const statusTone: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-zinc-100 text-zinc-700",
  cancelled: "bg-rose-100 text-rose-700",
  declined: "bg-rose-100 text-rose-700",
  no_show: "bg-rose-100 text-rose-700",
  rescheduled: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-800",
  unpaid: "bg-amber-100 text-amber-800",
  deposit_paid: "bg-blue-100 text-blue-700",
  refunded: "bg-zinc-100 text-zinc-700",
};
