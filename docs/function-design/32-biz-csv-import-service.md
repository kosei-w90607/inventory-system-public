## 15. BIZ-03: Z004商品別CSV取込みパイプライン

> **2026-06-30 redesign note**: 本書は既存の Z004-only product-sales import pipeline の実装契約を記録する。current operation の日報主入力 `Z001`/`Z002`/`Z005` は [37-biz-daily-report-import-service.md](37-biz-daily-report-import-service.md) のBIZ-08で扱う。集計日報データは `daily_report_imports` / `daily_report_*_lines` に保存し、item-level `sale_records` / `inventory_movements` へ擬似展開しない。Z004はPLU登録後の商品別売上・在庫引落し候補として残す。

### 15.1 モジュール構成

```
src-tauri/src/
  biz/
    mod.rs                   -- pub mod csv_import_service を追加
    product_service.rs       -- 既存（BIZ-01）
    inventory_service/       -- 既存（BIZ-02、ディレクトリモジュール）
    csv_import_service.rs    -- CSV取込みの業務ロジック（本セクション）
```

単一ファイルで開始。肥大化したら inventory_service と同様にディレクトリ分割する。

---

### 15.2 型定義

#### CsvParseAndValidateRequest構造体

- file_bytes: Vec\<u8\>（Z004ファイルの生バイト列）
- filename: String（ファイル名。csv_imports.filename に記録する表示用）

#### ParseValidateResult構造体

- preview_data: PreviewData
- preview_token: String（UUID v4。CMD層がキャッシュキーとして使用）
- matched_rows: Vec\<MatchedRow\>（CMD層がキャッシュに保存する。フロントエンドには返さない）
- error_rows: Vec\<ErrorRow\>（同上）

#### PreviewData構造体

- file_info: FileInfo
- matched_summary: MatchedSummary
- error_summary: ErrorSummary
- duplicate_check: DuplicateCheck
- preview_created_at: String（YYYY-MM-DDTHH:MM:SS）

※ preview_token は ParseValidateResult のトップレベルにのみ保持する。PreviewData はフロントエンドに表示するデータのみを含む。フロントエンドは ParseValidateResult.preview_token を commit 時に送り返す。

#### FileInfo構造体

- filename: String
- settlement_date: String（YYYY-MM-DD）
- file_hash: String（SHA-256 hex、小文字64文字）

#### MatchedSummary構造体

- count: usize（紐付け成功件数）
- total_amount: i64（matched_rows の amount 合計）
- warnings: Vec\<String\>（グループコード商品の紐付け警告等）

#### ErrorSummary構造体

- count: usize（エラー行の総数）
- items: Vec\<ErrorRow\>（最大100件。超過時は件数のみ。UI表示の上限）

#### DuplicateCheck構造体

- status: DuplicateStatus
- existing_import_id: Option\<i64\>（OverwriteRequired時のみSome）

#### DuplicateStatus列挙型

```
enum DuplicateStatus {
    NoDuplicate,       // 問題なし
    OverwriteRequired, // 同settlement_date、別ファイル → 上書き確認
}
```

※ 同一file_hashの取込み済みケース（旧BlockedSameFile）はparse_and_validate内で即BizError::ImportErrorを返すため、enumには含めない。DuplicateStatusはPreviewDataに格納してフロントエンドに返す値のみ定義する。

#### MatchedRow構造体（サーバ側キャッシュに保持、フロントエンドには送らない）

- line_no: usize（Z004の行番号。1始まり）
- product_code: String（紐付いた商品コード）
- jan_code: String（正規化後のJAN）
- name: String（Z004上の商品名）
- quantity: i32（売上帳票視点の値。正=販売、負=返品）
- amount: i32
- pos_stock_sync: bool（紐付いた商品の pos_stock_sync フラグ）

#### ErrorRow構造体

- line_no: usize
- normalized_jan: Option\<String\>（JAN正規化前にエラーならNone）
- name: String
- raw_quantity: String
- raw_amount: String
- error_type: String（"unmatched_product" / "invalid_format" / "invalid_jan" / "invalid_number"）
- error_message: String（利用者向け日本語メッセージ）

#### CommitRequest構造体

- preview_token: String（parse_and_validate が返した token）
- overwrite_confirmed: bool（上書き確認済みフラグ）
- cached_data: CachedPreview（CMD層がキャッシュから復元したデータ。matched_rows, error_rows, preview_data を含む）

