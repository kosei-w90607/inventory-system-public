// src/features/products/components/ProductPagination.tsx
//
// UI-01a-D4: total_count を正にした商品一覧 pagination。

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface ProductPaginationProps {
  page: number;
  perPage: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function ProductPagination({
  page,
  perPage,
  totalCount,
  onPageChange,
}: ProductPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <div>
        {totalCount.toLocaleString("ja-JP")} 件中 {page} / {totalPages} ページ
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPrev}
          aria-label="前のページ"
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          <ChevronLeft aria-hidden="true" />
          前へ
        </Button>
        <span className="min-w-20 text-center font-medium text-foreground">
          {page} / {totalPages} ページ
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canNext}
          aria-label="次のページ"
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          次へ
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
