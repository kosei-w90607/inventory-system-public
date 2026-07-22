import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands, type IntegrityMismatch } from "@/lib/bindings";
import { IntegrityCheckPage } from "./IntegrityCheckPage";

vi.mock("@/lib/bindings", () => ({
  commands: { runIntegrityCheck: vi.fn(), fixIntegrity: vi.fn(), listLogs: vi.fn() },
}));

const runIntegrityCheck = vi.mocked(commands.runIntegrityCheck);
const fixIntegrity = vi.mocked(commands.fixIntegrity);
const listLogs = vi.mocked(commands.listLogs);

function mismatch(code: string, stock = 10, movements = 7): IntegrityMismatch {
  return {
    product_code: code,
    name: `合成商品 ${code}`,
    stock_quantity: stock,
    movements_sum: movements,
    difference: stock - movements,
  };
}

function checkResult(items: IntegrityMismatch[]) {
  return {
    status: "ok" as const,
    data: {
      mismatches: items,
      mismatch_count: items.length,
      checked_count: Math.max(items.length, 5),
    },
  };
}

function fixResult(
  fixedCount = 1,
  skippedCount = 0,
  code = "SYN-001",
  oldStock = 10,
  newStock = 7,
) {
  return {
    status: "ok" as const,
    data: {
      fixed_count: fixedCount,
      skipped_count: skippedCount,
      adjustments:
        fixedCount > 0
          ? [
              {
                product_code: code,
                old_stock: oldStock,
                new_stock: newStock,
                adjustment: newStock - oldStock,
              },
            ]
          : [],
    },
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <IntegrityCheckPage />
    </QueryClientProvider>,
  );
}

async function runCheck() {
  await userEvent.setup().click(screen.getByRole("button", { name: "整合性チェック実行" }));
}

async function selectForFix(code: string) {
  await userEvent.setup().click(screen.getByRole("checkbox", { name: `${code}を補正する` }));
}

async function openFixDialog() {
  await userEvent.setup().click(screen.getByRole("button", { name: "補正を確定" }));
}

async function confirmFix() {
  await userEvent.setup().click(screen.getByRole("button", { name: "補正を実行する" }));
}

beforeEach(() => {
  runIntegrityCheck.mockReset();
  fixIntegrity.mockReset();
  listLogs.mockReset();
  listLogs.mockResolvedValue({
    status: "ok",
    data: { items: [], total_count: 0, page: 1, per_page: 1 },
  });
});

