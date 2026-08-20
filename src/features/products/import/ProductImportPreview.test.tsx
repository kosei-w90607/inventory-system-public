import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ImportRow } from "@/lib/bindings";
import { ProductImportPreview } from "./ProductImportPreview";

function row(code: string, pluTarget: boolean | null, warnings: string[] = []): ImportRow {
  return {
    line_no: 2,
    product_code: code,
    name: `商品 ${code}`,
    department_id: 1,
    selling_price: 100,
    cost_price: 50,
    tax_rate: "10",
    stock_unit: "pcs",
    initial_stock: null,
    jan_code: null,
    maker_code: null,
    supplier_id: null,
    pos_stock_sync: true,
    plu_target: pluTarget,
    warnings,
  };
}

function tableRowFor(code: string): HTMLElement {
  const tableRow = screen.getByText(code).closest("tr");
  if (tableRow === null) throw new Error(`row not found: ${code}`);
  return tableRow;
}

describe("ProductImportPreview", () => {
  it("REQ-907 B-P1: shows all PLU target preview states and warning with an icon", () => {
    render(
      <ProductImportPreview
        filename="synthetic.csv"
        preview={{
          valid_rows: [
            row("P-TARGET", true),
            row("P-EXCLUDED", false, ["JAN が13桁でないため対象外として取り込みます"]),
            row("P-DEFAULT", null),
          ],
          duplicate_rows: [],
          error_rows: [],
        }}
        overwriteCodes={[]}
        targetCount={3}
        isCommitting={false}
        onToggleOverwrite={vi.fn()}
        onCommit={vi.fn()}
        onReselect={vi.fn()}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "PLU対象" })).toBeInTheDocument();
    expect(within(tableRowFor("P-TARGET")).getByText("対象")).toBeInTheDocument();
    expect(within(tableRowFor("P-EXCLUDED")).getByText("対象外")).toBeInTheDocument();
    expect(
      within(tableRowFor("P-DEFAULT")).getByText("既定（13桁JANなら対象）"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("PLU対象が空欄の場合は、13桁JANの商品を対象とする既定ルールを適用します。"),
    ).toBeInTheDocument();
    const warning = screen.getByText("JAN が13桁でないため対象外として取り込みます");
    expect(warning.parentElement?.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });
});
