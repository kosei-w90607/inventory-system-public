// src/features/backup-restore/BackupRestorePage.flow.test.tsx
//
// UI-11b-D11 (batch A packet, SPEC-UIPOLA-D1): 復元成功通知の producer
// (BackupRestorePage) → consumer (ホーム画面) を実 Router + memory history で結線する
// 統合テスト。Matrix C5-C8 に対応。in-memory one-shot flag の寿命契約
// (mount 時取り込み・mount 中表示維持・非表示は unmount 後の再訪/reload/失敗経路のみ) を検証する。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { commands } from "@/lib/bindings";
import type {
  AppSetting,
  BackupInfo,
  CmdErrorKind,
  CsvImport,
  DailySalesReport,
  PaginatedResult,
  ProductResponse,
  ProductWithRelations,
} from "@/lib/bindings";
import { open } from "@tauri-apps/plugin-dialog";
import { clearRestoreSuccessPending } from "@/lib/restore-success-notification";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ setTitle: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@/lib/bindings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bindings")>();
  return {
    ...actual,
    commands: {
      // backup-restore (producer)
      getSettings: vi.fn(),
      updateSetting: vi.fn(),
      createBackup: vi.fn(),
      checkAutoBackup: vi.fn(),
      listBackups: vi.fn(),
      getEffectiveBackupDir: vi.fn(),
      restoreBackup: vi.fn(),
      // home (consumer)
      getDailySales: vi.fn(),
      listLowStock: vi.fn(),
      listPluDirty: vi.fn(),
      listCsvImports: vi.fn(),
    },
  };
});

const mockGetSettings = vi.mocked(commands.getSettings);
const mockCreateBackup = vi.mocked(commands.createBackup);
const mockCheckAutoBackup = vi.mocked(commands.checkAutoBackup);
const mockListBackups = vi.mocked(commands.listBackups);
const mockGetEffectiveBackupDir = vi.mocked(commands.getEffectiveBackupDir);
const mockRestoreBackup = vi.mocked(commands.restoreBackup);
const mockOpen = vi.mocked(open);

const mockGetDailySales = vi.mocked(commands.getDailySales);
const mockListLowStock = vi.mocked(commands.listLowStock);
const mockListPluDirty = vi.mocked(commands.listPluDirty);
const mockListCsvImports = vi.mocked(commands.listCsvImports);

function ok<T>(data: T) {
  return { status: "ok" as const, data };
}

function cmdError(message: string, kind: CmdErrorKind = "internal") {
  return {
    status: "error" as const,
    error: { kind, message, field: null, error_id: null },
  };
}

const BACKUP_DATE_LABEL = "7月3日 21:00";

function makeBackupInfo(): BackupInfo {
  return {
    file_name: "inventory_backup_20260703_210000.db",
    file_path: "/tmp/backups/inventory_backup_20260703_210000.db",
    size_bytes: 12_400_000,
    created_at: "2026-07-03 21:00:00",
  };
}

function makeAppSettings(): AppSetting[] {
  return [
    { key: "backup_enabled", value: "1", updated_at: "2026-07-06T00:00:00" },
    { key: "backup_time", value: "23:00", updated_at: "2026-07-06T00:00:00" },
    { key: "backup_path", value: "/tmp/backups", updated_at: "2026-07-06T00:00:00" },
    { key: "backup_retention_days", value: "3", updated_at: "2026-07-06T00:00:00" },
  ];
}

function makeDailySales(): DailySalesReport {
  return {
    date: "2026-07-28",
    items: [],
    department_subtotals: [],
    grand_total: { quantity: 0, amount: 0 },
    official_daily_report: null,
  };
}

function makeProduct(productCode: string, stockQuantity: number): ProductWithRelations {
  return {
    product_code: productCode,
    jan_code: null,
    name: `synthetic-${productCode}`,
    department_id: 1,
    supplier_id: null,
    selling_price: 100,
    cost_price: 50,
    tax_rate: "10",
    maker_code: null,
    stock_quantity: stockQuantity,
    stock_unit: "pcs",
    is_discontinued: false,
    plu_dirty: false,
    plu_exported_at: null,
    plu_target: false,
    pos_stock_sync: true,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    department_name: "synthetic-department",
    supplier_name: null,
  };
}

function makePluDirty(): ProductResponse {
  return {
    product_code: "PLU-1",
    jan_code: null,
    name: "synthetic-PLU-1",
    department_id: 1,
    selling_price: 100,
    cost_price: 50,
    stock_quantity: 1,
    plu_dirty: true,
    plu_exported_at: null,
  };
}

function csvPage(items: CsvImport[]): PaginatedResult<CsvImport> {
  return { items, total_count: items.length, page: 1, per_page: 1 };
}

function installDefaultCommands() {
  mockGetSettings.mockResolvedValue(ok(makeAppSettings()));
  mockListBackups.mockResolvedValue(ok([makeBackupInfo()]));
  mockCreateBackup.mockResolvedValue(
    ok({
      file_name: "inventory_backup_20260706_100000.db",
      file_path: "/tmp/backups/inventory_backup_20260706_100000.db",
      size_bytes: 10_000_000,
    }),
  );
  mockCheckAutoBackup.mockResolvedValue(ok(false));
  mockGetEffectiveBackupDir.mockResolvedValue(ok("/tmp/backups"));
  mockOpen.mockResolvedValue(null);

  mockGetDailySales.mockResolvedValue(ok(makeDailySales()));
  mockListLowStock.mockResolvedValue(ok([makeProduct("OUT", 0)]));
  mockListPluDirty.mockResolvedValue(ok([makePluDirty()]));
  mockListCsvImports.mockResolvedValue(ok(csvPage([])));
}

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  const utils = render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return { router, queryClient, ...utils };
}

