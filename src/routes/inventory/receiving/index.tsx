import { createFileRoute } from "@tanstack/react-router";
import { ReceivingPage } from "@/features/receiving/ReceivingPage";

export const Route = createFileRoute("/inventory/receiving/")({
  component: ReceivingPage,
});
