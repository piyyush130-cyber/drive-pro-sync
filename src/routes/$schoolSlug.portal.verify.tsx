import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPortalLogin } from "@/lib/student-portal.functions";

export const Route = createFileRoute("/$schoolSlug/portal/verify")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { schoolSlug } = Route.useParams();
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const verify = useServerFn(verifyPortalLogin);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("This link is missing its login token.");
      return;
    }
    verify({ data: { token } })
      .then(({ sessionToken }) => {
        localStorage.setItem(`portal_session_${schoolSlug}`, sessionToken);
        navigate({ to: "/$schoolSlug/portal", params: { schoolSlug }, replace: true });
      })
      .catch((err: any) => setError(err?.message || "This link is invalid or has expired."));
    // Only run once, on mount — re-running on every render would burn the
    // single-use token a second time and always fail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="text-lg font-semibold text-slate-900">Link unavailable</div>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link
            to="/$schoolSlug/portal"
            params={{ schoolSlug }}
            className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500 bg-slate-50">
      Logging you in…
    </div>
  );
}
