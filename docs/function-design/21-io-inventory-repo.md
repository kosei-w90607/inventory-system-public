## 10. IO-01 追加: 在庫変動リポジトリ（BIZ-02 用）

### 10.1 inventory_repo — 共通型

**ListQuery構造体**（入庫/返品/廃棄の一覧取得で共通）:
- page: u32（1始まり）
- per_page: u32（デフォルト50、上限100。100超はBIZ層でバリデーションエラー）
- date_from: Option<String>（YYYY-MM-DD）
- date_to: Option<String>（YYYY-MM-DD）

### 10.2 inventory_repo — 入庫リポジトリ

#### insert_receiving_record

**関数要求**: receiving_records に1行INSERTし、挿入されたIDを返す

**シグネチャ**:
```
fn insert_receiving_record(conn: &DbConnection, record: &NewReceivingRecord) -> Result<i64, DbError>
```

**NewReceivingRecord構造体**:
- supplier_id: Option<i64>
- receiving_date: String（YYYY-MM-DD）
- note: Option<String>
- idempotency_key: String
- request_fingerprint: String

**処理ステップ**:
1. INSERT INTO receiving_records (supplier_id, receiving_date, note, idempotency_key, request_fingerprint, created_at) VALUES (?, ?, ?, ?, ?, 現在日時)
2. last_insert_rowid() を返す

**エラーハンドリング**:
- supplier_id指定時のFK違反 → DbError::ForeignKeyViolation
- idempotency_key重複 → DbError::DuplicateKey（BIZ層でIdempotencyConflict判定に使用）
- その他SQL実行失敗 → DbError::QueryFailed

#### insert_receiving_item

**シグネチャ**:
```
fn insert_receiving_item(conn: &DbConnection, item: &NewReceivingItem) -> Result<(), DbError>
```

**NewReceivingItem構造体**:
- receiving_record_id: i64
- product_code: String
- quantity: i64
- cost_price: i64

#### list_receiving_records

**関数要求**: 入庫記録一覧をページング取得。取引先名をJOINで取得

**シグネチャ**:
```
fn list_receiving_records(conn: &DbConnection, query: &ListQuery) -> Result<PaginatedResult<ReceivingRecordWithSupplier>, DbError>
```

**ReceivingRecordWithSupplier構造体**:
- id: i64, supplier_id: Option<i64>, supplier_name: Option<String>, receiving_date: String, note: Option<String>, created_at: String

**処理ステップ**:
1. WHERE句構築: date_from/date_to → receiving_date >= ? / receiving_date <= ?
2. COUNT(*) でtotal_count取得
3. ORDER BY receiving_date DESC, id DESC
4. LIMIT per_page OFFSET (page - 1) * per_page

#### get_receiving_record_detail

**関数要求**: 入庫記録詳細として、ヘッダ、明細、原価合計、関連 `inventory_movements` を取得する。

**シグネチャ**:
```
fn get_receiving_record_detail(conn: &DbConnection, record_id: i64) -> Result<ReceivingRecordDetail, DbError>
```

**ReceivingRecordDetail構造体**:
- id: i64, receiving_date: String, supplier_id: Option<i64>, supplier_name: Option<String>, note: Option<String>, status: String, created_at: String
- total_cost: i64
- items: Vec<ReceivingRecordDetailItem>
- movements: Vec<MovementRecord>

**ReceivingRecordDetailItem構造体**:
- id: i64, product_code: String, product_name: String, department_name: String, stock_unit: String
- quantity: i64, cost_price: i64, line_cost: i64

**処理ステップ**:
1. receiving_records のヘッダを record_id で取得する。存在しない場合は DbError::NotFound
2. receiving_items を products / departments と JOIN し、商品名・部門名・単位を付ける
3. 各明細の `quantity * cost_price` を line_cost とし、合計を total_cost にする
4. inventory_movements から `reference_type='receiving_record'` かつ `reference_id=record_id` かつ `is_voided=0` の行を取得する
5. movements は BIZ 層で source link を補完するため、IO 層では `source=None` のまま返す

### 10.3 inventory_repo — 返品リポジトリ

#### insert_return_record

**シグネチャ**:
```
fn insert_return_record(conn: &DbConnection, record: &NewReturnRecord) -> Result<i64, DbError>
```

**NewReturnRecord構造体**:
- return_type: String（"return" / "exchange"）
- return_date: String
- register_processed: bool
- receipt_image_path: Option<String>
- note: Option<String>
- idempotency_key: String
- request_fingerprint: String

