# Plan Packet: 有限 IPC 値の generated enum contract 化 実装 PR1（CmdErrorKind 横断、監査是正 順14）

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 686ca2ad095a2bb61ea02272da75cd789e78c3d0
- Amendments: none
- Coordinator: Claude (Fable 5, main session)
- Writer: Codex (GPT-5.6, owner relay)
- Plan Reviewer: independent Claude subagent (Sonnet 5)
- Final Reviewer: independent Claude subagent (Sonnet 5)
- Reviewed Content HEAD: b29740b95f76f69acaa0e505b16a99bb8ad503f7
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending

Narrative（append-only）:

- 2026-07-31 kickoff -> plan-draft: design PR（D-061、packet `2026-07-31-finite-ipc-enum-design`、archive 済み）が凍結した SPEC-P41-D1〜D5 のうち、実装は 2 PR 分割（PR1 = `CmdErrorKind` 横断・機械的、PR2 = domain family (2)〜(14)）。既定順序は 順12 実装（D-060、PR #51 `b1c5f55` で完了）→ 順14 PR1 → PR2。本 Packet は PR1 の plan-draft であり、production 実装は未着手。Coordinator が read-only 実測を行い、以下を確認した:
  - Rust 側 `kind` 構築サイト: production struct-literal `kind: "..."` が `src-tauri/src/cmd/*.rs` に 22 箇所（doc comment 中の同型記述 5 箇所は除外。`mod.rs` 9 + `daily_report_import_cmd.rs` 5 + `csv_import_cmd.rs` 4 + `settings_cmd.rs`/`sales_cmd.rs`/`plu_export_cmd.rs`/`product_cmd.rs` 各 1）。加えて `mod.rs` の helper 関数本体（`correlated`/`restore`/`restore_with_detail`）に kind literal 引数サイトが 4 箇所（`internal`/`restore_failed_recovered`/`restore_failed_unrecoverable`/`restore_durability_unknown`）。test assertion（`assert_eq!(x.kind, "...")` 系）は `cmd/*.rs` 12 file に計 39 箇所（Plan Review round 1 P2-1 で 36→39 に実測是正: 機械式 rg は単一行前提で `mod.rs:256,260,264` の複数行形 3 箇所を見逃す。真の内訳 = mod.rs 11 + 他 11 file 28。移行漏れ 3 箇所は型不一致の compile error でも捕捉される）
  - frontend 側依存: `src/lib/invoke.ts` の `CMD_ERROR_KIND` const は 8 key のみ（`VALIDATION`/`NOT_FOUND`/`DUPLICATE`/`INTERNAL`/`IMPORT_ERROR`/`IDEMPOTENCY_CONFLICT`/`STOCKTAKE_IN_PROGRESS`/`STOCKTAKE_NOT_IN_PROGRESS`）。設計 doc（40 §5.3 / 55 §55.5）は「`export_error` 欠落の非対称」とのみ言及するが実測では **4 値欠落**（`export_error` に加え `restore_failed_recovered` / `restore_failed_unrecoverable` / `restore_durability_unknown` の restore 3 値も未収録）。同ファイルのローカル `type CmdErrorKind = (typeof CMD_ERROR_KIND)[keyof typeof CMD_ERROR_KIND]` は外部 import 消費者 0（宣言のみ、退役の副作用リスクなし）。`src/features/backup-restore/BackupRestorePage.tsx` は `fatalRestoreKind` を独自の inline literal union `"restore_failed_unrecoverable" | "restore_durability_unknown" | null` として保持し、`restoreErrorKind()` ヘルパーは `string | null` を返す（生成 union に対する narrowing なし）。`src/features/plu-export/PluExportPage.test.tsx:453` に mock `kind: "ValidationFailed"`（PascalCase drift、wire 実値は `"validation"`）を 1 箇所確認 — `kind` が `string` 型のため現状は型検査で捕捉されない
  - `CmdError` は response 専用（Rust 側で command 引数として受け取られることは皆無、production コードに `.kind ==` 比較も 0 件）と実測確認。既存先例 `SalesMode`（response 直出し）の derive は `#[derive(Debug, Clone, serde::Serialize, specta::Type)]`（Deserialize なし、PartialEq/Eq/Copy もなし）。一方 `CmdError.kind` は test で 39 箇所の値比較があるため `SalesMode` そのままの複製では `assert_eq!` が要求する `PartialEq` を満たせない。この差異は design PR 未検討事項であり、本 Packet で Contract Probe として明記する
  - `src/lib/bindings.ts:366` の現行型は `kind: string`（コメントに 12 値の列挙のみ）。enum 化後は `SalesMode`（`export type SalesMode = "by_product" | "by_department";`）と同型の `export type CmdErrorKind = "validation" | ... ;` が生成され、`CmdError.kind: CmdErrorKind` へ変わる想定
  - `mod.rs` の `correlated()` は現在 `tracing::error!(kind, error_id, detail = %detail, ...)` と bare identifier shorthand で `kind: &str` を渡している。`kind` が `CmdErrorKind`（`tracing::Value` 非実装）になると同シンタックスはコンパイルエラーになるため `kind = ?kind`（Debug format）への書き換えが必要になる。これは診断ログの表示文字列を snake_case からRust Debug形式（PascalCase、例: `Internal`)へ変える副作用を伴うが、`docs/function-design/70-mnt-diagnostic-log.md` は `kind` の log 文字列形式を契約化しておらず（実測 0 hit）、既存 test も `logs.contains(error_id)` / `logs.contains(raw_detail)` のみを検査し `kind` 文字列内容は検査していない（実測確認済み）。よって本変化は非契約の副作用として許容する

