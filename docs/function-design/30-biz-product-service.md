## 4. BIZ-01: 商品管理ロジック

### 4.1 モジュール構成

```
src-tauri/src/
  biz/
    mod.rs
    product_service.rs  -- 商品管理の業務ロジック
```

### 4.2 create_product

**関数要求**: 商品を新規登録する。独自コード発番、バリデーション、棚卸し中の自動追加を含む

**シグネチャ**:
```
fn create_product(conn: &mut DbConnection, req: ProductCreateRequest) -> Result<ProductCreateResult, BizError>
```

**ProductCreateRequest構造体**:
- jan_code: Option<String>（JANスキャン入力。Noneなら独自コード発番）
- name: String
- department_id: i64
- selling_price: i64
- cost_price: i64
- tax_rate: String（"10" / "8" / "0"）
- stock_unit: String（"pcs" / "cm"）
- initial_stock: i64（0なら在庫なし）
- maker_code: Option<String>
- supplier_id: Option<i64>
- pos_stock_sync: bool
- plu_target: bool（D-028: スキャニングPLU書出し対象フラグ。UI-01b が jan_code の 13 桁数字判定から初期値を提案し、利用者が変更した確定値を渡す。pos_stock_sync と同じ「UI で初期値提案 + 変更可」パターン）

**ProductCreateResult構造体**:
- product_code: String（発番された場合は独自コード）
- warnings: Vec<String>

**処理ステップ**:
1. **バリデーション**
   a. name が空文字 → BizError::ValidationFailed("商品名は必須です")
   b. selling_price < 0 → BizError::ValidationFailed("売価は0以上で入力してください")
   c. cost_price < 0 → BizError::ValidationFailed("原価は0以上で入力してください")
   d. tax_rate が "10","8","0" のいずれでもない → BizError::ValidationFailed("税率が不正です")
   e. stock_unit が "pcs","cm" のいずれでもない → BizError::ValidationFailed("数量単位が不正です")
   f. department_idの存在チェック → product_repo::find_department_by_id()。None → BizError::ValidationFailed("指定された部門が存在しません")
   g. supplier_idがSomeの場合 → 存在チェック。None → BizError::ValidationFailed("指定された取引先が存在しません")

2. **トランザクション開始（rusqlite::Transaction RAII）**
   - `conn.transaction()` で開始。Drop 時に自動 ROLLBACK
   - 実装時の差分: 元の設計ではステップ3だったが、generate_custom_code 内の increment_next_seq が DB を更新するため TX 内に含める必要あり

3. **product_codeの決定**（TX内）
   a. jan_codeがSome:
      - product_code = jan_code.clone()
      - product_repo::find_by_product_code() で重複チェック → 既存あり → BizError::DuplicateProductCode(product_code)
   b. jan_codeがNone:
      - generate_custom_code(conn, department_id) を呼ぶ（後述）→ product_codeを取得
      - jan_code = None のまま

4. **productsにINSERT**
   - NewProduct構造体を構築してproduct_repo::insert_product()を呼ぶ
   - plu_dirty = true, plu_exported_at = None
   - pos_stock_sync = req.pos_stock_sync
   - plu_target = req.plu_target（D-028。plu_target=0 の商品は plu_dirty=true のままでも抽出・通知クエリの plu_target 条件で対象外になるため、plu_dirty の値は分岐しない）

5. **初期在庫の記録**（initial_stock > 0 の場合のみ）
   - inventory_repo::insert_movement() を呼ぶ
   - movement_type = "receiving", quantity = initial_stock, stock_after = initial_stock
   - reference_type = None, reference_id = None（初期投入は特定の入庫記録に紐付かない）
   - note = "初期在庫投入"

6. **棚卸し中チェック**
   - stocktake_repo::find_active_stocktake() を呼ぶ
   - Some(stocktake) → stocktake_repo::insert_stocktake_item() を呼ぶ
     - stocktake_id = stocktake.id, product_code, system_stock = initial_stock, actual_count = None

7. **操作ログ記録**
   - system_repo::insert_operation_log() を呼ぶ
   - operation_type = "product_create"
   - summary = "商品を登録しました: {name} ({product_code})"
   - detail_json = None

