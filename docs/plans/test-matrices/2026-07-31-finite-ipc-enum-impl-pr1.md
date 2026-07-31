# Test Design Matrix: 有限 IPC 値の generated enum contract 化 実装 PR1（CmdErrorKind 横断、監査是正 順14）

## Risk

Risk: R3

## Contracts Under Test

- C1: `CmdErrorKind`（12 variant、`#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, specta::Type)]` + `#[serde(rename_all = "snake_case")]`）が `cmd/mod.rs` に定義され、wire 文字列が現行 12 値と 1:1 完全一致する
- C2: production の全 kind 構築サイト（struct-literal 22 箇所 + helper-literal 4 箇所 = 26）が `CmdErrorKind::Variant` 経由に統一され、`kind: "..."` の生文字列構築が cmd 層に残らない
- C3: 39 箇所の test assertion が（round 1 P2-1 で 36→39 是正。機械式 rg は単一行形 36 のみ捕捉、複数行形 3 は compile 型検査で捕捉） `CmdErrorKind::Variant` 比較へ移行し、restore 3 値を含む既存 test が全て pass する（値・分岐・error_id 相関・restore 意味論は不変）
- C4: `bindings.ts` 再生成後 `CmdErrorKind` literal union（12 値）が生成され、`CmdError.kind: CmdErrorKind` となり、diff が型強化のみである
- C5: `src/lib/invoke.ts` の `CMD_ERROR_KIND` が 12 key（`export_error` + restore 3 値を含む）へ拡張され、生成 `CmdErrorKind` に対して exhaustive に型検査される
- C6: `PluExportPage.test.tsx` の PascalCase drift（`kind: "ValidationFailed"`）が是正され、型強化後は同種 drift が `tsc` で機械的に阻止される
- C7: `BackupRestorePage.tsx` の `fatalRestoreKind` が生成 `CmdErrorKind` からの派生型（`Extract<...>`）になり、restore 3 値の表示文言・分岐が bit-for-bit 不変
- C8: `correlated()` の `tracing::error!` 書き換え（`kind` → `kind = ?kind`）が既存 log-capture test を壊さず、診断ログ表示形式の変化が非契約であることが確認される

## Failure Modes

- F1: `CmdErrorKind` の variant 名が現行 wire 文字列と 1 文字でもずれる、または derive セットが `assert_eq!` 等既存利用を壊す
- F2: production の kind 構築サイトの一部が生文字列（`kind: "..."`）のまま残る、または `CmdErrorKind` 変換時に誤った variant にマップされる
- F3: test assertion 移行時に値比較が弱体化される（`assert_eq!` → `assert!(true)` 等）、または restore 3 値の意味論が変わる
- F4: `bindings.ts` の diff に型強化以外の変化（他 command のシグネチャ変化、値変化）が混入する
- F5: `CMD_ERROR_KIND` の 12 key 化が漏れる、または exhaustive 型注釈が機能せず新規 variant 追加時に検知しない（今回是正対象の drift そのものの再発）
- F6: `PluExportPage.test.tsx` の drift 是正が漏れる、または是正後も同種 drift が型検査で捕捉されない
- F7: `BackupRestorePage.tsx` の派生型化で restore 3 値の表示条件・文言が意図せず変わる
- F8: `correlated()` の tracing 書き換えが既存 log-capture test を壊す、または `kind` の log 表示形式変化が実は契約化されていた（見落とし）

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.

