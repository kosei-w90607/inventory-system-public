import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PreviewData } from "@/lib/bindings";
import { PreviewStep } from "./PreviewStep";

const preview: PreviewData = {
  file_info: {
    filename: "Z004_0002.CSV",
    settlement_date: "2026-03-21",
    file_hash: "a".repeat(64),
  },
  matched_summary: { count: 2, total_amount: 900, warnings: [] },
  error_summary: { count: 0, items: [] },
  duplicate_check: {
    status: "AdditionalImportConfirmationRequired",
    same_date_imports: [
      {
        id: 12,
        filename: "Z004_0001.CSV",
        total_items: 3,
        total_amount: 1200,
        imported_at: "2026-03-21T09:00:00",
      },
      {
        id: 11,
        filename: "Z004_0000.CSV",
        total_items: 1,
        total_amount: -300,
        imported_at: "2026-03-21T08:00:00",
      },
    ],
  },
  preview_created_at: "2026-03-21T10:00:00",
};

describe("PreviewStep REQ-401 same-day addition", () => {
  it("test_additional_import_req401_alert_dialog_lists_all_cancel_then_confirms_once", async () => {
    // REQ-401 / I-U1 / I-U2 / I-U5 / I-U6 / SPEC-SDI-D5: exact UI、全summary、cancel/Esc、single submit。
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PreviewStep
        preview={preview}
        filename="Z004_0002.CSV"
        onConfirm={onConfirm}
        onReselect={vi.fn()}
        isImporting={false}
      />,
    );

    expect(screen.getByText("同じ日の取込みがあります")).toBeInTheDocument();
    expect(
      screen.getByText("既存分を残したまま今回分を追加します。内容を確認してください。"),
    ).toBeInTheDocument();
    expect(screen.getByText("追加確認")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取り込む" }));
    expect(screen.getByText("同じ日のデータを追加で取り込みますか？")).toBeInTheDocument();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("既存分（2回）");
    expect(dialog).toHaveTextContent("ID 12");
    expect(dialog).toHaveTextContent("Z004_0001.CSV");
    expect(dialog).toHaveTextContent("¥1,200 / 3件");
    expect(dialog).toHaveTextContent("2026-03-21T09:00:00");
    expect(dialog).toHaveTextContent("ID 11");
    expect(dialog).toHaveTextContent("Z004_0000.CSV");
    expect(dialog).toHaveTextContent("¥-300 / 1件");
    expect(dialog).toHaveTextContent("今回分");
    expect(dialog).toHaveTextContent("Z004_0002.CSV");
    expect(dialog).toHaveTextContent("¥900 / 2件");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("精算日:")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "取り込む" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "取り込む" }));
    await user.click(screen.getByRole("button", { name: "追加で取り込む" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("test_additional_import_req401_importing_disables_confirmation", async () => {
    // REQ-401 / I-U6 / SPEC-SDI-D5: importing中は追加確認commandを開始できない。
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PreviewStep
        preview={preview}
        filename="Z004_0002.CSV"
        onConfirm={onConfirm}
        onReselect={vi.fn()}
        isImporting
      />,
    );

    const importButton = screen.getByRole("button", { name: "取り込む" });
    expect(importButton).toBeDisabled();
    await user.click(importButton);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
