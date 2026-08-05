import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/start-client-core";
import { type ReactNode, useEffect } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";

const initClientSentry = createClientOnlyFn(() => {
  import("@/lib/sentry.client").then((m) => m.initClientSentry());
});

const reportClientError = createClientOnlyFn((error: unknown) => {
  import("@/lib/sentry.client").then((m) => m.captureClientError(error));
});

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DrivingOps — Driving School Booking System" },
      {
        name: "description",
        content:
          "Simple booking, scheduling, pickup coordination, instructor management, and payment tracking for driving schools.",
      },
      { property: "og:title", content: "DrivingOps — Driving School Booking System" },
      { name: "twitter:title", content: "DrivingOps — Driving School Booking System" },
      {
        property: "og:description",
        content:
          "Simple booking, scheduling, pickup coordination, instructor management, and payment tracking for driving schools.",
      },
      {
        name: "twitter:description",
        content:
          "Simple booking, scheduling, pickup coordination, instructor management, and payment tracking for driving schools.",
      },
      { name: "twitter:card", content: "summary" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0F1E]">
      <div className="text-center">
        <div className="text-5xl font-semibold text-[#F1F5F9]">404</div>
        <p className="text-[#94A3B8] mt-2">Page not found</p>
        <a href="/" className="mt-4 inline-block text-[#60A5FA] underline">
          Go home
        </a>
      </div>
    </div>
  ),
  errorComponent: RootErrorFallback,
});

function RootErrorFallback({ error }: { error: Error }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0F1E] p-6">
      <div className="text-center max-w-md">
        <div className="text-xl font-semibold text-[#F1F5F9]">Something went wrong</div>
        <p className="text-sm text-[#94A3B8] mt-2">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-semibold text-[#0A0F1E] bg-[#60A5FA] rounded-lg px-4 py-2 hover:brightness-110"
          >
            Try again
          </button>
          <a href="/" className="text-sm text-[#60A5FA] underline">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    initClientSentry();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
