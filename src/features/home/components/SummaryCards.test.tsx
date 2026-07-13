// src/features/home/components/SummaryCards.test.tsx
//
// B0 characterization test: SummaryCards（home 3 カード）の現 DOM 固定。
// loading / error+retry / data の 3 状態を assert する。
// D-B1: 在庫切れ・在庫少の 2 カードは同一 lowStock query 共有 = 同一 onRetry を使う現状を固定。
// 設計: docs/function-design/53-ui-home.md §53.5 / §53.6

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { UseQueryResult } from "@tanstack/react-query";
import type {
  CsvImport,
  DailySalesReport,
  PaginatedResult,
  ProductResponse,
  ProductWithRelations,
} from "@/lib/bindings";
import type { HomeSummaryState } from "../types";
import { SummaryCards } from "./SummaryCards";

// HomeSummaryState の最低限 mock を組み立てるヘルパー
function makeQueryResult<T>(overrides: Partial<UseQueryResult<T>> = {}): UseQueryResult<T> {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isPending: false,
    isSuccess: false,
    isFetching: false,
    isRefetching: false,
    isLoadingError: false,
    isRefetchError: false,
    isPlaceholderData: false,
    isStale: false,
    isFetched: true,
    isFetchedAfterMount: true,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    error: null,
    errorUpdateCount: 0,
    fetchStatus: "idle",
    refetch: vi.fn(),
    status: "success",
    ...overrides,
  } as unknown as UseQueryResult<T>;
}

function makeBaseSummary(
  salesOverrides: Partial<UseQueryResult<DailySalesReport>> = {},
  lowStockOverrides: Partial<UseQueryResult<ProductWithRelations[]>> = {},
): HomeSummaryState {
  return {
    sales: makeQueryResult<DailySalesReport>(salesOverrides),
    lowStock: makeQueryResult<ProductWithRelations[]>(lowStockOverrides),
    pluDirty: makeQueryResult<ProductResponse[]>(),
    csvImports: makeQueryResult<PaginatedResult<CsvImport>>(),
    derived: {
      yesterdayLabel: "6/11(水)",
      outOfStockCount: 0,
      lowStockCount: 0,
      pluDirtyCount: 0,
      lastImportSettlementDate: null,
      needsImportWarning: false,
    },
  };
}

