// src/features/stock-inquiry/hooks/useStockInquiry.ts
//
// UI-06a 在庫照会の 2 useQuery 部分障害許容 hook。
// list query（search_products | list_low_stock）+ detail query（get_stock_detail）を
// 独立束ね、StockInquiryListResult に正規化（PaginatedResult vs 配列の形状不一致吸収）。
// 結果 1 件で詳細カード自動展開（Q-3 補強）。
//
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.5

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import type { ProductWithRelations, StockDetail } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import type {
  DepartmentOption,
  ListChipFilter,
  StockInquiryListResult,
  StockInquirySearch,
} from "../types";
import { filterLowStockList } from "../lib/filter-low-stock-list";

export interface UseStockInquiryArgs {
  status: ListChipFilter;
  q: string;
  dept: number | null;
  selected: string | null;
  /** URL search params の部分更新（page 側で navigate をラップして渡す）。 */
  navigate: (search: Partial<StockInquirySearch>) => void;
}

export interface UseStockInquiryResult {
  listQuery: UseQueryResult<StockInquiryListResult>;
  detailQuery: UseQueryResult<StockDetail>;
  /** status="all" かつ q 空文字（search_products を呼ばない、契約 I）。 */
  isAllEmpty: boolean;
  /**
   * 部門フィルタの選択肢。dept 未選択時は現 list から派生し、dept 選択時は
   * 同じ q/status で dept だけ外した候補用 query から派生する。
   * 個別部門を選んだ後も他部門へ直接切り替えられることを保つ。
   */
  departmentOptions: DepartmentOption[];
}

function deriveDepartmentOptions(items: ProductWithRelations[]): DepartmentOption[] {
  const optionMap = new Map<number, string>();
  for (const item of items) {
    if (!optionMap.has(item.department_id)) {
      optionMap.set(item.department_id, item.department_name);
    }
  }
  return Array.from(optionMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.id - b.id);
}

export function useStockInquiry(args: UseStockInquiryArgs): UseStockInquiryResult {
  const isAllEmpty = args.status === "all" && args.q.trim() === "";

  const listQuery = useQuery({
    queryKey: queryKeys.stockInquiry.list(args.status, args.q, args.dept),
    queryFn: async (): Promise<StockInquiryListResult> => {
      if (args.status === "all") {
        const data = await unwrapResult(
          commands.searchProducts({
            keyword: args.q.trim() === "" ? null : args.q.trim(),
            department_id: args.dept,
            is_discontinued: false,
            sort_key: "ProductCode",
            sort_order: "Asc",
            page: 1,
            per_page: 50,
          }),
          { source: "commands", cmd: "search_products" },
        );
        return {
          items: data.items,
          totalCount: data.total_count,
          source: "search",
          truncated: data.total_count > data.items.length,
        };
      }
      const rows = await unwrapResult(commands.listLowStock(false), {
        source: "commands",
        cmd: "list_low_stock",
      });
      const filtered = filterLowStockList(rows, args.q, args.dept, args.status);
      return { items: filtered, totalCount: null, source: "low_stock", truncated: false };
    },
    enabled: !isAllEmpty,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const departmentOptionsQuery = useQuery({
    queryKey: queryKeys.stockInquiry.departmentOptions(args.status, args.q),
    queryFn: async (): Promise<ProductWithRelations[]> => {
      if (args.status === "all") {
        const data = await unwrapResult(
          commands.searchProducts({
            keyword: args.q.trim() === "" ? null : args.q.trim(),
            department_id: null,
            is_discontinued: false,
            sort_key: "ProductCode",
            sort_order: "Asc",
            page: 1,
            per_page: 50,
          }),
          { source: "commands", cmd: "search_products" },
        );
        return data.items;
      }
      const rows = await unwrapResult(commands.listLowStock(false), {
        source: "commands",
        cmd: "list_low_stock",
      });
      return filterLowStockList(rows, args.q, null, args.status);
    },
    enabled: !isAllEmpty && args.dept !== null,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.stockInquiry.detail(args.selected ?? ""),
    queryFn: () =>
      // enabled ガードで selected は非 null・非空が保証されるため ?? "" は実行されない（型安全な fallback）
      unwrapResult(commands.getStockDetail(args.selected ?? ""), {
        source: "commands",
        cmd: "get_stock_detail",
      }),
    // !isAllEmpty: 検索前（status=all + q 空）は list を出さないため detail も走らせない
    // （isAllEmpty + selected URL での detail 空振り防止、Codex 実装レビュー Round 1 P2-2）
    enabled: !isAllEmpty && args.selected !== null && args.selected.length > 0,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  // 結果 1 件で詳細カードを自動展開（Q-3 補強）。
  // selected == null ガードで 1 度のみ発火。status 切替時は page 側で selected を clear するため
  // 新 list 結果 1 件で再発火可能。
  const listItems = listQuery.data?.items;
  useEffect(() => {
    if (listItems?.length === 1 && args.selected === null) {
      args.navigate({ selected: listItems[0].product_code });
    }
    // args / navigate は安定参照ではないが、依存は listItems と selected の変化に限定する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listItems, args.selected]);

  // selected を「現 list 条件に対する状態」に保つための clear（§58.4）。2 ケース:
  // (a) 検索前（isAllEmpty）に selected が残る（手打ち/F5/bookmark URL）→ list は EmptySearchPlaceholder
  //     なのに detail が空振りするため clear（Codex 実装レビュー Round 1 P2-2、detail enabled の
  //     !isAllEmpty guard と二重防御）。
  // (b) list 成功時に selected が現 list に不在（stale URL、CSV 取込み invalidation 後の該当外化）→ 行
  //     インライン展開（§58.8）の描画先消失を防ぐ（C-P2-1）。isSuccess ガードで loading 中の誤判定を
  //     避ける。list 1 件なら clear 後に上の自動展開が後続発火し、現 list の唯一商品へ収束する。
  useEffect(() => {
    if (isAllEmpty && args.selected !== null) {
      args.navigate({ selected: undefined });
      return;
    }
    if (
      listQuery.isSuccess &&
      args.selected !== null &&
      !(listItems ?? []).some((item) => item.product_code === args.selected)
    ) {
      args.navigate({ selected: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllEmpty, listQuery.isSuccess, listItems, args.selected]);

  const departmentOptionItems =
    args.dept === null
      ? (listQuery.data?.items ?? [])
      : [...(departmentOptionsQuery.data ?? []), ...(listQuery.data?.items ?? [])];
  const departmentOptions = deriveDepartmentOptions(departmentOptionItems);

  return { listQuery, detailQuery, isAllEmpty, departmentOptions };
}
