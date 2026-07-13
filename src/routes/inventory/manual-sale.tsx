import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inventory/manual-sale")({
  component: ManualSaleLayout,
});

function ManualSaleLayout() {
  return <Outlet />;
}