#### ImportResult構造体

- csv_import_id: i64
- status: String（"completed" / "completed_partial"）
- total_items: i64
- total_amount: i64
- skipped_count: i64

#### RollbackResult構造体

- success: bool
- voided_sale_count: u64
- voided_movement_count: usize
- stock_corrections: Vec\<StockCorrection\>

#### StockCorrection構造体

- product_code: String
- old_stock: i64
- new_stock: i64

#### CachedPreview構造体（サーバ側メモリキャッシュ）

- created_at: std::time::Instant（キャッシュ作成時刻。有効期限判定に使用）
- matched_rows: Vec\<MatchedRow\>
- error_rows: Vec\<ErrorRow\>
- preview_data: PreviewData（フロントエンドに返した内容のコピー）

---

### 15.3 parse_and_validate（Stage 1+2+3）

**関数要求**: Z004ファイルを解析し、マスタ照合後のプレビューデータを返す。業務テーブルへの書き込みなし（parse失敗時のoperation_log記録は例外）。preview_token を生成して返す（キャッシュ保存はCMD層の責務）

**シグネチャ**:
```
fn parse_and_validate(
    conn: &DbConnection,
    req: CsvParseAndValidateRequest,
) -> Result<ParseValidateResult, BizError>
```

**前提条件**: 業務テーブル（csv_imports, sale_records等）への書き込みなし。ただし**parse失敗時のoperation_log記録は例外**（system_repo::insert_operation_logを呼ぶ。ログ記録失敗は警告のみで処理続行）。conn は &DbConnection（operation_logの書き込みはautocommit）。キャッシュはBIZ層で保持しない（ロック区間最小化のためCMD層がAppStateで管理）

**処理ステップ**:

1. **サイズガード**
   - req.file_bytes.len() > constants::CSV_IMPORT_FILE_SIZE_LIMIT → BizError::ImportError("ファイルサイズが上限（20MB）を超えています")
2. **Stage 1: Parse**（IO-02 委譲）
   - io::z004_parser::parse_z004(&req.file_bytes) を呼び出し
   - Err(Z004ParseError) → system_repo::insert_operation_log(conn, &NewOperationLog { operation_type: "csv_import_parse_failed", summary: エラーメッセージ, detail_json: None }) → BizError::ImportError に変換
     - DecodeFailed → "Z004ファイルの解析に失敗しました: CP932デコードエラー"
     - NoDataLines → "Z004ファイルの解析に失敗しました: データ行がありません"
     - NoSettlementDate → "Z004ファイルの解析に失敗しました: 精算日を抽出できません"
   - Ok(parse_result) → parsed_rows が 0件かつ parse_errors が非空 → system_repo::insert_operation_log(conn, &NewOperationLog { operation_type: "csv_import_parse_failed", summary: "有効なデータがありません", detail_json: None }) → BizError::ImportError("有効なデータがありません")
3. **行数ガード**
   - parse_result.total_data_lines > constants::CSV_IMPORT_LINE_LIMIT → BizError::ImportError("データ行数が上限（10,000行）を超えています")
4. **Stage 2: Validate**
   a. 空レコード除外（エラーにもカウントしない）
      - quantity == 0 かつ amount == 0（PLU登録あるが当日販売なしのスロット）
      - ※ 全桁ゼロJAN（"0000000000000"）はIO-02 parse_data_lineで除外済み（Ok(None)返却）。BIZ-03では重複チェック不要
   b. 実データ行のマスタ照合: 各行について
      - product_repo::find_by_jan_code(conn, &normalized_jan) を呼び出し
      - ヒット1件 → MatchedRow { line_no, product_code, jan_code: normalized_jan, name, quantity, amount, pos_stock_sync: product.pos_stock_sync }
      - ヒット0件 → ErrorRow { line_no, normalized_jan: Some(normalized_jan), name, raw_quantity: quantity.to_string(), raw_amount: amount.to_string(), error_type: "unmatched_product", error_message: "JAN {jan} に該当する商品がありません" }
      - ヒット複数件 → ORDER BY product_code ASC で先頭を採用。warnings に "JAN {jan} は複数商品に紐付いています（{code} を使用）" を追加
   c. parse_result.parse_errors を ErrorRow にマージ
      - ParseErrorType → error_type 文字列変換: InvalidFormat → "invalid_format", InvalidJan → "invalid_jan", InvalidNumber → "invalid_number"
      - Option→String 変換規約: ParseError.raw_name/raw_quantity/raw_amount が None の場合、空文字列に変換する。None は error_type が invalid_format の場合にのみ発生する（フィールド分割前のエラーで値が取得できなかった）。Z004のフィールドは実運用で空文字にならないため、空文字はパース前エラーと判別可能。DB保存（csv_import_errors）は空文字のまま、UI表示時に error_type が invalid_format なら「(不明)」等に置換する
   d. 実質0件ガード
      - matched_rows.is_empty() && error_rows.is_empty() → BizError::ImportError("取込み対象のデータがありません")
