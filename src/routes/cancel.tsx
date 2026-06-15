import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck } from "lucide-react";
import { submitPublicCancellation } from "@/lib/public-booking.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/cancel")({
  component: CancelPage,
});

function CancelPage() {
  const [bookingId, setBookingId] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submit = useServerFn(submitPublicCancellation);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submit({ data: { booking_id: bookingId, reason } });
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-mist)] flex items-center justify-center p-6">
      <div className="card-premium p-8 w-full max-w-md">
        <Link to="/" className="text-xs text-slate-500 hover:text-slate-900">
          ← Back to booking
        </Link>
        <div className="eyebrow text-blue-700 mt-3">DriveProSync</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 mb-2">
          Cancel or reschedule
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Enter your booking confirmation ID (from your confirmation message) and tell us why. The
          school will reach out shortly.
        </p>
        {done ? (
          <div className="text-center py-4">
            <div className="mx-auto size-12 rounded-full bg-emerald-50 ring-1 ring-emerald-200 grid place-items-center">
              <CircleCheck className="size-6 text-emerald-600" />
            </div>
            <div className="mt-3 font-semibold tracking-tight">Request sent</div>
            <div className="text-sm text-slate-500 mt-1">
              The school will reach out shortly.
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Booking ID</label>
              <input
                required
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="input-premium"
                placeholder="e.g. 9f2c…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-premium min-h-[110px]"
                placeholder="Let the school know what's changed."
              />
            </div>
            <button disabled={submitting} className="btn-primary w-full">
              {submitting ? "Sending…" : "Send request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
