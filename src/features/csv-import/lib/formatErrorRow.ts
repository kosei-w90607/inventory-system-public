// src/features/csv-import/lib/formatErrorRow.ts
//
// ErrorRow.error_type → Badge variant + 日本語ラベル変換純関数。
// 設計: docs/function-design/55-ui-csv-import.md §55.5 ErrorRowsTable 描画ロジック

/// shadcn/ui Badge の variant 型 (本機能で使う 3 種に限定)。
export type ErrorBadgeVariant = "secondary" | "destructive" | "outline";

export interface ErrorRowDisplay {
  variant: ErrorBadgeVariant;
  label: string;
}

/// BIZ-03 ErrorRow.error_type の 4 値を UI 表示用 Badge variant + 日本語ラベルに変換。
/// 想定外の値は outline + "その他" にフォールバック (BIZ-03 が新規 type を追加した場合の防御)。
/// 設計: 55-ui-csv-import.md §55.5 error_type 表
export function formatErrorRow(errorType: string): ErrorRowDisplay {
  switch (errorType) {
    case "unmatched_product":
      return { variant: "secondary", label: "未登録 JAN" };
    case "invalid_format":
      return { variant: "destructive", label: "フォーマット異常" };
    case "invalid_jan":
      return { variant: "outline", label: "JAN 不正" };
    case "invalid_number":
      return { variant: "outline", label: "数値不正" };
    default:
      return { variant: "outline", label: "その他" };
  }
}
