// src/lib/restore-success-notification.ts
//
// UI-11b-D11: バックアップ復元成功の通知を producer (BackupRestorePage) から
// consumer (ホーム画面) へ受け渡す in-memory one-shot flag。
// router / history state・URL search param・storage は使わない
// (docs/function-design/68-ui-backup-restore.md UI-11b-D11)。
//
// module scope の変数のみで状態を持つため reload / アプリ再起動で自動的に消滅する
// (one-shot 性の構造的な保証)。

let restoreSuccessPending = false;

/** 復元成功時に producer (BackupRestorePage) が navigate 前に呼ぶ。 */
export function setRestoreSuccessPending(): void {
  restoreSuccessPending = true;
}

/**
 * navigate が reject された場合に producer が呼ぶ。次回のホーム到達での
 * 誤表示を防ぐため flag を消去する。
 */
export function clearRestoreSuccessPending(): void {
  restoreSuccessPending = false;
}

/**
 * consumer (ホーム画面) が mount 時 (useEffect) に一度だけ呼ぶ。呼び出しと同時に
 * flag を消去する (one-shot)。戻り値を component-local state へ取り込み、その
 * mount 中は表示を維持すること (render 中の直接 read は StrictMode の discard
 * render に flag を先食いされるため禁止。UI-11b-D11 参照)。
 */
export function consumeRestoreSuccessPending(): boolean {
  const pending = restoreSuccessPending;
  restoreSuccessPending = false;
  return pending;
}
