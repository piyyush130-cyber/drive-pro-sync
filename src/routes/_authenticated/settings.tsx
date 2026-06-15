import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ["settings-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const typesQ = useQuery({
    queryKey: ["lesson-types-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_types").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  async function saveSettings() {
    const { error } = await supabase
      .from("school_settings")
      .update({
        school_name: form.school_name,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        service_area: form.service_area,
        cancellation_policy: form.cancellation_policy,
        default_duration_minutes: Number(form.default_duration_minutes) || 60,
        default_buffer_minutes: Number(form.default_buffer_minutes) || 15,
        require_approval: !!form.require_approval,
      })
      .eq("id", 1);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["settings-full"] });
    qc.invalidateQueries({ queryKey: ["public-settings"] });
    toast.success("Settings saved");
  }

  async function saveType(t: any) {
    const { error } = await supabase
      .from("lesson_types")
      .update({
        name: t.name,
        price_cents: Number(t.price_cents) || 0,
        duration_minutes: Number(t.duration_minutes) || 60,
        active: !!t.active,
      })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["lesson-types-all"] });
    qc.invalidateQueries({ queryKey: ["public-lesson-types"] });
    toast.success("Lesson type saved");
  }

  if (!form.school_name) return <div className="p-10 text-zinc-500">Loading...</div>;

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <h1 className="text-2xl font-medium mb-6">Settings</h1>

      <section className="bg-white ring-1 ring-black/5 rounded-xl p-6 mb-6 space-y-4">
        <h2 className="font-medium">School details</h2>
        <Field label="School name">
          <input
            value={form.school_name || ""}
            onChange={(e) => setForm({ ...form, school_name: e.target.value })}
            className="input"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Contact phone">
            <input
              value={form.contact_phone || ""}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Contact email">
            <input
              value={form.contact_email || ""}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        <Field label="Service area">
          <textarea
            value={form.service_area || ""}
            onChange={(e) => setForm({ ...form, service_area: e.target.value })}
            className="input min-h-[60px]"
          />
        </Field>
        <Field label="Cancellation policy">
          <textarea
            value={form.cancellation_policy || ""}
            onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })}
            className="input min-h-[60px]"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Default lesson duration (min)">
            <input
              type="number"
              value={form.default_duration_minutes || 60}
              onChange={(e) => setForm({ ...form, default_duration_minutes: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Buffer between lessons (min)">
            <input
              type="number"
              value={form.default_buffer_minutes || 15}
              onChange={(e) => setForm({ ...form, default_buffer_minutes: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!form.require_approval}
            onChange={(e) => setForm({ ...form, require_approval: e.target.checked })}
          />
          Require admin approval for new bookings
        </label>
        <button
          onClick={saveSettings}
          className="bg-emerald-800 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          Save settings
        </button>
      </section>

      <section className="bg-white ring-1 ring-black/5 rounded-xl p-6">
        <h2 className="font-medium mb-4">Lesson types & prices</h2>
        <div className="space-y-3">
          {(typesQ.data ?? []).map((t: any) => (
            <LessonTypeRow key={t.id} initial={t} onSave={saveType} />
          ))}
        </div>
      </section>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function LessonTypeRow({ initial, onSave }: { initial: any; onSave: (t: any) => void }) {
  const [t, setT] = useState(initial);
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <input
        value={t.name}
        onChange={(e) => setT({ ...t, name: e.target.value })}
        className="input col-span-5"
      />
      <input
        type="number"
        value={t.duration_minutes}
        onChange={(e) => setT({ ...t, duration_minutes: e.target.value })}
        className="input col-span-2"
      />
      <input
        type="number"
        value={(t.price_cents ?? 0) / 100}
        onChange={(e) => setT({ ...t, price_cents: Math.round(Number(e.target.value) * 100) })}
        className="input col-span-2"
      />
      <label className="flex items-center gap-1 text-xs col-span-1">
        <input
          type="checkbox"
          checked={t.active}
          onChange={(e) => setT({ ...t, active: e.target.checked })}
        />
        On
      </label>
      <button
        onClick={() => onSave(t)}
        className="col-span-2 bg-emerald-800 text-white text-xs py-2 rounded font-medium"
      >
        Save · {money(t.price_cents ?? 0)}
      </button>
    </div>
  );
}
