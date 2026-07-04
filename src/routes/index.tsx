import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$schoolSlug", params: { schoolSlug: "winnipeg-pro" } });
  },
});
