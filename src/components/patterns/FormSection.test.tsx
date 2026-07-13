// src/components/patterns/FormSection.test.tsx

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormSection } from "./FormSection";

describe("FormSection", () => {
  it("renders title, description, separator, and children when description is provided", () => {
    render(
      <FormSection title="商品の識別" description="商品コードとJANコードは登録後に変更できません。">
        <input aria-label="商品コード" />
      </FormSection>,
    );

    expect(screen.getByRole("heading", { name: "商品の識別" })).toBeInTheDocument();
    expect(screen.getByText("商品コードとJANコードは登録後に変更できません。")).toBeInTheDocument();
    expect(screen.getByLabelText("商品コード")).toBeInTheDocument();
  });

  it("does not render <p> when description is omitted", () => {
    render(
      <FormSection title="追加情報">
        <input aria-label="メモ" />
      </FormSection>,
    );

    expect(screen.getByRole("heading", { name: "追加情報" })).toBeInTheDocument();
    // description なし: <p class="text-sm text-muted-foreground"> が描画されないこと
    expect(
      screen.queryByText(
        (_, element) =>
          element?.tagName === "P" && element.className.includes("text-muted-foreground"),
      ),
    ).not.toBeInTheDocument();
  });

  it("renders correctly when description is a mode-dependent ternary string (both non-empty)", () => {
    // ProductForm 4 つ目（在庫）セクション相当: mode 依存の三項式 description
    const createDescription = "初期在庫と数量単位を設定します。登録後は数量単位を変更できません。";
    const editDescription = "現在庫と数量単位は登録後に変更できません。";

    // create 分岐
    const { rerender } = render(
      <FormSection title="在庫" description={createDescription}>
        <input aria-label="初期在庫" />
      </FormSection>,
    );
    expect(screen.getByText(createDescription)).toBeInTheDocument();

    // edit 分岐
    rerender(
      <FormSection title="在庫" description={editDescription}>
        <input aria-label="現在庫" />
      </FormSection>,
    );
    expect(screen.getByText(editDescription)).toBeInTheDocument();
    expect(screen.queryByText(createDescription)).not.toBeInTheDocument();
  });
});
