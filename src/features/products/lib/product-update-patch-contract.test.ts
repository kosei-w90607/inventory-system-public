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
const PRODUCT_FORM_DESIGN_SOURCE = readFileSync(
  join(REPO_ROOT, "docs/function-design/51-ui-product-form.md"),
  "utf8",
);
const SCREEN_DESIGN_SOURCE = readFileSync(join(REPO_ROOT, "docs/SCREEN_DESIGN.md"), "utf8");

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
const GENERATED_PRODUCT_COMMANDS = [
  "createProduct",
  "updateProduct",
  "toggleDiscontinue",
  "listSuppliers",
] as const;
const STALE_COMMAND_STATUS = /generated 未対応|実装 PR[^\n]*(?:追加|binding)/;

function typeBlock(typeName: string): string {
  const match = new RegExp(`export type ${typeName} = \\{([\\s\\S]*?)\\n\\};`).exec(
    BINDINGS_SOURCE,
  );
  expect(match, `${typeName} must exist in generated bindings`).not.toBeNull();
  return match?.[1] ?? "";
}

function markdownSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  expect(startIndex, `${start} section must exist`).toBeGreaterThanOrEqual(0);

  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(endIndex, `${end} boundary must exist after ${start}`).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

function expectGeneratedCommandStatusCurrent(source: string): void {
  expect(
    source,
    "command status section must not use stale future or unavailable wording",
  ).not.toMatch(STALE_COMMAND_STATUS);

  for (const command of GENERATED_PRODUCT_COMMANDS) {
    expect(BINDINGS_SOURCE, `${command} must exist in generated bindings`).toMatch(
      new RegExp(`\\n\\t${command}:`),
    );

    const commandLines = source.split("\n").filter((line) => line.includes(`commands.${command}`));

    expect(commandLines, `${command} status must be documented`).not.toHaveLength(0);
    expect(
      commandLines.some((line) => /生成済み|generated 済み/.test(line)),
      `${command} must be documented as generated`,
    ).toBe(true);
    for (const line of commandLines) {
      expect(line, `${command} must not use stale future or unavailable wording`).not.toMatch(
        STALE_COMMAND_STATUS,
      );
    }
  }
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

  it("keeps the four UI-01b commands documented as generated", () => {
    expectGeneratedCommandStatusCurrent(
      markdownSection(PRODUCT_FORM_DESIGN_SOURCE, "## 7.1", "## 7.5"),
    );
    expectGeneratedCommandStatusCurrent(
      markdownSection(SCREEN_DESIGN_SOURCE, "### 商品登録・修正画面", "### 商品一括インポート画面"),
    );
  });
});
