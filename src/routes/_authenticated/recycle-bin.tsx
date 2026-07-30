import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recycle-bin")({
  component: RecycleBinPage,
});

type Tab = "students" | "bookings" | "instructors";

const TABS: { key: Tab; label: string }[] = [
  { key: "students", label: "Students" },
  { key: "bookings", label: "Bookings" },
  { key: "instructors", label: "Instructors" },
];

function RecycleBinPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("students");

  const studentsQ = useQuery({
    queryKey: ["deleted-students"],
    enabled: tab === "students",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, phone, email, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const bookingsQ = useQuery({
    queryKey: ["deleted-bookings"],
    enabled: tab === "bookings",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, scheduled_at, status, deleted_at, students(full_name), lesson_types(name)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const instructorsQ = useQuery({
    queryKey: ["deleted-instructors"],
    enabled: tab === "instructors",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, full_name, phone, email, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function restore(table: "students" | "bookings" | "instructors", id: string) {
    const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [`deleted-${table}`] });
    qc.invalidateQueries({ queryKey: [table] });
    toast.success("Restored");
  }

  async function destroyForever(
    table: "students" | "bookings" | "instructors",
    id: string,
    label: string,
  ) {
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [`deleted-${table}`] });
    toast.success("Permanently deleted");
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Recycle bin</h1>
      <p className="text-sm text-slate-500 mb-6">
        Deleted students, bookings, and instructors stay here until you restore or permanently
        remove them.
      </p>

      <div className="flex gap-1 bg-white rounded-lg p-1 ring-1 ring-slate-200 shrink-0 w-fit mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === t.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "students" && (
        <RecycleTable
          rows={studentsQ.data ?? []}
          empty="No deleted students."
          columns={(s: any) => [
            s.full_name,
            `${s.phone} · ${s.email ?? "no email"}`,
            fmtDateTime(s.deleted_at),
          ]}
          onRestore={(s: any) => restore("students", s.id)}
          onDestroy={(s: any) => destroyForever("students", s.id, s.full_name)}
        />
      )}
      {tab === "bookings" && (
        <RecycleTable
          rows={bookingsQ.data ?? []}
          empty="No deleted bookings."
          columns={(b: any) => [
            b.students?.full_name ?? "—",
            `${b.lesson_types?.name ?? "—"} · ${fmtDateTime(b.scheduled_at)}`,
            fmtDateTime(b.deleted_at),
          ]}
          onRestore={(b: any) => restore("bookings", b.id)}
          onDestroy={(b: any) => destroyForever("bookings", b.id, "this booking")}
        />
      )}
      {tab === "instructors" && (
        <RecycleTable
          rows={instructorsQ.data ?? []}
          empty="No deleted instructors."
          columns={(i: any) => [
            i.full_name,
            `${i.phone ?? "—"} · ${i.email ?? "—"}`,
            fmtDateTime(i.deleted_at),
          ]}
          onRestore={(i: any) => restore("instructors", i.id)}
          onDestroy={(i: any) => destroyForever("instructors", i.id, i.full_name)}
        />
      )}
    </div>
  );
}

function RecycleTable({
  rows,
  empty,
  columns,
  onRestore,
  onDestroy,
}: {
  rows: any[];
  empty: string;
  columns: (row: any) => [string, string, string];
  onRestore: (row: any) => void;
  onDestroy: (row: any) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl text-center py-10 text-sm text-slate-500">
        {empty}
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const [primary, secondary, deletedAt] = columns(row);
            return (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="font-medium">{primary}</div>
                  <div className="text-xs text-slate-400">{secondary}</div>
                </td>
                <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                  Deleted {deletedAt}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => onRestore(row)}
                    className="text-xs text-blue-600 hover:underline mr-4"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => onDestroy(row)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete forever
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