8. **COMMIT**

9. **結果返却**
   - ProductCreateResult { product_code, warnings: [] }

**エラーハンドリング**:
- バリデーション失敗 → BizError::ValidationFailed(message)。トランザクション開始前なのでROLLBACK不要
- 重複コード → BizError::DuplicateProductCode(code)。TX内で発生 → RAII自動ROLLBACK
- DB操作失敗（INSERT等）→ RAII自動ROLLBACK → BizError::DatabaseError(DbError)
- 棚卸しアイテム追加失敗 → RAII自動ROLLBACK → BizError::DatabaseError(DbError)

---

### 4.3 generate_custom_code

**関数要求**: 部門の接頭辞と連番から独自コードを生成する。トランザクション内で呼ばれることを前提とする

**シグネチャ**:
```
fn generate_custom_code(conn: &DbConnection, department_id: i64) -> Result<String, BizError>
// 注: TX内で呼ばれるため、引数は &Transaction（Deref<Target=Connection>）経由の &DbConnection
```

**処理ステップ**:
1. product_repo::find_department_by_id(department_id) → department
2. department.code_prefix が None → BizError::ValidationFailed("この部門は独自コード発番に対応していません")
3. product_repo::increment_next_seq(conn, department_id) → seq_num
4. code = format!("{}-{:04}", department.code_prefix, seq_num)（例: "HZ-0047"）
5. product_repo::find_by_product_code(conn, &code) で重複チェック
   - Some → BizError::DuplicateProductCode(code)（通常は起きないが安全のため）
6. code を返す

---

### 4.4 update_product

**関数要求**: 商品情報を更新する。売価/原価が変わった場合はprice_historyに記録し、売価変更時はplu_dirty=1にする

**シグネチャ**:
```
fn update_product(conn: &mut DbConnection, product_code: &str, req: &ProductUpdateRequest) -> Result<ProductUpdateResult, BizError>
```

**ProductUpdateRequest構造体**: 全フィールドがOption型
- name, department_id, selling_price, cost_price, tax_rate, maker_code, supplier_id, pos_stock_sync, plu_target

**処理ステップ**:
1. product_repo::find_by_product_code(product_code) → existing
   - None → BizError::NotFound("商品が見つかりません")
2. バリデーション（Someのフィールドのみ。create_productと同じルール）
3. **トランザクション開始（BEGIN）**
4. **価格変更チェック**
   - selling_priceまたはcost_priceがSomeで、既存値と異なる場合:
     - product_repo::insert_price_history() を呼ぶ
     - old_selling = existing.selling_price, new_selling = req.selling_price.unwrap_or(existing.selling_price)
     - old_cost, new_costも同様
   - selling_priceが変わった場合 → updatesにplu_dirty=trueを追加
4b. **plu_target 遷移チェック**（D-028）
   - plu_target が Some で既存値 0 → 1 に変わる場合 → updatesにplu_dirty=trueを追加（レジ登録が新たに必要になったため）
   - 1 → 0 の場合は plu_dirty を触らない（抽出・通知クエリの plu_target 条件で自然に対象外になる）
5. **productsをUPDATE**
   - ProductUpdatesを構築してproduct_repo::update_product()を呼ぶ
6. **操作ログ記録**
   - operation_type = "product_update"
   - detail_json = 変更前後の値をJSON化
7. **COMMIT**

**エラーハンドリング**:
- 商品が見つからない → BizError::NotFound
- バリデーション失敗 → BizError::ValidationFailed
- DB操作失敗 → ROLLBACK → BizError::DatabaseError

---

### 4.5 toggle_discontinue

**関数要求**: 商品の廃番フラグを反転する

**シグネチャ**:
```
fn toggle_discontinue(conn: &mut DbConnection, product_code: &str) -> Result<bool, BizError>
```

**処理ステップ**:
1. product_repo::find_by_product_code(product_code) → existing
   - None → BizError::NotFound
