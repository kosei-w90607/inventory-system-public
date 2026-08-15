import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render-with-router";
import { ResultStep } from "./ResultStep";

it("test_import_result_req401_rollback_dialog_identifies_exact_import_and_sibling_survival", async () => {
  // REQ-401 / I-U7 / SPEC-SDI-D7: rollback対象ID/date/amountとsibling残存をexact表示する。
  const user = userEvent.setup();
  const onRollback = vi.fn();
  renderWithRouter(
    <ResultStep
      result={{
        csv_import_id: 42,
        status: "completed",
        total_items: 2,
        total_amount: -300,
        skipped_count: 0,
      }}
      settlementDate="2026-03-21"
      filename="Z004_0002.CSV"
      onRollback={onRollback}
      isRollingBack={false}
    />,
  );
  expect(await screen.findByText("2026-03-21")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "取り消す" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent(
    "この取込みだけを取り消します。同じ日の他の取込みは残ります。",
  );
  expect(screen.getByRole("alertdialog")).toHaveTextContent("ID 42");
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Z004_0002.CSV");
  expect(screen.getByRole("alertdialog")).toHaveTextContent("2 件 / ¥-300");
  await user.click(screen.getByRole("button", { name: "取り消す" }));
  expect(onRollback).toHaveBeenCalledTimes(1);
});
