// src/features/monthly-sales/components/SummaryCardsBar.test.tsx
//
// B0 characterization test: monthly SummaryCardsBar の現 DOM 固定（Non-scope 不変証明）。
// loading 時のタイトルごと skeleton 化 / data 時の 4 カード / prevComparison null 時の「比較不可」を assert。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.7 / D-B1 Non-scope

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MonthlySaleItem } from "@/lib/bindings";
import type { MonthlySummary } from "../types";
import { SummaryCardsBar } from "./SummaryCardsBar";

const mockSummary: MonthlySummary = {
  totalAmount: 150000,
  totalQuantity: 63,
};

const mockPrevComparison: MonthlySaleItem[] = [
  { key: "P001", label: "商品A", quantity: 10, amount: 60000, ranking: 1 },
  { key: "P002", label: "商品B", quantity: 5, amount: 40000, ranking: 2 },
];

describe("SummaryCardsBar (monthly, REQ-502) B0 characterization (D-B1 Non-scope)", () => {
  // --- loading 状態 ---

  it("B0-monthly-L1: isLoading=true のとき 4 カードのタイトルがすべて Skeleton 化される（home とは異なりタイトルごと skeleton）", () => {
    const { container } = render(
      <SummaryCardsBar
        summary={mockSummary}
        periodLabel="2026/06"
        prevComparison={mockPrevComparison}
        isLoading={true}
      />,
    );

    // 4 枚カードの CardHeader 内に Skeleton が描画される（タイトルごと skeleton = home と異なる現構造）
    // Skeleton コンポーネントは data-slot="skeleton" 属性を持つ
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);

    // data コンテンツは表示されない
    expect(screen.queryByText("月間売上合計")).not.toBeInTheDocument();
  });

  // --- data 状態 ---

  it("B0-monthly-D1: data 時、4 カードのタイトルが表示される", () => {
    render(
      <SummaryCardsBar
        summary={mockSummary}
        periodLabel="2026/06/01 〜 2026/06/30"
        prevComparison={mockPrevComparison}
        isLoading={false}
      />,
    );

    expect(screen.getByText("月間売上合計")).toBeInTheDocument();
    expect(screen.getByText("月間販売点数")).toBeInTheDocument();
    expect(screen.getByText("期間")).toBeInTheDocument();
    expect(screen.getByText("前月比")).toBeInTheDocument();
  });

  it("B0-monthly-D2: data 時、月間売上合計と月間販売点数が表示される", () => {
    render(
      <SummaryCardsBar
        summary={mockSummary}
        periodLabel="2026/06/01 〜 2026/06/30"
        prevComparison={mockPrevComparison}
        isLoading={false}
      />,
    );

    expect(screen.getByText("¥150,000")).toBeInTheDocument();
    expect(screen.getByText("63 点")).toBeInTheDocument();
  });

  it("B0-monthly-D3: data 時、期間ラベルが表示される", () => {
    render(
      <SummaryCardsBar
        summary={mockSummary}
        periodLabel="2026/06/01 〜 2026/06/30"
        prevComparison={mockPrevComparison}
        isLoading={false}
      />,
    );

    expect(screen.getByText("2026/06/01 〜 2026/06/30")).toBeInTheDocument();
  });

  it("B0-monthly-D4: prevComparison が実データあり のとき前月比が計算されて表示される", () => {
    // 前月合計 = 100000、今月 = 150000 → +¥50,000
    render(
      <SummaryCardsBar
        summary={mockSummary}
        periodLabel="2026/06"
        prevComparison={mockPrevComparison}
        isLoading={false}
      />,
    );

    expect(screen.getByText("+¥50,000")).toBeInTheDocument();
  });

  // --- prevComparison null 時 ---

  it("B0-monthly-N1: prevComparison=null のとき、前月比カードに「比較不可」が表示される", () => {
    render(
      <SummaryCardsBar
        summary={mockSummary}
        periodLabel="2026/06"
        prevComparison={null}
        isLoading={false}
      />,
    );

    expect(screen.getByText("比較不可")).toBeInTheDocument();
    // 他カードは正常
    expect(screen.getByText("¥150,000")).toBeInTheDocument();
  });

  it("B0-monthly-N2: prevComparison=[] のとき（前月売上 0 円）、「比較不可」と「前月売上 0 円」が表示される", () => {
    render(
      <SummaryCardsBar
        summary={mockSummary}
        periodLabel="2026/06"
        prevComparison={[]}
        isLoading={false}
      />,
    );

    expect(screen.getByText("比較不可")).toBeInTheDocument();
    expect(screen.getByText("前月売上 0 円")).toBeInTheDocument();
  });
});
