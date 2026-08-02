import { createFileRoute, Outlet } from "@tanstack/react-router";

/// UI-07 CSV取込み family の layout route。
/// 設計: docs/function-design/65-inventory-record-traceability.md §65.10 slice 4b
export const Route = createFileRoute("/csv-import")({
  component: CsvImportLayout,
});

function CsvImportLayout() {
  return <Outlet />;
}
