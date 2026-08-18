## 17. CMD-07: Z004商品別CSV取込みコマンド群 / CMD-08: PLU書出しコマンド群

> **2026-06-30 REQ-401 redesign note**: 本書のCMD-07は既存Z004商品別CSV取込みのTauri command契約を記録する。current operation のZ001/Z002/Z005日報取込みは [45-cmd-daily-report-import.md](45-cmd-daily-report-import.md) のCMD-12で扱う。CMD-07へ日報bundleを追加しない。

### 17.1 モジュール構成

```
src-tauri/src/
  cmd/
    mod.rs               -- pub mod csv_import_cmd, pub mod plu_export_cmd を追加
    product_cmd.rs       -- 既存（CMD-01）
    csv_import_cmd.rs    -- CSV取込み関連のTauriコマンド（CMD-07）
    plu_export_cmd.rs    -- PLU書出し関連のTauriコマンド（CMD-08）
```

---

### 17.2 CMD層の原則

CMD層は薄いラッパー。以下のみを行う:

1. state.db.lock() でDB接続を取得
2. キャッシュ操作が必要なコマンド（parse_and_validate_csv, commit_csv_import）では state.preview_cache.lock() でキャッシュを取得
3. BIZ層の関数を呼び出す
4. BizError → CmdError に変換して返す

**やらないこと**:
- 業務バリデーション（BIZ層の責務）
- ビジネスロジック（BIZ層の責務）
- ファイルパス検証（フロントエンド側の責務）
- file_hash算出（IO-02の責務）

**例外（CMD層で行う防御的入力チェック）**:
- ファイルサイズ上限の早期チェック（巨大バイト列をBIZ層に渡す前に弾く。BIZ層にも同じチェックあり）
- preview_tokenのUUID形式チェック（不正トークンをBIZ層に渡す前に弾く）
- これらは業務バリデーションではなく、入力形式の防御的チェック

**ファイルバイト列の受け渡し方針**:
フロントエンドがFileAPIで読み込んだバイナリを `Vec<u8>` としてTauriコマンドに渡す。CMD層はバイト列をそのままBIZ層に中継する。

---

### 17.3 AppState の拡張

CSV取込みのPreviewキャッシュをAppStateに追加する。

```
struct AppState {
    db: Mutex<Connection>,
    preview_cache: Mutex<HashMap<String, CachedPreview>>,  // BIZ-03用
}
```

CMD層では以下のパターンでロックを取得する:

**ロック区間最小化**: BIZロジック実行中はキャッシュロックを保持しない
**デッドロック防止**: DB Mutex と cache Mutex を同時に保持しない（短時間のcache操作→unlock→DB lock→BIZ→cache操作の順序で分離）

```
// DB接続のみ必要な場合（prepare_plu_export, confirm_plu_export_saved, list_plu_dirty等）
let mut conn = state.db.lock().map_err(|_| ...)?;
let result = biz::some_function(&mut conn, ...);

// DB接続 + キャッシュの両方が必要な場合（parse_and_validate, commit等）
// パターン: cache lock → 短時間操作 → cache unlock → DB lock → BIZ呼出し → cache lock → 後処理
{
    let mut cache = state.preview_cache.lock().map_err(|_| ...)?;
    // キャッシュからデータ取得（短時間でunlock）
} // cache lock解放
let mut conn = state.db.lock().map_err(|_| ...)?;
let result = biz::some_function(&mut conn, ...);
{
    let mut cache = state.preview_cache.lock().map_err(|_| ...)?;
    // キャッシュ更新（短時間でunlock）
}
```

---

### 17.4 BizError → CmdError 変換（POS連携追加分）

既存の変換ルール（40-cmd-product.md 5.3節）に以下を追加:

