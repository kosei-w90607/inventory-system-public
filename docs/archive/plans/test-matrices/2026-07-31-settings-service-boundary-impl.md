# Test Design Matrix: CMD-11 settings service 境界の実装（監査是正 順12 実装 PR）

## Risk

Risk: R3

## Contracts Under Test

- C1: `get_settings` / `update_setting` / `list_logs` / `list_log_operation_types` が `biz::system_service`（BIZ-09）経由で動作し、CMD が `system_repo` を直接呼ばない
- C2: `biz/mod.rs` の re-export（`DbError` / `AppSetting` / `OperationLog`）により、`settings_cmd.rs` production コードが `crate::db::` / `crate::io::` を import せずに層を跨ぐ型へアクセスできる
- C3: `db_err` ヘルパーが backup 系 3 箇所（`get_backup_dir` / `create_backup` / `check_auto_backup`）のみで使われ、settings/log 4 箇所と `validate_log_date_range` は除去される
- C4: 操作ログ日付 validation（strict `YYYY-MM-DD` / 実在暦日 / `start>end` 拒否）が BIZ-09 所有で、条件・文言・field が移動前と不変
- C5: 領収書画像の拡張子 validation が `biz::inventory_service`（returns domain）所有で、`field: "extension"` の wire 契約が不変。base64 decode は CMD 残留
- C6: `settings_cmd.rs` の test が production CMD test 規範（`mock_builder` + `AppState` + 実 `#[tauri::command]` 呼び出し）へ書き換わり、validation 単体検証は BIZ test へ分離される
- C7: `architecture_test.rs` の `LAYER_EXCEPTIONS` から settings_cmd の 2 entry が削除され、layer test が CMD→IO/DB 直呼びを恒久的に検知する
- C8: `38-biz-system-service.md` が新設され `design_compliance_test.rs` に登録済みで、必須セクション（関数要求/シグネチャ/処理ステップ/エラーハンドリング）を充足する
- C9: `31-biz-inventory-service.md` §12.9 へ `save_receipt_image` の関数契約が追記される
- C10: `bindings.ts` 再生成 diff がゼロ（wire 契約不変）
- C11: backup/restore 5 command と `get_backup_dir` の挙動・文言・接続所有権パターンが完全不変
- C12: 5 doc（ARCHITECTURE.md / 43 / cmd-task-specs.md / biz-task-specs.md / 31）に残る「順12 実装 PR」未来形注記が本 PR で現在形へ更新される

## Failure Modes

- F1: CMD が `system_repo` を直接呼び続ける、または BIZ-09 が薄い pass-through にならず責務が曖昧になる
- F2: `biz/mod.rs` の re-export が漏れ、settings_cmd.rs が `crate::db::` / `crate::io::` を import し続ける
- F3: `db_err` の scope narrowing が崩れる（settings/log にも残る、または backup からも消えて Non-scope 違反になる）
- F4: 日付 validation の条件・文言・field が移動時に変化する（ASCII strict 判定の緩和、メッセージ変化、境界判定の反転等）
- F5: 拡張子 validation の所有・文言・field が変化する、または base64 decode 責務が誤って BIZ へ移る
- F6: settings_cmd test が引き続き BIZ/IO 関数を直接叩き、実 command 経由の検証が失われる
- F7: `LAYER_EXCEPTIONS` 削除後も CMD→IO/DB 直呼びが復活してもテストが検知しない（恒久 gate 化の失敗）
- F8: `38-biz-system-service.md` が未登録のまま、または必須セクション欠落
- F9: `31` §12.9 の追記が実装と drift する
- F10: `bindings.ts` に意図しない diff が出る（型・シグネチャ変化）
- F11: backup/restore・`get_backup_dir` の挙動・文言・接続所有権パターンが意図せず変わる
- F12: 5 doc の未来形注記が本 PR 後も残存する、または `docs/archive/`・`docs/research/` の履歴記述を誤って書き換える

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.

