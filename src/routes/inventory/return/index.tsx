import { createFileRoute } from "@tanstack/react-router";
import { ReturnExchangePage } from "@/features/return-exchange/ReturnExchangePage";

export const Route = createFileRoute("/inventory/return/")({
  component: ReturnExchangePage,
});
