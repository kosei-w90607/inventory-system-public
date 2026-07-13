// src/features/products/components/ProductForm.test.tsx

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeMockDepartment, makeMockSupplier } from "../lib/test-fixtures";
import {
  createProductFormDefaults,
  productToFormValues,
  type ProductFormValues,
} from "../lib/product-form-request";
import { makeMockProductWithRelations } from "../lib/test-fixtures";
import { ProductForm } from "./ProductForm";

describe("ProductForm (UI-01b)", () => {
  it("shows edit read-only fields and discontinued state text", () => {
    const product = makeMockProductWithRelations({
      product_code: "P-001",
      jan_code: "4901234567890",
      stock_quantity: 20,
      stock_unit: "cm",
      is_discontinued: true,
    });

    render(
      <ProductForm
        mode="edit"
        values={productToFormValues(product)}
        departments={[makeMockDepartment()]}
        suppliers={[makeMockSupplier()]}
        errors={{}}
        saveError={null}
        supplierWarning={null}
        productCodeLabel={product.product_code}
        isDiscontinued
        isSaving={false}
        posSyncTouched={false}
        onValuesChange={vi.fn()}
        onPosSyncTouchedChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("商品コード")).toHaveValue("P-001");
    // UI-01b-D11: read-only 入力は readOnly 属性で示す（数量単位 select は disabled 維持）
    expect(screen.getByLabelText("JANコード")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("現在庫")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("数量単位")).toBeDisabled();
    expect(screen.getByText("廃番")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "表示に戻す" })).toBeInTheDocument();

    // UI-01b-D10: 4 セクション見出し
    expect(screen.getByRole("heading", { name: "商品の識別" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分類と取引先" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "価格" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "在庫" })).toBeInTheDocument();
  });

  it("discontinue requires confirmation and cancel keeps state", async () => {
    const user = userEvent.setup();
    const onToggleDiscontinue = vi.fn();
    const product = makeMockProductWithRelations({
      product_code: "P-200",
      name: "在庫商品",
      is_discontinued: false,
    });

    render(
      <ProductForm
        mode="edit"
        values={productToFormValues(product)}
        departments={[makeMockDepartment()]}
        suppliers={[makeMockSupplier()]}
        errors={{}}
        saveError={null}
        supplierWarning={null}
        productCodeLabel={product.product_code}
        productName={product.name}
        isDiscontinued={false}
        isSaving={false}
        posSyncTouched={false}
        onValuesChange={vi.fn()}
        onPosSyncTouchedChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onToggleDiscontinue={onToggleDiscontinue}
      />,
    );

    // UI-01b-D13: 「廃番にする」は確認ダイアログを通す
    await user.click(screen.getByRole("button", { name: "廃番にする" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByText(/商品「在庫商品」は商品一覧の通常表示から外れます/),
    ).toBeInTheDocument();

    // キャンセルで toggle は呼ばれない
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onToggleDiscontinue).not.toHaveBeenCalled();
  });

  // REQ-101 / UI-01b-D6: pcs→cm→pcs（checkbox 未操作）で posStockSync が true に復元される
  // 自動提案経路（onPosStockSyncSuggest）は onPosSyncTouchedChange を呼ばない。
  // functional update 化後は updater function が渡されるため、prev を適用して実値を検証する。
  it("create pcs→cm→pcs without checkbox: posStockSync restores to true (no touched set)", async () => {
    const user = userEvent.setup();
    // updater function を prev に適用して最終的な values を得るヘルパー
    function applyUpdater(
      prev: ProductFormValues,
      updater: ProductFormValues | ((p: ProductFormValues) => ProductFormValues),
    ): ProductFormValues {
      return typeof updater === "function" ? updater(prev) : updater;
    }
    let latestValues = createProductFormDefaults;
    const captureUpdater = (updater: React.SetStateAction<ProductFormValues>) => {
      latestValues = applyUpdater(latestValues, updater);
    };

    const { rerender } = render(
      <ProductForm
        mode="create"
        values={createProductFormDefaults}
        departments={[makeMockDepartment()]}
        suppliers={[makeMockSupplier()]}
        errors={{}}
        saveError={null}
        supplierWarning={null}
        isSaving={false}
        posSyncTouched={false}
        onValuesChange={captureUpdater}
        onPosSyncTouchedChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // pcs→cm: update が 2 回発火する（stockUnit の更新 + suggest による posStockSync 更新）。
    // functional update なので各呼び出しは prev を受け取り、順次適用される。
    await user.selectOptions(screen.getByLabelText("数量単位"), "cm");
    // 2 回の updater を順次適用した結果として両フィールドが更新されている
    expect(latestValues.stockUnit).toBe("cm");
    expect(latestValues.posStockSync).toBe(false);

    latestValues = { ...createProductFormDefaults, stockUnit: "cm", posStockSync: false };

    // cm→pcs: suggest で posStockSync=true が復元される（touched は立たない）
    rerender(
      <ProductForm
        mode="create"
        values={{ ...createProductFormDefaults, stockUnit: "cm", posStockSync: false }}
        departments={[makeMockDepartment()]}
        suppliers={[makeMockSupplier()]}
        errors={{}}
        saveError={null}
        supplierWarning={null}
        isSaving={false}
        posSyncTouched={false}
        onValuesChange={captureUpdater}
        onPosSyncTouchedChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("数量単位"), "個");
    expect(latestValues.stockUnit).toBe("pcs");
    expect(latestValues.posStockSync).toBe(true);
  });

  // REQ-101 / UI-01b-D6: 統合テスト — stateful wrapper で actual state を検証する
  // ProductForm + stateful wrapper で「数量単位変更 → state が正しく反映される」ことを確認。
  // mock の呼び出し capture だけでは lost update（同一 tick の連続 setState で後勝ち）を検出できないため、
  // 実際の useState で state を持つ wrapper を使う。
  describe("stateful wrapper (lost-update integration)", () => {
    function StatefulProductForm({
      initialPosSyncTouched = false,
    }: {
      initialPosSyncTouched?: boolean;
    }) {
      const [values, setValues] = React.useState<ProductFormValues>(createProductFormDefaults);
      const [posSyncTouched, setPosSyncTouched] = React.useState(initialPosSyncTouched);

      return (
        <>
          <div data-testid="stock-unit">{values.stockUnit}</div>
          <div data-testid="pos-stock-sync">{String(values.posStockSync)}</div>
          <div data-testid="pos-sync-touched">{String(posSyncTouched)}</div>
          <ProductForm
            mode="create"
            values={values}
            departments={[makeMockDepartment()]}
            suppliers={[makeMockSupplier()]}
            errors={{}}
            saveError={null}
            supplierWarning={null}
            isSaving={false}
            posSyncTouched={posSyncTouched}
            onValuesChange={setValues}
            onPosSyncTouchedChange={setPosSyncTouched}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </>
      );
    }

    // REQ-101 / UI-01b-D6: create mode で pcs→cm に変更すると
    // stockUnit="cm" かつ posStockSync=false に両方更新される（lost update が起きないこと）
    it("pcs→cm: both stockUnit and posStockSync update correctly without lost update", async () => {
      const user = userEvent.setup();
      render(<StatefulProductForm />);

      // 初期状態: pcs / posStockSync=true
      expect(screen.getByTestId("stock-unit")).toHaveTextContent("pcs");
      expect(screen.getByTestId("pos-stock-sync")).toHaveTextContent("true");

      // cm を選択
      await user.selectOptions(screen.getByLabelText("数量単位"), "cm");

      // lost update がないなら: stockUnit="cm" かつ posStockSync=false になる
      expect(screen.getByTestId("stock-unit")).toHaveTextContent("cm");
      expect(screen.getByTestId("pos-stock-sync")).toHaveTextContent("false");
      // touched は立っていない（suggest 経路）
      expect(screen.getByTestId("pos-sync-touched")).toHaveTextContent("false");
    });

    // REQ-101 / UI-01b-D6: pcs→cm→pcs（checkbox 未操作）で posStockSync が true に復元される
    it("pcs→cm→pcs without checkbox: posStockSync restores to true", async () => {
      const user = userEvent.setup();
      render(<StatefulProductForm />);

      await user.selectOptions(screen.getByLabelText("数量単位"), "cm");
      expect(screen.getByTestId("stock-unit")).toHaveTextContent("cm");
      expect(screen.getByTestId("pos-stock-sync")).toHaveTextContent("false");

      await user.selectOptions(screen.getByLabelText("数量単位"), "個");
      expect(screen.getByTestId("stock-unit")).toHaveTextContent("pcs");
      expect(screen.getByTestId("pos-stock-sync")).toHaveTextContent("true");
      expect(screen.getByTestId("pos-sync-touched")).toHaveTextContent("false");
    });

    // REQ-101 / UI-01b-D6: checkbox を明示操作後は単位変更でも利用者の値が保持される
    it("after checkbox interaction (touched=true), unit change preserves user override", async () => {
      const user = userEvent.setup();
      render(<StatefulProductForm />);

      // まず checkbox を操作して touched を立てる（posStockSync を false に変更）
      await user.click(screen.getByLabelText("POS販売で在庫を減らす"));
      expect(screen.getByTestId("pos-sync-touched")).toHaveTextContent("true");
      expect(screen.getByTestId("pos-stock-sync")).toHaveTextContent("false");

      // 単位を cm に変更しても suggest が発火しないので利用者の false が保持される
      await user.selectOptions(screen.getByLabelText("数量単位"), "cm");
      expect(screen.getByTestId("stock-unit")).toHaveTextContent("cm");
      expect(screen.getByTestId("pos-stock-sync")).toHaveTextContent("false");

      // 単位を pcs に戻しても suggest が発火しないので false のまま
      await user.selectOptions(screen.getByLabelText("数量単位"), "個");
      expect(screen.getByTestId("stock-unit")).toHaveTextContent("pcs");
      expect(screen.getByTestId("pos-stock-sync")).toHaveTextContent("false");
    });
  });

  it("restore is direct without confirmation dialog", async () => {
    const user = userEvent.setup();
    const onToggleDiscontinue = vi.fn();
    const product = makeMockProductWithRelations({
      product_code: "P-201",
      name: "廃番商品",
      is_discontinued: true,
    });

    render(
      <ProductForm
        mode="edit"
        values={productToFormValues(product)}
        departments={[makeMockDepartment()]}
        suppliers={[makeMockSupplier()]}
        errors={{}}
        saveError={null}
        supplierWarning={null}
        productCodeLabel={product.product_code}
        productName={product.name}
        isDiscontinued
        isSaving={false}
        posSyncTouched={false}
        onValuesChange={vi.fn()}
        onPosSyncTouchedChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onToggleDiscontinue={onToggleDiscontinue}
      />,
    );

    // UI-01b-D13: 「表示に戻す」は確認なしで直接実行
    await user.click(screen.getByRole("button", { name: "表示に戻す" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onToggleDiscontinue).toHaveBeenCalledTimes(1);
  });

  it("REQ-402 suggests PLU target from 13 digit JAN and preserves manual override", async () => {
    const user = userEvent.setup();
    function StatefulProductForm() {
      const [values, setValues] = React.useState<ProductFormValues>(createProductFormDefaults);
      const [pluTargetTouched, setPluTargetTouched] = React.useState(false);

      return (
        <>
          <div data-testid="plu-target">{String(values.pluTarget)}</div>
          <div data-testid="plu-target-touched">{String(pluTargetTouched)}</div>
          <ProductForm
            mode="create"
            values={values}
            departments={[makeMockDepartment()]}
            suppliers={[makeMockSupplier()]}
            errors={{}}
            saveError={null}
            supplierWarning={null}
            isSaving={false}
            posSyncTouched={false}
            pluTargetTouched={pluTargetTouched}
            onValuesChange={setValues}
            onPosSyncTouchedChange={vi.fn()}
            onPluTargetTouchedChange={setPluTargetTouched}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </>
      );
    }

    render(<StatefulProductForm />);

    await user.type(screen.getByLabelText("JANコード"), "4901234567894");
    expect(screen.getByTestId("plu-target")).toHaveTextContent("true");

    await user.click(screen.getByLabelText("レジにバーコード登録する"));
    expect(screen.getByTestId("plu-target")).toHaveTextContent("false");
    expect(screen.getByTestId("plu-target-touched")).toHaveTextContent("true");

    await user.clear(screen.getByLabelText("JANコード"));
    await user.type(screen.getByLabelText("JANコード"), "4901234567894");
    expect(screen.getByTestId("plu-target")).toHaveTextContent("false");
  });
});