| Contract | Failure Mode | Test Type | Test / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1 | unit + source contract | `biz::system_service` unit tests（get_all_settings/upsert_setting/list_operation_logs/list_distinct_operation_types）+ `rg -c "system_repo::" src-tauri/src/cmd/settings_cmd.rs`（production 行のみ）が 0 | CMD が system_repo を直接呼ぶ、または BIZ-09 が値を正しく中継しない | X1: `settings_cmd.rs` の該当 4 command を `biz::system_service::*` 呼び出しから `system_repo::*` 直呼びへ差し戻す |
| C2 | F2 | compile / source contract | `cargo build`（src-tauri）+ `rg -c "^use crate::db::" \| "^use crate::io::" src-tauri/src/cmd/settings_cmd.rs` が各 0 | `biz/mod.rs` の re-export が欠け、settings_cmd.rs が直接 import せざるを得なくなる | X2: `biz/mod.rs` から `DbError` / `AppSetting` / `OperationLog` の re-export 行を削除し `cargo build` が失敗することを確認 |
| C3 | F3 | unit + count anchor | `rg -c "map_err(db_err)" src-tauri/src/cmd/settings_cmd.rs` → `3`、`rg -c "fn validate_log_date_range" src-tauri/src/cmd/settings_cmd.rs` → `0` | settings/log にも `db_err` が残る、または backup 3 箇所からも消える | X3a: `get_settings` に `db_err` を復活させ AC の `3` が `4` になることを確認。X3b: `get_backup_dir` から `db_err` を除去し AC の `3` が `2` になることを確認 |
| C4 | F4 | unit（BIZ 移設後） | `biz::system_service` 側の日付 validation test（同日許可・不正形式 12 パターン・`start>end` 拒否。既存 `test_list_logs_req902_date_validation_contract` の assertion 内容を移設） | ASCII strict 判定・実在暦日判定・範囲順序判定のいずれかが緩む、またはメッセージが変わる | X4a: strict 桁数チェック（`bytes.len() == 10`）を除去。X4b: `start > end` を `start >= end` に変更。X4c: エラーメッセージ文字列を変更 |
| C5 | F5 | unit（BIZ 移設後）+ 実 command | `biz::inventory_service::save_receipt_image` の許可拡張子 test（既存 `test_save_receipt_image_req905_invalid_extension_to_validation` の assertion 内容を移設）+ `save_receipt_image`（実 command）を mock_builder 経由で呼ぶ結合 test | 拡張子 validation が BIZ から消える、`field` が `None` になる、base base64 decode が BIZ 側に移る | X5a: BIZ 側の許可拡張子チェックを削除。X5b: `field: Some("extension")` を `field: None` に変更。X5c: base64 decode を BIZ 関数内へ移動 |
| C6 | F6 | source contract | `rg -c "mock_builder" src-tauri/src/cmd/settings_cmd.rs`（test module 内）が settings/log/image 系 test 数以上 | test が実 command を経由せず BIZ/IO 関数を直接呼ぶまま残る | X6: 書き換え後の1つの test から `mock_builder` 経由呼び出しを外し、`system_repo::*` 直呼びへ戻して source contract 検査が red になることを確認 |
| C7 | F7 | integration（機械 gate） | `cargo test --test architecture_test`（`layer_dependency_rules`） | `LAYER_EXCEPTIONS` 削除後も settings_cmd.rs が db/io を直接 import して検知されない | X7: 是正実装後の `settings_cmd.rs` に一時的に `use crate::db::system_repo;` を再挿入し、`cargo test --test architecture_test` が red になることを確認。復元後 green |
| C8 | F8 | integration（機械 gate） | `cargo test --test design_compliance_test` + `bash scripts/doc-consistency-check.sh --target plan`（M2 warn） | `38-biz-system-service.md` が `build_doc_to_modules_map()` 未登録のまま、または必須セクション欠落 | X8a: map entry を一時削除し `design_compliance_test` が「未登録の設計書」で red になることを確認。X8b: 「エラーハンドリング」記述を一時削除し M2 warn が出ることを確認 |
| C9 | F9 | review + doc-code diff | `31-biz-inventory-service.md` §12.9 のシグネチャ記述と `biz::inventory_service::save_receipt_image` 実装を独立レビューで突合 | doc のシグネチャ・処理ステップが実装と一致しない | 該当なし（review-only。design_compliance_test の fn 抽出が code block の乖離を機械検知） |
| C10 | F10 | generated contract | `cd src-tauri && cargo run --bin generate_bindings` 後 `git diff --stat src/lib/bindings.ts` が空 | command シグネチャ・DTO 変更により bindings に diff が出る | X10: `save_receipt_image` の引数を一時的に増やし、bindings 再生成で diff が出ることを確認（意図した diff 検知能力の確認、実装では戻す） |
| C11 | F11 | regression | 既存 backup/restore test 全量（`test_get_backup_dir_req901_d2_maps_db_error_to_internal` / `test_restore_backup_req905_*` / `test_create_backup_req905` / `test_list_backups_req905` / `test_check_auto_backup_req905_dberror_to_cmderror`）+ `git diff` を `get_backup_dir`/`create_backup`/`check_auto_backup`/`get_effective_backup_dir`/`list_backups`/`restore_backup` の行範囲に限定して確認 | backup/restore の挙動・文言・接続所有権パターンが変わる | 該当なし（negative diff review。意図的な mutation は Non-scope 違反そのものになるため注入しない） |
| C12 | F12 | wording sweep | `rg -c "順12 実装 PR\|実装追随注記\|移行前の直呼び形" docs/ARCHITECTURE.md docs/function-design/43-cmd-settings-log.md docs/architecture/cmd-task-specs.md docs/architecture/biz-task-specs.md docs/function-design/31-biz-inventory-service.md` 合算 → `0` | 5 doc のいずれかに未来形注記が残る、または `docs/archive/`・`docs/research/` を誤って書き換える | X12: 是正後に 43 §43.1 の実装追随注記 1 文を一時的に復元挿入し、AC の合算が `0` から `1` に上がることを確認 |

