import { createFileRoute } from "@tanstack/react-router";

import { IntegrityCheckPage } from "@/features/integrity-check/IntegrityCheckPage";

export const Route = createFileRoute("/settings/integrity")({
  component: IntegrityCheckPage,
});
