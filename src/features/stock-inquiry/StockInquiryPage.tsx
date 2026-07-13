// src/features/stock-inquiry/StockInquiryPage.tsx
//
// UI-06a 在庫照会画面の最上位 page。Route とは props で分離（UI-09b パターン、
// RTL テスト容易性）。失敗 4 状態の出し分け + 主動線（検索 → 一覧 → 詳細展開）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7

import { useEffect } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import type { ListChipFilter, StockInquirySearch } from "./types";
import { useStockInquiry } from "./hooks/useStockInquiry";
import { SearchBar } from "@/components/patterns/SearchBar";
import { StatusChips } from "./components/StatusChips";
import { DepartmentFilter } from "@/components/patterns/DepartmentFilter";
import { ProductListTable } from "./components/ProductListTable";
import { EmptySearchPlaceholder } from "./components/EmptySearchPlaceholder";
import { TruncatedResultsAlert } from "./components/TruncatedResultsAlert";
import { StockDetailCard } from "./components/StockDetailCard";

export interface StockInquiryPageProps {
  search: StockInquirySearch;
  onSearchChange: (updater: (prev: StockInquirySearch) => StockInquirySearch) => void;
}

export function StockInquiryPage({ search, onSearchChange }: StockInquiryPageProps) {
  const qValue = search.q ?? "";
  const deptValue = search.dept ?? null;
  const statusValue: ListChipFilter = search.status ?? "all";
  const selectedValue = search.selected ?? null;

  const { listQuery, detailQuery, isAllEmpty, departmentOptions } = useStockInquiry({
    status: statusValue,
    q: qValue,
    dept: deptValue,
    selected: selectedValue,
    navigate: (partial) => {
      onSearchChange((prev) => ({ ...prev, ...partial }));
    },
  });

  // list query 失敗 → toast（id-based dedup）、復旧時 dismiss
  useEffect(() => {
    if (listQuery.isError) {
      toast.error("在庫一覧の取得に失敗しました", { id: "stock-inquiry-list-error" });
    } else if (listQuery.isSuccess) {
      toast.dismiss("stock-inquiry-list-error");
    }
  }, [listQuery.isError, listQuery.isSuccess]);

  // detail query 失敗 → toast（部分障害許容、一覧は維持）
  useEffect(() => {
    if (detailQuery.isError) {
      toast.error("商品詳細の取得に失敗しました", { id: "stock-inquiry-detail-error" });
    } else if (detailQuery.isSuccess) {
      toast.dismiss("stock-inquiry-detail-error");
    }
  }, [detailQuery.isError, detailQuery.isSuccess]);

  return (
    // p-6: 売上レポート（daily/monthly）と全周余白を揃える（RootLayout main は padding を持たず
    // 各ページ root が自前で付ける設計、Codex 実装レビュー Round 1 後の L3 デモ発見）
    <div className="space-y-4 p-6">
      <PageHeader title="在庫照会" />

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={qValue}
          debounceMs={200}
          onSearchChange={(v) => {
            onSearchChange((prev) => ({
              ...prev,
              q: v === "" ? undefined : v,
              selected: undefined,
            }));
          }}
        />
        <DepartmentFilter
          options={departmentOptions}
          selected={deptValue}
          onChange={(d) => {
            onSearchChange((prev) => ({
              ...prev,
              dept: d ?? undefined,
              selected: undefined,
            }));
          }}
          allLabel="すべての部門"
          widthClass="w-[10rem]"
          idPrefix="stock-dept-filter"
        />
      </div>

      <StatusChips
        value={statusValue}
        onChange={(s) => {
          // status 切替時は selected を clear（新 list 1 件で自動展開が再発火可能）
          onSearchChange((prev) => ({ ...prev, status: s, selected: undefined }));
        }}
      />

      {isAllEmpty ? (
        <EmptySearchPlaceholder />
      ) : listQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : listQuery.isError ? (
        <>
          <Alert variant="destructive">
            <AlertTitle>取得に失敗しました</AlertTitle>
            <AlertDescription>
              検索条件を変えるか、しばらくしてからもう一度お試しください。
            </AlertDescription>
          </Alert>
          {/* list 失敗時も selected があれば詳細を独立描画する（部分障害許容、§58.8）。
              行インライン展開は list 成功前提のため、ここはフォールバックカードで担う。 */}
          {selectedValue !== null && <StockDetailCard query={detailQuery} />}
        </>
      ) : listQuery.data?.items.length === 0 ? (
        // 意図的差分③: bare div → EmptyState 標準 UI（catalog ⑥）
        <EmptyState
          title="該当する商品がありません"
          description="商品コード・商品名・JANコードを変えてもう一度検索してください"
        />
      ) : listQuery.data ? (
        <div className="space-y-2">
          {listQuery.data.truncated && <TruncatedResultsAlert />}
          <ProductListTable
            items={listQuery.data.items}
            source={listQuery.data.source}
            selected={selectedValue}
            detailQuery={detailQuery}
            onSelect={(code) => {
              onSearchChange((prev) => ({ ...prev, selected: code }));
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
