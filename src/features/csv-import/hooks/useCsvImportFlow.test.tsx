import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBlocker } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import {
  commands,
  CSV_IMPORT_FILE_SIZE_LIMIT,
  type ImportResult,
  type PreviewData,
  type RollbackResult,
} from "@/lib/bindings";
import { d052InvalidationOracle, expectExactInvalidations } from "@/test/invalidation-oracle";
import { useCsvImportFlow } from "./useCsvImportFlow";

vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/bindings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bindings")>();
  return {
    ...actual,
    commands: {
      parseAndValidateCsv: vi.fn(),
      commitCsvImport: vi.fn(),
      rollbackCsvImport: vi.fn(),
    },
  };
});

const mockParse = vi.mocked(commands.parseAndValidateCsv);
const mockCommit = vi.mocked(commands.commitCsvImport);
const mockRollback = vi.mocked(commands.rollbackCsvImport);
// eslint-disable-next-line @typescript-eslint/no-deprecated -- production の現行 hook 配線を spy する。
const mockUseBlocker = vi.mocked(useBlocker);
const mockToast = vi.mocked(toast);

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
  act(() => {
    result.current.selectFile({
      bytes: new Uint8Array([1, 2, 3]),
      filename: "sales.csv",
      size: 3,
    });
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
  it("REQ-401: 上限ちょうどは parse し、上限 +1 は command 前に拒否する", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useCsvImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.selectFile({
        bytes: new Uint8Array([1]),
        filename: "boundary.csv",
        size: CSV_IMPORT_FILE_SIZE_LIMIT,
      });
    });
    await waitFor(() => {
      expect(mockParse).toHaveBeenCalledWith([1], "boundary.csv");
    });

    mockParse.mockClear();
    act(() => {
      result.current.selectFile({
        bytes: new Uint8Array([1]),
        filename: "oversize.csv",
        size: CSV_IMPORT_FILE_SIZE_LIMIT + 1,
      });
    });
    expect(mockParse).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith("ファイルサイズが上限(20MB)を超えています");
  });

  it("REQ-401: parse failure は idle へ復帰可能な error state にする", async () => {
    mockParse.mockResolvedValueOnce({
      status: "error",
      error: {
        kind: "validation",
        message: "合成CSVを解析できません",
        field: "file",
        error_id: null,
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useCsvImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.selectFile({
        bytes: new Uint8Array([0]),
        filename: "invalid.csv",
        size: 1,
      });
    });

    await waitFor(() => {
      expect(result.current.state).toMatchObject({ status: "error", recoverTo: "idle" });
    });
    act(() => {
      result.current.dismissError();
    });
    expect(result.current.state.status).toBe("idle");
  });

  it("REQ-401: import_error commit failure recovers to idle", async () => {
    mockCommit.mockResolvedValueOnce({
      status: "error",
      error: {
        kind: "import_error",
        message: "合成済み preview が見つかりません",
        field: null,
        error_id: null,
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useCsvImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.selectFile({
        bytes: new Uint8Array([1]),
        filename: "sales.csv",
        size: 1,
      });
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe("preview");
    });
    act(() => {
      result.current.confirmImport(false);
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });
    expect(result.current.state).toMatchObject({ status: "error", recoverTo: "idle" });

    act(() => {
      result.current.dismissError();
    });
    expect(result.current.state.status).toBe("idle");
  });

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

  it("REQ-401: commit 中だけ useBlocker と beforeunload を有効化する", async () => {
    let resolveCommit!: (value: Awaited<ReturnType<typeof commands.commitCsvImport>>) => void;
    mockCommit.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCommit = resolve;
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useCsvImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.selectFile({
        bytes: new Uint8Array([1]),
        filename: "sales.csv",
        size: 1,
      });
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe("preview");
    });
    act(() => {
      result.current.confirmImport(false);
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe("importing");
    });

    const blockerOptions = mockUseBlocker.mock.calls[mockUseBlocker.mock.calls.length - 1]?.[0] as
      | {
          shouldBlockFn: () => boolean;
          enableBeforeUnload: boolean | (() => boolean);
        }
      | undefined;
    expect(blockerOptions?.shouldBlockFn()).toBe(true);
    expect(
      typeof blockerOptions?.enableBeforeUnload === "function"
        ? blockerOptions.enableBeforeUnload()
        : blockerOptions?.enableBeforeUnload,
    ).toBe(true);

    resolveCommit({ status: "ok", data: makeResult() });
    await waitFor(() => {
      expect(result.current.state.status).toBe("result");
    });
  });

  it("REQ-401: rollback failure は result を保持し再試行できる", async () => {
    mockRollback.mockResolvedValueOnce({
      status: "error",
      error: {
        kind: "internal",
        message: "合成 rollback failure",
        field: null,
        error_id: null,
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useCsvImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });
    await reachResult(result);

    act(() => {
      result.current.rollback(401);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "取り消しに失敗しました。もう一度お試しください",
      );
    });
    expect(result.current.state.status).toBe("result");
  });
});
