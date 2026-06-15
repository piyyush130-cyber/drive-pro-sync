import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/cancel")({
  component: CancelPage,
});

function CancelPage() {
  const [bookingId, setBookingId] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase
      .from("cancellation_requests")
      .insert({ booking_id: bookingId, reason, status: "requested" });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="bg-white ring-1 ring-black/5 rounded-xl p-8 w-full max-w-md">
        <Link to="/" className="text-xs text-zinc-500">← Back</Link>
        <h1 className="text-2xl font-medium mt-3 mb-2">Cancel or reschedule</h1>
        <p className="text-sm text-zinc-600 mb-6">
          Enter your booking confirmation ID (sent in your confirmation) and tell us why.
        </p>
        {done ? (
          <div className="text-emerald-800">Request sent. The school will reach out shortly.</div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Booking ID</label>
              <input
                required
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Reason</label>
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2 text-sm min-h-[100px]"
              />
            </div>
            <button
              disabled={submitting}
              className="w-full bg-emerald-800 text-white py-3 rounded-md font-medium text-sm disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
