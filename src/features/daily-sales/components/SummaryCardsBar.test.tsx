// src/features/daily-sales/components/SummaryCardsBar.test.tsx
//
// B0 characterization test: daily SummaryCardsBar の現 DOM 固定（Non-scope 不変証明）。
// loading 時のタイトルごと skeleton 化 / data 時の 4 カード / yesterdayError 時の部分障害を assert。
// 設計: docs/function-design/56-ui-daily-sales.md §56.7 / D-B1 Non-scope

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DailySalesReport } from "@/lib/bindings";
import type { SalesLineSummary } from "../types";
import { SummaryCardsBar } from "./SummaryCardsBar";

const mockToday: DailySalesReport = {
  date: "2026-06-11",
  items: [],
  department_subtotals: [],
  grand_total: { quantity: 42, amount: 98000 },
  official_daily_report: null,
};

const mockYesterday: DailySalesReport = {
  date: "2026-06-10",
  items: [],
  department_subtotals: [],
  grand_total: { quantity: 30, amount: 80000 },
  official_daily_report: null,
};

const mockSummary: SalesLineSummary = {
  total: 12,
  autoCount: 10,
  manualCount: 2,
};

describe("SummaryCardsBar (daily, REQ-501) B0 characterization (D-B1 Non-scope)", () => {
  // --- loading 状態 ---

  it("B0-daily-L1: isLoading=true のとき 4 カードのタイトルがすべて Skeleton 化される（home とは異なり CardTitle ごと skeleton）", () => {
    const { container } = render(
      <SummaryCardsBar
        today={undefined}
        yesterday={undefined}
        summary={mockSummary}
        isLoading={true}
        yesterdayError={false}
      />,
    );

    // 4 枚カードの CardHeader 内に Skeleton が描画される（タイトルごと skeleton = home と異なる現構造）
    // Skeleton コンポーネントは data-slot="skeleton" 属性を持つ
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);

    // data コンテンツは表示されない
    expect(screen.queryByText("売上合計")).not.toBeInTheDocument();
    expect(screen.queryByText("販売点数")).not.toBeInTheDocument();
  });

  it("B0-daily-L2: isLoading=true または today===undefined のとき、¥ 表記は表示されない", () => {
    render(
      <SummaryCardsBar
        today={undefined}
        yesterday={undefined}
        summary={mockSummary}
        isLoading={false}
        yesterdayError={false}
      />,
    );

    // today === undefined のときも skeleton 表示（isLoading || today===undefined の or 条件）
    expect(screen.queryByText(/¥/)).not.toBeInTheDocument();
  });

  // --- data 状態 ---

  it("B0-daily-D1: data 時、4 カードのタイトルが表示される", () => {
    render(
      <SummaryCardsBar
        today={mockToday}
        yesterday={mockYesterday}
        summary={mockSummary}
        isLoading={false}
        yesterdayError={false}
      />,
    );

    expect(screen.getByText("売上合計")).toBeInTheDocument();
    expect(screen.getByText("販売点数")).toBeInTheDocument();
    expect(screen.getByText("売上明細数")).toBeInTheDocument();
    expect(screen.getByText("前日比")).toBeInTheDocument();
  });

  it("B0-daily-D2: data 時、売上合計と販売点数が表示される", () => {
    render(
      <SummaryCardsBar
        today={mockToday}
        yesterday={mockYesterday}
        summary={mockSummary}
        isLoading={false}
        yesterdayError={false}
      />,
    );

    expect(screen.getByText("¥98,000")).toBeInTheDocument();
    expect(screen.getByText("42 点")).toBeInTheDocument();
  });

  it("B0-daily-D3: data 時、売上明細数に自動/手動の sub 行が表示される", () => {
    render(
      <SummaryCardsBar
        today={mockToday}
        yesterday={mockYesterday}
        summary={mockSummary}
        isLoading={false}
        yesterdayError={false}
      />,
    );

    expect(screen.getByText("12 件")).toBeInTheDocument();
    expect(screen.getByText("自動 10 / 手動 2")).toBeInTheDocument();
  });

  it("B0-daily-D4: data 時、前日比が計算されて表示される（前日 80000 → 今日 98000 = +¥18,000）", () => {
    render(
      <SummaryCardsBar
        today={mockToday}
        yesterday={mockYesterday}
        summary={mockSummary}
        isLoading={false}
        yesterdayError={false}
      />,
    );

    // 前日比は正の差
    expect(screen.getByText("+¥18,000")).toBeInTheDocument();
  });

  // --- yesterdayError 時の部分障害許容 ---

  it("B0-daily-E1: yesterdayError=true のとき、前日比カードに「比較データなし」が表示される（in-card 部分障害許容の現状固定）", () => {
    render(
      <SummaryCardsBar
        today={mockToday}
        yesterday={undefined}
        summary={mockSummary}
        isLoading={false}
        yesterdayError={true}
      />,
    );

    // page-level Alert ではなく in-card に部分障害文言を表示する現構造を固定
    expect(screen.getByText("比較データなし")).toBeInTheDocument();
    // 他のカードは正常表示
    expect(screen.getByText("¥98,000")).toBeInTheDocument();
  });
});
