import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import { commands } from "@/lib/bindings";
import type { DisposalCreateRequest } from "@/lib/bindings";
import { queryKeys } from "@/lib/query-keys";
import { DisposalPage } from "./DisposalPage";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    className,
    children,
  }: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    className?: string;
    children: ReactNode;
  }) => {
    const path = params?.recordId ? to.replace("$recordId", params.recordId) : to;
    const query = search ? `?${new URLSearchParams(search).toString()}` : "";
    return (
      <a className={className} href={`${path}${query}`}>
        {children}
      </a>
    );
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    listDisposals: vi.fn(),
    searchProducts: vi.fn(),
    createDisposal: vi.fn(),
  },
}));

const mockListDisposals = vi.mocked(commands.listDisposals);
const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockCreateDisposal = vi.mocked(commands.createDisposal);
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

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("deferred promise is not initialized");
  };
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function mockDefaultQueries() {
  mockListDisposals.mockResolvedValue({
    status: "ok",
    data: { items: [], total_count: 0, page: 1, per_page: 10 },
  });
}

async function addSingleProduct(user: ReturnType<typeof userEvent.setup>) {
  mockSearchProducts.mockResolvedValue({
    status: "ok",
    data: {
      items: [
        makeMockProductWithRelations({
          product_code: "DP-001",
          name: "廃棄確認 商品",
          cost_price: 120,
          stock_quantity: 4,
        }),
      ],
      total_count: 1,
      page: 1,
      per_page: 10,
    },
  });

  await user.type(await screen.findByLabelText("廃棄・破損商品検索"), "DP-001{enter}");
  expect(await screen.findByText("DP-001")).toBeInTheDocument();
}

beforeEach(() => {
  mockScrollTo.mockReset();
  vi.stubGlobal("scrollTo", mockScrollTo);
  mockListDisposals.mockReset();
  mockSearchProducts.mockReset();
  mockCreateDisposal.mockReset();
  mockDefaultQueries();
});