5. **Stage 3: Preview**
   a. file_hash 重複チェック:
      - sales_repo::find_blocking_import_by_file_hash(conn, &parse_result.file_hash) → Some → BizError::ImportError("このファイルは取込み済みです（取込みID: {id}、取込み日: {imported_at}）")
   b. settlement_date 同日チェック:
      - sales_repo::find_imports_by_settlement_date(conn, &parse_result.settlement_date) → 非空 → DuplicateCheck { status: OverwriteRequired, existing_import_id: Some(imports[0].id) }
      - 空 → DuplicateCheck { status: NoDuplicate, existing_import_id: None }
   c. PreviewData 構築
      - matched_summary: count = matched_rows.len(), total_amount = matched_rows.iter().map(|r| r.amount as i64).sum(), warnings
      - error_summary: count = error_rows.len(), items = error_rows の先頭100件
6. **preview_token 生成**: UUID v4
7. ParseValidateResult { preview_data, preview_token, matched_rows, error_rows } を返す
   - CMD層がこの戻り値を受け取り、preview_tokenをキーとしてAppState.preview_cacheに保存する（17.5節参照）

**エラーハンドリング**:
- IO-02 parse失敗 → BizError::ImportError（operation_log記録後に変換）
- 全行パースエラー → BizError::ImportError("有効なデータがありません")
- 空レコード除外後0件 → BizError::ImportError("取込み対象のデータがありません")
- サイズ上限超過 → BizError::ImportError
- 行数上限超過（total_data_lines > constants::CSV_IMPORT_LINE_LIMIT）→ BizError::ImportError
- file_hash 重複ブロック → BizError::ImportError
- DB読み取り失敗（マスタ照合等）→ BizError::DatabaseError(DbError)

**入力例**:
```
req: CsvParseAndValidateRequest {
    file_bytes: [CP932バイト列...],
    filename: "Z004_260321",
}
```

**出力例**:
```
Ok(ParseValidateResult {
    preview_data: PreviewData {
        file_info: FileInfo {
            filename: "Z004_260321",
            settlement_date: "2026-03-21",
            file_hash: "a1b2c3d4e5f6...",
        },
        matched_summary: MatchedSummary {
            count: 45,
            total_amount: 28500,
            warnings: [],
        },
        error_summary: ErrorSummary {
            count: 3,
            items: [
                ErrorRow { line_no: 12, normalized_jan: Some("4973167064078"), name: "ﾎﾞﾀﾝ ﾊﾞﾗ", ..., error_type: "unmatched_product", error_message: "JAN 4973167064078 に該当する商品がありません" },
                ...
            ],
        },
        duplicate_check: DuplicateCheck { status: NoDuplicate, existing_import_id: None },
        preview_created_at: "2026-03-21T19:30:00",
    },
    preview_token: "550e8400-e29b-41d4-a716-446655440000",
})
```

---

### 15.4 commit_csv_import（Stage 4）

**関数要求**: プレビュー済みデータをDBに書き込む。CMD層から受け取ったキャッシュデータを使いTX内で一括実行する

**シグネチャ**:
```
fn commit_csv_import(
    conn: &mut DbConnection,
    req: CommitRequest,
) -> Result<ImportResult, BizError>
```

注: キャッシュ復元・有効期限チェック・トークン削除はCMD層の責務（41-cmd-pos.md 17.5節参照）。BIZ層はCMD層が復元済みのデータ（CommitRequest.cached_data）を受け取る。

**処理ステップ**:

