## 23. CMD-02〜05: 入出庫コマンド群 / CMD-06: 在庫照会コマンド群

### 23.1 モジュール構成

```
src-tauri/src/
  cmd/
    mod.rs               -- pub mod receiving_cmd 等を追加
    receiving_cmd.rs     -- 入庫コマンド（CMD-02）
    return_cmd.rs        -- 返品・交換コマンド（CMD-03）
    manual_sale_cmd.rs   -- 手動販売出庫コマンド（CMD-04）
    disposal_cmd.rs      -- 廃棄・破損コマンド（CMD-05）
    inventory_cmd.rs     -- 在庫照会コマンド（CMD-06）
  biz/
    inventory_service/
      mod.rs             -- list系ラッパー3関数を追加
  db/
    product_repo.rs      -- get_stock_detail, list_low_stock_products を追加
    inventory_repo.rs    -- list_movements を追加
```

---

### 23.2 CMD層の原則（17.2節を継承）

17.2節（41-cmd-pos.md）の原則をそのまま適用:
- 薄いラッパー: state.db.lock() → BIZ呼出し → BizError→CmdError変換
- 業務バリデーション、ビジネスロジックは持たない

**CMD-02〜06はpreview_cacheを使用しない**。DB接続のみ。

**list操作のレイヤー呼び出し**: 既存パターン（csv_import_cmd → csv_import_service → sales_repo）に倣い、list操作もCMD→BIZ→IOの順で呼び出す。BIZ層にはページパラメータのバリデーション + repo直呼び防止ラッパーを置く。

---

### 23.3 BizError → CmdError 変換

新規BizError variantの追加は不要。既存の変換ルール（40-cmd-product.md §5.3 + 41-cmd-pos.md §17.4 + 42-cmd-sales-stocktake.md §22.3）で全コマンドのエラーをカバーできる。

CMD-02〜05で発生しうるBizError:

| BizError | CmdError.kind | 発生場面 |
|----------|--------------|---------|
| ValidationFailed(msg) | "validation" | 入力バリデーション（空items、不正日付等） |
| NotFound(msg) | "not_found" | 存在しない商品コード |
| IdempotencyConflict(msg) | "idempotency_conflict" | 同一冪等キーで異なるリクエスト |
| DatabaseError(_) | "internal" | IO層エラー |

CMD-06で発生しうるBizError:

| BizError | CmdError.kind | 発生場面 |
|----------|--------------|---------|
| NotFound(msg) | "not_found" | get_stock_detail: 存在しない商品コード |
| ValidationFailed(msg) | "validation" | list_low_stock/list_movements: 不正なパラメータ |
| DatabaseError(_) | "internal" | IO層エラー |

---

### 23.4 CMD-02: 入庫コマンド群

#### create_receiving

