import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import { commands } from "@/lib/bindings";
import { queryKeys } from "@/lib/query-keys";
import { ReturnExchangePage } from "./ReturnExchangePage";

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
    listReturns: vi.fn(),
    searchProducts: vi.fn(),
    createReturn: vi.fn(),
    saveReceiptImage: vi.fn(),
  },
}));

const mockListReturns = vi.mocked(commands.listReturns);
const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockCreateReturn = vi.mocked(commands.createReturn);
const mockSaveReceiptImage = vi.mocked(commands.saveReceiptImage);
const mockScrollTo = vi.fn();

const registerProcessedStockDescription =
  "この保存では在庫数を変更しません。日次CSV取込みで返品分の在庫が反映されます。";
const registerUnprocessedStockDescription =
  "この保存で在庫数を反映します。日次CSVに同じ返品を重ねて取込まない運用です。";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

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
  mockListReturns.mockResolvedValue({
    status: "ok",
    data: { items: [], total_count: 0, page: 1, per_page: 10 },
  });
}

async function addSingleProduct(user: ReturnType<typeof userEvent.setup>) {
  mockSearchProducts.mockResolvedValue({
    status: "ok",
    data: {
      items: [makeMockProductWithRelations({ product_code: "RT-001", name: "返品商品" })],
      total_count: 1,
      page: 1,
      per_page: 10,
    },
  });

  await user.type(await screen.findByLabelText("返品・交換商品検索"), "RT-001{enter}");
  expect(await screen.findByText("RT-001")).toBeInTheDocument();
}

beforeEach(() => {
  mockScrollTo.mockReset();
  vi.stubGlobal("scrollTo", mockScrollTo);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:receipt-preview");
  mockListReturns.mockReset();
  mockSearchProducts.mockReset();
  mockCreateReturn.mockReset();
  mockSaveReceiptImage.mockReset();
  mockDefaultQueries();
});

