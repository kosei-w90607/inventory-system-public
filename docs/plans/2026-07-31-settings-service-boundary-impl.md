# Plan Packet: CMD-11 settings service 境界の実装（監査是正 順12 実装 PR）

## Workflow State

- Phase: human-confirm
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 0fd8551f5566000df0ef2c85791eb48d9feb2d27
- Amendments: e83e24a（AMD1: internal 文言統一の裁定 — SPEC-CMD11-IMPL-D4）, 550502f（AMD2: restore_support 不採用・mnt lane 移設 — SPEC-CMD11-IMPL-D5）
- Coordinator: Claude (Fable 5, main session)
- Writer: Codex (GPT-5.6, owner relay)
- Plan Reviewer: independent Claude subagent (Sonnet 5)
- Final Reviewer: independent Claude subagent (Sonnet 5)
- Reviewed Content HEAD: 6b1d0fe82d0ac948c6f6738e3306b26ac6efa59f
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: hosted workflow_dispatch + merge 承認（pending）

Narrative（append-only）:

- 2026-07-31 kickoff -> spec-check -> plan-draft: design PR（D-060、packet 2026-07-31-settings-service-boundary-design、archive 済み）が `ARCHITECTURE.md` / `43-cmd-settings-log.md` / `cmd-task-specs.md` / `biz-task-specs.md` / `31-biz-inventory-service.md` §12.9 を既に BIZ-09 経由の目標形へ改訂済みのため、spec-check は「既存設計書で十分」の唯一許容 skip 経路（design → plan-draft ではなく spec-check → plan-draft）を取る。Coordinator が現行 `settings_cmd.rs` / `architecture_test.rs` / `design_compliance_test.rs` / `biz/mod.rs` を read-only 調査し、db_err 使用箇所（7 箇所、うち 4 箇所が settings/log 系で移行対象）、LAYER_EXCEPTIONS の import 行検出機構、biz 層 re-export 慣行（`DbConnection`/`PaginatedResult`/`Department`/`Supplier` 等は既に `biz/mod.rs` で re-export 済みだが `DbError`/`AppSetting`/`OperationLog` は未 re-export）、5 doc に残る「順12 実装 PR」未来形注記（計 8 箇所 — Plan Review round 1 P2 で 7→8 に実測是正、43 §43.12:269 の追随注記が当初列挙から漏れていた）を実測した。本 Packet と Matrix はこの実測に基づく plan-draft であり、production 実装は未着手。

## Owner Effort Budget

- 介入回数上限: 4
- 実働時間上限: 30分
- relay 往復上限: 3

既定値（3/30分/2）に対し、Codex owner-relay 実装 + Sonnet 独立 Plan Review + Final Review の 2 round を見込み、介入・relay を各 1 回上乗せする（設計 PR 実績で Plan Review 3 round を要した前例があるため）。
既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5を使わないchangeは両方`none`のままにする。

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
restore 系コードは無変更契約（71 §71.7 / MNT-01-D1/D4/D5、Mutex 所有権交換、no-create 復旧、kind 3 値）だが、本 PR は CMD 層（`settings_cmd.rs`）から新設 BIZ 層（`biz::system_service`）への大規模再配置と、layer 依存機械 gate（`architecture_test.rs` LAYER_EXCEPTIONS）の恒久化、生成物契約（`bindings.ts` diff ゼロ）を含む。Tauri command DTO の呼び出し経路変更と機械 gate 変更を伴うため R3 tier（DEV_WORKFLOW.md Risk Tiers「Tauri command DTO」「merge gate 変更」該当）。

Rollback は本 PR の実装 commit revert。restore の意味論・DB schema・wire 契約（command シグネチャ・DTO・kind/message/field 文言）は不変のため、revert 時の追加復旧作業は不要。

## Goal

Goal Invariant: `settings_cmd.rs` が設定・操作ログ 4 command で IO 層（`system_repo`）を直接呼ばず、新設 `biz::system_service`（BIZ-09）経由の標準経路（CMD → BIZ → IO）で動作し、`architecture_test.rs` の `LAYER_EXCEPTIONS` が settings_cmd の例外を持たない状態で layer 依存 test が pass する。利用者可視の設定/ログ/バックアップ/画像保存の挙動・エラー文言・wire 契約は変更しない。

### 最小完了条件

- `settings_cmd.rs` の production コード（`#[cfg(test)]` 外）が `use crate::db::` / `use crate::io::` を import しない
- `architecture_test.rs` の `LAYER_EXCEPTIONS` から settings_cmd の 2 entry が削除され、`cargo test --test architecture_test` が pass する
- `38-biz-system-service.md` が新設され `design_compliance_test.rs` の `build_doc_to_modules_map()` に登録済みで、`cargo test --test design_compliance_test` が pass する
- `bindings.ts` 再生成 diff がゼロ

### 失敗定義

- restore orchestration の意味論・文言・接続所有権パターンが変わる
- 設定/操作ログ/画像保存の wire 契約（kind/message/field）が変わる
- `LAYER_EXCEPTIONS` を削除できない、または削除後に layer test が settings_cmd の db/io 直呼びを検知しない（恒久 gate 化の失敗）
- 未登録 doc gate（design_compliance_test）が新規 fail を出す

### 非目的

