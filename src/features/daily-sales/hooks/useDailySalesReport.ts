// src/features/daily-sales/hooks/useDailySalesReport.ts
//
// 2 useQuery（当日 + 前日）+ 派生 5 純関数 orchestration + departmentOptions 生成。
// 部分障害許容（前日 fail = 前日比カードのみ inline 表示、当日 fail = 画面全体 Alert）。
// 設計: docs/function-design/56-ui-daily-sales.md §56.3 + §56.5

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import type { DailySalesReport } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import type {
  DepartmentOption,
  GroupedSection,
  SalesLineSummary,
  SortColumn,
  SortDirection,
} from "../types";
import { addDays } from "../lib/date-nav";
import { sortDailyItems } from "../lib/sort-items";
import { groupItemsByDepartment } from "../lib/group-items";
import { filterItemsByDepartment } from "../lib/filter-items";
import { computeSalesLineSummary } from "../lib/compute-summary";

export interface UseDailySalesReportArgs {
  date: string;
  dept: number | null;
  sortBy: SortColumn | null;
  sortDir: SortDirection;
}

export interface UseDailySalesReportResult {
  today: UseQueryResult<DailySalesReport>;
  yesterday: UseQueryResult<DailySalesReport>;
  derived: {
    grouped: GroupedSection[];
    summary: SalesLineSummary;
    departmentOptions: DepartmentOption[];
    yesterdayDate: string;
  };
}

/// 2 useQuery を独立束ねし、派生 5 純関数で grouped / summary / departmentOptions を計算。
/// staleTime は UI-00 と統一の 5min（同 queryKey 異 staleTime anti-pattern 回避）。
/// 前日 useQuery は常時 enabled（UI-00 部分障害許容パターン D-3 と整合）。
export function useDailySalesReport(args: UseDailySalesReportArgs): UseDailySalesReportResult {
  const yesterdayDate = addDays(args.date, -1);

  const today = useQuery({
    queryKey: queryKeys.dailySales(args.date),
    queryFn: () =>
      unwrapResult(commands.getDailySales(args.date), {
        source: "commands",
        cmd: "get_daily_sales",
      }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: true,
  });

  const yesterday = useQuery({
    queryKey: queryKeys.dailySales(yesterdayDate),
    queryFn: () =>
      unwrapResult(commands.getDailySales(yesterdayDate), {
        source: "commands",
        cmd: "get_daily_sales",
      }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: true,
  });

  // 派生計算（today.data ありの場合のみ）
  const items = today.data?.items ?? [];
  const filtered = filterItemsByDepartment(items, args.dept);
  const sorted = sortDailyItems(filtered, args.sortBy, args.sortDir);
  const grouped = groupItemsByDepartment(sorted);
  const summary = computeSalesLineSummary(items);

  // departmentOptions は今日の全 items（フィルタ前）から派生、department_id 昇順
  const optionMap = new Map<number, string>();
  for (const item of items) {
    if (!optionMap.has(item.department_id)) {
      optionMap.set(item.department_id, item.department_name);
    }
  }
  const departmentOptions: DepartmentOption[] = Array.from(optionMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.id - b.id);

  return {
    today,
    yesterday,
    derived: { grouped, summary, departmentOptions, yesterdayDate },
  };
}