| BizError | CmdError.kind | CmdError.message |
|----------|--------------|------------------|
| ImportError(msg) | "import_error" | msg をそのまま使用 |
| ExportError(msg) | "export_error" | msg をそのまま使用 |
| IdempotencyConflict(msg) | "idempotency_conflict" | msg をそのまま使用 |
| ValidationFailed(msg) | "validation" | msg をそのまま使用（既存） |
| NotFound(msg) | "not_found" | msg をそのまま使用（既存） |
| DatabaseError(_) | "internal" | "データベースエラーが発生しました。もう一度お試しください"（既存。error_id: Some(発行) — 40-cmd-product.md 5.3 CMD-ERR-D1 参照） |

**import_error を新設した理由**: CSV取込み固有のエラー（ファイル形式不正、重複ブロック、キャッシュ期限切れ等）は validation とは性質が異なる。UI側で「再度ファイルを選択してください」等のCSV取込み固有の案内を出すために種別を分ける。

**export_error を新設した理由（BIZ-04-D2、監査是正 順8 / P7b-3）**: `import_error` は取込み画面の recovery 分岐（プレビューキャッシュ消失 → ファイル再選択）と結びついた種別であり、PLU書出し（export）失敗を `import_error` で返すと、取込み向け recovery 文言・分岐へ誤誘導する。書出し系の失敗（PluFormatError 由来等）は `export_error` として分離し、取込み語彙を書出し経路に持ち込まない。

**enum 契約化（D-061）**: `import_error` / `export_error` / `idempotency_conflict` の3値は D-061 (d) により `CmdErrorKind` の variant となる（40 §5.3 参照）。値・分岐・文言は不変。

---

### 17.5 CMD-07 コマンド

#### parse_and_validate_csv