（Matrix ID 対応: 本表の行はそれぞれ Packet 側の M1〜M14 のうち C1→M1, C2→M2/M9, C3→M3/M13, C4→M4/M5, C5→M6/M7, C6→M8/M12, C7→M9, C8→M10/M11, C9→M11, C10→M6系, C11→M13, C12→M14 に対応する）

## State Lifecycle Matrix

not applicable — 本 PR は CMD→BIZ→IO の呼び出し経路再配置のみで、設定値・操作ログ・バックアップ・画像保存の状態遷移（success/failure/retry/pending 等）を一切変更しない。利用者可視の state lifecycle が不変であることは C1/C4/C5/C11 の regression test（既存 test の移設・保持）で検証する。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| production CMD test 規範（順5 = PR #22） | `stocktake_cmd.rs`（`test_update_count_req205_negative_validation` 等）、`product_cmd.rs`（`test_preview_import_req104_*`）、`settings_cmd.rs`（現行 `test_get_backup_dir_req901_d2_*` のみ既に順5 準拠） | `settings_cmd.rs` の settings/log/image 系全 test | backup/restore 系の既存 production test（`test_get_backup_dir_req901_d2_maps_db_error_to_internal` 等）は既に順5 準拠のため書き換え不要 | mock_builder + AppState 呼び出しパターンの一致 |
| `biz/mod.rs` の cross-layer type re-export pattern | `DbConnection` / `PaginatedResult` / `Department` / `Supplier` / `CsvImport` 等 11 行 | `DbError` / `AppSetting` / `OperationLog` の 2 行追加 | `ProductSearchQuery` 等の domain 固有 request/response 型は対象外（本 PR は settings/log/image の型のみ） | `rg -n "pub use crate::db" src-tauri/src/biz/mod.rs` |
| `architecture_test.rs` LAYER_EXCEPTIONS の import 行検知機構 | `find_forbidden_imports`（:79-137）、全 CMD/BIZ/IO/DB ファイル | settings_cmd.rs のみ（唯一の既存例外） | 他 CMD ファイルに例外なし、本 PR で新規例外も追加しない | `cargo test --test architecture_test` |
| function-design doc の必須セクション（`scripts/doc-consistency-check.sh` M2） | 既存 BIZ/IO 層 doc 全量（`関数要求`/`シグネチャ`/`処理ステップ`/エラー記述） | `38-biz-system-service.md`（新設） | UI層(`5*-ui-*`)・CMD層(`4*-cmd-*`)の緩い必須要素とは異なる BIZ/IO フルテンプレートを適用 | `bash scripts/doc-consistency-check.sh --target plan` M2 warn |

## Negative Paths

- missing input: `LogQuery` の `start_date`/`end_date` 両方 `None` は既存動作を完全維持（BIZ 移設後も同じ分岐）
- invalid input: strict でない日付形式・実在しない暦日・拡張子不正は BIZ 層で validation error として拒否
- duplicate/ambiguous input: 該当なし（本 PR に重複判定なし）
- unknown reference: 該当なし
- dependency missing: `cargo run --bin generate_bindings` 失敗時は commit しない
- permission/write failure: `io::image_manager` の書き込み失敗は BIZ で `DbError::QueryFailed` へラップし internal エラーとして伝搬（catch-all にしない）
- dry-run side effect: not applicable