**関数要求**: 入庫記録を作成し、在庫を更新する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn create_receiving(
    state: State<AppState>,
    req: ReceivingCreateRequest,
) -> Result<ReceivingCreateResult, CmdError>
```

**入力型**: BIZ層の `ReceivingCreateRequest` をそのまま使用
```
struct ReceivingCreateRequest {
    idempotency_key: String,
    supplier_id: Option<i64>,
    receiving_date: String,       // YYYY-MM-DD
    note: Option<String>,
    items: Vec<ReceivingItemInput>,
}
struct ReceivingItemInput {
    product_code: String,
    quantity: i64,
    cost_price: i64,
}
```

**出力型**: BIZ層の `ReceivingCreateResult` をそのまま使用
```
struct ReceivingCreateResult {
    record_id: i64,
    created: bool,
    idempotent_replay: bool,
    stock_warnings: Vec<String>,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&mut conn`）
2. biz::inventory_service::create_receiving(&mut conn, req) を呼ぶ
3. Ok → ReceivingCreateResult をそのまま返す
4. Err(BizError) → CmdError に変換して返す

**入力例**:
```json
{
  "req": {
    "idempotency_key": "recv-20260321-001",
    "supplier_id": 1,
    "receiving_date": "2026-03-21",
    "note": "定期入荷",
    "items": [
      { "product_code": "4976383262108", "quantity": 12, "cost_price": 111 },
      { "product_code": "4976383262207", "quantity": 8, "cost_price": 111 }
    ]
  }
}
```

**出力例**:
```json
{
  "record_id": 5,
  "created": true,
  "idempotent_replay": false,
  "stock_warnings": []
}
```

---

#### list_receivings

**関数要求**: 入庫記録の一覧をページング取得する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn list_receivings(
    state: State<AppState>,
    page: u32,
    per_page: u32,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<PaginatedResult<ReceivingRecordWithSupplier>, CmdError>
```

**入力パラメータ**（個別引数方式。CMD層で `ListQuery` を組み立ててBIZ層に渡す）:
- `page: u32` — 1始まり
- `per_page: u32` — 上限100（BIZ層でバリデーション）
- `date_from: Option<String>` — YYYY-MM-DD
- `date_to: Option<String>` — YYYY-MM-DD

**出力型**: `PaginatedResult<ReceivingRecordWithSupplier>`
```
struct ReceivingRecordWithSupplier {
    id: i64,
    supplier_id: Option<i64>,
    supplier_name: Option<String>,
    receiving_date: String,
    note: Option<String>,
    created_at: String,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&conn`）
2. 個別パラメータから `ListQuery { page, per_page, date_from, date_to }` を組み立てる
3. biz::inventory_service::list_receivings(&conn, &query) を呼ぶ
4. Ok → PaginatedResult をそのまま返す
5. Err(BizError) → CmdError に変換して返す

**入力例**:
```json
{
  "page": 1,
  "per_page": 20,
  "date_from": "2026-03-01",
  "date_to": null
}
```

**出力例**:
```json
{
  "items": [
    {
      "id": 5,
      "supplier_id": 1,
      "supplier_name": "ハマナカ",
      "receiving_date": "2026-03-21",
      "note": "定期入荷",
      "created_at": "2026-03-21T10:30:00"
    }
  ],
  "total_count": 12,
  "page": 1,
  "per_page": 20
}
```

---

### 23.5 CMD-03: 返品・交換コマンド群

#### create_return

**関数要求**: 返品・交換記録を作成する。register_processedフラグに応じて在庫を更新する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn create_return(
    state: State<AppState>,
    req: ReturnCreateRequest,
) -> Result<ReturnCreateResult, CmdError>
```

**入力型**: BIZ層の `ReturnCreateRequest` をそのまま使用
```
struct ReturnCreateRequest {
    idempotency_key: String,
    return_type: String,          // "return" | "exchange"
    return_date: String,          // YYYY-MM-DD
    register_processed: bool,
    receipt_image_path: Option<String>,
    note: Option<String>,
    items: Vec<ReturnItemInput>,
}
struct ReturnItemInput {
    product_code: String,
    direction: String,            // "in" | "out"
    quantity: i64,
}
```

**出力型**: BIZ層の `ReturnCreateResult` をそのまま使用
```
struct ReturnCreateResult {
    record_id: i64,
    created: bool,
    idempotent_replay: bool,
    stock_warnings: Vec<String>,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&mut conn`）
2. biz::inventory_service::create_return(&mut conn, req) を呼ぶ
3. Ok → ReturnCreateResult をそのまま返す
4. Err(BizError) → CmdError に変換して返す

**入力不変条件**:
return_type / direction / exchange片側不足などの業務バリデーションは BIZ-02 が最終防御として実施する。CMD-03 は薄いラッパーとして request を中継し、BIZ validation error を `CmdError.kind="validation"` に変換する。

**入力例**:
```json
{
  "req": {
    "idempotency_key": "ret-20260321-001",
    "return_type": "exchange",
    "return_date": "2026-03-21",
    "register_processed": false,
    "receipt_image_path": null,
    "note": "色交換",
    "items": [
      { "product_code": "HZ-0012", "direction": "in", "quantity": 1 },
      { "product_code": "HZ-0013", "direction": "out", "quantity": 1 }
    ]
  }
}
```

**出力例**:
```json
{
  "record_id": 3,
  "created": true,
  "idempotent_replay": false,
  "stock_warnings": []
}
```

---

#### list_returns

**関数要求**: 返品記録の一覧をページング取得する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn list_returns(
    state: State<AppState>,
    page: u32,
    per_page: u32,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<PaginatedResult<ReturnRecordSummary>, CmdError>
```

**出力型**: `PaginatedResult<ReturnRecordSummary>`
```
struct ReturnRecordSummary {
    id: i64,
    return_type: String,
    return_date: String,
    register_processed: bool,
    note: Option<String>,
    created_at: String,
}
```

**処理ステップ**: list_receivings と同パターン（BIZ経由）

---

### 23.6 CMD-04: 手動販売出庫コマンド群

#### create_manual_sale

**関数要求**: 手動販売出庫を記録する。PLU登録済み警告を含む2段階確認フロー対応

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn create_manual_sale(
    state: State<AppState>,
    req: ManualSaleCreateRequest,
) -> Result<ManualSaleCreateResult, CmdError>
```

**入力型**: BIZ層の `ManualSaleCreateRequest` をそのまま使用
```
struct ManualSaleCreateRequest {
    idempotency_key: String,
    sale_date: String,            // YYYY-MM-DD
    reason: String,               // "plu_unregistered" | "other"
    note: Option<String>,
    items: Vec<ManualSaleItemInput>,
    confirmation_token: Option<String>,  // PLU警告確認後の再送時に使用
}
struct ManualSaleItemInput {
    product_code: String,
    quantity: i64,
    amount: i64,
}
```

**出力型**: BIZ層の `ManualSaleCreateResult` をそのまま使用
```
struct ManualSaleCreateResult {
    sale_id: Option<i64>,
    created: bool,
    idempotent_replay: bool,
    plu_warnings: Vec<String>,
    stock_warnings: Vec<String>,
    needs_confirmation: bool,
    confirmation_token: Option<String>,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&mut conn`）
2. biz::inventory_service::create_manual_sale(&mut conn, req) を呼ぶ
3. Ok → ManualSaleCreateResult をそのまま返す
4. Err(BizError) → CmdError に変換して返す

**2段階確認フロー**:
1回目: confirmation_token=None で送信 → needs_confirmation=true, plu_warnings 付きで返る
2回目: 1回目で返されたconfirmation_token を付けて再送信 → 実際の登録が実行される

---

### 23.7 CMD-05: 廃棄・破損コマンド群

#### create_disposal

**関数要求**: 廃棄・破損記録を作成し、在庫を減少させる

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn create_disposal(
    state: State<AppState>,
    req: DisposalCreateRequest,
) -> Result<DisposalCreateResult, CmdError>
```

**入力型**: BIZ層の `DisposalCreateRequest` をそのまま使用
```
struct DisposalCreateRequest {
    idempotency_key: String,
    disposal_date: String,        // YYYY-MM-DD
    items: Vec<DisposalItemInput>,
}
struct DisposalItemInput {
    product_code: String,
    disposal_type: String,        // "disposal" | "damage" | "other"
    quantity: i64,
    cost_price: i64,
    reason: String,
}
```

**出力型**: BIZ層の `DisposalCreateResult` をそのまま使用
```
struct DisposalCreateResult {
    record_id: i64,
    created: bool,
    idempotent_replay: bool,
    stock_warnings: Vec<String>,
}
```

**処理ステップ**: create_receiving と同パターン

---

#### list_disposals

**関数要求**: 廃棄記録の一覧をページング取得する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn list_disposals(
    state: State<AppState>,
    page: u32,
    per_page: u32,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<PaginatedResult<DisposalRecordSummary>, CmdError>
```

**出力型**: `PaginatedResult<DisposalRecordSummary>`
```
struct DisposalRecordSummary {
    id: i64,
    disposal_date: String,
    created_at: String,
}
```

**処理ステップ**: list_receivings と同パターン（BIZ経由）

---

#### list_inventory_records

**関数要求**: 入出庫履歴ハブ `/inventory/records` 用に、業務記録をヘッダ単位でページング取得する。入庫・返品/交換・手動販売・廃棄/破損を実データとして返し、完成形ではCSV取込み・棚卸しへ横展開する。

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn list_inventory_records(
    state: State<AppState>,
    query: InventoryRecordQuery,
) -> Result<PaginatedResult<InventoryRecordSummary>, CmdError>
```

**入力型**: BIZ層の `InventoryRecordQuery` をそのまま使用
```
struct InventoryRecordQuery {
    record_type: Option<String>,      // None | "all" | "receiving_record" | "return_record" | "manual_sale" | "disposal_record"
    date_from: Option<String>,        // YYYY-MM-DD
    date_to: Option<String>,          // YYYY-MM-DD
    record_id: Option<i64>,
    product_keyword: Option<String>,  // 商品コード / JAN / 商品名
    department_id: Option<i64>,
    status: Option<String>,           // 現行schemaでは None | "active"
    page: u32,
    per_page: u32,
}
```

**出力型**:
```
struct InventoryRecordSummary {
    record_type: String,
    record_id: i64,
    business_date: String,
    representative_item: String,       // 明細がない場合は "明細なし"
    item_count: i64,
    status: String,
    created_at: String,
    detail_route: String,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&conn`）
2. biz::inventory_service::list_inventory_records(&conn, &query) を呼ぶ
3. Ok → PaginatedResult をそのまま返す
4. Err(BizError) → CmdError に変換して返す

**制約**: `record_type` が未指定または `all` の場合は対応済み4種を返す。未対応の record_type / status は BIZ 層で validation error にする。

---

#### get_receiving_record

**関数要求**: 入庫記録詳細を取得し、明細、原価合計、関連在庫変動を表示できる形で返す。

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn get_receiving_record(
    state: State<AppState>,
    record_id: i64,
) -> Result<ReceivingRecordDetail, CmdError>
```

**出力型**:
```
struct ReceivingRecordDetail {
    id: i64,
    receiving_date: String,
    supplier_id: Option<i64>,
    supplier_name: Option<String>,
    note: Option<String>,
    status: String,
    created_at: String,
    items: Vec<ReceivingRecordDetailItem>,
    total_cost: i64,
    movements: Vec<MovementRecord>,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&conn`）
2. biz::inventory_service::get_receiving_record(&conn, record_id) を呼ぶ
3. Ok → ReceivingRecordDetail をそのまま返す
4. Err(BizError::NotFound) → CmdError.kind="not_found" に変換して返す
5. Err(other) → CmdError に変換して返す

---

#### get_return_record

**関数要求**: 返品・交換記録詳細を取得し、明細、レジ戻し済み状態、レシート画像パス、関連在庫変動を表示できる形で返す。

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn get_return_record(
    state: State<AppState>,
    record_id: i64,
) -> Result<ReturnRecordDetail, CmdError>
```

**出力型**:
```
struct ReturnRecordDetail {
    id: i64,
    return_type: String,
    return_date: String,
    register_processed: bool,
    receipt_image_path: Option<String>,
    note: Option<String>,
    status: String,
    created_at: String,
    items: Vec<ReturnRecordDetailItem>,
    movements: Vec<MovementRecord>,
}
```

**処理ステップ**: get_receiving_record と同パターン。`register_processed=true` の記録は movements が 0 件でも正常に返す。

---

#### get_manual_sale_record

**関数要求**: 手動販売記録詳細を取得し、明細、販売金額合計、関連在庫変動を表示できる形で返す。

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn get_manual_sale_record(
    state: State<AppState>,
    record_id: i64,
) -> Result<ManualSaleRecordDetail, CmdError>
```

**出力型**:
```
struct ManualSaleRecordDetail {
    id: i64,
    sale_date: String,
    reason: String,
    note: Option<String>,
    status: String,
    created_at: String,
    items: Vec<ManualSaleRecordDetailItem>,
    total_amount: i64,
    movements: Vec<MovementRecord>,
}
```

**処理ステップ**: get_receiving_record と同パターン。業務記録IDは `manual_sales.id` であり、`sale_records.id` ではない。

---

#### get_disposal_record

**関数要求**: 廃棄・破損記録詳細を取得し、明細、ロス原価合計、関連在庫変動を表示できる形で返す。

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn get_disposal_record(
    state: State<AppState>,
    record_id: i64,
) -> Result<DisposalRecordDetail, CmdError>
```

**出力型**:
```
struct DisposalRecordDetail {
    id: i64,
    disposal_date: String,
    status: String,
    created_at: String,
    total_loss_cost: i64,
    items: Vec<DisposalRecordDetailItem>,
    movements: Vec<MovementRecord>,
}

struct DisposalRecordDetailItem {
    id: i64,
    product_code: String,
    product_name: String,
    department_name: String,
    stock_unit: String,
    disposal_type: String,
    quantity: i64,
    cost_price: i64,
    reason: String,
    line_loss_cost: i64,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&conn`）
2. biz::inventory_service::get_disposal_record(&conn, record_id) を呼ぶ
3. Ok → DisposalRecordDetail をそのまま返す
4. Err(BizError::NotFound) → CmdError.kind="not_found" に変換して返す
5. Err(other) → CmdError に変換して返す

---

### 23.8 CMD-06: 在庫照会コマンド群

#### get_stock_detail

**関数要求**: 商品の在庫詳細情報を取得する（最終入庫日・最終販売日を含む）

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn get_stock_detail(
    state: State<AppState>,
    product_code: String,
) -> Result<StockDetail, CmdError>
```

**出力型（新規）**:
```
struct StockDetail {
    product: ProductWithRelations,
    last_receiving_date: Option<String>,  // 最終入庫日（YYYY-MM-DD）
    last_sale_date: Option<String>,       // 最終販売日（YYYY-MM-DD）
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&conn`）
2. biz::product_service::get_stock_detail(&conn, &product_code) を呼ぶ
3. Ok → StockDetail をそのまま返す
4. Err(BizError::NotFound) → CmdError { kind: "not_found" }
5. Err(other) → CmdError に変換

**入力例**:
```json
{
  "product_code": "4976383262108"
}
```

**出力例**:
```json
{
  "product": {
    "product_code": "4976383262108",
    "jan_code": "4976383262108",
    "name": "ハマナカ アミアミ極太 col.42",
    "department_id": 3,
    "selling_price": 648,
    "cost_price": 111,
    "stock_quantity": 14,
    "stock_unit": "pcs",
    "is_discontinued": false,
    "department_name": "毛糸",
    "supplier_name": "ハマナカ"
  },
  "last_receiving_date": "2026-03-21",
  "last_sale_date": "2026-03-23"
}
```

---

#### list_low_stock

**関数要求**: 在庫が閾値以下の商品を一覧取得する。stock_unit別に異なる閾値を適用する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn list_low_stock(
    state: State<AppState>,
    include_discontinued: bool,
) -> Result<Vec<ProductWithRelations>, CmdError>
```

**入力型**:
```
include_discontinued: bool   // true=廃番含む、false=廃番除外
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&conn`）
2. biz::product_service::list_low_stock(&conn, include_discontinued) を呼ぶ
   - BIZ層内部で system_repo::get_setting で `stock_low_threshold`（pcs用）と `stock_low_threshold_fabric`（cm用）を取得
   - product_repo::list_low_stock_products に閾値を渡す
3. Ok → Vec<ProductWithRelations> をそのまま返す
4. Err(BizError) → CmdError に変換して返す

**設計判断 — 閾値をCMD層に渡さない理由**: 閾値はapp_settings（DB）に格納されている。CMD層が閾値を取得してIO層に渡す構造だとCMD層がDBに2回アクセスすることになる。BIZ層で閾値取得とクエリを一括で行う方がシンプル。

**入力例**:
```json
{
  "include_discontinued": false
}
```

**出力例**:
```json
[
  {
    "product_code": "4976383262108",
    "name": "ハマナカ アミアミ極太 col.42",
    "stock_quantity": 2,
    "stock_unit": "pcs",
    "department_name": "毛糸"
  },
  {
    "product_code": "NU-0015",
    "name": "リバティ柄 タナローン",
    "stock_quantity": 300,
    "stock_unit": "cm",
    "department_name": "布"
  }
]
```
※ 上記例ではpcs閾値=3, cm閾値=500の場合。stock_quantity=2 <= 3、stock_quantity=300 <= 500 でヒット

---

#### list_movements

**関数要求**: 商品別の在庫変動履歴をフィルタ付きでページング取得する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn list_movements(
    state: State<AppState>,
    query: MovementQuery,
) -> Result<PaginatedResult<MovementRecord>, CmdError>
```

**入力型（新規）**:
```
struct MovementQuery {
    product_code: String,
    date_from: Option<String>,        // YYYY-MM-DD
    date_to: Option<String>,          // YYYY-MM-DD
    movement_type: Option<String>,    // "sale_auto" | "sale_manual" | "receiving" | "return" | "disposal" | "stocktake"
    page: u32,
    per_page: u32,
}
```

**出力型（新規）**:
```
struct MovementRecord {
    id: i64,
    product_code: String,
    movement_type: String,
    quantity: i64,
    stock_after: i64,
    reference_type: Option<String>,
    reference_id: Option<i64>,
    source: Option<MovementSourceLink>,
    note: Option<String>,
    created_at: String,
}
struct MovementSourceLink {
    label: String,
    route: String,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`&conn`）
2. biz::inventory_service::list_movements(&conn, &query) を呼ぶ
3. Ok → PaginatedResult をそのまま返す
4. Err(BizError) → CmdError に変換して返す

**設計判断 — is_voided=0 の暗黙フィルタ**: IO層のSQLで `WHERE is_voided = 0` を常に付与する。ロールバック済みの変動は在庫照会画面に表示しない。

**設計判断 — source link の責務**: IO層は `reference_type/reference_id` を取得し、BIZ層が `source` を解決する。既知の `reference_type` は `label` と `route` を返す。`reference_type` または `reference_id` が NULL、または未知の値の場合は movement 行を残したまま `source=None` にする。

**入力例**:
```json
{
  "query": {
    "product_code": "4976383262108",
    "date_from": "2026-03-01",
    "date_to": "2026-03-31",
    "movement_type": null,
    "page": 1,
    "per_page": 50
  }
}
```

**出力例**:
```json
{
  "items": [
    {
      "id": 42,
      "product_code": "4976383262108",
      "movement_type": "sale_auto",
      "quantity": -3,
      "stock_after": 14,
      "reference_type": "csv_import",
      "reference_id": 3,
      "source": {
        "label": "CSV取込み #3",
        "route": "/csv-import/records/3"
      },
      "note": null,
      "created_at": "2026-03-23T19:45:00"
    },
    {
      "id": 38,
      "product_code": "4976383262108",
      "movement_type": "receiving",
      "quantity": 12,
      "stock_after": 17,
      "reference_type": "receiving_record",
      "reference_id": 5,
      "source": {
        "label": "入庫記録 #5",
        "route": "/inventory/receiving/records/5"
      },
      "note": null,
      "created_at": "2026-03-21T10:30:00"
    }
  ],
  "total_count": 8,
  "page": 1,
  "per_page": 50
}
```

---

### 23.9 CMD-06用 IO層新規関数

CMD-06の3コマンドが呼び出すIO層関数。既存のリポジトリファイルに追加する。

#### product_repo::get_stock_detail

**関数要求**: 商品の在庫詳細を、最終入庫日・最終販売日付きで取得する

**シグネチャ**:
```
fn get_stock_detail(
    conn: &DbConnection,
    product_code: &str,
) -> Result<StockDetail, DbError>
```

**SQL概要**:
```sql
SELECT p.*, d.name AS dept_name, s.name AS supplier_name,
       (SELECT MAX(rr.receiving_date)
        FROM receiving_items ri
        JOIN receiving_records rr ON ri.receiving_record_id = rr.id
        WHERE ri.product_code = p.product_code) AS last_receiving_date,
       (SELECT MAX(sr.sale_date)
        FROM sale_records sr
        WHERE sr.product_code = p.product_code AND sr.is_voided = 0) AS last_sale_date
FROM products p
LEFT JOIN departments d ON p.department_id = d.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
WHERE p.product_code = ?1
```

**エラー**: 商品が見つからない場合は `DbError::NotFound` を返す。

---

#### product_repo::list_low_stock_products

**関数要求**: 在庫が閾値以下の商品を一覧取得する

**シグネチャ**:
```
fn list_low_stock_products(
    conn: &DbConnection,
    threshold_pcs: i64,
    threshold_cm: i64,
    include_discontinued: bool,
) -> Result<Vec<ProductWithRelations>, DbError>
```

**SQL概要**:
```sql
SELECT p.*, d.name AS dept_name, s.name AS supplier_name
FROM products p
LEFT JOIN departments d ON p.department_id = d.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
WHERE ((p.stock_unit = 'pcs' AND p.stock_quantity <= ?1)
    OR (p.stock_unit = 'cm' AND p.stock_quantity <= ?2))
  [AND p.is_discontinued = 0]  -- include_discontinued=false の場合
ORDER BY p.stock_quantity ASC, p.name ASC
```

**ページング不要の理由**: 閾値以下の商品は通常少数（数十件程度）。4000商品中、在庫少は一覧で全件表示する（architecture/ui-task-specs.md UI-06b仕様）。

---

#### inventory_repo::list_movements

**関数要求**: 商品別の在庫変動履歴をフィルタ付きでページング取得する

**シグネチャ**:
```
fn list_movements(
    conn: &DbConnection,
    query: &MovementQuery,
) -> Result<PaginatedResult<MovementRecord>, DbError>
```

**SQL概要**:
```sql
SELECT id, product_code, movement_type, quantity, stock_after,
       reference_type, reference_id, note, created_at
FROM inventory_movements
WHERE product_code = ?1
  AND is_voided = 0
  [AND created_at >= ?N]       -- date_from
  [AND created_at <= ?N]       -- date_to（末尾に'T23:59:59'を付与）
  [AND movement_type = ?N]     -- movement_type フィルタ
ORDER BY created_at DESC, id DESC
LIMIT ?N OFFSET ?N
```

**MovementQuery / MovementRecord / MovementSourceLink 型定義**: inventory_repo に配置。CMD層は biz/mod.rs 経由で re-export されたものを使用する。`MovementRecord.source` は BIZ層で付与するため、IO層のSQL select対象には含めない。

---

### 23.10 BIZ層 listラッパー

CMD-02〜06のlist操作で使用するBIZ層ラッパー。既存の `csv_import_service::list_csv_imports`（list.rs）と同じパターン。

#### inventory_service に追加する関数

```
// 入庫一覧
fn list_receivings(
    conn: &DbConnection,
    query: &ListQuery,
) -> Result<PaginatedResult<ReceivingRecordWithSupplier>, BizError>

// 返品一覧
fn list_returns(
    conn: &DbConnection,
    query: &ListQuery,
) -> Result<PaginatedResult<ReturnRecordSummary>, BizError>

// 廃棄一覧
fn list_disposals(
    conn: &DbConnection,
    query: &ListQuery,
) -> Result<PaginatedResult<DisposalRecordSummary>, BizError>

// 入出庫履歴ハブ
fn list_inventory_records(
    conn: &DbConnection,
    query: &InventoryRecordQuery,
) -> Result<PaginatedResult<InventoryRecordSummary>, BizError>

// 業務記録詳細
fn get_receiving_record(
    conn: &DbConnection,
    record_id: i64,
) -> Result<ReceivingRecordDetail, BizError>

fn get_return_record(
    conn: &DbConnection,
    record_id: i64,
) -> Result<ReturnRecordDetail, BizError>

fn get_manual_sale_record(
    conn: &DbConnection,
    record_id: i64,
) -> Result<ManualSaleRecordDetail, BizError>

fn get_disposal_record(
    conn: &DbConnection,
    record_id: i64,
) -> Result<DisposalRecordDetail, BizError>

// 在庫変動履歴
fn list_movements(
    conn: &DbConnection,
    query: &MovementQuery,
) -> Result<PaginatedResult<MovementRecord>, BizError>
```

各関数の処理:
1. ページパラメータのバリデーション（page >= 1, 1 <= per_page <= 100）
2. 対応するrepo関数を呼び出し
3. `DbError` → `BizError::DatabaseError` に変換して返す

`list_movements` は repo から得た movement 行に対して `reference_type/reference_id` を見て `source` を補完する。source 補完に失敗しても一覧取得全体をエラーにはしない。

#### product_service に追加する関数

```
// 在庫詳細
fn get_stock_detail(
    conn: &DbConnection,
    product_code: &str,
) -> Result<StockDetail, BizError>

// 在庫少一覧
fn list_low_stock(
    conn: &DbConnection,
    include_discontinued: bool,
) -> Result<Vec<ProductWithRelations>, BizError>
```

list_low_stock の処理:
1. system_repo::get_setting(conn, "stock_low_threshold") で pcs 閾値を取得（デフォルト3）
2. system_repo::get_setting(conn, "stock_low_threshold_fabric") で cm 閾値を取得（デフォルト500）
3. product_repo::list_low_stock_products(conn, threshold_pcs, threshold_cm, include_discontinued) を呼び出し

---

### 23.11 非目的

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| 入力バリデーション（空items、不正日付等） | BIZ層の責務 | BIZ-02 inventory_service |
| 在庫変動処理（stock_quantity更新+movements記録） | BIZ層の責務 | BIZ-02 inventory_service |
| 冪等性チェック（同一キーの重複リクエスト検知） | BIZ層の責務 | BIZ-02 inventory_service |
| PLU登録済み警告の判定 | BIZ層の責務 | BIZ-02 inventory_service |
| 閾値の取得と適用 | BIZ層の責務 | BIZ-01 product_service |
| ページパラメータ上限チェック | BIZ層の責務 | 各BIZ listラッパー |

---

### 23.12 対応不変条件

| 不変条件 | 本モジュールでの対応 |
|---------|-----------------|
| INV-1: quantity符号変換 | BIZ層に委譲。CMD層は符号変換に関与しない |
| INV-2: stock_quantity更新とmovements記録の同時性 | BIZ層のトランザクション内で保証 |
| INV-3: 冪等性（idempotency_key） | BIZ層に委譲。CMD層はキーをそのまま中継 |
| INV-5: 在庫マイナス警告（エラーではなく警告） | BIZ層が stock_warnings に含めて返す |
| INV-8: products物理DELETE禁止 | CMD層はproductsのDELETE操作を持たない |

---

### 23.13 lib.rs へのコマンド登録

```
// lib.rs の invoke_handler に追加
.invoke_handler(tauri::generate_handler![
    // CMD-01（既存）
    ...
    // CMD-02: 入庫
    cmd::receiving_cmd::create_receiving,
    cmd::receiving_cmd::list_receivings,
    // CMD-03: 返品・交換
    cmd::return_cmd::create_return,
    cmd::return_cmd::list_returns,
    // CMD-04: 手動販売出庫
    cmd::manual_sale_cmd::create_manual_sale,
    // CMD-05: 廃棄・破損
    cmd::disposal_cmd::create_disposal,
    cmd::disposal_cmd::list_disposals,
    cmd::disposal_cmd::list_inventory_records,
    cmd::receiving_cmd::get_receiving_record,
    cmd::return_cmd::get_return_record,
    cmd::manual_sale_cmd::get_manual_sale_record,
    cmd::disposal_cmd::get_disposal_record,
    // CMD-06: 在庫照会
    cmd::inventory_cmd::get_stock_detail,
    cmd::inventory_cmd::list_low_stock,
    cmd::inventory_cmd::list_movements,
    // CMD-07〜11（既存）
    ...
])
```
