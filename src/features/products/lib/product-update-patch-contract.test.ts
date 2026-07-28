import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { ProductUpdateRequest_Deserialize } from "@/lib/bindings";
import { buildUpdateProductRequest, type ProductFormBuildResult } from "./product-form-request";

const REPO_ROOT = join(__dirname, "../../../..");
const BINDINGS_SOURCE = readFileSync(join(REPO_ROOT, "src/lib/bindings.ts"), "utf8");
const BUILDER_SOURCE = readFileSync(
  join(REPO_ROOT, "src/features/products/lib/product-form-request.ts"),
  "utf8",
);
const PAGE_SOURCE = readFileSync(
  join(REPO_ROOT, "src/features/products/ProductFormPage.tsx"),
  "utf8",
);

const ORDINARY_FIELDS = [
  "name",
  "department_id",
  "selling_price",
  "cost_price",
  "tax_rate",
  "pos_stock_sync",
  "plu_target",
] as const;
const CLEARABLE_FIELDS = ["supplier_id", "maker_code"] as const;

function typeBlock(typeName: string): string {
  const match = new RegExp(`export type ${typeName} = \\{([\\s\\S]*?)\\n\\};`).exec(
    BINDINGS_SOURCE,
  );
  expect(match, `${typeName} must exist in generated bindings`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("UI-01b PRODUCT-PATCH-D1 generated contract", () => {
  it("generates all nine deserialize properties as optional", () => {
    const block = typeBlock("ProductUpdateRequest_Deserialize");

    for (const field of [...ORDINARY_FIELDS, ...CLEARABLE_FIELDS]) {
      expect(block).toMatch(new RegExp(`\\n\\t${field}\\?:`));
    }
  });

  it("keeps all nine serialize properties required", () => {
    const block = typeBlock("ProductUpdateRequest_Serialize");

    for (const field of [...ORDINARY_FIELDS, ...CLEARABLE_FIELDS]) {
      expect(block).toMatch(new RegExp(`\\n\\t${field}:`));
      expect(block).not.toMatch(new RegExp(`\\n\\t${field}\\?:`));
    }
  });

  it("connects the builder return type directly to the generated command input", () => {
    expectTypeOf(buildUpdateProductRequest).returns.toEqualTypeOf<
      ProductFormBuildResult<ProductUpdateRequest_Deserialize>
    >();
  });

  it("does not bypass the generated contract with Partial or a save cast", () => {
    expect(BUILDER_SOURCE).not.toContain("Partial<ProductUpdateRequest_Deserialize>");
    expect(PAGE_SOURCE).not.toContain("as ProductUpdateRequest_Deserialize");
  });
});
