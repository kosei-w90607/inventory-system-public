## 12. BIZ-02: 在庫変動ロジック

### 12.1 モジュール構成

```
src-tauri/src/
  biz/
    mod.rs                -- pub mod inventory_service を追加
    product_service.rs    -- 既存（BIZ-01）
    inventory_service.rs  -- 在庫変動の業務ロジック（本セクション）
```

### 12.2 apply_stock_change（共通在庫変動 — 内部関数）

**関数要求**: 商品の在庫数を変動させ、inventory_movements に履歴を記録する。全ての入出庫処理から呼ばれる共通内部関数

**シグネチャ**:
```
fn apply_stock_change(
    conn: &DbConnection,   // TX内で呼ばれるため &Transaction 経由の &DbConnection
    product_code: &str,
    quantity: i64,          // 在庫視点: +増加 / -減少（BIZ層が符号変換済み）
    movement_type: MovementType,
    reference_type: ReferenceType,
    reference_id: i64,
    note: Option<String>,
) -> Result<StockChangeOutcome, BizError>
```

**StockChangeOutcome構造体**:
- stock_after: i64
- negative_stock_warning: bool（stock_after < 0 なら true）

**前提条件**: この関数は呼び出し元のトランザクション内で実行される。自身ではトランザクションを開始しない。products.stock_quantity 更新と inventory_movements INSERT は同一TX内で常にセットで実行される。いずれかが失敗した場合、呼び出し元のTX全体がROLLBACKされる（rusqlite::Transaction RAII による自動ROLLBACK）

**処理ステップ**:
1. product_repo::find_by_product_code(conn, product_code) → product
   - None → BizError::NotFound("商品が見つかりません: {product_code}")
2. stock_after = product.stock_quantity + quantity
3. negative_stock_warning = stock_after < 0
4. inventory_repo::update_stock_quantity(conn, product_code, stock_after)
   - Ok(false) → BizError::NotFound（通常ステップ1で検出済みだが安全策）
5. inventory_repo::insert_movement(conn, &NewMovement { product_code, movement_type, quantity, stock_after, reference_type: Some(reference_type), reference_id: Some(reference_id), note })
6. StockChangeOutcome { stock_after, negative_stock_warning } を返す

---

### 12.3 create_receiving（入庫記録）

**関数要求**: 入庫記録ヘッダと明細を登録し、各明細について在庫を増加させる

**シグネチャ**:
```
fn create_receiving(conn: &mut DbConnection, req: ReceivingCreateRequest) -> Result<ReceivingCreateResult, BizError>
```

**ReceivingCreateRequest構造体**:
- idempotency_key: String（UI/caller が1保存試行単位の安定キーとして生成し、CMD層は中継する。BIZ層は空文字・長さ制限・重複時 fingerprint 一致を検証する）
- supplier_id: Option<i64>
- receiving_date: String（YYYY-MM-DD）
- note: Option<String>
- items: Vec<ReceivingItemInput>

**ReceivingItemInput構造体**:
- product_code: String
- quantity: i64（正の整数のみ）
- cost_price: i64

**ReceivingCreateResult構造体**:
- record_id: i64
- created: bool
- idempotent_replay: bool
- stock_warnings: Vec<String>

**不変条件**: created=true ↔ idempotent_replay=false、created=false ↔ idempotent_replay=true。この2組み合わせ以外は生成しない

**処理ステップ**:
1. **冪等性チェック**
   - inventory_repo::find_receiving_by_idempotency_key(conn, &req.idempotency_key)
   - Some((existing_id, existing_fp)) の場合:
     - request_fingerprint を計算し、existing_fp と比較
     - 一致 → ReceivingCreateResult { record_id: existing_id, created: false, idempotent_replay: true, stock_warnings: [] } を返す
     - 不一致 → BizError::IdempotencyConflict("同じ冪等キーで異なる内容のリクエストです")
