import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { commands } from "@/lib/bindings";
import type {
  DailyReportImportResult,
  DailyReportPreviewData,
  DailyReportRollbackResult,
} from "@/lib/bindings";
import { queryKeys } from "@/lib/query-keys";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  DAILY_REPORT_LAST_DIR_STORAGE_KEY,
  useDailyReportImportFlow,
} from "./useDailyReportImportFlow";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    parseAndValidateDailyReport: vi.fn(),
    commitDailyReportImport: vi.fn(),
    rollbackDailyReportImport: vi.fn(),
  },
}));

const mockParse = vi.mocked(commands.parseAndValidateDailyReport);
const mockCommit = vi.mocked(commands.commitDailyReportImport);
const mockRollback = vi.mocked(commands.rollbackDailyReportImport);
const mockToast = vi.mocked(toast);
const mockOpen = vi.mocked(open);
const mockReadFile = vi.mocked(readFile);

function makePreview(): DailyReportPreviewData {
  return {
    file_info: {
      report_date: "2026-03-21",
      bundle_hash: "a".repeat(64),
      source_files: [
        { source: "Z001", filename: "Z001_260321.CSV", file_hash: "1".repeat(64), size_bytes: 10 },
        { source: "Z002", filename: "Z002_260321.CSV", file_hash: "2".repeat(64), size_bytes: 10 },
        { source: "Z005", filename: "Z005_260321.CSV", file_hash: "3".repeat(64), size_bytes: 10 },
      ],
    },
    totals: { gross_amount: 12000, net_amount: 11000 },
    payment_summary: [
      { payment_key: "cash", label: "現金", amount: 11000, count: 7, sort_order: 1 },
    ],
    department_summary: [
      {
        department_id: 1,
        raw_department_name: "毛糸",
        normalized_department_name: "毛糸",
        amount: 8000,
        quantity: 5,
        count: 3,
        sort_order: 1,
      },
    ],
    warnings: [],
    duplicate_check: { status: "NoDuplicate", existing_import_id: null },
    preview_created_at: "2026-03-21T10:00:00",
  };
}

function makeResult(): DailyReportImportResult {
  return {
    daily_report_import_id: 501,
    status: "completed",
    report_date: "2026-03-21",
    gross_amount: 12000,
    net_amount: 11000,
    warning_count: 0,
  };
}

function makeRollback(): DailyReportRollbackResult {
  return {
    daily_report_import_id: 501,
    status: "rolled_back",
    rolled_back_at: "2026-03-21T10:05:00",
  };
}

function makeFile(name: string) {
  return new File(["synthetic"], name, { type: "text/csv" });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

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

function installThrowingStorage() {
  const storage = {
    get length() {
      return 0;
    },
    clear: () => {
      throw new Error("storage denied");
    },
    getItem: () => {
      throw new Error("storage denied");
    },
    key: () => null,
    removeItem: () => {
      throw new Error("storage denied");
    },
    setItem: () => {
      throw new Error("storage denied");
    },
  } as Storage;
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockParse.mockResolvedValue({
    status: "ok",
    data: { preview_data: makePreview(), preview_token: "preview-token-req401" },
  });
  mockCommit.mockResolvedValue({ status: "ok", data: makeResult() });
  mockRollback.mockResolvedValue({ status: "ok", data: makeRollback() });
  mockOpen.mockReset();
  mockReadFile.mockReset();
  mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  installMemoryStorage();
});

