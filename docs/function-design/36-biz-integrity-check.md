## 21. BIZ-07: 整合性チェックロジック

### 21.1 モジュール構成

```
src-tauri/src/
  biz/
    integrity_service.rs  -- 在庫整合性チェック・補正
```

### 21.2 型定義

**IntegrityResult構造体**:

```
struct IntegrityResult {
    mismatches: Vec<IntegrityMismatch>,  // 不整合商品リスト
    mismatch_count: usize,              // 不整合件数
    checked_count: usize,               // チェック対象商品数
}
```

**IntegrityMismatch構造体**:

```
struct IntegrityMismatch {
    product_code: String,
    name: String,
    stock_quantity: i64,    // products.stock_quantity（現在のキャッシュ値）
    movements_sum: i64,     // SUM(inventory_movements.quantity WHERE is_voided=0)
    difference: i64,        // stock_quantity - movements_sum
}
```

**IntegrityFixResult構造体**:

```
struct IntegrityFixResult {
    fixed_count: usize,             // 補正した商品数
    skipped_count: usize,           // 不整合なし（補正不要）でスキップした商品数
    adjustments: Vec<StockAdjustment>, // 補正内容の詳細
}
```

**StockAdjustment構造体**:

```
struct StockAdjustment {
    product_code: String,
    old_stock: i64,         // 補正前の stock_quantity
    new_stock: i64,         // 補正後の stock_quantity（= movements_sum）
    adjustment: i64,        // new_stock - old_stock
}
```

---

### 21.3 run_integrity_check

**関数要求**: 全商品の products.stock_quantity と inventory_movements の集計値を突合し、不整合を検出する。読み取り専用で、データの変更は行わない

**シグネチャ**:
```
fn run_integrity_check(conn: &DbConnection) -> Result<IntegrityResult, BizError>
```

**前提条件**:
- conn は &DbConnection（autocommit）。読み取り専用クエリのためTX不要
- inventory_movements は全商品の完全な在庫変動履歴を持つ（INV-6 前提。初期在庫投入も movement_type='receiving' で記録済み）

**処理ステップ**:

1. **全商品の movements 集計を取得**
   - inventory_repo::sum_movements_by_product(conn) → Vec<ProductMovementSum>
   - SQL: SELECT product_code, SUM(quantity) as movements_sum FROM inventory_movements WHERE is_voided = 0 GROUP BY product_code
   - 結果を HashMap<product_code, movements_sum> に変換

2. **全商品の現在在庫を取得**
   - product_repo::find_all_stock_quantities(conn) → Vec<(product_code, name, stock_quantity)>
   - SQL: SELECT product_code, name, stock_quantity FROM products

3. **突合**
   - 各商品について:
     - movements_sum = HashMap から取得（存在しない場合は 0。inventory_movements に1行もない商品）
     - difference = stock_quantity - movements_sum
     - difference ≠ 0 → mismatches に追加

4. **結果返却**
   - IntegrityResult { mismatches, mismatch_count: mismatches.len(), checked_count: 全商品数 }

5. **TX外: 操作ログ記録**
   - system_repo::insert_operation_log(conn, &NewOperationLog { operation_type: "integrity_check", summary: "整合性チェック実行: {checked_count}件中{mismatch_count}件の不整合", detail_json: Some(不整合リストのJSON) })

**エラーハンドリング**:
- DB読み取り失敗 → BizError::DatabaseError(DbError)

**設計判断 — inventory_movements が 0 件の商品**:
- movements_sum = 0 として扱う
- stock_quantity = 0 なら不整合なし。stock_quantity ≠ 0 なら不整合（初期投入が漏れている可能性）
- architecture/biz-task-specs.md BIZ-07「前提条件」: 「初期投入漏れや pos_stock_sync=0 の商品でも、inventory_movements に記録がある限りチェックは有効」

**設計判断 — 全商品一括チェック**:
- 4000商品 × movements集計: SQLiteの GROUP BY で十分高速（インデックス済み）
- 商品別に1クエリずつ発行する方式は非効率。一括GROUP BYを使用

---

### 21.4 fix_integrity

**関数要求**: 指定された商品の stock_quantity を movements_sum に合わせて補正する。棚卸し補正と同じ方式（movement_type='stocktake'）で inventory_movements に補正レコードを追加する

**シグネチャ**:
```
fn fix_integrity(
    conn: &mut DbConnection,
    product_codes: &[String],
) -> Result<IntegrityFixResult, BizError>
```

