import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/services")({
  component: ServicesPage,
});

function ServicesPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const q = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_types")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("lesson_types").insert({
      name: String(fd.get("name")),
      duration_minutes: Number(fd.get("duration") || 60),
      price_cents: Math.round(Number(fd.get("price") || 0) * 100),
      description: String(fd.get("description") || "") || null,
      category: String(fd.get("category") || "lesson"),
      buffer_minutes: Number(fd.get("buffer") || 0),
      sort_order: Number(fd.get("sort_order") || 0),
      active: true,
    });
    if (error) return toast.error(error.message);
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["services"] });
    toast.success("Service added");
  }

  async function update(id: string, patch: any) {
    const { error } = await supabase.from("lesson_types").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("lesson_types").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="eyebrow text-blue-700">Catalog</div>
          <h1 className="text-2xl font-semibold tracking-tight">Services & Pricing</h1>
          <p className="text-sm text-slate-500 mt-1">
            What customers can book from your public page.
          </p>
        </div>
        <button onClick={() => setAdding(!adding)} className="btn-primary">
          <Plus className="size-4" /> {adding ? "Cancel" : "Add service"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={add}
          className="card-premium p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <Input name="name" placeholder="Name" required />
          <Input name="duration" type="number" placeholder="Duration (min)" defaultValue={60} />
          <Input name="price" type="number" step="0.01" placeholder="Price" defaultValue={0} />
          <Input name="buffer" type="number" placeholder="Buffer (min)" defaultValue={15} />
          <Input name="sort_order" type="number" placeholder="Display order" defaultValue={0} />
          <select name="category" className="input-premium">
            <option value="lesson">Lesson</option>
            <option value="package">Package</option>
            <option value="road_test">Road test</option>
            <option value="custom">Custom</option>
          </select>
          <Input name="description" placeholder="Short description" className="sm:col-span-2 lg:col-span-3" />
          <button className="btn-primary sm:col-span-2 lg:col-span-3">Save service</button>
        </form>
      )}

      <div className="space-y-3">
        {(q.data ?? []).map((s: any) => (
          <div key={s.id} className="card-premium p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={s.name}
                    onBlur={(e) => e.target.value !== s.name && update(s.id, { name: e.target.value })}
                    className="font-semibold text-lg tracking-tight bg-transparent outline-none border-b border-transparent focus:border-blue-500 px-0"
                  />
                  {!s.active && (
                    <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                <input
                  defaultValue={s.description ?? ""}
                  placeholder="Description"
                  onBlur={(e) =>
                    e.target.value !== (s.description ?? "") &&
                    update(s.id, { description: e.target.value || null })
                  }
                  className="text-sm text-slate-500 bg-transparent outline-none w-full mt-1"
                />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                  <Field label="Duration (min)">
                    <input
                      type="number"
                      defaultValue={s.duration_minutes}
                      onBlur={(e) =>
                        Number(e.target.value) !== s.duration_minutes &&
                        update(s.id, { duration_minutes: Number(e.target.value) })
                      }
                      className="input-premium"
                    />
                  </Field>
                  <Field label="Price ($)">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={(s.price_cents / 100).toFixed(2)}
                      onBlur={(e) =>
                        update(s.id, { price_cents: Math.round(Number(e.target.value) * 100) })
                      }
                      className="input-premium"
                    />
                  </Field>
                  <Field label="Buffer (min)">
                    <input
                      type="number"
                      defaultValue={s.buffer_minutes ?? 0}
                      onBlur={(e) => update(s.id, { buffer_minutes: Number(e.target.value) })}
                      className="input-premium"
                    />
                  </Field>
                  <Field label="Order">
                    <input
                      type="number"
                      defaultValue={s.sort_order}
                      onBlur={(e) => update(s.id, { sort_order: Number(e.target.value) })}
                      className="input-premium"
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      defaultValue={s.category ?? "lesson"}
                      onChange={(e) => update(s.id, { category: e.target.value })}
                      className="input-premium"
                    >
                      <option value="lesson">Lesson</option>
                      <option value="package">Package</option>
                      <option value="road_test">Road test</option>
                      <option value="custom">Custom</option>
                    </select>
                  </Field>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => update(s.id, { active: !s.active })}
                  className="text-xs btn-secondary"
                >
                  {s.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="text-xs btn-secondary text-rose-600"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input-premium ${props.className ?? ""}`} />;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
