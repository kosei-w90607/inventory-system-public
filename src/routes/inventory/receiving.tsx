import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inventory/receiving")({
  component: ReceivingLayout,
});

function ReceivingLayout() {
  return <Outlet />;
}
