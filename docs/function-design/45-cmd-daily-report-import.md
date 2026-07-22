> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: [architecture/cmd-task-specs.md §CMD-12](../architecture/cmd-task-specs.md), [37-biz-daily-report-import-service.md](37-biz-daily-report-import-service.md)

## 45. CMD-12: 日報取込みコマンド群

### 45.1 モジュール構成

```text
src-tauri/src/
  cmd/
    daily_report_import_cmd.rs
```

CMD-12 は薄いラッパーであり、Z001/Z002/Z005のsource判定、部門照合、重複判定、日報保存判断はBIZ-08へ委譲する。

### 45.2 AppState

既存のCSV preview cacheと同じAppState内に、型を分けた日報preview cacheを追加する。

```rust
struct AppState {
    db: Mutex<Connection>,
    preview_cache: Mutex<HashMap<String, CachedPreview>>,
    daily_report_preview_cache: Mutex<HashMap<String, CachedDailyReportPreview>>,
}
```

DB Mutex と cache Mutex は同時に長時間保持しない。CMD-07と同じく、cache取得/更新は短時間で分ける。

### 45.3 parse_and_validate_daily_report

**関数要求**: フロントエンドから渡された3ファイルをBIZ-08へ渡し、previewとpreview_tokenを返す。

**シグネチャ**:

```rust
#[tauri::command]
fn parse_and_validate_daily_report(
    state: State<AppState>,
    files: Vec<DailyReportSourceFileRequest>,
) -> Result<DailyReportPreviewResponse, CmdError>
```

**入力型**:

```rust
struct DailyReportSourceFileRequest {
    filename: String,
    file_bytes: Vec<u8>,
}
```

**出力型**:

```rust
struct DailyReportPreviewResponse {
    preview_data: DailyReportPreviewData,
    preview_token: String,
}
```

`DailyReportPreviewData`、`DailyReportImportResult`、`DailyReportRollbackResult`、`DailyReportImport` は [37.2](37-biz-daily-report-import-service.md#372-型定義) / `sales_repo` のDTOを所有元とする。CMD-12実装では、UIに返すDTOに `specta::Type` を付けてTauri wire型として公開する。`CachedDailyReportPreview` はAppState内部専用であり、wire型にはしない。

**処理ステップ**:
1. `files.len()` が3以外なら `CmdError.kind="validation"`。
2. 各ファイルが20MBを超える場合は `CmdError.kind="validation"`。
3. DB接続を取得する。
4. BIZ-08 `parse_and_validate_daily_report` を呼ぶ。
5. 成功時、UUID preview_tokenを生成し `daily_report_preview_cache` に保存する。
6. preview responseを返す。

### 45.4 commit_daily_report_import

**シグネチャ**:

```rust
#[tauri::command]
fn commit_daily_report_import(
    state: State<AppState>,
    preview_token: String,
    overwrite_confirmed: bool,
) -> Result<DailyReportImportResult, CmdError>
```

**処理ステップ**:
1. preview_tokenのUUID形式を検証する。
2. `daily_report_preview_cache` からcached previewを取得する。
3. cache miss / 期限切れは `CmdError.kind="import_error"`。
4. DB接続を取得する。
5. BIZ-08 `commit_daily_report_import` を呼ぶ。
6. 成功時、cacheからtokenを削除する。
7. 失敗時、cacheは残して再試行可能にする。

### 45.5 rollback_daily_report_import

```rust
#[tauri::command]
fn rollback_daily_report_import(
    state: State<AppState>,
    daily_report_import_id: i64,
) -> Result<DailyReportRollbackResult, CmdError>
```

BIZ-08 `rollback_daily_report_import` を呼ぶ。成功時の frontend query invalidation は [D-052](../decision-log.md) C10 と `src/lib/invalidation-contract.ts` を正本とする。sale_records / inventory_movements / products は変わらない。

### 45.6 list_daily_report_imports

```rust
#[tauri::command]
fn list_daily_report_imports(
    state: State<AppState>,
    page: i64,
    per_page: i64,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<PaginatedResult<DailyReportImport>, CmdError>
```

**入力ガード**:
- page < 1 → `CmdError.kind="validation"`
- per_page < 1 → `CmdError.kind="validation"`
- per_page > 100 → `CmdError.kind="validation"`

status filter は第1スライスでは公開しない。BIZ-08のquery型には内部拡張用に `status` を残し、CMD-12からは `None` を渡す。

### 45.7 CmdError変換

| BIZ-08 error | CmdError.kind | message |
|---|---|---|
| ImportError(msg) | import_error | msgをそのまま使用 |
| IdempotencyConflict(msg) | idempotency_conflict | msgをそのまま使用 |
| ValidationFailed(msg) | validation | msgをそのまま使用 |
| NotFound(msg) | not_found | msgをそのまま使用 |
| DatabaseError(_) | internal | データベースエラーが発生しました。もう一度お試しください |

### 45.8 生成bindings

CMD-12を実装するPRでは `#[specta::specta]` と `specta::Type` deriveを付与し、`src/lib/bindings.ts` を再生成する。

対象:
- `parse_and_validate_daily_report`
- `commit_daily_report_import`
- `rollback_daily_report_import`
- `list_daily_report_imports`
