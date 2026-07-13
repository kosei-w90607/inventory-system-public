import { createFileRoute } from "@tanstack/react-router";

import { ThresholdSettingsPage } from "@/features/threshold-settings/ThresholdSettingsPage";

export const Route = createFileRoute("/settings/thresholds")({
  component: ThresholdSettingsPage,
});
