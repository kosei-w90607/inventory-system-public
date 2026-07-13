// src/features/products/components/StockUnitField.tsx
//
// UI-01b-D6: cm 選択時は POS 在庫同期 off を提案するが、利用者 override を保持する。
// 自動提案は onPosStockSyncSuggest（touched を立てない）、利用者の checkbox 操作は
// onPosStockSyncChange（touched を立てる）を使い、2 つの経路を分離する。

import { Label } from "@/components/ui/label";
import type { ProductStockUnit } from "../lib/product-form-request";

export interface StockUnitFieldProps {
  mode: "create" | "edit";
  stockUnit: ProductStockUnit;
  posStockSync: boolean;
  posSyncTouched: boolean;
  onStockUnitChange: (stockUnit: ProductStockUnit) => void;
  /** 利用者の checkbox 操作（touched を立てる経路） */
  onPosStockSyncChange: (checked: boolean) => void;
  /** 自動提案専用（touched を立てない経路）。未操作時に pcs→cm で false、cm→pcs で true を渡す */
  onPosStockSyncSuggest: (checked: boolean) => void;
  readOnly?: boolean;
}

export function StockUnitField({
  mode,
  stockUnit,
  posStockSync,
  posSyncTouched,
  onStockUnitChange,
  onPosStockSyncChange,
  onPosStockSyncSuggest,
  readOnly = false,
}: StockUnitFieldProps) {
  const handleUnitChange = (next: ProductStockUnit) => {
    onStockUnitChange(next);
    // create mode かつ checkbox 未操作（posSyncTouched=false）のときだけ自動提案する。
    // pcs→cm で false を提案、cm→pcs で既定値 true を復元する。
    // touched を立てる onPosStockSyncChange は呼ばない（利用者 override と区別するため）。
    if (mode === "create" && !posSyncTouched) {
      if (next === "cm") {
        onPosStockSyncSuggest(false);
      } else {
        onPosStockSyncSuggest(true);
      }
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="stock-unit">数量単位</Label>
        <select
          id="stock-unit"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={stockUnit}
          disabled={readOnly}
          onChange={(event) => {
            handleUnitChange(event.target.value === "cm" ? "cm" : "pcs");
          }}
        >
          <option value="pcs">個</option>
          <option value="cm">cm</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="pos-stock-sync">POS販売で在庫を減らす</Label>
        <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
          <input
            id="pos-stock-sync"
            type="checkbox"
            checked={posStockSync}
            onChange={(event) => {
              onPosStockSyncChange(event.target.checked);
            }}
          />
          <span>{posStockSync ? "減らす" : "減らさない"}</span>
        </label>
        {mode === "create" && stockUnit === "cm" ? (
          <p className="text-xs text-muted-foreground">
            cm 商品は在庫同期しない設定を提案します。必要なら変更できます。
          </p>
        ) : null}
      </div>
    </div>
  );
}