1. **ローカル変数の導出**（req.cached_data から展開）
   - let cached = req.cached_data
   - let matched_rows = &cached.matched_rows
   - let error_rows = &cached.error_rows
   - let file_hash = &cached.preview_data.file_info.file_hash
   - let settlement_date = &cached.preview_data.file_info.settlement_date
   - let filename = &cached.preview_data.file_info.filename
   - let existing_import_id = cached.preview_data.duplicate_check.existing_import_id（上書き時に使用）
2. **上書き確認処理**（TX前の検証のみ）
   - cached.preview_data.duplicate_check.status == OverwriteRequired の場合:
     - req.overwrite_confirmed == false → BizError::ImportError("同日のデータが取込み済みです。上書きする場合は overwrite_confirmed を指定してください")
     - req.overwrite_confirmed == true → ステップ3a で旧データ無効化を同一TX内で実行
3. **TX開始**（conn.transaction()。RAII Drop で自動 ROLLBACK）
3a. **上書き時の旧データ無効化**（TX内。overwrite_confirmed == true の場合のみ）
   - void_sale_records_by_import(&tx, existing_import_id)
   - void_movements_by_reference(&tx, "csv_import", existing_import_id) → 在庫補正（rollback_csv_importと同一ロジック）
   - update_csv_import_status(&tx, existing_import_id, "rolled_back")
   - ※ 旧無効化と新規反映が同一TXのため、新規commit失敗時は旧データも含めて全体ROLLBACK
4. **file_hash 重複再チェック**（TX内、TOCTOU防止）
   - sales_repo::find_blocking_import_by_file_hash(&tx, file_hash) → Some → BizError::ImportError("このファイルは既に取込み済みです")
   - SQLite 単一接続前提のため競合発生は理論上ないが、プレビュー後にアプリが別操作で同ファイルを取り込んだ場合の安全策
5. **csv_imports 仮INSERT**
   - sales_repo::insert_csv_import(&tx, &NewCsvImport { filename, settlement_date, file_hash, total_items: 0, total_amount: 0, skipped_count: 0, status: "completed" }) → import_id
6. **matched_rows の各行を処理**（stock_warnings を蓄積）
   a. sales_repo::insert_sale_record(&tx, &NewSaleRecord { csv_import_id: Some(import_id), product_code: row.product_code, sale_date: settlement_date, quantity: row.quantity as i64, amount: row.amount as i64, source: "auto", source_line_no: Some(row.line_no as i64), reason: None, note: None })
   b. row.pos_stock_sync == true の場合:
      - inventory_quantity = -(row.quantity as i64)（INV-1: 売上帳票視点→在庫視点。常に符号反転）
      - inventory_service::apply_stock_change(&tx, &row.product_code, inventory_quantity, MovementType::SaleAuto, ReferenceType::CsvImport, import_id, None)
      - outcome.negative_stock_warning == true → stock_warnings に "商品 {product_code} の在庫がマイナスになりました（在庫: {stock_after}）" を追加
   c. row.pos_stock_sync == false → sale_records のみ作成。在庫は動かさない
7. **error_rows の記録**（error_rows が非空の場合）
   - ErrorRow → NewCsvImportError に変換
   - sales_repo::insert_csv_import_errors(&tx, &errors)
8. **集計値の確定**
   - total_items = matched_rows.len() as i64
   - total_amount = matched_rows.iter().map(|r| r.amount as i64).sum()
   - skipped_count = error_rows.len() as i64
   - status = if error_rows.is_empty() { "completed" } else { "completed_partial" }
   - sales_repo::update_csv_import_totals(&tx, import_id, total_items, total_amount, skipped_count, status)
9. **COMMIT**（tx.commit()）
10. **TX外: 操作ログ記録**
    - system_repo::insert_operation_log(conn, &NewOperationLog { operation_type: "csv_import", summary: "CSV取込み完了: {filename}（{total_items}件, ¥{total_amount}）", detail_json: Some(detail_json) })
    - detail_json: { "import_id": import_id, "filename": filename, "settlement_date": settlement_date, "total_items": total_items, "total_amount": total_amount, "skipped_count": skipped_count, "status": status }
    - 操作ログ記録失敗は警告のみ（業務処理のcommitは完了済み）
