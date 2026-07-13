import type { ProductWithRelations } from "@/lib/bindings";

export type ReturnExchangeType = "return" | "exchange";
export type ReturnDirection = "in" | "out";

export interface ReturnExchangeRow {
  productCode: string;
  productName: string;
  departmentName: string;
  stockUnit: string;
  currentStockQuantity: number;
  direction: ReturnDirection;
  quantity: string;
}

export type ReturnExchangeFormErrors = Partial<{
  returnDate: string;
  returnType: string;
  items: string;
  receipt: string;
  rows: Record<string, string>;
}>;

export interface ReturnExchangeFormValues {
  returnDate: string;
  returnType: ReturnExchangeType;
  registerProcessed: boolean;
  note: string;
  rows: ReturnExchangeRow[];
}

export interface ReceiptImageState {
  file: File;
  previewUrl: string;
  extension: string;
  savedReceiptPath: string | null;
}

export type ProductCandidate = ProductWithRelations;