- restore orchestration のコード変更（`mem::replace` pattern / `handle_restore_failure` は現位置のまま）
- `CmdError.kind` の enum 化（監査是正 順14 の scope、D-061 実装は別 PR）
- wire 契約（command シグネチャ・DTO・kind/message/field 文言）の変更
- `71-mnt-backup.md` / `28-io-image-manager.md` 本文の変更

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- `src-tauri/src/biz/system_service.rs` 新設（BIZ-09）: `get_all_settings` / `upsert_setting` / `list_operation_logs`（日付 validation 所有、現行 `validate_log_date_range` の条件・文言・field を維持したまま移動）/ `list_distinct_operation_types` の 4 関数を `system_repo` 経由で提供する。error は `BizError::ValidationFailed` 系（field 付きは `ValidationFailedAt`）/ `BizError::DatabaseError` で返す
- `src-tauri/src/biz/inventory_service`（returns domain、`returns.rs` 相当）へ `save_receipt_image` を追加: 拡張子 validation（`jpg|jpeg|png|gif|webp`、31 §12.9 記載の許可集合）を所有し、通過後に `io::image_manager::save_receipt_image` を呼ぶ。拡張子不正は `BizError::ValidationFailedAt { field: "extension", .. }` で返し、`io::image_manager` からのその他 `io::Error`（書き込み失敗等）は `.claude/rules/implementation-quality.md` の filesystem エラー伝搬規範（catch-all 禁止、`DbError::QueryFailed` へラップ）に倣い `BizError::DatabaseError(DbError::QueryFailed(..))` へ変換する
- `src-tauri/src/cmd/settings_cmd.rs` の薄化:
  - `get_settings` / `update_setting` / `list_logs` / `list_log_operation_types` を `biz::system_service::*` 呼び出しへ書き換え、`?` + `From<BizError>` の一元変換に復帰する
  - `validate_log_date_range` 関数を削除（BIZ-09 へ移動）
  - `db_err` ヘルパーの使用箇所を backup 系 3 箇所（`get_backup_dir` / `create_backup` / `check_auto_backup`）に限定する。settings/log 4 箇所からは除去する（helper 自体の削除ではない — Non-scope の backup/restore・`get_backup_dir` 無変更契約と両立させる）
  - `save_receipt_image` を base64 decode（wire 型変換、CMD 残留）+ `biz::inventory_service::save_receipt_image` 呼び出しへ書き換える
  - production import から `use crate::db::{...}` と `use crate::io::image_manager;` を除去する（下記 biz re-export で代替）
- `src-tauri/src/biz/mod.rs` へ re-export 追加: `pub use crate::db::DbError;`（`DbConnection`/`PaginatedResult` と同じ既存 pattern。backup 系 3 箇所が `db::DbError` を境界超えず参照するため）、`pub use crate::db::system_repo::{AppSetting, OperationLog};`（`Department`/`Supplier` と同じ既存 pattern。settings_cmd の command 戻り値型が `crate::biz::` 経由で参照できるようにする）
- `src-tauri/tests/architecture_test.rs` の `LAYER_EXCEPTIONS` から `("cmd/settings_cmd.rs", "db")` / `("cmd/settings_cmd.rs", "io")` の 2 entry を削除する
- `docs/function-design/38-biz-system-service.md` 新設: BIZ-09 の関数契約（シグネチャ・処理ステップ・エラーハンドリング。`scripts/doc-consistency-check.sh` M2 の BIZ/IO 層必須セクション「関数要求」「シグネチャ」「処理ステップ」+ エラーハンドリング記述を充足）
- `src-tauri/tests/design_compliance_test.rs` の `build_doc_to_modules_map()` へ `"38-biz-system-service.md" -> vec!["biz::system_service"]` を登録する
- `docs/function-design/31-biz-inventory-service.md` §12.9 へ `save_receipt_image` の関数契約（シグネチャ含む）を追記する（同 § の「順12 実装 PR で本 doc に追記する」という前置き文を実体化・現在形化する）
- `settings_cmd.rs` の既存 test を production CMD test 規範（`tauri::test::mock_builder` + `AppState` + 実 `#[tauri::command]` 関数呼び出し。順5 = PR #22 で確立、`stocktake_cmd.rs::test_update_count_req205_negative_validation` 等が現行例）へ書き換える。validation 条件の単体検証（日付形式・実在暦日・範囲順序・拡張子）は BIZ 層 test（`biz::system_service` / `biz::inventory_service`）へ移す
- `biz::system_service` / `biz::inventory_service::save_receipt_image` の新規 test 追加（REQ-902/REQ-905/REQ-906 番号付き）
- `bindings.ts` 再生成（`cd src-tauri && cargo run --bin generate_bindings`）で diff ゼロを確認する
- 隣接 wording sweep: `docs/ARCHITECTURE.md`（§2 BIZ-09 行）、`docs/function-design/43-cmd-settings-log.md`（§43.1 実装追随注記、§43.3、§43.12 の 2 箇所を含む計 4 hit）、`docs/architecture/cmd-task-specs.md`（CMD-11 節末尾）、`docs/architecture/biz-task-specs.md`（BIZ-09 タスク要求）、`docs/function-design/31-biz-inventory-service.md`（§12.9）の計 5 file 8 箇所に残る「順12 実装 PR」「実装追随注記」「移行前の直呼び形」という未来形表現を、本 PR 実装完了後の現在形へ更新する（`docs/archive/` と `docs/research/` の履歴記述は sweep 対象外）

## Non-scope

- restore orchestration のコード変更一切（`mem::replace` pattern / `handle_restore_failure` / `terminal_restore_error` は現位置のまま。backup/restore 5 command 本体（`create_backup` / `check_auto_backup` / `get_effective_backup_dir` / `list_backups` / `restore_backup`）と `get_backup_dir` helper は無変更）
- `CmdError.kind` の enum 化（監査是正 順14 / D-061 の scope。別 PR、直列関係のみ Design Sources に記載）
- wire 契約変更（command シグネチャ・DTO・kind/message/field 文言）
- `docs/ARCHITECTURE.md` の呼び出し原則本文、`docs/function-design/43-cmd-settings-log.md` の処理ステップ本文、`docs/architecture/cmd-task-specs.md` / `docs/architecture/biz-task-specs.md` の契約本文（design PR で確定済み。本 PR は末尾の未来形注記の現在形化のみ）
- `71-mnt-backup.md` / `28-io-image-manager.md` 本文の変更
- `AppSetting` / `OperationLog` / `system_repo` 側の関数シグネチャ変更（`system_repo` はそのまま、呼び出し元が CMD から BIZ へ移るのみ）
- `90-traceability.md` 再生成（新規 REQ 追加なし、既存 REQ-902/905/906 のまま）

## Acceptance Criteria

