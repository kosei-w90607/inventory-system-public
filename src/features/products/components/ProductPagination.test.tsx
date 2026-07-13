// src/features/products/components/ProductPagination.test.tsx
//
// UI-01a-D4: total_count/page/per_page に基づく pagination。

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductPagination } from "./ProductPagination";

describe("ProductPagination (UI-01a-D4)", () => {
  it("disables previous on first page and computes total pages", () => {
    render(<ProductPagination page={1} perPage={50} totalCount={101} onPageChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByText("1 / 3 ページ")).toBeInTheDocument();
  });

  it("emits next page while preserving filters in caller", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductPagination page={2} perPage={50} totalCount={151} onPageChange={onPageChange} />,
    );

    await user.click(screen.getByRole("button", { name: "次のページ" }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
