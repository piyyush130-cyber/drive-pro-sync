export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warn";
}) {
  return (
    <div className="bg-white p-5 rounded-xl ring-1 ring-black/5">
      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</div>
      <div
        className={`text-3xl font-semibold mt-1 ${tone === "warn" ? "text-amber-600" : "text-zinc-900"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function StatusPill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${tone}`}>
      {children}
    </span>
  );
}