11. ImportResult { csv_import_id: import_id, status, total_items, total_amount, skipped_count } を返す
    - CMD層がOk受信後にpreview_cacheからtoken削除（41-cmd-pos.md 17.5節参照）

**TX境界**: ステップ3〜9が1TX。操作ログ記録（ステップ10）はTX外。

**TX失敗時**: TX ROLLBACK → csv_imports レコードなし。TX 外で system_repo::insert_operation_log(conn, &NewOperationLog { operation_type: "csv_import_failed", summary: "CSV取込みに失敗しました: {error}", detail_json: None }) を記録。CMD層はErr受信時にキャッシュを削除しない（利用者が再試行可能にするため）。

**符号変換ルール（INV-1準拠）**:
- row.quantity（売上帳票視点）: +3 = 3個販売、-1 = 1個返品
- inventory_quantity（在庫視点）: -3 = 在庫3個減、+1 = 在庫1個増
- 変換式: inventory_quantity = -row.quantity（常に符号反転）

**入力例**:
```
req: CommitRequest {
    preview_token: "550e8400-e29b-41d4-a716-446655440000",
    overwrite_confirmed: false,
    cached_data: CachedPreview { matched_rows: [...], error_rows: [...], preview_data: PreviewData { ... } },
}
```

**出力例**:
```
Ok(ImportResult {
    csv_import_id: 1,
    status: "completed_partial",
    total_items: 45,
    total_amount: 28500,
    skipped_count: 3,
})
```

---

### 15.5 rollback_csv_import

**関数要求**: 指定 csv_import を論理無効化し、在庫を補正する。冪等（既に rolled_back なら何もせず成功を返す）

**シグネチャ**:
```
fn rollback_csv_import(
    conn: &mut DbConnection,
    csv_import_id: i64,
) -> Result<RollbackResult, BizError>
```

**処理ステップ**:

1. **対象確認**
   - sales_repo::find_csv_import_by_id(conn, csv_import_id) を呼び出し
   - None → BizError::NotFound("CSV取込み記録が見つかりません: ID {csv_import_id}")
   - Some(import) で import.status == "rolled_back" → RollbackResult { success: true, voided_sale_count: 0, voided_movement_count: 0, stock_corrections: [] } を即リターン（冪等）
2. **TX開始**（conn.transaction()）
3. **sale_records の無効化**
   - sales_repo::void_sale_records_by_import(&tx, csv_import_id) → voided_sale_count
4. **inventory_movements の無効化と在庫補正データ取得**
   - sales_repo::void_movements_by_reference(&tx, "csv_import", csv_import_id) → voided_movements: Vec\<VoidedMovement\>
5. **在庫補正**（product_code でグループ化して集計）
   a. voided_movements を product_code でグループ化
   b. 各 product_code について: correction = voided_movements の quantity を合算し符号反転
      - 例: quantity = -3（販売で3個減）が void → correction = +3（3個戻す）
      - 例: quantity = +1（返品で1個増）が void → correction = -1（1個引く）
      - 計算式: correction = -SUM(voided.quantity)  ※同一product_codeの全movementを合算
   c. product_repo::find_by_product_code(&tx, &product_code) → product
   d. new_stock = product.stock_quantity + correction
   e. inventory_repo::update_stock_quantity(&tx, &product_code, new_stock)
   f. stock_corrections に StockCorrection { product_code, old_stock: product.stock_quantity, new_stock } を追加
6. **csv_imports の status 更新**
   - sales_repo::update_csv_import_status(&tx, csv_import_id, "rolled_back")
7. **COMMIT**（tx.commit()）
8. **TX外: 操作ログ記録**
   - system_repo::insert_operation_log(conn, &NewOperationLog { operation_type: "csv_rollback", summary: "CSV取込みを取消しました: ID {csv_import_id}", detail_json: Some(detail_json) })
   - detail_json: { "csv_import_id": csv_import_id, "voided_sale_count": voided_sale_count, "voided_movement_count": voided_movements.len(), "stock_corrections": [...] }
9. RollbackResult { success: true, voided_sale_count, voided_movement_count: voided_movements.len(), stock_corrections } を返す

**在庫補正の詳細**:
- movement.quantity = -3（販売で在庫3個減）→ void 後の在庫補正 = +3（3個戻す）
- movement.quantity = +1（返品で在庫1個増）→ void 後の在庫補正 = -1（1個引く）
- 同一 product_code に複数の voided_movement がある場合は合算してから1回の update_stock_quantity で更新する

