// src/features/stock-inquiry/components/EmptySearchPlaceholder.tsx
//
// status=all + q 空文字時の検索促し（契約 I）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7 / §58.10

export function EmptySearchPlaceholder() {
  return (
    <div className="rounded-md border p-12 text-center text-sm text-muted-foreground">
      商品コード、商品名、または JAN コードで検索してください
    </div>
  );
}
