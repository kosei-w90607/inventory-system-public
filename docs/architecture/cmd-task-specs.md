# タスク仕様（CMD層）

> **親文書**: [ARCHITECTURE.md](../ARCHITECTURE.md)

CMD層は薄いラッパーのため、各コマンドの仕様は「どのBIZ関数を呼ぶか」と「入出力の型」に限定する。

---

### CMD-01: 商品コマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| create_product | ProductCreateRequest（name, department_id, selling_price, cost_price, tax_rate, stock_unit, initial_stock, jan_code?, maker_code?, supplier_id?, pos_stock_sync） | BIZ-01 商品新規登録 | ProductCreateResult（product_code, success） |
| update_product | ProductUpdateRequest（product_code, 変更フィールド群） | BIZ-01 商品修正 | Result（success, warnings[]） |
| toggle_discontinue | product_code | BIZ-01 廃番切替 | Result（success, new_status） |
| search_products | SearchQuery（keyword, department_id?, is_discontinued?, plu?, sort, page, per_page） | BIZ-01 商品検索 | ProductList（items[], total_count、plu_memory_no） |
| get_product | product_code | BIZ-01 商品取得 | Product（全フィールド＋部門名＋取引先名＋plu_memory_no） |
| preview_import | FileBytes | BIZ-01 一括インポート前半 | ImportPreview（valid_rows[], error_rows[], duplicate_rows[]） |
| commit_import | ImportCommitRequest（valid_rows[], overwrite_codes[]） | BIZ-01 一括インポート後半 | ImportResult（created, updated, skipped, errors） |
| bulk_set_plu_target | ProductBulkFilter（q, department_id?, is_discontinued?）, plu_target | BIZ-01 filter 全件 PLU 対象更新 | BulkPluTargetResult（matched, updated, invalid_jan_skipped, discontinued_skipped） |

### CMD-02: 入庫コマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| create_receiving | ReceivingCreateRequest（supplier_id?, receiving_date, note?, items[]） | BIZ-02 入庫記録 | Result（record_id, stock_warnings[]） |
| list_receivings | ListQuery（page, per_page, date_from?, date_to?） | BIZ-02 入庫一覧 | ReceivingList（items[], total_count） |

### CMD-03: 返品・交換コマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| create_return | ReturnCreateRequest（return_type, return_date, register_processed, receipt_image?, note?, items[]） | BIZ-02 返品記録 | Result（record_id） |
| list_returns | ListQuery | BIZ-02 返品・交換一覧 | ReturnList |

### CMD-04: 手動販売出庫コマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| create_manual_sale | ManualSaleCreateRequest（sale_date, reason, note?, items[]） | BIZ-02 手動販売出庫 | Result（sale_id, plu_warnings[]） |

### CMD-05: 廃棄・破損コマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| create_disposal | DisposalCreateRequest（disposal_date, items[]） | BIZ-02 廃棄記録 | Result（record_id） |
| list_disposals | ListQuery | BIZ-02 廃棄・破損一覧 | DisposalList |

### CMD-06: 在庫照会コマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| get_stock_detail | product_code | BIZ-01 在庫詳細 | StockDetail（stock_quantity, selling_price, cost_price, last_receiving_date, last_sale_date） |
| list_low_stock | LowStockQuery（include_discontinued?） | BIZ-01 在庫少一覧 | LowStockList（items[]） |
| list_movements | MovementQuery（product_code, date_from?, date_to?, movement_type?） | BIZ-02 在庫変動履歴 | MovementList（items[], total_count） |

### CMD-07: Z004商品別CSV取込みコマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| parse_and_validate_csv | FileBytes, filename | BIZ-03 Stage1+2 | ParseValidateResult（preview_data, preview_token） |
| commit_csv_import | CommitRequest（preview_token, additional_import_confirmed） | BIZ-03 Stage4 | ImportResult（csv_import_id, status, total_items, skipped_count） |
| rollback_csv_import | csv_import_id | BIZ-03 ロールバック | RollbackResult（success, voided_sale_count, stock_corrections） |
| list_csv_imports | ListQuery（page, per_page） | BIZ-03経由 | PaginatedResult\<CsvImport\> |

### CMD-12: 日報取込みコマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| parse_and_validate_daily_report | DailyReportSourceFile[]（filename, file_bytes） | BIZ-08 Stage1+2 | DailyReportPreviewResponse（preview_data, preview_token） |
| commit_daily_report_import | CommitDailyReportRequest（preview_token, additional_import_confirmed） | BIZ-08 Stage4 | DailyReportImportResult（daily_report_import_id, status, report_date, warning_count） |
| rollback_daily_report_import | daily_report_import_id | BIZ-08 ロールバック | DailyReportRollbackResult（success, status） |
| list_daily_report_imports | ListQuery（page, per_page, date_from?, date_to?） | BIZ-08経由 | PaginatedResult\<DailyReportImport\> |