2. **バリデーション（TX外）**
   a. items が空 → BizError::ValidationFailed("明細が1件以上必要です")
   b. 各item: quantity <= 0 → ValidationFailed、cost_price < 0 → ValidationFailed、product_codeの存在チェック
   c. supplier_idがSome → 存在チェック
3. **request_fingerprint を計算**
4. **トランザクション開始**（conn.transaction()）
5. inventory_repo::insert_receiving_record(&tx, record) → record_id
6. 各item: insert_receiving_item + apply_stock_change(+quantity, Receiving, ReceivingRecord, record_id)
7. system_repo::insert_operation_log(operation_type="receiving_create")
8. **COMMIT**
9. ReceivingCreateResult { record_id, created: true, idempotent_replay: false, stock_warnings }

**request_fingerprint 正規化**:
- ヘッダ行: "{supplier_id}|{receiving_date}"
- item行: "{product_code}|{quantity}|{cost_price}"
- item行を行文字列全体の辞書順ASCでソート
- ヘッダ行 + item行を "\n" で結合 → SHA-256 hex digest（小文字64文字）
- 型の正規化: 整数→10進文字列（先頭ゼロなし）、Option None→"null"、日付→YYYY-MM-DD（10文字固定）

---

### 12.4 create_return（返品・交換記録）

**関数要求**: 返品・交換記録を登録する。register_processed フラグに基づき在庫を動かすかどうかを分岐する

**シグネチャ**:
```
fn create_return(conn: &mut DbConnection, req: ReturnCreateRequest) -> Result<ReturnCreateResult, BizError>
```

**ReturnCreateRequest構造体**:
- idempotency_key: String
- return_type: String（"return" / "exchange"）
- return_date: String（YYYY-MM-DD）
- register_processed: bool
- receipt_image_path: Option<String>
- note: Option<String>
- items: Vec<ReturnItemInput>

**ReturnItemInput構造体**:
- product_code: String
- direction: String（"in" / "out"）
- quantity: i64（正の整数のみ）

**ReturnCreateResult構造体**:
- record_id: i64
- created: bool
- idempotent_replay: bool
- stock_warnings: Vec<String>

**処理ステップ**:
1. **冪等性チェック**（create_receivingと同パターン）
2. **バリデーション**: items空チェック、return_type検証、return_type と direction の組み合わせ検証、各item の direction/quantity/product_code検証
   - return_type == "return": direction は全itemで "in" のみ許可する。1件以上の "in" item が必要
   - return_type == "exchange": "in" item と "out" item を少なくとも1件ずつ要求する
   - 上記に違反した場合は BizError::ValidationFailed を返し、insert_return_record / insert_return_item / stock change は実行しない
3. **request_fingerprint計算**
   - ヘッダ行: "{return_type}|{return_date}|{register_processed}"
   - item行: "{product_code}|{quantity}|{direction}"
4. **TX開始**
5. insert_return_record → record_id
6. 各item:
   - insert_return_item
   - register_processed == true → 在庫は動かさない（CSV取込みで自動反映されるため）
   - register_processed == false:
     - direction == "in" → apply_stock_change(+quantity, Return, ReturnRecord, record_id)
     - direction == "out" → apply_stock_change(-quantity, Return, ReturnRecord, record_id)
7. **操作ログ**
8. **COMMIT**

**設計判断 — register_processed分岐**:
- register_processed=1: レジで「戻し」操作済み。次回CSV精算データに反映される。BIZ-02で在庫を動かすと二重計上
- register_processed=0: レジ未処理。CSVに反映されないためここで在庫を動かす

**設計判断 — return_type と direction の業務不変条件**:
- 返品（return）は商品が戻る記録なので、明細 direction は "in" のみ許可する。"out" を含む返品は帳面上の意味が崩れるため BIZ-02 で拒否する
- 交換（exchange）は「戻った商品」と「渡した商品」の対を記録するため、"in" と "out" の両方を少なくとも1件ずつ要求する。片側だけなら返品または別の出庫種別として扱う
- UI-03 は保存前に日本語エラーを出すが、generated command はUI以外からも呼べるため、最終防御は BIZ-02 が持つ