2. new_status = !existing.is_discontinued
3. **トランザクション開始**
4. product_repo::update_product(product_code, ProductUpdates { is_discontinued: Some(new_status), plu_dirty: Some(true) })
5. system_repo::insert_operation_log(operation_type="product_discontinue")
6. **COMMIT**
7. new_statusを返す（trueなら廃番になった、falseなら復帰した）

---

### 4.6 search_products（BIZ層のラッパー）

**関数要求**: 検索条件をIO層に渡して商品一覧を取得する。BIZ層では追加の業務ロジックなし

**シグネチャ**:
```
fn search_products(conn: &DbConnection, query: ProductSearchQuery) -> Result<PaginatedResult<ProductWithRelations>, BizError>
```

**処理ステップ**:
1. product_repo::search_products(conn, &query) を呼ぶ
2. 結果をそのまま返す（DbError → BizError::DatabaseErrorに変換）

---

### 4.7 list_departments（BIZ層のラッパー）

**関数要求**: UI の部門選択候補として、departments 初期データを全件取得する。商品検索結果から候補を派生しない。

**シグネチャ**:
```
fn list_departments(conn: &DbConnection) -> Result<Vec<Department>, BizError>
```

**処理ステップ**:
1. product_repo::list_departments(conn) を呼ぶ
2. 結果をそのまま返す（DbError → BizError::DatabaseErrorに変換）

**設計判断**: UI-01a 商品検索・一覧の部門フィルタは全 21 部門を候補として表示する必要がある。`search_products` の現在ページ `items` から部門候補を作ると、検索条件・ページング・廃番状態で候補が欠けるため採用しない。

---

### 4.7.1 list_suppliers（BIZ層のラッパー）

**関数要求**: UI-01b の取引先選択候補として、取引先マスタ全件を取得する。取引先は任意項目だが、選択候補は current product / current page から派生しない。

**シグネチャ**:
```
fn list_suppliers(conn: &DbConnection) -> Result<Vec<product_repo::Supplier>, BizError>
```

**処理ステップ**:
1. product_repo::list_suppliers(conn) を呼ぶ
2. 結果をそのまま返す（DbError → BizError::DatabaseErrorに変換）

**設計判断**: 初回 UI-01b では inline 新規取引先作成は扱わない。`find_or_create_supplier` の公開 CMD と新規追加 UX は、master data 追加の誤操作を避けるため別 Design Phase で扱う。

---

### 4.8 一括インポート: preview_import

**関数要求**: 商品マスタCSVファイルをパースし、各行を正常/エラー/重複に分類したプレビューデータを返す。DBへの書き込みなし

**シグネチャ**:
```
fn preview_import(conn: &DbConnection, file_bytes: &[u8]) -> Result<ImportPreview, BizError>
```

**ImportPreview構造体**:
```
struct ImportPreview {
    valid_rows: Vec<ImportRow>,       // 正常行（新規登録可能）
    error_rows: Vec<ImportErrorRow>,  // バリデーションエラー行
    duplicate_rows: Vec<ImportDuplicateRow>, // product_code が既存の行
}
```

**ImportRow構造体**:
```
struct ImportRow {
    line_no: usize,
    product_code: String,
    name: String,
    department_id: i64,
    selling_price: i64,
    cost_price: i64,
    tax_rate: String,
    stock_unit: Option<String>,     // 省略時 "pcs"
    initial_stock: Option<i64>,     // 省略時 0
    jan_code: Option<String>,
    maker_code: Option<String>,
    supplier_id: Option<i64>,
    pos_stock_sync: Option<bool>,   // 省略時 true
}
```

**処理ステップ**:

1. **入力バリデーション**
   - file_bytes が空 → BizError::ValidationFailed("ファイルが空です")
   - この空入力条件はBIZ-01だけが所有する（**BIZ-01-VAL-D1**）

2. **IO-03 呼出し**
   - io::product_csv_importer::parse_product_csv(file_bytes) → ImportParseResult
   - Err → BizError::ImportError(メッセージ)

3. **ヘッダ検証**（必須列の確認）
   - 必須列: "商品コード", "商品名", "部門ID", "売価", "原価", "税率"
   - 不足 → BizError::ImportError("必須列が不足しています: {不足列名}")