## Owner Effort Budget

- 介入回数上限: 4
- 実働時間上限: 30分
- relay 往復上限: 3

既定値（3/30分/2）に対し、Codex owner-relay 実装 + Sonnet 独立 Plan Review + Final Review を見込み、介入・relay を各 1 回上乗せする（順12 実装 PR の実績構成を踏襲）。
既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5を使わないchangeは両方`none`のままにする。

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
`CmdError.kind` は全 Tauri command のエラー経路（12 種の kind 値、restore 系 3 値を含む）を横断する共有 wire 型であり、`bindings.ts` の生成物契約（型強化）と frontend 全 consumer（`invoke.ts` / `describe-error.ts` / csv-import・stocktake・backup-restore・import flow 群）に波及する。Tauri command DTO の型変更と生成物 diff を伴うため R3 tier（DEV_WORKFLOW.md Risk Tiers「Tauri command DTO」該当）。restore 系 kind 3 値は data-safety 隣接（68 §68.7 / 71 §71.7）だが、値・分岐・表示文言・接続所有権パターンは本 PR で一切変更しない（型のみ強化）。

Rollback は本 PR の実装 commit revert。`kind` の wire 文字列・分岐・error_id 相関・restore 意味論は不変のため、revert 時の追加復旧作業は不要。

## Goal

Goal Invariant: `CmdError.kind` が Rust 側 generated enum `CmdErrorKind`（12 値、`#[serde(rename_all = "snake_case")]` で現行 wire 文字列と 1:1 完全一致）で型検査され、frontend が bindings 由来の literal union で分岐する状態になる。frontend の手動定数 `CMD_ERROR_KIND`（4 値欠落の非対称）・手動 union（`BackupRestorePage.tsx` の `fatalRestoreKind`）・test mock の PascalCase drift（`PluExportPage.test.tsx`）が退役し、片側 variant 変更が typecheck で検出される。利用者可視の error 挙動・文言・restore 意味論は一切変更しない。

### 最小完了条件

- `src-tauri/src/cmd/mod.rs` に `CmdErrorKind`（12 variant）が定義され、`CmdError.kind: CmdErrorKind`
- production の全 kind 構築サイト（struct-literal 22 + helper-literal 4 = 26）が `CmdErrorKind::Variant` 経由に統一され、`kind: "..."` の生文字列構築が cmd 層に残らない
- 39 箇所の test assertion が `CmdErrorKind::Variant` 比較へ移行し、`cargo test`（src-tauri 全体）が pass する
- `bindings.ts` 再生成後 `CmdErrorKind` literal union（12 値）が生成され、diff が「型強化のみ」（wire 文字列・値集合・他型は不変）である
- `src/lib/invoke.ts` の `CMD_ERROR_KIND` が 12 key（`export_error` + restore 3 値を含む）へ拡張され、bindings 由来 `CmdErrorKind` に対して exhaustive に型検査される
- `PluExportPage.test.tsx` の PascalCase drift が是正され、同種の drift が型検査で機械的に阻止される状態になる

### 失敗定義

- restore 3 値（`restore_failed_recovered` / `restore_failed_unrecoverable` / `restore_durability_unknown`）の値・分岐・表示文言・接続所有権パターン（68 §68.7 / 71 §71.7）が変わる
- wire 表現（12 値の snake_case 文字列）が現行と 1 文字でも異なる
- `message` / `field` / `error_id` の契約（CMD-ERR-D1/D2）が変わる
- frontend の kind 別表示・recoverTo 分岐（55 §55.5 マトリクス）が変わる
- domain family (2)〜(14) のコード変更に踏み込む

### 非目的

- domain family (2)〜(14) のコード変更（PR2 の scope）
- restore orchestration の意味論・接続所有権交換パターンの変更（`mem::replace` / `handle_restore_failure` 等は現状維持）
- `docs/function-design/70-mnt-diagnostic-log.md` への新規契約追加（kind の log 表示形式は非契約のまま維持する。過剰文書化を避ける）
- `Plans.md` の active packet link 追加（Coordinator が plan-first commit で実施済み — P3-4 で現状同期）
- `41-cmd-pos.md` §17.4 の変更（実測により「CmdErrorKind の variant となる」という現在形記述に pending 注記が無く、sweep 不要と確認済み）

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

### Rust (`src-tauri/src/cmd/`)

- `src-tauri/src/cmd/mod.rs`:
  - `CmdErrorKind` enum を新設: `#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, specta::Type)]` + `#[serde(rename_all = "snake_case")]`。variant は `Validation` / `Duplicate` / `NotFound` / `Internal` / `ImportError` / `ExportError` / `IdempotencyConflict` / `StocktakeInProgress` / `StocktakeNotInProgress` / `RestoreFailedRecovered` / `RestoreFailedUnrecoverable` / `RestoreDurabilityUnknown` の 12 個（`rename_all = "snake_case"` により現行 wire 文字列と自動 1:1 一致）
  - `CmdError.kind: String` → `kind: CmdErrorKind`（doc comment も value 列挙から enum 参照へ更新）
  - `internal` / `restore_failed_recovered` / `restore_failed_unrecoverable` / `restore_durability_unknown` / `restore` / `restore_with_detail` / `correlated` の各 helper シグネチャを `kind: &str` → `kind: CmdErrorKind` へ変更
  - `correlated()` 内の `tracing::error!(kind, ...)` を `tracing::error!(kind = ?kind, ...)` へ変更（SPEC-P41-PR1-D3。診断ログの表示形式のみの非契約変化）
  - `impl From<BizError> for CmdError` の 9 match-arm struct literal（`kind: "validation".to_string()` 等）を `CmdErrorKind::Variant` へ置換
  - `mod.rs` 内 test module の 11 箇所（assert 8 + `"restore_..."` 文字列比較 3）を `CmdErrorKind::Variant` 比較へ移行