async function driveToRestoreSuccess(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { name: "バックアップ・復元" });
  const backupDate = await screen.findByText(BACKUP_DATE_LABEL);
  const row = backupDate.closest("tr");
  expect(row).not.toBeNull();
  if (!row) throw new Error("backup row not found");
  await user.click(within(row).getByRole("button", { name: "この控えに戻す" }));
  await user.click(screen.getByRole("button", { name: "復元の確認へ進む" }));
  await screen.findByRole("alertdialog", { name: "元に戻せません" });
  await user.click(screen.getByRole("button", { name: `${BACKUP_DATE_LABEL} の控えに戻す` }));
}

beforeEach(() => {
  vi.clearAllMocks();
  clearRestoreSuccessPending();
  installDefaultCommands();
});

describe("復元成功 Alert 統合テスト (UI-11b-D11, Matrix C5/C6)", () => {
  it("test_ui11b_d11_restore_success_shows_alert_exactly_once_under_strictmode", async () => {
    const user = userEvent.setup();
    mockRestoreBackup.mockResolvedValue(ok(null));

    renderApp("/settings/backup");
    await driveToRestoreSuccess(user);

    await waitFor(() => {
      expect(screen.getByText(/昨日の売上/)).toBeInTheDocument();
    });
    expect(screen.getAllByText("バックアップから復元しました")).toHaveLength(1);
  });

  it("test_ui11b_d11_alert_survives_same_mount_rerender", async () => {
    const user = userEvent.setup();
    mockRestoreBackup.mockResolvedValue(ok(null));

    const { queryClient } = renderApp("/settings/backup");
    await driveToRestoreSuccess(user);
    await screen.findByText("バックアップから復元しました");

    // ホーム到達後の query 更新 (他 query 更新を模した re-render) を発生させる。
    mockListLowStock.mockResolvedValue(ok([makeProduct("OUT", 0), makeProduct("LOW", 3)]));
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    await waitFor(() => {
      expect(screen.getAllByText("バックアップから復元しました")).toHaveLength(1);
    });
  });

  it("test_ui11b_d11_alert_hidden_after_unmount_revisit", async () => {
    const user = userEvent.setup();
    mockRestoreBackup.mockResolvedValue(ok(null));

    const { router } = renderApp("/settings/backup");
    await driveToRestoreSuccess(user);
    await screen.findByText("バックアップから復元しました");

    // unmount 後の再訪: 別画面へ遷移してからホームへ戻る。
    await act(async () => {
      await router.navigate({ to: "/settings/backup" });
    });
    await screen.findByRole("heading", { name: "バックアップ・復元" });

    await act(async () => {
      await router.navigate({ to: "/" });
    });

    await waitFor(() => {
      expect(screen.getByText(/昨日の売上/)).toBeInTheDocument();
    });
    expect(screen.queryByText("バックアップから復元しました")).not.toBeInTheDocument();
  });

  it("test_ui11b_d11_alert_hidden_after_store_reset_reload_substitute", async () => {
    const user = userEvent.setup();
    mockRestoreBackup.mockResolvedValue(ok(null));

    const first = renderApp("/settings/backup");
    await driveToRestoreSuccess(user);
    await screen.findByText("バックアップから復元しました");

    // reload / アプリ再起動の代替 (Matrix Residual Test Gaps): 旧 DOM を破棄し
    // module-scope flag を明示 reset した状態で新規マウントする (reload 相当)。
    first.unmount();
    clearRestoreSuccessPending();

    const { router: router2 } = renderApp("/");
    await waitFor(() => {
      expect(screen.getAllByText(/昨日の売上/)).not.toHaveLength(0);
    });
    expect(router2.state.location.pathname).toBe("/");
    expect(screen.queryByText("バックアップから復元しました")).not.toBeInTheDocument();
  });
});

describe("復元成功 Alert negative パス (UI-11b-D11, Matrix C7/C8)", () => {
  it("test_ui11b_d11_no_flag_direct_home_visit_shows_no_alert", async () => {
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByText(/昨日の売上/)).toBeInTheDocument();
    });
    expect(screen.queryByText("バックアップから復元しました")).not.toBeInTheDocument();
  });

  it("test_ui11b_d11_restore_failure_then_normal_home_navigation_shows_no_alert", async () => {
    const user = userEvent.setup();
    mockRestoreBackup.mockResolvedValueOnce(
      cmdError("復元対象のファイルを読み込めませんでした", "restore_failed_recovered"),
    );

    const { router } = renderApp("/settings/backup");
    await screen.findByRole("heading", { name: "バックアップ・復元" });
    const backupDate = await screen.findByText(BACKUP_DATE_LABEL);
    const row = backupDate.closest("tr");
    expect(row).not.toBeNull();
    if (!row) throw new Error("backup row not found");
    await user.click(within(row).getByRole("button", { name: "この控えに戻す" }));
    await user.click(screen.getByRole("button", { name: "復元の確認へ進む" }));
    await screen.findByRole("alertdialog", { name: "元に戻せません" });
    await user.click(screen.getByRole("button", { name: `${BACKUP_DATE_LABEL} の控えに戻す` }));

    // 復元失敗表示のまま (flag 非生成、ホームへは遷移しない)。
    expect(
      await screen.findByText(
        "バックアップの復元に失敗しました。現在のデータには戻しています。もう一度お試しください。",
      ),
    ).toBeInTheDocument();

    // operator が通常操作でホームへ遷移しても Alert は出ない。
    await act(async () => {
      await router.navigate({ to: "/" });
    });

    await waitFor(() => {
      expect(screen.getByText(/昨日の売上/)).toBeInTheDocument();
    });
    expect(screen.queryByText("バックアップから復元しました")).not.toBeInTheDocument();
  });
});
