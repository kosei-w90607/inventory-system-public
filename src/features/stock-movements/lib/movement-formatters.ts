// src/features/stock-movements/lib/movement-formatters.ts
//
// REQ-303 / UI-06c-D4-D5: movement 種別と増減の operator-facing 表示。

const movementTypeLabels: Record<string, string> = {
  receiving: "入庫",
  return: "返品・交換",
  sale_auto: "POS売上",
  sale_manual: "手動販売",
  disposal: "廃棄・破損",
  stocktake: "棚卸し",
};

export function formatMovementType(movementType: string): string {
  return movementTypeLabels[movementType] ?? movementType;
}

export function formatMovementQuantity(quantity: number): { value: string; label: string } {
  if (quantity > 0) {
    return { value: `+${String(quantity)}`, label: "増加" };
  }
  if (quantity < 0) {
    return { value: String(quantity), label: "減少" };
  }
  return { value: "0", label: "変動なし" };
}

export function formatMovementDateTime(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(value);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return value;
}