| Contract | Failure Mode | Test Type | Test / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1 | compile + unit | `cargo build`（src-tauri）+ `rg -c "enum CmdErrorKind" src-tauri/src/cmd/mod.rs` → `1` + 全 12 variant を経由する既存 test（`test_cmd_error_kind_*` 系）が pass | variant 名の rename_all 導出結果が現行文字列とずれる、または `assert_eq!` に必要な `PartialEq` が欠ける | X1: `CmdErrorKind` の `#[serde(rename_all = "snake_case")]` 属性を一時削除し、生成される wire 文字列が `Validation`（PascalCase）等へ変わることを bindings 再生成 diff で確認する。復元後に diff がゼロへ戻ることを確認 |
| C2 | F2 | source contract | `rg -n 'kind: "' src-tauri/src/cmd/*.rs \| rg -v '///' \| wc -l` → `0`（baseline 22） | production コードに生文字列 `kind: "..."` が 1 箇所でも残る | X2: 是正実装後の `product_cmd.rs` の該当箇所を一時的に `kind: "validation".to_string()`（旧形）へ差し戻し、`cargo build` が型不整合でコンパイル失敗することを確認する（`CmdError.kind` が `CmdErrorKind` 型のため `String` は代入不能） |
| C3 | F3 | unit + regression | `cargo test`（src-tauri 全体）+ `rg -c '\.kind,\s*"' src-tauri/src/cmd/*.rs \| awk -F: '{s+=$2} END{print s}'` → `0`（単一行形 baseline 36。複数行形 3 は compile 成功で判定 — P2-1） | いずれかの assertion が生文字列比較のまま残る、または弱体化される | X3: 是正後の `mod.rs` の restore test（`test_cmd_error_req905_restore_failure_kinds_are_stable`）内の 1 assertion を `CmdErrorKind::RestoreFailedRecovered` から `CmdErrorKind::RestoreFailedUnrecoverable` へ差し替え、test が red になることを確認し復元する |
| C4 | F4 | generated contract | `cd src-tauri && cargo run --bin generate_bindings` 後 `rg -c "^export type CmdErrorKind" src/lib/bindings.ts` → `1` + `git diff --stat src/lib/bindings.ts` を Review でレビューし `CmdError`/`CmdErrorKind` 以外の型に diff がないことを確認 | 他 command のシグネチャが意図せず変わる、または `CmdErrorKind` の値集合が 12 以外になる | X4: `CmdErrorKind` へ一時的に 13 個目の dummy variant を追加して bindings 再生成し、diff に 13 値目が出現することを確認する（diff 検知能力の確認、実装では戻す） |
| C5 | F5 | source contract + compile | `rg -c '^\s*[A-Z_]+: "' src/lib/invoke.ts` → `12`（baseline 8）+ `npx tsc --noEmit` PASS | `CMD_ERROR_KIND` の key が 12 未満、または exhaustive 型注釈が effective でない | X5: 是正後の `CMD_ERROR_KIND` から `EXPORT_ERROR` の 1 key を一時削除し、`npx tsc --noEmit` が `satisfies Record<CmdErrorKind, CmdErrorKind>` の網羅性エラーで red になることを確認する（今回是正対象の drift＝export_error 欠落の再現的検証） |
| C6 | F6 | compile (mock drift 再現) | `rg -c 'kind: "ValidationFailed"' src/features/plu-export/PluExportPage.test.tsx` → `0`（baseline 1）+ `npx tsc --noEmit` PASS | drift が残る、または是正後に同型 drift が型検査で捕捉されない | X6: 是正後の `PluExportPage.test.tsx` の mock `kind: "validation"` を一時的に `kind: "ValidationFailed"`（元の drift 値）へ差し戻し、`npx tsc --noEmit` がリテラル union 不一致で red になることを確認する（D-061 の目的そのものの実証） |
| C7 | F7 | unit + regression | `BackupRestorePage.test.tsx`（既存 restore 表示 test、`fatalRestoreKind` 分岐の regression）+ `rg -n 'fatalRestoreKind' src/features/backup-restore/BackupRestorePage.tsx` で型定義が `Extract<CmdErrorKind, ...>` へ変わったことを確認 | 表示文言・分岐条件が変わる、または派生型が生成 union と乖離する | X7: `fatalRestoreKind === "restore_durability_unknown"` の分岐を一時的に `"restore_failed_unrecoverable"` へ差し替え、既存表示 test が red になることを確認し復元する |
| C8 | F8 | unit（log-capture） | 既存 `mod.rs` の log-capture test（`error_id`/`raw_detail` を検査するもの）+ `rg -c "kind = \?kind" src-tauri/src/cmd/mod.rs` → `1` | `tracing::error!` 書き換えが既存 log-capture test を壊す | 該当なし（review-only。`70-mnt-diagnostic-log.md` に `kind` の 0 hit を Contract Probe で実測済みのため、意図的 mutation は非契約変化の確認目的では不要。Final Review が独立して 0 hit を再現する） |