#### insert_return_item

**シグネチャ**:
```
fn insert_return_item(conn: &DbConnection, item: &NewReturnItem) -> Result<(), DbError>
```

**NewReturnItem構造体**:
- return_record_id: i64
- product_code: String
- direction: String（"in" / "out"）
- quantity: i64

#### list_return_records

**シグネチャ**:
```
fn list_return_records(conn: &DbConnection, query: &ListQuery) -> Result<PaginatedResult<ReturnRecordSummary>, DbError>
```

**ReturnRecordSummary構造体**:
- id: i64, return_type: String, return_date: String, register_processed: bool, note: Option<String>, created_at: String

#### get_return_record_detail

**関数要求**: 返品・交換記録詳細として、ヘッダ、明細、レシート画像パス、関連 `inventory_movements` を取得する。`register_processed=true` の記録は作成時に在庫を動かしていないため、movements が 0 件でも正常とする。

**シグネチャ**:
```
fn get_return_record_detail(conn: &DbConnection, record_id: i64) -> Result<ReturnRecordDetail, DbError>
```

**ReturnRecordDetail構造体**:
- id: i64, return_type: String, return_date: String, register_processed: bool, receipt_image_path: Option<String>, note: Option<String>, status: String, created_at: String
- items: Vec<ReturnRecordDetailItem>
- movements: Vec<MovementRecord>

**ReturnRecordDetailItem構造体**:
- id: i64, product_code: String, product_name: String, department_name: String, stock_unit: String
- direction: String, quantity: i64

**処理ステップ**:
1. return_records のヘッダを record_id で取得する。存在しない場合は DbError::NotFound
2. return_items を products / departments と JOIN し、商品名・部門名・単位を付ける
3. inventory_movements から `reference_type='return_record'` かつ `reference_id=record_id` かつ `is_voided=0` の行を取得する
4. movements は BIZ 層で source link を補完するため、IO 層では `source=None` のまま返す

### 10.4 inventory_repo — 手動販売出庫リポジトリ

#### insert_manual_sale

**シグネチャ**:
```
fn insert_manual_sale(conn: &DbConnection, record: &NewManualSale) -> Result<i64, DbError>
```

**NewManualSale構造体**:
- sale_date: String
- reason: String（"plu_unregistered" / "other"）
- note: Option<String>
- idempotency_key: String
- request_fingerprint: String

#### insert_manual_sale_item

**シグネチャ**:
```
fn insert_manual_sale_item(conn: &DbConnection, item: &NewManualSaleItem) -> Result<(), DbError>
```

**NewManualSaleItem構造体**:
- manual_sale_id: i64
- product_code: String
- quantity: i64
- amount: i64

#### get_manual_sale_record_detail

**関数要求**: 手動販売記録詳細として、ヘッダ、明細、販売金額合計、関連 `inventory_movements` を取得する。`sale_records.id` ではなく `manual_sales.id` を業務記録IDとして扱う。

**シグネチャ**:
```
fn get_manual_sale_record_detail(conn: &DbConnection, record_id: i64) -> Result<ManualSaleRecordDetail, DbError>
```

**ManualSaleRecordDetail構造体**:
- id: i64, sale_date: String, reason: String, note: Option<String>, status: String, created_at: String
- total_amount: i64
- items: Vec<ManualSaleRecordDetailItem>
- movements: Vec<MovementRecord>

**ManualSaleRecordDetailItem構造体**:
- id: i64, product_code: String, product_name: String, department_name: String, stock_unit: String
- quantity: i64, amount: i64

**処理ステップ**:
1. manual_sales のヘッダを record_id で取得する。存在しない場合は DbError::NotFound
2. manual_sale_items を products / departments と JOIN し、商品名・部門名・単位を付ける
3. 各明細の amount を合計して total_amount にする
4. inventory_movements から `reference_type='manual_sale'` かつ `reference_id=record_id` かつ `is_voided=0` の行を取得する
5. movements は BIZ 層で source link を補完するため、IO 層では `source=None` のまま返す

### 10.5 inventory_repo — 廃棄リポジトリ

#### insert_disposal_record

**シグネチャ**:
```
fn insert_disposal_record(conn: &DbConnection, record: &NewDisposalRecord) -> Result<i64, DbError>
```

**NewDisposalRecord構造体**:
- disposal_date: String
- idempotency_key: String
- request_fingerprint: String

#### insert_disposal_item

