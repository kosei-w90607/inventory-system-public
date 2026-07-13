import { createFileRoute } from "@tanstack/react-router";
import { PluExportPage } from "@/features/plu-export/PluExportPage";

export const Route = createFileRoute("/products/plu-export")({
  component: PluExportPage,
});
