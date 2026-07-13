import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inventory/return")({
  component: ReturnLayout,
});

function ReturnLayout() {
  return <Outlet />;
}
