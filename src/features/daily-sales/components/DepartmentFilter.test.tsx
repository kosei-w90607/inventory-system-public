// src/features/daily-sales/components/DepartmentFilter.test.tsx
//
// B0 characterization test: daily-sales DepartmentFilter の現 DOM 固定。
// B3 移行後: patterns/DepartmentFilter を使用。widthClass="w-[10rem]" / idPrefix="dept-filter"（既定値）。
// D-B4 意図的差分②: allLabel は「すべての部門」（旧実装「すべて」から変更）。
// 設計: docs/function-design/56-ui-daily-sales.md §56.7

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DepartmentOption } from "@/components/patterns/DepartmentFilter";
import { DepartmentFilter } from "@/components/patterns/DepartmentFilter";

const mockOptions: DepartmentOption[] = [
  { id: 1, name: "毛糸" },
  { id: 2, name: "布" },
];

describe("DepartmentFilter (daily-sales, UI-09a) B0 characterization (D-B4)", () => {
  it("B0-daily-DF1: SelectTrigger の id が 'dept-filter' である（現状固定）", () => {
    render(<DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} />);

    const trigger = document.getElementById("dept-filter");
    expect(trigger).toBeInTheDocument();
  });

  it("B0-daily-DF2: SelectTrigger に w-[10rem] クラスが付いている（width 現状固定）", () => {
    render(<DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} />);

    const trigger = document.getElementById("dept-filter");
    expect(trigger?.className).toContain("w-[10rem]");
  });

  it("B0-daily-DF3: unselected 時、placeholder「すべての部門」が表示される（D-B4 意図的差分②: allLabel 既定「すべての部門」へ統一）", () => {
    render(<DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} />);

    // SelectValue placeholder として表示される（D-B4: daily の「すべて」→「すべての部門」は意図的差分②）
    expect(screen.getByText("すべての部門")).toBeInTheDocument();
  });

  it("B0-daily-DF4: daily の呼び出し元は disabled を渡さない（デフォルト false = disabled でない）", () => {
    // daily の呼び出し元（DailySalesPage）は disabled を渡さない。
    // patterns/DepartmentFilter は disabled? を持つが、省略時は false。
    render(<DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} />);

    const trigger = document.getElementById("dept-filter");
    // disabled 属性が付与されていない
    expect(trigger).not.toBeDisabled();
  });

  it("B0-daily-DF5: 部門選択で onChange が number を渡して呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DepartmentFilter options={mockOptions} selected={null} onChange={onChange} />);

    // SelectTrigger を開く
    await user.click(screen.getByRole("combobox"));
    // 「毛糸」を選択
    await user.click(screen.getByText("毛糸"));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("B0-daily-DF6: 「すべての部門」選択で onChange が null を渡して呼ばれる（__all__ → null 変換の現挙動、D-B4 意図的差分②）", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DepartmentFilter options={mockOptions} selected={1} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    // SelectContent が portal で開いた後、option role で「すべての部門」を 1 件取得してクリック（D-B4: 「すべて」→「すべての部門」）
    const allOption = screen.getByRole("option", { name: "すべての部門" });
    expect(allOption).toBeInTheDocument();
    await user.click(allOption);

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
