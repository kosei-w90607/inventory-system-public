## 14. IO-01 追加: POS取込みリポジトリ（BIZ-03 / BIZ-08 用）

### 14.1 モジュール配置

```
src-tauri/src/
  db/
    sales_repo.rs  -- sale_records, csv_imports, csv_import_errors
```

sales_repo.rs に追加する（ARCHITECTURE.md: sales_repository は sale_records, csv_imports, csv_import_errors, daily_report_imports, daily_report_*_lines を管理）。
セクション11（insert_sale_record）は BIZ-02 用として既存。本セクションで BIZ-03（CSV取込みパイプライン）用の関数を追加する。

**前提**: SQLite単一接続（1人運用デスクトップ）。マルチ接続化する場合は file_hash への UNIQUE 制約条件付き再導入またはアプリ層排他ロックが必須（INV-6 参照）。

---

### 14.2 型定義

**CsvImport構造体**:
- id: i64
- filename: String
- settlement_date: String（YYYY-MM-DD）
- file_hash: String（SHA-256 hex、小文字64文字）
- total_items: i64
- total_amount: i64
- skipped_count: i64
- status: String（"completed" / "completed_partial" / "rolled_back"）
- imported_at: String（YYYY-MM-DDTHH:MM:SS）

**NewCsvImport構造体**:
- filename: String
- settlement_date: String（YYYY-MM-DD）
- file_hash: String（SHA-256 hex）
- total_items: i64
- total_amount: i64
- skipped_count: i64
- status: String（"completed" / "completed_partial"）

**NewCsvImportError構造体**:
- csv_import_id: i64
- source_line_no: i64
- normalized_jan: Option\<String\>（JAN正規化前にエラーならNone）
- raw_name: String
- raw_quantity: String（数値変換前の生値。TEXTで保持する理由は DB_DESIGN.md 12a 参照）
- raw_amount: String（同上）
- error_type: String（"unmatched_product" / "invalid_format" / "invalid_jan" / "invalid_number"）
- error_message: String（利用者向け日本語メッセージ）

**VoidedMovement構造体**:
- product_code: String
- quantity: i64（元の quantity。BIZ-03 がこの値を逆方向に変換して在庫補正に使用）

**DailyReportImport構造体**:
- id: i64
- report_date: String（YYYY-MM-DD）
- source_adapter: String（"casio_sr_s4000"）
- bundle_hash: String
- source_files_json: String
- gross_amount: Option\<i64\>
- net_amount: Option\<i64\>
- status: String（"completed" / "rolled_back"）
- imported_at: String
- rolled_back_at: Option\<String\>
- note: Option\<String\>

**NewDailyReportImport構造体**:
- report_date: String
- source_adapter: String
- bundle_hash: String
- source_files_json: String
- gross_amount: Option\<i64\>
- net_amount: Option\<i64\>
- status: String（"completed"）
- note: Option\<String\>

**NewDailyReportSummaryLine / NewDailyReportPaymentLine / NewDailyReportDepartmentLine構造体**:
- DB_DESIGN.md 12c〜12e のカラムに対応するinsert用構造体。`daily_report_import_id` は親INSERT後にBIZ-08が設定する。

---

### 14.3 csv_imports.status 状態遷移表

**状態遷移**:

| 現在の状態 | 遷移先 | トリガー |
|-----------|--------|---------|
| （新規INSERT） | completed | commit 成功、error_rows = 0 |
| （新規INSERT） | completed_partial | commit 成功、error_rows > 0 |
| completed | rolled_back | rollback_csv_import |
| completed_partial | rolled_back | rollback_csv_import |
| rolled_back | （状態変更なし） | rollback は冪等 |

processing 相当の中間状態は存在しない。TX 内で INSERT → totals 確定まで一括実行するため、外部から観測できる中間状態が不要。

**再取込み可否表**:

| status | 同一 file_hash の再取込み | 理由 |
|--------|------------------------|------|
| completed | ブロック | 二重取込み防止 |
| completed_partial | ブロック | 部分成功も取込み済みとみなす |
| rolled_back | 許可 | 取消済みなので再取込み可能 |

---

### 14.4 insert_csv_import

**関数要求**: csv_imports に1行INSERTし、挿入されたIDを返す

**シグネチャ**:
```
fn insert_csv_import(conn: &DbConnection, record: &NewCsvImport) -> Result<i64, DbError>
```

**処理ステップ**:
1. INSERT INTO csv_imports (filename, settlement_date, file_hash, total_items, total_amount, skipped_count, status, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, 現在日時)
2. last_insert_rowid() を返す