- `rg -c "^use crate::db::" src-tauri/src/cmd/settings_cmd.rs` → `0`（baseline 1 実測）
- `rg -c "^use crate::io::" src-tauri/src/cmd/settings_cmd.rs` → `0`（baseline 1 実測）
- `rg -o '"cmd/settings_cmd.rs"' src-tauri/tests/architecture_test.rs | wc -l` → `0`（baseline 2 実測。`rg -c` は同一行 2 entry のため `1` になる vacuous oracle なので `-o | wc -l` を使う）
- `cargo test --test architecture_test` pass（`layer_dependency_rules` が settings_cmd を例外なしで検査する）
- `rg -c "fn validate_log_date_range" src-tauri/src/cmd/settings_cmd.rs` → `0`（baseline 1 実測、BIZ-09 へ移動）
- `rg -c "map_err(db_err)" src-tauri/src/cmd/settings_cmd.rs` → `3`（baseline 7 実測。backup 系 `get_backup_dir` / `create_backup` / `check_auto_backup` の 3 箇所のみ残存）
- `rg -c "fn db_err" src-tauri/src/cmd/settings_cmd.rs` → `1`（helper 自体は削除しない）
- `rg -c "^### BIZ-09" docs/architecture/biz-task-specs.md` → `1`（既存。回帰確認）
- `cargo test --test design_compliance_test` pass（`38-biz-system-service.md` が未登録 doc として fail しない）
- `rg -c "pub use crate::db::DbError" src-tauri/src/biz/mod.rs` → `1`
- `rg -c "pub use crate::db::system_repo::{AppSetting, OperationLog}" src-tauri/src/biz/mod.rs` → `1`
- `cd src-tauri && cargo run --bin generate_bindings` 実行後、`git diff --stat src/lib/bindings.ts` が出力なし（0 行）
- `rg -c "順12 実装 PR|実装追随注記|移行前の直呼び形" docs/ARCHITECTURE.md docs/function-design/43-cmd-settings-log.md docs/architecture/cmd-task-specs.md docs/architecture/biz-task-specs.md docs/function-design/31-biz-inventory-service.md` の合算 → `0`（baseline 8 実測、`docs/archive/`・`docs/research/` は対象外）
- `cargo fmt --check` / `cargo clippy -- -D warnings` / `cargo test`（src-tauri 全体）PASS
- `bash scripts/doc-consistency-check.sh --target plan` PASS（PK1/PK2 の必須セクション・placeholder 検査を含む。M2 warn は 38 doc の必須セクション充足で解消）
- `bash scripts/local-ci.sh full` PASS
- Matrix baseline mutation全量（M1〜M14）を `cargo test` / `cargo test --test architecture_test` / `cargo test --test design_compliance_test` で Coordinator が独立再実測し、各 red、復元後 green、survivor 0

## Design Sources