## Boundary Checks

- threshold: 日付範囲 `start_date == end_date`（許可境界）と `start_date > end_date`（拒否境界）
- null/default: `LogQuery` の `operation_type`/`start_date`/`end_date` 省略時の既存動作
- empty/non-empty: 拡張子空文字列・不正拡張子・許可拡張子の 3 分岐
- min/max: 該当なし（本 PR に数値範囲契約なし）
- status/policy enum: 該当なし
- wire type: `CmdError { kind, message, field, error_id }` の 4 field 構造は不変
- internal type: `BizError::ValidationFailed` / `ValidationFailedAt` / `DatabaseError` の 3 variant のみ使用（新 variant 追加なし）
- producer/consumer: `settings_cmd.rs`（producer）→ `biz::system_service` / `biz::inventory_service`（consumer）
- round-trip token: 該当なし
- precision/range: 変更なし
- cross-language parse: `AppSetting` / `OperationLog` の generated TypeScript 型は re-export 経路変更の影響を受けない（Contract Probe で確認済み）

## Compatibility Checks

- old schema/input: 既存 `LogQuery`（両日付 `None`）呼び出しは既存動作を完全維持
- new schema/input: 該当なし（新規 field 追加なし）
- output order: `Vec<AppSetting>` / `PaginatedResult<OperationLog>` の順序契約は不変
- optional field behavior: `operation_type`/`start_date`/`end_date` の optional 挙動は移動前と不変

## Data Safety Checks

- source-derived data: なし（実店舗データ非接触）
- generated outputs: `src/lib/bindings.ts` のみ（diff ゼロが期待値）
- secrets: 非接触
- local-only files: `tempfile::tempdir()` ベースの test fixture のみ
- synthetic sample boundaries: 既存 test の synthetic DB/画像バイト列パターンを維持

## Main Wiring / Integration Checks

- helper connected to main path: `biz::system_service::*` / `biz::inventory_service::save_receipt_image` が `settings_cmd.rs` の実 `#[tauri::command]` 関数から到達可能であることを production CMD test で確認
- output reaches manifest/report: not applicable
- effective config reaches runtime: not applicable
- CLI arg reaches implementation: not applicable
- `lib.rs` の `invoke_handler` / `collect_commands!` 登録は本 PR で変更しない（command シグネチャ不変のため）ことを `rg -c "cmd::settings_cmd::save_receipt_image" src-tauri/src/lib.rs` の baseline 2（既存）維持で確認

## Mutation-style Adequacy Questions

- `settings_cmd.rs` production 行から `use crate::db::` / `use crate::io::` を一時的に復活させたとき、`cargo test --test architecture_test` は必ず red になるか（X7 と同一趣旨、biz re-export 側の mutation としても再確認）
- `db_err` を settings/log 4 箇所のいずれかに復活させたとき、rg count AC が `3` から増えて検知するか
- BIZ-09 の日付 validation 条件を 1 つでも緩めたとき、既存 12 パターンの invalid date test は red になるか
- 拡張子 validation の許可集合から 1 つでも extension を除外/追加したとき、専用 test が red になるか
- `LAYER_EXCEPTIONS` の 2 entry を一時的に復活させたまま production import も残した場合、settings_cmd の layer 違反が「例外」として再び見逃されないか（削除後の恒久性を Final Review で実注入確認）
- `38-biz-system-service.md` の map 未登録状態で `cargo test --test design_compliance_test` を実行すると、既存 baseline どおり「モジュールマッピングに未登録の設計書」で red になるか
- 5 doc の wording sweep 後、`docs/archive/2026-07-31-settings-service-boundary-design.md` 等の archive 済み doc 内の同一文言を誤って書き換えていないか（archive は対象外であることの確認）
- baseline 全量 mutation 後の oracle-only 修正は、変更 family（settings/log/image/layer-gate/doc-registration/wording）の代表 mutation だけを再測定し、未変更 family（backup/restore）の全量再実行を始めないか

## Residual Test Gaps

- specta の型生成が将来 module-path ベースへ変更された場合、本 PR の「re-export 経路変更は bindings に影響しない」という Contract Probe の前提が崩れる。dependency 更新時に再検証が必要（本 PR では dependency を更新しない）
- `io::image_manager` の filesystem 書き込み失敗（ENOSPC 等）を BIZ 層で再現する統合 test は環境依存のため本 PR には含めない。既存の unit-level `io::Error` 変換ロジック検証で代替する