**エラーハンドリング**:
- SQL実行失敗 → DbError::QueryFailed(詳細)

**入出力例**:
```
入力: NewCsvImport {
  filename: "Z004_260321",
  settlement_date: "2026-03-21",
  file_hash: "a1b2c3d4...（64文字hex）",
  total_items: 45,
  total_amount: 28500,
  skipped_count: 3,
  status: "completed_partial",
}

出力: Ok(1)  // 挿入されたID
```

**注意**: file_hash の重複チェックは本関数の責務外。BIZ-03 が find_blocking_import_by_file_hash で事前チェックした上で呼び出す。

---

### 14.5 find_csv_import_by_id

**関数要求**: csv_imports からIDで1件取得する。ロールバック処理の対象確認に使用

**シグネチャ**:
```
fn find_csv_import_by_id(conn: &DbConnection, id: i64) -> Result<Option<CsvImport>, DbError>
```

**処理ステップ**:
1. SQL実行: `SELECT * FROM csv_imports WHERE id = ?`
2. 結果が0行 → Ok(None)
3. 結果が1行 → CsvImport にマッピングして Ok(Some(...))

**エラーハンドリング**:
- SQL実行失敗 → DbError::QueryFailed(詳細)

**入出力例**:
```
入力: id = 1

出力（存在する場合）: Ok(Some(CsvImport {
  id: 1,
  filename: "Z004_260321",
  settlement_date: "2026-03-21",
  file_hash: "a1b2c3d4...（64文字hex）",
  total_items: 45,
  total_amount: 28500,
  skipped_count: 3,
  status: "completed_partial",
  imported_at: "2026-03-21T18:30:00",
}))

出力（存在しない場合）: Ok(None)
```

---

### 14.6 find_blocking_import_by_file_hash

**関数要求**: file_hash で有効な（非 rolled_back）csv_imports を検索する。重複取込みブロック判定専用

**シグネチャ**:
```
fn find_blocking_import_by_file_hash(conn: &DbConnection, file_hash: &str) -> Result<Option<CsvImport>, DbError>
```

**処理ステップ**:
1. SQL実行: `SELECT * FROM csv_imports WHERE file_hash = ? AND status IN ('completed','completed_partial') ORDER BY id DESC LIMIT 1`
2. 結果が0行 → Ok(None)
3. 結果が1行 → CsvImport にマッピングして Ok(Some(...))

**エラーハンドリング**:
- SQL実行失敗 → DbError::QueryFailed(詳細)

**入出力例**:
```
入力: file_hash = "a1b2c3d4...（64文字hex）"

ケース1（ブロック対象あり）:
出力: Ok(Some(CsvImport {
  id: 5,
  filename: "Z004_260321",
  settlement_date: "2026-03-21",
  file_hash: "a1b2c3d4...",
  status: "completed",
  ...
}))

ケース2（ブロック対象なし — 未取込みまたは rolled_back のみ）:
出力: Ok(None)
```

**設計判断**: 1件取得（ORDER BY id DESC）で十分な理由 — file_hash に UNIQUE 制約はないが、status IN ('completed','completed_partial') が同一 hash に対して複数存在することは通常ありえない（commit は check-then-insert で排他される）。仮に不整合で複数あっても、1件でもあればブロックする判定には影響しない。

---

### 14.7 find_imports_by_settlement_date

**関数要求**: settlement_date で有効な csv_imports を検索する。同日の上書き確認用

**シグネチャ**:
```
fn find_imports_by_settlement_date(conn: &DbConnection, date: &str) -> Result<Vec<CsvImport>, DbError>
```

**処理ステップ**:
1. SQL実行: `SELECT * FROM csv_imports WHERE settlement_date = ? AND status IN ('completed','completed_partial') ORDER BY id DESC`
2. 結果を Vec\<CsvImport\> で返す（0件なら空 Vec）

**エラーハンドリング**:
- SQL実行失敗 → DbError::QueryFailed(詳細)

---

### 14.8 update_csv_import_status

**関数要求**: csv_imports の status を更新する。ロールバック時に rolled_back に変更する用途

**シグネチャ**:
```
fn update_csv_import_status(conn: &DbConnection, id: i64, status: &str) -> Result<bool, DbError>
```

**処理ステップ**:
1. UPDATE csv_imports SET status = ? WHERE id = ?
2. affected_rows == 1 → Ok(true)
3. affected_rows == 0 → Ok(false)（該当レコードなし）