- Requirements / spec: `docs/research/audit-2026-07/report.md` 順12 / `findings/p2-layer-boundaries.md` P2-1
- Architecture: `docs/ARCHITECTURE.md`（呼び出し原則、§2 task table、§5-9 mapping。design PR で改訂済み）
- Function / command / DTO: `docs/function-design/43-cmd-settings-log.md`（全面改訂済み、実装追随注記の対象）、`31-biz-inventory-service.md` §12.9、`28-io-image-manager.md`（無変更）
- Task specs: `docs/architecture/cmd-task-specs.md` CMD-11 節、`docs/architecture/biz-task-specs.md` BIZ-09 節（いずれも design PR で改訂済み）
- 機械 enforcement: `src-tauri/tests/architecture_test.rs`（`LAYER_EXCEPTIONS`）、`src-tauri/tests/design_compliance_test.rs`（`build_doc_to_modules_map()`、必須セクション M2 warn）
- 実装先例: `src-tauri/src/cmd/stocktake_cmd.rs`（順5 = PR #22、production CMD test 規範 + biz re-export pattern の先例）、`src-tauri/src/biz/mod.rs`（`DbConnection`/`PaginatedResult`/`Department`/`Supplier` の既存 re-export pattern）
- DB: 変更なし
- Screen / UI: 変更なし
- Decision log / ADR: D-060（既存、本 PR は実装のみ。新規 ADR なし）。D-061（順14、直列関係のみ参照）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `38-biz-system-service.md`（新設）+ `31-biz-inventory-service.md` §12.9（契約追記） | updated in this PR |
| Command / DTO / generated binding / wire shape | `43-cmd-settings-log.md`（design PR で既に確定済み、本 PR は末尾注記の現在形化のみ） | existing sufficient |
| DB / transaction / audit / rollback / migration | 変更なし | existing sufficient |
| Screen / UI / route state / Japanese wording | 変更なし | existing sufficient |
| CSV / TSV / report / import / export format | 変更なし | existing sufficient |
| Durable decision / ADR | `docs/decision-log.md` D-060（既存） | existing sufficient |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| `38-biz-system-service.md`（function-design doc 新設） | `src-tauri/tests/design_compliance_test.rs` の `build_doc_to_modules_map()` へ `"38-biz-system-service.md" -> vec!["biz::system_service"]` を追加。M2 の BIZ/IO 層必須セクション「関数要求」「シグネチャ」「処理ステップ」+ エラーハンドリング記述を充足する |
| Tauri command | 該当なし（command 新設・シグネチャ変更なし。`bindings.ts` 再生成は wire 不変確認のためのみ実施し、diff ゼロを AC とする） |
| REQ coverage | 該当なし（新規 REQ 追加なし、既存 REQ-902/905/906 のまま。`90-traceability.md` 再生成不要） |
| route / 画面 | 該当なし |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| 監査 P2-1 / D-060 (b) | 43 §43.3〜§43.5.1 | SPEC-CMD11-D2 | 設定/ログ 4 command の CMD→IO 直呼びを BIZ-09 経由へ復帰。CMD に BIZ を挟まず system_repo を直接呼び続ける案は監査指摘の再現になるため却下 | `biz/system_service.rs` + `cmd/settings_cmd.rs` | Matrix M1, M2, M3 |
| ARCH-VAL-D1 / D-060 (c) | 43 §43.5 | SPEC-CMD11-D2 | 日付 validation の条件・文言・field を維持したまま BIZ-09 へ移動。CMD に validation を残し BIZ が薄い pass-through になる案は ARCH-VAL-D1（単一所有層）違反のため却下 | `biz/system_service.rs`（移動） | Matrix M4, M5 |
| D-060 (c) | 31 §12.9 | SPEC-CMD11-D3 | 拡張子 validation を `biz::inventory_service`（returns domain）へ。CMD に拡張子 validation を残す案・IO 層のみで判定する案は D-060 で既に却下済み（本 PR は実装のみ） | `biz/inventory_service`（returns.rs 相当） | Matrix M6, M7 |
| D-060 (b) 派生 | `architecture_test.rs` LAYER_EXCEPTIONS | SPEC-CMD11-D5 (vi) | settings_cmd の db/io 例外 2 entry を削除し、layer test を D-060 (b) の恒久機械 gate にする。例外を維持したまま doc だけ改訂する案は「模倣混乱の再発」を放置するため却下（design PR round 2 self-audit の教訓） | `architecture_test.rs` | Matrix M9 |
| SPEC-CMD11-D5 (i) | 38-biz-system-service.md（新設） | SPEC-CMD11-D5 | 未登録 doc gate（design_compliance_test）制約により design PR では新設不可だったため実装 PR で新設する。契約内容自体は design PR で凍結済み、本 PR は転記＋実コードとの整合確認 | `38-biz-system-service.md` + `build_doc_to_modules_map()` | Matrix M10, M11 |
| SPEC-CMD11-D5 (ii) | 31 §12.9 | SPEC-CMD11-D5 | 「関数契約は順12 実装 PR で追記する」という凍結前提を本 PR で実体化する | `31-biz-inventory-service.md` §12.9 | Matrix M6, M7 |
| SPEC-CMD11-D5 (iii) | 43 §43.12 | SPEC-CMD11-D5 | settings_cmd test を production CMD test 規範（順5）へ書き換え、validation 単体検証を BIZ test へ分離する。CMD test に validation 単体検証を残す現状維持案は「実 CMD 経由の検証」を欠いたまま冗長化するため却下 | `cmd/settings_cmd.rs` test + `biz/system_service.rs` test | Matrix M8, M12 |
| 実装固有（未凍結。本 PR で新規発見） | `biz/mod.rs` 既存 re-export pattern（`DbConnection`/`PaginatedResult`/`Department`/`Supplier`） | SPEC-CMD11-IMPL-D1 | LAYER_EXCEPTIONS 削除後も `db_err`（backup 用）と command 戻り値型（`AppSetting`/`OperationLog`）が層違反にならないよう、既存 re-export pattern を `DbError`/`AppSetting`/`OperationLog` へ適用する。settings_cmd.rs に `crate::db::` import を残す代替案は AC（layer import 0件）と直接矛盾するため却下 | `biz/mod.rs` | Matrix M2, M9 |
| 実装固有（未凍結。本 PR で新規発見） | `cmd/settings_cmd.rs` 現行 `db_err` 使用箇所 7 件 | SPEC-CMD11-IMPL-D2 | `db_err` を全廃すると Non-scope の backup/restore・`get_backup_dir` 無変更契約と矛盾するため、settings/log 4 箇所のみ除去し backup 3 箇所は維持する scope narrowing を明示する | `cmd/settings_cmd.rs` | Matrix M3, M13 |
| 実装固有（design PR に残存した future-tense、本 PR で発見） | 43/cmd-task-specs/biz-task-specs/31/ARCHITECTURE.md の計 8 箇所 | SPEC-CMD11-IMPL-D3 | 実装完了後も「順12 実装 PR で新設/追記する」という未来形が live source docs に残ると、product-patch packet（PR #36）P2-1 と同型の stale wording drift になる。sweep しない案は将来の読者が現況を誤認するため却下 | 5 doc（Scope 記載） | Matrix M14 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 実装後は `38-biz-system-service.md`（新契約）+ `43`/`cmd-task-specs`/`biz-task-specs`（経路規範、design PR で確定済み）+ `31` §12.9（画像 validation 契約）+ `biz/mod.rs`（re-export の実体）で完結する
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: なし。層経路・validation 所有・restore 不変の durable decision は D-060 として design PR で既に決定済み。本 Packet が新規発見した re-export pattern（SPEC-CMD11-IMPL-D1）・db_err scope narrowing（SPEC-CMD11-IMPL-D2）は実装の内部詳細であり、ADR 相当の durable decision には該当しない（既存 `biz/mod.rs` pattern の適用、新しい設計判断ではない）
- Assumptions and constraints: `architecture_test.rs` の layer 検知は `use crate::{module}` import 行のパターンマッチであり関数呼び出し単位ではない（Contract Probe 参照）。`design_compliance_test.rs` の fn 抽出はコードブロック内 `fn name(` のみ
- Deferred design gaps, risk, and follow-up target: なし。design gap は design PR で全て解消済み（SPEC-CMD11-D1〜D5 で凍結）
- Test Design Matrix can cite design decision IDs or source doc sections: SPEC-CMD11-D2/D3/D5、SPEC-CMD11-IMPL-D1〜D3 を引用
- Absolute guarantee / escape hatch self-check completed: 本 PR は絶対保証を新設しない。restore 系の条件付き保証は 71 §71.7 のまま不変

## Impact Review Lenses

not applicable — 監査起源 design PR（D-060）の凍結契約を実装するコード PR であり、実地調査・実機確認・外部ツール挙動起源ではない。data-safety 隣接（restore 無変更の確認）は Review Focus と Matrix M13 で担保する。

## Design Readiness