（Matrix ID 対応: C1→Packet Matrix C1, C2→Packet C2, C3→Packet C3, C4→Packet C4, C5→Packet C5, C6→Packet C6, C7→Packet C7, C8→Packet C8）

## State Lifecycle Matrix

not applicable — 本 PR は `CmdError.kind` の型強化のみで、error 発生・表示・recoverTo・restore terminal/recoverable 分岐等の状態遷移を一切変更しない。利用者可視の state lifecycle が不変であることは C3（restore test regression）/ C7（BackupRestorePage 表示 regression）で検証する。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| `SalesMode` の response-only derive pattern（`Debug, Clone, Serialize, specta::Type`） | `src-tauri/src/biz/sales_service.rs` | `CmdErrorKind`（`PartialEq, Eq, Copy` を追加した拡張形） | `SalesReportType`（request 側、Deserialize あり）は対象外。`CmdError` は command 引数にならないため Deserialize 追加は不要（production `.kind ==` 比較 0 件で確認） | Contract Probe 実測 + `cargo build` |
| production CMD test 規範（順5 = PR #22） | 既存 `cmd/*.rs` test module（`mock_builder` + `AppState` 呼び出し） | 変更なし（本 PR は assertion の比較対象のみ変更、test 構造自体は既存規範のまま） | 新規 test 構造の導入なし | `cargo test` |
| `kind` string construction site の全数（`cmd/*.rs`） | `mod.rs`（9 struct-literal + 4 helper-literal）+ 他 6 file（13 struct-literal）= 26 サイト、doc comment 中の同型記述 5 箇所（`return_cmd.rs` / `receiving_cmd.rs` / `manual_sale_cmd.rs` / `inventory_cmd.rs` / `disposal_cmd.rs`）は除外 | 全 26 サイトを `CmdErrorKind::Variant` へ移行 | doc comment 記述は construction site ではないため対象外（`rg 'kind: "' \| rg -v '///'` で機械的に区別） | rg baseline 22（struct-literal のみ）+ helper-literal 4 の手動確認 |
| `biz/mnt/db` 層での `.kind` 参照 | `src-tauri/src/biz` `src-tauri/src/mnt` `src-tauri/src/db` 全体 | 対象なし（0 hit） | `CmdError` は CMD 層専有型であることの確認 — 本 PR は BIZ/DB/MNT に一切触れない | `rg -rn '\.kind,\s*"' src-tauri/src/biz src-tauri/src/mnt src-tauri/src/db` → 0 |

## Negative Paths

- missing input: not applicable（`CmdErrorKind` は response 専用、入力経路自体が存在しない）
- invalid input: not applicable（同上。SPEC-P41-D5 (v) の不正値 probe は response-only のためこの family では対象外）
- duplicate/ambiguous input: 該当なし
- unknown reference: 該当なし
- dependency missing: `cargo run --bin generate_bindings` 失敗時は commit しない
- permission/write failure: not applicable
- dry-run side effect: not applicable

## Boundary Checks

- threshold: not applicable（enum 値は離散的、数値範囲なし）
- null/default: `CmdError.error_id` の `Some`/`None` 分岐（`internal` / `restore_*` 系のみ `Some`）は不変
- empty/non-empty: 該当なし
- min/max: 該当なし
- status/policy enum: `CmdErrorKind` 12 値の網羅性（追加・削除がないこと）
- wire type: `CmdError { kind: CmdErrorKind, message, field, error_id }` の 4 field 構造は不変（`kind` の型のみ強化）
- internal type: `CmdErrorKind`（新規 enum、12 variant のみ、追加 variant なし）
- producer/consumer: `cmd/mod.rs`（producer）→ `bindings.ts` 生成 union → `src/lib/invoke.ts` / features（consumer）
- round-trip token: response のみ（request 方向の round-trip は存在しない）
- precision/range: 変更なし
- cross-language parse: `CmdErrorKind` の generated TypeScript literal union が Rust 側 12 variant と 1:1 一致すること（bindings 再生成で確認）

