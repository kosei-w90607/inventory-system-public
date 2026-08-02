import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "sonner";
import { commands } from "@/lib/bindings";
import type { CmdErrorKind } from "@/lib/bindings";
import { open } from "@tauri-apps/plugin-dialog";
import {
  clearRestoreSuccessPending,
  consumeRestoreSuccessPending,
} from "@/lib/restore-success-notification";
import { BackupRestorePage } from "./BackupRestorePage";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    getSettings: vi.fn(),
    updateSetting: vi.fn(),
    createBackup: vi.fn(),
    checkAutoBackup: vi.fn(),
    listBackups: vi.fn(),
    getEffectiveBackupDir: vi.fn(),
    restoreBackup: vi.fn(),
  },
}));

const mockGetSettings = vi.mocked(commands.getSettings);
const mockUpdateSetting = vi.mocked(commands.updateSetting);
const mockCreateBackup = vi.mocked(commands.createBackup);
const mockCheckAutoBackup = vi.mocked(commands.checkAutoBackup);
const mockListBackups = vi.mocked(commands.listBackups);
const mockGetEffectiveBackupDir = vi.mocked(commands.getEffectiveBackupDir);
const mockRestoreBackup = vi.mocked(commands.restoreBackup);
const mockOpen = vi.mocked(open);
const mockToastSuccess = vi.mocked(toast.success);

function ok<T>(data: T) {
  return { status: "ok" as const, data };
}

function cmdError(message: string, kind: CmdErrorKind = "internal", errorId: string | null = null) {
  return {
    status: "error" as const,
    error: { kind, message, field: null, error_id: errorId },
  };
}

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const clearSpy = vi.spyOn(queryClient, "clear");
  return {
    queryClient,
    clearSpy,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

function mockDefaultCommands() {
  mockGetSettings.mockResolvedValue(
    ok([
      { key: "backup_enabled", value: "1", updated_at: "2026-07-06T00:00:00" },
      { key: "backup_time", value: "23:00", updated_at: "2026-07-06T00:00:00" },
      { key: "backup_path", value: "/tmp/backups", updated_at: "2026-07-06T00:00:00" },
      { key: "backup_retention_days", value: "3", updated_at: "2026-07-06T00:00:00" },
    ]),
  );
  mockListBackups.mockResolvedValue(
    ok([
      {
        file_name: "inventory_backup_20260703_210000.db",
        file_path: "/tmp/backups/inventory_backup_20260703_210000.db",
        size_bytes: 12_400_000,
        created_at: "2026-07-03 21:00:00",
      },
    ]),
  );
  mockCreateBackup.mockResolvedValue(
    ok({
      file_name: "inventory_backup_20260706_100000.db",
      file_path: "/tmp/backups/inventory_backup_20260706_100000.db",
      size_bytes: 10_000_000,
    }),
  );
  mockUpdateSetting.mockResolvedValue(ok(null));
  mockCheckAutoBackup.mockResolvedValue(ok(false));
  mockGetEffectiveBackupDir.mockResolvedValue(ok("/tmp/backups"));
  mockRestoreBackup.mockResolvedValue(ok(null));
  mockOpen.mockResolvedValue(null);
}

async function openRestoreDetail(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { name: "バックアップ・復元" });
  const backupDate = await screen.findByText("7月3日 21:00");
  const row = backupDate.closest("tr");
  expect(row).not.toBeNull();
  if (!row) throw new Error("backup row not found");
  await user.click(within(row).getByRole("button", { name: "この控えに戻す" }));
  expect(
    screen.getByText("この時点の状態に戻ります。この控えより後に記録した内容は消えます"),
  ).toBeInTheDocument();
}

async function startRestoreConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await openRestoreDetail(user);
  await user.click(screen.getByRole("button", { name: "復元の確認へ進む" }));
}