---

### 12.5 create_manual_sale（手動販売出庫）

**関数要求**: レジを通さない販売を手動記録する。PLU登録済み商品への警告チェック（token方式）を含む

**シグネチャ**:
```
fn create_manual_sale(conn: &mut DbConnection, req: ManualSaleCreateRequest) -> Result<ManualSaleCreateResult, BizError>
```

**ManualSaleCreateRequest構造体**:
- idempotency_key: String
- sale_date: String（YYYY-MM-DD）
- reason: String（"plu_unregistered" / "other"）
- note: Option<String>
- items: Vec<ManualSaleItemInput>
- confirmation_token: Option<String>（初回はNone、警告確認後に再呼出時はSome）

**ManualSaleItemInput構造体**:
- product_code: String
- quantity: i64（正の整数のみ）
- amount: i64

**ManualSaleCreateResult構造体**:
- sale_id: Option<i64>（needs_confirmation=true の場合は None）
- created: bool
- idempotent_replay: bool
- plu_warnings: Vec<String>
- stock_warnings: Vec<String>
- needs_confirmation: bool
- confirmation_token: Option<String>（警告時にtoken生成して返却）

**処理ステップ**:
1. **冪等性チェック**（同パターン）
2. **バリデーション**: items空チェック、reason検証、各item の quantity/amount/product_code検証
3. **PLU登録済みチェック**:
   - 各item の product: plu_dirty == false かつ plu_exported_at IS NOT NULL → plu_warnings に追加
   - plu_warnings が非空:
     - confirmation_token == None → token生成して即リターン（needs_confirmation=true）
     - confirmation_token == Some(token) → ハッシュ再計算して一致確認。不一致→ValidationFailed
4. **request_fingerprint計算**
   - ヘッダ行: "{sale_date}|{reason}"
   - item行: "{product_code}|{quantity}|{amount}"
5. **TX開始**
6. insert_manual_sale → sale_id
7. 各item:
   - insert_manual_sale_item
   - sales_repo::insert_sale_record(source="manual", quantity=+item.quantity[売上帳票視点])
   - apply_stock_change(-quantity[在庫視点], SaleManual, ManualSale, sale_id)
8. **操作ログ**(operation_type="manual_sale_create")
9. **COMMIT**
10. ManualSaleCreateResult { sale_id, created: true, idempotent_replay: false, ... needs_confirmation: false }

**PLU warning_token 方式**:
- ハッシュ対象: product_code + plu_dirty + plu_exported_at + quantity + amount を正規化ソート → SHA-256
- plu_exported_at を含める（安全優先。PLU書出しと手動販売の同時進行はほぼないためUXコスト極小）

**設計判断 — sale_records.quantity の符号**:
INV-1に従い、sale_records.quantity は売上帳票視点で正の値。inventory_movements.quantity は在庫視点で負の値。符号変換は create_manual_sale 内で行う

---

### 12.6 create_disposal（廃棄・破損記録）

**関数要求**: 廃棄・破損記録を登録し、在庫を減少させる

**シグネチャ**:
```
fn create_disposal(conn: &mut DbConnection, req: DisposalCreateRequest) -> Result<DisposalCreateResult, BizError>
```

**DisposalCreateRequest構造体**:
- idempotency_key: String
- disposal_date: String（YYYY-MM-DD）
- items: Vec<DisposalItemInput>

**DisposalItemInput構造体**:
- product_code: String
- disposal_type: String（"disposal" / "damage" / "other"）
- quantity: i64（正の整数のみ）
- cost_price: i64
- reason: String

**DisposalCreateResult構造体**:
- record_id: i64
- created: bool
- idempotent_replay: bool
- stock_warnings: Vec<String>

