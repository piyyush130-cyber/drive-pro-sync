import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CarFront, Check, Clock } from "lucide-react";
import { getWaitlistOffer, claimWaitlistOffer } from "@/lib/waitlist-claim.functions";
import { fmtDate, fmtTime, money } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/claim/$token")({
  component: ClaimPage,
});

function ClaimPage() {
  const { token } = Route.useParams();
  const getOffer = useServerFn(getWaitlistOffer);
  const claim = useServerFn(claimWaitlistOffer);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [info, setInfo] = useState<{
    firstName: string;
    schoolName: string;
    instructorName: string | null;
    lessonTypeName: string;
    priceCents: number;
    scheduledAt: string;
  } | null>(null);

  useEffect(() => {
    getOffer({ data: { token } })
      .then((data) => setInfo(data))
      .catch((err: any) => setLoadError(err?.message || "This offer is no longer valid."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleClaim() {
    setClaiming(true);
    try {
      await claim({ data: { token } });
      setClaimed(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not claim this lesson");
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="text-lg font-semibold text-slate-900">Offer unavailable</div>
          <p className="mt-2 text-sm text-slate-500">{loadError}</p>
        </div>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="size-14 rounded-full bg-emerald-100 grid place-items-center mx-auto mb-4">
            <Check className="size-7 text-emerald-600" />
          </div>
          <div className="text-lg font-semibold text-slate-900">Lesson claimed!</div>
          <p className="mt-2 text-sm text-slate-500">
            {info.schoolName} will be in touch to confirm your lesson on {fmtDate(info.scheduledAt)}
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="size-9 rounded-xl bg-indigo-600 grid place-items-center">
            <CarFront className="size-4.5 text-white" />
          </div>
          <div className="text-sm font-semibold text-slate-900">{info.schoolName}</div>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">A lesson opened up!</h1>
        <p className="text-sm text-slate-500 mt-1">
          Hi {info.firstName} — first to claim it gets it.
        </p>
        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-1.5 text-sm">
          <div className="inline-flex items-center gap-1.5 text-slate-700">
            <Clock className="size-3.5 text-slate-400" />
            {fmtDate(info.scheduledAt)} at {fmtTime(info.scheduledAt)}
          </div>
          <div className="text-slate-700">{info.lessonTypeName}</div>
          {info.instructorName && <div className="text-slate-500">With {info.instructorName}</div>}
          <div className="text-blue-700 font-semibold">{money(info.priceCents)}</div>
        </div>
        <button
          onClick={handleClaim}
          disabled={claiming}
          className="mt-5 w-full rounded-lg bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-60"
        >
          {claiming ? "Claiming…" : "Claim this lesson"}
        </button>
      </div>
    </div>
  );
}