describe("DisposalPage (UI-05 / REQ-204)", () => {
  it("REQ-204 adds a single matching product and restores focus with damage defaults", async () => {
    const user = userEvent.setup();
    renderWithClient(<DisposalPage />);

    await addSingleProduct(user);

    expect(screen.getByText("廃棄確認 商品")).toBeInTheDocument();
    expect(screen.getByLabelText("DP-001 の種別")).toHaveValue("damage");
    expect(screen.getByLabelText("DP-001 の数量")).toHaveValue(1);
    expect(screen.getByLabelText("DP-001 の原価")).toHaveValue(120);
    expect(screen.getByLabelText("DP-001 の理由")).toHaveValue("破損");
    await waitFor(() => {
      expect(screen.getByLabelText("廃棄・破損商品検索")).toHaveFocus();
    });
  });

  it("REQ-204 requires explicit selection when multiple products match", async () => {
    const user = userEvent.setup();
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          makeMockProductWithRelations({ product_code: "DP-001", name: "商品A" }),
          makeMockProductWithRelations({ product_code: "DP-002", name: "商品B" }),
        ],
        total_count: 2,
        page: 1,
        per_page: 10,
      },
    });

    renderWithClient(<DisposalPage />);
    await user.type(await screen.findByLabelText("廃棄・破損商品検索"), "商品{enter}");

    expect(
      await screen.findByText("候補から廃棄・破損する商品を選んでください"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("DP-001 の数量")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "廃棄・破損に追加" })[1]);

    expect(await screen.findByLabelText("DP-002 の数量")).toBeInTheDocument();
  });

  it("REQ-204 shows product registration guidance for no match and unsaved rows", async () => {
    const user = userEvent.setup();
    renderWithClient(<DisposalPage />);
    await addSingleProduct(user);
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 10 },
    });

    await user.type(screen.getByLabelText("廃棄・破損商品検索"), "missing{enter}");

    expect(await screen.findByText("該当する商品がありません")).toBeInTheDocument();
    expect(
      screen.getByText(
        "未登録商品の場合は、商品マスタに登録してから廃棄・破損へ戻って追加します。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "未保存の廃棄・破損内容があります。商品登録へ進むとこの画面の入力は残りません。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品登録へ進む" })).toHaveAttribute(
      "href",
      "/products/new",
    );
  });

  it("REQ-204 merges duplicate product type and reason rows", async () => {
    const user = userEvent.setup();
    renderWithClient(<DisposalPage />);

    await addSingleProduct(user);
    await user.type(screen.getByLabelText("廃棄・破損商品検索"), "DP-001{enter}");

    expect(screen.getAllByText("DP-001")).toHaveLength(1);
    expect(screen.getByLabelText("DP-001 の数量")).toHaveValue(2);
  });

  it("REQ-204 keeps different reasons separate and merges them when edited to match", async () => {
    const user = userEvent.setup();
    renderWithClient(<DisposalPage />);

    await addSingleProduct(user);
    fireEvent.change(screen.getByLabelText("DP-001 の理由"), { target: { value: "期限切れ" } });
    await user.type(screen.getByLabelText("廃棄・破損商品検索"), "DP-001{enter}");

    expect(screen.getAllByText("DP-001")).toHaveLength(2);

    fireEvent.change(screen.getAllByLabelText("DP-001 の理由")[1], {
      target: { value: "期限切れ" },
    });

    expect(screen.getAllByText("DP-001")).toHaveLength(1);
    expect(screen.getByLabelText("DP-001 の数量")).toHaveValue(2);
  });

  it("REQ-204 keeps focus while typing a disposal reason", async () => {
    const user = userEvent.setup();
    renderWithClient(<DisposalPage />);

    await addSingleProduct(user);
    const reasonInput = screen.getByLabelText("DP-001 の理由");
    await user.clear(reasonInput);
    await user.type(reasonInput, "期限切れ");

    expect(screen.getByLabelText("DP-001 の理由")).toHaveValue("期限切れ");
    expect(screen.getByLabelText("DP-001 の理由")).toHaveFocus();
  });

  it("REQ-204 blocks invalid quantity cost and reason before submit", async () => {
    const user = userEvent.setup();
    renderWithClient(<DisposalPage />);
    await addSingleProduct(user);

    fireEvent.change(screen.getByLabelText("DP-001 の数量"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("DP-001 の原価"), { target: { value: "-1" } });
    fireEvent.change(screen.getByLabelText("DP-001 の理由"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));

    expect(
      await screen.findByText(
        "DP-001: 数量は1以上の整数で入力してください / 原価は0以上の整数で入力してください / 理由は必須です",
      ),
    ).toBeInTheDocument();
    expect(mockScrollTo).not.toHaveBeenCalled();
    expect(mockCreateDisposal).not.toHaveBeenCalled();
  });

  it("REQ-204 creates a disposal record and invalidates disposal and inventory queries", async () => {
    const user = userEvent.setup();
    mockCreateDisposal.mockResolvedValue({
      status: "ok",
      data: { record_id: 41, created: true, idempotent_replay: false, stock_warnings: [] },
    });

    const { queryClient } = renderWithClient(<DisposalPage />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await addSingleProduct(user);
    fireEvent.change(screen.getByLabelText("DP-001 の数量"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("DP-001 の理由"), { target: { value: "棚卸差異" } });
    await user.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
    expect(await screen.findByText("廃棄・破損を保存しました")).toBeInTheDocument();
    expect(screen.getByText("¥240")).toBeInTheDocument();
    const createCalls = mockCreateDisposal.mock.calls as [DisposalCreateRequest][];
    expect(createCalls[0][0].disposal_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(createCalls[0][0].items).toEqual([
      {
        product_code: "DP-001",
        disposal_type: "damage",
        quantity: 2,
        cost_price: 120,
        reason: "棚卸差異",
      },
    ]);
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.disposals.root() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.inventoryRecords.root() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.productList.root() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.lowStock(false) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.stockInquiryRoot() });
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["daily-sales"] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.monthlySalesRoot() });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.pluDirty() });
  });

  it("REQ-204 keeps the idempotency key for same-content retry and rotates it after edits or reset", async () => {
    const user = userEvent.setup();
    mockCreateDisposal
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一時的なエラー", field: null },
      })
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一時的なエラー", field: null },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: { record_id: 51, created: true, idempotent_replay: false, stock_warnings: [] },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: { record_id: 52, created: true, idempotent_replay: false, stock_warnings: [] },
      });

    renderWithClient(<DisposalPage />);
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));
    expect(await screen.findByText("一時的なエラー")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
    const firstKey = mockCreateDisposal.mock.calls[0][0].idempotency_key;

    await user.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));
    const sameContentRetryKey = mockCreateDisposal.mock.calls[1][0].idempotency_key;
    expect(sameContentRetryKey).toBe(firstKey);

    fireEvent.change(screen.getByLabelText("DP-001 の理由"), { target: { value: "棚卸差異" } });
    await user.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));
    expect(await screen.findByText("廃棄・破損を保存しました")).toBeInTheDocument();
    const editedRetryKey = mockCreateDisposal.mock.calls[2][0].idempotency_key;
    expect(editedRetryKey).not.toBe(firstKey);

    await user.click(screen.getByRole("button", { name: "続けて廃棄・破損" }));
    await user.type(screen.getByLabelText("廃棄・破損商品検索"), "DP-001{enter}");
    await user.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));
    const nextRecordKey = mockCreateDisposal.mock.calls[3][0].idempotency_key;
    expect(nextRecordKey).not.toBe(editedRetryKey);
  });

  it("REQ-204 displays recent disposal records", async () => {
    mockListDisposals.mockResolvedValue({
      status: "ok",
      data: {
        items: [{ id: 12, disposal_date: "2026-06-27", created_at: "2026-06-27T10:30:00" }],
        total_count: 1,
        page: 1,
        per_page: 10,
      },
    });

    renderWithClient(<DisposalPage />);

    expect(await screen.findByText("2026-06-27")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("2026-06-27 10:30:00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "すべての履歴を見る" })).toHaveAttribute(
      "href",
      "/inventory/records?recordType=disposal_record",
    );
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/inventory/disposal/records/12",
    );
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveClass("border");
  });

  it("REQ-204 hides product registration recovery and locks editing while saving", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<Awaited<ReturnType<typeof commands.createDisposal>>>();
    mockCreateDisposal.mockReturnValue(deferred.promise);

    renderWithClient(<DisposalPage />);
    await addSingleProduct(user);
    mockSearchProducts.mockResolvedValueOnce({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 10 },
    });
    await user.type(screen.getByLabelText("廃棄・破損商品検索"), "NO-HIT{enter}");
    expect(await screen.findByRole("link", { name: "商品登録へ進む" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "商品登録へ進む" })).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("DP-001 の数量")).toBeDisabled();

    deferred.resolve({
      status: "ok",
      data: { record_id: 42, created: true, idempotent_replay: false, stock_warnings: [] },
    });
    expect(await screen.findByText("廃棄・破損を保存しました")).toBeInTheDocument();
  });

  it("REQ-204 ignores late product search results after the form is locked", async () => {
    const user = userEvent.setup();
    const deferredSearch = createDeferred<Awaited<ReturnType<typeof commands.searchProducts>>>();
    mockCreateDisposal.mockResolvedValue({
      status: "ok",
      data: { record_id: 43, created: true, idempotent_replay: false, stock_warnings: [] },
    });

    renderWithClient(<DisposalPage />);
    await addSingleProduct(user);
    mockSearchProducts.mockReturnValueOnce(deferredSearch.promise);

    await user.type(screen.getByLabelText("廃棄・破損商品検索"), "DP-002{enter}");
    await user.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));
    expect(await screen.findByText("廃棄・破損を保存しました")).toBeInTheDocument();

    deferredSearch.resolve({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "DP-002", name: "遅延検索商品" })],
        total_count: 1,
        page: 1,
        per_page: 10,
      },
    });

    await waitFor(() => {
      expect(screen.queryByText("遅延検索商品")).not.toBeInTheDocument();
    });
    expect(screen.getByText("廃棄・破損を保存しました")).toBeInTheDocument();
    expect(screen.queryByText("DP-002")).not.toBeInTheDocument();
  });
});
