> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: [ARCHITECTURE.md](../ARCHITECTURE.md), [architecture/biz-task-specs.md §BIZ-08](../architecture/biz-task-specs.md), [DB_DESIGN.md](../DB_DESIGN.md), [db-design/pos-tables.md §12b-12e/B-2](../db-design/pos-tables.md), [29-io-daily-report-parser.md](29-io-daily-report-parser.md)

## 37. BIZ-08: 日報取込みロジック

### 37.1 目的

`daily_report_import_service` は、Z001/Z002/Z005 の日報bundleを `Parse -> Validate -> Preview -> Commit` で取り込むBIZ層サービスである。

日報取込みは、日報サマリ・支払集計・部門別売上の正本を作る。商品別売上や在庫引落しは作らない。Z004商品別CSV取込みはBIZ-03の責務として残す。

### 37.2 型定義

```rust
struct DailyReportPreviewData {
    file_info: DailyReportFileInfo,
    totals: DailyReportTotals,
    payment_summary: Vec<DailyReportPaymentLinePreview>,
    department_summary: Vec<DailyReportDepartmentLinePreview>,
    warnings: Vec<DailyReportWarning>,
    duplicate_check: DailyReportDuplicateCheck,
    preview_created_at: String,
}

struct DailyReportFileInfo {
    report_date: String,
    bundle_hash: String,
    source_files: Vec<DailyReportSourceFileInfo>,
}

struct DailyReportSourceFileInfo {
    source: DailyReportSourceKind, // IO-07で定義
    filename: String,
    file_hash: String,
    size_bytes: usize,
}

struct DailyReportTotals {
    gross_amount: Option<i64>,
    net_amount: Option<i64>,
}

struct DailyReportPaymentLinePreview {
    payment_key: String,
    label: String,
    amount: Option<i64>,
    count: Option<i64>,
    sort_order: i64,
}

struct DailyReportDepartmentLinePreview {
    department_id: Option<i64>,
    raw_department_name: String,
    normalized_department_name: Option<String>,
    amount: i64,
    quantity: Option<i64>,
    count: Option<i64>,
    sort_order: i64,
}

struct DailyReportWarning {
    code: String,
    message: String,
    source_file: Option<DailyReportSourceKind>,
    line_no: Option<i64>,
}

enum DailyReportDuplicateStatus {
    NoDuplicate,
    AlreadyImported,
    OverwriteRequired,
}

struct DailyReportDuplicateCheck {
    status: DailyReportDuplicateStatus,
    existing_import_id: Option<i64>,
}

struct DailyReportImportResult {
    daily_report_import_id: i64,
    status: String, // "completed"
    report_date: String,
    gross_amount: Option<i64>,
    net_amount: Option<i64>,
    warning_count: i64,
}

struct DailyReportParseValidateResult {
    preview_data: DailyReportPreviewData,
    cached_preview: CachedDailyReportPreview,
}

struct DailyReportInputFile {
    filename: String,
    bytes: Vec<u8>,
}

struct CachedDailyReportPreview {
    created_at: Instant,
    preview_data: DailyReportPreviewData,
    summary_lines: Vec<CachedDailyReportSummaryLine>,
    payment_lines: Vec<DailyReportPaymentLinePreview>,
    department_lines: Vec<DailyReportDepartmentLinePreview>,
}

struct CachedDailyReportSummaryLine {
    line_key: String,
    label: String,
    amount: Option<i64>,
    quantity: Option<i64>,
    count: Option<i64>,
    sort_order: i64,
}

struct DailyReportRollbackResult {
    daily_report_import_id: i64,
    status: String, // "rolled_back"
    rolled_back_at: Option<String>,
}

struct ListDailyReportImportsQuery {
    page: i64,
    per_page: i64,
    date_from: Option<String>,
    date_to: Option<String>,
    status: Option<String>,
}

struct DailyReportImport {
    id: i64,
    report_date: String,
    source_adapter: String,
    bundle_hash: String,
    gross_amount: Option<i64>,
    net_amount: Option<i64>,
    status: String,
    imported_at: String,
    rolled_back_at: Option<String>,
    source_files_json: String,
}
```

`DailyReportSourceKind` と `DailyReportSourceFile` は IO-07（§29.2）を所有元とする。CMD-12 はこの節のDTOを `specta::Type` 付きwire contractとして実装する。

### 37.3 parse_and_validate_daily_report

**関数要求**: 日報bundleをparse/validateし、commit前のpreviewを返す。

**シグネチャ**:

```rust
fn parse_and_validate_daily_report(
    conn: &DbConnection,
    files: Vec<DailyReportInputFile>,
) -> Result<DailyReportParseValidateResult, BizError>
```

**処理ステップ**:

1. ファイルサイズ上限を検証する。
2. IO-07 `parse_daily_report_bundle(files)` を呼ぶ。
3. `parse_errors` がある場合は `BizError::ImportError` として返す。
   - 返却前に `operation_logs.operation_type='daily_report_parse_failed'` を best-effort で記録する。