describe("useDailyReportImportFlow_req401", () => {
  it.each([
    ["1 file", [makeFile("Z001_260321.CSV")]],
    ["2 files", [makeFile("Z001_260321.CSV"), makeFile("Z002_260321.CSV")]],
    [
      "4 files",
      [
        makeFile("Z001_260321.CSV"),
        makeFile("Z002_260321.CSV"),
        makeFile("Z005_260321.CSV"),
        makeFile("Z005_duplicate_260321.CSV"),
      ],
    ],
  ])("REQ-401: rejects %s before parse", async (_label, files) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.selectFiles(files);
    });

    expect(mockParse).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith("Z001/Z002/Z005 の3ファイルを選択してください");
    expect(result.current.state.lastSelectionError).toBe(
      `Z001/Z002/Z005 の3ファイルを選択してください（選択されたのは${String(files.length)}ファイルです）`,
    );
  });

  it("REQ-401: native dialog cancellation does not change state or parse", async () => {
    mockOpen.mockResolvedValue(null);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.chooseFiles();
    });

    expect(mockOpen).toHaveBeenCalledWith({
      multiple: true,
      defaultPath: undefined,
      filters: [{ name: "CSV", extensions: ["csv", "CSV"] }],
    });
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockParse).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.lastSelectionError).toBeNull();
  });

  it("REQ-401: remembers the selected folder and reopens the dialog from it", async () => {
    mockOpen.mockResolvedValue([
      "C:\\CASIO\\XZ\\2026\\07\\Z001_260321.CSV",
      "C:\\CASIO\\XZ\\2026\\07\\Z002_260321.CSV",
      "C:\\CASIO\\XZ\\2026\\07\\Z005_260321.CSV",
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.chooseFiles();
    });

    expect(mockOpen).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: undefined }));
    expect(window.localStorage.getItem(DAILY_REPORT_LAST_DIR_STORAGE_KEY)).toBe(
      "C:\\CASIO\\XZ\\2026\\07",
    );

    await act(async () => {
      await result.current.chooseFiles();
    });

    expect(mockOpen).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultPath: "C:\\CASIO\\XZ\\2026\\07" }),
    );
  });

  it("REQ-401: keeps the browsed folder even when the selection count is wrong", async () => {
    mockOpen.mockResolvedValue(["C:\\tmp\\Z001_260321.CSV", "C:\\tmp\\Z002_260321.CSV"]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.chooseFiles();
    });

    expect(window.localStorage.getItem(DAILY_REPORT_LAST_DIR_STORAGE_KEY)).toBe("C:\\tmp");
    expect(result.current.state.lastSelectionError).toBe(
      "Z001/Z002/Z005 の3ファイルを選択してください（選択されたのは2ファイルです）",
    );
  });

  it("REQ-401: selection flow continues when localStorage is unavailable", async () => {
    installThrowingStorage();
    mockOpen.mockResolvedValue([
      "C:\\tmp\\Z001_260321.CSV",
      "C:\\tmp\\Z002_260321.CSV",
      "C:\\tmp\\Z005_260321.CSV",
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.chooseFiles();
    });

    expect(result.current.state.lastSelectionError).toBeNull();
    await waitFor(() => {
      expect(mockParse).toHaveBeenCalledTimes(1);
    });
  });

  it("REQ-401: native dialog rejects fewer than 3 files without parsing", async () => {
    mockOpen.mockResolvedValue(["C:\\tmp\\Z001_260321.CSV", "C:\\tmp\\Z002_260321.CSV"]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.chooseFiles();
    });

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockParse).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith("Z001/Z002/Z005 の3ファイルを選択してください");
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.lastSelectionError).toBe(
      "Z001/Z002/Z005 の3ファイルを選択してください（選択されたのは2ファイルです）",
    );
  });

  it("REQ-401: native dialog read failure stays idle without unhandled parsing", async () => {
    mockOpen.mockResolvedValue([
      "C:\\tmp\\Z001_260321.CSV",
      "C:\\tmp\\Z002_260321.CSV",
      "C:\\tmp\\Z005_260321.CSV",
    ]);
    mockReadFile.mockRejectedValue(new Error("read denied"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.chooseFiles();
    });

    expect(mockParse).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith("日報ファイルの選択または読み取りに失敗しました");
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.lastSelectionError).toBe(
      "日報ファイルの選択または読み取りに失敗しました",
    );
  });

  it("REQ-401: native dialog reads 3 files and parses them", async () => {
    mockOpen.mockResolvedValue([
      "C:\\tmp\\Z001_260321.CSV",
      "C:\\tmp\\Z002_260321.CSV",
      "C:\\tmp\\Z005_260321.CSV",
    ]);
    mockReadFile
      .mockResolvedValueOnce(new Uint8Array([1]))
      .mockResolvedValueOnce(new Uint8Array([2]))
      .mockResolvedValueOnce(new Uint8Array([5]));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.chooseFiles();
    });

    expect(mockReadFile).toHaveBeenCalledTimes(3);
    await waitFor(() => {
      expect(result.current.state.status).toBe("preview");
    });
    expect(result.current.state.lastSelectionError).toBeNull();
    expect(mockParse).toHaveBeenCalledWith([
      { filename: "Z001_260321.CSV", file_bytes: [1] },
      { filename: "Z002_260321.CSV", file_bytes: [2] },
      { filename: "Z005_260321.CSV", file_bytes: [5] },
    ]);
  });

  it("REQ-401: commit invalidates daily report and sales caches without invalidating Z004 csv import lists", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.selectFiles([
        makeFile("Z001_260321.CSV"),
        makeFile("Z002_260321.CSV"),
        makeFile("Z005_260321.CSV"),
      ]);
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

    expect(mockCommit).toHaveBeenCalledWith("preview-token-req401", false);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dailyReportImportLists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-sales"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.monthlySalesRoot() });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.csvImportLists() });
  });

  it("REQ-401: rollback invalidates the same daily report and sales caches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDailyReportImportFlow(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.selectFiles([
        makeFile("Z001_260321.CSV"),
        makeFile("Z002_260321.CSV"),
        makeFile("Z005_260321.CSV"),
      ]);
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

    act(() => {
      result.current.rollback(501);
    });
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("日報取込みを取り消しました");
    });

    expect(mockRollback).toHaveBeenCalledWith(501);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dailyReportImportLists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-sales"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.monthlySalesRoot() });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.csvImportLists() });
  });
});