**設計判断 — apply_stock_change を使わない理由**: ロールバックは「元の movement を取り消す」操作であり、新しい inventory_movements レコードを追加しない。apply_stock_change は movement を追加する関数のため、ここでは直接 update_stock_quantity を使う。void 対象の movement が取消の記録として残る（is_voided=1）。

**入力例**:
```
csv_import_id: 5
```

**出力例**:
```
Ok(RollbackResult {
    success: true,
    voided_sale_count: 45,
    voided_movement_count: 42,  // pos_stock_sync=0 の3件は movement がないため45-3=42
    stock_corrections: [
        StockCorrection { product_code: "4976383262108", old_stock: 14, new_stock: 17 },
        StockCorrection { product_code: "4976383262207", old_stock: 2, new_stock: 10 },
        StockCorrection { product_code: "4973167902615", old_stock: 6, new_stock: 5 },
    ],
})
```

---

### 15.6 list_csv_imports

**関数要求**: csv_imports 一覧を返す。CMD 経由のラッパー（repo 直呼び防止）

**シグネチャ**:
```
fn list_csv_imports(
    conn: &DbConnection,
    page: u32,
    per_page: u32,
) -> Result<PaginatedResult<CsvImport>, BizError>
```

**処理ステップ**:
1. page < 1 || per_page < 1 || per_page > 100 → BizError::ValidationFailed("ページパラメータが不正です")
2. sales_repo::list_csv_imports(conn, page, per_page) を呼び出し
3. DbError → BizError::DatabaseError に変換して返す

---

### 15.7 非目的

このモジュールが**やらないこと**を明示する。責務境界の誤解を防ぐため。

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| 物理DELETE | 全 void 処理は is_voided=1。hard delete 禁止 | — |
| IO-04 フォーマット処理（PLU TSV生成） | BIZ-04 の責務 | BIZ-04 |
| INV-5 idempotency_key パターン | BIZ-03 は file_hash 自然冪等性を使用（INV-6） | BIZ-02 の各 create 関数 |
| フロントエンド状態管理 | preview_data の表示制御、ボタン disabled 等 | UI-07 |
| Z004 ファイルの解析 | 純関数として IO-02 に分離済み | IO-02 z004_parser |
| file_hash の算出 | IO-02 が parse_z004 内で実行 | IO-02 z004_parser |
| CSV フィールドのパース | IO-02 の責務 | IO-02 z004_parser |

---

### 15.8 対応不変条件

| 不変条件 | 本モジュールでの対応 |
|---------|-----------------|
| INV-1: quantity 符号変換 | commit_csv_import のステップ7b で inventory_quantity = -row.quantity。売上帳票視点→在庫視点の符号反転を BIZ 層で実施 |
| INV-2: stock_after 算出 | apply_stock_change 経由（commit 時）。rollback 時は直接 update_stock_quantity |
| INV-3: 負在庫ポリシー | commit 時に apply_stock_change が negative_stock_warning を返す。警告をstock_warningsに蓄積するが処理は続行 |
| INV-4: is_voided 使用範囲 | rollback_csv_import で void_sale_records_by_import, void_movements_by_reference を呼び出し。is_voided=1 を設定するのはロールバック時のみ |
| INV-6: file_hash 自然冪等性 | parse_and_validate のステップ5a で find_blocking_import_by_file_hash。commit_csv_import のステップ5で TX 内再チェック（TOCTOU 防止） |
| INV-7: csv_import 参照の movements は sale_auto 限定 | commit_csv_import のステップ7b で MovementType::SaleAuto 固定。void_movements_by_reference は reference_type のみで絞り込み（movement_type 条件は冗長） |
| INV-8: products 物理 DELETE 禁止 | 本モジュールは products を UPDATE のみ（stock_quantity）。DELETE 操作なし |

---

### 15.9 preview キャッシュ管理

**所有責務**: CMD層（AppState.preview_cache: Mutex\<HashMap\<String, CachedPreview\>\>）が所有。BIZ層はキャッシュを直接操作しない（ロック区間最小化のため。41-cmd-pos.md 17.3節参照）。

