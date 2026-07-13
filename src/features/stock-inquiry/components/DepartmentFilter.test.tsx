// src/features/stock-inquiry/components/DepartmentFilter.test.tsx
//
// B0 characterization test: stock-inquiry DepartmentFilter の現 DOM 固定。
// B3 移行後: patterns/DepartmentFilter を使用。
// D-B4: allLabel は「すべての部門」/ widthClass="w-[10rem]" / idPrefix="stock-dept-filter"。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DepartmentOption } from "@/components/patterns/DepartmentFilter";
import { DepartmentFilter } from "@/components/patterns/DepartmentFilter";

const mockOptions: DepartmentOption[] = [
  { id: 1, name: "毛糸" },
  { id: 2, name: "布" },
];

/** stock-inquiry 呼び出し元と同じ props セット（DOM 不変の機械証明） */
const stockProps = {
  allLabel: "すべての部門" as const,
  widthClass: "w-[10rem]",
  idPrefix: "stock-dept-filter",
} as const;

describe("DepartmentFilter (stock-inquiry, UI-06a) B0 characterization (D-B4)", () => {
  it("B0-stock-DF1: SelectTrigger の id が 'stock-dept-filter' である（現状固定）", () => {
    render(
      <DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} {...stockProps} />,
    );

    const trigger = document.getElementById("stock-dept-filter");
    expect(trigger).toBeInTheDocument();
  });

  it("B0-stock-DF2: SelectTrigger に w-[10rem] クラスが付いている（width 現状固定、products の w-[11rem] と異なる）", () => {
    render(
      <DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} {...stockProps} />,
    );

    const trigger = document.getElementById("stock-dept-filter");
    expect(trigger?.className).toContain("w-[10rem]");
  });

  it("B0-stock-DF3: unselected 時、placeholder「すべての部門」が表示される", () => {
    render(
      <DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} {...stockProps} />,
    );

    expect(screen.getByText("すべての部門")).toBeInTheDocument();
  });

  it("B0-stock-DF4: stock の呼び出し元は disabled を渡さない（デフォルト false = disabled でない）", () => {
    // stock の呼び出し元（StockInquiryPage）は disabled を渡さない。
    // patterns/DepartmentFilter は disabled? を持つが、省略時は false。
    render(
      <DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} {...stockProps} />,
    );

    const trigger = document.getElementById("stock-dept-filter");
    expect(trigger).not.toBeDisabled();
  });

  it("B0-stock-DF5: 部門選択で onChange が number を渡して呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DepartmentFilter
        options={mockOptions}
        selected={null}
        onChange={onChange}
        {...stockProps}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("毛糸"));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("B0-stock-DF6: 「すべての部門」選択で onChange が null を渡して呼ばれる（__all__ → null 変換の現挙動）", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DepartmentFilter options={mockOptions} selected={1} onChange={onChange} {...stockProps} />,
    );

    await user.click(screen.getByRole("combobox"));
    // SelectContent が portal で開いた後、option role で「すべての部門」を 1 件取得してクリック
    const allOption = screen.getByRole("option", { name: "すべての部門" });
    expect(allOption).toBeInTheDocument();
    await user.click(allOption);

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
