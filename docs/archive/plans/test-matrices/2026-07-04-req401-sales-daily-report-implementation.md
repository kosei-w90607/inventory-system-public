# Test Design Matrix: REQ-401 SALES 日報取込み実装（第1スライス）

Risk: R3

Contract ID: SPEC-REQ401-DAILY-IMPORT-IMPL（親: SPEC-SALES-DAILY-REPORT-2026-06-30）

> 設計 matrix `docs/archive/plans/test-matrices/2026-06-30-sales-daily-report-design.md` の T1-T12 / T19-T22 を実装粒度へ展開したもの。T13-T18（BIZ-05 / UI-09a/b official 表示）は第2スライスで扱う。テスト名は `_req401` を含める（traceability regex 対応）。

## Migration（MNT-03 v4）

| ID | Contract / failure mode | Test type | Test target | Expected failure caught |
|---|---|---|---|---|
| M1 | v4 適用で daily_report_* 4 テーブルと index 5 本が作成される | Rust unit | `test_migrate_v4_creates_daily_report_tables_req401` | テーブル・index 欠落で以降の全機能が沈黙故障 |
| M2 | v4 適用済み DB への再 migrate が no-op（冪等） | Rust unit | `test_migrate_v4_idempotent_req401` | 起動毎の再適用でエラー |
| M3 | CHECK 制約（status / source_adapter / source_file）違反 INSERT が失敗する | Rust unit | `test_daily_report_check_constraints_req401` | 不正状態値の混入 |
| M4 | FK 制約（daily_report_import_id / department_id）違反 INSERT が失敗する | Rust unit | `test_daily_report_fk_constraints_req401` | 孤児行の発生 |

## IO-07 parser（設計 T1-T5）

| ID | Contract / failure mode | Test type | Test target | Expected failure caught |
|---|---|---|---|---|
| IO1 | 正常 bundle（layout A: 7行プリアンブル + header + 4列データ行）を parse し、summary/payment/department lines と report_date / file_hash / size を返す（T1） | Rust unit | `test_parse_daily_report_req401_happy_path` | 実形状の日報が読めない |
| IO2 | Z001/Z002/Z005 の欠損 → `missing_source`（T2） | Rust unit | `test_parse_daily_report_req401_missing_source` | 部分 bundle の誤取込み |
| IO3 | 同一 source 重複 / 未知 source → `duplicate_source` / `unknown_source`（T3） | Rust unit | `test_parse_daily_report_req401_duplicate_and_unknown_source` | 別日・別種ファイルの混入 |
| IO4 | CP932 decode 失敗 → `decode_failed` | Rust unit | `test_parse_daily_report_req401_decode_failed` | 文字化けデータの沈黙取込み |
| IO5 | 3 source 間の日付不一致 → `invalid_date`（T4） | Rust unit | `test_parse_daily_report_req401_date_mismatch` | 別営業日の混在 |
| IO6 | 金額/数量/件数の数値変換不可 → `invalid_number`（T5） | Rust unit | `test_parse_daily_report_req401_invalid_number` | 集計値の silent 0 化 |
| IO7 | 行構造不正 → `invalid_format`、line_key / payment_key / sort_order の正規化が §29.4 追記表と一致 | Rust unit | `test_parse_daily_report_req401_invalid_format_z002_z005` / `test_parse_daily_report_req401_source_shapes` | adapter 正規化の drift |
| IO8 | 2 layout 対応: layout A（プリアンブル型）と layout B（連結型エクスポート）をどちらも4列行へ正規化する | Rust unit | `test_parse_daily_report_req401_happy_path` / `test_parse_daily_report_req401_layout_b_concatenated_shape_supported` | エクスポート出力または内部ディレクトリ出力の片方しか読めない |

## IO-01 repository（sales_repo 追加分）

