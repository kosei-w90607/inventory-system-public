// src/features/csv-import/components/ErrorRowsTable.test.tsx
//
// REQ-401: 取込みエラー行 accordion の発見性（T17、owner L3 P3 起源 / gated Amendment 2）。
// 閉状態で明示的な操作文言の trigger が可視で、click で展開・文言切替、再 click で閉じる。

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ErrorSummary } from "@/lib/bindings";
import { ErrorRowsTable } from "./ErrorRowsTable";

const errorSummary: ErrorSummary = {
  count: 1,
  items: [
    {
      line_no: 4,
      normalized_jan: "4900000099999",
      name: "未登録テスト商品",
      raw_quantity: "2",
      raw_amount: "660",
      error_type: "unmatched_product",
      error_message: "商品マスタに該当する JAN がありません",
    },
  ],
};

describe("ErrorRowsTable accordion 発見性 (REQ-401 / T17)", () => {
  it("REQ-401: 閉状態では操作文言 trigger のみ可視で、エラー内容は表示しない", () => {
    render(<ErrorRowsTable errorSummary={errorSummary} />);

    expect(screen.getByRole("button", { name: "エラー詳細を見る（1件）" })).toBeInTheDocument();
    expect(screen.queryByText("商品マスタに該当する JAN がありません")).not.toBeInTheDocument();
  });

  it("REQ-401: click で展開してエラー行を表示し、trigger 文言が「閉じる」へ切り替わる", async () => {
    const user = userEvent.setup();
    render(<ErrorRowsTable errorSummary={errorSummary} />);

    await user.click(screen.getByRole("button", { name: "エラー詳細を見る（1件）" }));

    expect(screen.getByRole("button", { name: "エラー詳細を閉じる（1件）" })).toBeInTheDocument();
    expect(screen.getByText("商品マスタに該当する JAN がありません")).toBeInTheDocument();
    expect(screen.getByText("未登録テスト商品")).toBeInTheDocument();
  });

  it("REQ-401: 再 click で閉じて操作文言が「見る」へ戻る", async () => {
    const user = userEvent.setup();
    render(<ErrorRowsTable errorSummary={errorSummary} />);

    await user.click(screen.getByRole("button", { name: "エラー詳細を見る（1件）" }));
    await user.click(screen.getByRole("button", { name: "エラー詳細を閉じる（1件）" }));

    expect(screen.getByRole("button", { name: "エラー詳細を見る（1件）" })).toBeInTheDocument();
    expect(screen.queryByText("商品マスタに該当する JAN がありません")).not.toBeInTheDocument();
  });
});