- `daily_report_import_cmd.rs`（5 箇所）/ `csv_import_cmd.rs`（4 箇所）/ `settings_cmd.rs`（1 箇所、L311 base64 decode validation）/ `sales_cmd.rs`（1 箇所、L61-62 mode validation）/ `plu_export_cmd.rs`（1 箇所、L77-78 `parse_export_mode`）/ `product_cmd.rs`（1 箇所、L124-125）の計 13 箇所の manual `CmdError { kind: "...".to_string(), .. }` を `CmdErrorKind::Variant` へ置換
- 上記 7 file 中、test assertion が存在する `daily_report_import_cmd.rs`（5）/ `stocktake_cmd.rs`（3）/ `sales_cmd.rs`（2）/ `return_cmd.rs`（1）/ `receiving_cmd.rs`（1）/ `product_cmd.rs`（2）/ `settings_cmd.rs`（10）/ `manual_sale_cmd.rs`（1）/ `inventory_cmd.rs`（1）/ `integrity_cmd.rs`（1）/ `disposal_cmd.rs`（1）の計 28 箇所（`mod.rs` の 11 を含めた総計 39。round 1 P2-1 で内訳算 25→28 を是正）を `CmdErrorKind::Variant` 比較へ移行。`mod.rs` の複数行形 3 箇所（:256,260,264）は rg 機械式の対象外のため、移行完了は cargo build の型検査 + 全 test pass で確認する
- `bindings.ts` 再生成（`cd src-tauri && cargo run --bin generate_bindings`）で `CmdErrorKind` literal union の出現と、diff が型強化のみであることを確認する

### Frontend

- `src/lib/invoke.ts`: `CMD_ERROR_KIND` const を 12 key（既存 8 + `EXPORT_ERROR: "export_error"` / `RESTORE_FAILED_RECOVERED: "restore_failed_recovered"` / `RESTORE_FAILED_UNRECOVERABLE: "restore_failed_unrecoverable"` / `RESTORE_DURABILITY_UNKNOWN: "restore_durability_unknown"`）へ拡張し、`satisfies Record<import("./bindings").CmdErrorKind, import("./bindings").CmdErrorKind>`（同等の exhaustive 制約）を付与して生成 union に対する網羅性を機械検査にする。ローカル `type CmdErrorKind = (typeof CMD_ERROR_KIND)[keyof typeof CMD_ERROR_KIND]` は `export type { CmdErrorKind } from "./bindings";` へ置換する（外部消費者 0 のため後方互換影響なし、実測確認済み）
- `src/features/backup-restore/BackupRestorePage.tsx`: `fatalRestoreKind` の型を独自 literal union から `Extract<CmdErrorKind, "restore_failed_unrecoverable" | "restore_durability_unknown"> | null` へ変更（bindings 由来型からの派生に変更、値・分岐・表示文言は不変）。`restoreErrorKind()` の戻り値型を `string | null` から `CmdErrorKind | null` へ narrowing する
- `src/features/plu-export/PluExportPage.test.tsx:453`: `kind: "ValidationFailed"` を `kind: "validation"` へ修正（PascalCase drift 是正。既存 assertion の対象は backup warning 表示のみで `kind` 値そのものへの依存はないため挙動不変）
- 隣接 wording sweep: `docs/function-design/40-cmd-product.md` §5.3（derive 記述の精度是正 + 現在形化）、`docs/function-design/55-ui-csv-import.md` §55.5/§55.9（`CMD_ERROR_KIND` 記述の現在形化 + 欠落値の訂正記述: 「`export_error` 欠落」のみでなく restore 3 値も含む 4 値欠落だった旨を明記）、`docs/function-design/68-ui-backup-restore.md` §68.7（現在形化のみ、値・分岐・文言は不変）

## Non-scope

- domain family (2)〜(14) のコード・doc 変更一切（PR2、別 Packet）
- `src-tauri/src/biz/` / `src-tauri/src/db/` / `src-tauri/src/mnt/` への変更（`CmdError` は CMD 層専用型であり、production code に `.kind ==` 比較が 0 件であることを実測確認済み。BIZ/DB/MNT 層は無変更）
- restore orchestration のコード変更一切（`mem::replace` pattern / `handle_restore_failure` / `terminal_restore_error` の分岐ロジックは現位置・現ロジックのまま。型の引数が `&str` → `CmdErrorKind` になるのみ）
- `StocktakePage.tsx` の inline literal 比較（`error.cmdError.kind === "stocktake_not_in_progress"` 等）を `CMD_ERROR_KIND` const 経由の書き換えへ統一する行為（値は生成 union で既に型検査されるため機能的に不要、任意の統一美化は非目的）
- `docs/function-design/41-cmd-pos.md` §17.4 の変更（実測により pending 注記なしと確認済み、対象外）
- `docs/function-design/70-mnt-diagnostic-log.md` への新規契約追加
- `message` / `field` / `error_id` の wire 契約・文言変更
- `Plans.md` の active packet link 追加（Coordinator 実施）

