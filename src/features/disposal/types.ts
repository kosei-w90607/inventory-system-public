import type { ProductWithRelations } from "@/lib/bindings";

export type DisposalType = "disposal" | "damage" | "other";

export interface DisposalRow {
  rowId: string;
  productCode: string;
  productName: string;
  departmentName: string;
  stockUnit: string;
  currentStockQuantity: number;
  defaultCostPrice: number;
  disposalType: DisposalType;
  quantity: string;
  costPrice: string;
  reason: string;
}

export type DisposalFormErrors = Partial<{
  disposalDate: string;
  items: string;
  rows: Record<string, string>;
}>;

export interface DisposalFormValues {
  disposalDate: string;
  rows: DisposalRow[];
}

export type ProductCandidate = ProductWithRelations;
