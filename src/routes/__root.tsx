import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DriveProSync — Driving School Booking System" },
      { name: "description", content: "Simple booking, scheduling, pickup coordination, instructor management, and payment tracking for driving schools." },
      { property: "og:title", content: "DriveProSync — Driving School Booking System" },
      { name: "twitter:title", content: "DriveProSync — Driving School Booking System" },
      { property: "og:description", content: "Simple booking, scheduling, pickup coordination, instructor management, and payment tracking for driving schools." },
      { name: "twitter:description", content: "Simple booking, scheduling, pickup coordination, instructor management, and payment tracking for driving schools." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/db0a783a-6b7f-400c-b7e6-e8ac8d165ed7/id-preview-2a3032fd--a4ab71a0-4ab6-48b3-831d-8c01ad32c818.lovable.app-1781502457180.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/db0a783a-6b7f-400c-b7e6-e8ac8d165ed7/id-preview-2a3032fd--a4ab71a0-4ab6-48b3-831d-8c01ad32c818.lovable.app-1781502457180.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0F1E]">
      <div className="text-center">
        <div className="text-5xl font-semibold text-[#F1F5F9]">404</div>
        <p className="text-[#94A3B8] mt-2">Page not found</p>
        <a href="/" className="mt-4 inline-block text-[#60A5FA] underline">Go home</a>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0F1E] p-6">
      <div className="text-center max-w-md">
        <div className="text-xl font-semibold text-[#F1F5F9]">Something went wrong</div>
        <p className="text-sm text-[#94A3B8] mt-2">{error.message}</p>
      </div>
    </div>
  ),
});

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
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