**エラーハンドリング**:
- CHECK 制約違反（不正な status 値）→ DbError::QueryFailed(詳細)
- SQL実行失敗 → DbError::QueryFailed(詳細)

---

### 14.9 update_csv_import_totals

**関数要求**: csv_imports の total_items / total_amount / skipped_count / status を確定する。Stage 4（Commit）の最終ステップで使用

**シグネチャ**:
```
fn update_csv_import_totals(conn: &DbConnection, id: i64, total_items: i64, total_amount: i64, skipped_count: i64, status: &str) -> Result<bool, DbError>
```

**処理ステップ**:
1. UPDATE csv_imports SET total_items = ?, total_amount = ?, skipped_count = ?, status = ? WHERE id = ?
2. affected_rows == 1 → Ok(true)
3. affected_rows == 0 → Ok(false)

**エラーハンドリング**:
- CHECK 制約違反（不正な status 値）→ DbError::QueryFailed(詳細)
- SQL実行失敗 → DbError::QueryFailed(詳細)

**注意**: insert_csv_import で仮の total_items=0 / total_amount=0 / skipped_count=0 で INSERT し、全行処理後に本関数で確定値を書き込むパターンを想定。BIZ-03 の TX 内で呼ばれる。

---

### 14.10 insert_csv_import_errors（batch）

**関数要求**: csv_import_errors に複数行を一括 INSERT する

**シグネチャ**:
```
fn insert_csv_import_errors(conn: &DbConnection, errors: &[NewCsvImportError]) -> Result<(), DbError>
```

**処理ステップ**:
1. errors が空なら即座に Ok(()) を返す
2. prepared statement を1回作成:
   `INSERT INTO csv_import_errors (csv_import_id, source_line_no, normalized_jan, raw_name, raw_quantity, raw_amount, error_type, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 現在日時)`
3. errors の各要素に対して prepared statement を実行

**エラーハンドリング**:
- FK 違反（csv_import_id 不正）→ DbError::ForeignKeyViolation(詳細)
- CHECK 制約違反（error_type 不正）→ DbError::QueryFailed(詳細)
- SQL実行失敗 → DbError::QueryFailed(詳細)

---

### 14.11 void_sale_records_by_import

**関数要求**: 指定 csv_import_id の sale_records を is_voided=1 に更新する。ロールバック用

**シグネチャ**:
```
fn void_sale_records_by_import(conn: &DbConnection, csv_import_id: i64) -> Result<u64, DbError>
```

**処理ステップ**:
1. SQL実行: `UPDATE sale_records SET is_voided = 1 WHERE csv_import_id = ? AND is_voided = 0`
2. affected_rows を返す

**エラーハンドリング**:
- SQL実行失敗 → DbError::QueryFailed(詳細)

**注意**: 既に is_voided=1 のレコードは更新しない（冪等）。affected_rows=0 はエラーではない（既に void 済み、または該当レコードなし）。

---

### 14.12 void_movements_by_reference

**関数要求**: 指定 reference_type / reference_id の inventory_movements を is_voided=1 に更新し、void 対象の product_code と quantity を返す。BIZ-03 がこの戻り値を使って在庫補正を行う

**シグネチャ**:
```
fn void_movements_by_reference(conn: &DbConnection, ref_type: &str, ref_id: i64) -> Result<Vec<VoidedMovement>, DbError>
```

**処理ステップ**:
1. SELECT で void 対象を事前取得:
   `SELECT product_code, quantity FROM inventory_movements WHERE reference_type = ? AND reference_id = ? AND is_voided = 0`
2. 結果を Vec\<VoidedMovement\> に変換
3. UPDATE で一括 void:
   `UPDATE inventory_movements SET is_voided = 1 WHERE reference_type = ? AND reference_id = ? AND is_voided = 0`
4. Vec\<VoidedMovement\> を返す

**エラーハンドリング**:
- SQL実行失敗 → DbError::QueryFailed(詳細)

**入出力例**:
```
入力: ref_type = "csv_import", ref_id = 5

出力: Ok(vec![
  VoidedMovement { product_code: "4976383262108", quantity: -3 },
  VoidedMovement { product_code: "4976383262207", quantity: -8 },
  VoidedMovement { product_code: "4973167902615", quantity: 1 },
])
```

BIZ-03 での在庫補正:
- quantity = -3 の movement が void → 在庫を +3 補正（逆方向）
- quantity = 1（返品で在庫が戻った movement）が void → 在庫を -1 補正
- 補正計算: `products.stock_quantity -= voided.quantity`（元の quantity を引く = 逆方向補正）

