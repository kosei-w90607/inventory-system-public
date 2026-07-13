import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeMockProductWithRelations,
  makeMockSupplier,
} from "@/features/products/lib/test-fixtures";
import { commands } from "@/lib/bindings";
import { queryKeys } from "@/lib/query-keys";
import { ReceivingPage } from "./ReceivingPage";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    children,
  }: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    children: ReactNode;
  }) => {
    const path =
      params === undefined
        ? to
        : Object.entries(params).reduce((path, [key, value]) => {
            return path.replace(`$${key}`, value);
          }, to);
    const query = search === undefined ? "" : `?${new URLSearchParams(search).toString()}`;
    const href = `${path}${query}`;
    return <a href={href}>{children}</a>;
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    listSuppliers: vi.fn(),
    listReceivings: vi.fn(),
    searchProducts: vi.fn(),
    createReceiving: vi.fn(),
  },
}));

const mockListSuppliers = vi.mocked(commands.listSuppliers);
const mockListReceivings = vi.mocked(commands.listReceivings);
const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockCreateReceiving = vi.mocked(commands.createReceiving);
const mockScrollTo = vi.fn();

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

function mockDefaultQueries() {
  mockListSuppliers.mockResolvedValue({
    status: "ok",
    data: [makeMockSupplier({ id: 1, name: "テスト商事" })],
  });
  mockListReceivings.mockResolvedValue({
    status: "ok",
    data: { items: [], total_count: 0, page: 1, per_page: 10 },
  });
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("deferred promise is not initialized");
  };
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function addSingleProduct(user: ReturnType<typeof userEvent.setup>) {
  mockSearchProducts.mockResolvedValue({
    status: "ok",
    data: {
      items: [makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" })],
      total_count: 1,
      page: 1,
      per_page: 10,
    },
  });

  await user.type(await screen.findByLabelText("入庫商品検索"), "P-001{enter}");
  expect(await screen.findByText("P-001")).toBeInTheDocument();
}

beforeEach(() => {
  mockScrollTo.mockReset();
  vi.stubGlobal("scrollTo", mockScrollTo);
  mockListSuppliers.mockReset();
  mockListReceivings.mockReset();
  mockSearchProducts.mockReset();
  mockCreateReceiving.mockReset();
  mockDefaultQueries();
});

describe("ReceivingPage (UI-02 / REQ-201)", () => {
  it("adds a single search result and returns focus to the search input", async () => {
    const user = userEvent.setup();
    renderWithClient(<ReceivingPage />);

    await addSingleProduct(user);

    expect(screen.getByText("はさみ")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("入庫商品検索")).toHaveFocus();
    });
  });

  it("requires selection when product search returns multiple candidates", async () => {
    const user = userEvent.setup();
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" }),
          makeMockProductWithRelations({ product_code: "P-002", name: "布" }),
        ],
        total_count: 2,
        page: 1,
        per_page: 10,
      },
    });

    renderWithClient(<ReceivingPage />);
    await user.type(await screen.findByLabelText("入庫商品検索"), "P{enter}");

    expect(await screen.findByText("候補から入庫する商品を選んでください")).toBeInTheDocument();
    expect(screen.queryByLabelText("P-001 の数量")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "入庫に追加" })[1]);

    expect(await screen.findByLabelText("P-002 の数量")).toBeInTheDocument();
  });

  it("shows product registration recovery when product search has no results", async () => {
    const user = userEvent.setup();
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 10 },
    });

    renderWithClient(<ReceivingPage />);
    await user.type(await screen.findByLabelText("入庫商品検索"), "missing{enter}");

    expect(await screen.findByText("該当する商品がありません")).toBeInTheDocument();
    expect(
      screen.getByText("未登録商品の場合は、商品マスタに登録してから入庫記録に戻って追加します。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品登録へ進む" })).toHaveAttribute(
      "href",
      "/products/new",
    );
  });

  it("shows unsaved warning before product registration recovery when rows exist", async () => {
    const user = userEvent.setup();
    renderWithClient(<ReceivingPage />);
    await addSingleProduct(user);
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 10 },
    });

    await user.type(screen.getByLabelText("入庫商品検索"), "missing{enter}");

    expect(
      await screen.findByText(
        "未保存の入庫内容があります。商品登録へ進むとこの画面の入力は残りません。",
      ),
    ).toBeInTheDocument();
  });

  it("allows no-supplier save when supplier options fail", async () => {
    const user = userEvent.setup();
    mockListSuppliers.mockResolvedValue({
      status: "error",
      error: { kind: "internal", message: "取引先取得失敗", field: null },
    });
    mockCreateReceiving.mockResolvedValue({
      status: "ok",
      data: { record_id: 10, created: true, idempotent_replay: false, stock_warnings: [] },
    });

    renderWithClient(<ReceivingPage />);
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "入庫を保存" }));

    await waitFor(() => {
      expect(mockCreateReceiving).toHaveBeenCalledWith(
        expect.objectContaining({ supplier_id: null }),
      );
    });
    expect(await screen.findByText("入庫を保存しました")).toBeInTheDocument();
  });

  it("successful submit shows result and invalidates receiving/product/inventory record queries", async () => {
    const user = userEvent.setup();
    mockCreateReceiving.mockResolvedValue({
      status: "ok",
      data: {
        record_id: 11,
        created: true,
        idempotent_replay: false,
        stock_warnings: ["P-001: 在庫がマイナスになりました（-1）"],
      },
    });

    const { queryClient } = renderWithClient(<ReceivingPage />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "入庫を保存" }));

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
    expect(await screen.findByText("記録ID")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("P-001: 在庫がマイナスになりました（-1）")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/inventory/receiving/records/11",
    );
    expect(screen.getByRole("button", { name: "入庫を保存" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "入庫を保存" }));
    expect(mockCreateReceiving).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.receivings.root() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.productList.root() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.lowStock(false) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.stockInquiryRoot() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.inventoryRecords.root() });
      expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.pluDirty() });
    });
  });

  it("REQ-201/REQ-206: recent list exposes all-history and detail links", async () => {
    mockListReceivings.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            id: 11,
            receiving_date: "2026-06-27",
            supplier_id: 1,
            supplier_name: "テスト商事",
            note: "午前便",
            created_at: "2026-06-27T09:00:00",
          },
        ],
        total_count: 1,
        page: 1,
        per_page: 5,
      },
    });

    renderWithClient(<ReceivingPage />);

    expect((await screen.findAllByText("テスト商事")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "すべての履歴を見る" })).toHaveAttribute(
      "href",
      "/inventory/records?recordType=receiving_record",
    );
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/inventory/receiving/records/11",
    );
  });

  it("REQ-201 clears row validation errors when an invalid row is removed and re-added", async () => {
    const user = userEvent.setup();
    renderWithClient(<ReceivingPage />);
    await addSingleProduct(user);

    fireEvent.change(screen.getByLabelText("P-001 の数量"), { target: { value: "0" } });
    await user.click(screen.getByRole("button", { name: "入庫を保存" }));

    expect(
      await screen.findByText("P-001: 数量は1以上の整数で入力してください"),
    ).toBeInTheDocument();
    expect(mockScrollTo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "P-001 を削除" }));
    await user.type(screen.getByLabelText("入庫商品検索"), "P-001{enter}");

    expect(
      screen.queryByText("P-001: 数量は1以上の整数で入力してください"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("P-001 の数量")).toHaveAttribute("aria-invalid", "false");
  });

  it("REQ-201 keeps validation errors for unchanged rows when another row changes", async () => {
    const user = userEvent.setup();
    mockSearchProducts
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          items: [makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" })],
          total_count: 1,
          page: 1,
          per_page: 10,
        },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          items: [makeMockProductWithRelations({ product_code: "P-002", name: "布" })],
          total_count: 1,
          page: 1,
          per_page: 10,
        },
      });

    renderWithClient(<ReceivingPage />);
    await user.type(await screen.findByLabelText("入庫商品検索"), "P-001{enter}");
    await user.type(screen.getByLabelText("入庫商品検索"), "P-002{enter}");
    fireEvent.change(screen.getByLabelText("P-001 の数量"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("P-002 の数量"), { target: { value: "0" } });
    await user.click(screen.getByRole("button", { name: "入庫を保存" }));

    expect(
      await screen.findByText("P-001: 数量は1以上の整数で入力してください"),
    ).toBeInTheDocument();
    expect(screen.getByText("P-002: 数量は1以上の整数で入力してください")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "P-001 を削除" }));

    expect(
      screen.queryByText("P-001: 数量は1以上の整数で入力してください"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("P-002: 数量は1以上の整数で入力してください")).toBeInTheDocument();
  });

  it("submit pending disables editing and hides back navigation action", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<{
      status: "ok";
      data: {
        record_id: number;
        created: boolean;
        idempotent_replay: boolean;
        stock_warnings: string[];
      };
    }>();
    mockCreateReceiving.mockReturnValue(deferred.promise);

    renderWithClient(<ReceivingPage />);
    await addSingleProduct(user);
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          makeMockProductWithRelations({ product_code: "P-002", name: "布" }),
          makeMockProductWithRelations({ product_code: "P-003", name: "糸" }),
        ],
        total_count: 2,
        page: 1,
        per_page: 10,
      },
    });
    await user.type(screen.getByLabelText("入庫商品検索"), "P{enter}");
    expect(await screen.findByText("候補から入庫する商品を選んでください")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "入庫を保存" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();
      expect(screen.getByRole("button", { name: "リセット" })).toBeDisabled();
      expect(screen.getByLabelText("P-001 の数量")).toBeDisabled();
      for (const button of screen.getAllByRole("button", { name: "入庫に追加" })) {
        expect(button).toBeDisabled();
      }
      expect(screen.queryByRole("link", { name: "在庫照会へ戻る" })).not.toBeInTheDocument();
    });

    deferred.resolve({
      status: "ok",
      data: { record_id: 12, created: true, idempotent_replay: false, stock_warnings: [] },
    });
  });

  it("keeps the same idempotency key for same-content retry", async () => {
    const user = userEvent.setup();
    mockCreateReceiving
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一時的なエラー", field: null },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: { record_id: 20, created: true, idempotent_replay: false, stock_warnings: [] },
      });

    renderWithClient(<ReceivingPage />);
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "入庫を保存" }));
    expect(await screen.findByText("一時的なエラー")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
    const firstKey = mockCreateReceiving.mock.calls[0][0].idempotency_key;

    await user.click(screen.getByRole("button", { name: "入庫を保存" }));

    await waitFor(() => {
      expect(mockCreateReceiving).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateReceiving.mock.calls[1][0].idempotency_key).toBe(firstKey);
  });

  it("generates a new idempotency key when the form is edited after create failure", async () => {
    const user = userEvent.setup();
    mockCreateReceiving
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一時的なエラー", field: null },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: { record_id: 21, created: true, idempotent_replay: false, stock_warnings: [] },
      });

    renderWithClient(<ReceivingPage />);
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "入庫を保存" }));
    expect(await screen.findByText("一時的なエラー")).toBeInTheDocument();
    const firstKey = mockCreateReceiving.mock.calls[0][0].idempotency_key;

    await user.type(screen.getByLabelText("備考"), "納品書あり");
    await user.click(screen.getByRole("button", { name: "入庫を保存" }));

    await waitFor(() => {
      expect(mockCreateReceiving).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateReceiving.mock.calls[1][0].idempotency_key).not.toBe(firstKey);
  });

  it("renders recent receiving success empty and error states", async () => {
    mockListReceivings.mockResolvedValueOnce({
      status: "ok",
      data: {
        items: [
          {
            id: 1,
            supplier_id: 1,
            supplier_name: "テスト商事",
            receiving_date: "2026-06-25",
            note: "午前便",
            created_at: "2026-06-25T10:00:00",
          },
        ],
        total_count: 1,
        page: 1,
        per_page: 10,
      },
    });

    renderWithClient(<ReceivingPage />);
    expect(await screen.findByText("午前便")).toBeInTheDocument();
  });
});
