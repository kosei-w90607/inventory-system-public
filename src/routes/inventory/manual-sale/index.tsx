import { createFileRoute } from "@tanstack/react-router";
import { ManualSalePage } from "@/features/manual-sale/ManualSalePage";

export const Route = createFileRoute("/inventory/manual-sale/")({
  component: ManualSalePage,
});