- Existing design docs are sufficient because: `43`/`cmd-task-specs`/`biz-task-specs`/`31` §12.9 は design PR で目標形まで確定済み。本 PR に新規設計判断は残っていない
- Source docs updated in this PR: `38-biz-system-service.md`（新設）、`31-biz-inventory-service.md` §12.9（契約追記）、5 doc の wording sweep（現在形化のみ、契約変更なし）
- Design gaps intentionally deferred: なし
- Durable decisions discovered in this plan and promoted to source docs: なし（SPEC-CMD11-IMPL-D1〜D3 は実装の内部詳細であり、既存 pattern の適用）

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 本 PR の主題。CMD → BIZ → IO の標準経路へ settings/log/image を復帰させる
- Backend function design: `38-biz-system-service.md` 新設、`31` §12.9 追記で確定
- Command / DTO / data contract: wire 不変（Boundary / Wire Contract 参照）
- Persistence / transaction / audit impact: なし（DB schema 変更なし、system_repo 関数シグネチャ不変）
- Operator workflow / Japanese UI wording: 不変（error 文言・kind 分類は既存のまま移動）
- Error, empty, retry, and recovery behavior: restore 復旧契約は 71 §71.7 のまま不変。validation error は所有層移動のみで観測可能挙動不変
- Testability and traceability IDs: REQ-902（操作ログ）/ REQ-905（設定/バックアップ）/ REQ-906（画像保存）番号を BIZ test へ引き継ぐ

## Contract Probe

- `architecture_test.rs` の layer 違反検知単位: `find_forbidden_imports`（:79-137）は `use crate::{module}` import 行のパターンマッチであり、関数呼び出し箇所単位ではない → settings_cmd.rs production コードから `use crate::db::` / `use crate::io::` 行そのものを消す必要がある（型参照は biz re-export 経由に置換）。実測: 現行ファイルに `use crate::db::{self, system_repo, DbConnection, PaginatedResult};` と `use crate::io::image_manager;` が各 1 行存在（`rg -c "^use crate::db::"` / `"^use crate::io::"` 共に `1`）
- `biz/mod.rs` の既存 re-export 網羅性: `rg -n "pub use crate::db" src-tauri/src/biz/mod.rs` で `DbConnection` / `PaginatedResult` / `Department` / `Supplier` 等 13 行を確認したが `DbError` / `AppSetting` / `OperationLog` は含まれない → 本 PR で 2 行追加する必要がある（Scope 記載）
- `db_err` 使用箇所の内訳: `rg -n "map_err\(db_err\)" src-tauri/src/cmd/settings_cmd.rs` で 7 箇所を実測。うち `get_settings`(166) / `update_setting`(180) / `list_logs`(203) / `list_log_operation_types`(213) の 4 箇所が settings/log 系（除去対象）、`get_backup_dir`(62) / `create_backup`(228) / `check_auto_backup`(245) の 3 箇所が backup 系（Non-scope、維持）
- `AppSetting` / `OperationLog` の specta 生成への影響: `src-tauri/src/db/system_repo.rs` で両型とも `#[derive(Debug, serde::Serialize, specta::Type)]` 済みであることを確認した。specta はモジュールパスではなく型自体の derive で bindings を生成するため、呼び出し元が CMD から BIZ 経由に変わっても生成される TypeScript 型は変化しない → bindings.ts diff ゼロの前提が成立する
- `save_receipt_image` の配置先: `31-biz-inventory-service.md` §12.9 が既に「returns domain（`receipt_image_path` は返品記録の要素）」と明記済みのため、`biz/inventory_service/returns.rs`（既存 `create_return` を含むモジュール）への追加が設計と整合する

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-CMD11-D2 (i) 設定/ログ 4 command の BIZ-09 経由化 | `biz/system_service.rs` + `cmd/settings_cmd.rs` | Matrix M1, M2 | — |
| SPEC-CMD11-D2 (ii) 日付 validation の BIZ 所有（条件・文言・field 不変） | `biz/system_service.rs`（移動） | Matrix M4, M5 | — |
| SPEC-CMD11-D2 (iii) `From<BizError>` 一元変換への復帰、`db_err`/`validate_log_date_range` の settings/log からの除去 | `cmd/settings_cmd.rs` | Matrix M3, M13 | — |
| SPEC-CMD11-D3 画像保存境界（base64=CMD、拡張子=BIZ、IO 防御維持） | `biz/inventory_service`（returns.rs） + `cmd/settings_cmd.rs` | Matrix M6, M7 | IO 層 `image_manager` は non-scope（無変更） |
| SPEC-CMD11-D4 backup/restore 現状維持 | 変更なし | Matrix M13（negative） | non-scope |
| SPEC-CMD11-D5 (i) `38-biz-system-service.md` 新設 + map 登録 + 必須セクション | `38-biz-system-service.md` + `design_compliance_test.rs` | Matrix M10, M11 | — |
| SPEC-CMD11-D5 (ii) `31` へ save_receipt_image 契約追記 | `31-biz-inventory-service.md` §12.9 | Matrix M6, M7（doc 側は独立レビュー） | — |
| SPEC-CMD11-D5 (iii) production CMD test 規範化 + BIZ test 新設 | `cmd/settings_cmd.rs` test + `biz/system_service.rs` test + `biz/inventory_service` test | Matrix M8, M12 | — |
| SPEC-CMD11-D5 (iv) bindings.ts diff ゼロ | `src/lib/bindings.ts` | Matrix M6 系 negative + AC | 生成物、L3 なし |
| SPEC-CMD11-D5 (vi) `LAYER_EXCEPTIONS` 2 entry 削除 | `architecture_test.rs` | Matrix M9 | — |
| SPEC-CMD11-IMPL-D1 `biz/mod.rs` re-export（`DbError`/`AppSetting`/`OperationLog`） | `biz/mod.rs` | Matrix M2, M9（layer test が間接検証） | — |
| SPEC-CMD11-IMPL-D2 `db_err` scope narrowing（7→3、backup 限定） | `cmd/settings_cmd.rs` | Matrix M3, M13 | — |
| SPEC-CMD11-IMPL-D3 5 doc の未来形注記 sweep | ARCHITECTURE.md / 43 / cmd-task-specs.md / biz-task-specs.md / 31 | Matrix M14（wording sweep） | doc のみ、L3 なし |
| 隣接 contract sweep: `settings_cmd.rs` 全 12 command のうち本 PR で経路が変わるのは 4 (settings/log) + 1 (画像) の計 5 command のみ。残り 7 command（backup/restore 5 + `run_integrity_check`/`fix_integrity` は別 file の `integrity_cmd.rs`）は本 PR の Scope 外で契約に変更なし。除外契約なし | — | 既存 regression（full gate） | non-scope |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-31-settings-service-boundary-impl.md](test-matrices/2026-07-31-settings-service-boundary-impl.md)

