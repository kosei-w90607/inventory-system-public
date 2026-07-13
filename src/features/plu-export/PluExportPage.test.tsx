import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import { queryKeys } from "@/lib/query-keys";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { PLU_EXPORT_PENDING_STORAGE_KEY, PluExportPage } from "./PluExportPage";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeFile: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    listPluDirty: vi.fn(),
    preparePluExport: vi.fn(),
    confirmPluExportSaved: vi.fn(),
  },
}));

const mockListPluDirty = vi.mocked(commands.listPluDirty);
const mockPreparePluExport = vi.mocked(commands.preparePluExport);
const mockConfirmPluExportSaved = vi.mocked(commands.confirmPluExportSaved);
const mockSave = vi.mocked(save);
const mockWriteFile = vi.mocked(writeFile);
const mockScrollTo = vi.fn();

function installMemoryStorage() {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return entries.size;
    },
    clear: () => {
      entries.clear();
    },
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

function expectStatusRegionBeforeContent() {
  const statusRegion = screen.getByRole("region", { name: "PLU書出し状態" });
  const contentRegion = screen.getByRole("region", { name: "PLU書出し内容" });
  expect(statusRegion.compareDocumentPosition(contentRegion)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  return statusRegion;
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

function mockDefaultCommands() {
  mockListPluDirty.mockResolvedValue({
    status: "ok",
    data: [
      {
        product_code: "PLU-001",
        jan_code: "4900000000001",
        name: "赤い毛糸",
        department_id: 1,
        selling_price: 550,
        cost_price: 300,
        stock_quantity: 12,
        plu_dirty: true,
        plu_exported_at: null,
      },
    ],
  });
  mockPreparePluExport.mockResolvedValue({
    status: "ok",
    data: {
      bytes_base64: "QUJD",
      suggested_filename: "PLU_20260701.txt",
      content_type: "text/tab-separated-values",
      encoding: "CP932",
      count: 1,
      target_product_codes: ["PLU-001"],
      excluded: [],
      over_limit_warning: false,
    },
  });
  mockConfirmPluExportSaved.mockResolvedValue({
    status: "ok",
    data: { updated_count: 1, confirmed_at: "2026-07-01T12:00:00" },
  });
}

beforeEach(() => {
  installMemoryStorage();
  window.localStorage.clear();
  mockListPluDirty.mockReset();
  mockPreparePluExport.mockReset();
  mockConfirmPluExportSaved.mockReset();
  mockSave.mockReset();
  mockWriteFile.mockReset();
  mockScrollTo.mockReset();
  vi.stubGlobal("scrollTo", mockScrollTo);
  mockDefaultCommands();
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("PluExportPage (UI-08 / REQ-402)", () => {
  it("REQ-402 shows JAN codes in the dirty product table", async () => {
    mockListPluDirty.mockResolvedValue({
      status: "ok",
      data: [
        {
          product_code: "PLU-001",
          jan_code: "4900000000001",
          name: "赤い毛糸",
          department_id: 1,
          selling_price: 550,
          cost_price: 300,
          stock_quantity: 12,
          plu_dirty: true,
          plu_exported_at: null,
        },
        {
          product_code: "NO-JAN-001",
          jan_code: null,
          name: "JANなし商品",
          department_id: 1,
          selling_price: 330,
          cost_price: 180,
          stock_quantity: 4,
          plu_dirty: true,
          plu_exported_at: null,
        },
      ],
    });

    renderWithClient(<PluExportPage />);

    expect(await screen.findByRole("columnheader", { name: "JANコード" })).toBeInTheDocument();
    expect(screen.getByText("4900000000001")).toBeInTheDocument();
    expect(screen.getByText("未登録")).toBeInTheDocument();
  });

  it("REQ-402 does not confirm when the save dialog is cancelled", async () => {
    const user = userEvent.setup();
    mockSave.mockResolvedValue(null);

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));

    await waitFor(() => {
      expect(mockPreparePluExport).toHaveBeenCalledWith("diff");
      expect(mockSave).toHaveBeenCalled();
    });
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockConfirmPluExportSaved).not.toHaveBeenCalled();
    expect(await screen.findByText("保存はキャンセルされました")).toBeInTheDocument();
    expect(screen.getByText("未反映商品は残っています。")).toBeInTheDocument();
    expectStatusRegionBeforeContent();
    expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("REQ-402 preserves target products when file save fails", async () => {
    const user = userEvent.setup();
    mockSave.mockResolvedValue("/home/kosei/PLU_20260701.txt");
    mockWriteFile.mockRejectedValue(new Error("write failed"));

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));

    expect(await screen.findByText("PLUファイルを保存できませんでした")).toBeInTheDocument();
    expect(screen.getByText("PCツールへ進む前に、もう一度保存してください。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度保存する" })).toBeEnabled();
    expect(mockConfirmPluExportSaved).not.toHaveBeenCalled();
    expectStatusRegionBeforeContent();
    expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("REQ-402 shows JAN correction guidance when all prepared targets are excluded", async () => {
    const user = userEvent.setup();
    mockPreparePluExport.mockResolvedValue({
      status: "error",
      error: {
        kind: "validation",
        message:
          "PLUファイルに書き出せる商品がありません。商品マスタで13桁JANを確認してください。対象: JAN-NONE（JAN未登録）、JAN-SHORT（JANが13桁ではありません）",
        field: null,
      },
    });

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));

    expect(await screen.findByText("PLU書出しを準備できませんでした")).toBeInTheDocument();
    expect(screen.getByText(/PLUファイルに書き出せる商品がありません/)).toBeInTheDocument();
    expect(screen.getByText(/商品マスタで13桁JANを確認してください/)).toBeInTheDocument();
    expect(screen.getByText(/JAN-NONE/)).toBeInTheDocument();
    expect(screen.getByText(/JAN未登録/)).toBeInTheDocument();
    expect(screen.getByText(/JAN-SHORT/)).toBeInTheDocument();
    expect(screen.getByText(/JANが13桁ではありません/)).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockConfirmPluExportSaved).not.toHaveBeenCalled();
    expectStatusRegionBeforeContent();
  });

  it("REQ-402 confirms only after operator marks saved PLU file exported", async () => {
    const user = userEvent.setup();
    mockSave.mockResolvedValue("/home/kosei/PLU_20260701.txt");
    mockWriteFile.mockResolvedValue(undefined);

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));

    expect(await screen.findByText("PLUファイルを保存しました")).toBeInTheDocument();
    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: "PLU_20260701.txt",
      filters: [{ name: "PLUテキスト", extensions: ["txt"] }],
    });
    expect(mockConfirmPluExportSaved).not.toHaveBeenCalled();
    expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    const statusRegion = expectStatusRegionBeforeContent();
    expect(
      within(statusRegion).getByRole("button", { name: "この書出しを未反映から外す" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "差分を書き出す" })).toHaveAttribute(
      "data-variant",
      "outline",
    );
    expect(
      screen.getAllByText(
        "アプリで確認できるのはPLUファイル保存までです。PCツールへの取込み、SDカード書出し、レジ読込みは手動で確認してください。",
      ).length,
    ).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole("button", { name: "この書出しを未反映から外す" }));

    await waitFor(() => {
      expect(mockConfirmPluExportSaved).toHaveBeenCalledWith(["PLU-001"]);
    });
    expect(await screen.findByText("未反映から外しました")).toBeInTheDocument();
    expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("REQ-402 keeps a saved pending export recovery state without PLU file bytes", async () => {
    const user = userEvent.setup();
    mockSave.mockResolvedValue("/home/kosei/PLU_20260701.txt");
    mockWriteFile.mockResolvedValue(undefined);

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));

    await screen.findByText("PLUファイルを保存しました");
    const rawPending = window.localStorage.getItem(PLU_EXPORT_PENDING_STORAGE_KEY);
    expect(rawPending).toBeTruthy();
    expect(rawPending).not.toContain("QUJD");
    expect(rawPending).not.toContain("bytes_base64");
    expect(JSON.parse(rawPending ?? "{}")).toMatchObject({
      version: 1,
      mode: "diff",
      savedPath: "/home/kosei/PLU_20260701.txt",
      suggestedFilename: "PLU_20260701.txt",
      count: 1,
      encoding: "CP932",
      targetProductCodes: ["PLU-001"],
      overLimitWarning: false,
    });
  });

  it("REQ-402 restores saved pending export after returning to the page", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      PLU_EXPORT_PENDING_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        mode: "diff",
        savedAt: "2026-07-01T12:00:00.000Z",
        savedPath: "/home/kosei/PLU_20260701.txt",
        suggestedFilename: "PLU_20260701.txt",
        count: 1,
        encoding: "CP932",
        targetProductCodes: ["PLU-001"],
        overLimitWarning: false,
      }),
    );

    renderWithClient(<PluExportPage />);

    expect(await screen.findByText("保存済みで未確認のPLU書出しがあります")).toBeInTheDocument();
    const statusRegion = expectStatusRegionBeforeContent();
    expect(
      within(statusRegion).getByText("保存先: /home/kosei/PLU_20260701.txt"),
    ).toBeInTheDocument();
    expect(within(statusRegion).getByText("件数: 1 件")).toBeInTheDocument();
    expect(within(statusRegion).getByText("文字コード: CP932")).toBeInTheDocument();
    await user.click(
      within(statusRegion).getByRole("button", { name: "この書出しを未反映から外す" }),
    );

    await waitFor(() => {
      expect(mockConfirmPluExportSaved).toHaveBeenCalledWith(["PLU-001"]);
    });
    expect(window.localStorage.getItem(PLU_EXPORT_PENDING_STORAGE_KEY)).toBeNull();
  });

  it("REQ-402 lets the operator discard a restored pending export and re-export", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      PLU_EXPORT_PENDING_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        mode: "diff",
        savedAt: "2026-07-01T12:00:00.000Z",
        savedPath: "/home/kosei/PLU_20260701.txt",
        suggestedFilename: "PLU_20260701.txt",
        count: 1,
        encoding: "CP932",
        targetProductCodes: ["PLU-001"],
        overLimitWarning: false,
      }),
    );

    renderWithClient(<PluExportPage />);
    const statusRegion = await screen.findByRole("region", { name: "PLU書出し状態" });

    await user.click(within(statusRegion).getByRole("button", { name: "破棄して再書出し" }));

    expect(window.localStorage.getItem(PLU_EXPORT_PENDING_STORAGE_KEY)).toBeNull();
    expect(mockConfirmPluExportSaved).not.toHaveBeenCalled();
    expect(screen.queryByText("保存済みで未確認のPLU書出しがあります")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "差分を書き出す" })).toHaveAttribute(
      "data-variant",
      "default",
    );
  });

  it("REQ-402 clears an invalid saved pending export recovery state", () => {
    window.localStorage.setItem(PLU_EXPORT_PENDING_STORAGE_KEY, "{invalid");

    renderWithClient(<PluExportPage />);

    expect(screen.queryByText("保存済みで未確認のPLU書出しがあります")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PLU_EXPORT_PENDING_STORAGE_KEY)).toBeNull();
  });

  it("REQ-402 rejects saved pending export recovery state with non-allowed fields", () => {
    window.localStorage.setItem(
      PLU_EXPORT_PENDING_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        mode: "diff",
        savedAt: "2026-07-01T12:00:00.000Z",
        savedPath: "/home/kosei/PLU_20260701.txt",
        suggestedFilename: "PLU_20260701.txt",
        count: 1,
        encoding: "CP932",
        targetProductCodes: ["PLU-001"],
        overLimitWarning: false,
        bytes_base64: "QUJD",
        productName: "赤い毛糸",
        sellingPrice: 550,
      }),
    );

    renderWithClient(<PluExportPage />);

    expect(screen.queryByText("保存済みで未確認のPLU書出しがあります")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PLU_EXPORT_PENDING_STORAGE_KEY)).toBeNull();
  });

  it("REQ-402 shows confirm failure as a destructive top status with retry", async () => {
    const user = userEvent.setup();
    mockSave.mockResolvedValue("/home/kosei/PLU_20260701.txt");
    mockWriteFile.mockResolvedValue(undefined);
    mockConfirmPluExportSaved.mockRejectedValue(new Error("confirm failed"));

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));
    await user.click(await screen.findByRole("button", { name: "この書出しを未反映から外す" }));

    expect(await screen.findByText("未反映から外せませんでした")).toBeInTheDocument();
    const statusRegion = expectStatusRegionBeforeContent();
    expect(within(statusRegion).getByText("confirm failed")).toBeInTheDocument();
    expect(
      within(statusRegion).getByRole("button", { name: "もう一度未反映から外す" }),
    ).toBeEnabled();
    expect(within(statusRegion).queryByText("PLUファイルを保存しました")).not.toBeInTheDocument();
    expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("REQ-402 invalidates PLU and product queries after confirmation", async () => {
    const user = userEvent.setup();
    mockSave.mockResolvedValue("/home/kosei/PLU_20260701.txt");
    mockWriteFile.mockResolvedValue(undefined);

    const { queryClient } = renderWithClient(<PluExportPage />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));
    await user.click(await screen.findByRole("button", { name: "この書出しを未反映から外す" }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.pluDirty() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.productList.root() });
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.dailySales("2026-07-01"),
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.monthlySalesRoot() });
  });

  it("REQ-402 shows full export backup warning and rejects scanning PLU limit overflow", async () => {
    const user = userEvent.setup();
    mockPreparePluExport.mockResolvedValue({
      status: "error",
      error: {
        kind: "ValidationFailed",
        message: "スキャニングPLU上限の4,784件を超えています",
        field: null,
      },
    });

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "全件" }));
    await user.click(screen.getByRole("button", { name: "全件を書き出す" }));

    expect(
      await screen.findByText("全件書出し前にレジ側データのバックアップを確認してください"),
    ).toBeInTheDocument();
    expect(screen.getByText("スキャニングPLU上限の4,784件を超えています")).toBeInTheDocument();
    expect(
      screen.getByText(/SR-S4000のPLU総枠5,000件から通常PLU使用枠を\s*除いた/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度準備する" })).toBeEnabled();
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockConfirmPluExportSaved).not.toHaveBeenCalled();
  });

  it("REQ-402 shows products excluded from PLU export with Japanese reasons", async () => {
    const user = userEvent.setup();
    mockPreparePluExport.mockResolvedValue({
      status: "ok",
      data: {
        bytes_base64: "QUJD",
        suggested_filename: "PLU_20260701.txt",
        content_type: "text/tab-separated-values",
        encoding: "CP932",
        count: 1,
        target_product_codes: ["PLU-001"],
        excluded: [
          {
            product_code: "NO-JAN-001",
            jan_code: null,
            name: "JANなし商品",
            reason: "missing_jan",
          },
          {
            product_code: "BAD-CD-001",
            jan_code: "4901234567890",
            name: "検査桁不正",
            reason: "invalid_check_digit",
          },
        ],
        over_limit_warning: false,
      },
    });

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));

    expect(
      await screen.findByRole("heading", { name: "書出しに含めなかった商品（要修正）" }),
    ).toBeInTheDocument();
    expect(screen.getByText("NO-JAN-001")).toBeInTheDocument();
    expect(screen.getByText("JAN未登録")).toBeInTheDocument();
    expect(screen.getByText("BAD-CD-001")).toBeInTheDocument();
    expect(screen.getByText("JANのチェックディジットが不正です")).toBeInTheDocument();
  });

  it("REQ-402 falls back for unknown excluded reason", async () => {
    const user = userEvent.setup();
    mockPreparePluExport.mockResolvedValue({
      status: "ok",
      data: {
        bytes_base64: "QUJD",
        suggested_filename: "PLU_20260701.txt",
        content_type: "text/tab-separated-values",
        encoding: "CP932",
        count: 1,
        target_product_codes: ["PLU-001"],
        excluded: [
          {
            product_code: "UNKNOWN-001",
            jan_code: "4901234567894",
            name: "未知理由",
            reason: "future_reason",
          },
        ],
        over_limit_warning: false,
      },
    });

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));

    expect(await screen.findByText("UNKNOWN-001")).toBeInTheDocument();
    expect(screen.getByText("要修正（詳細不明）")).toBeInTheDocument();
  });

  it("REQ-402 places the excluded list above the export content section", async () => {
    // UI-08-D10: 要修正一覧は注意情報としてページ上部圏（コンテンツ 2 カラムより前）に集約する
    const user = userEvent.setup();
    mockPreparePluExport.mockResolvedValue({
      status: "ok",
      data: {
        bytes_base64: "QUJD",
        suggested_filename: "PLU_20260701.txt",
        content_type: "text/tab-separated-values",
        encoding: "CP932",
        count: 1,
        target_product_codes: ["PLU-001"],
        excluded: [
          {
            product_code: "NO-JAN-001",
            jan_code: null,
            name: "JANなし商品",
            reason: "missing_jan",
          },
        ],
        over_limit_warning: false,
      },
    });

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));

    const excludedRegion = await screen.findByRole("region", {
      name: "書出しに含めなかった商品",
    });
    const contentRegion = screen.getByRole("region", { name: "PLU書出し内容" });
    expect(excludedRegion.compareDocumentPosition(contentRegion)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      screen.getByText(/これらの商品は今回のPLUファイルに含めていません。/),
    ).toBeInTheDocument();
    // UI-08-D10 L3 P3: 修正対象は JAN だけでなく売価・税率も含む（除外理由と文言を一致させ、後半を強調表示）
    expect(
      screen.getByText(
        "商品マスタでJANコード・売価・税率を修正すると、次回の書出しから含まれます。",
      ),
    ).toBeInTheDocument();
  });

  it("REQ-402 shows the CV17 recovery note as a separate warning alert after save", async () => {
    // UI-08-D10: 事故防止の回復手順は成功 Alert に埋めず、warning トーンの独立 Alert で強調する
    const user = userEvent.setup();
    mockSave.mockResolvedValue("/home/kosei/PLU_20260701.txt");
    mockWriteFile.mockResolvedValue(undefined);

    renderWithClient(<PluExportPage />);
    await user.click(await screen.findByRole("button", { name: "差分を書き出す" }));

    await screen.findByText("PLUファイルを保存しました");
    expect(screen.getByText("PCツールに取り込めなかった場合の回復手順")).toBeInTheDocument();
    expect(
      screen.getByText(
        "PCツールに取り込めなかった場合は、未反映を外さずに全件を書き出し直して取り込んでください。",
      ),
    ).toBeInTheDocument();
  });

  it("REQ-402 shows the CV17 recovery note in the restored pending export alert", async () => {
    // UI-08-D10: PCツール取込み失敗に気づくのは復帰画面のことが多いため、pending recovery にも回復手順を出す
    window.localStorage.setItem(
      PLU_EXPORT_PENDING_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        mode: "diff",
        savedAt: "2026-07-01T12:00:00.000Z",
        savedPath: "/home/kosei/PLU_20260701.txt",
        suggestedFilename: "PLU_20260701.txt",
        count: 1,
        encoding: "CP932",
        targetProductCodes: ["PLU-001"],
        overLimitWarning: false,
      }),
    );

    renderWithClient(<PluExportPage />);

    expect(await screen.findByText("保存済みで未確認のPLU書出しがあります")).toBeInTheDocument();
    const statusRegion = screen.getByRole("region", { name: "PLU書出し状態" });
    expect(
      within(statusRegion).getByText(
        "PCツールに取り込めなかった場合は、未反映を外さずに全件を書き出し直して取り込んでください。",
      ),
    ).toBeInTheDocument();
  });
});
