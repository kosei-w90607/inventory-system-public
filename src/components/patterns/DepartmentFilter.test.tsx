// src/components/patterns/DepartmentFilter.test.tsx
//
// patterns/DepartmentFilter の unit test。
// allLabel 既定 / 上書き、widthClass / idPrefix / disabled の反映、
// 選択操作での onChange（__all__ → null 変換含む）を検証する。
// 設計: docs/function-design/59-ui-shared-patterns.md §59.3

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DepartmentOption } from "./DepartmentFilter";
import { DepartmentFilter } from "./DepartmentFilter";

const mockOptions: DepartmentOption[] = [
  { id: 1, name: "毛糸" },
  { id: 2, name: "布" },
];

describe("DepartmentFilter (patterns) unit", () => {
  describe("allLabel", () => {
    it("DF-1: allLabel 省略時は「すべての部門」が既定表示される", () => {
      render(<DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} />);

      // SelectValue placeholder として表示される
      expect(screen.getByText("すべての部門")).toBeInTheDocument();
    });

    it("DF-2: allLabel を渡した場合はその文言が表示される", () => {
      render(
        <DepartmentFilter
          options={mockOptions}
          selected={null}
          onChange={vi.fn()}
          allLabel="すべて"
        />,
      );

      expect(screen.getByText("すべて")).toBeInTheDocument();
    });

    it("DF-3: unselected 時に SelectContent の「すべての部門」選択肢が存在する", async () => {
      const user = userEvent.setup();
      render(
        <DepartmentFilter
          options={mockOptions}
          selected={1}
          onChange={vi.fn()}
          allLabel="すべての部門"
        />,
      );

      await user.click(screen.getByRole("combobox"));
      const allOption = screen.getByRole("option", { name: "すべての部門" });
      expect(allOption).toBeInTheDocument();
    });
  });

  describe("widthClass", () => {
    it("DF-4: widthClass 省略時は SelectTrigger に w-[10rem] が付く", () => {
      render(<DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} />);

      const trigger = document.getElementById("dept-filter");
      expect(trigger?.className).toContain("w-[10rem]");
    });

    it("DF-5: widthClass='w-[11rem]' を渡すと SelectTrigger に w-[11rem] が付く", () => {
      render(
        <DepartmentFilter
          options={mockOptions}
          selected={null}
          onChange={vi.fn()}
          widthClass="w-[11rem]"
          idPrefix="product-dept-filter"
        />,
      );

      const trigger = document.getElementById("product-dept-filter");
      expect(trigger?.className).toContain("w-[11rem]");
    });
  });

  describe("idPrefix", () => {
    it("DF-6: idPrefix 省略時は SelectTrigger の id が 'dept-filter' になる", () => {
      render(<DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} />);

      const trigger = document.getElementById("dept-filter");
      expect(trigger).toBeInTheDocument();
    });

    it("DF-7: idPrefix='product-dept-filter' を渡すと SelectTrigger の id が 'product-dept-filter' になる", () => {
      render(
        <DepartmentFilter
          options={mockOptions}
          selected={null}
          onChange={vi.fn()}
          idPrefix="product-dept-filter"
        />,
      );

      const trigger = document.getElementById("product-dept-filter");
      expect(trigger).toBeInTheDocument();
    });

    it("DF-8: idPrefix='stock-dept-filter' を渡すと SelectTrigger の id が 'stock-dept-filter' になる", () => {
      render(
        <DepartmentFilter
          options={mockOptions}
          selected={null}
          onChange={vi.fn()}
          idPrefix="stock-dept-filter"
        />,
      );

      const trigger = document.getElementById("stock-dept-filter");
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("disabled", () => {
    it("DF-9: disabled=true で SelectTrigger が disabled になる", () => {
      render(
        <DepartmentFilter
          options={mockOptions}
          selected={null}
          onChange={vi.fn()}
          disabled={true}
        />,
      );

      const trigger = document.getElementById("dept-filter");
      expect(trigger).toBeDisabled();
    });

    it("DF-10: disabled 省略（デフォルト false）で SelectTrigger は disabled でない", () => {
      render(<DepartmentFilter options={mockOptions} selected={null} onChange={vi.fn()} />);

      const trigger = document.getElementById("dept-filter");
      expect(trigger).not.toBeDisabled();
    });
  });

  describe("onChange の変換", () => {
    it("DF-11: 部門選択で onChange が number を渡して呼ばれる（__all__ → null 変換なし）", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<DepartmentFilter options={mockOptions} selected={null} onChange={onChange} />);

      await user.click(screen.getByRole("combobox"));
      await user.click(screen.getByText("毛糸"));

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it("DF-12: 「すべての部門」選択で onChange が null を渡して呼ばれる（__all__ → null 変換）", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<DepartmentFilter options={mockOptions} selected={1} onChange={onChange} />);

      await user.click(screen.getByRole("combobox"));
      const allOption = screen.getByRole("option", { name: "すべての部門" });
      expect(allOption).toBeInTheDocument();
      await user.click(allOption);

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("DF-13: allLabel 上書き時も __all__ → null 変換が動作する", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <DepartmentFilter
          options={mockOptions}
          selected={2}
          onChange={onChange}
          allLabel="すべて"
        />,
      );

      await user.click(screen.getByRole("combobox"));
      const allOption = screen.getByRole("option", { name: "すべて" });
      expect(allOption).toBeInTheDocument();
      await user.click(allOption);

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});