**設計判断**:
- movement_type 条件を付与しない理由: INV-7 により reference_type='csv_import' の movements は sale_auto 限定であることが保証されている。冗長な条件は可読性を下げるだけ
- SELECT → UPDATE の2段階にする理由: BIZ-03 が在庫補正に product_code と quantity を必要とするため。UPDATE の RETURNING 句は SQLite 3.35+ で利用可能だが、rusqlite のサポート状況を考慮して SELECT + UPDATE の安全なパターンを採用

---

### 14.13 list_csv_imports

**関数要求**: csv_imports 一覧をページング取得する。CSV取込み履歴画面用

**シグネチャ**:
```
fn list_csv_imports(conn: &DbConnection, page: u32, per_page: u32) -> Result<PaginatedResult<CsvImport>, DbError>
```

**入力ガード**（安全弁。通常はBIZ層で先にバリデーション済み）:
- page < 1 → DbError::QueryFailed("page must be >= 1")
- per_page < 1 → DbError::QueryFailed("per_page must be >= 1")
- per_page > 100 → DbError::QueryFailed("per_page must be <= 100")（極端値入力の防御）

**処理ステップ**:
1. 入力ガードチェック
2. COUNT(*) で total_count を取得
3. ORDER BY imported_at DESC, id DESC
4. LIMIT per_page OFFSET (page - 1) * per_page で取得
5. PaginatedResult { items, total_count, page, per_page } を返す

**エラーハンドリング**:
- SQL実行失敗 → DbError::QueryFailed(詳細)

---

### 14.14 insert_daily_report_import

**関数要求**: `daily_report_imports` に1行INSERTし、IDを返す。

**シグネチャ**:
```
fn insert_daily_report_import(conn: &DbConnection, record: &NewDailyReportImport) -> Result<i64, DbError>
```

**処理ステップ**:
1. INSERT INTO daily_report_imports (...)
2. last_insert_rowid() を返す

**注意**: bundle_hash / report_date の重複判定はBIZ-08の責務。本関数はSQL insertだけを行う。

---

### 14.15 insert_daily_report_lines

**関数要求**: 日報取込み配下のsummary/payment/department linesを一括INSERTする。

**シグネチャ**:
```
fn insert_daily_report_summary_lines(conn: &DbConnection, rows: &[NewDailyReportSummaryLine]) -> Result<(), DbError>
fn insert_daily_report_payment_lines(conn: &DbConnection, rows: &[NewDailyReportPaymentLine]) -> Result<(), DbError>
fn insert_daily_report_department_lines(conn: &DbConnection, rows: &[NewDailyReportDepartmentLine]) -> Result<(), DbError>
```

**処理ステップ**:
1. rows が空なら Ok(())。
2. prepared statement を作成する。
3. rows の各要素をINSERTする。

**エラーハンドリング**:
- FK違反（daily_report_import_id / department_id不正）→ DbError::ForeignKeyViolation
- CHECK制約違反（source_file不正等）→ DbError::QueryFailed
- SQL実行失敗 → DbError::QueryFailed

---

### 14.16 find_daily_report_import_by_id

**関数要求**: `daily_report_imports` からIDで1件取得する。rollback対象確認に使用する。

**シグネチャ**:
```
fn find_daily_report_import_by_id(conn: &DbConnection, id: i64) -> Result<Option<DailyReportImport>, DbError>
```

---

### 14.17 find_blocking_daily_report_by_bundle_hash

**関数要求**: 同一bundleのcompleted日報取込みを検索する。二重取込みブロック判定専用。

**シグネチャ**:
```
fn find_blocking_daily_report_by_bundle_hash(conn: &DbConnection, bundle_hash: &str) -> Result<Option<DailyReportImport>, DbError>
```

**SQL方針**:
`SELECT * FROM daily_report_imports WHERE bundle_hash = ? AND status = 'completed' ORDER BY id DESC LIMIT 1`

---

### 14.18 find_daily_report_imports_by_report_date

**関数要求**: 同一report_dateのcompleted日報取込みを検索する。上書き確認に使用する。

**シグネチャ**:
```
fn find_daily_report_imports_by_report_date(conn: &DbConnection, report_date: &str) -> Result<Vec<DailyReportImport>, DbError>
```

**SQL方針**:
`SELECT * FROM daily_report_imports WHERE report_date = ? AND status = 'completed' ORDER BY id DESC`