**関数要求**: Z004ファイルを受け取り、BIZ-03のparse_and_validateを呼び出してプレビューデータを返す

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn parse_and_validate_csv(
    state: State<AppState>,
    file_bytes: Vec<u8>,
    filename: String,
) -> Result<ParseAndValidateResponse, CmdError>
```

**入力型**:
```
// Tauriコマンドの引数（フロントエンドからJSON経由）
file_bytes: Vec<u8>   // FileAPIで読み込んだZ004ファイルのバイト列
filename: String       // ファイル名（例: "Z004_260321"）
```

**出力型**:
```
struct ParseAndValidateResponse {
    preview_data: PreviewData,   // BIZ-03の型をそのまま使用
    preview_token: String,       // commit時に送り返すトークン
}
```

`PreviewData.duplicate_check` のwire形状は `status: DuplicateStatus` と `same_date_imports: Vec<SameDateCsvImportSummary>` で固定する。summaryは `id / filename / total_items / total_amount / imported_at` を持ち、順序は `imported_at DESC, id DESC`。単一parentだけを示すfieldは公開しない。

**処理ステップ**（17.3のロック区間最小化パターンに従う）:
1. file_bytes.len() > 20 * 1024 * 1024 → CmdError { kind: "validation", message: "ファイルサイズが上限(20MB)を超えています", field: None } を即返却
2. state.db.lock() でDB接続を取得
3. CsvParseAndValidateRequest { file_bytes, filename } を構築
4. biz::csv_import_service::parse_and_validate(&conn, req) を呼ぶ（BIZ実行中はcache lockなし）
5. Ok → state.preview_cache.lock() でキャッシュにpreview_tokenを保存 → ParseAndValidateResponse を返す
6. Err(BizError) → CmdError に変換して返す

**設計判断 — サイズチェックの二重実施**: CMD層でもサイズチェックを行う理由は、20MBのバイト列をBIZ層に渡す前に弾くことでメモリ効率を改善するため。BIZ層にも同じチェックがあるが（15.3節ステップ1）、CMD層での早期リターンは防御的プログラミング。

**入力例**:
```json
{
  "file_bytes": [131, 80, 131, ...],
  "filename": "Z004_260321"
}
```
※ file_bytes はCP932バイト列の10進表記

**出力例**:
```json
{
  "preview_data": {
    "file_info": {
      "filename": "Z004_260321",
      "settlement_date": "2026-03-21",
      "file_hash": "a1b2c3d4e5f6..."
    },
    "matched_summary": {
      "count": 45,
      "total_amount": 28500,
      "warnings": []
    },
    "error_summary": {
      "count": 3,
      "items": [
        {
          "line_no": 12,
          "normalized_jan": "4973167064078",
          "name": "ﾎﾞﾀﾝ ﾊﾞﾗ",
          "raw_quantity": "2",
          "raw_amount": "440",
          "error_type": "unmatched_product",
          "error_message": "JAN 4973167064078 に該当する商品がありません"
        }
      ]
    },
    "duplicate_check": {
      "status": "NoDuplicate",
      "same_date_imports": []
    },
    "preview_created_at": "2026-03-21T19:30:00"
  },
  "preview_token": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### commit_csv_import

**関数要求**: プレビュー済みデータの取込みを確定する。preview_tokenでキャッシュを復元してBIZ-03のcommitを実行する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn commit_csv_import(
    state: State<AppState>,
    preview_token: String,
    additional_import_confirmed: bool,
) -> Result<ImportResult, CmdError>
```

**入力型**:
```
preview_token: String       // parse_and_validate_csvが返したトークン
additional_import_confirmed: bool // 同日別hashを既存分へ追加する確認済みフラグ
```

**出力型**:
```
// BIZ-03のImportResultをそのまま使用
struct ImportResult {
    csv_import_id: i64,
    status: CsvImportStatus, // "completed" / "completed_partial"
    total_items: i64,
    total_amount: i64,
    skipped_count: i64,
}
```

**処理ステップ**（17.3のロック区間最小化パターンに従う）:
1. preview_token のUUID形式バリデーション（非UUID → CmdError { kind: "validation" } で即返却）
2. state.preview_cache.lock() → preview_tokenでキャッシュからデータ取得 → unlock
3. キャッシュミス（不存在/追い出し/再起動） → CmdError { kind: "import_error", message: "プレビューが見つかりません。再度ファイルを選択してください" }
   - 有効期限切れ（created_at.elapsed() > 30分） → cache.remove → CmdError { kind: "import_error", message: "プレビューの有効期限が切れました（30分）。再度ファイルを選択してください" }
4. state.db.lock() でDB接続を取得
5. CommitRequest { additional_import_confirmed, cached_data } を構築（preview_tokenの検証・cache対応確認はCMD層で完了し、BIZ requestへ重複保持しない。BIZ-03-D1）
6. biz::csv_import_service::commit_csv_import(&mut conn, req) を呼ぶ（BIZ実行中はcache lockなし）
7. Ok → state.preview_cache.lock() → キャッシュからtoken削除 → ImportResult を返す
8. Err(BizError) → CmdError に変換して返す。通常の失敗はキャッシュを保持して再試行可能にする。BIZが `同日の取込み状況が変わりました。再度プレビューしてください` を返した場合だけtokenを削除し、同じpreviewでの再試行を禁止する

**入力例**:
```json
{
  "preview_token": "550e8400-e29b-41d4-a716-446655440000",
  "additional_import_confirmed": false
}
```

**出力例**:
```json
{
  "csv_import_id": 1,
  "status": "completed_partial",
  "total_items": 45,
  "total_amount": 28500,
  "skipped_count": 3
}
```

---

#### rollback_csv_import

**関数要求**: 指定したCSV取込みをロールバック（論理無効化）する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn rollback_csv_import(
    state: State<AppState>,
    csv_import_id: i64,
) -> Result<RollbackResult, CmdError>
```

**入力型**:
```
csv_import_id: i64   // ロールバック対象のCSV取込みID
```

**出力型**:
```
// BIZ-03のRollbackResultをそのまま使用
struct RollbackResult {
    success: bool,
    voided_sale_count: u64,
    voided_movement_count: usize,
    stock_corrections: Vec<StockCorrection>,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::csv_import_service::rollback_csv_import(&mut conn, csv_import_id) を呼ぶ
3. Ok → RollbackResult をそのまま返す
4. Err(BizError) → CmdError に変換して返す

**入力例**:
```json
{
  "csv_import_id": 5
}
```

**出力例**:
```json
{
  "success": true,
  "voided_sale_count": 45,
  "voided_movement_count": 42,
  "stock_corrections": [
    { "product_code": "4976383262108", "old_stock": 14, "new_stock": 17 },
    { "product_code": "4976383262207", "old_stock": 2, "new_stock": 10 }
  ]
}
```

---

#### list_csv_imports

**関数要求**: CSV取込み履歴の一覧を返す。ページング対応

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn list_csv_imports(
    state: State<AppState>,
    page: u32,
    per_page: u32,
) -> Result<PaginatedResult<CsvImport>, CmdError>
```

**入力型**:
```
page: u32       // ページ番号（1始まり）
per_page: u32   // 1ページあたりの件数（上限200、BIZ/IO層でクランプ）
```

**出力型**:
```
// 共通型PaginatedResultを使用
PaginatedResult<CsvImport> {
    items: Vec<CsvImport>,
    total_count: u32,
    page: u32,
    per_page: u32,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::csv_import_service::list_csv_imports(&conn, page, per_page) を呼ぶ
3. Ok → PaginatedResult をそのまま返す
4. Err(BizError) → CmdError に変換して返す

**入力例**:
```json
{
  "page": 1,
  "per_page": 20
}
```

**出力例**:
```json
{
  "items": [
    {
      "id": 3,
      "filename": "Z004_260323",
      "settlement_date": "2026-03-23",
      "file_hash": "f1e2d3c4b5a6...",
      "total_items": 52,
      "total_amount": 34200,
      "skipped_count": 1,
      "status": "completed_partial",
      "imported_at": "2026-03-23T19:45:00"
    },
    {
      "id": 2,
      "filename": "Z004_260322",
      "settlement_date": "2026-03-22",
      "file_hash": "a9b8c7d6e5f4...",
      "total_items": 38,
      "total_amount": 21600,
      "skipped_count": 0,
      "status": "completed",
      "imported_at": "2026-03-22T19:30:00"
    }
  ],
  "total_count": 15,
  "page": 1,
  "per_page": 20
}
```

---

#### get_csv_import_record

**関数要求**: CSV取込み記録詳細を取得し、ヘッダ、sale_records 明細、エラー行、関連在庫変動、rollback 状態を表示できる形で返す（[65-inventory-record-traceability.md](65-inventory-record-traceability.md) §65.3 `/csv-import/records/$importId` / §65.5 CSV取込み列）

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn get_csv_import_record(
    state: State<AppState>,
    import_id: i64,
) -> Result<CsvImportRecordDetail, CmdError>
```

**出力型**: [32-biz-csv-import-service.md](32-biz-csv-import-service.md) §15.6a の CsvImportRecordDetail（movements は source 補完済み）

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::csv_import_service::get_csv_import_record(&conn, import_id) を呼ぶ
3. Ok → CsvImportRecordDetail をそのまま返す
4. Err(BizError::NotFound) → CmdError.kind="not_found" に変換して返す
5. Err(other) → 17.4 の変換表に従い CmdError に変換して返す

read-only command であり、preview キャッシュ・idempotency・operation log 記録には関与しない（[31-biz-inventory-service.md](31-biz-inventory-service.md) §12.6a の read-only 責務分離と同じ）。

---

### 17.6 CMD-08 コマンド

#### prepare_plu_export

**関数要求**: CV17 1.1.1向けPLUタブ区切りテキストを生成して返す。フロントエンドが保存先を選び、保存する。prepare は slot 予約を 1 transaction で永続化するが、商品を反映済みにはしない（CMD-08-D3 / SPEC-PLS-D3〜D5）

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn prepare_plu_export(
    state: State<AppState>,
    mode: String,
) -> Result<PluExportPrepareResponse, CmdError>
```

**入力型**:
```
mode: String   // "full" または "diff"
```

**出力型**:
```
// CMD層はBIZ-04のPluExportPreparedResultをフロントエンド向けに変換して返す
struct PluExportPrepareResponse {
    bytes_base64: String,            // PluFileOutput.bytes をbase64エンコード
    suggested_filename: String,      // PluFileOutput.suggested_filename（例: PLU_20260408.txt）
    content_type: String,            // PluFileOutput.content_type
    encoding: String,                // PluFileOutput.encoding
    count: usize,                    // 書出し行数（dedup 後）
    target_product_codes: Vec<String>,  // confirm対象。dedup 群の全メンバーを含むため count と長さが一致しないことがある（D-028）
    prepared_rows: Vec<PluPreparedRowResponse>, // memory_no、row_kind、exact product set
    excluded: Vec<PluExcludedProductResponse>,  // 要修正一覧（D-028）
}

struct PluPreparedRowResponse {
    memory_no: i64,
    row_kind: PluPreparedRowKind, // product | clear（generated enum）
    target_product_codes: Vec<String>,
}

// 要修正一覧の1件（BIZ-04のPluExcludedProductをフロントエンド向けに変換）
struct PluExcludedProductResponse {
    product_code: String,
    jan_code: Option<String>,
    name: String,
    memory_no: Option<i64>, // 既存 slot がある要修正行だけ Some。slot は維持し非出力
    reason: String,  // "missing_jan" | "invalid_jan_format" | "invalid_check_digit" | "group_price_mismatch" | "no_free_slot"
                     // BIZのPluExcludedReason列挙型をsnake_case文字列で表現。日本語文言への変換はUI側（67-ui excluded reasons 参照）
}
```

**処理ステップ**:
1. mode文字列 → ExportMode変換
   - "full" → ExportMode::Full
   - "diff" → ExportMode::Diff
   - その他 → CmdError { kind: "validation", message: "書出しモードは 'full' または 'diff' を指定してください", field: Some("mode") }
2. state.db.lock() でDB接続を取得
3. PluExportPrepareRequest { mode: export_mode } を構築
4. biz::plu_export_service::prepare_plu_export(&mut conn, req) を呼ぶ（slot 予約 TX を BIZ-04 が所有）
   - snapshot 未読込みは `register_snapshot_required`。JAN不備、同一JAN価格不一致、空きなしは BizError にならず `excluded`（要修正リスト）として Ok で返る。固定件数との比較は行わない
5. Ok → PluExportPreparedResult を PluExportPrepareResponse に変換（bytes → base64エンコード）して返す
6. Err(BizError) → CmdError に変換して返す

**設計判断 — mode の型（D-061 で改訂）**: `ExportMode` generated enum を直受けする。旧手動変換と無効値時の `validation` 文言は退役し、不正値は serde deserialize 拒否へ統一した（UI は固定 toggle からのみ呼び出されるため到達不能）。正常値の wire 表現（`"full"` / `"diff"`）と利用者可視の挙動は不変。

**入力例**:
```json
{
  "mode": "diff"
}
```

**出力例**:
```json
{
  "bytes_base64": "g1CDLi4u",
  "suggested_filename": "PLU_20260408.txt",
  "content_type": "text/tab-separated-values",
  "encoding": "CP932",
  "count": 42,
  "target_product_codes": ["4976383262108", "HZ-0099"],
  "excluded": [
    { "product_code": "BT-0012", "jan_code": null, "name": "JANなし商品", "reason": "missing_jan" }
  ],
    "prepared_rows": []
}
```
※ bytes_base64 はCP932バイト列のbase64エンコード。フロントエンド側でbase64デコードし、native save dialogで選んだ保存先に書き込む。CV17 1.1.1 の import dialog では `.txt` を既定拡張子として扱う。

---

#### confirm_plu_export_saved

**関数要求**: PLUファイル保存後に、フロントエンドが保持するprepare時の対象商品コードだけを書出し済みにする

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn confirm_plu_export_saved(
    state: State<AppState>,
    product_codes: Vec<String>,
    prepared_rows: Vec<PluPreparedRowResponse>,
) -> Result<PluExportConfirmResponse, CmdError>
```

**入力型**:
```
product_codes: Vec<String>   // prepare_plu_exportが返したtarget_product_codes
prepared_rows: Vec<PluPreparedRowResponse> // prepare が返した exact memory_no / row_kind / product set
```

**出力型**:
```
struct PluExportConfirmResponse {
    updated_count: usize,
    confirmed_at: String,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. PluExportConfirmRequest { product_codes, prepared_rows } を構築
3. biz::plu_export_service::confirm_plu_export_saved(&mut conn, req) を呼ぶ
4. Ok → PluExportConfirmResponse に変換して返す
5. Err(BizError) → CmdError に変換して返す

**設計判断 — confirmを別コマンドにする理由**:
- `prepare_plu_export` はファイル生成だけであり、保存キャンセル、保存失敗、PCツール投入失敗を回復できるように `plu_dirty` を残す
- `confirm_plu_export_saved` は利用者が保存済み扱いにすると明示した後だけ呼ぶ
- product_codes と memory_no は prepare 結果の exact set とし、prepare後に別商品・別 slot が変化しても巻き込まない

---

#### import_plu_register_snapshot（CMD-08-D4 / SPEC-PLS-D2）

```rust
#[tauri::command]
#[specta::specta]
fn import_plu_register_snapshot(
    state: State<AppState>,
    path: String,
) -> Result<PluRegisterSnapshotSummaryResponse, CmdError>
```

共通 FilePicker（D-054）が選んだ Z004 path を受け、BIZ-04 の snapshot 取込みを呼ぶ。path / 実コードを response や operation log に複製せず、`snapshot_at`, `free_count`, `external_count`, `app_managed_count`, `conflict_count` の要約だけを返す。

#### get_plu_slot_summary（CMD-08-D5 / SPEC-PLS-D2、D7）

```rust
#[tauri::command]
#[specta::specta]
fn get_plu_slot_summary(
    state: State<AppState>,
) -> Result<PluRegisterSnapshotSummaryResponse, CmdError>
```

`app_settings` と `plu_slots` から最後の読込み日時と占有要約を read-only で返す。snapshot 未読込みは null timestamp と zero summary で表し、prepare の gate 判定は BIZ-04 が行う。

---

#### list_plu_dirty

**関数要求**: PLU書出しが必要な商品（plu_dirty=1）の一覧を返す。UI-08の差分対象プレビュー用

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn list_plu_dirty(
    state: State<AppState>,
) -> Result<Vec<ProductResponse>, CmdError>
```

**入力型**: なし

**出力型**:
```
// ProductResponseは既存のCMD-01で使用している商品レスポンス型
Vec<ProductResponse>
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::plu_export_service::list_plu_dirty(&conn) を呼ぶ
3. Ok → Vec<Product> を Vec<ProductResponse> に変換して返す
4. Err(BizError) → CmdError に変換して返す

**設計判断 — 戻り値の型**: BIZ層が返す `Vec<Product>` をそのままフロントエンドに返さず、`ProductResponse` に変換する。CMD-01と同じ商品レスポンス型を使うことで、フロントエンドの型定義を統一する。

`import_plu_register_snapshot` / `get_plu_slot_summary`、prepare / confirm の `memory_no` DTO、`no_free_slot`、`plu_memory_no` は後続実装 A/B で specta 登録と bindings 再生成を行う。本 design-first PR は `src/lib/bindings.ts` を変更しない。

**入力例**: なし（引数なし）

**出力例**:
```json
[
  {
    "product_code": "4976383262108",
    "jan_code": "4976383262108",
    "name": "ハマナカ アミアミ極太 col.42",
    "department_id": 3,
    "department_name": "毛糸",
    "selling_price": 648,
    "cost_price": 111,
    "stock_quantity": 14,
    "plu_dirty": true,
    "plu_exported_at": null
  },
  {
    "product_code": "HZ-0099",
    "jan_code": null,
    "name": "ヘアゴム花柄 ピンク",
    "department_id": 2,
    "department_name": "ヘア雑貨",
    "selling_price": 880,
    "cost_price": 440,
    "stock_quantity": 5,
    "plu_dirty": true,
    "plu_exported_at": "2026-03-15T15:00:00"
  }
]
```

---

### 17.7 非目的

CMD-07/CMD-08が**やらないこと**を明示する。

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| ファイル解析（CP932デコード等） | IO層の責務 | IO-02 z004_parser |
| file_hash算出 | IO層の責務 | IO-02 z004_parser |
| マスタ照合 | BIZ層の責務 | BIZ-03 csv_import_service |
| 在庫変動処理 | BIZ層の責務 | BIZ-02 inventory_service（BIZ-03経由） |
| PLU上限チェック | BIZ層の責務 | BIZ-04 plu_export_service |
| plu_dirty更新 | BIZ層の責務。CMDはconfirm時にproduct_codesを中継するだけ | BIZ-04 plu_export_service |
| ファイルパス検証 | フロントエンドの責務 | UI-07, UI-08 |
| ファイル保存 | フロントエンドの責務 | UI-08 |

---

### 17.8 対応不変条件

| 不変条件 | 本モジュールでの対応 |
|---------|-----------------|
| INV-6: file_hash自然冪等性 | BIZ層に委譲。CMD層はparse_and_validate/commitをそのまま中継するのみ |
| INV-1: quantity符号変換 | BIZ層に委譲。CMD層は符号変換に関与しない |
| INV-8: products物理DELETE禁止 | CMD層はproductsのDELETE操作を持たない |

---

### 17.9 main.rs へのコマンド登録

```
// main.rs の invoke_handler に追加
.invoke_handler(tauri::generate_handler![
    // CMD-01（既存）
    cmd::product_cmd::create_product,
    cmd::product_cmd::update_product,
    cmd::product_cmd::toggle_discontinue,
    cmd::product_cmd::search_products,
    cmd::product_cmd::get_product,
    // CMD-07（新規）
    cmd::csv_import_cmd::parse_and_validate_csv,
    cmd::csv_import_cmd::commit_csv_import,
    cmd::csv_import_cmd::rollback_csv_import,
    cmd::csv_import_cmd::list_csv_imports,
    cmd::csv_import_cmd::get_csv_import_record,
    // CMD-08（新規）
    cmd::plu_export_cmd::prepare_plu_export,
    cmd::plu_export_cmd::confirm_plu_export_saved,
    cmd::plu_export_cmd::list_plu_dirty,
])
```

現行実装（`lib.rs`）では command 登録は 2 箇所に分離している: `export_specta_bindings()` 内の `collect_commands![...]`（bindings 生成用）と `.invoke_handler(tauri::generate_handler![...])`（実行時 dispatch 用）。新規 command は**両方**へ登録する。collect_commands のみでは bindings diff が clean のまま IPC 実呼出しが「command not found」になる（CSV取込み詳細 Design Phase、Plan Review round 1 P2 起源）。

SPEC-SDI-D3 の実装commitでは `DuplicateStatus`、`DuplicateCheck`、`SameDateCsvImportSummary`、`commit_csv_import` 引数へ `#[specta::specta]` / `specta::Type` を維持し、`src/lib/bindings.ts` をgeneratorで再生成する。生成物の手編集は禁止し、wire名は Rust `additional_import_confirmed` / TypeScript `additionalImportConfirmed` とする。

### 更新履歴

| 日付 | PR | 内容 |
|---|---|---|
| 2026-08-16 | PR #79 | SPEC-SDI-D3/D4: same-date summary DTO、`additional_import_confirmed`、snapshot mismatch時のtoken破棄、bindings再生成義務を正本化。 |