beforeEach(() => {
  vi.useRealTimers();
  mockNavigate.mockReset();
  mockGetSettings.mockReset();
  mockUpdateSetting.mockReset();
  mockCreateBackup.mockReset();
  mockCheckAutoBackup.mockReset();
  mockListBackups.mockReset();
  mockGetEffectiveBackupDir.mockReset();
  mockRestoreBackup.mockReset();
  mockOpen.mockReset();
  mockToastSuccess.mockReset();
  mockDefaultCommands();
  clearRestoreSuccessPending();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("BackupRestorePage (UI-11b / QR-05 / REQ-905)", () => {
  it("QR-05 REQ-905 shows break-glass only when pre-restore backup fails", async () => {
    const user = userEvent.setup();
    mockCreateBackup.mockResolvedValueOnce(cmdError("保存先にバックアップを作成できませんでした"));

    renderWithClient(<BackupRestorePage />);
    await startRestoreConfirmation(user);

    expect(mockRestoreBackup).not.toHaveBeenCalled();
    expect(screen.getByText("復元前のバックアップを作成できませんでした")).toBeInTheDocument();

    const proceed = screen.getByRole("button", { name: "最終確認へ進む" });
    expect(proceed).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", { name: "今の状態は保存できませんが、復元を続けます" }),
    );
    expect(proceed).toBeEnabled();

    await user.click(proceed);
    expect(screen.getByRole("alertdialog", { name: "元に戻せません" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" })).toBeEnabled();
  });

  it("QR-05 REQ-905 treats recovered restore failure as retryable", async () => {
    const user = userEvent.setup();
    mockRestoreBackup.mockResolvedValueOnce(cmdError("復元対象のファイルを読み込めませんでした"));

    renderWithClient(<BackupRestorePage />);
    await startRestoreConfirmation(user);
    await user.click(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" }));

    expect(
      await screen.findByText(
        "バックアップの復元に失敗しました。現在のデータには戻しています。もう一度お試しください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今すぐバックアップを作成" })).toBeEnabled();
    expect(screen.queryByText("アプリを閉じて、もう一度開いてください")).not.toBeInTheDocument();
  });

  it("QR-05 REQ-905 branches restore failures by CmdError kind", async () => {
    const user = userEvent.setup();
    mockRestoreBackup.mockResolvedValueOnce({
      status: "error",
      error: {
        kind: "restore_failed_unrecoverable",
        message: "message text is intentionally unrelated",
        field: null,
        error_id: null,
      },
    });

    renderWithClient(<BackupRestorePage />);
    await startRestoreConfirmation(user);
    await user.click(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" }));

    expect(await screen.findByText("再起動が必要です")).toBeInTheDocument();
  });

  it("QR-05 REQ-905 shows non-assertive guidance for durability unknown", async () => {
    const user = userEvent.setup();
    mockRestoreBackup.mockResolvedValueOnce({
      status: "error",
      error: {
        kind: "restore_durability_unknown",
        message: "durability state unknown",
        field: null,
        error_id: null,
      },
    });

    renderWithClient(<BackupRestorePage />);
    await startRestoreConfirmation(user);
    await user.click(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" }));

    expect(await screen.findByText("復元結果を確認できませんでした")).toBeInTheDocument();
    expect(screen.getByText("復元が完了したか確定できませんでした。")).toBeInTheDocument();
    expect(screen.queryByText(/現在のデータには戻しています/)).not.toBeInTheDocument();
  });

  it.each([
    [
      "restore_failed_recovered",
      "バックアップの復元に失敗しました。現在のデータには戻しています。もう一度お試しください。",
    ],
    ["restore_failed_unrecoverable", "再起動が必要です"],
    ["restore_durability_unknown", "復元結果を確認できませんでした"],
  ] as const)(
    "REQ-700 68 §68.7 shows error_id for %s as a separate element",
    async (kind, text) => {
      const user = userEvent.setup();
      mockRestoreBackup.mockResolvedValueOnce(
        cmdError("synthetic restore detail", kind, "E-20260726-153021-a1b2"),
      );

      renderWithClient(<BackupRestorePage />);
      await startRestoreConfirmation(user);
      await user.click(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" }));

      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(screen.getByText("（エラーID: E-20260726-153021-a1b2）")).toBeInTheDocument();
    },
  );

  it("QR-05 REQ-905 shows restart guidance and disables operations on double failure", async () => {
    const user = userEvent.setup();
    mockRestoreBackup.mockResolvedValueOnce(
      cmdError(
        "バックアップの復元に失敗し、DB接続の復旧もできませんでした。アプリを再起動してください",
        "restore_failed_unrecoverable",
      ),
    );

    renderWithClient(<BackupRestorePage />);
    await startRestoreConfirmation(user);
    await user.click(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" }));

    expect(await screen.findByText("再起動が必要です")).toBeInTheDocument();
    expect(screen.getByText("アプリを閉じて、もう一度開いてください")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今すぐバックアップを作成" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存先を選ぶ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "この控えに戻す" })).toBeDisabled();
  });

  it("QR-05 REQ-905 stops auto backup checks after double failure", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockCheckAutoBackup.mockResolvedValue(ok(false));
    mockRestoreBackup.mockResolvedValueOnce(
      cmdError(
        "バックアップの復元に失敗し、DB接続の復旧もできませんでした。アプリを再起動してください",
        "restore_failed_unrecoverable",
      ),
    );

    renderWithClient(<BackupRestorePage />);
    await startRestoreConfirmation(user);
    await user.click(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" }));

    expect(await screen.findByText("再起動が必要です")).toBeInTheDocument();
    const callsAtFatal = mockCheckAutoBackup.mock.calls.length;

    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockCheckAutoBackup).toHaveBeenCalledTimes(callsAtFatal);
  });

  it("QR-05 REQ-905 clears query cache and navigates home after restore success", async () => {
    const user = userEvent.setup();
    const { clearSpy } = renderWithClient(<BackupRestorePage />);

    await startRestoreConfirmation(user);
    await user.click(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" }));

    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    // primary path (navigate 成功) は home Alert に一本化し、toast との二重通知にしない。
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("test_ui11b_d11_sets_restore_success_pending_flag_before_navigate", async () => {
    const user = userEvent.setup();
    renderWithClient(<BackupRestorePage />);

    await startRestoreConfirmation(user);
    await user.click(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
    // producer が flag を set 済みであることを consumer 相当の consume で確認する
    // (このテストの consume 自体が flag を消費するため、本 assertion が最終確認)。
    expect(consumeRestoreSuccessPending()).toBe(true);
  });

  it("test_ui11b_d11_clears_restore_success_pending_flag_when_navigate_rejects", async () => {
    const user = userEvent.setup();
    mockNavigate.mockRejectedValueOnce(new Error("synthetic navigate rejection"));
    renderWithClient(<BackupRestorePage />);

    await startRestoreConfirmation(user);
    await user.click(screen.getByRole("button", { name: "7月3日 21:00 の控えに戻す" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
    // navigate reject 後は次回到達での誤表示を防ぐため flag が消去されている。
    expect(consumeRestoreSuccessPending()).toBe(false);
    // home Alert を出せない reject fallback として、成功 feedback の toast が発火する
    // （無通知への劣化を防ぐ。coordinator 裁定 2026-08-03、要裁定 #2 是正）。
    expect(mockToastSuccess).toHaveBeenCalledWith("バックアップから復元しました");
  });

  it("QR-05 REQ-905 shows created backup file path after manual backup", async () => {
    const user = userEvent.setup();

    renderWithClient(<BackupRestorePage />);
    await screen.findByRole("heading", { name: "バックアップ・復元" });

    await user.click(screen.getByRole("button", { name: "今すぐバックアップを作成" }));

    expect(await screen.findByText("バックアップを作成しました")).toBeInTheDocument();
    expect(
      screen.getByText("保存先: /tmp/backups/inventory_backup_20260706_100000.db"),
    ).toBeInTheDocument();
  });

  it("QR-05 REQ-905 updates backup_path only from directory picker", async () => {
    const user = userEvent.setup();
    mockOpen.mockResolvedValueOnce(null).mockResolvedValueOnce("/tmp/new-backups");

    renderWithClient(<BackupRestorePage />);
    await screen.findByRole("heading", { name: "バックアップ・復元" });

    expect(screen.queryByRole("textbox", { name: "現在の保存先" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存先を選ぶ" }));
    expect(mockUpdateSetting).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "保存先を選ぶ" }));
    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith({
        key: "backup_path",
        value: "/tmp/new-backups",
      });
    });
    expect(mockOpen).toHaveBeenCalledWith({ directory: true, multiple: false });
  });

  it("QR-05 REQ-905 shows effective backup dir returned by backend", async () => {
    renderWithClient(<BackupRestorePage />);
    await screen.findByRole("heading", { name: "バックアップ・復元" });

    expect(await screen.findByText("/tmp/backups")).toBeInTheDocument();
  });

  it("QR-05 REQ-905 shows fallback note when backup_path is unset", async () => {
    mockGetSettings.mockResolvedValue(
      ok([
        { key: "backup_enabled", value: "1", updated_at: "2026-07-06T00:00:00" },
        { key: "backup_time", value: "23:00", updated_at: "2026-07-06T00:00:00" },
        { key: "backup_path", value: "", updated_at: "2026-07-06T00:00:00" },
        { key: "backup_retention_days", value: "3", updated_at: "2026-07-06T00:00:00" },
      ]),
    );
    mockGetEffectiveBackupDir.mockResolvedValue(ok("/home/user/.local/share/app/backups"));

    renderWithClient(<BackupRestorePage />);
    await screen.findByRole("heading", { name: "バックアップ・復元" });

    expect(await screen.findByText("/home/user/.local/share/app/backups")).toBeInTheDocument();
    expect(
      screen.getByText("保存先が未設定のためアプリ既定フォルダに保存されます"),
    ).toBeInTheDocument();
  });

  it("QR-05 REQ-905 hides effective backup dir row when the fetch fails", async () => {
    mockGetEffectiveBackupDir.mockResolvedValue(cmdError("実効保存先を取得できませんでした"));

    renderWithClient(<BackupRestorePage />);
    await screen.findByRole("heading", { name: "バックアップ・復元" });
    await screen.findByRole("button", { name: "保存先を選ぶ" });

    expect(screen.queryByText("現在の保存先")).not.toBeInTheDocument();
    expect(
      screen.queryByText("保存先が未設定のためアプリ既定フォルダに保存されます"),
    ).not.toBeInTheDocument();
    // 他機能（手動バックアップ）は取得失敗の影響を受けない
    expect(screen.getByRole("button", { name: "今すぐバックアップを作成" })).toBeEnabled();
  });

  it("QR-05 REQ-905 checks auto backup every 60 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCheckAutoBackup.mockResolvedValue(ok(true));

    renderWithClient(<BackupRestorePage />);
    await screen.findByRole("heading", { name: "バックアップ・復元" });
    expect(mockCheckAutoBackup).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockCheckAutoBackup).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockListBackups).toHaveBeenCalledTimes(2);
    });
  });
});
