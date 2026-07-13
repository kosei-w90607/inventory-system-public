// src/components/patterns/PageHeader.test.tsx
//
// PageHeader 3 variant の DOM 構造 assert。
// 設計: docs/function-design/59-ui-shared-patterns.md §59.1

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  describe("(a) title のみ", () => {
    it("h1 としてタイトルを描画し subtitle は出力しない", () => {
      render(<PageHeader title="在庫照会" />);
      expect(screen.getByRole("heading", { level: 1, name: "在庫照会" })).toBeInTheDocument();
      expect(screen.queryByRole("paragraph")).toBeNull();
    });

    it("header 要素に space-y-1 class が付く", () => {
      const { container } = render(<PageHeader title="在庫照会" />);
      const header = container.querySelector("header");
      expect(header).toHaveClass("space-y-1");
    });
  });

  describe("(b) title + subtitle", () => {
    it("h1 と subtitle 文言を両方描画する", () => {
      render(<PageHeader title="ホーム" subtitle="2026年6月12日（金）" />);
      expect(screen.getByRole("heading", { level: 1, name: "ホーム" })).toBeInTheDocument();
      expect(screen.getByText("2026年6月12日（金）")).toBeInTheDocument();
    });

    it("subtitle は p.text-sm.text-muted-foreground で描画される", () => {
      const { container } = render(<PageHeader title="ホーム" subtitle="2026年6月12日（金）" />);
      const p = container.querySelector("p");
      expect(p).toHaveClass("text-sm", "text-muted-foreground");
      expect(p).toHaveTextContent("2026年6月12日（金）");
    });

    it("header 要素に space-y-1 class が付く", () => {
      const { container } = render(<PageHeader title="ホーム" subtitle="副題" />);
      const header = container.querySelector("header");
      expect(header).toHaveClass("space-y-1");
    });
  });

  describe("(c) title + actions", () => {
    it("h1 と actions slot を両方描画する", () => {
      render(<PageHeader title="商品検索・一覧" actions={<a href="/products/new">商品登録</a>} />);
      expect(screen.getByRole("heading", { level: 1, name: "商品検索・一覧" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "商品登録" })).toBeInTheDocument();
    });

    it("header 要素に flex flex-wrap items-center justify-between gap-3 class が付く", () => {
      const { container } = render(
        <PageHeader title="商品検索・一覧" actions={<button type="button">操作</button>} />,
      );
      const header = container.querySelector("header");
      expect(header).toHaveClass("flex", "flex-wrap", "items-center", "justify-between", "gap-3");
    });

    it("subtitle が指定されていても actions が優先されフレックスレイアウトになる", () => {
      // actions と subtitle 両方指定された場合は actions (flex) レイアウトを使う
      const { container } = render(
        <PageHeader
          title="タイトル"
          subtitle="副題"
          actions={<button type="button">操作</button>}
        />,
      );
      const header = container.querySelector("header");
      expect(header).toHaveClass("flex");
    });
  });
});
