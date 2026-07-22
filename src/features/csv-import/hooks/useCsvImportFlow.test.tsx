import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands, type ImportResult, type PreviewData, type RollbackResult } from "@/lib/bindings";
import { d052InvalidationOracle, expectExactInvalidations } from "@/test/invalidation-oracle";
import { useCsvImportFlow } from "./useCsvImportFlow";

vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/bindings", () => ({
  commands: {
    parseAndValidateCsv: vi.fn(),
    commitCsvImport: vi.fn(),
    rollbackCsvImport: vi.fn(),
  },
}));

const mockParse = vi.mocked(commands.parseAndValidateCsv);
const mockCommit = vi.mocked(commands.commitCsvImport);
const mockRollback = vi.mocked(commands.rollbackCsvImport);

function makePreview(): PreviewData {
  return {
    file_info: {
      filename: "sales.csv",
      settlement_date: "2026-07-23",
      file_hash: "a".repeat(64),
    },
    matched_summary: { count: 1, total_amount: 500, warnings: [] },
    error_summary: { count: 0, items: [] },
    duplicate_check: { status: "NoDuplicate", existing_import_id: null },
    preview_created_at: "2026-07-23T10:00:00",
  };
}

function makeResult(): ImportResult {
  return {
    csv_import_id: 401,
    status: "completed",
    total_items: 1,
    total_amount: 500,
    skipped_count: 0,
  };
}

function makeRollback(): RollbackResult {
  return { success: true, voided_sale_count: 1, voided_movement_count: 1, stock_corrections: [] };
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function reachResult(result: {
  current: ReturnType<typeof useCsvImportFlow>;
}): Promise<void> {
  const file = new File(["dummy"], "sales.csv", { type: "text/csv" });
  await act(async () => {
    await result.current.selectFile(file);
  });
  await waitFor(() => {
    expect(result.current.state.status).toBe("preview");
  });
  act(() => {
    result.current.confirmImport(false);
  });
  await waitFor(() => {
    expect(result.current.state.status).toBe("result");
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockParse.mockResolvedValue({
    status: "ok",
    data: { preview_data: makePreview(), preview_token: "preview-token" },
  });
  mockCommit.mockResolvedValue({ status: "ok", data: makeResult() });
  mockRollback.mockResolvedValue({ status: "ok", data: makeRollback() });
});

describe("useCsvImportFlow UI-07 D-052-C8/C9", () => {
  it("commit invalidates the exact independent oracle set", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCsvImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await reachResult(result);

    expect(mockCommit).toHaveBeenCalledWith("preview-token", false);
    expectExactInvalidations(invalidateSpy.mock.calls, d052InvalidationOracle.csvImportCommit());
  });

  it("rollback invalidates the same exact independent oracle set", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCsvImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });
    await reachResult(result);
    invalidateSpy.mockClear();

    act(() => {
      result.current.rollback(401);
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe("idle");
    });

    expect(mockRollback).toHaveBeenCalledWith(401);
    expectExactInvalidations(invalidateSpy.mock.calls, d052InvalidationOracle.csvImportRollback());
  });
});
