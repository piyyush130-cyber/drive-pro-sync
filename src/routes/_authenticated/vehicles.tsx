import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useSchoolId } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vehicles")({
  component: VehiclesPage,
});

function VehiclesPage() {
  const qc = useQueryClient();
  const { user } = useAuthUser();
  const schoolIdQ = useSchoolId(user?.id);
  const [adding, setAdding] = useState(false);

  const vehiclesQ = useQuery({
    queryKey: ["vehicles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, bookings(id)")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolIdQ.data) return toast.error("Could not determine your school — try refreshing.");
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("vehicles").insert({
      name: String(fd.get("name") || ""),
      plate: String(fd.get("plate") || "") || null,
      school_id: schoolIdQ.data,
    });
    if (error) return toast.error(error.message);
    (e.target as HTMLFormElement).reset();
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["vehicles-all"] });
    toast.success("Vehicle added");
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("vehicles").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["vehicles-all"] });
  }

  async function deleteVehicle(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? You can restore it from the recycle bin.`)) return;
    const { error } = await supabase
      .from("vehicles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vehicles-all"] });
    toast.success(`${name} deleted`);
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vehicles</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track your fleet so the same car never gets double-booked.
          </p>
        </div>
        <button onClick={() => setAdding(!adding)} className="btn-primary text-sm">
          {adding ? "Cancel" : "+ Add vehicle"}
        </button>
      </div>

      {adding && (
        <form onSubmit={add} className="glass-card p-5 mb-6 grid sm:grid-cols-3 gap-3">
          <input name="name" required placeholder="e.g. 2021 Honda Civic" className="glass-input" />
          <input name="plate" placeholder="Plate (optional)" className="glass-input" />
          <button className="btn-primary sm:col-span-1 text-sm">Save</button>
        </form>
      )}

      <div className="space-y-3">
        {(vehiclesQ.data ?? []).map((v: any) => (
          <div key={v.id} className="glass-card p-5 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">
                {v.name}
                {!v.active && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {v.plate ?? "No plate on file"} · {(v.bookings ?? []).length} lessons
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => toggle(v.id, v.active)} className="btn-secondary text-xs">
                {v.active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => deleteVehicle(v.id, v.name)}
                className="text-xs text-red-400 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {vehiclesQ.data?.length === 0 && (
          <div className="glass-card p-8 text-center text-sm text-slate-400">
            No vehicles yet — add your fleet to start assigning cars to lessons.
          </div>
        )}
      </div>
    </div>
  );
}