## Acceptance Criteria

- `rg -c "enum CmdErrorKind" src-tauri/src/cmd/mod.rs` → `1`（baseline 0 実測）
- `rg -c "pub kind: String" src-tauri/src/cmd/mod.rs` → `0`（baseline 1 実測）/ `rg -c "pub kind: CmdErrorKind" src-tauri/src/cmd/mod.rs` → `1`
- `rg -n 'kind: "' src-tauri/src/cmd/*.rs | rg -v '///' | wc -l` → `0`（baseline 22 実測、doc comment 中の同型記述 5 件は対象外）
- `rg -c '\.kind,\s*"' src-tauri/src/cmd/*.rs | awk -F: '{s+=$2} END{print s}'` → `0`（baseline は単一行形のみで 36。複数行形 3 を加えた真値 39 — P2-1 参照。oracle は単一行形の 0 化 + compile 成功の組で判定）
- `cargo build`（src-tauri）exit 0
- `cargo test`（src-tauri 全体）PASS、既存 test 件数以上（削除・skip なし）
- `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cargo test --test architecture_test` / `cargo test --test design_compliance_test` PASS（layer/doc gate に回帰なし）
- `cd src-tauri && cargo run --bin generate_bindings` 実行後 `rg -c "^export type CmdErrorKind" src/lib/bindings.ts` → `1`
- `rg -c "kind: string" src/lib/bindings.ts` → `0`（baseline 1 実測、`CmdError` 型定義部分）/ `rg -c "kind: CmdErrorKind" src/lib/bindings.ts` → `1`
- `git diff --stat src/lib/bindings.ts` の diff が `CmdError`/`CmdErrorKind` の型強化のみであることを Review Focus で確認する（他 command のシグネチャ変化が無いこと）
- `rg -c '^\s*[A-Z_]+: "' src/lib/invoke.ts` → `12`（baseline 8 実測、`CMD_ERROR_KIND` 定義域）
- `rg -c "EXPORT_ERROR|RESTORE_FAILED_RECOVERED|RESTORE_FAILED_UNRECOVERABLE|RESTORE_DURABILITY_UNKNOWN" src/lib/invoke.ts` → `4`（baseline 0 実測）
- `rg -c 'kind: "ValidationFailed"' src/features/plu-export/PluExportPage.test.tsx` → `0`（baseline 1 実測）
- `npx tsc --noEmit` PASS（frontend 型検査、生成 union との exhaustive 整合を含む）
- `npm test`（Vitest 全体）PASS
- `rg -c "それまでの現行実装は" docs/function-design/40-cmd-product.md` → `0`（baseline 1 実測）
- `rg -c "順14 実装 PR1 で追随" docs/function-design/40-cmd-product.md` → `0`（baseline 1 実測）
- `rg -c "へ置換される（順14 実装 PR1" docs/function-design/55-ui-csv-import.md` → `0`（baseline 1 実測）
- `rg -c "に変わるのみ（順14 実装 PR1 で追随）" docs/function-design/68-ui-backup-restore.md` → `0`（baseline 1 実測）
- `bash scripts/doc-consistency-check.sh --target plan` — PK4 の Plans.md link 不足 warn は許容（Coordinator が Plan Gate 後に追加）。PK1/PK2/PK3 は fail しないこと
- `git diff --stat main...HEAD` に `src-tauri/src/biz/` `src-tauri/src/db/` `src-tauri/src/mnt/` が現れない（domain family 側 non-scope の保護）
- Matrix `C1`〜`C8` の mutation全量（X1〜X7）を Coordinator が `cargo test` / `npx tsc --noEmit` で独立再実測し、各 red、復元後 green、survivor 0

## Design Sources

- Requirements / spec: `docs/research/audit-2026-07/report.md` 順14 / `findings/p4-type-contracts.md` P4-1
- Architecture: `docs/ARCHITECTURE.md`（wire 型変換の CMD 境界規定、D-060 改訂後の呼び出し原則）
- Function / command / DTO: `40-cmd-product.md` §5.3（CmdErrorKind 契約本体）、`55-ui-csv-import.md` §55.5/§55.9（frontend 判別・`CMD_ERROR_KIND` 記述）、`68-ui-backup-restore.md` §68.7（restore 3 値の表示契約、意味論不変の確認元）、`71-mnt-backup.md` §71.7（見直し契機消化済み、参照のみ・変更なし）
- Decision log / ADR: D-053（error_id 相関）、D-060（層境界、順12 実装で確定済み）、D-061（本 PR が実装する凍結契約。(a) 共通 pattern、(d) CmdErrorKind 12 値）
- 生成基盤: `src-tauri/src/lib.rs` `export_specta_bindings()`、`src-tauri/src/biz/sales_service.rs`（`SalesMode`/`SalesReportType` の derive 先例）、`docs/UI_TECH_STACK.md` §2.5
- 実装先例: `src-tauri/src/cmd/stocktake_cmd.rs`（production CMD test 規範、順5 = PR #22）、順12 実装 packet（`archive/plans/2026-07-31-settings-service-boundary-impl.md`、mutation 実測・Amendment 運用の型）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend command / error / generated binding | `40-cmd-product.md` §5.3（derive 精度是正 + 現在形化） | updated in this PR |
| Command / DTO / generated binding / wire shape | 同上 + `55-ui-csv-import.md` §55.5/§55.9 / `68-ui-backup-restore.md` §68.7 | updated in this PR（現在形化のみ、値・分岐は不変） |
| 反復言及 doc（41-cmd-pos.md §17.4 等） | 実測により pending 注記なしと確認済み | existing sufficient（対象外） |
| Durable decision / ADR | `docs/decision-log.md` D-061（既存、本 PR は実装のみ。新規 ADR なし） | existing sufficient |
| Process（active packet link） | `Plans.md` | Coordinator が Plan Gate 後に追加（本 PR の Scope 外） |

