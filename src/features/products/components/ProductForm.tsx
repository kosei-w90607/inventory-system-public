// src/features/products/components/ProductForm.tsx
//
// UI-01b-D4〜D8: 商品登録・修正 form。
// UI-01b-D10: 識別 / 分類と取引先 / 価格 / 在庫 の 4 セクションに分割する。
// UI-01b-D11: read-only 入力は readOnly + bg-muted で示す（数量単位 select は disabled 維持）。
// UI-01b-D12: 必須項目ラベルに（必須）を付ける（色符号化しない）。
// UI-01b-D13: 「廃番にする」は確認ダイアログを通す（「表示に戻す」は直接実行）。

import React, { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSection } from "@/components/patterns/FormSection";
import type { Department, Supplier } from "@/lib/bindings";
import type { ProductFormValues, ProductTaxRate } from "../lib/product-form-request";
import { DiscontinueConfirmDialog } from "./DiscontinueConfirmDialog";
import { StockUnitField } from "./StockUnitField";

export interface ProductFormProps {
  mode: "create" | "edit";
  values: ProductFormValues;
  departments: Department[];
  suppliers: Supplier[];
  errors: Partial<Record<keyof ProductFormValues, string>>;
  saveError: string | null;
  supplierWarning: string | null;
  productCodeLabel?: string;
  productName?: string;
  isDiscontinued?: boolean;
  isSaving: boolean;
  isTogglePending?: boolean;
  saveDisabled?: boolean;
  posSyncTouched: boolean;
  pluTargetTouched?: boolean;
  showPluTargetEnableNote?: boolean;
  onValuesChange: React.Dispatch<React.SetStateAction<ProductFormValues>>;
  onPosSyncTouchedChange: (touched: boolean) => void;
  onPluTargetTouchedChange?: (touched: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onToggleDiscontinue?: () => void;
}

function FieldError({ message }: { message: string | undefined }) {
  return message === undefined ? null : (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function ProductForm({
  mode,
  values,
  departments,
  suppliers,
  errors,
  saveError,
  supplierWarning,
  productCodeLabel,
  productName,
  isDiscontinued = false,
  isSaving,
  isTogglePending = false,
  saveDisabled = false,
  posSyncTouched,
  pluTargetTouched = false,
  showPluTargetEnableNote = false,
  onValuesChange,
  onPosSyncTouchedChange,
  onPluTargetTouchedChange,
  onSubmit,
  onCancel,
  onToggleDiscontinue,
}: ProductFormProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const update = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    onValuesChange((prev) => ({ ...prev, [key]: value }));
  };

  const suggestPluTarget = (janCode: string) => /^\d{13}$/.test(janCode.trim());

  const handleToggleClick = () => {
    if (isDiscontinued) {
      // 表示に戻すは直接実行（UI-01b-D13）
      onToggleDiscontinue?.();
    } else {
      setConfirmOpen(true);
    }
  };

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {saveError !== null ? (
        <Alert variant="destructive">
          <AlertTitle>保存できませんでした</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}
      {supplierWarning !== null ? (
        <Alert>
          <AlertTitle>取引先候補を取得できませんでした</AlertTitle>
          <AlertDescription>{supplierWarning}</AlertDescription>
        </Alert>
      ) : null}

      {mode === "edit" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isDiscontinued ? "secondary" : "outline"}>
            {isDiscontinued ? "廃番" : "表示中"}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isTogglePending}
            onClick={handleToggleClick}
          >
            {isDiscontinued ? "表示に戻す" : "廃番にする"}
          </Button>
        </div>
      ) : null}

