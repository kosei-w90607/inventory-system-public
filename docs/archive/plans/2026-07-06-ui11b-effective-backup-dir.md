# UI-11b バックアップ画面の実効保存先常時表示

> **Status**: 完了（PR #149 squash merge `d83c588`、2026-07-06。Windows native L3 3項目合格。同日 closeout で archive）

## Risk

Risk: R2

Reason:
CMD 層に読み取り専用の薄い command 1 本を追加し、UI-11b 画面に表示行を足す小実装。DB・トランザクション・restore 契約は変更しないが、generated binding の wire surface が増え operator 画面表示が変わるため R2 とする。

## Goal

`backup_path` 未設定時にバックアップがどこへ保存されるか（アプリ既定フォルダ）を画面上で常時確認できるようにする。

## Scope

- CMD-11 `get_effective_backup_dir`（既存 `resolve_backup_dir` の薄い公開）+ `generate_handler!` / `collect_commands!` 登録 + bindings 再生成。
- BackupRestorePage のバックアップ設定セクションに「現在の保存先」常時表示 + `backup_path` 更新時の query invalidate。
- 43-cmd / 68-ui docs 追記、テスト追加。

## Non-scope

- 初回保存先選択 UX、復元成功表示の強調（backlog 残置）。
- フォルダ選択ダイアログ・restore 契約・バックアップ生成ロジックの変更。

## Acceptance Criteria

- `backup_path` 未設定時、アプリ既定フォルダ（`app_data/backups`）の実パスが画面に表示される。
- `backup_path` 設定・保存後、表示が新しい実効保存先へ追随する。
- 取得失敗時は表示行が出ないだけで画面の他機能は動作する。
- Rust gates（fmt / clippy / test / architecture_test / design_compliance_test）+ frontend gates（typecheck / lint / vitest / prettier）+ doc-consistency-check 全通過。

## Design Sources

- Architecture: [docs/ARCHITECTURE.md](../../ARCHITECTURE.md) UI-11b / CMD-11 / MNT-01
- Function / command / DTO: [docs/function-design/43-cmd-settings-log.md](../../function-design/43-cmd-settings-log.md), [docs/function-design/71-mnt-backup.md](../../function-design/71-mnt-backup.md)
- Screen / UI: [docs/function-design/68-ui-backup-restore.md](../../function-design/68-ui-backup-restore.md)
- Decision log / ADR: D-032（復元安全フロー、本 PR は非接触）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 43-cmd-settings-log.md / 71-mnt-backup.md | existing sufficient; 43-cmd に新 command を本 PR で追記 |
| Command / DTO / generated binding / wire shape | 43-cmd-settings-log.md / ADR-002 | existing sufficient; 追加は `Result<String, CmdError>` の読み取り専用 1 本 |
| DB / transaction / audit / rollback / migration | none | not applicable（読み取りのみ） |
| Screen / UI / route state / Japanese wording | 68-ui-backup-restore.md | existing sufficient; 常時表示行を本 PR で追記 |
| CSV / TSV / report / import / export format | none | not applicable |
| Durable decision / ADR | none | 既存 resolve_backup_dir 仕様の公開のみで新規判断なし |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| QR-05 / REQ-905（バックアップ運用の可視性） | 71-mnt-backup.md resolve_backup_dir / 68-ui-backup-restore.md 設定セクション | なし | 初回保存先選択 UX は operator に判断を強いるため不採用。既定で動く現契約を可視化する方が非IT operator 向けに正しい | `settings_cmd.rs` / `lib.rs` / `bindings.ts` / `BackupRestorePage.tsx` | Rust 既存テスト + RTL 表示テスト |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history: yes（43-cmd / 68-ui へ本 PR で追記）。
- Plan-only durable decisions found and promoted: なし。
- Assumptions and constraints: `resolve_backup_dir` は接続と app_data パスだけで決定し副作用がない。表示は読み取り専用で restore 安全フロー（D-032）に影響しない。
- Deferred design gaps: 初回保存先選択 UX / 復元成功表示の強調は backlog。
- Test Design Matrix: R2 小変更のため packet 内 Test Plan で代替。