## Registration / Generation Obligations

該当なし。本 PR は新規 command / 新規 doc file / 新規 route を追加しない（既存 `CmdError` 型の `kind` field 型強化のみ）。`bindings.ts` は再生成するが `collect_commands!` 登録の変更はない。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| 監査 P4-1（型二重定義、CmdErrorKind） | 40 §5.3 | D-061 (a)/(d) | `CmdError.kind` を generated enum 化。String 維持案は P4-1 の中核（型検査欠落）を残すため却下 | `cmd/mod.rs` + 全 cmd/*.rs | Matrix C1, C2 |
| 実装固有（本 PR で新規発見） | `biz/sales_service.rs`（`SalesMode` derive 先例） | SPEC-P41-PR1-D1 | `CmdError` は response 専用（production `.kind ==` 比較 0 件を実測）。`SalesMode` 先例（`Debug, Clone, Serialize, specta::Type`、Deserialize なし）を踏襲しつつ、既存 39 箇所の test assertion（`assert_eq!`）を満たすため `PartialEq, Eq, Copy` を追加する。Deserialize 追加案は wire 方向に存在しない round-trip を偽装するため却下 | `cmd/mod.rs` の `CmdErrorKind` derive | Matrix C1 |
| 実装固有（本 PR で新規発見） | `cmd/mod.rs` の `correlated()` | SPEC-P41-PR1-D3 | `tracing::error!(kind, ...)` の bare identifier shorthand は `CmdErrorKind`（`tracing::Value` 非実装）でコンパイル不能になるため `kind = ?kind`（Debug format）へ変更する。診断ログの表示形式が snake_case から PascalCase Debug 形式へ変わるが `70-mnt-diagnostic-log.md` は log 文字列形式を契約化せず（実測 0 hit）、既存 test も `kind` 文字列内容を検査しない（実測確認済み）ため非契約の許容変化とする。独自 `Display` 実装で snake_case を維持する案は serde rename との二重 SSOT になり drift リスクを増やすため却下 | `cmd/mod.rs` `correlated()` | Matrix C8 |
| D-061 (d) frontend 側置換 | 55 §55.5 | SPEC-P41-PR1-D4 | `CMD_ERROR_KIND` を 12 key へ拡張し、生成 `CmdErrorKind` union に対する exhaustive 型注釈で網羅性を機械検査する。const を撤去し全呼び出し元を生 literal 比較へ書き換える案は 4 箇所の consumer（ErrorState.tsx / useCsvImportFlow.ts / useProductImportFlow.ts / useDailyReportImportFlow.ts）を不要に変更するため却下 | `src/lib/invoke.ts` | Matrix C5, C6 |
| 実装固有（本 PR で新規発見） | `BackupRestorePage.tsx` | SPEC-P41-PR1-D4 派生 | `fatalRestoreKind` の独自 union を `Extract<CmdErrorKind, ...>` へ派生させ、生成 union からの独立性（drift リスク）を解消する | `BackupRestorePage.tsx` | Matrix C7 |
| 監査 P4-1（test mock drift の実例） | `PluExportPage.test.tsx` | D-061 (d) | 既存 PascalCase drift（`kind: "ValidationFailed"`）が現状 `kind: string` のため型検査で捕捉されないことを実測確認。是正 + 型強化後は同種 drift が機械的に阻止される | `PluExportPage.test.tsx` | Matrix C6 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history: 改訂後は 40 §5.3（derive 精度含む契約本体）+ 55 §55.5/§55.9（frontend 判別の現況）+ 68 §68.7（restore 意味論不変の確認）で完結する
- Plan-only durable decisions promoted: なし。D-061 は design PR で既に確定済み。本 Packet が新規発見した derive 精度（SPEC-P41-PR1-D1）・診断ログ副作用（SPEC-P41-PR1-D3）・frontend exhaustiveness 手法（SPEC-P41-PR1-D4）は実装の内部詳細であり、ADR 相当の durable decision には該当しない
- Assumptions and constraints: `tauri-specta` の型収集は command シグネチャの型グラフ自動収集（順14 design PR で実証済み）。`rename_all = "snake_case"` は Rust 変体名から自動導出するため、本 Packet が指定する 12 variant 名（`Validation` 等）は現行 wire 文字列と 1:1 一致することを手動確認済み
- Deferred design gaps: なし。derive 精度・診断ログ副作用は本 Packet で解決済み
- Test Design Matrix can cite design decision IDs: D-061 (a)/(d)、SPEC-P41-PR1-D1/D3/D4 を引用
- Absolute guarantee / escape hatch self-check: 本 PR は絶対保証を新設しない。restore 系の条件付き保証は 71 §71.7 のまま不変

## Impact Review Lenses

not applicable — 監査起源の design PR（D-061）の凍結契約を実装する機械的コード PR。data-safety 隣接（restore kind の型強化）は「値・分岐意味論不変」を Review Focus と Matrix C3/C7 で担保する。

## Design Readiness

- Existing design docs are sufficient because: 40 §5.3 が derive の共通方針・12 値を確定済み。本 PR に新規設計判断は残っていない（derive 精度・診断ログ副作用は実装詳細として本 Packet が吸収）
- Source docs updated in this PR: 40 §5.3（derive 精度是正 + 現在形化）、55 §55.5/§55.9（現在形化 + 欠落値の訂正記述）、68 §68.7（現在形化のみ）
- Design gaps intentionally deferred: なし
- Durable decisions discovered in this plan and promoted to source docs: なし（SPEC-P41-PR1-D1/D3/D4 は実装の内部詳細）

Minimum design checks for business-app work:

- Layer ownership: `CmdError` は CMD 層専有型。BIZ/DB/MNT は無変更（production `.kind ==` 比較 0 件を実測確認済み）
- Backend function design: `cmd/mod.rs` の enum 定義 + 全 cmd/*.rs の construction site 更新で確定
- Command / DTO / data contract: wire 表現不変、型のみ強化。bindings 再生成 diff は literal union 化のみ
- Persistence / transaction / audit impact: なし
- Operator workflow / Japanese UI wording: 不変（message/field 文言は変更しない）
- Error, empty, retry, and recovery behavior: kind の値・分岐・restore 3 値の表示契約（68 §68.7）は不変
- Testability and traceability IDs: 既存 test の REQ 番号を維持したまま assertion 対象のみ `CmdErrorKind::Variant` へ移行

## Contract Probe

- `CmdError` の response-only 性: `rg -rn '\.kind,\s*"' src-tauri/src/biz src-tauri/src/mnt src-tauri/src/db` で 0 hit を実測。production Rust コードが `kind` を再消費（分岐・比較）する箇所は存在しない → Deserialize 不要（SPEC-P41-PR1-D1）
- `SalesMode` derive 先例: `src-tauri/src/biz/sales_service.rs` で `#[derive(Debug, Clone, serde::Serialize, specta::Type)]`（PartialEq なし）を実読確認。`CmdErrorKind` は既存 39 箇所の `assert_eq!` を満たすため `PartialEq, Eq, Copy` を追加した独自 derive セットとする（`SalesMode` の完全複製ではない、本 PR の新規判断）
- 診断ログ副作用: `tracing::error!(kind, ...)` の bare identifier shorthand は `kind: &str` 前提（`&str` は built-in `tracing::Value` 実装を持つ）。`CmdErrorKind`（独自 enum、`tracing::Value` 非実装）へ変更するとコンパイル不能になるため `kind = ?kind` への書き換えが必須と実測確認。`docs/function-design/70-mnt-diagnostic-log.md` に `kind` の文字列一覧 0 hit（契約化されていない）、`mod.rs` の既存 log-capture test も `error_id`/`raw_detail` のみを検査し `kind` 文字列内容を検査しないことを実測確認 → 非契約の許容副作用と判定
- frontend `CMD_ERROR_KIND` の欠落実態: 設計 doc（40 §5.3 / 55 §55.5）は「`export_error` 欠落の非対称」とのみ記載するが、`src/lib/invoke.ts` を実読すると 8 key中に `export_error` に加え restore 3 値も存在せず、**4 値欠落**であることを実測確認。本 Packet はこの精度差を Scope/AC に反映する（55 の wording sweep で訂正記述を追加）
- `bindings.ts` の現行 `CmdError` 型: `kind: string`（L366、コメントに 12 値の自由記述のみ）であることを実測確認。`SalesMode` の生成形（`export type SalesMode = "by_product" | "by_department";`）を precedent として `CmdErrorKind` も同型の literal union で生成される見込み

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-061 (a)/(d) CmdErrorKind 12 値・生成 enum 化 | `cmd/mod.rs` + 全 cmd/*.rs | Matrix C1, C2, C3 | — |
| SPEC-P41-PR1-D1 derive 精度（response-only、PartialEq/Eq/Copy 追加） | `cmd/mod.rs` の `CmdErrorKind` derive | Matrix C1 | — |
| SPEC-P41-PR1-D3 診断ログ副作用の許容 | `cmd/mod.rs` `correlated()` | Matrix C8 | 非契約、review-only |
| SPEC-P41-PR1-D4 frontend `CMD_ERROR_KIND` 12 key 化 + exhaustive 型注釈 | `src/lib/invoke.ts` | Matrix C5, C6 | — |
| SPEC-P41-PR1-D4 派生: `BackupRestorePage.tsx` 独自 union の生成型派生化 | `BackupRestorePage.tsx` | Matrix C7 | — |
| 既存 drift 是正: `PluExportPage.test.tsx` PascalCase drift | `PluExportPage.test.tsx` | Matrix C6 | — |
| `bindings.ts` 再生成 diff の型強化限定 | `src/lib/bindings.ts` | Matrix C4 | 生成物、L3 なし |
| 隣接 contract sweep: 40/55/68 の現在形化。値・分岐・文言は不変で注記のみ更新 | 3 doc | 独立レビューで再確認 | doc のみ、L3 なし |
| restore 3 値の意味論・分岐・表示契約不変（68 §68.7 / 71 §71.7） | 変更なし | Matrix C3, C7（negative） | non-scope（値・分岐） |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-31-finite-ipc-enum-impl-pr1.md](test-matrices/2026-07-31-finite-ipc-enum-impl-pr1.md)

- targeted tests: Matrix C1〜C8（機械 token + mutation 感度検証）
- negative tests: C3（既存 test 39 箇所の regression）、C7（restore 意味論 negative diff）
- compatibility checks: C4（bindings.ts diff = 型強化のみ）
- data safety checks: 実 artifact なし。restore 系コードパスは無変更のため既存 synthetic test で回帰確認
- main wiring/integration checks: `cargo test` + `cargo test --test architecture_test` + `cargo test --test design_compliance_test` + `npx tsc --noEmit` + `npm test` + `bash scripts/local-ci.sh full`

## Boundary / Wire Contract

- producer: `src-tauri/src/cmd/mod.rs`（`CmdErrorKind` を SSOT とする Rust enum）
- consumer: `src/lib/bindings.ts` 生成 literal union → `src/lib/invoke.ts` / 各 feature の kind 分岐
- wire type: 現行 12 個の snake_case 文字列と 1:1 完全一致（`rename_all = "snake_case"` による自動導出、正常値の wire 表現不変が不変条件）
- internal type: Rust `CmdErrorKind` enum（`Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, specta::Type`）
- precision/range: 値集合は現状凍結（12 値、追加・改名なし）
- round-trip path: response のみ（`CmdError` は command 引数として使われない。Deserialize 不要と実測確認済み）
- invalid input: not applicable（response 専用のため不正値の受信経路自体が存在しない。SPEC-P41-D5 (v) の probe 義務はこの family では対象外＝response-only のため）
- compatibility: bindings 再生成 diff が「`CmdError.kind` の型強化（`string` → `CmdErrorKind`）+ `CmdErrorKind` 型の新規 export」のみであることを Review Focus で確認する

## Review Focus

- `CmdErrorKind` の 12 variant 名が `rename_all = "snake_case"` を通じて現行 wire 文字列（12 個）と厳密に 1:1 一致するか（variant 名のタイプミスが即 wire drift になる、Rust コンパイラでは検出できない唯一のリスク面）
- production の全 kind 構築サイト（22 struct-literal + 4 helper-literal = 26）が漏れなく `CmdErrorKind::Variant` へ移行しているか（`rg 'kind: "'` の baseline 22 → 0 で機械確認）
- 39 箇所の test assertion が弱体化（`assert_eq!` → `assert!(true)` 等）されずに移行されているか
- `tracing::error!(kind = ?kind, ...)` への変更が既存 log-capture test（`error_id`/`raw_detail` 検査）を壊さないか
- frontend `CMD_ERROR_KIND` の exhaustive 型注釈が実際に機能するか（Final Review で 1 key を一時削除し `tsc` が red になることを実注入確認）
- `BackupRestorePage.tsx` の `fatalRestoreKind` 派生型変更後も restore 3 値の表示文言・分岐が bit-for-bit 不変か
- `PluExportPage.test.tsx` の drift 是正後、同種の PascalCase mock を再注入すると `tsc` が red になるか（D-061 の本来目的そのものの実証）
- restore 系 6 関数の本文が本 PR で意味論的に変わっていないか（引数型が `&str` → `CmdErrorKind` になる以外の diff がないこと）
- mutation kill 主張（C1〜C8）が Final Review で実注入・再現されているか（自己申告のみで採用しない）

## Spec Contract

Contract ID: D-061 (a), (d)（design PR で凍結、本 PR で実装） + SPEC-P41-PR1-D1, D3, D4（本 PR で新規発見した実装詳細）

- D-061 (a)（実装）: `CmdErrorKind` を `#[derive(..., serde::Serialize, specta::Type)]` + `#[serde(rename_all = "snake_case")]` の generated enum として実装する
- D-061 (d)（実装）: `CmdError.kind: CmdErrorKind`（12 値）。値・分岐・error_id 相関・restore 3 値の表示契約は不変。frontend の手動定数・手動 union を bindings 由来型へ置換する
- SPEC-P41-PR1-D1: `CmdErrorKind` は response 専用のため Deserialize を derive しない。既存 test assertion 対応のため `PartialEq, Eq, Copy` を追加する（`SalesMode` 先例からの意図的な差分拡張）
- SPEC-P41-PR1-D3: `correlated()` の診断ログ出力形式変化（snake_case → Debug PascalCase）を、無契約であることの実測確認を根拠に許容する
- SPEC-P41-PR1-D4: `src/lib/invoke.ts` の `CMD_ERROR_KIND` を 12 key へ拡張し、生成 `CmdErrorKind` に対する exhaustive 型注釈で網羅性を機械検査する。`BackupRestorePage.tsx` の独自 union を生成型からの `Extract` 派生へ変更する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| D-061 (a)/(d) | `cmd/mod.rs` enum 新設 + 全 construction site 移行 | Matrix C1, C2 | wire 文字列 1:1 一致 | rg token + cargo test |
| SPEC-P41-PR1-D1 | derive セット決定 | Matrix C1 | response-only の妥当性 | Contract Probe 実測 |
| SPEC-P41-PR1-D3 | `correlated()` の tracing 書き換え | Matrix C8 | 診断ログ非契約変化の確認 | 独立レビュー |
| SPEC-P41-PR1-D4 | frontend `CMD_ERROR_KIND` 拡張 + `BackupRestorePage.tsx` 派生型化 | Matrix C5, C6, C7 | exhaustiveness の実効性 | tsc 実注入 |
| D-061 (d) 派生 | `PluExportPage.test.tsx` drift 是正 | Matrix C6 | 同種 drift の型検査阻止 | tsc 実注入 |

## Data Safety

- 実 POS / 店舗 artifact、DB file、backup、log、receipt image、secret は commit しない（コード変更は synthetic test のみ使用）
- local-only paths: なし
- synthetic-only paths: `src-tauri` 内の既存 test fixture を維持（新規 fixture 追加なし）

## Implementation Results

- TDD: `cmd::tests::test_cmd_error_req905_from_import_error` の assertion を先に `CmdErrorKind::ImportError` へ変更し、未定義型による compile failure を RED として確認後、enum 本体と構築 site を実装して GREEN を確認した。
- Rust: `CmdErrorKind` 12 variant を response 専用 derive で新設し、production 26 site と既存 assertion 39 箇所を enum 比較へ移行した。`correlated()` は `kind = ?kind` とし、message / field / error_id・restore 接続所有権処理は変更していない。
- Frontend / generated: bindings を再生成して `CmdError.kind: CmdErrorKind` + 12 値 literal union を生成した。`CMD_ERROR_KIND` は generated union から導く exhaustive map、restore state と kind 依存 test helper は bindings 由来型へ移行し、PascalCase mock drift を是正した。
- Docs: 40 §5.3 / 55 §55.5・§55.9 / 68 §68.7 を実装後の現在形へ同期した。domain family (2)〜(14)、BIZ/DB/MNT、restore の値・分岐・表示文言は無変更。
- Gate: Rust fmt / clippy / full test / architecture / design compliance、frontend typecheck / lint / format / full test / build、bindings 再生成、doc consistency（full + plan）を実装 commit 前に PASS。最終 exact-HEAD の L1 full と件数は PR body を正本とする。
- Bindings blob: 実装前 `9fae4b34c0572283edbd66a99913e1615e77b9ff` → 実装後 `4623f29bfb1345f21281459ea73c2d458030a5d0`。X1/X4 復元後の再生成でも実装後 blob に一致し、差分は `CmdError.kind` の型強化と `CmdErrorKind` export のみ。

### Mutation 実測（clean commit `f3f9413`）

| Mutation | 注入 | RED oracle | 結果 |
|---|---|---|---|
| X1 | `rename_all = "snake_case"` を削除 | bindings 再生成 | 12 値が PascalCase へ変化し検出。復元・再生成後 clean |
| X2 | `product_cmd.rs` を旧 `String` 構築へ戻す | `cargo build` | `expected CmdErrorKind, found String` で compile failure |
| X3 | recovered assertion の期待 variant を unrecoverable へ交換 | restore kind 単体 test | left/right variant 不一致で failure |
| X4 | 13 番目の `Dummy` variant を追加 | bindings 再生成 | literal union への `dummy` 追加を検出。復元・再生成後 clean |
| X5 | `CMD_ERROR_KIND.EXPORT_ERROR` を削除 | `npx tsc --noEmit` | exhaustive map の property 欠落で type error |
| X6 | 対象 mock を `ValidationFailed` へ戻す | `npx tsc --noEmit` | `CmdErrorKind` 非互換で type error |
| X7 | fatal restore title 分岐条件を入替 | BackupRestorePage test | 既存表示 test が RED |

全 mutation を復元後、`git diff --exit-code` clean、Rust build + restore kind 単体 test、TypeScript typecheck、BackupRestorePage test の GREEN を再確認した。survivor 0。

## 遷移圧縮記録（human-confirm -> ready-hosted-final -> merge -> archive、archive commit で実体化）

- ready-hosted-final: 最終 local full = HEAD `59938c7` PASS / CLEAN / MERGE_EVIDENCE_VALID=true。hosted = run 30629496134 success（exact-HEAD 一致、初回 green）
- merge: owner 委任に基づき Coordinator が Ready + squash merge `2a1777e`
- archive: 本 commit で packet / Matrix を archive へ移動、Plans.md 転記

## Review Response

- Findings Freeze: frozen after Broad Audit; post-freeze exceptions: none.

### Plan Review round 1（independent Claude subagent, Sonnet 5, fresh context）

- P2-1（test 比較 site 36→39、内訳 25→28）/ P2-2（family (11) probe の PR2 引継ぎ）: accept・是正済み。P2-2 の引継ぎ義務: **D5 (v) の family (11) nullable filter probe は PR2 packet の Contract Probe / Ledger へ必ず転記する**
- P3-1: Coordinator の Display 所見は reviewer 反証（二重 SSOT drift）を採って却下、Debug 案維持 / P3-2: PR1-D1 の根拠 = decision-log「先例は方向別（response 直出し = SalesMode）」/ P3-3: variant 削除は型システムで担保、X8 不要 / P3-4: Plans.md link 現状同期済み
- 是正後 P1/P2 = 0、plan-approved

### Final Review（independent Claude subagent, Sonnet 5。audited = f3f9413..b29740b）

- mutation X1〜X7 を独立実注入で 7/7 kill 再現（Writer 表と完全一致、survivor 0）。wire 互換（bindings 再生成 diff = 型強化のみ）・restore 意味論不変（接続所有権パターン無変更 + X7 で機能不変を実証）・AC 全件実測一致・test 弱体化なし・全 gate green。**P1/P2 = 0 確定**
- P3-1（Writer 逸脱記録の packet 未転記）: accept — 逸脱転記: (i) local Node 25 → mise exec (Node 24) へ切替再検証 (ii) X6 は指定行へ正確再注入で RED 確認 (iii) GitHub connector 403 のため gh で Draft PR 作成 (iv) Workflow State 未編集・Implementation Results のみ追記
