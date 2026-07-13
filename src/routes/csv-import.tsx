import { createFileRoute } from "@tanstack/react-router";
import { CsvImportPage } from "@/features/csv-import/CsvImportPage";

/// UI-07 CSV取込み画面のファイルベースルート。
/// 設計: docs/function-design/55-ui-csv-import.md §55.1 接続点
export const Route = createFileRoute("/csv-import")({
  component: CsvImportPage,
});
