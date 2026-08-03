// src/features/stock-inquiry/hooks/useStockInquiry.test.tsx
//
// REQ-301/302: useStockInquiry の正規化型 + enabled gate + 1 件自動展開検証。
// SPEC-UIBB-3/4/9: page 反映 + 部門候補 listDepartments 化（DSR-10）の検証。
// renderHook + QueryClientProvider（navigate は arg 注入のため Router 不要）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.5 / §58.9

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import { queryKeys } from "@/lib/query-keys";
import { useStockInquiry } from "./useStockInquiry";
import {
  makeMockDepartment,
  makeMockProductWithRelations,
  makeMockStockDetail,
} from "../lib/test-fixtures";

vi.mock("@/lib/bindings", () => ({
  commands: {
    searchProducts: vi.fn(),
    listLowStock: vi.fn(),
    getStockDetail: vi.fn(),
    listDepartments: vi.fn(),
  },
}));

const mockSearch = vi.mocked(commands.searchProducts);
const mockLowStock = vi.mocked(commands.listLowStock);
const mockDetail = vi.mocked(commands.getStockDetail);
const mockListDepartments = vi.mocked(commands.listDepartments);

function makeWrapper(qc?: QueryClient) {
  const client =
    qc ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  mockSearch.mockReset();
  mockLowStock.mockReset();
  mockDetail.mockReset();
  mockListDepartments.mockReset();
  mockListDepartments.mockResolvedValue({ status: "ok", data: [] });
});