---

### 14.19 rollback_daily_report_import

**関数要求**: `daily_report_imports` を `rolled_back` に更新する。

**シグネチャ**:
```
fn rollback_daily_report_import(conn: &DbConnection, id: i64, rolled_back_at: &str) -> Result<bool, DbError>
```

**処理ステップ**:
1. `UPDATE daily_report_imports SET status='rolled_back', rolled_back_at=? WHERE id=? AND status='completed'`
2. affected_rows == 1 なら true、0なら false。

**注意**: summary/payment/department lines は物理削除しない。親statusで有効/無効を判断する。

---

### 14.20 list_daily_report_imports

**関数要求**: 日報取込み履歴をページング取得する。

**シグネチャ**:
```
fn list_daily_report_imports(
    conn: &DbConnection,
    page: u32,
    per_page: u32,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<PaginatedResult<DailyReportImport>, DbError>
```

**処理ステップ**:
1. page / per_page の入力ガードを行う。
2. date_from/date_toがある場合は report_date 範囲条件を付与する。
3. ORDER BY report_date DESC, imported_at DESC, id DESC で取得する。

---

### 14.21 get_latest_completed_daily_report

**関数要求**: 指定日の最新completed日報取込みと配下の支払/部門別行を取得し、BIZ-05の日次レポート用構造へ渡す。

**シグネチャ**:
```
fn get_latest_completed_daily_report(conn: &DbConnection, report_date: &str) -> Result<Option<OfficialDailyReportSummary>, DbError>
```

**処理ステップ**:
1. `daily_report_imports` から `report_date=? AND status='completed'` の最新1件を取得する。
2. 親がなければ Ok(None) を返す。
3. `daily_report_payment_lines` と `daily_report_department_lines` を `sort_order ASC, id ASC` で取得する。
4. `OfficialDailyReportSummary` にマッピングして返す。

---

### 14.22 get_monthly_official_department_totals

**関数要求**: 指定日付範囲のcompleted日報取込みから、Z005由来の公式部門集計を月次集計する。

**シグネチャ**:
```
fn get_monthly_official_department_totals(
    conn: &DbConnection,
    date_from: &str,
    date_to: &str,
) -> Result<Option<Vec<OfficialMonthlyDepartmentTotal>>, DbError>
```

**処理ステップ**:
1. `daily_report_imports.status='completed'` かつ `report_date BETWEEN ? AND ?` の親を対象にする。
2. `daily_report_department_lines` を department_id / label 単位で集計する。
3. 対象日報が0件なら Ok(None)。
4. 対象日報がある場合は Ok(Some(rows))。行が0件なら空Vecを返す。

---

### 14.23 非目的

本リポジトリが**行わない**ことを明記する:

- **物理 DELETE**: 全ての無効化処理は is_voided=1 フラグ方式で統一する。csv_imports / sale_records / inventory_movements のいずれも物理削除しない
- **ビジネスロジック**: バリデーション（file_hash 重複判定のブロック/許可分岐）、符号変換（売上帳票視点↔在庫視点）、在庫補正の実行は BIZ-03 の責務
- **file_hash の算出**: SHA-256 ハッシュの計算は IO-02（Z004パーサー）の責務。本リポジトリは算出済みの hex 文字列を受け取るだけ
- **bundle_hash の算出**: Z001/Z002/Z005 bundle_hash の計算は BIZ-08 の責務。本リポジトリは算出済みhex文字列を受け取るだけ
- **トランザクション制御**: BEGIN / COMMIT / ROLLBACK は BIZ-03 / BIZ-08 が制御する。本リポジトリの各関数は渡された conn 上で SQL を実行するのみ

---

### 14.24 対応不変条件

- **INV-4**: is_voided の使用範囲 — CSV 取込みロールバック時（BIZ-03）のみ使用。void_sale_records_by_import と void_movements_by_reference がこれに該当
- **INV-6**: file_hash 自然冪等性 — find_blocking_import_by_file_hash が `status IN ('completed','completed_partial')` で判定。UNIQUE 制約なし（ロールバック後の再取込みで同一 hash が2行になるため）。単一接続前提で check-then-insert の競合なし
- **INV-7**: csv_import 参照の movements は sale_auto 限定 — void_movements_by_reference が movement_type 条件なしで安全に void できる根拠
- **D-025**: 日報取込みは sale_records / inventory_movements へ擬似展開しない — daily_report_imports のrollbackは親status更新のみで完結する