**ライフサイクル**（CMD層が管理）:
- **作成**: CMD層が parse_and_validate の戻り値を受け取り cache.insert
- **消費**: CMD層が commit_csv_import の Ok 受信後に cache.remove
- **有効期限**: CMD層が commit 前に created_at.elapsed() > 30分 をチェック → 期限切れなら cache.remove してCmdError返却
- **アプリ再起動**: 全キャッシュ消失（永続化しない。Preview → Commit は1セッション内で完結する前提）

**設計判断**:
- HashMap の容量: 1人運用のため同時 preview 数は最大1件。HashMap 容量は問題にならない
- **上限**: エントリ数上限10件（constants::PREVIEW_CACHE_LIMIT）。insert 前に len >= 10 なら最も古いエントリ（created_at が最小）を1件削除してから insert する（FIFO）。削除されたトークンで commit が呼ばれた場合、CMD層が「プレビューが見つかりません」CmdError を返す
- 永続化しない理由: Preview データには matched_rows（商品在庫のスナップショットを含む）があり、時間が経つと実際の在庫と乖離する。再起動後は再度 parse_and_validate を実行するのが正しい
- 30分の根拠: 利用者がプレビュー確認→取り込み判断に十分な時間。長すぎると在庫の乖離リスクが高まる
- **commit失敗時**: CMD層はキャッシュを削除しない（利用者が再試行可能にするため）
- **ライフサイクル規約まとめ**: (1) ワンタイム: commit 成功時に即削除、同一トークンでの再 commit は不可 (2) 揮発: アプリ再起動で全消失、再起動後のトークンは必ず無効 (3) トークン不存在（削除済み/再起動後/追い出し）: CmdError kind="import_error" message="プレビューが見つかりません。再度ファイルを選択してください" (4) 期限切れ: CmdError kind="import_error" message="プレビューの有効期限が切れました（30分）。再度ファイルを選択してください" → UIは「ファイル選択」画面に戻す導線を表示
- **architecture/biz-task-specs.md との差異**: 関数設計でpreview_token方式に変更した。理由: Preview結果をフロントエンドに渡して再送信させると、データ量が大きく改ざんリスクもある。preview_token方式ではサーバ側キャッシュからmatched_rowsを復元するため安全。architecture/biz-task-specs.md と整合済み（本PR内で更新）

**キャッシュの所有権**: Tauri の State\<Mutex\<HashMap\<...\>\>\> で管理。CMD層がlock→操作→unlockを行い、BIZ層にはキャッシュを渡さない（ロック区間最小化）。

---

### 15.10 BizError 追加バリアント

BIZ-03 で新たに使用する BizError バリアントの確認:

```
enum BizError {
    ValidationFailed(String),   // 既存
    NotFound(String),           // 既存 — rollback 時の csv_import 不存在
    DuplicateProductCode(String), // 既存（本モジュールでは不使用）
    DatabaseError(DbError),     // 既存
    ImportError(String),        // 既存 — parse失敗、重複ブロック、上書き未確認等
    IdempotencyConflict(String), // 既存（本モジュールでは不使用。INV-6方式）
}
```

**ImportError の使い分け（BIZ層）**:
- ファイル形式の問題（parse 失敗、サイズ超過）→ ImportError
- 重複ブロック（file_hash 一致で取込み済み）→ ImportError
- 上書き未確認 → ImportError
- マスタ未登録（error_rows で表現）→ エラーではなくプレビューの一部として返す
- ※ キャッシュ問題（token不正、有効期限切れ、不存在）はCMD層の責務。BIZ層には到達しない

---

### 更新履歴

| 日付 | PR | 内容 |
|------|-----|------|
| 2026-04-11 | PR #14 | 初版作成（BIZ-03 CSV取込みパイプライン: parse_and_validate / commit_csv_import / rollback_csv_import / list_csv_imports） |
| 2026-04-11 | PR #14 | 設計書定義に対し実装欠落していた sales_repo::find_csv_import_by_id を併せて実装。rollback_csv_import のステップ1（対象確認）が当初は別アプローチで検討されたが、設計書に明記された find_csv_import_by_id を採用 |
| 2026-04-13 | PR #22 | preview キャッシュ管理の所有責務を明確化（BIZ層→CMD層）。ロック区間最小化のため CachedPreview を CMD層 AppState に保持し、commit時に BIZ層へ渡す |