- targeted tests: Matrix M1〜M14（機械 token 検査 + mutation 感度検証）
- negative tests: M9（LAYER_EXCEPTIONS 復活 mutant）、M13（backup/restore 無変更の negative diff）
- compatibility checks: M6 系（bindings.ts diff ゼロ）
- data safety checks: docs-only 部分は該当物なし。コード変更は synthetic test DB のみ使用（実店舗 DB・secret 非接触）
- main wiring/integration checks: `cargo test --test architecture_test` + `cargo test --test design_compliance_test` + `cargo run --bin generate_bindings` + `bash scripts/local-ci.sh full`

## Boundary / Wire Contract

- producer: `settings_cmd`（command シグネチャ・DTO 不変）
- consumer: frontend `bindings.ts` 生成物（不変 — command シグネチャ・DTO・kind/message/field 文言は変更しない）
- wire type: 既存のまま（`CmdError.kind` の enum 化は順14 の scope で本 PR では行わない）
- internal type: BIZ 移動後も `BizError::ValidationFailed` / `ValidationFailedAt`（field 付き）→ `From<BizError>` で従来と同一の kind/field/文言に変換される
- precision/range: 変更なし
- round-trip path: 変更なし
- invalid input: 日付 validation・拡張子 validation の条件と文言は移動のみで不変
- compatibility: `cargo run --bin generate_bindings` 後の `git diff --stat src/lib/bindings.ts` が空であることを AC とする

## Review Focus

- `db_err` の scope narrowing が正確か（7→3、settings/log 4 箇所からのみ除去、backup 3 箇所は維持）。全廃・過剰維持のどちらの逸脱もないか
- `LAYER_EXCEPTIONS` 削除が実際に機械 gate として機能するか — 削除後に settings_cmd.rs へ `use crate::db::system_repo;` を仮再挿入する mutation で `cargo test --test architecture_test` が red になることを Final Review で独立再現する
- `biz/mod.rs` の新規 re-export（`DbError`/`AppSetting`/`OperationLog`）が既存 pattern（`DbConnection`/`PaginatedResult`/`Department`/`Supplier`）と一貫した書式か
- 日付/拡張子 validation 移動後も、条件・文言・field が移動前と bit-for-bit 一致するか（BIZ test の期待値が production 定数から導出されず独立転記されているか — 「Test oracle must not share SSOT」の教訓）
- 5 doc の wording sweep が漏れなく行われ、`docs/archive/`・`docs/research/` の履歴記述を誤って書き換えていないか
- mutation kill 主張（M1〜M14）が Final Review で実注入・再現されているか（自己申告のみで採用しない）
- backup/restore 5 command と `get_backup_dir` の git diff が「import 行の変更以外に存在しない」ことを確認したか（Non-scope 契約の保護）
- `38-biz-system-service.md` の必須セクション（関数要求/シグネチャ/処理ステップ/エラーハンドリング）が checker 判定文字列と実際に一致するか

## Spec Contract

Contract ID: SPEC-CMD11-D2, D3, D5（design PR で凍結、本 PR で実装） + SPEC-CMD11-IMPL-D1〜D3（本 PR で新規発見した実装詳細）

- SPEC-CMD11-D2（実装）: `biz::system_service`（BIZ-09）が `get_all_settings` / `upsert_setting` / `list_operation_logs`（日付 validation 所有）/ `list_distinct_operation_types` を提供し、`settings_cmd.rs` は `?` + `From<BizError>` の一元変換のみを行う。`db_err` / `validate_log_date_range` は settings/log 呼び出しから除去される
- SPEC-CMD11-D3（実装）: `biz::inventory_service` が拡張子 validation を所有し `BizError::ValidationFailedAt { field: "extension", .. }` を返す。base64 decode は `settings_cmd.rs` に残留する
- SPEC-CMD11-D5（実装）: `38-biz-system-service.md` 新設 + map 登録、`31` §12.9 契約追記、production CMD test 規範化、`bindings.ts` diff ゼロ、`LAYER_EXCEPTIONS` 2 entry 削除を本 PR で完了する
- SPEC-CMD11-IMPL-D1: `biz/mod.rs` へ `DbError` / `AppSetting` / `OperationLog` を既存 re-export pattern で追加する
- SPEC-CMD11-IMPL-D2: `db_err` の使用箇所を backup 系 3 箇所（`get_backup_dir` / `create_backup` / `check_auto_backup`）に限定し、settings/log 4 箇所からは除去する
- SPEC-CMD11-IMPL-D3: `ARCHITECTURE.md` / `43-cmd-settings-log.md` / `cmd-task-specs.md` / `biz-task-specs.md` / `31-biz-inventory-service.md` の計 8 箇所に残る「順12 実装 PR」未来形注記を、本 PR 完了後の現在形へ更新する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-CMD11-D2 | `biz/system_service.rs` 新設 + `settings_cmd.rs` 書き換え | Matrix M1, M2, M3 | BIZ 経由化と `From<BizError>` 復帰 | cargo test + rg token |
| SPEC-CMD11-D2 (ii) | 日付 validation 移動 | Matrix M4, M5 | 条件・文言・field 不変 | `test_list_logs_req902_date_validation_contract` 系（BIZ 側へ移設後） |
| SPEC-CMD11-D3 | 画像保存境界の実装 | Matrix M6, M7 | 拡張子所有・base64 残留 | `test_save_receipt_image_req905_invalid_extension_to_validation` 系（BIZ 側へ移設後） |
| SPEC-CMD11-D5 (iii) | production CMD test 規範化 | Matrix M8, M12 | 実 command 経由の検証復元 | mock_builder + AppState 呼び出し |
| SPEC-CMD11-D5 (vi) | `LAYER_EXCEPTIONS` 削除 | Matrix M9 | 恒久機械 gate 化の実証 | `cargo test --test architecture_test` + mutation |
| SPEC-CMD11-IMPL-D1 | `biz/mod.rs` re-export 追加 | Matrix M2, M9 | 既存 pattern との一貫性 | rg token |
| SPEC-CMD11-IMPL-D2 | `db_err` scope narrowing | Matrix M3, M13 | 7→3 の内訳が正確か | rg count |
| SPEC-CMD11-IMPL-D3 | wording sweep | Matrix M14 | live source docs の現況一致 | rg token |