**シグネチャ**:
```
fn insert_disposal_item(conn: &DbConnection, item: &NewDisposalItem) -> Result<(), DbError>
```

**NewDisposalItem構造体**:
- disposal_record_id: i64
- product_code: String
- disposal_type: String（"disposal" / "damage" / "other"）
- quantity: i64
- cost_price: i64
- reason: String

#### list_disposal_records

**シグネチャ**:
```
fn list_disposal_records(conn: &DbConnection, query: &ListQuery) -> Result<PaginatedResult<DisposalRecordSummary>, DbError>
```

**DisposalRecordSummary構造体**:
- id: i64, disposal_date: String, created_at: String

#### list_inventory_records

**関数要求**: `/inventory/records` 用に、入庫・返品/交換・手動販売・廃棄/破損記録を業務記録ヘッダ単位で検索・ページング取得する。明細 JOIN 条件に一致する場合でも返却行は各ヘッダ 1 件に集約する。

**シグネチャ**:
```
fn list_inventory_records(
    conn: &DbConnection,
    query: &InventoryRecordQuery,
) -> Result<PaginatedResult<InventoryRecordSummary>, DbError>
```

**InventoryRecordQuery構造体**:
- record_type: Option<String>（None / "all" / "receiving_record" / "return_record" / "manual_sale" / "disposal_record"）
- date_from: Option<String>（YYYY-MM-DD）
- date_to: Option<String>（YYYY-MM-DD）
- record_id: Option<i64>
- product_keyword: Option<String>（商品コード / JAN / 商品名）
- department_id: Option<i64>
- status: Option<String>（初期スライスは active 相当）
- page: u32
- per_page: u32

**InventoryRecordSummary構造体**:
- record_type: String
- record_id: i64
- business_date: String
- representative_item: String（明細がない場合は "明細なし"）
- item_count: i64
- status: String
- created_at: String
- detail_route: String

**処理ステップ**:
1. record_type / status が IO 層で未対応の場合は空ページを返す（BIZ 層の validation が通常の入口）
2. 対象 record_type ごとに同じ列構造の SELECT を作る
   - 入庫: `receiving_records` + `receiving_items`
   - 返品・交換: `return_records` + `return_items`
   - 手動販売: `manual_sales` + `manual_sale_items`
   - 廃棄・破損: `disposal_records` + `disposal_items`
3. WHERE句構築: 業務日付、record_id、department_id、product_keyword を条件化する
4. 商品条件は各明細テーブルの `EXISTS` + products JOIN で判定し、ヘッダ重複を避ける
5. `UNION ALL` 後に COUNT(*) で total_count 取得
6. ORDER BY business_date DESC, record_id DESC, record_type ASC
7. LIMIT per_page OFFSET (page - 1) * per_page

#### get_disposal_record_detail

**関数要求**: 廃棄・破損記録詳細として、ヘッダ、明細、ロス原価、関連 `inventory_movements` を取得する。

**シグネチャ**:
```
fn get_disposal_record_detail(
    conn: &DbConnection,
    record_id: i64,
) -> Result<DisposalRecordDetail, DbError>
```

**DisposalRecordDetail構造体**:
- id: i64
- disposal_date: String
- status: String
- created_at: String
- total_loss_cost: i64
- items: Vec<DisposalRecordDetailItem>
- movements: Vec<MovementRecord>

**DisposalRecordDetailItem構造体**:
- id: i64
- product_code: String
- product_name: String
- department_name: String
- stock_unit: String
- disposal_type: String
- quantity: i64
- cost_price: i64
- reason: String
- line_loss_cost: i64

**処理ステップ**:
1. disposal_records のヘッダを record_id で取得する。存在しない場合は DbError::NotFound
2. disposal_items を products / departments と JOIN し、商品名・部門名・単位を付ける
3. 各明細の `quantity * cost_price` を line_loss_cost とし、合計を total_loss_cost にする
4. inventory_movements から `reference_type='disposal_record'` かつ `reference_id=record_id` かつ `is_voided=0` の行を取得する
5. movements は BIZ 層で source link を補完するため、IO 層では `source=None` のまま返す

### 10.6 inventory_repo — movements集計（BIZ-07 整合性チェック用）

#### sum_movements_by_product

**関数要求**: 全商品の inventory_movements 合計値を一括取得する。BIZ-07 の整合性チェックで products.stock_quantity との突合に使用

**シグネチャ**:
```
fn sum_movements_by_product(conn: &DbConnection) -> Result<Vec<ProductMovementSum>, DbError>
```