**前提条件**:
- conn は &mut DbConnection（TX制御）
- 利用者が run_integrity_check の結果を確認し、補正対象を選択した後に呼ばれる
- 自動実行しない。必ず利用者確認を挟む（architecture/biz-task-specs.md BIZ-07「制御構造」）

**処理ステップ**:

1. **入力バリデーション**
   - product_codes が空 → BizError::ValidationFailed("補正対象の商品が指定されていません")

2. **TX開始**（conn.transaction()）

3. **各商品について補正**
   - product_codes の各 product_code について:
   a. movements_sum を取得: SELECT COALESCE(SUM(quantity), 0) FROM inventory_movements WHERE product_code = ? AND is_voided = 0
      - inventory_movements に1行もない商品 → SUM が NULL → COALESCE で 0 に補完
   b. 現在の stock_quantity を取得: product_repo::find_by_product_code(conn, product_code)
      - 商品が存在しない → スキップ（skipped_count++）
   c. difference = stock_quantity - movements_sum
   d. difference == 0 → 不整合なし、スキップ（skipped_count++）
   e. difference ≠ 0 → 補正実行:
      - adjustment = movements_sum - stock_quantity（movements_sum に合わせる方向）
      - inventory_repo::insert_movement(conn, &NewMovement { product_code, movement_type: "stocktake", quantity: adjustment, stock_after: movements_sum, reference_type: "stocktake", reference_id: 0, note: Some("整合性チェックによる自動補正") })
      - inventory_repo::update_stock_quantity(conn, product_code, movements_sum)
      - adjustments に追加

4. **COMMIT**（tx.commit()）

5. **TX外: 操作ログ記録**
   - system_repo::insert_operation_log(conn, &NewOperationLog { operation_type: "integrity_fix", summary: "{fixed_count}件の在庫を補正しました", detail_json: Some(補正内容のJSON) })
   - ログ記録失敗は警告のみ（先決事項D-6）

6. **結果返却**
   - IntegrityFixResult { fixed_count, skipped_count, adjustments }

**エラーハンドリング**:
- 補正対象なし → BizError::ValidationFailed(メッセージ)
- DB更新失敗 → BizError::DatabaseError(DbError)（TX自動ロールバック）

**設計判断 — reference_id=0 の理由（先決事項D-3）**:
- 整合性チェックによる補正は「仮想棚卸し」として扱う
- 実際の stocktakes レコードは作成しない（棚卸し画面を経由していないため）
- reference_type='stocktake', reference_id=0 で「整合性補正」であることを識別
- DB_DESIGN.md の reference_type CHECK制約（'stocktake' は許容値）に適合
- note フィールドで「整合性チェックによる自動補正」と明記

**設計判断 — movements_sum に合わせる方向**:
- architecture/biz-task-specs.md BIZ-07「処理構造」ステップ5: 「products.stock_quantity を movements_sum に合わせる」
- 理由: inventory_movements は個々の操作ごとに記録されており、stock_quantity は派生値（キャッシュ）。原本は movements 側

---

### 21.5 非目的

このモジュールが**やらないこと**を明示する。責務境界の誤解を防ぐため。

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| 棚卸し確定時の自動トリガー | PR-5 で BIZ-06 に統合（先決事項D-2） | BIZ-06 complete_stocktake |
| CSV取込み完了時の自動トリガー | UI層から CMD 経由で呼び出し（先決事項D-2） | CMD-11 / UI |
| 自動補正（利用者確認なし） | 危険。必ず確認を挟む | — |
| inventory_movements の物理DELETE | 論理無効化のみ（INV-4） | — |
| products の物理DELETE | INV-8 禁止 | — |

### 21.6 対応不変条件

| 不変条件 | 本モジュールでの対応 |
|---------|-----------------|
| INV-2: stock_after算出責任 | fix_integrity のステップ3e で stock_after = movements_sum を計算。apply_stock_change は経由せず直接設定（補正は通常の在庫変動と異なり、movements_sum への強制合わせ） |
| INV-3: 負在庫ポリシー | movements_sum がマイナスになる場合でも補正を実行（movements の合計が真値） |
| INV-4: is_voided の使用範囲 | SUM 計算で WHERE is_voided = 0 を使用。fix_integrity は is_voided を操作しない |
| INV-8: products物理DELETE禁止 | stock_quantity の更新のみ。DELETE なし |