**CMD-12の責務境界**:
- ファイルバイト列をBIZ-08へ中継する。Z001/Z002/Z005のsource判定や日報バリデーションはCMDで行わない。
- preview_token のUUID形式チェックとファイルサイズ上限の早期チェックだけを防御的入力チェックとして許可する。
- BIZ-08の error は `CmdError.kind = "import_error"` または既存 `validation` / `not_found` / `internal` に変換する。
- CMD-07（Z004商品別CSV）とCMD-12（日報）はpreview cacheの保管場所を共有してよいが、cache valueの型は分ける。

### CMD-08: PLU書出しコマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| import_plu_register_snapshot | file_bytes（FilePicker D-054 の bytes） | BIZ-04 | PluRegisterSnapshotSummary（snapshot_at, free / external / app managed / conflict counts） |
| get_plu_slot_summary | なし | BIZ-04 | PluRegisterSnapshotSummary |
| prepare_plu_export | ExportMode（'full' / 'diff'） | BIZ-04 | PluExportPreparedResult（tsv_output, count, target_product_codes, prepared_rows[memory_no], excluded〈no_free_slot含む〉） |
| confirm_plu_export_saved | product_codes[], prepared_rows[memory_no] | BIZ-04 | PluExportConfirmResult（updated_count, confirmed_at） |
| list_plu_dirty | なし | BIZ-04経由 | Vec\<ProductResponse\>（plu_target=1 かつ plu_dirty=1 の商品一覧。D-028） |

### CMD-09: 売上集計コマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| get_daily_sales | date（YYYY-MM-DD） | BIZ-05 日次 | DailySalesReport（items[], dept_subtotals[], grand_total） |
| get_monthly_sales | month（YYYY-MM）, mode（'by_product'/'by_department'） | BIZ-05 月次 | MonthlySalesReport（items[]{ranking埋込}, prev_month_comparison） |
| export_sales_csv | ReportParams | BIZ-05 + IO-05 | FileBytes |

### CMD-10: 棚卸しコマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| start_stocktake | なし | BIZ-06 開始 | Result（stocktake_id） |
| get_stocktake_items | StocktakeQuery（stocktake_id, department_id?, counted_only?, page） | BIZ-06 棚卸しアイテム一覧 | StocktakeItemList（items[], progress{counted, total}） |
| update_count | UpdateCountRequest（stocktake_item_id, actual_count） | BIZ-06 カウント | Result（success, difference） |
| complete_stocktake | stocktake_id, force_fill | BIZ-06 確定 | StocktakeResult（total_cost, adjusted_items[]） |

### CMD-11: 設定・ログコマンド群

| コマンド名 | 入力 | 呼び出すBIZ/MNT/IO | 出力 |
|-----------|------|-----------|------|
| get_settings | なし | BIZ-09 | AppSettings（全設定値） |
| update_setting | key, value | BIZ-09 | Result（success） |
| list_logs | LogQuery（page, per_page, operation_type?, start_date?, end_date?） | BIZ-09（日付validation所有） | LogList（items[], total_count） |
| list_log_operation_types | なし | BIZ-09 | operation_type一覧（distinct） |
| create_backup | なし | MNT-01 | Result（backup_path） |
| list_backups | なし | MNT-01 | BackupList（items[]{filename, created_at, size}） |
| get_effective_backup_dir | なし | MNT-01（backup::resolve_backup_dir） | 実効バックアップ保存先（文字列） |
| restore_backup | backup_path | MNT-01 | Result（success） |
| run_integrity_check | なし | BIZ-07 | IntegrityResult（mismatches[]） |
| fix_integrity | product_codes[] | BIZ-07 補正 | Result（fixed_count） |
| check_auto_backup | なし | MNT-01（backup::check_auto_backup） | Result（bool） |
| save_receipt_image | SaveImageRequest | BIZ-02（拡張子validation所有、BIZがIO-06 image_managerを呼ぶ） | Result（relative_path） |

CMD-11 の層経路は D-060 で正本化した（`ARCHITECTURE.md`「レイヤー間の呼び出し原則」参照）: 設定・操作ログ系は BIZ-09（`biz::system_service`）経由の標準経路、backup/restore 系は DB 接続所有権の交換を要する保守 orchestration として CMD → MNT-01 の正規経路（復旧規則の正本は function-design 71 §71.7）、領収書画像は base64 decode（CMD の wire 型変換）+ BIZ-02 の拡張子 validation。CMD から IO 層への直接呼び出しは禁止で、`src-tauri/tests/architecture_test.rs` の layer 依存 test が機械検査する（旧 allowlist の settings_cmd 例外 2 entry は削除済み）。検査対象は `use crate::db` / `use crate::io` の直接 import 行であり、re-export 経由の間接依存は対象外（検出強化は backlog）。

### 更新履歴

| 日付 | PR | 内容 |
|---|---|---|
| 2026-08-16 | PR #79 | SPEC-SDI-D3: 両取込みcommandの確認flagを `additional_import_confirmed` に統一。 |
