// src/components/patterns/SearchBar.test.tsx
//
// SearchBar 共通 component の unit test。
// commit 型（debounceMs 未指定）と live 型（debounceMs 指定）の両モードを検証。
// 移管元:
//   - src/features/products/components/ProductSearchBar.test.tsx（commit 型）
//   - src/features/stock-inquiry/components/SearchBar.test.tsx（live 型）
// 設計: docs/function-design/59-ui-shared-patterns.md §59.5

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchBar } from "./SearchBar";

// ---------------------------------------------------------------------------
// commit 型（debounceMs 未指定）— products 現実装から移管
// ---------------------------------------------------------------------------

describe("SearchBar commit 型（debounceMs 未指定、REQ-103 商品検索の入力欄）", () => {
  it("初期表示時に検索 input へ focus する", () => {
    render(<SearchBar value="" onSearchChange={vi.fn()} />);
    expect(screen.getByLabelText("商品検索")).toHaveFocus();
  });

  it("Enter で確定値（trim 済み）を onSearchChange に渡す", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar value="" onSearchChange={onSearchChange} />);

    await user.type(screen.getByLabelText("商品検索"), "HZ-0047");
    await user.keyboard("{Enter}");

    expect(onSearchChange).toHaveBeenCalledWith("HZ-0047");
  });

  it("Enter で commit 時に trim される（前後空白除去）", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar value="" onSearchChange={onSearchChange} />);

    await user.type(screen.getByLabelText("商品検索"), "  はさみ  ");
    await user.keyboard("{Enter}");

    expect(onSearchChange).toHaveBeenCalledWith("はさみ");
  });

  it("IME 合成中（isComposing: true）の Enter で onSearchChange を呼ばない（commit 型）", () => {
    const onSearchChange = vi.fn();
    render(<SearchBar value="" onSearchChange={onSearchChange} />);

    const input = screen.getByLabelText("商品検索");
    input.focus();

    // IME 変換中（isComposing: true）の KeyboardEvent を dispatch
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(enterEvent, "isComposing", { value: true, configurable: true });
    input.dispatchEvent(enterEvent);

    expect(onSearchChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// live 型（debounceMs 指定）— stock-inquiry 現実装から移管
// ---------------------------------------------------------------------------

describe("SearchBar live 型（debounceMs 指定、REQ-301 在庫照会の検索欄）", () => {
  it("初期表示時に検索 input へ focus する", () => {
    render(<SearchBar value="" onSearchChange={vi.fn()} debounceMs={200} />);
    expect(screen.getByLabelText("商品検索")).toHaveFocus();
  });

  it("Enter で debounce を待たず即時に onSearchChange を呼ぶ", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar value="" onSearchChange={onSearchChange} debounceMs={200} />);

    const input = screen.getByLabelText("商品検索");
    await user.type(input, "はさみ");
    await user.keyboard("{Enter}");

    // Enter 押下時に確定値で即時発火（debounce 待ちなし）
    expect(onSearchChange).toHaveBeenCalledWith("はさみ");
  });

  it("live 型の Enter は trim しない（値をそのまま渡す）", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar value="" onSearchChange={onSearchChange} debounceMs={200} />);

    const input = screen.getByLabelText("商品検索");
    await user.type(input, "  はさみ  ");
    await user.keyboard("{Enter}");

    // live 型は trim なし
    expect(onSearchChange).toHaveBeenCalledWith("  はさみ  ");
  });

  it("IME 合成中（isComposing: true）の Enter で onSearchChange を呼ばない（live 型）", () => {
    const onSearchChange = vi.fn();
    render(<SearchBar value="" onSearchChange={onSearchChange} debounceMs={200} />);

    const input = screen.getByLabelText("商品検索");
    input.focus();

    // IME 変換中（isComposing: true）の KeyboardEvent を dispatch
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(enterEvent, "isComposing", { value: true, configurable: true });
    input.dispatchEvent(enterEvent);

    expect(onSearchChange).not.toHaveBeenCalled();
  });
});