describe("ReturnExchangePage (UI-03 / REQ-202)", () => {
  it("shows register processed explanation as text and badge", async () => {
    const user = userEvent.setup();
    renderWithClient(<ReturnExchangePage />);

    expect(await screen.findByText("CSV取込みで反映")).toBeInTheDocument();
    expect(screen.getAllByText(registerProcessedStockDescription).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("レジ戻し済み")).toBeChecked();
    await user.click(screen.getByLabelText("レジ未処理"));

    expect(screen.getByLabelText("レジ未処理")).toBeChecked();
    expect(screen.getByText("この保存で反映")).toBeInTheDocument();
    expect(screen.getAllByText(registerUnprocessedStockDescription).length).toBeGreaterThan(0);
  });

  it("successful submit invalidates returns and stock keys only when register_processed=false", async () => {
    const user = userEvent.setup();
    mockCreateReturn.mockResolvedValue({
      status: "ok",
      data: { record_id: 30, created: true, idempotent_replay: false, stock_warnings: [] },
    });

    const { queryClient } = renderWithClient(<ReturnExchangePage />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await addSingleProduct(user);
    await user.click(screen.getByLabelText("レジ未処理"));
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
    expect(await screen.findByText("返品・交換を保存しました")).toBeInTheDocument();
    expect(screen.getAllByText(registerUnprocessedStockDescription).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/inventory/return/records/30",
    );
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.returns.root() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.productList.root() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.lowStock(false) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.stockInquiryRoot() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.inventoryRecords.root() });
    });
  });

  it("REQ-202/REQ-206: recent list exposes all-history and detail links", async () => {
    mockListReturns.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            id: 30,
            return_date: "2026-06-27",
            return_type: "return",
            register_processed: false,
            note: "袋破れ",
            created_at: "2026-06-27T10:00:00",
          },
        ],
        total_count: 1,
        page: 1,
        per_page: 5,
      },
    });

    renderWithClient(<ReturnExchangePage />);

    expect(await screen.findByText("袋破れ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "すべての履歴を見る" })).toHaveAttribute(
      "href",
      "/inventory/records?recordType=return_record",
    );
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/inventory/return/records/30",
    );
  });

  it("REQ-202/UI-03-D19: note is multiline and visible in the saved result", async () => {
    const user = userEvent.setup();
    mockCreateReturn.mockResolvedValue({
      status: "ok",
      data: { record_id: 36, created: true, idempotent_replay: false, stock_warnings: [] },
    });

    renderWithClient(<ReturnExchangePage />);
    const noteField = await screen.findByLabelText("備考");
    expect(noteField.tagName).toBe("TEXTAREA");
    await user.type(noteField, "サイズ交換のため確認済み");
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));

    await waitFor(() => {
      expect(mockCreateReturn).toHaveBeenCalled();
    });
    expect(mockCreateReturn.mock.calls[0][0].note).toBe("サイズ交換のため確認済み");
    const resultRegion = await screen.findByRole("region", { name: "保存結果" });
    expect(within(resultRegion).getByText("備考")).toBeInTheDocument();
    expect(within(resultRegion).getByText("サイズ交換のため確認済み")).toBeInTheDocument();
  });

  it("REQ-202/REQ-206/UI-03-D19: recent list shows note text and fallback", async () => {
    mockListReturns.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            id: 30,
            return_date: "2026-06-27",
            return_type: "return",
            register_processed: false,
            note: "袋破れ",
            created_at: "2026-06-27T10:00:00",
          },
          {
            id: 31,
            return_date: "2026-06-28",
            return_type: "exchange",
            register_processed: true,
            note: null,
            created_at: "2026-06-28T11:00:00",
          },
        ],
        total_count: 2,
        page: 1,
        per_page: 10,
      },
    });

    renderWithClient(<ReturnExchangePage />);

    const recentRegion = await screen.findByRole("region", { name: "直近の返品・交換" });
    expect(await within(recentRegion).findByText("袋破れ")).toBeInTheDocument();
    expect(within(recentRegion).getByText("備考なし")).toBeInTheDocument();
  });

  it("successful register-processed submit invalidates returns without stock keys", async () => {
    const user = userEvent.setup();
    mockCreateReturn.mockResolvedValue({
      status: "ok",
      data: { record_id: 32, created: true, idempotent_replay: false, stock_warnings: [] },
    });

    const { queryClient } = renderWithClient(<ReturnExchangePage />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));

    expect(await screen.findByText("返品・交換を保存しました")).toBeInTheDocument();
    const resultRegion = screen.getByRole("region", { name: "保存結果" });
    expect(within(resultRegion).getByText("備考なし")).toBeInTheDocument();
    expect(screen.getAllByText(registerProcessedStockDescription).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.returns.root() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.inventoryRecords.root() });
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.productList.root() });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.lowStock(false) });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.stockInquiryRoot() });
  });

  it("can add the same product as both return-in and exchange-out rows", async () => {
    const user = userEvent.setup();
    renderWithClient(<ReturnExchangePage />);
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "RT-001", name: "返品商品" })],
        total_count: 1,
        page: 1,
        per_page: 10,
      },
    });

    await user.selectOptions(screen.getByLabelText("種別"), "exchange");
    await user.type(await screen.findByLabelText("返品・交換商品検索"), "RT-001{enter}");
    await user.selectOptions(screen.getByLabelText("追加方向"), "out");
    await user.type(screen.getByLabelText("返品・交換商品検索"), "RT-001{enter}");

    expect(screen.getAllByText("RT-001")).toHaveLength(2);
    expect(screen.getAllByLabelText("RT-001 の数量")).toHaveLength(2);
  });

  it("shows receipt preview and rotates idempotency key after removing an image following failure", async () => {
    const user = userEvent.setup();
    mockSaveReceiptImage.mockResolvedValue({
      status: "ok",
      data: { relative_path: "images/receipts/receipt.png" },
    });
    mockCreateReturn
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一時的なエラー", field: null },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: { record_id: 33, created: true, idempotent_replay: false, stock_warnings: [] },
      });

    renderWithClient(<ReturnExchangePage />);
    await addSingleProduct(user);
    const file = new File(["receipt"], "receipt.png", { type: "image/png" });
    const receiptInput = screen.getByLabelText<HTMLInputElement>("レシート画像");
    await user.upload(receiptInput, file);

    expect(await screen.findByAltText("選択したレシート画像")).toHaveAttribute(
      "src",
      "blob:receipt-preview",
    );
    expect(receiptInput.files).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));
    expect(await screen.findByText("一時的なエラー")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
    const firstKey = mockCreateReturn.mock.calls[0][0].idempotency_key;

    await user.click(screen.getByRole("button", { name: "レシート画像を削除" }));
    expect(receiptInput.files).toHaveLength(0);
    expect(screen.queryByText("receipt.png")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));

    await waitFor(() => {
      expect(mockCreateReturn).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateReturn.mock.calls[1][0].idempotency_key).not.toBe(firstKey);
    expect(mockCreateReturn.mock.calls[1][0].receipt_image_path).toBeNull();
  });

  it("validates rows before saving a receipt image", async () => {
    const user = userEvent.setup();
    mockSaveReceiptImage.mockResolvedValue({
      status: "ok",
      data: { relative_path: "images/receipts/invalid.png" },
    });

    renderWithClient(<ReturnExchangePage />);
    await addSingleProduct(user);
    await user.selectOptions(screen.getByLabelText("種別"), "exchange");
    const file = new File(["receipt"], "invalid.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("レシート画像"), file);
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));

    expect(
      await screen.findByText("交換では戻り明細と渡し明細がそれぞれ必要です"),
    ).toBeInTheDocument();
    expect(mockSaveReceiptImage).not.toHaveBeenCalled();
    expect(mockCreateReturn).not.toHaveBeenCalled();
  });

  it("rotates idempotency key when adding an image after a create failure", async () => {
    const user = userEvent.setup();
    mockSaveReceiptImage.mockResolvedValue({
      status: "ok",
      data: { relative_path: "images/receipts/added-after-failure.png" },
    });
    mockCreateReturn
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一時的なエラー", field: null },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: { record_id: 34, created: true, idempotent_replay: false, stock_warnings: [] },
      });

    renderWithClient(<ReturnExchangePage />);
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));
    expect(await screen.findByText("一時的なエラー")).toBeInTheDocument();
    const firstKey = mockCreateReturn.mock.calls[0][0].idempotency_key;

    const file = new File(["receipt"], "added-after-failure.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("レシート画像"), file);
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));

    await waitFor(() => {
      expect(mockCreateReturn).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateReturn.mock.calls[1][0].idempotency_key).not.toBe(firstKey);
    expect(mockCreateReturn.mock.calls[1][0].receipt_image_path).toBe(
      "images/receipts/added-after-failure.png",
    );
  });

  it("hides product registration recovery link while a save is pending", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<Awaited<ReturnType<typeof commands.createReturn>>>();
    mockCreateReturn.mockReturnValue(deferred.promise);

    renderWithClient(<ReturnExchangePage />);
    await addSingleProduct(user);
    mockSearchProducts.mockResolvedValueOnce({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 10 },
    });
    await user.type(screen.getByLabelText("返品・交換商品検索"), "NO-HIT{enter}");

    expect(await screen.findByText("該当する商品がありません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品登録へ進む" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));

    expect(await screen.findByRole("button", { name: "保存中..." })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "商品登録へ進む" })).not.toBeInTheDocument();

    deferred.resolve({
      status: "error",
      error: { kind: "internal", message: "一時的なエラー", field: null },
    });
    expect(await screen.findByText("一時的なエラー")).toBeInTheDocument();
  });

  it("retry after create failure reuses saved receipt path without saving the same image again", async () => {
    const user = userEvent.setup();
    mockSaveReceiptImage.mockResolvedValue({
      status: "ok",
      data: { relative_path: "images/receipts/receipt.png" },
    });
    mockCreateReturn
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一時的なエラー", field: null },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: { record_id: 31, created: true, idempotent_replay: false, stock_warnings: [] },
      });

    renderWithClient(<ReturnExchangePage />);
    await addSingleProduct(user);
    const file = new File(["receipt"], "receipt.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("レシート画像"), file);

    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));
    expect(await screen.findByText("一時的なエラー")).toBeInTheDocument();
    const firstKey = mockCreateReturn.mock.calls[0][0].idempotency_key;
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));

    await waitFor(() => {
      expect(mockCreateReturn).toHaveBeenCalledTimes(2);
    });
    expect(mockSaveReceiptImage).toHaveBeenCalledTimes(1);
    expect(mockCreateReturn.mock.calls[1][0].idempotency_key).toBe(firstKey);
    expect(mockCreateReturn.mock.calls[1][0]).toMatchObject({
      receipt_image_path: "images/receipts/receipt.png",
    });
  });

  it("rotates idempotency key when editing note after a create failure", async () => {
    const user = userEvent.setup();
    mockCreateReturn
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一時的なエラー", field: null },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: { record_id: 35, created: true, idempotent_replay: false, stock_warnings: [] },
      });

    renderWithClient(<ReturnExchangePage />);
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));
    expect(await screen.findByText("一時的なエラー")).toBeInTheDocument();
    const firstKey = mockCreateReturn.mock.calls[0][0].idempotency_key;

    await user.type(screen.getByLabelText("備考"), "備考を追記");
    await user.click(screen.getByRole("button", { name: "返品・交換を保存" }));

    await waitFor(() => {
      expect(mockCreateReturn).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateReturn.mock.calls[1][0].idempotency_key).not.toBe(firstKey);
    expect(mockCreateReturn.mock.calls[1][0].note).toBe("備考を追記");
  });

  it("keeps return rows fixed to return-in direction", async () => {
    const user = userEvent.setup();
    renderWithClient(<ReturnExchangePage />);
    await addSingleProduct(user);

    expect(screen.getByLabelText("追加方向")).toBeDisabled();
    expect(screen.getByLabelText("RT-001 の方向")).toBeDisabled();
    expect(screen.queryByRole("option", { name: "渡し（在庫-）" })).not.toBeInTheDocument();
  });
});
