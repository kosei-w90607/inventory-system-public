// src/features/stock-inquiry/StockInquiryPage.tsx
//
// UI-06a 在庫照会画面の最上位 page。Route とは props で分離（UI-09b パターン、
// RTL テスト容易性）。失敗 4 状態の出し分け + 主動線（検索 → 一覧 → 詳細展開）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7

import { useEffect } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { StockDetailCard } from "./components/StockDetailCard";
import { ProductPagination } from "@/features/products/components/ProductPagination";

export interface StockInquiryPageProps {
  search: StockInquirySearch;
  onSearchChange: (updater: (prev: StockInquirySearch) => StockInquirySearch) => void;
}

export function StockInquiryPage({ search, onSearchChange }: StockInquiryPageProps) {
  const qValue = search.q ?? "";
  const deptValue = search.dept ?? null;
  const statusValue: ListChipFilter = search.status ?? "all";
  const pageValue = search.page ?? 1;
  const selectedValue = search.selected ?? null;

  const { listQuery, detailQuery, departmentOptionsQuery, departmentOptions, isAllEmpty } =
    useStockInquiry({
      status: statusValue,
      q: qValue,
      dept: deptValue,
      page: pageValue,
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

  // 絞り込み（q / dept / status）が既定値以外か。page / sort 等は対象外（catalog ⑥ filter-empty reset、SPEC-UIBB-1/2）。
  const isFilterDefault = qValue === "" && deptValue === null && statusValue === "all";
  const resetFilters = () => {
    onSearchChange((prev) => ({
      ...prev,
      q: undefined,
      dept: undefined,
      status: undefined,
      page: undefined,
      selected: undefined,
    }));
  };

  const data = listQuery.data;
  // 範囲外 page（UI-06a-D3、74 §74.10 UI-11c-D8 と同型）。通常 EmptyState / reset action より優先判定（SPEC-UIBB-8）。
  const isOutOfRangePage =
    data?.items.length === 0 && data.totalCount !== null && data.totalCount > 0 && pageValue > 1;

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
              page: undefined,
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
              page: undefined,
              selected: undefined,
            }));
          }}
          allLabel="すべての部門"
          widthClass="w-[10rem]"
          idPrefix="stock-dept-filter"
          disabled={departmentOptionsQuery.isLoading}
        />
      </div>

      {/* 候補取得失敗は listQuery とは独立に別途文言表示（catalog ⑨、round 2 P1-1） */}
      {departmentOptionsQuery.isError && (
        <p className="text-sm text-destructive" role="alert">
          部門候補の取得に失敗しました
        </p>
      )}

      <StatusChips
        value={statusValue}
        onChange={(s) => {
          // status 切替時は page / selected を clear（q / dept 変更時と同型、新 list 1 件で自動展開が再発火可能）
          onSearchChange((prev) => ({ ...prev, status: s, page: undefined, selected: undefined }));
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
      ) : isOutOfRangePage ? (
        <EmptyState
          title="このページには表示する商品がありません"
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onSearchChange((prev) => ({ ...prev, page: undefined }));
              }}
            >
              先頭ページに戻る
            </Button>
          }
        />
      ) : data?.items.length === 0 ? (
        <EmptyState
          title="該当する商品がありません"
          description="商品コード・商品名・JANコードを変えてもう一度検索してください"
          // 絞り込みが既定値以外のときだけ reset action を出す（catalog ⑥ filter-empty reset action、SPEC-UIBB-1/2）。
          action={
            !isFilterDefault ? (
              <Button type="button" variant="outline" onClick={resetFilters}>
                絞り込みを解除
              </Button>
            ) : undefined
          }
        />
      ) : data ? (
        <div className="space-y-2">
          <ProductListTable
            items={data.items}
            source={data.source}
            selected={selectedValue}
            detailQuery={detailQuery}
            onSelect={(code) => {
              onSearchChange((prev) => ({ ...prev, selected: code }));
            }}
          />
          {/* status === "all" のときだけ表示（UI-06a-D1、02-component-catalog.md ⑩ canonical を結線） */}
          {statusValue === "all" && data.totalCount !== null && (
            <ProductPagination
              page={pageValue}
              perPage={50}
              totalCount={data.totalCount}
              onPageChange={(next) => {
                onSearchChange((prev) => ({ ...prev, page: next }));
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