4. `report_date` を検証する。
   - IO-07はCV17出力上の `YYYY/M/D` / `YYYY-MM-DD` を `YYYY-MM-DD` へ正規化する。BIZ-08では正規化後の日付がYYYY-MM-DD形式でない、暦日として不正、3 sourceで不一致ならエラー。
5. bundle_hashを作る。
   - source順（Z001→Z002→Z005）に `source:file_hash:size` を連結してSHA-256化する。
6. 必須サマリを検証する。
   - adapterが `gross_sales` と `net_sales` の両方を導出できない場合はcommit不可。
7. Z005部門名を `departments.name` と照合する。
   - 一致した行は `department_id` を付与する。
   - 一致しない行はwarningにし、`department_id=None` のままpreview可能にする。
8. 重複判定を行う。
   - `bundle_hash` が同じ `completed` importあり → AlreadyImported。
   - `report_date` が同じ別 `completed` importあり → OverwriteRequired。
   - それ以外 → NoDuplicate。
9. `DailyReportParseValidateResult` を返す。
   - `preview_data` はUI表示用のwire DTO。
   - `cached_preview` はcommit用に、summary/payment/department明細の正規化済みsnapshotを保持する。

### 37.4 commit_daily_report_import

**関数要求**: preview済み日報bundleを確定保存する。

**シグネチャ**:

```rust
fn commit_daily_report_import(
    conn: &mut DbConnection,
    cached_preview: CachedDailyReportPreview,
    overwrite_confirmed: bool,
) -> Result<DailyReportImportResult, BizError>
```

**処理ステップ**:

1. previewの有効期限を確認する。30分超は `BizError::ImportError`。
2. duplicate_checkを再検証する。
   - AlreadyImported → `BizError::IdempotencyConflict`。
   - OverwriteRequired かつ overwrite_confirmed=false → `BizError::ValidationFailed`。
3. トランザクション開始。
4. OverwriteRequiredの場合、同一report_dateの既存 `completed` importを `rolled_back` に更新し、`rolled_back_at` を記録する。
5. `daily_report_imports` にINSERTする。
6. `daily_report_summary_lines` にZ001由来行をINSERTする。
7. `daily_report_payment_lines` にZ002由来行をINSERTする。
8. `daily_report_department_lines` にZ005由来行をINSERTする。
9. COMMIT。
10. `operation_logs` に `daily_report_import` を記録する。
11. operation log 記録に失敗した場合は取込み自体をROLLBACKせず、診断ログまたは後続確認対象として扱う。
12. `DailyReportImportResult` を返す。

### 37.5 rollback_daily_report_import

**関数要求**: 日報取込みを論理取消する。

**シグネチャ**:

```rust
fn rollback_daily_report_import(
    conn: &mut DbConnection,
    daily_report_import_id: i64,
) -> Result<DailyReportRollbackResult, BizError>
```

**処理ステップ**:

1. `daily_report_imports.id` で対象を取得する。
2. 存在しない場合は `BizError::NotFound`。
3. すでに `rolled_back` の場合は冪等成功として返す。
4. トランザクション開始。
5. `status='rolled_back'`, `rolled_back_at=now` に更新する。
6. COMMIT。
7. `operation_logs` に `daily_report_rollback` を記録する。
8. operation log 記録に失敗した場合はrollback済み状態を戻さず、診断ログまたは後続確認対象として扱う。

**重要**: rollbackしても `sale_records`、`inventory_movements`、`products.stock_quantity` は変更しない。日報取込みは在庫変動を作らないため、補正対象が存在しない。

### 37.6 list_daily_report_imports

**関数要求**: 日報取込み履歴をページング取得する。

**シグネチャ**:

```rust
fn list_daily_report_imports(
    conn: &DbConnection,
    query: ListDailyReportImportsQuery,
) -> Result<PaginatedResult<DailyReportImport>, BizError>
```

**検索条件**:
- page / per_page
- date_from / date_to（任意）
- status（任意。既定は全状態）

**入力ガード**:
- page < 1 → `BizError::ValidationFailed`
- per_page < 1 → `BizError::ValidationFailed`
- per_page > 100 → `BizError::ValidationFailed`

### 37.7 エラー表示に渡す意味

| 条件 | BizError | UI案内 |
|---|---|---|
| Z001/Z002/Z005欠損 | ImportError | 必要な3ファイルを選び直す |
| CP932 decode失敗 | ImportError | PCツールから出力した元ファイルを確認する |
| report_date不一致 | ImportError | 同じ営業日の3ファイルを選ぶ |
| 同一bundle取込み済み | IdempotencyConflict | 取込み済みのため二重取込みしない |
| 同日別bundleあり | ValidationFailed | 上書き確認が必要 |
| 部門未対応 | warning | 取込み可能。部門マスタ対応は後続で確認 |

### 37.8 非目的

- Z004商品別売上のparse/commit/rollback。
- 在庫引落し。
- 商品別ランキングの生成。
- Excel帳票のparse。
- ECR+や他レジ形式の直接取込み。
- `Z006`（グループ）、`Z009`（時間帯別）、`Z011`（担当者）の保存・集計。個人店の初期運用では使わない前提とし、必要性が確認された場合は後続設計で追加する。
