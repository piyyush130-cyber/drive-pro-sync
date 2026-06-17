import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const studentsQ = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, bookings(id, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("students").insert({
      full_name: String(fd.get("full_name") || ""),
      phone: String(fd.get("phone") || ""),
      email: String(fd.get("email") || "") || null,
      pickup_address: String(fd.get("pickup_address") || "") || null,
    });
    if (error) return toast.error(error.message);
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["students"] });
    toast.success("Student added");
  }

  const list = (studentsQ.data ?? []).filter((s: any) =>
    s.full_name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">Students</h1>
          <p className="text-sm text-slate-500 mt-1">{list.length} students</p>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="btn-primary text-sm font-medium px-3 py-2 rounded-md"
        >
          {adding ? "Cancel" : "+ Add student"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={addStudent}
          className="bg-white border border-slate-200 rounded-xl p-5 mb-6 grid sm:grid-cols-2 gap-3"
        >
          <input name="full_name" required placeholder="Full name" className="input" />
          <input name="phone" required placeholder="Phone" className="input" />
          <input name="email" type="email" placeholder="Email" className="input" />
          <input name="pickup_address" placeholder="Pickup address" className="input" />
          <button className="btn-primary py-2 rounded-md text-sm font-medium sm:col-span-2">
            Save
          </button>
        </form>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search students..."
        className="input mb-4 max-w-sm"
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Contact</th>
              <th className="text-left px-5 py-3">Lessons</th>
              <th className="text-left px-5 py-3">Pickup</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((s: any) => {
              const completed = s.bookings?.filter((b: any) => b.status === "completed").length ?? 0;
              const remaining = Math.max(0, (s.lessons_purchased ?? 0) - completed);
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">
                    <Link to="/students/$id" params={{ id: s.id }} className="hover:text-blue-600">
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {s.phone}
                    <div className="text-xs text-slate-400">{s.email}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {completed}/{s.lessons_purchased || "—"}
                    <div className="text-xs text-slate-400">{remaining} remaining</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs truncate max-w-xs">
                    {s.pickup_address ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && (
          <div className="text-center py-10 text-sm text-slate-500">No students yet.</div>
        )}
      </div>

      <style>{`
        .input {
          width: 100%;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
        }
        .input:focus { border-color: #3b82f6; background: #fff; }
      `}</style>
    </div>
  );
}
