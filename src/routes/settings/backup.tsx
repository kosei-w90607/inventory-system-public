import { createFileRoute } from "@tanstack/react-router";

import { BackupRestorePage } from "@/features/backup-restore/BackupRestorePage";

export const Route = createFileRoute("/settings/backup")({
  component: BackupRestorePage,
});