**処理ステップ**:
1. **冪等性チェック**（同パターン）
2. **バリデーション**: items空、各item の quantity/cost_price/reason/disposal_type/product_code検証
3. **request_fingerprint計算**
   - ヘッダ行: "{disposal_date}"
   - item行: "{product_code}|{quantity}|{cost_price}|{disposal_type}|{reason}"
4. **TX開始**
5. insert_disposal_record → record_id
6. 各item: insert_disposal_item + apply_stock_change(-quantity, Disposal, DisposalRecord, record_id)
7. **操作ログ**(operation_type="disposal_create")
8. **COMMIT**

---

### 12.6a 業務記録詳細 read 関数

**関数要求**: 入出庫履歴・在庫変動追跡の詳細画面用に、業務記録ヘッダ、明細、関連 `inventory_movements` を読み取り専用で返す。BIZ 層は IO 層の detail に対して `MovementRecord.source` を補完し、存在しない記録は `BizError::NotFound` に変換する。

**シグネチャ**:
```
fn get_receiving_record(conn: &DbConnection, record_id: i64) -> Result<ReceivingRecordDetail, BizError>
fn get_return_record(conn: &DbConnection, record_id: i64) -> Result<ReturnRecordDetail, BizError>
fn get_manual_sale_record(conn: &DbConnection, record_id: i64) -> Result<ManualSaleRecordDetail, BizError>
fn get_disposal_record(conn: &DbConnection, record_id: i64) -> Result<DisposalRecordDetail, BizError>
```

**処理ステップ**:
1. 対応する IO detail 関数を呼ぶ
2. IO 層の NotFound は記録種別名を含む `BizError::NotFound` に変換する
3. その他の IO エラーは `BizError::DatabaseError` に変換する
4. detail.movements の各行に対して `reference_type/reference_id` から `MovementSourceLink` を補完する

**設計判断 — read-only の責務分離**:
詳細取得は過去記録の確認用途であり、取消/訂正、CSV出力、印刷、画像 asset 表示は別 slice に分ける。CMD 層は read command を thin wrapper とし、表示用集計（原価合計、販売金額合計）は IO/BIZ の DTO に入れて UI で再計算しない。

---

### 12.7 エラーハンドリング（BizError 追加）

```
enum BizError {
    ValidationFailed(String),
    NotFound(String),
    DuplicateProductCode(String),
    DatabaseError(DbError),
    ImportError(String),
    IdempotencyConflict(String),  // ← 新規追加
}
```

**IdempotencyConflict**: 同じ冪等キーで異なる内容のリクエスト。CMD層では CmdError { kind: "idempotency_conflict" } に変換

---

### 12.8 request_fingerprint 正規化仕様

**原則**: 業務結果に影響するフィールドのみ含める。備考・画像パス等の補足情報は除外

**関数別フィールド一覧**:

| 関数 | ヘッダ（含める） | ヘッダ（除外） | item（含める） | item（除外） |
|------|----------------|---------------|---------------|-------------|
| create_receiving | supplier_id, receiving_date | note | product_code, quantity, cost_price | — |
| create_return | return_type, return_date, register_processed | receipt_image_path, note | product_code, direction, quantity | — |
| create_manual_sale | sale_date, reason | note | product_code, quantity, amount | — |
| create_disposal | disposal_date | — | product_code, disposal_type, quantity, cost_price, reason | — |

**正規化手順**:
1. ヘッダ固有値を先頭行に生成
2. 各itemの行文字列を生成
3. item行を行文字列全体の辞書順ASCでソート（同一product_codeでも安定）
4. ヘッダ行 + ソート済みitem行を "\n" で結合
5. SHA-256 hex digest（小文字64文字）

**型の正規化ルール**:
- 整数: 10進文字列、符号付き、先頭ゼロなし（"500", "-3"）
- Option<T>: None → "null", Some(v) → vの文字列表現
- bool: "true" / "false"
- 日付: YYYY-MM-DD（10文字固定）。時刻部分があれば切り捨て
- 文字列: UTF-8そのまま
