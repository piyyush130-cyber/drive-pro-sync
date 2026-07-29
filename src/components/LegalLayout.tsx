import { Link } from "@tanstack/react-router";
import { CarFront } from "lucide-react";
import type { ReactNode } from "react";

export function LegalLayout({
  title,
  updatedDate,
  children,
}: {
  title: string;
  updatedDate: string;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{ background: "linear-gradient(135deg, #EDE8DF 0%, #E4DDD0 40%, #EAE4D8 100%)" }}
    >
      <div
        className="max-w-2xl mx-auto rounded-2xl p-10"
        style={{
          background: "#FAF8F4",
          border: "1px solid rgba(201,168,76,0.2)",
          boxShadow: "0 8px 40px rgba(27,43,75,0.12)",
        }}
      >
        <Link to="/" className="text-xs" style={{ color: "#6B6B7B" }}>
          ← Back to booking
        </Link>
        <div className="flex items-center gap-2.5 mt-4 mb-6">
          <div
            className="size-9 rounded-xl grid place-items-center"
            style={{ background: "#1B2B4B" }}
          >
            <CarFront className="size-4.5 text-white" />
          </div>
          <div className="text-xl font-bold" style={{ color: "#1B2B4B" }}>
            DriveProSync
          </div>
        </div>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "#1A1A2E" }}>
          {title}
        </h1>
        <p className="text-xs mb-8" style={{ color: "#6B6B7B" }}>
          Last updated: {updatedDate}
        </p>
        <div className="space-y-6 text-sm leading-relaxed" style={{ color: "#3A3A4A" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold mb-2" style={{ color: "#1B2B4B" }}>
        {heading}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
