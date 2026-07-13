import type { ProductWithRelations } from "@/lib/bindings";

export type ManualSaleReason = "plu_unregistered" | "other";

export interface ManualSaleRow {
  productCode: string;
  productName: string;
  departmentName: string;
  stockUnit: string;
  currentStockQuantity: number;
  unitPrice: number;
  quantity: string;
  amount: string;
}

export type ManualSaleFormErrors = Partial<{
  saleDate: string;
  reason: string;
  items: string;
  note: string;
  rows: Record<string, string>;
}>;

export interface ManualSaleFormValues {
  saleDate: string;
  reason: ManualSaleReason;
  note: string;
  rows: ManualSaleRow[];
}

export interface PluConfirmationState {
  token: string;
  warnings: string[];
}

export type ProductCandidate = ProductWithRelations;