## Data Safety

- 実 POS / 店舗 artifact、DB file、backup、log、receipt image、secret は commit しない（synthetic test fixture のみ使用）
- local-only paths: なし
- synthetic-only paths: `src-tauri` 内の各種 `tempfile::tempdir()` ベースの test fixture（既存パターンを維持）

## Implementation Results

### 実装・検証結果（Writer, 2026-07-31）

- 実装 commit: `24f69d146384a29857f64f2da18be70b1200e77d`。X4a 初回 survivor の oracle hardening commit: `df02e9c`（strict 形状判定後に年月日を分解して `from_ymd_opt` へ渡し、`bytes.len() == 10` の除去を観測可能にした）。
- BIZ-09 の 4 関数、returns domain の画像保存、settings/log/image CMD 経路、layer/design gate、38 doc、31 §12.9、5 doc wording sweepを実装した。AMD1 に従い、settings/log DatabaseError は標準 internal 文言、validation triple は逐語不変。
- 個別 gate: `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` / `cargo test`（789件）/ design compliance（1件）/ architecture（1件）/ doc consistency / plan consistency / traceability check が pass。`generate_bindings` 前後の `src/lib/bindings.ts` blob hash はともに `9fae4b34c0572283edbd66a99913e1615e77b9ff`、diff 0。
- review-only sub-agent の初回 finding を是正・独立再確認し、Findings Freeze 後の closure は P1/P2=0。画像 command は Tauri の Wry/MockRuntime 型境界のため actual attribute wrapperから runtime-generic production core へ委譲し、実 command testに加えて wrapper 配線の静的 oracleを追加した。

### Mutation 実測

全注入は commit 後の clean tree から開始し、各 mutant の red を確認後に復元した。最終 `git diff --exit-code` は clean。C9/X9 と C11/X11 は Matrix が明示する mutation 非対象であり、意図的な変更を注入せず、独立 review / negative diff で確認した。

| Mutant | 注入内容 | red oracle / 結果 | Kill |
|---|---|---|---|
| X1 | `get_settings` を `system_repo` 直呼びへ差し戻し | production `system_repo::` count 0 assertion: exit 1 | yes |
| X2 | `DbError` / `AppSetting` / `OperationLog` re-exportを削除 | `cargo check`: unresolved import/type（exit 101） | yes |
| X3a | `get_settings` に `map_err(db_err)` を復活 | `map_err(db_err) == 3` assertion: 4件でexit 1 | yes |
| X3b | `get_backup_dir` から `map_err(db_err)` を除去 | 同 count assertion: 2件でexit 1 | yes |
| X4a | `bytes.len() == 10` を除去 | 日付契約test: `2026-07-01x` を受理してfail（初回はsurvivor、`df02e9c`後に再注入してkill） | yes |
| X4b | `start > end` を `start >= end` へ変更 | 日付契約test: 同日許可assertがfail | yes |
| X4c | 日付形式エラーメッセージを変更 | 日付契約test: 完全一致assertがfail | yes |
| X5a | BIZ拡張子checkを削除 | BIZ invalid-extension test: `ValidationFailedAt` assertがfail | yes |
| X5b | `ValidationFailedAt` を fieldなし `ValidationFailed` へ変更 | BIZ/CMD invalid-extension 2 testがfail | yes |
| X5c | BIZ側へbase64 decodeを注入 | CMD valid-image testがvalidation errorでfail | yes |
| X6a | get-settings CMD testをrepository直呼びへ戻す | `mock_builder == 10` source assertion: 9件でexit 1 | yes |
| X6b | image command wrapperのcore委譲を常時errorへ変更 | wrapper delegation testがfail | yes |
| X7 | productionへ `use crate::db::system_repo;` を再挿入 | architecture test: layer violation 1件でfail | yes |
| X8a | 38 doc map entryを削除 | design compliance: 未登録doc 1件でfail | yes |
| X8b | 38 docの「エラー」記述を除去 | doc consistency M2: 必須記述欠落WARNを検出 | yes |
| X9 | Matrix指定どおりmutationなし | review-onlyで31 §12.9と実装signature/stepsを突合 | n/a |
| X10 | `save_receipt_image` commandへ引数を一時追加 | bindings再生成後のdiff-zero assertion: exit 1 | yes |
| X11 | Non-scopeのためMatrix指定どおりmutationなし | backup/restore 5 commandと`get_backup_dir`本文に差分なし、既存regression pass | n/a |
| X12 | 43 §43.1へ未来形注記を復活 | 5 doc wording count 0 assertion: exit 1 | yes |

### 実装中の判断・逸脱

