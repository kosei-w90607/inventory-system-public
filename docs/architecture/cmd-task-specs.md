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
| search_products | SearchQuery（keyword, department_id?, is_discontinued?, sort, page, per_page） | BIZ-01 商品検索 | ProductList（items[], total_count） |
| get_product | product_code | BIZ-01 商品取得 | Product（全フィールド＋部門名＋取引先名） |
| preview_import | FileBytes | BIZ-01 一括インポート前半 | ImportPreview（valid_rows[], error_rows[], duplicate_rows[]） |
| commit_import | ImportCommitRequest（valid_rows[], overwrite_codes[]） | BIZ-01 一括インポート後半 | ImportResult（created, updated, skipped, errors） |

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
| commit_csv_import | CommitRequest（preview_token, overwrite_confirmed） | BIZ-03 Stage4 | ImportResult（csv_import_id, status, total_items, skipped_count） |
| rollback_csv_import | csv_import_id | BIZ-03 ロールバック | RollbackResult（success, voided_sale_count, stock_corrections） |
| list_csv_imports | ListQuery（page, per_page） | BIZ-03経由 | PaginatedResult\<CsvImport\> |

### CMD-12: 日報取込みコマンド群

| コマンド名 | 入力 | 呼び出すBIZ | 出力 |
|-----------|------|-----------|------|
| parse_and_validate_daily_report | DailyReportSourceFile[]（filename, file_bytes） | BIZ-08 Stage1+2 | DailyReportPreviewResponse（preview_data, preview_token） |
| commit_daily_report_import | CommitDailyReportRequest（preview_token, overwrite_confirmed） | BIZ-08 Stage4 | DailyReportImportResult（daily_report_import_id, status, report_date, warning_count） |
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
| prepare_plu_export | ExportMode（'full' / 'diff'） | BIZ-04 | PluExportPreparedResult（tsv_output, count, target_product_codes, excluded=要修正一覧, over_limit_warning。D-028） |
| confirm_plu_export_saved | product_codes[] | BIZ-04 | PluExportConfirmResult（updated_count, confirmed_at） |
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
| get_settings | なし | IO-01経由（許可済み例外） | AppSettings（全設定値） |
| update_setting | key, value | IO-01経由（許可済み例外） | Result（success） |
| list_logs | LogQuery（page, per_page, operation_type?） | IO-01経由（許可済み例外） | LogList（items[], total_count） |
| create_backup | なし | MNT-01 | Result（backup_path） |
| list_backups | なし | MNT-01 | BackupList（items[]{filename, created_at, size}） |
| restore_backup | backup_path | MNT-01 | Result（success） |
| run_integrity_check | なし | BIZ-07 | IntegrityResult（mismatches[]） |
| fix_integrity | product_codes[] | BIZ-07 補正 | Result（fixed_count） |
| check_auto_backup | なし | MNT-01（backup::check_auto_backup） | Result（bool） |
| save_receipt_image | SaveImageRequest | IO-06（image_manager::save_receipt_image） | Result（relative_path） |

CMD-11 の `get_settings` / `update_setting` / `list_logs` は、業務ロジックを持たない設定・ログ参照として `settings_cmd` から `system_repo` を直接呼ぶ。これは `src-tauri/tests/architecture_test.rs` の allowlist と function-design §43 に基づく許可済み例外であり、他の CMD は UI -> CMD -> BIZ -> IO/MNT 境界を保つ。
