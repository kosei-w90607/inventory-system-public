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
    AdditionalImportConfirmationRequired,
}

struct DailyReportDuplicateCheck {
    status: DailyReportDuplicateStatus,
    same_date_imports: Vec<SameDateDailyReportImportSummary>,
}

struct SameDateDailyReportImportSummary {
    id: i64,
    source_filenames: Vec<String>,
    gross_amount: Option<i64>,
    net_amount: Option<i64>,
    imported_at: String,
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
    active_same_date_import_ids: Vec<i64>,
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
   - **BIZ-08-D1**: 各errorの `source_file` / `filename` / `line_no` / `error_type` / `error_message` を開発者向けdiagnostic WARNへ構造化して記録する。filenameはunknown sourceを含む入力識別用で、diagnostic専用とする。
   - 利用者向けerror messageと `operation_logs.summary` は汎用文言を維持し、raw parse detailをwireまたは `operation_logs.detail_json` へ載せない。
   - 返却前に `operation_logs.operation_type='daily_report_parse_failed'` を best-effort で記録する。
4. `report_date` を検証する。
   - IO-07はCV17出力上の `YYYY/M/D` / `YYYY-MM-DD` を `YYYY-MM-DD` へ正規化する。BIZ-08では正規化後の日付がYYYY-MM-DD形式でない、暦日として不正、3 sourceで不一致ならエラー。
5. bundle_hashを作る。
   - source順（Z001→Z002→Z005）に `source:file_hash:size` を連結してSHA-256化する。
6. 必須サマリを検証する。
   - adapterが `gross_sales` と `net_sales` の両方を導出できない場合はcommit不可。
7. Z005部門名を `departments.name` と照合する。
   - 一致した行は `department_id` を付与する。
   - 一致しない行はwarningにし、`source_file=Z005`、`department_id=None` のままpreview可能にする。IO line側へ重複したsource fieldは要求しない（IO-07-D1）。
8. 冪等性と同日追加判定を行う。
   - `bundle_hash` が同じ `completed` importあり → AlreadyImported。
   - `report_date` が同じ別 `completed` importあり → AdditionalImportConfirmationRequired。
   - それ以外 → NoDuplicate。
   - 同日active importは `imported_at DESC, id DESC` で全件取得し、`same_date_imports` に写像する。`source_files_json` はBIZで安全に解析して `source_filenames` を取り出し、欠損・破損時はfilenameを捏造せずparse failureとして安全側に止める。hashはwireへ返さない。
   - 同じ順序の全IDを `CachedDailyReportPreview.active_same_date_import_ids` に保持する。
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
    additional_import_confirmed: bool,
) -> Result<DailyReportImportResult, BizError>
```

**処理ステップ**:

1. previewの有効期限を確認する。30分超は `BizError::ImportError`。
2. cached duplicate status と確認flagの組合せを検証する。
   - AlreadyImported → `BizError::IdempotencyConflict`。
   - NoDuplicate は `additional_import_confirmed=false`、AdditionalImportConfirmationRequired は `true` のみ許可し、不一致は `BizError::ValidationFailed`。
3. トランザクション開始。
4. TX内で `bundle_hash` のactive一致を最初に再検査する。一致があれば `BizError::IdempotencyConflict` として副作用なしで止める。
5. TX内で同一report_dateのactive import IDを `imported_at DESC, id DESC` で再取得し、cached snapshotと完全一致することを確認する。不一致なら副作用なしで止め、`BizError::ImportError("同日の取込み状況が変わりました。再度プレビューしてください")` を返す。
6. 既存importを変更せず、`daily_report_imports` にINSERTする。
7. `daily_report_summary_lines` にZ001由来行をINSERTする。
8. `daily_report_payment_lines` にZ002由来行をINSERTする。
9. `daily_report_department_lines` にZ005由来行をINSERTする。
10. COMMIT。
11. `operation_logs` に `daily_report_import` を記録する。
12. operation log 記録に失敗した場合は取込み自体をROLLBACKせず、診断ログまたは後続確認対象として扱う。
13. `DailyReportImportResult` を返す。

commitはinsert-onlyであり、既存の同日parentや配下明細を無効化しない。通常のcommit失敗は同じpreview tokenで再試行できるが、active snapshot不一致は新しいpreviewとtokenを必須とする。

### 37.5 rollback_daily_report_import

**関数要求**: 指定した日報取込みIDだけを論理取消する。同一report_dateの他のcompleted importは残す。

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

**重要**: 更新条件は指定IDだけとし、同日の他importは変更しない。rollbackしても `sale_records`、`inventory_movements`、`products.stock_quantity` は変更しない。日報取込みは在庫変動を作らないため、補正対象が存在しない。operation logには対象IDを必ず記録する。

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

履歴はimport単位の行を維持し、日付単位にcollapseしない。順序は `report_date DESC, imported_at DESC, id DESC` とする。

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
| 同日別bundleで追加確認なし / 不要なのに確認あり | ValidationFailed | previewの状態に従って追加確認をやり直す |
| 同日active snapshot変更 | ImportError | 同日の取込み状況が変わったため再度previewする |
| 部門未対応 | warning | 取込み可能。部門マスタ対応は後続で確認 |

### 37.8 非目的

- Z004商品別売上のparse/commit/rollback。
- 在庫引落し。
- 商品別ランキングの生成。
- Excel帳票のparse。
- ECR+や他レジ形式の直接取込み。
- `Z006`（グループ）、`Z009`（時間帯別）、`Z011`（担当者）の保存・集計。個人店の初期運用では使わない前提とし、必要性が確認された場合は後続設計で追加する。

### 更新履歴

| 日付 | PR | 内容 |
|---|---|---|
| 2026-08-16 | PR #79 | SPEC-SDI-D1〜D8: AlreadyImportedを維持しつつ同日別bundleを追加取込みとし、全件summary、TX内snapshot再検証、insert-only commit、per-import rollbackを正本化。 |
