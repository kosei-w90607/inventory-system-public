// src/components/patterns/SummaryCard.test.tsx
//
// SummaryCard props 契約の unit test。
// loading 時タイトル常時表示 + CardContent のみ Skeleton、
// error 時 Alert + 再試行、data 時 children 描画。

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SummaryCard } from "./SummaryCard";

const noop = vi.fn();

describe("SummaryCard", () => {
  describe("(a) loading 状態", () => {
    it("タイトルを常時表示する", () => {
      render(
        <SummaryCard title="昨日の売上" isLoading={true} isError={false} onRetry={noop}>
          <span>¥1,234</span>
        </SummaryCard>,
      );
      expect(screen.getByText("昨日の売上")).toBeInTheDocument();
    });

    it("children を描画しない", () => {
      render(
        <SummaryCard title="昨日の売上" isLoading={true} isError={false} onRetry={noop}>
          <span>¥1,234</span>
        </SummaryCard>,
      );
      expect(screen.queryByText("¥1,234")).toBeNull();
    });

    it("loadingSkeleton が未指定の場合はデフォルト Skeleton を描画する", () => {
      const { container } = render(
        <SummaryCard title="昨日の売上" isLoading={true} isError={false} onRetry={noop}>
          <span>内容</span>
        </SummaryCard>,
      );
      // shadcn/ui Skeleton は data-slot="skeleton" または class="...animate-pulse..." を持つ
      const skeleton = container.querySelector("[class*='animate-pulse']");
      expect(skeleton).toBeTruthy();
    });

    it("loadingSkeleton が指定された場合はそちらを描画する", () => {
      render(
        <SummaryCard
          title="昨日の売上"
          isLoading={true}
          isError={false}
          onRetry={noop}
          loadingSkeleton={<span data-testid="custom-skeleton">カスタム</span>}
        >
          <span>内容</span>
        </SummaryCard>,
      );
      expect(screen.getByTestId("custom-skeleton")).toBeInTheDocument();
    });
  });

  describe("(b) error 状態", () => {
    it("タイトルを常時表示する", () => {
      render(
        <SummaryCard title="在庫切れ" isLoading={false} isError={true} onRetry={noop}>
          <span>5 件</span>
        </SummaryCard>,
      );
      expect(screen.getByText("在庫切れ")).toBeInTheDocument();
    });

    it("Alert を描画する", () => {
      render(
        <SummaryCard title="在庫切れ" isLoading={false} isError={true} onRetry={noop}>
          <span>5 件</span>
        </SummaryCard>,
      );
      expect(screen.getByText("取得失敗")).toBeInTheDocument();
    });

    it("「再試行」ボタンを描画する", () => {
      render(
        <SummaryCard title="在庫切れ" isLoading={false} isError={true} onRetry={noop}>
          <span>5 件</span>
        </SummaryCard>,
      );
      expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
    });

    it("「再試行」ボタンクリックで onRetry を呼ぶ", async () => {
      const onRetry = vi.fn();
      render(
        <SummaryCard title="在庫切れ" isLoading={false} isError={true} onRetry={onRetry}>
          <span>5 件</span>
        </SummaryCard>,
      );
      await userEvent.click(screen.getByRole("button", { name: "再試行" }));
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("children を描画しない", () => {
      render(
        <SummaryCard title="在庫切れ" isLoading={false} isError={true} onRetry={noop}>
          <span>5 件</span>
        </SummaryCard>,
      );
      expect(screen.queryByText("5 件")).toBeNull();
    });
  });

  describe("(c) data 状態", () => {
    it("タイトルを表示する", () => {
      render(
        <SummaryCard title="在庫少" isLoading={false} isError={false} onRetry={noop}>
          <span>3 件</span>
        </SummaryCard>,
      );
      expect(screen.getByText("在庫少")).toBeInTheDocument();
    });

    it("children を描画する", () => {
      render(
        <SummaryCard title="在庫少" isLoading={false} isError={false} onRetry={noop}>
          <span>3 件</span>
        </SummaryCard>,
      );
      expect(screen.getByText("3 件")).toBeInTheDocument();
    });

    it("Alert を描画しない", () => {
      render(
        <SummaryCard title="在庫少" isLoading={false} isError={false} onRetry={noop}>
          <span>3 件</span>
        </SummaryCard>,
      );
      expect(screen.queryByText("取得失敗")).toBeNull();
      expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
    });
  });
});