| ID | Contract / failure mode | Test type | Test target | Expected failure caught |
|---|---|---|---|---|
| R1 | insert → find_by_id の roundtrip（source_files_json 含む） | Rust unit | `test_daily_report_repo_req401_insert_and_find_by_id` | 列マッピング欠落 |
| R2 | bundle_hash ブロック判定は completed のみ対象（rolled_back は非ブロック） | Rust unit | `test_daily_report_repo_req401_find_blocking_by_bundle_hash_completed_only` | rollback 後の再取込み不能 |
| R3 | report_date 検索が completed のみ返す | Rust unit | `test_daily_report_repo_req401_find_by_report_date_completed_only` | 上書き判定の誤対象 |
| R4 | rollback は `status='completed'` の行のみ更新（affected 0/1 の分岐） | Rust unit | `test_daily_report_repo_req401_rollback_is_parent_status_only` | 二重 rollback の破壊 |
| R5 | list のページング + date_from/date_to filter + 入力ガード | Rust unit | `test_daily_report_repo_req401_list_pagination_filters_and_boundaries` | 履歴画面の誤表示 |
| R6 | 行テーブル一括 INSERT（空スライスは no-op） | Rust unit | `test_daily_report_repo_req401_insert_lines_and_keep_nullable_values` / `test_daily_report_repo_req401_insert_lines_empty_noop` | 空 bundle での panic / 部分書込み |

## BIZ-08（設計 T6-T10）

| ID | Contract / failure mode | Test type | Test target | Expected failure caught |
|---|---|---|---|---|
| B1 | 正常 preview: totals / 支払 / 部門（department_id 付与）/ NoDuplicate | Rust BIZ | `test_daily_report_req401_parse_preview_happy_path` | preview 契約の drift |
| B2 | parse_errors あり → `BizError::ImportError`、daily_report_imports 非作成 | Rust BIZ | `test_daily_report_req401_parse_error_logs_parse_failed` | 不正 bundle のレコード化 |
| B3 | 部門名未一致 → warning + `department_id=None` で preview 可能（T6） | Rust BIZ | `test_daily_report_req401_unmatched_department_warns_but_previews` | 部門名差異で日報取込み全停止 |
| B4 | 同一 bundle_hash completed あり → AlreadyImported（T7） | Rust BIZ | `test_daily_report_req401_duplicate_already_imported` | 日報二重計上 |
| B5 | 同一 report_date 別 bundle → OverwriteRequired | Rust BIZ | `test_daily_report_req401_overwrite_required_for_same_date_different_bundle` | 無確認の同日多重取込み |
| B6 | commit は daily_report_* 4 テーブルのみに書く。sale_records / inventory_movements / stock_quantity 不変（T9） | Rust BIZ integration | `test_daily_report_req401_commit_does_not_write_sale_records_or_stock` | 集計行の商品別売上汚染 |
| B7 | overwrite_confirmed=true の commit で旧 import が同一 TX 内で rolled_back + 新規 completed（T8） | Rust BIZ integration | `test_daily_report_req401_commit_overwrite_rolls_back_old` | 同日 completed 複数残存 |
| B8 | AlreadyImported での commit → `IdempotencyConflict` | Rust BIZ | `test_daily_report_req401_commit_already_imported_conflict` | 二重 commit |
| B9 | OverwriteRequired + overwrite_confirmed=false → `ValidationFailed` | Rust BIZ | `test_daily_report_req401_commit_overwrite_unconfirmed_validation_failed` | 無確認上書き |
| B10 | preview 30 分超過の commit → `ImportError` | Rust BIZ | `test_daily_report_req401_commit_expired_preview_import_error` | 古い preview の誤 commit |
| B11 | rollback: 論理取消のみ / 冪等 / 在庫・movement 影響ゼロ / 行テーブル物理削除なし（T10） | Rust BIZ integration | `test_daily_report_req401_rollback_idempotent_and_no_stock_change` | rollback による在庫破壊 |
| B12 | 必須サマリ（gross_sales / net_sales とも導出不可）→ commit 不可エラー | Rust BIZ | `test_daily_report_req401_missing_required_summary` | 空日報の正本化 |
| B13 | operation_logs: commit 成功で `daily_report_import`、rollback 成功で `daily_report_rollback` が TX 外で記録され、log 失敗は取込み結果を壊さない | Rust BIZ | `test_daily_report_req401_commit_inserts_parent_lines_and_log` / `test_daily_report_req401_rollback_idempotent_and_no_stock_change` | 監査ログ欠落 / log 失敗での取込み巻き戻り |
| B14 | list の入力ガード（page < 1 / per_page < 1 / per_page > 100） | Rust BIZ | `test_daily_report_req401_list_validation_and_result` | 極端値での誤動作 |
| B15 | parse 失敗時に `daily_report_parse_failed` が operation_logs に記録され、daily_report_imports は作られない（B-2 Stage 1 point 4） | Rust BIZ integration | `test_daily_report_req401_parse_error_logs_parse_failed` | parse 失敗の監査証跡欠落（rally R1 P2） |

