// src/features/stock-inquiry/hooks/useStockInquiry.ts
//
// UI-06a 在庫照会の 3 useQuery 部分障害許容 hook。
// list query（search_products | list_low_stock）+ detail query（get_stock_detail）+
// departmentOptions query（listDepartments、page/q/dept/status 非依存）を独立束ね、
// StockInquiryListResult に正規化（PaginatedResult vs 配列の形状不一致吸収）。
// 結果 1 件で詳細カード自動展開（Q-3 補強）。
//
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.5

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import type { Department, StockDetail } from "@/lib/bindings";
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
  /** 1 始まり。status !== "all" では無視（既存 client filter 経路は非対象）。 */
  page: number;
  selected: string | null;
  /** URL search params の部分更新（page 側で navigate をラップして渡す）。 */
  navigate: (search: Partial<StockInquirySearch>) => void;
}

export interface UseStockInquiryResult {
  listQuery: UseQueryResult<StockInquiryListResult>;
  detailQuery: UseQueryResult<StockDetail>;
  /** 部門候補 query（page/q/dept/status 非依存、UI-06a-D2）。 */
  departmentOptionsQuery: UseQueryResult<Department[]>;
  /** `Department[] → DepartmentOption[]` 変換済みの部門候補。 */
  departmentOptions: DepartmentOption[];
  /** status="all" かつ q 空文字（search_products を呼ばない、契約 I）。 */
  isAllEmpty: boolean;
}

export function useStockInquiry(args: UseStockInquiryArgs): UseStockInquiryResult {
  const isAllEmpty = args.status === "all" && args.q.trim() === "";

  const listQuery = useQuery({
    queryKey: queryKeys.stockInquiry.list(args.status, args.q, args.dept, args.page),
    queryFn: async (): Promise<StockInquiryListResult> => {
      if (args.status === "all") {
        const data = await unwrapResult(
          commands.searchProducts({
            keyword: args.q.trim() === "" ? null : args.q.trim(),
            department_id: args.dept,
            is_discontinued: false,
            sort_key: "ProductCode",
            sort_order: "Asc",
            page: args.page,
            per_page: 50,
          }),
          { source: "commands", cmd: "search_products" },
        );
        return {
          items: data.items,
          totalCount: data.total_count,
          source: "search",
        };
      }
      const rows = await unwrapResult(commands.listLowStock(false), {
        source: "commands",
        cmd: "list_low_stock",
      });
      const filtered = filterLowStockList(rows, args.q, args.dept, args.status);
      return { items: filtered, totalCount: null, source: "low_stock" };
    },
    enabled: !isAllEmpty,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  // UI-06a-D2（DSR-10 準拠、round 1 P1-3 / round 2 P1-1 対応）: 部門候補は listDepartments() の
  // master 全件から作る単一 query。page / q / dept / status のいずれにも依存しない
  // （queryKeys.stockInquiry.departmentOptions() は無引数・一定 key）。
  const departmentOptionsQuery = useQuery({
    queryKey: queryKeys.stockInquiry.departmentOptions(),
    queryFn: () =>
      unwrapResult(commands.listDepartments(), {
        source: "commands",
        cmd: "list_departments",
      }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
  // Department[] → DepartmentOption[] の変換は hook 側の責務（画面側は options={departmentOptions}
  // をそのまま渡すだけにする、useProductList.ts の departmentOptions 派生と同型）。
  const departmentOptions: DepartmentOption[] = (departmentOptionsQuery.data ?? [])
    .map((department) => ({ id: department.id, name: department.name }))
    .sort((a, b) => a.id - b.id);

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

  return { listQuery, detailQuery, departmentOptionsQuery, departmentOptions, isAllEmpty };
}
