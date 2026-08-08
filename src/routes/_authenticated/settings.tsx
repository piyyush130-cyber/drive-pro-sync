import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useSchoolId } from "@/lib/auth";
import { money } from "@/lib/format";
import { createBillingPortalSession } from "@/lib/billing.functions";
import { PLANS, type PlanKey } from "@/lib/plans";
import { normalizeServiceAreaInput } from "@/lib/postal-code";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuthUser();
  const schoolIdQ = useSchoolId(user?.id);
  const settingsQ = useQuery({
    queryKey: ["settings-full", schoolIdQ.data],
    enabled: !!schoolIdQ.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .eq("school_id", schoolIdQ.data as string)
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
  const billingQ = useQuery({
    queryKey: ["school-billing", schoolIdQ.data],
    enabled: !!schoolIdQ.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_billing")
        .select("*")
        .eq("school_id", schoolIdQ.data as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const openPortal = useServerFn(createBillingPortalSession);
  const [openingPortal, setOpeningPortal] = useState(false);

  async function manageBilling() {
    setOpeningPortal(true);
    try {
      const { url } = await openPortal({});
      window.location.href = url;
    } catch (err: any) {
      toast.error(err?.message || "Could not open billing portal");
      setOpeningPortal(false);
    }
  }

  const [form, setForm] = useState<any>({});
  const [pickupAreasText, setPickupAreasText] = useState("");
  const [mpiLocationsText, setMpiLocationsText] = useState("");
  useEffect(() => {
    if (settingsQ.data) {
      setForm(settingsQ.data);
      setPickupAreasText((settingsQ.data.pickup_service_areas ?? []).join(", "));
      setMpiLocationsText((settingsQ.data.mpi_test_locations ?? []).join(", "));
    }
  }, [settingsQ.data]);

  function normalizeCommaList(raw: string): string[] {
    return Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  async function saveSettings() {
    if (!schoolIdQ.data) return toast.error("Could not determine your school — try refreshing.");
    const { error } = await supabase
      .from("school_settings")
      .update({
        school_name: form.school_name,
        city: form.city,
        province: form.province,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        service_area: form.service_area,
        cancellation_policy: form.cancellation_policy,
        cancellation_notice_hours: Number(form.cancellation_notice_hours) || 24,
        late_cancel_fee_type: form.late_cancel_fee_type ?? "none",
        late_cancel_fee_value: Number(form.late_cancel_fee_value) || 0,
        no_show_fee_type: form.no_show_fee_type ?? "none",
        no_show_fee_value: Number(form.no_show_fee_value) || 0,
        booking_paused: !!form.booking_paused,
        deposit_required: !!form.deposit_required,
        deposit_cents: Number(form.deposit_cents) || 0,
        default_duration_minutes: Number(form.default_duration_minutes) || 60,
        default_buffer_minutes: Number(form.default_buffer_minutes) || 15,
        require_approval: !!form.require_approval,
        auto_assign_instructor: !!form.auto_assign_instructor,
        auto_invitations_enabled: !!form.auto_invitations_enabled,
        pickup_service_areas: normalizeServiceAreaInput(pickupAreasText),
        mpi_test_locations: normalizeCommaList(mpiLocationsText),
      })
      .eq("school_id", schoolIdQ.data);
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

  if (!form.school_name) return <div className="p-10 text-slate-500">Loading...</div>;

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Settings</h1>

      <section className="glass-card p-6 mb-6 space-y-3">
        <h2 className="font-semibold text-slate-900">Billing</h2>
        {billingQ.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : billingQ.data?.billing_status === "free_forever" ? (
          <p className="text-sm text-slate-600">
            Your account is comped — no subscription, nothing to manage here.
          </p>
        ) : billingQ.data?.plan ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {PLANS[billingQ.data.plan as PlanKey].name} plan ·{" "}
                  {money(PLANS[billingQ.data.plan as PlanKey].monthlyCents)}/mo
                  {billingQ.data.billing_interval === "annual" && " (billed annually)"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Status: {billingQ.data.billing_status}
                  {billingQ.data.trial_ends_at && billingQ.data.billing_status === "trialing" && (
                    <> · trial ends {new Date(billingQ.data.trial_ends_at).toLocaleDateString()}</>
                  )}
                </div>
              </div>
              <button
                onClick={manageBilling}
                disabled={openingPortal}
                className="btn-secondary text-sm"
              >
                {openingPortal ? "Opening…" : "Manage billing"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">No plan selected yet.</p>
        )}
      </section>

      <section
        className="glass-card p-6 mb-6 space-y-2"
        style={
          form.booking_paused
            ? { background: "rgba(254,226,226,0.5)", borderColor: "rgba(220,38,38,0.3)" }
            : undefined
        }
      >
        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <input
            type="checkbox"
            checked={!!form.booking_paused}
            onChange={(e) => setForm({ ...form, booking_paused: e.target.checked })}
            className="accent-[#DC2626]"
          />
          Pause new bookings school-wide
        </label>
        <p className="text-xs text-slate-500">
          When on, your public booking page, invite links, and student portal all stop accepting
          new bookings — useful for a temporary closure. Existing bookings and instructor
          availability are unaffected.
        </p>
        <button onClick={saveSettings} className="btn-primary text-sm mt-1">
          Save settings
        </button>
      </section>

      <section className="glass-card p-6 mb-6 space-y-4">
        <h2 className="font-semibold text-slate-900">School details</h2>
        <Field label="School name">
          <input
            value={form.school_name || ""}
            onChange={(e) => setForm({ ...form, school_name: e.target.value })}
            className="glass-input"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="City">
            <input
              value={form.city || ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="glass-input"
            />
          </Field>
          <Field label="Province">
            <input
              value={form.province || ""}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
              className="glass-input"
            />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Contact phone">
            <input
              value={form.contact_phone || ""}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              className="glass-input"
            />
          </Field>
          <Field label="Contact email">
            <input
              value={form.contact_email || ""}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className="glass-input"
            />
          </Field>
        </div>
        <Field label="Service area">
          <textarea
            value={form.service_area || ""}
            onChange={(e) => setForm({ ...form, service_area: e.target.value })}
            className="glass-input min-h-[60px]"
          />
        </Field>
        <Field label="Pickup service areas (postal code prefixes)">
          <input
            value={pickupAreasText}
            onChange={(e) => setPickupAreasText(e.target.value)}
            placeholder="e.g. R2C, R2G, R2J"
            className="glass-input"
          />
          <p className="text-xs text-slate-500 mt-1">
            Comma-separated. New bookings will be blocked if the pickup postal code isn't in one of
            these areas. Leave blank to allow pickup anywhere (default).
          </p>
        </Field>
        <Field label="MPI test locations">
          <input
            value={mpiLocationsText}
            onChange={(e) => setMpiLocationsText(e.target.value)}
            placeholder="e.g. MPI Portage Ave, MPI Regent Ave"
            className="glass-input"
          />
          <p className="text-xs text-slate-500 mt-1">
            Comma-separated. Shown as a dropdown when booking a road test or TSR package so the
            school knows which office to route to. Leave blank to let students type it in freely.
          </p>
        </Field>
        <Field label="Cancellation policy">
          <textarea
            value={form.cancellation_policy || ""}
            onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })}
            placeholder="e.g. Cancellations require 24 hours notice. Late cancellations are charged 50% of the lesson fee."
            className="glass-input min-h-[60px]"
          />
          <p className="text-xs text-slate-500 mt-1">
            Shown to students on your booking page and in booking/cancellation emails — use this
            for anything the fields below don't cover (holidays, exceptions, etc).
          </p>
        </Field>
        <Field label="Cancellation notice (hours)">
          <input
            type="number"
            value={form.cancellation_notice_hours ?? 24}
            onChange={(e) => setForm({ ...form, cancellation_notice_hours: e.target.value })}
            className="glass-input"
          />
          <p className="text-xs text-slate-500 mt-1">
            Students can cancel a lesson themselves in the portal with at least this much notice.
            Cancelling with less notice sends a request for your approval instead.
          </p>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Late cancellation fee">
            <select
              value={form.late_cancel_fee_type ?? "none"}
              onChange={(e) => setForm({ ...form, late_cancel_fee_type: e.target.value })}
              className="glass-input"
            >
              <option value="none">No fee</option>
              <option value="flat">Flat amount</option>
              <option value="percentage">Percentage of lesson price</option>
            </select>
          </Field>
          {form.late_cancel_fee_type && form.late_cancel_fee_type !== "none" && (
            <Field
              label={
                form.late_cancel_fee_type === "flat" ? "Fee amount ($)" : "Fee percentage (%)"
              }
            >
              <input
                type="number"
                value={
                  form.late_cancel_fee_type === "flat"
                    ? (form.late_cancel_fee_value ?? 0) / 100
                    : (form.late_cancel_fee_value ?? 0)
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    late_cancel_fee_value:
                      form.late_cancel_fee_type === "flat"
                        ? Math.round(Number(e.target.value) * 100)
                        : Number(e.target.value),
                  })
                }
                className="glass-input"
              />
            </Field>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="No-show fee">
            <select
              value={form.no_show_fee_type ?? "none"}
              onChange={(e) => setForm({ ...form, no_show_fee_type: e.target.value })}
              className="glass-input"
            >
              <option value="none">No fee</option>
              <option value="flat">Flat amount</option>
              <option value="percentage">Percentage of lesson price</option>
            </select>
          </Field>
          {form.no_show_fee_type && form.no_show_fee_type !== "none" && (
            <Field label={form.no_show_fee_type === "flat" ? "Fee amount ($)" : "Fee percentage (%)"}>
              <input
                type="number"
                value={
                  form.no_show_fee_type === "flat"
                    ? (form.no_show_fee_value ?? 0) / 100
                    : (form.no_show_fee_value ?? 0)
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    no_show_fee_value:
                      form.no_show_fee_type === "flat"
                        ? Math.round(Number(e.target.value) * 100)
                        : Number(e.target.value),
                  })
                }
                className="glass-input"
              />
            </Field>
          )}
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          These fees aren't charged automatically — there's no payment gateway. When applied, they
          show up as an amount owed on the Payments page for you to collect manually, same as any
          other lesson charge.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={!!form.deposit_required}
            onChange={(e) => setForm({ ...form, deposit_required: e.target.checked })}
            className="accent-[#3B82F6]"
          />
          Require deposit at booking
        </label>
        {form.deposit_required && (
          <Field label="Deposit amount ($)">
            <input
              type="number"
              value={(form.deposit_cents ?? 0) / 100}
              onChange={(e) =>
                setForm({ ...form, deposit_cents: Math.round(Number(e.target.value) * 100) })
              }
              className="glass-input"
            />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={!!form.require_approval}
            onChange={(e) => setForm({ ...form, require_approval: e.target.checked })}
            className="accent-[#3B82F6]"
          />
          Require admin approval for new bookings
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={!!form.auto_assign_instructor}
            onChange={(e) => setForm({ ...form, auto_assign_instructor: e.target.checked })}
            className="accent-[#3B82F6]"
          />
          Automatically assign an instructor to new bookings
        </label>
        <p className="text-xs text-slate-500 -mt-2">
          When on, new bookings are assigned to an available instructor based on their weekly hours
          and existing schedule. When off, assign instructors manually from the Booking Queue.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={!!form.auto_invitations_enabled}
            onChange={(e) => setForm({ ...form, auto_invitations_enabled: e.target.checked })}
            className="accent-[#3B82F6]"
          />
          Automatically text students to book their next lesson
        </label>
        <p className="text-xs text-slate-500 -mt-2">
          When on, students with remaining lessons and no upcoming booking get a text after their
          last completed lesson, with one follow-up reminder if they don't book. When off, send
          invitations manually from a student's profile.
        </p>
        <button onClick={saveSettings} className="btn-primary text-sm">
          Save settings
        </button>
      </section>

      <section className="glass-card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Lesson types & prices</h2>
        <div className="space-y-3">
          {(typesQ.data ?? []).map((t: any) => (
            <LessonTypeRow key={t.id} initial={t} onSave={saveType} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
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
        className="glass-input col-span-5 text-sm"
      />
      <input
        type="number"
        value={t.duration_minutes}
        onChange={(e) => setT({ ...t, duration_minutes: e.target.value })}
        className="glass-input col-span-2 text-sm"
      />
      <input
        type="number"
        value={(t.price_cents ?? 0) / 100}
        onChange={(e) => setT({ ...t, price_cents: Math.round(Number(e.target.value) * 100) })}
        className="glass-input col-span-2 text-sm"
      />
      <label className="flex items-center gap-1 text-xs col-span-1 text-slate-700">
        <input
          type="checkbox"
          checked={t.active}
          onChange={(e) => setT({ ...t, active: e.target.checked })}
          className="accent-[#3B82F6]"
        />
        On
      </label>
      <button onClick={() => onSave(t)} className="col-span-2 btn-primary text-xs">
        Save · {money(t.price_cents ?? 0)}
      </button>
    </div>
  );
}