describe("SummaryCards B0 characterization (D-B1, REQ-301/302)", () => {
  // --- loading 状態 ---

  it("B0-home-L1: loading 時、3 カードのタイトルは常時表示される（タイトル skeleton 化しない）", () => {
    const summary = makeBaseSummary({ isLoading: true }, { isLoading: true });
    render(<SummaryCards summary={summary} />);

    // タイトルが 3 本表示される（loading 中もタイトル常時表示 = home SummaryCard の現構造）
    expect(screen.getByText(/昨日の売上/)).toBeInTheDocument();
    expect(screen.getByText("在庫切れ")).toBeInTheDocument();
    expect(screen.getByText("在庫少")).toBeInTheDocument();
  });

  it("B0-home-L2: loading 時、CardContent には Skeleton が表示される（data コンテンツは表示されない）", () => {
    const summary = makeBaseSummary({ isLoading: true }, { isLoading: true });
    const { container } = render(<SummaryCards summary={summary} />);

    // Skeleton 要素が存在すること（Skeleton コンポーネントは data-slot="skeleton" 属性を持つ）
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
    // data コンテンツの代表値は表示されない
    expect(screen.queryByText(/¥/)).not.toBeInTheDocument();
    expect(screen.queryByText(/件/)).not.toBeInTheDocument();
  });

  // --- error 状態 ---

  it("B0-home-E1: sales error 時、昨日の売上カードに「再試行」ボタンが表示される", async () => {
    const onRetry = vi.fn();
    const summary = makeBaseSummary({
      isError: true,
      error: new Error("fetch error"),
      refetch: onRetry,
    });
    const user = userEvent.setup();
    render(<SummaryCards summary={summary} />);

    const retryButtons = screen.getAllByRole("button", { name: "再試行" });
    // sales カードに 1 本。getAllByRole は HTMLElement[] を返すため [0] は HTMLElement（型安全）
    expect(retryButtons).toHaveLength(1);
    expect(retryButtons[0]).toBeInTheDocument();
    await user.click(retryButtons[0]);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("B0-home-E2: lowStock error 時、在庫切れ・在庫少の 2 カードに「再試行」ボタンが表示される（同一 query 共有の現状固定）", async () => {
    const lowStockRetry = vi.fn();
    const summary = makeBaseSummary(
      {},
      { isError: true, error: new Error("fetch error"), refetch: lowStockRetry },
    );
    const user = userEvent.setup();
    render(<SummaryCards summary={summary} />);

    // 在庫切れ・在庫少の 2 カードに「再試行」が 2 本
    const retryButtons = screen.getAllByRole("button", { name: "再試行" });
    expect(retryButtons).toHaveLength(2);
    // 両方クリックで同一 refetch が呼ばれる（同一 lowStock query 共有の現状）
    // getAllByRole は HTMLElement[] を返すため [0]/[1] は HTMLElement（型安全）
    expect(retryButtons[0]).toBeInTheDocument();
    expect(retryButtons[1]).toBeInTheDocument();
    await user.click(retryButtons[0]);
    await user.click(retryButtons[1]);
    expect(lowStockRetry).toHaveBeenCalledTimes(2);
  });

  it("B0-home-E3: error 状態では Alert が表示される（destructive variant）", () => {
    const summary = makeBaseSummary({
      isError: true,
      error: new Error("fetch error"),
      refetch: vi.fn(),
    });
    const { container } = render(<SummaryCards summary={summary} />);

    // Alert[role=alert] が sales カードの error 表示として存在する
    expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
  });

  // --- data 状態 ---

  it("B0-home-D1: data 時、昨日の売上カードにタイトルと金額が表示される", () => {
    const summary: HomeSummaryState = {
      ...makeBaseSummary(),
      sales: makeQueryResult<DailySalesReport>({
        isSuccess: true,
        data: {
          date: "2026-06-11",
          items: [],
          department_subtotals: [],
          grand_total: { quantity: 5, amount: 12000 },
          official_daily_report: null,
        },
      }),
      derived: {
        yesterdayLabel: "6/11(水)",
        outOfStockCount: 3,
        lowStockCount: 7,
        pluDirtyCount: 0,
        lastImportSettlementDate: null,
        needsImportWarning: false,
      },
    };
    render(<SummaryCards summary={summary} />);

    // タイトルに日付ラベル
    expect(screen.getByText(/昨日の売上.*6\/11/)).toBeInTheDocument();
    // 金額（Intl.NumberFormat は環境によって ¥ / ￥ を使い分けるため正規表現でマッチ）
    expect(screen.getByText(/12[,，]?000/)).toBeInTheDocument();
    // 点数
    expect(screen.getByText("5 点")).toBeInTheDocument();
  });

  it("B0-home-D2: data 時、在庫切れ・在庫少カードに件数が表示される", () => {
    const summary: HomeSummaryState = {
      ...makeBaseSummary(),
      lowStock: makeQueryResult<ProductWithRelations[]>({
        isSuccess: true,
        data: [],
      }),
      derived: {
        yesterdayLabel: "6/11(水)",
        outOfStockCount: 2,
        lowStockCount: 9,
        pluDirtyCount: 0,
        lastImportSettlementDate: null,
        needsImportWarning: false,
      },
    };
    render(<SummaryCards summary={summary} />);

    expect(screen.getByText("2 件")).toBeInTheDocument(); // 在庫切れ
    expect(screen.getByText("9 件")).toBeInTheDocument(); // 在庫少
  });

  it("B0-home-D3: data 時、「再試行」ボタンは表示されない", () => {
    const summary: HomeSummaryState = {
      ...makeBaseSummary(),
      sales: makeQueryResult<DailySalesReport>({
        isSuccess: true,
        data: {
          date: "2026-06-11",
          items: [],
          department_subtotals: [],
          grand_total: { quantity: 0, amount: 0 },
          official_daily_report: null,
        },
      }),
      lowStock: makeQueryResult<ProductWithRelations[]>({ isSuccess: true, data: [] }),
    };
    render(<SummaryCards summary={summary} />);

    expect(screen.queryByRole("button", { name: "再試行" })).not.toBeInTheDocument();
  });
});