      <FormSection title="商品の識別" description="商品コードとJANコードは登録後に変更できません。">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="product-code">商品コード</Label>
            <Input
              id="product-code"
              className="bg-muted"
              value={mode === "create" ? "保存時に自動決定" : (productCodeLabel ?? "")}
              readOnly
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="jan-code">JANコード</Label>
            <Input
              id="jan-code"
              className={mode === "edit" ? "bg-muted" : undefined}
              value={values.janCode}
              readOnly={mode === "edit"}
              onChange={(event) => {
                const nextJanCode = event.target.value;
                onValuesChange((prev) => ({
                  ...prev,
                  janCode: nextJanCode,
                  pluTarget:
                    mode === "create" && !pluTargetTouched
                      ? suggestPluTarget(nextJanCode)
                      : prev.pluTarget,
                }));
              }}
            />
            <FieldError message={errors.janCode} />
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-input p-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="plu-target"
              checked={values.pluTarget}
              onCheckedChange={(checked) => {
                onPluTargetTouchedChange?.(true);
                update("pluTarget", checked === true);
              }}
            />
            <div className="grid gap-1 leading-none">
              <Label htmlFor="plu-target">レジにバーコード登録する</Label>
              <p className="text-sm text-muted-foreground">
                スキャニングPLUに書き出す商品だけオンにします。
              </p>
            </div>
          </div>
          {showPluTargetEnableNote ? (
            <p className="text-sm text-warning-strong">
              オンにして保存すると、この商品はPLU未反映として差分書出しに表示されます。
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="product-name">商品名（必須）</Label>
            <Input
              id="product-name"
              value={values.name}
              onChange={(event) => {
                update("name", event.target.value);
              }}
            />
            <FieldError message={errors.name} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="maker-code">メーカー品番</Label>
            <Input
              id="maker-code"
              value={values.makerCode}
              onChange={(event) => {
                update("makerCode", event.target.value);
              }}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="分類と取引先"
        description="部門は必須です。取引先は任意で、後から変更できます。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="department-id">部門（必須）</Label>
            <select
              id="department-id"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={values.departmentId ?? ""}
              onChange={(event) => {
                update(
                  "departmentId",
                  event.target.value === "" ? null : Number(event.target.value),
                );
              }}
            >
              <option value="">選択してください</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                  {department.code_prefix !== null ? "（独自コード可）" : ""}
                </option>
              ))}
            </select>
            <FieldError message={errors.departmentId} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="supplier-id">取引先</Label>
            <select
              id="supplier-id"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={values.supplierId ?? ""}
              disabled={supplierWarning !== null}
              onChange={(event) => {
                update("supplierId", event.target.value === "" ? null : Number(event.target.value));
              }}
            >
              <option value="">取引先なし</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="価格" description="売価と原価は税抜の整数で入力します。">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="selling-price">売価（必須）</Label>
            <Input
              id="selling-price"
              inputMode="numeric"
              value={values.sellingPrice}
              onChange={(event) => {
                update("sellingPrice", event.target.value);
              }}
            />
            <FieldError message={errors.sellingPrice} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cost-price">原価（必須）</Label>
            <Input
              id="cost-price"
              inputMode="numeric"
              value={values.costPrice}
              onChange={(event) => {
                update("costPrice", event.target.value);
              }}
            />
            <FieldError message={errors.costPrice} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tax-rate">税率</Label>
            <select
              id="tax-rate"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={values.taxRate}
              onChange={(event) => {
                update("taxRate", event.target.value as ProductTaxRate);
              }}
            >
              <option value="10">10%</option>
              <option value="8">8%</option>
              <option value="0">0%</option>
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="在庫"
        description={
          mode === "create"
            ? "初期在庫と数量単位を設定します。登録後は数量単位を変更できません。"
            : "現在庫と数量単位は登録後に変更できません。"
        }
      >
        <div className="space-y-1 md:w-1/2">
          <Label htmlFor="initial-stock">{mode === "create" ? "初期在庫（必須）" : "現在庫"}</Label>
          <Input
            id="initial-stock"
            className={mode === "edit" ? "bg-muted" : undefined}
            inputMode="numeric"
            value={values.initialStock}
            readOnly={mode === "edit"}
            onChange={(event) => {
              update("initialStock", event.target.value);
            }}
          />
          <FieldError message={errors.initialStock} />
        </div>

        <StockUnitField
          mode={mode}
          stockUnit={values.stockUnit}
          posStockSync={values.posStockSync}
          posSyncTouched={posSyncTouched}
          readOnly={mode === "edit"}
          onStockUnitChange={(stockUnit) => {
            update("stockUnit", stockUnit);
          }}
          onPosStockSyncChange={(checked) => {
            onPosSyncTouchedChange(true);
            update("posStockSync", checked);
          }}
          onPosStockSyncSuggest={(checked) => {
            // 自動提案経路: touched は立てず値だけ更新する（UI-01b-D6）
            update("posStockSync", checked);
          }}
        />
      </FormSection>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          <ArrowLeft aria-hidden="true" />
          一覧へ戻る
        </Button>
        <Button type="submit" disabled={isSaving || saveDisabled}>
          <Save aria-hidden="true" />
          {mode === "create" ? "登録する" : "保存する"}
        </Button>
      </div>

      <DiscontinueConfirmDialog
        open={confirmOpen}
        productName={productName ?? values.name}
        onConfirm={() => {
          setConfirmOpen(false);
          onToggleDiscontinue?.();
        }}
        onCancel={() => {
          setConfirmOpen(false);
        }}
      />
    </form>
  );
}
