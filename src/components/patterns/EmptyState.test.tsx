// src/components/patterns/EmptyState.test.tsx
//
// EmptyState 共通 component の単体テスト。
// 設計: docs/design-system/02-component-catalog.md ⑥ 空状態（Empty State）の標準UI

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("title のみのとき見出しが heading として描画される", () => {
    render(<EmptyState title="商品がありません" />);

    expect(screen.getByRole("heading", { name: "商品がありません" })).toBeInTheDocument();
  });

  it("icon を渡したとき aria-hidden で描画される（a11y: アイコンにセマンティクス不要）", () => {
    render(<EmptyState icon={PackageSearch} title="商品がありません" />);

    // aria-hidden の svg は queryByRole('img') で拾えない
    const svg = document.querySelector("svg[aria-hidden='true']");
    expect(svg).toBeInTheDocument();
    // heading は依然として存在する
    expect(screen.getByRole("heading", { name: "商品がありません" })).toBeInTheDocument();
  });

  it("description を渡したとき説明文が描画される", () => {
    render(<EmptyState title="商品がありません" description="検索条件を変更してください" />);

    expect(screen.getByText("検索条件を変更してください")).toBeInTheDocument();
  });

  it("description を省略したとき説明文要素が存在しない", () => {
    render(<EmptyState title="商品がありません" />);

    expect(screen.queryByRole("paragraph")).toBeNull();
    // heading は存在する
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("action を渡したときアクション要素が描画される", () => {
    render(<EmptyState title="商品がありません" action={<Button>商品を登録する</Button>} />);

    expect(screen.getByRole("button", { name: "商品を登録する" })).toBeInTheDocument();
  });

  it("action を省略したときアクション slot が存在しない", () => {
    render(<EmptyState title="商品がありません" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("icon + title + description + action の全組合せで正常に描画される", () => {
    render(
      <EmptyState
        icon={PackageSearch}
        title="見出し"
        description="説明文"
        action={<Button>アクション</Button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "見出し" })).toBeInTheDocument();
    expect(screen.getByText("説明文")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "アクション" })).toBeInTheDocument();
    const svg = document.querySelector("svg[aria-hidden='true']");
    expect(svg).toBeInTheDocument();
  });
});
