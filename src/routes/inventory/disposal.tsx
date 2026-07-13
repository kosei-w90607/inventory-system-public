import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inventory/disposal")({
  component: DisposalLayout,
});

function DisposalLayout() {
  return <Outlet />;
}
