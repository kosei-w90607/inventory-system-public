// UI-02-D14 / UI-04-D16 / UI-03-D21 / UI-05-D16 / UI-10-D12
// SPEC-SUGGEST-D1〜D11: 商品追加欄 live 候補プレビューの契約テスト。

import { act, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode, RefObject } from "react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Input } from "@/components/ui/input";
import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import { commands, type ProductWithRelations } from "@/lib/bindings";
import { ProductAddSuggest, type ProductAddSuggestController } from "./ProductAddSuggest";
import { normalizeComposedDigits } from "./normalizeComposedDigits";
import { useProductAddSuggest } from "./useProductAddSuggest";

vi.mock("@/lib/bindings", () => ({
  commands: {
    searchProducts: vi.fn(),
  },
}));

const mockSearchProducts = vi.mocked(commands.searchProducts);

function okProducts(items: ProductWithRelations[], totalCount = items.length) {
  return {
    status: "ok" as const,
    data: { items, total_count: totalCount, page: 1, per_page: 5 },
  };
}

function makeProducts(count: number): ProductWithRelations[] {
  return Array.from({ length: count }, (_, index) =>
    makeMockProductWithRelations({
      product_code: `SG-${String(index + 1)}`,
      name: `候補商品${String(index + 1)}`,
      department_name: `部門${String(index + 1)}`,
    }),
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

interface HarnessProps {
  locked?: boolean;
  externalValue?: string;
  onFallback?: () => void;
  onInputChange?: (value: string) => void;
  onComposedDigitsCommit?: (normalized: string) => void;
  onSelect?: (product: ProductWithRelations) => void;
  controllerRef?: RefObject<ProductAddSuggestController | null>;
  children?: ReactNode;
}

function Harness({
  locked = false,
  externalValue,
  onFallback = vi.fn(),
  onInputChange = vi.fn(),
  onComposedDigitsCommit,
  onSelect = vi.fn(),
  controllerRef,
}: HarnessProps) {
  const [internalValue, setInternalValue] = useState("");
  const value = externalValue ?? internalValue;
  const controller = useProductAddSuggest({
    value,
    isLocked: () => locked,
    onSelect,
  });

  useEffect(() => {
    if (controllerRef) controllerRef.current = controller;
  }, [controller, controllerRef]);

  return (
    <ProductAddSuggest controller={controller} onComposedDigitsCommit={onComposedDigitsCommit}>
      <Input
        aria-label="商品追加"
        value={value}
        onChange={(event) => {
          setInternalValue(event.target.value);
          onInputChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") onFallback();
        }}
      />
    </ProductAddSuggest>
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function openSuggestions(products = makeProducts(2), totalCount = products.length) {
  mockSearchProducts.mockResolvedValueOnce(okProducts(products, totalCount));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "候" } });
  await advance(200);
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  return products;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockSearchProducts.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProductAddSuggest (SPEC-SUGGEST-D1〜D11)", () => {
  it("S1: 1文字入力の199ms後は未発火、200ms後にper_page 5で検索する", async () => {
    mockSearchProducts.mockResolvedValue(okProducts([]));
    render(<Harness />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "" } });
    await advance(200);
    expect(mockSearchProducts).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "糸" } });
    await advance(199);
    expect(mockSearchProducts).not.toHaveBeenCalled();
    await advance(1);

    expect(mockSearchProducts).toHaveBeenCalledWith({
      department_id: null,
      is_discontinued: false,
      sort_key: "ProductCode",
      sort_order: "Asc",
      page: 1,
      per_page: 5,
      keyword: "糸",
    });
  });

  it("S2: 0件応答ではリストも空状態メッセージも表示しない", async () => {
    mockSearchProducts.mockResolvedValue(okProducts([]));
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "該当なし" } });
    await advance(200);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/見つかりません|候補はありません/)).not.toBeInTheDocument();
  });

  it("S3: 総件数超過footerは非optionで契約文言を表示する", async () => {
    render(<Harness />);
    await openSuggestions(makeProducts(5), 8);

    expect(screen.getAllByRole("option")).toHaveLength(5);
    const footer = screen.getByText("ほか 3 件（候補未選択で Enter: 従来の検索）");
    expect(footer).not.toHaveAttribute("role", "option");
  });

  it("S4: 表示直後はactiveなしでEnterを既存commit経路へ委譲する", async () => {
    const onFallback = vi.fn();
    const onSelect = vi.fn();
    render(<Harness onFallback={onFallback} onSelect={onSelect} />);
    await openSuggestions();
    const input = screen.getByRole("combobox");

    expect(input).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onFallback).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("S5: ↓/↑だけがactiveを動かし端ではwrapしない", async () => {
    render(<Harness />);
    await openSuggestions();
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("S6: activeありEnterは候補確定だけを呼ぶ", async () => {
    const onFallback = vi.fn();
    const onSelect = vi.fn();
    render(<Harness onFallback={onFallback} onSelect={onSelect} />);
    const products = await openSuggestions();
    const input = screen.getByRole("combobox");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(products[0]);
    expect(onFallback).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("S7: onChange時点でactiveを同期解除して旧リストを閉じる", async () => {
    render(<Harness />);
    await openSuggestions();
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant");

    fireEvent.change(input, { target: { value: "候補更新" } });

    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("S8: 再fetchでリストを差し替えた後もactiveを持ち越さない", async () => {
    render(<Harness />);
    await openSuggestions(makeProducts(2));
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const replacement = [
      makeMockProductWithRelations({ product_code: "NEW-1", name: "差し替え商品" }),
    ];
    mockSearchProducts.mockResolvedValueOnce(okProducts(replacement));
    fireEvent.change(input, { target: { value: "差し替え" } });
    await advance(200);

    expect(screen.getByText("差し替え商品")).toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
  });

  it("S9: 旧sequence tokenの遅延応答を採用しない", async () => {
    const first = deferred<ReturnType<typeof okProducts>>();
    const second = deferred<ReturnType<typeof okProducts>>();
    mockSearchProducts.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<Harness />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "同一語" } });
    await advance(200);
    fireEvent.change(input, { target: { value: "別語" } });
    fireEvent.change(input, { target: { value: "同一語" } });
    await advance(200);
    second.resolve(
      okProducts([makeMockProductWithRelations({ product_code: "NEW", name: "新応答" })]),
    );
    await act(async () => second.promise);
    first.resolve(
      okProducts([makeMockProductWithRelations({ product_code: "OLD", name: "旧応答" })]),
    );
    await act(async () => first.promise);

    expect(screen.getByText("新応答")).toBeInTheDocument();
    expect(screen.queryByText("旧応答")).not.toBeInTheDocument();
  });

  it("S10: token一致でも応答検索語が現在値と違えば採用しない", async () => {
    const pending = deferred<ReturnType<typeof okProducts>>();
    mockSearchProducts.mockReturnValueOnce(pending.promise);
    const view = render(<Harness externalValue="" />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "旧" } });
    await advance(200);
    expect(mockSearchProducts).toHaveBeenCalledOnce();

    view.rerender(<Harness externalValue="新" />);
    pending.resolve(
      okProducts([makeMockProductWithRelations({ product_code: "OLD", name: "旧検索結果" })]),
    );
    await act(async () => pending.promise);
    await advance(0);

    expect(screen.queryByText("旧検索結果")).not.toBeInTheDocument();
  });

  it("S11: 全close系eventがtimerをcancelしin-flight成功/失敗を不採用にする", async () => {
    const timerCloseEvents = [
      (input: HTMLElement) => fireEvent.keyDown(input, { key: "Escape" }),
      (input: HTMLElement) => fireEvent.blur(input),
      (input: HTMLElement) => fireEvent.keyDown(input, { key: "Tab" }),
      (input: HTMLElement) => fireEvent.keyDown(input, { key: "Enter" }),
      (input: HTMLElement) => fireEvent.change(input, { target: { value: "" } }),
    ];
    for (const close of timerCloseEvents) {
      mockSearchProducts.mockReset();
      mockSearchProducts.mockResolvedValue(okProducts([]));
      const view = render(<Harness />);
      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "timer" } });
      close(input);
      await advance(200);
      expect(mockSearchProducts).not.toHaveBeenCalled();
      view.unmount();
    }

    mockSearchProducts.mockReset();
    const unmountView = render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "unmount" } });
    unmountView.unmount();
    await advance(200);
    expect(mockSearchProducts).not.toHaveBeenCalled();

    const pendingSuccess = deferred<ReturnType<typeof okProducts>>();
    const pendingError = deferred<ReturnType<typeof okProducts>>();
    mockSearchProducts
      .mockReset()
      .mockReturnValueOnce(pendingSuccess.promise)
      .mockReturnValueOnce(pendingError.promise)
      .mockResolvedValueOnce(
        okProducts([makeMockProductWithRelations({ product_code: "NEW", name: "現行候補" })]),
      );
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "late-success" } });
    await advance(200);
    fireEvent.blur(input);
    pendingSuccess.resolve(
      okProducts([makeMockProductWithRelations({ product_code: "LATE", name: "遅延成功" })]),
    );
    await act(async () => pendingSuccess.promise);
    expect(screen.queryByText("遅延成功")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "late-error" } });
    await advance(200);
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "current" } });
    await advance(200);
    expect(screen.getByText("現行候補")).toBeInTheDocument();
    await act(async () => {
      pendingError.reject(new Error("遅延失敗"));
      await Promise.resolve();
    });
    expect(screen.getByText("現行候補")).toBeInTheDocument();
  });

  it("S12: isComposing中はEnter/↓/↑/Escのsuggest処理を一切行わない", async () => {
    const onFallback = vi.fn();
    const onSelect = vi.fn();
    render(<Harness onFallback={onFallback} onSelect={onSelect} />);
    await openSuggestions();
    const input = screen.getByRole("combobox");

    for (const key of ["Enter", "ArrowDown", "ArrowUp", "Escape"]) {
      fireEvent.keyDown(input, { key, isComposing: true });
    }

    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(onFallback).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("S13: combobox/listbox/option構造とfocus保持を満たす", async () => {
    render(<Harness />);
    await openSuggestions();
    const input = screen.getByRole("combobox");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const listbox = screen.getByRole("listbox");
    const option = screen.getAllByRole("option")[0];
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", listbox.id);
    expect(input).toHaveAttribute("aria-activedescendant", option.id);
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveFocus();
  });

  it("S14: 候補行はmousedownでblurを防ぎclickでactive無関係に即確定する", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const products = await openSuggestions();
    const input = screen.getByRole("combobox");
    input.focus();
    const option = screen.getAllByRole("option")[1];

    expect(fireEvent.mouseDown(option)).toBe(false);
    expect(input).toHaveFocus();
    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledWith(products[1]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("S15: mouseenterではactiveを生成しない", async () => {
    render(<Harness />);
    await openSuggestions();
    const input = screen.getByRole("combobox");

    fireEvent.mouseEnter(screen.getAllByRole("option")[0]);

    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("S16: 候補行は商品コード・商品名・部門名だけを表示しnull部門は空表示にする", async () => {
    const products = [
      makeMockProductWithRelations({
        product_code: "ROW-1",
        name: "三項目商品",
        department_name: "服飾部門",
        selling_price: 9876,
      }),
      makeMockProductWithRelations({
        product_code: "ROW-2",
        name: "部門なし商品",
        department_name: null as unknown as string,
      }),
    ];
    render(<Harness />);
    await openSuggestions(products);
    const options = screen.getAllByRole("option");

    expect(within(options[0]).getByText("ROW-1")).toBeInTheDocument();
    expect(within(options[0]).getByText("三項目商品")).toBeInTheDocument();
    expect(within(options[0]).getByText("服飾部門")).toBeInTheDocument();
    expect(within(options[0]).queryByText(/9876|9,876/)).not.toBeInTheDocument();
    expect(within(options[1]).getByText("ROW-2")).toBeInTheDocument();
    expect(within(options[1]).queryByText("部門なし")).not.toBeInTheDocument();
  });

  it("S17: fetch errorはsilent closeし既存commit経路は生存する", async () => {
    const onFallback = vi.fn();
    mockSearchProducts.mockRejectedValueOnce(new Error("suggest failure"));
    render(<Harness onFallback={onFallback} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "失敗" } });
    await advance(200);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/suggest failure/)).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it("S18: lock中はfetchせず、表示中にlockすると即closeする", async () => {
    mockSearchProducts.mockResolvedValue(okProducts(makeProducts(1)));
    const view = render(<Harness locked />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "lock" } });
    await advance(200);
    expect(mockSearchProducts).not.toHaveBeenCalled();

    view.rerender(<Harness locked={false} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "open" } });
    await advance(200);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    view.rerender(<Harness locked />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("S19: invalidateAndCloseは同期close・timer cancel・in-flight不採用を行う", async () => {
    const controllerRef = { current: null } as RefObject<ProductAddSuggestController | null>;
    const pending = deferred<ReturnType<typeof okProducts>>();
    mockSearchProducts.mockReturnValueOnce(pending.promise);
    render(<Harness controllerRef={controllerRef} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "timer" } });
    controllerRef.current?.invalidateAndClose();
    await advance(200);
    expect(mockSearchProducts).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "flight" } });
    await advance(200);
    controllerRef.current?.invalidateAndClose();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    pending.resolve(
      okProducts([makeMockProductWithRelations({ product_code: "LATE", name: "遅延候補" })]),
    );
    await act(async () => pending.promise);
    expect(screen.queryByText("遅延候補")).not.toBeInTheDocument();
  });

  it("S20: composing中のonChangeでもdebounce検索を発火する", async () => {
    mockSearchProducts.mockResolvedValue(okProducts([]));
    render(<Harness />);
    const composingChange = createEvent.change(screen.getByRole("combobox"), {
      target: { value: "変換中" },
    });
    Object.defineProperty(composingChange, "isComposing", { value: true });
    fireEvent(screen.getByRole("combobox"), composingChange);
    await advance(200);

    expect(mockSearchProducts).toHaveBeenCalledOnce();
    expect(mockSearchProducts.mock.calls[0]?.[0].keyword).toBe("変換中");
  });

  it("S21: onChange非経由の外部value変更(既存commit経路のclear相当)でclose+timer cancelする", async () => {
    // (1) リスト open 中の外部 clear → 同期 close
    mockSearchProducts.mockResolvedValueOnce(okProducts(makeProducts(2)));
    const view = render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "候" } });
    await advance(200);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    view.rerender(<Harness externalValue="" />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    view.unmount();

    // (2) debounce pending 中の外部 clear → timer cancel で fetch 不発火
    mockSearchProducts.mockClear();
    const view2 = render(<Harness />);
    const input2 = screen.getByRole("combobox");
    fireEvent.change(input2, { target: { value: "次" } });
    view2.rerender(<Harness externalValue="" />);
    await advance(400);
    expect(mockSearchProducts).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // in-flight 応答の外部value変更不採用は S10 が検証済み（token+検索語二重一致）
  });

  it("S22: 全角数字だけのcompositionendは半角onChange後にcommitを1回呼ぶ", () => {
    const onInputChange = vi.fn();
    const onComposedDigitsCommit = vi.fn();
    render(
      <Harness onInputChange={onInputChange} onComposedDigitsCommit={onComposedDigitsCommit} />,
    );

    fireEvent.compositionEnd(screen.getByRole("combobox"), {
      target: { value: "１２３４５" },
    });

    expect(onInputChange).toHaveBeenCalledOnce();
    expect(onInputChange).toHaveBeenCalledWith("12345");
    expect(onComposedDigitsCommit).toHaveBeenCalledOnce();
    expect(onComposedDigitsCommit).toHaveBeenCalledWith("12345");
  });

  it("S23: 英字・かな・記号を含むcompositionendは加工もcommitもしない", () => {
    const onInputChange = vi.fn();
    const onComposedDigitsCommit = vi.fn();
    render(
      <Harness onInputChange={onInputChange} onComposedDigitsCommit={onComposedDigitsCommit} />,
    );
    const input = screen.getByRole("combobox");

    fireEvent.compositionEnd(input, { target: { value: "１２Aあ－３" } });

    expect(input).toHaveValue("１２Aあ－３");
    expect(onInputChange).not.toHaveBeenCalled();
    expect(onComposedDigitsCommit).not.toHaveBeenCalled();
  });

  it("S24: compositionend commit直後の非composing Enterをone-shotで抑止する", () => {
    const onFallback = vi.fn();
    const onComposedDigitsCommit = vi.fn();
    render(<Harness onFallback={onFallback} onComposedDigitsCommit={onComposedDigitsCommit} />);
    const input = screen.getByRole("combobox");

    fireEvent.compositionEnd(input, { target: { value: "５４３２１" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: false });

    expect(onComposedDigitsCommit).toHaveBeenCalledOnce();
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("S25: 半角数字だけのcompositionendもcommitを1回呼ぶ", () => {
    const onComposedDigitsCommit = vi.fn();
    render(<Harness onComposedDigitsCommit={onComposedDigitsCommit} />);

    fireEvent.compositionEnd(screen.getByRole("combobox"), {
      target: { value: "24680" },
    });

    expect(onComposedDigitsCommit).toHaveBeenCalledOnce();
    expect(onComposedDigitsCommit).toHaveBeenCalledWith("24680");
  });

  it("S26: リストopen中のcompositionendはfallbackだけを通り候補確定しない", async () => {
    const onComposedDigitsCommit = vi.fn();
    const onSelect = vi.fn();
    render(<Harness onComposedDigitsCommit={onComposedDigitsCommit} onSelect={onSelect} />);
    await openSuggestions();

    fireEvent.compositionEnd(screen.getByRole("combobox"), {
      target: { value: "８６４２０" },
    });

    expect(onComposedDigitsCommit).toHaveBeenCalledWith("86420");
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("S27: 数字10文字だけを境界どおり写像し空文字・全角記号混在は不変にする", () => {
    expect(normalizeComposedDigits("０１２３４５６７８９")).toBe("0123456789");
    expect(normalizeComposedDigits("０9")).toBe("09");
    expect(normalizeComposedDigits("")).toBe("");
    expect(normalizeComposedDigits("１２－３")).toBe("１２－３");
    expect(normalizeComposedDigits("１２．３")).toBe("１２．３");
  });
});
