// src/features/products/components/StockUnitField.test.tsx

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StockUnitField } from "./StockUnitField";

describe("StockUnitField (UI-01b-D6)", () => {
  it("proposes POS sync off for cm but preserves user override", async () => {
    const user = userEvent.setup();
    const onStockUnitChange = vi.fn();
    const onPosStockSyncChange = vi.fn();

    const { rerender } = render(
      <StockUnitField
        mode="create"
        stockUnit="pcs"
        posStockSync
        posSyncTouched={false}
        onStockUnitChange={onStockUnitChange}
        onPosStockSyncChange={onPosStockSyncChange}
        onPosStockSyncSuggest={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("数量単位"), "cm");

    expect(onStockUnitChange).toHaveBeenCalledWith("cm");
    // checkbox onChange (touched 経路) は呼ばれない — suggest 経路を使う
    expect(onPosStockSyncChange).not.toHaveBeenCalled();

    rerender(
      <StockUnitField
        mode="create"
        stockUnit="pcs"
        posStockSync
        posSyncTouched
        onStockUnitChange={onStockUnitChange}
        onPosStockSyncChange={onPosStockSyncChange}
        onPosStockSyncSuggest={vi.fn()}
      />,
    );
    onPosStockSyncChange.mockClear();

    await user.selectOptions(screen.getByLabelText("数量単位"), "cm");

    expect(onPosStockSyncChange).not.toHaveBeenCalled();
  });

  // REQ-101 / UI-01b-D6: pcs→cm 自動提案が suggest 経路（touched を立てない）で発火する
  it("suggest: pcs→cm calls onPosStockSyncSuggest(false) without touching posSyncTouched", async () => {
    const user = userEvent.setup();
    const onPosStockSyncSuggest = vi.fn();
    const onPosStockSyncChange = vi.fn();

    render(
      <StockUnitField
        mode="create"
        stockUnit="pcs"
        posStockSync
        posSyncTouched={false}
        onStockUnitChange={vi.fn()}
        onPosStockSyncChange={onPosStockSyncChange}
        onPosStockSyncSuggest={onPosStockSyncSuggest}
      />,
    );

    await user.selectOptions(screen.getByLabelText("数量単位"), "cm");

    // suggest 経路が false を提案する（= touched を立てない）
    expect(onPosStockSyncSuggest).toHaveBeenCalledWith(false);
    // touched を立てる onChange 経路は呼ばれない
    expect(onPosStockSyncChange).not.toHaveBeenCalled();
  });

  // REQ-101 / UI-01b-D6: pcs→cm→pcs（checkbox 未操作）で suggest が true を復元する
  it("suggest: pcs→cm→pcs without checkbox restores posStockSync to true via suggest", async () => {
    const user = userEvent.setup();
    const onPosStockSyncSuggest = vi.fn();
    const onPosStockSyncChange = vi.fn();

    const { rerender } = render(
      <StockUnitField
        mode="create"
        stockUnit="pcs"
        posStockSync
        posSyncTouched={false}
        onStockUnitChange={vi.fn()}
        onPosStockSyncChange={onPosStockSyncChange}
        onPosStockSyncSuggest={onPosStockSyncSuggest}
      />,
    );

    // pcs→cm: suggest(false) が呼ばれる
    await user.selectOptions(screen.getByLabelText("数量単位"), "cm");
    expect(onPosStockSyncSuggest).toHaveBeenLastCalledWith(false);

    onPosStockSyncSuggest.mockClear();

    // cm→pcs（checkbox 未操作、posSyncTouched=false のまま）: suggest(true) が呼ばれる
    rerender(
      <StockUnitField
        mode="create"
        stockUnit="cm"
        posStockSync={false}
        posSyncTouched={false}
        onStockUnitChange={vi.fn()}
        onPosStockSyncChange={onPosStockSyncChange}
        onPosStockSyncSuggest={onPosStockSyncSuggest}
      />,
    );

    await user.selectOptions(screen.getByLabelText("数量単位"), "個");

    expect(onPosStockSyncSuggest).toHaveBeenCalledWith(true);
    // touched を立てる onChange 経路は呼ばれない
    expect(onPosStockSyncChange).not.toHaveBeenCalled();
  });

  // REQ-101 / UI-01b-D6: checkbox を明示操作（touched=true）後は単位変更でも suggest が発火しない
  it("suggest: after checkbox interaction (touched=true), unit change does not fire suggest", async () => {
    const user = userEvent.setup();
    const onPosStockSyncSuggest = vi.fn();

    render(
      <StockUnitField
        mode="create"
        stockUnit="pcs"
        posStockSync
        posSyncTouched={true}
        onStockUnitChange={vi.fn()}
        onPosStockSyncChange={vi.fn()}
        onPosStockSyncSuggest={onPosStockSyncSuggest}
      />,
    );

    await user.selectOptions(screen.getByLabelText("数量単位"), "cm");

    // touched=true の場合 suggest は発火しない（利用者 override を尊重）
    expect(onPosStockSyncSuggest).not.toHaveBeenCalled();
  });

  // checkbox の onChange は引き続き onPosStockSyncChange（touched 経路）を使う
  it("checkbox onChange still calls onPosStockSyncChange (touched path)", async () => {
    const user = userEvent.setup();
    const onPosStockSyncChange = vi.fn();
    const onPosStockSyncSuggest = vi.fn();

    render(
      <StockUnitField
        mode="create"
        stockUnit="pcs"
        posStockSync
        posSyncTouched={false}
        onStockUnitChange={vi.fn()}
        onPosStockSyncChange={onPosStockSyncChange}
        onPosStockSyncSuggest={onPosStockSyncSuggest}
      />,
    );

    await user.click(screen.getByLabelText("POS販売で在庫を減らす"));

    // checkbox は touched 経路（onPosStockSyncChange）を使う
    expect(onPosStockSyncChange).toHaveBeenCalledWith(false);
    // suggest 経路は呼ばれない
    expect(onPosStockSyncSuggest).not.toHaveBeenCalled();
  });
});