describe("UI-13 REQ-904 在庫整合性検証", () => {
  it("test_integrity_page_req904_initial_idle_only_run_button", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "在庫整合性チェック" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "整合性チェック実行" })).toBeEnabled();
    expect(screen.queryByText("差異はありません")).not.toBeInTheDocument();
    expect(screen.queryByText("差異が見つかりました")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "補正を確定" })).toBeNull();
  });

  it("test_integrity_page_req904_remount_resets_to_idle", async () => {
    runIntegrityCheck.mockResolvedValue(checkResult([mismatch("SYN-OLD")]));
    const first = renderPage();
    await runCheck();
    expect(await screen.findByText("合成商品 SYN-OLD")).toBeInTheDocument();
    first.unmount();
    renderPage();
    expect(screen.getByRole("button", { name: "整合性チェック実行" })).toBeEnabled();
    expect(screen.queryByText("合成商品 SYN-OLD")).toBeNull();
    expect(runIntegrityCheck).toHaveBeenCalledTimes(1);
  });

  it("test_integrity_page_req904_rerun_replaces_result_and_clears_selection", async () => {
    runIntegrityCheck
      .mockResolvedValueOnce(checkResult([mismatch("SYN-OLD")]))
      .mockResolvedValueOnce(checkResult([mismatch("SYN-NEW", 4, 9)]));
    renderPage();
    await runCheck();
    await selectForFix("SYN-OLD");
    await userEvent.setup().click(screen.getByRole("button", { name: "再度チェック" }));
    expect(await screen.findByText("合成商品 SYN-NEW")).toBeInTheDocument();
    expect(screen.queryByText("合成商品 SYN-OLD")).toBeNull();
    expect(screen.getByRole("button", { name: "補正を確定" })).toBeDisabled();
  });

  it("test_integrity_page_req904_last_checked_from_integrity_check_log", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            id: 7,
            operation_type: "integrity_check",
            summary: "合成チェック",
            detail_json: null,
            created_at: "2026-07-15T09:08:07",
          },
        ],
        total_count: 1,
        page: 1,
        per_page: 1,
      },
    });
    const first = renderPage();
    expect(await screen.findByText("直近の確認日時: 2026-07-15 09:08:07")).toBeInTheDocument();
    expect(listLogs).toHaveBeenCalledWith({
      page: 1,
      per_page: 1,
      operation_type: "integrity_check",
      start_date: null,
      end_date: null,
    });
    first.unmount();
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 1 },
    });
    renderPage();
    expect(await screen.findByText("直近の確認日時: まだ実行されていません")).toBeInTheDocument();
  });

  it("test_integrity_page_req904_fix_requires_confirm_and_selected_codes_only", async () => {
    runIntegrityCheck.mockResolvedValue(
      checkResult([mismatch("SYN-001"), mismatch("SYN-002", 3, 8)]),
    );
    fixIntegrity.mockResolvedValue(fixResult());
    renderPage();
    await runCheck();
    await selectForFix("SYN-001");
    await openFixDialog();
    expect(fixIntegrity).not.toHaveBeenCalled();
    await confirmFix();
    await waitFor(() => {
      expect(fixIntegrity).toHaveBeenCalledTimes(1);
    });
    expect(fixIntegrity).toHaveBeenCalledWith(["SYN-001"]);
  });

  it("test_integrity_page_req904_t7_uses_integrity_fix_button_copy", async () => {
    runIntegrityCheck.mockResolvedValue(checkResult([mismatch("SYN-001")]));
    renderPage();
    await runCheck();

    expect(screen.getByRole("button", { name: "補正を確定" })).toBeVisible();
    const retiredLabel = ["棚卸し", "補正として確定"].join("");
    expect(screen.queryByRole("button", { name: retiredLabel })).toBeNull();
  });

  it("test_integrity_page_req904_t8_dialog_copy_is_visible_and_accessible", async () => {
    runIntegrityCheck.mockResolvedValue(checkResult([mismatch("SYN-001")]));
    renderPage();
    await runCheck();
    await selectForFix("SYN-001");
    await openFixDialog();

    const dialog = screen.getByRole("alertdialog");
    const dialogTitle = within(dialog).getByRole("heading", {
      name: "在庫数を入出庫の合計に合わせて補正します",
    });
    const warningTitle = within(dialog).getByText("補正すると元に戻せません");
    const warningDescription = within(dialog).getByText(
      "選択した商品のシステム在庫を入出庫の合計に合わせて更新し、操作ログに記録します。",
    );
    for (const visibleCopy of [dialogTitle, warningTitle, warningDescription]) {
      expect(visibleCopy).toBeVisible();
      expect(visibleCopy).not.toHaveClass("sr-only");
      expect(visibleCopy).not.toHaveAttribute("hidden");
      expect(visibleCopy).not.toHaveAttribute("aria-hidden");
    }
    expect(
      within(dialog).getByText(
        "補正すると元に戻せません。選択した商品のシステム在庫を入出庫の合計に合わせて更新し、操作ログに記録します。",
      ),
    ).toHaveClass("sr-only");
    expect(within(dialog).getByText("補正する商品（システム在庫 → 入出庫の合計）")).toBeVisible();
  });

  it("test_integrity_page_req904_no_select_all_and_disabled_when_none_selected", async () => {
    runIntegrityCheck.mockResolvedValue(
      checkResult([mismatch("SYN-001"), mismatch("SYN-002", 3, 8)]),
    );
    renderPage();
    await runCheck();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.queryByRole("checkbox", { name: /すべて|全選択/ })).toBeNull();
    expect(screen.getByRole("button", { name: "補正を確定" })).toBeDisabled();
  });

  it("test_integrity_page_req904_confirm_dialog_lists_selected_adjustments", async () => {
    runIntegrityCheck.mockResolvedValue(
      checkResult([mismatch("SYN-001", 10, 7), mismatch("SYN-002", 3, 8)]),
    );
    renderPage();
    await runCheck();
    await selectForFix("SYN-001");
    await selectForFix("SYN-002");
    await openFixDialog();
    const dialog = screen.getByRole("alertdialog");
    for (const text of ["SYN-001", "10 → 7", "SYN-002", "3 → 8"]) {
      expect(within(dialog).getByText(text)).toBeInTheDocument();
    }
  });

  it("test_integrity_page_req904_running_overlay_blocks_actions", async () => {
    let resolveCheck: ((value: ReturnType<typeof checkResult>) => void) | undefined;
    let resolveFix: ((value: ReturnType<typeof fixResult>) => void) | undefined;
    runIntegrityCheck.mockImplementation(() => new Promise((resolve) => (resolveCheck = resolve)));
    fixIntegrity.mockImplementation(() => new Promise((resolve) => (resolveFix = resolve)));
    renderPage();
    await runCheck();
    expect(screen.getByRole("status")).toHaveTextContent("在庫データを確認しています");
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    const button = screen.getByRole("button", { name: "整合性チェック実行" });
    expect(button).toBeDisabled();
    await userEvent.setup().click(button);
    expect(runIntegrityCheck).toHaveBeenCalledTimes(1);
    resolveCheck?.(
      checkResult(
        Array.from({ length: 101 }, (_, index) =>
          mismatch(`SYN-${String(index).padStart(3, "0")}`),
        ),
      ),
    );
    expect(await screen.findByText("差異が見つかりました")).toBeInTheDocument();
    await selectForFix("SYN-001");
    await openFixDialog();
    await confirmFix();
    expect(screen.getByText("補正を記録しています").closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: "次のページ" })).toBeNull();
    resolveFix?.(fixResult());
    expect(await screen.findByText("1件を補正しました")).toBeInTheDocument();
  });

  it("test_integrity_page_req904_fix_success_no_auto_recheck_shows_summary", async () => {
    runIntegrityCheck.mockResolvedValue(checkResult([mismatch("SYN-001")]));
    fixIntegrity.mockResolvedValue(fixResult());
    renderPage();
    await runCheck();
    await selectForFix("SYN-001");
    await openFixDialog();
    await confirmFix();
    expect(await screen.findByText("1件を補正しました")).toBeInTheDocument();
    expect(screen.getByText("10 → 7")).toBeInTheDocument();
    expect(screen.queryByText("一部の商品は補正されませんでした")).toBeNull();
    expect(runIntegrityCheck).toHaveBeenCalledTimes(1);
  });

  it("test_integrity_page_req904_fixed_rows_badged_and_recheck_affordance", async () => {
    runIntegrityCheck.mockResolvedValue(checkResult([mismatch("SYN-001")]));
    fixIntegrity.mockResolvedValue(fixResult());
    renderPage();
    await runCheck();
    await selectForFix("SYN-001");
    await openFixDialog();
    await confirmFix();
    expect(await screen.findByText("補正済み")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再度チェック" })).toBeEnabled();
  });

  it("test_integrity_page_req904_skipped_count_warning_visible", async () => {
    runIntegrityCheck.mockResolvedValue(checkResult([mismatch("SYN-001")]));
    fixIntegrity.mockResolvedValue(fixResult(0, 1));
    renderPage();
    await runCheck();
    await selectForFix("SYN-001");
    await openFixDialog();
    await confirmFix();
    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent("一部の商品は補正されませんでした");
    expect(warning).toHaveTextContent("1件");
  });

  it("test_integrity_page_req904_cmderror_japanese_message_retry_keeps_selection", async () => {
    runIntegrityCheck
      .mockResolvedValueOnce({
        status: "error",
        error: {
          kind: "internal",
          message: "合成チェックエラー。もう一度お試しください",
          field: null,
        },
      })
      .mockResolvedValueOnce(checkResult([mismatch("SYN-001")]));
    fixIntegrity
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "合成補正エラー。もう一度お試しください", field: null },
      })
      .mockResolvedValueOnce(fixResult());
    renderPage();
    await runCheck();
    expect(
      await screen.findByText("合成チェックエラー。もう一度お試しください"),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "再試行" }));
    expect(await screen.findByText("合成商品 SYN-001")).toBeInTheDocument();
    expect(runIntegrityCheck).toHaveBeenCalledTimes(2);
    await selectForFix("SYN-001");
    await openFixDialog();
    await confirmFix();
    expect(await screen.findByText("合成補正エラー。もう一度お試しください")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "SYN-001を補正する" })).toBeChecked();
    await userEvent.setup().click(screen.getByRole("button", { name: "補正を再試行" }));
    await waitFor(() => {
      expect(fixIntegrity).toHaveBeenCalledTimes(2);
    });
    expect(fixIntegrity).toHaveBeenLastCalledWith(["SYN-001"]);
  });

  it("test_integrity_page_req904_pagination_100_per_page", async () => {
    const items = Array.from({ length: 101 }, (_, index) =>
      mismatch(`SYN-${String(index).padStart(3, "0")}`),
    );
    runIntegrityCheck.mockResolvedValue(checkResult(items));
    renderPage();
    await runCheck();
    expect(await screen.findByText("合成商品 SYN-000")).toBeInTheDocument();
    expect(screen.getByText("合成商品 SYN-099")).toBeInTheDocument();
    expect(screen.queryByText("合成商品 SYN-100")).toBeNull();
    expect(screen.getByText("101 件中 1 / 2 ページ")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText("合成商品 SYN-100")).toBeInTheDocument();
    expect(screen.queryByText("合成商品 SYN-000")).toBeNull();
  });

  it("test_integrity_page_req904_mismatch_columns_complete", async () => {
    runIntegrityCheck.mockResolvedValue(checkResult([mismatch("SYN-001")]));
    renderPage();
    await runCheck();
    for (const heading of ["商品コード", "名前", "システム在庫", "入出庫の合計", "差異"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
  });

  it("test_integrity_page_req904_state_labels_not_color_only", async () => {
    runIntegrityCheck
      .mockResolvedValueOnce(
        checkResult([mismatch("SYN-PLUS", 10, 7), mismatch("SYN-MINUS", 3, 8)]),
      )
      .mockResolvedValueOnce(checkResult([]));
    fixIntegrity.mockResolvedValue(fixResult(1, 0, "SYN-PLUS"));
    renderPage();
    await runCheck();
    expect(await screen.findByText("差異が見つかりました")).toBeInTheDocument();
    expect(screen.getByText("システム在庫が多い")).toBeInTheDocument();
    expect(screen.getByText("入出庫の合計が多い")).toBeInTheDocument();
    await selectForFix("SYN-PLUS");
    await openFixDialog();
    await confirmFix();
    expect(await screen.findByText("補正済み")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "再度チェック" }));
    expect(await screen.findByText("差異はありません")).toBeInTheDocument();
  });
});