describe("useStockInquiry (REQ-301/302)", () => {
  it("REQ-301: search 結果を StockInquiryListResult に正規化（source=search / totalCount）", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "P-001" })],
        total_count: 80,
        page: 1,
        per_page: 50,
      },
    });
    const navigate = vi.fn();
    const { result } = renderHook(
      () =>
        useStockInquiry({
          status: "all",
          q: "毛糸",
          dept: null,
          page: 1,
          selected: null,
          navigate,
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(result.current.listQuery.isSuccess).toBe(true);
    });
    const data = result.current.listQuery.data;
    expect(data?.source).toBe("search");
    expect(data?.totalCount).toBe(80);
    expect(data?.items.map((p) => p.product_code)).toEqual(["P-001"]);
  });

  it("REQ-302: low_stock 結果を配列正規化（source=low_stock / totalCount=null / sub-filter）", async () => {
    mockLowStock.mockResolvedValue({
      status: "ok",
      data: [
        makeMockProductWithRelations({ product_code: "L-001", stock_quantity: 0 }),
        makeMockProductWithRelations({ product_code: "L-002", stock_quantity: 3 }),
      ],
    });
    const navigate = vi.fn();
    const { result } = renderHook(
      () =>
        useStockInquiry({
          status: "stockout",
          q: "",
          dept: null,
          page: 1,
          selected: null,
          navigate,
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(result.current.listQuery.isSuccess).toBe(true);
    });
    const data = result.current.listQuery.data;
    expect(data?.source).toBe("low_stock");
    expect(data?.totalCount).toBeNull();
    // status=stockout の sub-filter で stock<=0 のみ
    expect(data?.items.map((p) => p.product_code)).toEqual(["L-001"]);
  });

  it("REQ-301: status=all + q 空文字は search_products を呼ばない（enabled gate / isAllEmpty）", async () => {
    const navigate = vi.fn();
    const { result } = renderHook(
      () =>
        useStockInquiry({ status: "all", q: "", dept: null, page: 1, selected: null, navigate }),
      { wrapper: makeWrapper() },
    );
    expect(result.current.isAllEmpty).toBe(true);
    // enabled=false のため fetch されない
    await waitFor(() => {
      expect(result.current.listQuery.fetchStatus).toBe("idle");
    });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("SPEC-UIBB-3/4: page が queryKey とクエリ引数に反映される", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "P-001" })],
        total_count: 60,
        page: 2,
        per_page: 50,
      },
    });
    const navigate = vi.fn();
    const { result } = renderHook(
      () =>
        useStockInquiry({
          status: "all",
          q: "毛糸",
          dept: null,
          page: 2,
          selected: null,
          navigate,
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(result.current.listQuery.isSuccess).toBe(true);
    });
    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("REQ-301: 結果 1 件で詳細カード自動展開（navigate に selected 渡し）", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "SOLO-1" })],
        total_count: 1,
        page: 1,
        per_page: 50,
      },
    });
    const navigate = vi.fn();
    renderHook(
      () =>
        useStockInquiry({
          status: "all",
          q: "SOLO",
          dept: null,
          page: 1,
          selected: null,
          navigate,
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ selected: "SOLO-1" });
    });
  });

  it("REQ-301: selected 既存時は 1 件でも自動展開しない（重複発火回避）", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "SOLO-1" })],
        total_count: 1,
        page: 1,
        per_page: 50,
      },
    });
    mockDetail.mockResolvedValue({ status: "ok", data: makeMockStockDetail() });
    const navigate = vi.fn();
    const { result } = renderHook(
      () =>
        useStockInquiry({
          status: "all",
          q: "SOLO",
          dept: null,
          page: 1,
          selected: "SOLO-1",
          navigate,
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(result.current.listQuery.isSuccess).toBe(true);
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("REQ-301: detail query は list と独立（部分障害許容、detail 失敗でも list 成功）", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "P-001" })],
        total_count: 1,
        page: 1,
        per_page: 50,
      },
    });
    mockDetail.mockResolvedValue({
      status: "error",
      error: { kind: "not_found", message: "商品が見つかりません", field: null, error_id: null },
    });
    const navigate = vi.fn();
    const { result } = renderHook(
      () =>
        useStockInquiry({
          status: "all",
          q: "P",
          dept: null,
          page: 1,
          selected: "P-001",
          navigate,
        }),
      { wrapper: makeWrapper() },
    );
    // hook の retry:1（backoff ~1s）を待つため timeout 拡張
    await waitFor(
      () => {
        expect(result.current.detailQuery.isError).toBe(true);
      },
      { timeout: 5000 },
    );
    // detail 失敗でも list は成功（部分障害許容）
    expect(result.current.listQuery.isSuccess).toBe(true);
  });

  it("REQ-301: list 成功時に selected が現 list に不在なら clear（navigate selected:undefined、C-P2-1）", async () => {
    // stale/手打ち URL 相当: 現 list（P-001/P-002）に存在しない selected を渡す。
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          makeMockProductWithRelations({ product_code: "P-001" }),
          makeMockProductWithRelations({ product_code: "P-002" }),
        ],
        total_count: 2,
        page: 1,
        per_page: 50,
      },
    });
    mockDetail.mockResolvedValue({ status: "ok", data: makeMockStockDetail() });
    const navigate = vi.fn();
    renderHook(
      () =>
        useStockInquiry({
          status: "all",
          q: "P",
          dept: null,
          page: 1,
          selected: "STALE-999",
          navigate,
        }),
      { wrapper: makeWrapper() },
    );
    // list 成功後、selected が items に不在なので clear（複数件のため自動展開は発火しない）
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ selected: undefined });
    });
  });

  it("REQ-301: 検索前（status=all + q 空）に selected 付き URL → clear + detail 走らせない（Codex Round1 P2-2）", async () => {
    // isAllEmpty（list は EmptySearchPlaceholder）なのに selected 付き手打ち/F5/bookmark URL のケース。
    const navigate = vi.fn();
    renderHook(
      () =>
        useStockInquiry({
          status: "all",
          q: "", // isAllEmpty = true
          dept: null,
          page: 1,
          selected: "STALE-1",
          navigate,
        }),
      { wrapper: makeWrapper() },
    );
    // isAllEmpty + selected → clear
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ selected: undefined });
    });
    // list も detail も走らせない（enabled = false、detail 空振り防止）
    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockDetail).not.toHaveBeenCalled();
  });

  describe("SPEC-UIBB-9（部門候補 = listDepartments master 全件、DSR-10）", () => {
    it("部門候補は listDepartments 全件で page/q/dept/status の 4 条件に依存しない", async () => {
      mockListDepartments.mockResolvedValue({
        status: "ok",
        data: [
          makeMockDepartment({ id: 1, name: "毛糸" }),
          makeMockDepartment({ id: 2, name: "布" }),
        ],
      });
      mockSearch.mockResolvedValue({
        status: "ok",
        data: {
          items: [makeMockProductWithRelations({ product_code: "P-001", department_id: 1 })],
          total_count: 1,
          page: 1,
          per_page: 50,
        },
      });
      mockLowStock.mockResolvedValue({ status: "ok", data: [] });
      const navigate = vi.fn();
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
      });
      const { result, rerender } = renderHook(
        (args: Parameters<typeof useStockInquiry>[0]) => useStockInquiry(args),
        {
          wrapper: makeWrapper(qc),
          initialProps: { status: "all", q: "", dept: null, page: 1, selected: null, navigate },
        },
      );
      await waitFor(() => {
        expect(result.current.departmentOptionsQuery.isSuccess).toBe(true);
      });
      const expected = [
        { id: 1, name: "毛糸" },
        { id: 2, name: "布" },
      ];
      expect(result.current.departmentOptions).toEqual(expected);

      // page を変更
      rerender({ status: "all", q: "", dept: null, page: 2, selected: null, navigate });
      // q を変更
      rerender({ status: "all", q: "毛糸", dept: null, page: 2, selected: null, navigate });
      // dept を選択
      rerender({ status: "all", q: "毛糸", dept: 1, page: 2, selected: null, navigate });
      // status を変更（all → low_stock → stockout）
      rerender({ status: "low_stock", q: "毛糸", dept: 1, page: 2, selected: null, navigate });
      rerender({ status: "stockout", q: "毛糸", dept: 1, page: 2, selected: null, navigate });

      await waitFor(() => {
        expect(result.current.departmentOptions).toEqual(expected);
      });
      // query key 安定性の mutant 検出（round 2 P2-3）: 4 条件変更後も listDepartments は 1 回のみ
      expect(mockListDepartments).toHaveBeenCalledTimes(1);
    });

    it("選択中部門から別部門へ直接切替できる候補が維持される", async () => {
      mockListDepartments.mockResolvedValue({
        status: "ok",
        data: [
          makeMockDepartment({ id: 1, name: "毛糸" }),
          makeMockDepartment({ id: 2, name: "布" }),
        ],
      });
      mockSearch.mockResolvedValue({
        status: "ok",
        data: { items: [], total_count: 0, page: 1, per_page: 50 },
      });
      const navigate = vi.fn();
      const { result } = renderHook(
        () =>
          useStockInquiry({ status: "all", q: "糸", dept: 1, page: 1, selected: null, navigate }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => {
        expect(result.current.departmentOptions).toEqual([
          { id: 1, name: "毛糸" },
          { id: 2, name: "布" },
        ]);
      });
      // dept=1 選択中でも他部門（id=2）が候補から消えていない
      expect(result.current.departmentOptions.some((option) => option.id === 2)).toBe(true);
    });
  });

  describe("query-keys unit（round 2 P1-1）", () => {
    it("SPEC-UIBB-9: departmentOptionsは無引数で一定keyを返す", () => {
      const key1 = queryKeys.stockInquiry.departmentOptions();
      const key2 = queryKeys.stockInquiry.departmentOptions();
      expect(key1).toEqual(["stock-inquiry", "department-options"]);
      expect(key2).toEqual(key1);
    });
  });
});