4. **各行のバリデーション**
   - 商品コード: 空でないこと
   - 商品名: 空でないこと
   - 部門ID: 整数変換可能、departments に存在すること
   - 売価・原価: 0以上の整数
   - 税率: '10', '8', '0' のいずれか
   - バリデーション失敗 → error_rows に追加

5. **重複チェック**
   - product_code で product_repo::find_by_product_code(conn, code) を検索
   - 既存あり → duplicate_rows に追加
   - 既存なし → valid_rows に追加

5. **結果返却**
   - ImportPreview { valid_rows, error_rows, duplicate_rows }

**エラーハンドリング**:
- IO-03 パース失敗 → BizError::ImportError(メッセージ)
- ヘッダ不足 → BizError::ImportError(メッセージ)
- DB読み取り失敗 → BizError::DatabaseError(DbError)

---

### 4.9 一括インポート: commit_import

**関数要求**: プレビュー済みの正常行と上書き対象行をDBに一括登録する

**シグネチャ**:
```
fn commit_import(
    conn: &mut DbConnection,
    valid_rows: Vec<ImportRow>,
    overwrite_codes: Vec<String>,
) -> Result<ImportResult, BizError>
```

**ImportResult構造体**:
```
struct ImportResult {
    created_count: usize,
    updated_count: usize,
    skipped_count: usize,
}
```

**処理ステップ**:

1. **TX開始**（conn.transaction()）

2. **各行を処理**（TX内で直接 repo 関数を呼ぶ。create_product / update_product の BIZ 関数は内部でTXを開始するため、ネストTX回避のために呼ばない）
   - valid_rows の各行について:
   a. overwrite_codes に product_code が含まれる → product_repo::update_product で直接更新
   b. overwrite_codes に含まれない → product_repo::insert_product で直接INSERT
   c. 新規登録の場合:
      - 4.3 create_product と同等の処理をインライン実行（独自コード発番なし。CSVに product_code が指定済み）
      - plu_target はインライン導出する: `is_discontinued=0 かつ jan_code が 13 桁数字なら 1、それ以外 0`（D-028。migration v3 backfill と同一規則。CSV に plu_target 列は追加しない）
      - initial_stock > 0 → inventory_repo::insert_movement に receiving として記録
      - 進行中の棚卸し → stocktake_repo::insert_stocktake_item に自動追加
   d. 上書き更新の場合: plu_target は変更しない（利用者が UI-01b で設定した値を保持する）

3. **COMMIT**（tx.commit()）

4. **TX外: 操作ログ記録**
   - operation_type: "product_import"
   - summary: "商品一括インポート: 新規{created}件、更新{updated}件"

5. **結果返却**
   - ImportResult { created_count, updated_count, skipped_count }

**エラーハンドリング**:
- TX内でのDB操作失敗 → BizError::DatabaseError（TX自動ロールバック）
- 個別行のバリデーションエラー → preview_import で事前に検出済みのため通常到達しない

---

### 4.10 BizError列挙型（Phase 5 拡張）

```
enum BizError {
    ValidationFailed(String),
    ValidationFailedAt { message: String, field: String },
    NotFound(String),
    DuplicateProductCode(String),
    DatabaseError(DbError),
    ImportError(String),
    IdempotencyConflict(String),
    StocktakeInProgress(String),      // Phase 5 追加: BIZ-06（進行中の棚卸しが存在）
    StocktakeNotInProgress(String),   // Phase 5 追加: BIZ-06（棚卸しが完了済み）
}
```

`ValidationFailedAt` は、業務 validation をBIZ層に一本化したまま
`CmdError.field` を保持する必要がある場合に使う。CMD変換後は
`CmdError { kind: "validation", message, field: Some(field) }` となる。
field を持たない既存 validation は `ValidationFailed(String)` を維持する。

**設計判断 — UncountedItemsExist を設けない理由**: BIZ-06 の complete_stocktake は未入力商品がある場合に `ValidationFailed` を返す（メッセージに件数を含める）。専用バリアントは不要。CMD層は `ValidationFailed` のメッセージ内容でUI表示を分岐できる。
