// src/features/products/components/DepartmentFilter.test.tsx
//
// B0 characterization test: products DepartmentFilter の現 DOM 固定。
// B3 移行後: patterns/DepartmentFilter を使用。
// D-B4: allLabel は「すべての部門」/ widthClass="w-[11rem]" / idPrefix="product-dept-filter" / disabled prop 有。
// 設計: docs/function-design/50-ui-product-list.md

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DepartmentOption } from "@/components/patterns/DepartmentFilter";
import { DepartmentFilter } from "@/components/patterns/DepartmentFilter";

const mockOptions: DepartmentOption[] = [
  { id: 1, name: "毛糸" },
  { id: 3, name: "布" },
];

/** products 呼び出し元と同じ props セット（DOM 不変の機械証明） */
const productsProps = {
  allLabel: "すべての部門" as const,
  widthClass: "w-[11rem]",
  idPrefix: "product-dept-filter",
} as const;

describe("DepartmentFilter (products, UI-01a) B0 characterization (D-B4)", () => {
  it("B0-products-DF1: SelectTrigger の id が 'product-dept-filter' である（現状固定）", () => {
    render(
      <DepartmentFilter
        options={mockOptions}
        selected={null}
        onChange={vi.fn()}
        {...productsProps}
      />,
    );

    const trigger = document.getElementById("product-dept-filter");
    expect(trigger).toBeInTheDocument();
  });

  it("B0-products-DF2: SelectTrigger に w-[11rem] クラスが付いている（width 現状固定、daily/stock の w-[10rem] と異なる）", () => {
    render(
      <DepartmentFilter
        options={mockOptions}
        selected={null}
        onChange={vi.fn()}
        {...productsProps}
      />,
    );

    const trigger = document.getElementById("product-dept-filter");
    expect(trigger?.className).toContain("w-[11rem]");
  });

  it("B0-products-DF3: unselected 時、placeholder「すべての部門」が表示される", () => {
    render(
      <DepartmentFilter
        options={mockOptions}
        selected={null}
        onChange={vi.fn()}
        {...productsProps}
      />,
    );

    expect(screen.getByText("すべての部門")).toBeInTheDocument();
  });

  it("B0-products-DF4: disabled=true で SelectTrigger が disabled になる", () => {
    render(
      <DepartmentFilter
        options={mockOptions}
        selected={null}
        disabled={true}
        onChange={vi.fn()}
        {...productsProps}
      />,
    );

    const trigger = document.getElementById("product-dept-filter");
    expect(trigger).toBeDisabled();
  });

  it("B0-products-DF5: disabled=false のとき（デフォルト）、SelectTrigger は disabled でない", () => {
    render(
      <DepartmentFilter
        options={mockOptions}
        selected={null}
        onChange={vi.fn()}
        {...productsProps}
      />,
    );

    const trigger = document.getElementById("product-dept-filter");
    expect(trigger).not.toBeDisabled();
  });

  it("B0-products-DF6: 部門選択で onChange が number を渡して呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DepartmentFilter
        options={mockOptions}
        selected={null}
        onChange={onChange}
        {...productsProps}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("毛糸"));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("B0-products-DF7: 「すべての部門」選択で onChange が null を渡して呼ばれる（__all__ → null 変換の現挙動）", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DepartmentFilter
        options={mockOptions}
        selected={1}
        onChange={onChange}
        {...productsProps}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    // SelectContent が portal で開いた後、option role で「すべての部門」を 1 件取得してクリック
    const allOption = screen.getByRole("option", { name: "すべての部門" });
    expect(allOption).toBeInTheDocument();
    await user.click(allOption);

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
