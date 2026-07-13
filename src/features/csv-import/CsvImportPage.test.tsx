import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CsvImportPage } from "./CsvImportPage";

vi.mock("@/features/daily-report-import/DailyReportImportPage", () => ({
  DailyReportImportPage: () => <div>daily report req401 content</div>,
}));

vi.mock("./hooks/useCsvImportFlow", () => ({
  useCsvImportFlow: () => ({
    state: { status: "idle" },
    selectFile: vi.fn(),
    confirmImport: vi.fn(),
    rollback: vi.fn(),
    dismissError: vi.fn(),
    isParsing: false,
    isImporting: false,
    isRollingBack: false,
  }),
}));

describe("CsvImportPage_req401", () => {
  it("REQ-401: opens as sales import with daily report default tab and Z004 tab label", () => {
    render(<CsvImportPage />);

    expect(screen.getByRole("heading", { name: "売上データ取込み" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "日報取込み" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "商品別CSV取込み（Z004）" })).toBeInTheDocument();
    expect(screen.getByText("daily report req401 content")).toBeInTheDocument();
  });
});
