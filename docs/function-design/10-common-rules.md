## 在庫ドメイン不変条件

在庫関連処理で共通して遵守するルール。

**INV-1: quantity符号規約**
- inventory_movements.quantity は在庫視点（+増加/-減少）
- sale_records.quantity は売上帳票視点（+販売/-返品）
- SUM計算が自然になるよう、テーブルの目的に合わせた符号にする

**INV-1a: 入力値は常に正数**
- 全ての Request 構造体の quantity フィールドは正の整数のみ受け付ける（quantity <= 0 → BizError::ValidationFailed）
- 符号変換は BIZ 層の各業務関数内でのみ実施する:
  - create_receiving: apply_stock_change に +quantity
  - create_return (direction=in): +quantity
  - create_return (direction=out): -quantity
  - create_manual_sale: -quantity
  - create_disposal: -quantity
- IO層は符号変換を行わない。BIZ層から渡された値をそのまま記録する

**INV-2: stock_after算出責任**
- BIZ-02の共通在庫変動関数 (apply_stock_change) が `products.stock_quantity + quantity` を計算する
- IO層（inventory_repo::insert_movement）は渡された stock_after をそのまま記録する

**INV-3: 負在庫ポリシー**
- stock_after < 0 の場合は警告フラグをセットするが、処理は続行する
- 理由: 小規模店舗では入庫記録の遅延で一時的にマイナスになることがある。エラーにすると業務が止まる

**INV-4: is_voided の使用範囲**
- is_voided フラグは CSV 取込みロールバック時（BIZ-03）のみ使用する
- BIZ-02 では is_voided を操作しない。insert_movement は常に is_voided=0 で挿入する

**INV-5: 冪等性**
- 各ヘッダテーブルに idempotency_key (TEXT NOT NULL UNIQUE) と request_fingerprint (TEXT NOT NULL) を持つ
- CMD層がUUID v4でidempotency_keyを生成しBIZ層に渡す
- BIZ層がリクエスト内容からrequest_fingerprintを計算する
- idempotency_key重複時:
  - request_fingerprint一致 → 冪等な再送成功（既存レコードのIDを返す）
  - request_fingerprint不一致 → BizError::IdempotencyConflict
- 予約プレフィックス `__legacy__:` はマイグレーション時のバックフィル用。UUIDと衝突しない

**INV-6: CSV取込みの自然冪等性（file_hash方式）**
- csv_importsテーブルはINV-5のidempotency_key/request_fingerprintパターンを使わない
- file_hash（SHA-256、生バイト列＝デコード前のrawバイトから算出、hex小文字64文字）が自然な重複検知キー
- 重複判定: `file_hash一致 + status IN ('completed','completed_partial')` → ブロック
- ロールバック後（status='rolled_back'）の再取込みは許可
- settlement_date一致 + 別file_hash → 上書き確認（旧レコードをロールバック後に再取込み）
- スコープ: 単一店舗（1DB）
- 改行コード差異（CRLF/LF）は別hashとなるが、これは仕様として許容。同一内容でも改行コードが違えば別ファイル扱い
- file_hashにUNIQUE制約なし（DB_DESIGN.md確定済み: ロールバック後に同一hashが2行できるため）。競合防止はcommit TX内でのcheck-then-insertで対応
- **前提: SQLite単一接続（1人運用デスクトップ）**。マルチ接続化する場合は UNIQUE(file_hash) の条件付き再導入またはアプリ層排他ロックが必須

**INV-7: csv_import参照のinventory_movements制約**
- reference_type='csv_import' のinventory_movementsは、movement_type='sale_auto' のみ
- BIZ-03のcommit_csv_importが生成し、rollback_csv_importがvoidする
- void_movements_by_reference は reference_type + reference_id のみで絞り込む（movement_type条件は冗長のため付与しない。この不変条件が安全性の根拠）

**INV-8: products物理DELETE禁止**
- productsテーブルの行を物理DELETEしない。廃番管理は is_discontinued フラグ（論理削除）のみ
- 理由: inventory_movements, sale_records, receiving_items, return_items, disposal_items, manual_sale_items, stocktake_items, price_history の8テーブルがFK参照しており、物理削除は整合性を破綻させる

---

## 共通型定義

### DbError列挙型

```
enum DbError {
    ConnectionFailed(String),
    PragmaFailed(String),
    MigrationFailed(String),
    QueryFailed(String),
    DuplicateKey(String),
    ForeignKeyViolation(String),
    NotFound,
}
```

### PaginatedResult構造体

```
struct PaginatedResult<T> {
    items: Vec<T>,
    total_count: u32,
    page: u32,
    per_page: u32,  // 実際に適用された1ページ件数。上限挙動は各一覧APIの契約に従う
}
```

Pagination upper-bound policy is intentionally module-specific. D-031 introduced the real shared `PAGINATION_MAX_PER_PAGE = 200` constant for IO-layer clamps: `search_products`, stocktake item lists, and system log lists clamp to 200 and return the clamped value in `PaginatedResult.per_page`. Inventory movement / record BIZ lists keep the existing `MAX_PER_PAGE = 100` reject contract, and sales import history lists also keep their existing 100 reject behavior.