- Test移設後、`generate_traceability -- --check` がT1 driftとなり、pre-push req-number gateも新CMD test名を拒否した。機械gateを迂回せず test名へREQを付与し、生成正本 `90-traceability.md` を再生成したため、Packetの「再生成不要」という事前予測からは逸脱した。あわせて既存 `test_product_update_request_ordinary_fields_omitted_null_value` のREQ欠落を `req102` 付きへrenameした（assertion/挙動不変）。
- restore本文を一文字も変えず productionの直接DB importを0にするため、`biz::restore_support` は `open_existing_database` 1 symbolだけのprivate re-exportとした。wrapper/BizError変換/BIZ処理は追加せず、runtime呼出先とrestore本文は不変。review-onlyで具体的runtime/contract harmなしとしてP2 dispositionをclosure済み。
- AMD1の狭いinternal文言例外はCoordinator gated Packetを本実装の上位契約として適用した。凍結済み `decision-log` / task-spec契約本文の同期はWriter権限外かつNon-scopeのため変更していない。43 §43.5の旧 `list_operation_logs(conn, &query)` 表現も同じく凍結本文として残し、実signatureの正本は新規38 docとした。
- AMD2 により上記 `biz::restore_support` の disposition は supersede された。facade を削除し、no-create 再接続 symbol は D-060 (a) の正規 lane である `mnt::backup` から再輸出して CMD が参照する形へ是正した。restore の分岐・文言・接続差し替え・kind 3値は変更していない。

## Review Response

- Findings Freeze: frozen after Broad Audit; post-freeze exceptions: none.

### Amendment AMD1（gated、Coordinator 裁定 2026-07-31）

**契約衝突の解消（SPEC-CMD11-IMPL-D4 として追加）**: Writer（Codex）が fail-closed 停止で報告した衝突 — settings/log 4 command を `From<BizError>` 一元変換へ復帰させると、DB 失敗経路の internal message が旧 `db_err` の「データベース処理でエラーが発生しました」から標準の「データベースエラーが発生しました。もう一度お試しください」へ変わり、「kind/message/field 文言不変」と両立しない — を次のとおり裁定する:

- **`From<BizError>` を優先**し、settings/log 4 command の DatabaseError（internal）経路の message は標準文言へ統一されることを本 Amendment で明示的に許可する
- 根拠: (i) 専用変換の温存は D-060 が排除した独自変換経路（監査 P2-1）の再導入で本是正の目的に反する、(ii) message は分岐契約ではない（順8 / D-053 で frontend の message 分岐は禁止済み、分岐は kind のみ。bindings diff ゼロ契約に影響なし）、(iii) 変更後は他 command と同一の標準 DB 失敗文言になり operator 表示は app 全体で一貫する
- 「文言不変」条項の精密化: **validation 文言（条件・field 込み）は逐語不変**のまま維持。internal 系の汎用文言のみ、対象 4 command の DB 失敗経路に限り標準文言へ統一される
- test 追随: 旧 message を固定する `test_list_logs_req902_invalid_page_to_cmderror` は標準文言の完全一致 assert へ更新する（弱体化ではなく新契約の同等固定）
- Final Review 必須観点: message 変更の波及が上記 4 command の DatabaseError 経路のみであること（validation 文言・他 command・restore 系に変化がないこと）を diff で確認する

### Final Review（independent Claude subagent, Sonnet 5。audited = 6b1d0fe）

- mutation X1〜X12 のコード注入型 17 件を独立実注入で全 kill 再現（Writer 表と食い違いなし）。restore 系 6 関数の本文 byte 不変を brace-matching で実証。AMD1 の message 変更は対象 4 command の internal 経路のみを確認
- 論点 3（biz::restore_support）: Coordinator 裁定 = 不採用（AMD2）。Codex 是正 6b1d0fe を narrow re-check し、mnt lane 移設・意味論不変・gate 全 green・bindings hash 不変を確認、**P1/P2 = 0 確定**
- reviewer の一時 mutation 注入による stale IDE 診断が発生したが git status clean を一次確認済み（実害なし）

### Amendment AMD2（gated、Coordinator 裁定 2026-07-31 — Final Review 論点 3）

**`biz::restore_support` facade の不採用と mnt lane への移設（SPEC-CMD11-IMPL-D5 として追加）**:

- Writer が事後開示した `biz::restore_support`（CMD→BIZ→DB の re-export 導管）は**不採用**とする。D-060 (a) が接続所有権交換の正規 exception lane と定めるのは CMD→MNT のみであり、凍結 SPEC に無い未審査経路を P2-1 是正 PR 自身が持ち込むことは Goal Invariant に反する
- 是正: `mnt/backup.rs` に `pub(crate) use crate::db::open_existing_database;`（または同等の薄い no-create open 窓口）を置き、`settings_cmd.rs` は `mnt::backup` 経由で参照する。`biz::restore_support` は削除。restore の意味論（71 §71.7 pattern、no-create、kind 3 値）は不変。call site の token 変更（`db::` → `backup::` 等）は機械的で許容（「1 文字も変更しない」は意味論不変の趣旨であり、import 経路の追随はその範囲内と裁定）
- doc 精密化: `cmd-task-specs.md` の「機械検査する」記述に「検査対象は `use crate::db` / `use crate::io` の直接 import 行であり、re-export 経由の間接依存は対象外（検出強化は backlog）」の 1 文を追加する
- backlog 起票（closeout で Plans.md へ）: architecture_test の re-export 洗浄検出（cmd が biz 経由で db symbol を消費する class）の強化検討
- 再検証: 是正後に architecture_test / cargo test / bindings diff ゼロを再実行し、Final Reviewer が narrow re-check（shim 移設 diff + restore 本文不変 + gate green）を行う

- 凍結契約 SPEC-CMD11-D1〜D5 の写像・db_err 7→3 裁定・LAYER_EXCEPTIONS の import 行 match 機構・biz/mod.rs 再輸出欠落は実コードと一致確認。Matrix の mutation 注入計画・R3 構造も充足、構造欠陥なし
- P2（未来形注記 baseline 7→8、43 §43.12:269 の列挙漏れ）: **accept**。Coordinator 実測（計 8 = 1+1+4+1+1）で確認し 6 箇所を是正
- P3（biz/mod.rs 再輸出 11→13 行）: **accept**。Coordinator 実測 13 で確認し是正
- 判定: 軽微修正後 plan-approved 進行可 → 是正適用済み、**P1/P2 = 0**