## Compatibility Checks

- old schema/input: 既存の 12 種類の kind 値を返す全 command 呼び出しは既存動作を完全維持
- new schema/input: 該当なし（新規 field 追加なし）
- output order: 該当なし（enum は順序を持たない）
- optional field behavior: `field`/`error_id` の optional 挙動は移動前と不変

## Data Safety Checks

- source-derived data: なし（実店舗データ非接触）
- generated outputs: `src/lib/bindings.ts` のみ（型強化の diff が期待値）
- secrets: 非接触
- local-only files: なし
- synthetic sample boundaries: 既存 test の synthetic データパターンを維持

## Main Wiring / Integration Checks

- helper connected to main path: `CmdErrorKind::Variant` が全 cmd/*.rs の実 `#[tauri::command]` 関数のエラー経路から到達可能であることを既存 production CMD test で確認
- output reaches manifest/report: not applicable
- effective config reaches runtime: not applicable
- CLI arg reaches implementation: not applicable
- `lib.rs` の `invoke_handler` / `collect_commands!` 登録は本 PR で変更しない（command シグネチャ・個数不変）ことを既存 registration test の回帰で確認

## Mutation-style Adequacy Questions

- `CmdErrorKind` のいずれか 1 variant を削除したとき、その variant を参照する production コード（`mod.rs` の match arm 等）が非解決名でコンパイル失敗するか（enum 化による安全網の直接実証）
- `rename_all = "snake_case"` を外したとき、bindings 再生成後の wire 文字列が PascalCase へ変わり diff で検知されるか
- `CMD_ERROR_KIND` から 1 key を削除したとき、`satisfies Record<CmdErrorKind, CmdErrorKind>`（またはそれに相当する exhaustive 型注釈）が `tsc` を red にするか
- `PluExportPage.test.tsx` の drift 値（`"ValidationFailed"`）を復元したとき、型強化後の `tsc --noEmit` が確実に red になるか（機能テストではなく型テストとしての kill 確認）
- `BackupRestorePage.tsx` の `fatalRestoreKind` 分岐条件を 1 つ入れ替えたとき、既存表示 test が red になるか
- 診断ログの `kind = ?kind` 変更が、`docs/function-design/70-mnt-diagnostic-log.md` に将来的に `kind` 文字列契約が追加された場合に備えたレビュー観点として Final Review で確認されるか（現状 0 hit のため mutation 対象外だが見落としリスクの review 対象）
- baseline 全量 mutation 後の oracle-only 修正は、変更 family（CmdErrorKind 本体 / frontend CMD_ERROR_KIND / BackupRestorePage / PluExportPage test）の代表 mutation だけを再測定し、domain family (2)〜(14) や BIZ/DB/MNT 層（無変更）の全量再実行を始めないか

## Residual Test Gaps

- `CmdErrorKind` の generated TypeScript literal union の実際の出力順序（アルファベット順か variant 定義順か）は本 PR では固定契約にしない（値集合の等価性のみを AC とする、順序依存の frontend コードが存在しないことを実測済み）
- 診断ログの `kind` 表示形式（Debug PascalCase）が将来 log 監視ツールや運用者向け grep 手順に使われるようになった場合、本 PR の「非契約」判定は再検証が必要（本 PR 時点では該当ツール・手順が存在しないことを実測確認済み）
- specta の型生成が将来 enum の internally-tagged 表現等へデフォルト変更された場合、`rename_all = "snake_case"` 前提の wire 文字列一致が崩れる可能性がある（dependency 更新時に再検証。本 PR では dependency を更新しない）