## CMD-12（設計 T11 / T19）

| ID | Contract / failure mode | Test type | Test target | Expected failure caught |
|---|---|---|---|---|
| C1 | files.len() ≠ 3 → `CmdError.kind="validation"` | Rust cmd | `test_daily_report_cmd_req401_validates_three_files` | 入口検証漏れ |
| C2 | 20MB 超ファイル → `validation` | Rust cmd | `test_daily_report_cmd_req401_validates_size_limit` | 巨大入力での固まり |
| C3 | preview_token 不正 UUID → `validation` | Rust cmd | `test_daily_report_cmd_req401_validates_uuid_token` | token 検証漏れ |
| C4 | cache miss / 期限切れ → `import_error`（T11） | Rust cmd | `test_daily_report_cmd_req401_cache_miss_and_expiry_return_import_error` | UI 回復経路の破綻 |
| C5 | commit 成功で token 削除、失敗（期限切れ以外）で cache 残存 | Rust cmd | `test_daily_report_cmd_req401_cache_lifecycle_success_removes_failure_keeps` | 再試行不能 / cache 肥大 |
| C6 | generate_bindings 後に 4 command + DailyReport 系 DTO が bindings.ts に現れる（T19） | Generated check | `cargo run --bin generate_bindings` + diff 目視 | frontend 契約 drift |
| C7 | cache 上限（`PREVIEW_CACHE_LIMIT`）到達時に最古 `created_at` の token が FIFO evict される（`csv_import_cmd.rs:76-85` と同型） | Rust cmd | `test_daily_report_cmd_req401_fifo_eviction_removes_oldest` | cache 無制限肥大 / eviction 実装漏れ（rally R1 P2） |

## 既存トラック回帰（設計 T12）

| ID | Contract / failure mode | Test type | Test target | Expected failure caught |
|---|---|---|---|---|
| Z0 | 【契約書き換え】`schema_v2.rs:258` `test_v2_req903_applied_on_fresh_db` の `assert_eq!(max_version, 3)` を `4` へ更新（252 行コメントも v4 追従）。書き換えはこの 1 箇所のみ | Existing Rust rewrite | `cargo test migration` / `cargo test v2_req903` | v4 追加による既存 assert の確定 fail（rally R1 P1-1） |
| Z1 | 既存 Z004 suite（csv_import_service / z004_parser / sales_repo 既存分）が無改変 green | Existing Rust | `cargo test csv_import` / `cargo test z004` | SALES 再設計による商品別トラック破壊 |
| Z2 | 既存 csv-import テストが green。既存 3 ファイル（`reducer.test.ts` / `extractFilename.test.ts` / `formatErrorRow.test.ts`）は UI テキスト・マウント構造に依存しない純ロジックテストのため書き換え対象なし（rally R1 で確認済み）。削除・skip 不可 | Existing Vitest | `npm test -- --run src/features/csv-import/` | Z004 タブ化での回帰 |

## Frontend（設計 T20 / UI-07-D9/D10）

> **T4 gate 注意（rally R1 P1-2）**: traceability T4 は FE 未参照テストファイル数 baseline=22 の増減両方向 ERROR。以下 F1-F7 の新規テストファイルは全て describe/it に `REQ-401` または `UI-07` の literal を含めること（`FE_UNREFERENCED_BASELINE` は変更しない）。