**ProductMovementSum構造体**:
```
struct ProductMovementSum {
    product_code: String,
    movements_sum: i64,  // SUM(quantity) WHERE is_voided = 0
}
```

**処理ステップ**:
1. SQL実行: SELECT product_code, COALESCE(SUM(quantity), 0) as movements_sum FROM inventory_movements WHERE is_voided = 0 GROUP BY product_code ORDER BY product_code ASC
2. 結果を Vec<ProductMovementSum> にマッピング
3. inventory_movements に1行もない商品は結果に含まれない（BIZ-07 側で movements_sum=0 として扱う）

**設計判断**: COALESCE(SUM(...), 0) は GROUP BY がある場合は冗長だが、防御的に付与。product_code 単位の GROUP BY なので SUM が NULL になるケースはないが、将来の WHERE 条件追加時の安全性を確保。

**エラーハンドリング**:
- SQL実行失敗 → DbError::QueryFailed(詳細)

#### sum_movements_for_product

**関数要求**: 指定商品の inventory_movements 合計値を取得する。fix_integrity の個別商品補正で使用

**シグネチャ**:
```
fn sum_movements_for_product(conn: &DbConnection, product_code: &str) -> Result<i64, DbError>
```

**処理ステップ**:
1. SQL実行: SELECT COALESCE(SUM(quantity), 0) FROM inventory_movements WHERE product_code = ?1 AND is_voided = 0
2. inventory_movements に1行もない商品 → COALESCE で 0 を返す

**エラーハンドリング**:
- SQL実行失敗 → DbError::QueryFailed(詳細)

---

### 10.6a inventory_repo — 在庫数直接更新

#### update_stock_quantity

**関数要求**: products.stock_quantity を指定値で上書き更新する。BIZ-02の共通在庫変動関数から呼ばれる

**シグネチャ**:
```
fn update_stock_quantity(conn: &DbConnection, product_code: &str, new_quantity: i64) -> Result<bool, DbError>
```

**設計判断**: product_repo::update_product(ProductUpdates { stock_quantity }) を使わず、inventory_repo に専用関数を配置する。理由:（1）stock_quantity更新は在庫変動ドメインの責務、（2）1カラムだけの更新にProductUpdates構造体を組み立てるのはオーバーヘッド

**処理ステップ**:
1. UPDATE products SET stock_quantity = ?1, updated_at = ?2 WHERE product_code = ?3
2. affected_rows == 1 → Ok(true)
3. affected_rows == 0 → Ok(false)

### 10.7 inventory_repo — 冪等性チェック

#### find_by_idempotency_key

**関数要求**: idempotency_key で各ヘッダテーブルを検索する。冪等性チェック用

**シグネチャ（4テーブルそれぞれに1関数）**:
```
fn find_receiving_by_idempotency_key(conn: &DbConnection, key: &str) -> Result<Option<(i64, String)>, DbError>
fn find_return_by_idempotency_key(conn: &DbConnection, key: &str) -> Result<Option<(i64, String)>, DbError>
fn find_manual_sale_by_idempotency_key(conn: &DbConnection, key: &str) -> Result<Option<(i64, String)>, DbError>
fn find_disposal_by_idempotency_key(conn: &DbConnection, key: &str) -> Result<Option<(i64, String)>, DbError>
```

**戻り値**: Some((record_id, request_fingerprint)) または None

---

## 11. sales_repo — 売上レコード

### 11.1 insert_sale_record

**関数要求**: sale_records に1行INSERTし、挿入されたIDを返す。手動販売時に使用

**シグネチャ**:
```
fn insert_sale_record(conn: &DbConnection, record: &NewSaleRecord) -> Result<i64, DbError>
```

**NewSaleRecord構造体**:
- csv_import_id: Option<i64>（手動販売時はNone）
- product_code: String
- sale_date: String
- quantity: i64（売上帳票視点: 正=販売）
- amount: i64
- source: String（"auto" / "manual"）
- source_line_no: Option<i64>（手動販売時はNone）
- reason: Option<String>
- note: Option<String>

**処理ステップ**:
1. INSERT INTO sale_records (..., is_voided, created_at) VALUES (..., 0, 現在日時)
2. last_insert_rowid() を返す

**sale_records (source='manual') の一意性保証**:
- 前提: manual_sales ヘッダ→items→sale_records の INSERT は create_manual_sale の単一TX内で完了
- TX外からの直接INSERT（source='manual'）は設計違反とする
- ヘッダの idempotency_key UNIQUE が一意性の根拠
