// src/features/monthly-sales/components/DepartmentTable.test.tsx
//
// REQ-502 P2-2: DepartmentTable の SortableHeader 結線テスト (3 列: name/amount/
// prev_month_diff の click → onSortChange call、aria-sort 属性 active 検証、
// 構成比列はソート対象外)。defensive case: sortBy='quantity' URL paste 注入時
// (DeptCompositionRow に quantity field 不在) で table render が破綻しない。
// 設計: docs/plans/2026-05-19-pr-66-codex-r1-p2-fixes.md §2 commit 2

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { DepartmentTable } from "./DepartmentTable";
import { makeMockDeptCompositionRow } from "../lib/test-fixtures";
import type { SortColumn } from "../types";

const sampleRows = [
  makeMockDeptCompositionRow({ key: "1", label: "毛糸", amount: 5000, ratio: 0.5 }),
  makeMockDeptCompositionRow({ key: "2", label: "布", amount: 3000, ratio: 0.3 }),
];

// B0 characterization: 空結果の EmptyState DOM 固定（意図的差分③）
// bare div → EmptyState 標準 UI に置換。title(h3) + description の 2 要素に分割される。
// plan B0 reachability 注記: page 経由（MonthlySalesPage の query empty mock）では
// page が先に月度メッセージを出すため、このテーブル内空分岐には到達不能。
// 必ず rows=[] の直接 render で characterization する（R3 P2-B）。
describe("DepartmentTable (B0 empty-state characterization)", () => {
  it("B0-dept-empty: rows=[] のとき EmptyState の title と description が表示される", () => {
    render(
      <DepartmentTable
        rows={[]}
        comparisonMap={new Map()}
        sortBy={null}
        sortDir="asc"
        onSortChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "該当する売上明細がありません" }),
    ).toBeInTheDocument();
    expect(screen.getByText("月や部門を変更してお試しください")).toBeInTheDocument();
  });
});

describe("DepartmentTable (REQ-502 sort 結線)", () => {
  it("REQ-502: SortableHeader 3 列 click で onSortChange が name/amount/prev_month_diff を順に call、構成比列はソート対象外", () => {
    const onSortChange = vi.fn<(column: SortColumn) => void>();
    render(
      <DepartmentTable
        rows={sampleRows}
        comparisonMap={new Map()}
        sortBy={null}
        sortDir="asc"
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /部門/ }));
    fireEvent.click(screen.getByRole("button", { name: /売上/ }));
    fireEvent.click(screen.getByRole("button", { name: /前月比/ }));

    expect(onSortChange).toHaveBeenCalledTimes(3);
    expect(onSortChange).toHaveBeenNthCalledWith(1, "name");
    expect(onSortChange).toHaveBeenNthCalledWith(2, "amount");
    expect(onSortChange).toHaveBeenNthCalledWith(3, "prev_month_diff");
    // 構成比列はソート対象外 = button ではなく plain TableHead
    expect(screen.queryByRole("button", { name: /構成比/ })).toBeNull();
  });

  it("REQ-502: aria-sort 属性は active 列のみ ascending/descending、他列は none", () => {
    render(
      <DepartmentTable
        rows={sampleRows}
        comparisonMap={new Map()}
        sortBy="amount"
        sortDir="desc"
        onSortChange={vi.fn()}
      />,
    );
    const headers = screen.getAllByRole("columnheader");
    const amountHeader = headers.find((h) => h.textContent?.includes("売上"));
    const nameHeader = headers.find((h) => h.textContent?.includes("部門"));
    const ratioHeader = headers.find((h) => h.textContent?.includes("構成比"));
    expect(amountHeader?.getAttribute("aria-sort")).toBe("descending");
    expect(nameHeader?.getAttribute("aria-sort")).toBe("none");
    // 構成比列はソート対象外、aria-sort は null or "none" のいずれか (実装依存だが破綻しないこと)
    expect(["none", null]).toContain(ratioHeader?.getAttribute("aria-sort") ?? null);
  });

  it("REQ-502 defensive: sortBy='quantity' URL paste 注入時に DeptCompositionRow 不在 field でも render 破綻しない", () => {
    // Q-4 と zod schema 4 値の不整合論点: URL `?sortBy=quantity&mode=department` を paste されたとき、
    // DeptCompositionRow に quantity field 不在 → sortMonthlyItems extractValue null fallback →
    // 全行 null → 入力順保持で table 破綻なし。本 test は DepartmentTable が型互換に props を
    // 受け取って 2 行 render することを確認する unit crash test。
    render(
      <DepartmentTable
        rows={sampleRows}
        comparisonMap={new Map()}
        sortBy={"quantity" as SortColumn}
        sortDir="asc"
        onSortChange={vi.fn()}
      />,
    );
    expect(screen.getByText("毛糸")).toBeDefined();
    expect(screen.getByText("布")).toBeDefined();
  });
});
