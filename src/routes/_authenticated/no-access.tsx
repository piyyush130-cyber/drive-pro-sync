import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/no-access")({
  component: NoAccessRoute,
});

function NoAccessRoute() {
  return null;
}