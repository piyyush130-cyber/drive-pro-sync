import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/instructors")({
  component: InstructorsPage,
});

function InstructorsPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const instructorsQ = useQuery({
    queryKey: ["instructors-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("*, bookings(id, status)")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("instructors").insert({
      full_name: String(fd.get("full_name") || ""),
      phone: String(fd.get("phone") || "") || null,
      email: String(fd.get("email") || "") || null,
    });
    if (error) return toast.error(error.message);
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["instructors-all"] });
    toast.success("Instructor added");
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("instructors").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["instructors-all"] });
  }

  async function linkUser(id: string, email: string) {
    // Find user by email via auth → not possible directly from client. Use profiles.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!profile) return toast.error("No staff account with that email. Ask them to sign up first.");
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("instructors").update({ profile_id: profile.id }).eq("id", id),
      supabase.from("user_roles").upsert(
        { user_id: profile.id, role: "instructor" },
        { onConflict: "user_id,role" },
      ),
    ]);
    if (e1 || e2) return toast.error((e1 || e2)!.message);
    qc.invalidateQueries({ queryKey: ["instructors-all"] });
    toast.success("Linked");
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">Instructors</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your teaching team.</p>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="bg-emerald-800 text-white text-sm font-medium px-3 py-2 rounded-md"
        >
          {adding ? "Cancel" : "+ Add instructor"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={add}
          className="bg-white ring-1 ring-black/5 rounded-xl p-5 mb-6 grid sm:grid-cols-3 gap-3"
        >
          <input name="full_name" required placeholder="Full name" className="input" />
          <input name="phone" placeholder="Phone" className="input" />
          <input name="email" type="email" placeholder="Email" className="input" />
          <button className="bg-emerald-800 text-white py-2 rounded-md text-sm font-medium sm:col-span-3">
            Save
          </button>
        </form>
      )}

      <div className="space-y-3">
        {(instructorsQ.data ?? []).map((i: any) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayCount = (i.bookings ?? []).filter((b: any) => {
            const d = new Date(b.created_at);
            return d >= today;
          }).length;
          return (
            <div key={i.id} className="bg-white ring-1 ring-black/5 rounded-xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {i.full_name}
                    {!i.active && (
                      <span className="ml-2 text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                    {i.profile_id && (
                      <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        Login linked
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {i.phone ?? "—"} · {i.email ?? "—"}
                  </div>
                  {i.notes && <div className="text-xs text-zinc-600 mt-2">{i.notes}</div>}
                </div>
                <div className="text-right text-xs text-zinc-500">
                  {(i.bookings ?? []).length} total lessons
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-zinc-100">
                <button
                  onClick={() => toggle(i.id, i.active)}
                  className="text-xs border border-zinc-200 px-3 py-1.5 rounded font-medium"
                >
                  {i.active ? "Deactivate" : "Activate"}
                </button>
                {!i.profile_id && (
                  <button
                    onClick={() => {
                      const email = prompt("Enter the instructor's login email (they must sign up first):");
                      if (email) linkUser(i.id, email);
                    }}
                    className="text-xs bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded font-medium"
                  >
                    Link login
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .input {
          width: 100%;
          background: #fafafa;
          border: 1px solid #e4e4e7;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
        }
        .input:focus { border-color: #064e3b; background: #fff; }
      `}</style>
    </div>
  );
}