| ID | Contract / failure mode | Test type | Test target | Expected failure caught |
|---|---|---|---|---|
| F1 | daily-report reducer の遷移表（valid 遷移 + invalid 据え置き） | Vitest | `src/features/daily-report-import/reducer.test.ts` | state 機械の誤遷移 |
| F2 | commit / rollback 成功時の invalidation（dailyReportImportLists + daily-sales prefix + monthlySalesRoot）（T20） | Vitest hook | `src/features/daily-report-import/hooks/useDailyReportImportFlow.test.tsx` | 取込み後の stale 表示 |
| F3 | 3 ファイル以外の選択（1/2/4 件）を UI 段階で reject | Vitest hook | `src/features/daily-report-import/hooks/useDailyReportImportFlow.test.tsx` | 不完全 bundle の送信 |
| F4 | preview 表示: 対象日 / totals / 支払 / 部門集計 / 部門未対応 warning（UI-07-D10） | Vitest/RTL | `src/features/daily-report-import/DailyReportImportPage.test.tsx` | warning 非表示で部門欠落に気付けない |
| F5 | OverwriteRequired で確認、confirm で overwriteConfirmed=true 送信 | Vitest/RTL | `src/features/daily-report-import/DailyReportImportPage.test.tsx` | 無確認上書き |
| F6 | 結果画面 + 取消し確認に「在庫数は変わりません」系文言（テキストで、色のみ符号化なし） | Vitest/RTL | `src/features/daily-report-import/DailyReportImportPage.test.tsx` | operator の在庫影響誤解 |
| F7 | タブ構成: 既定「日報取込み」/ Z004 側は「商品別CSV取込み（Z004）」表記（UI-07-D9/D11） | Vitest/RTL | `src/features/csv-import/CsvImportPage.test.tsx` | 2 トラック混同 |
| F8 | AlreadyImported preview の「ファイルを選び直す」は native dialog (`plugin-dialog.open`) を起動し、HTML file input を描画しない | Vitest/RTL | `src/features/daily-report-import/DailyReportImportPage.test.tsx` | Windows WebView2 で file input picker 起動直後に white screen へ入る |
| F9 | AlreadyImported / OverwriteRequired は preview 上部にテキスト付き Alert 帯を表示する（Badge のみ・色のみ符号化不可） | Vitest/RTL | `src/features/daily-report-import/DailyReportImportPage.test.tsx` | 取込み済み・上書き確認の見落とし |
| F10 | native dialog の cancel / 2ファイル以下 / read 失敗 / 3ファイル選択を hook で検証し、cancel は state 据え置き、2ファイル以下と read 失敗は parse せず reject、3ファイルは `readFile` → parse へ進む | Vitest hook | `src/features/daily-report-import/hooks/useDailyReportImportFlow.test.tsx` | invalid 選択時に再描画されず white screen が継続する |
| F11 | native dialog で 2ファイル選択後、選択ボタン直下に icon + destructive text の inline error を表示し、次の3ファイル選択成功で error が消えて preview へ進む | Vitest/RTL | `src/features/daily-report-import/DailyReportImportPage.flow.test.tsx` | toast を見逃すと選択数不足の原因が画面上に残らない |

## Data safety（設計 T21）

| ID | Contract / failure mode | Test type | Test target | Expected failure caught |
|---|---|---|---|---|
| D1 | fixture / RTL mock に実 JAN・実商品名・実金額・実 CSV 本文が混入しない | script / review | `rg` over fixtures + PR review evidence | 店舗実データの commit |
| D2 | 29-io §29.4 追記が匿名化 shape のみ（列数・キー名・行種別） | review | PR diff 目視 | 設計書経由の実データ流出 |

## Manual / External Verification（設計 T22）

- Windows native L3: native dialog での 3 ファイル選択、preview の日本語文言と warning 視認性、取込み → 結果 → 取消しの through、在庫不変文言、同一 bundle ブロック / 上書き確認ダイアログ。Draft PR body の pending checklist として記録
- 実 PCツール / SDカード由来ファイルでのローカル手元確認は owner の external evidence とし、ファイル・結果値は git へ入れない
- Local-only L3 gate: 3月期 bundle（layout B を含む実 Z001/Z002/Z005）と6月期 bundle（layout A 実 Z001/Z002/Z005）を一時 Rust probe で `parse_daily_report_bundle` に投入し、両方で `parse_errors=0`、summary/payment/department 行数、gross/net がCSVヘッダ行とPDFレポート仕様どおりの列から取れていること、6月期 bundle のラベル構成・行の並びが sanitized xlsx layout と整合することを確認する。probe は検証後に削除し、実ファイル・実値・実パスを commit しない

## Required Gates In Implementation PR

- Local-only L3 gate（push前、実ファイル/実値はcommitしない）: 3月期 bundle + 6月期 bundle の実3ファイル parse `parse_errors=0` + 行数 + gross/net 列解釈 + sanitized xlsx layout/label 整合
- `cd src-tauri && cargo fmt --check`
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo test --test design_compliance_test`
- `cd src-tauri && cargo run --bin generate_bindings`
- `cd src-tauri && cargo run --bin generate_traceability -- --check`
- `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`
- `bash scripts/doc-consistency-check.sh`
- `bash scripts/doc-consistency-check.sh --target plan`
