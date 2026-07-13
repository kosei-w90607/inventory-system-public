// src/features/stock-inquiry/components/TruncatedResultsAlert.tsx
//
// 検索結果が上限（50 件）を超えた場合の絞り込み案内（契約 I）。
// Phase 2 では pagination UI は実装しない。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7 / §58.10

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function TruncatedResultsAlert() {
  return (
    <Alert>
      <AlertTitle>他にも検索結果があります</AlertTitle>
      <AlertDescription>商品コード / 商品名 / JAN で絞り込んでください。</AlertDescription>
    </Alert>
  );
}