## Impact Review Lenses

Not applicable: POS boundary / CSV semantics / DB 契約に触れない読み取り専用の可視化。restore 契約・データ安全フローは非接触。

## Design Readiness

- Existing design docs are sufficient because: 71-mnt-backup が実効保存先の解決仕様を既に定義しており、本 PR はその公開と表示のみ。
- Source docs updated in this PR: 43-cmd-settings-log.md / 68-ui-backup-restore.md。
- Design gaps intentionally deferred: 初回保存先選択 UX、復元成功表示の強調。
- Durable decisions discovered in this plan and promoted to source docs: なし。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI → CMD → MNT の一方向。CMD は既存ヘルパ呼び出しの薄いラッパー。
- Backend function design: `resolve_backup_dir` unchanged。
- Command / DTO / data contract: additive な読み取り専用 command 1 本。
- Persistence / transaction / audit impact: なし。
- Operator workflow / Japanese UI wording: 表示追加のみ。既存視覚言語を踏襲し色のみ符号化をしない。
- Error, empty, retry, and recovery behavior: 取得失敗時は行非表示、他機能への影響なし。
- Testability and traceability IDs: QR-05 / REQ-905 既存テスト維持 + RTL 表示テスト追加。

## Test Plan

- targeted tests: `npx vitest run src/features/backup-restore`、`cd src-tauri && cargo test`
- negative tests: `getEffectiveBackupDir` 失敗時に表示行が出ず他機能が動くこと。
- compatibility checks: `npm run typecheck` / `npx eslint src/features/backup-restore --max-warnings 0` / `npx prettier --check src/features/backup-restore`、`cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings`。
- data safety checks: 実バックアップファイル・実 DB を commit しない。
- main wiring/integration checks: `cargo test --test architecture_test`、`cargo test --test design_compliance_test`、`cargo run --bin generate_bindings` の diff 確認、`bash scripts/doc-consistency-check.sh`。

## Boundary / Wire Contract

- producer: `settings_cmd::get_effective_backup_dir`（Rust CMD）。
- consumer: `commands.getEffectiveBackupDir`（generated binding 経由の BackupRestorePage useQuery）。
- wire type: `Result<String, CmdError>`（tauri-specta 生成 wrapper）。
- internal type: `PathBuf` → `to_string_lossy` の `String`。
- invalid input: 引数なしのため該当なし。DB 接続失敗は既存 `CmdError` 変換に従う。
- round-trip path: `collect_commands!` → `cargo run --bin generate_bindings` → committed `src/lib/bindings.ts`。
- compatibility: additive。既存 command / DTO は不変。

## Review Focus

- `generate_handler!` と `collect_commands!` の両方に登録されているか（drift check）。
- CMD が薄いラッパーのまま（業務ルール・path 加工を足していないか）。
- UI の query invalidate が `backup_path` 保存成功経路に正しく配線されているか。

## Self-Review

7 観点セルフレビュー実施（2026-07-06、orchestrator）:

1. 設計書整合: 71-mnt-backup の resolve_backup_dir 仕様と一致。43-cmd / 68-ui は本 PR で追記。
2. スコープ: command 1 本 + 表示 1 行に限定。選択 UX / 成功表示強調を Non-scope に明記。
3. レイヤー原則: UI → CMD → MNT の一方向、CMD 薄ラッパー維持。
4. エラー処理: 取得失敗は行非表示で degrade、既存 CmdError 変換を踏襲。
5. テスト: 表示正常系 + 失敗系 + 既存 gates 全維持。
6. データ安全: 読み取り専用、restore 契約非接触、実ファイル commit なし。
7. 代替案検討: 初回保存先選択 UX は非IT operator に判断を強いるため不採用。frontend 単独での dir 解決は backup_path 未設定時の app_data 解決を正確に再現できず不採用（backlog 記載の根拠と一致）。
