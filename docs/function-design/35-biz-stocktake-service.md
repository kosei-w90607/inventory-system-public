## 20. BIZ-06: 棚卸しロジック

### 20.1 モジュール構成

```
src-tauri/src/
  biz/
    mod.rs                   -- pub mod stocktake_service を追加
    product_service.rs       -- 既存（BIZ-01）
    inventory_service/       -- 既存（BIZ-02、ディレクトリモジュール）
    csv_import_service.rs    -- 既存（BIZ-03）
    plu_export_service.rs    -- 既存（BIZ-04）
    stocktake_service.rs     -- 棚卸しの業務ロジック（本セクション）
```

単一ファイルで開始。棚卸し確定処理が大きくなった場合のみディレクトリ分割を検討する。

---

### 20.2 型定義

#### StartStocktakeResult構造体

- stocktake_id: i64（生成された棚卸しID）
- item_count: usize（生成された棚卸し明細件数。廃番自動入力分含む）
- auto_filled_count: usize（廃番かつ在庫0で actual_count=0 を自動入力した件数）

#### UpdateCountRequest構造体

- stocktake_item_id: i64
- actual_count: i64（0以上の整数）

#### UpdateCountResult構造体

- success: bool
- current_difference: i64（動的計算: products.stock_quantity - actual_count。正=システム在庫が多い、負=実在庫が多い）

#### CompleteStocktakeRequest構造体

- stocktake_id: i64
- force_fill: bool（true=未入力の商品を「システム在庫と同じ」とみなして自動入力。false=未入力があればエラー）

#### StocktakeResult構造体

- total_cost: i64（仕入原価総額: SUM(valuation_cost_price × actual_count)。税理士報告用）
- adjusted_items: Vec\<AdjustedItem\>（差異があった商品のリスト）
- total_items: usize（棚卸し対象の総商品数）
- integrity_result: Option\<IntegrityResult\>（D-2: 確定後の整合性チェック結果。失敗時はNone）

#### AdjustedItem構造体

- product_code: String
- product_name: String
- system_stock: i64（確定時点のシステム在庫 = products.stock_quantity）
- actual_count: i64（実カウント数）
- difference: i64（system_stock - actual_count。正=過剰、負=不足）
- stock_after: i64（確定後の在庫数 = actual_count）

#### StocktakeProgress構造体

- stocktake_id: i64
- status: String（"in_progress" / "completed"）
- total_items: usize（棚卸し明細の総件数）
- counted_items: usize（actual_count IS NOT NULL の件数）
- uncounted_items: usize（actual_count IS NULL の件数）

#### StocktakeItemWithProduct構造体（棚卸し明細+商品情報。一覧表示用）

- stocktake_item_id: i64
- product_code: String
- product_name: String
- department_name: String
- system_stock: i64（棚卸し開始時のシステム在庫。stocktake_items.system_stock）
- current_stock: i64（現在のシステム在庫。products.stock_quantity。CSV取込み等で変動している可能性あり）
- actual_count: Option\<i64\>（NULLなら未入力）
- counted_at: Option\<String\>（YYYY-MM-DDTHH:MM:SS）

---

### 20.3 start_stocktake

**関数要求**: 新しい棚卸しを開始し、全対象商品の棚卸し明細を自動生成する

**シグネチャ**:
```
fn start_stocktake(
    conn: &mut DbConnection,
) -> Result<StartStocktakeResult, BizError>
```

**処理ステップ**:

1. **進行中チェック**（TX外）
   - stocktake_repo::find_active_stocktake(conn)
   - Some → BizError::StocktakeInProgress("進行中の棚卸しがあります（ID: {id}、開始日: {started_at}）。完了してから新しい棚卸しを開始してください")
2. **対象商品の取得**（TX外）
   - stocktake_repo::find_stocktake_eligible_products(conn) を呼び出し（全商品を返す。IO層ではフィルタなし）
   - 0件 → BizError::ValidationFailed("棚卸し対象の商品がありません")
   - 戻り値: Vec\<ProductForStocktake\> { product_code, stock_quantity, cost_price, is_discontinued }
3. **TX開始**（conn.transaction()。RAII Drop で自動 ROLLBACK）
4. **棚卸しヘッダINSERT**
   - stocktake_repo::insert_stocktake(&tx, now) → stocktake_id
   - started_at = 現在日時、status = "in_progress"
5. **棚卸し明細の一括生成**
   - auto_filled_count = 0
   - 各商品について:
     a. is_discontinued == true かつ stock_quantity == 0 の場合:
        - stocktake_repo::insert_stocktake_item(&tx, &NewStocktakeItem { stocktake_id, product_code, system_stock: 0, actual_count: Some(0) })
        - auto_filled_count += 1
     b. それ以外:
        - stocktake_repo::insert_stocktake_item(&tx, &NewStocktakeItem { stocktake_id, product_code, system_stock: product.stock_quantity, actual_count: None })
6. **COMMIT**（tx.commit()）
7. **TX外: 操作ログ記録**
   - system_repo::insert_operation_log(conn, &NewOperationLog { operation_type: "stocktake_start", summary: "棚卸しを開始しました（対象: {item_count}件）", detail_json: Some(detail_json) })
   - detail_json: { "stocktake_id": stocktake_id, "item_count": item_count, "auto_filled_count": auto_filled_count }
   - 操作ログ記録失敗は警告のみ（業務処理のcommitは完了済み）
8. StartStocktakeResult { stocktake_id, item_count, auto_filled_count } を返す（item_count = 対象商品の件数）

**エラーハンドリング**:
- 進行中の棚卸しが存在 → BizError::StocktakeInProgress
- 対象商品0件 → BizError::ValidationFailed
- DB操作失敗 → RAII自動ROLLBACK → BizError::DatabaseError(DbError)

**設計判断 — 廃番在庫0の自動入力**:
- is_discontinued=1 かつ stock_quantity=0 の商品は、棚に存在しないことが確実（廃番で在庫ゼロ）。カウント入力の手間を省くため、actual_count=0 を自動入力する
- is_discontinued=1 かつ stock_quantity>0 の商品は対象に含める（棚に残っている可能性があるためカウント必要）

**設計判断 — 明細一括生成のパフォーマンス**:
- 最大4000件の INSERT を1TX内で実行する。SQLite の WAL モード + 単一接続で十分高速（数百ms以内）
- 一括INSERT文（VALUES多値）は SQLite の SQL長制限とデバッグ困難性のため不採用。1件ずつ insert_stocktake_item を呼ぶ方式

**入力例**: なし（引数なし）

**出力例**:
```
Ok(StartStocktakeResult {
    stocktake_id: 1,
    item_count: 3847,
    auto_filled_count: 23,
})
```

---

### 20.4 update_count

**関数要求**: 棚卸し明細の実カウント数を1件更新する。中断・再開に対応するため1件ずつ即保存

**シグネチャ**:
```
fn update_count(
    conn: &DbConnection,
    req: UpdateCountRequest,
) -> Result<UpdateCountResult, BizError>
```

**前提条件**: トランザクション不要。1件のUPDATEのみで、複数テーブルに跨がらない。autocommit で実行する

**処理ステップ**:

1. **入力バリデーション**
   - req.actual_count < 0 → BizError::ValidationFailed("カウント数は0以上で入力してください")
2. **棚卸し明細の存在確認と親棚卸しの状態チェック**
   - stocktake_repo::find_stocktake_item_with_parent_status(conn, req.stocktake_item_id) → Option\<(StocktakeItem, String)\>（明細 + 親stocktakes.status）
   - None → BizError::NotFound("棚卸し明細が見つかりません: ID {stocktake_item_id}")
   - status != "in_progress" → BizError::StocktakeNotInProgress("この棚卸しは既に完了しています")
3. **actual_count の更新**
   - stocktake_repo::update_stocktake_item_count(conn, req.stocktake_item_id, req.actual_count, now)
   - counted_at = 現在日時
4. **動的差異の計算**
   - product_repo::find_by_product_code(conn, &item.product_code) → product
   - None → BizError::NotFound（通常はFK制約で起きないが安全策）
   - current_difference = product.stock_quantity - req.actual_count
5. UpdateCountResult { success: true, current_difference } を返す

**エラーハンドリング**:
- actual_count < 0 → BizError::ValidationFailed
- 明細が見つからない → BizError::NotFound
- 棚卸しが完了済み → BizError::StocktakeNotInProgress
- 商品が見つからない → BizError::NotFound
- DB更新失敗 → BizError::DatabaseError(DbError)

**設計判断 — 差異の動的計算**:
- architecture/biz-task-specs.md BIZ-06「棚卸し中もCSV取込みで在庫が動くため」（SP-205-09修正）に基づき、差異は stocktake_items.system_stock ではなく現在の products.stock_quantity を使って動的に計算する
- system_stock は「開始時点の参考値」として記録するのみ。差異表示に使うのは常に最新の stock_quantity

**設計判断 — 操作ログなし**:
- カウント入力は1件ずつ頻繁に行われる操作（4000件の商品を順次カウント）。毎回 operation_log を記録すると大量のログが生成され、有用な操作ログが埋もれる。棚卸しの開始と確定のみ記録する

**入力例**:
```
UpdateCountRequest { stocktake_item_id: 42, actual_count: 8 }
```

**出力例**:
```
Ok(UpdateCountResult {
    success: true,
    current_difference: 2,  // システム在庫10 - 実カウント8 = 2（システムの方が2個多い）
})
```

---

### 20.5 complete_stocktake

**関数要求**: 棚卸しを確定する。全商品の評価原価を記録し、差異がある商品の在庫を補正し、仕入原価総額を算出する

**シグネチャ**:
```
fn complete_stocktake(
    conn: &mut DbConnection,
    req: CompleteStocktakeRequest,
) -> Result<StocktakeResult, BizError>
```

**処理ステップ**:

1. **棚卸しの存在確認と状態チェック**（TX外）
   - stocktake_repo::find_stocktake_by_id(conn, req.stocktake_id)
   - None → BizError::NotFound("棚卸しが見つかりません: ID {stocktake_id}")
   - status != "in_progress" → BizError::StocktakeNotInProgress("この棚卸しは既に完了しています")
2. **未入力チェック**（TX外）
   - stocktake_repo::count_uncounted_items(conn, req.stocktake_id) → uncounted_count
   - uncounted_count > 0 かつ req.force_fill == false → BizError::ValidationFailed("未入力の商品が{uncounted_count}件あります。全商品のカウントを完了するか、force_fill=true で未入力をシステム在庫と同じとみなしてください")
   - uncounted_count > 0 かつ req.force_fill == true → ステップ3で自動入力
3. **TX開始**（conn.transaction()。RAII Drop で自動 ROLLBACK）
3a. **force_fill: 未入力の自動補完**（force_fill == true かつ uncounted_count > 0 の場合のみ）
   - stocktake_repo::list_uncounted_items(&tx, req.stocktake_id) → Vec\<UncountedItem\> { stocktake_item_id, product_code }
   - 各未入力明細について:
     - product_repo::find_by_product_code(&tx, &product_code) → product
     - stocktake_repo::update_stocktake_item_count(&tx, stocktake_item_id, product.stock_quantity, now)
     - ※ 現在のシステム在庫をそのまま actual_count にセット（差異なし扱い）
4. **全棚卸し明細の取得**
   - stocktake_repo::get_stocktake_items_for_complete(&tx, req.stocktake_id) → Vec\<StocktakeItemForComplete\>
   - StocktakeItemForComplete: { id, product_code, actual_count }
   - actual_count が NULL の行は存在しないはず（ステップ2またはステップ3aで保証）
5. **各明細の処理**（adjusted_items, total_cost を蓄積）
   - let mut total_cost: i64 = 0
   - let mut adjusted_items: Vec\<AdjustedItem\> = Vec::new()
   - 各 stocktake_item について:
     a. product_repo::find_by_product_code(&tx, &item.product_code) → product
        - None → BizError::NotFound（FK制約で通常起きないが安全策。INV-8: products物理DELETE禁止により理論上不到達）
     b. let actual_count = item.actual_count（ステップ2/3aで NULL なしを保証済み）
     c. let valuation_cost_price = product.cost_price
     d. stocktake_repo::update_stocktake_item_valuation(&tx, item.id, valuation_cost_price)
     e. total_cost += valuation_cost_price * actual_count
        - ※ オーバーフロー検査: checked_mul + checked_add。overflow → BizError::ValidationFailed("仕入原価総額の計算でオーバーフローが発生しました")
     f. let difference = product.stock_quantity - actual_count
     g. difference != 0 の場合:
        - let adjustment_quantity = actual_count - product.stock_quantity（在庫視点: 正=増加、負=減少）
        - inventory_repo::update_stock_quantity(&tx, &item.product_code, actual_count)
        - inventory_repo::insert_movement(&tx, &NewMovement { product_code: item.product_code, movement_type: MovementType::Stocktake, quantity: adjustment_quantity, stock_after: actual_count, reference_type: Some(ReferenceType::Stocktake), reference_id: Some(req.stocktake_id), note: Some(format!("棚卸し補正: システム在庫{} → 実カウント{}", product.stock_quantity, actual_count)) })
        - adjusted_items.push(AdjustedItem { product_code: item.product_code, product_name: product.name, system_stock: product.stock_quantity, actual_count, difference, stock_after: actual_count })
6. **棚卸しヘッダの確定**
   - stocktake_repo::complete_stocktake(&tx, req.stocktake_id, total_cost, now)
   - status = "completed", completed_at = 現在日時
7. **COMMIT**（tx.commit()）
8. **TX外: 操作ログ記録**
   - system_repo::insert_operation_log(conn, &NewOperationLog { operation_type: "stocktake_complete", summary: "棚卸しを確定しました（差異: {adjusted_count}件、仕入原価総額: ¥{total_cost}）", detail_json: Some(detail_json) })
   - detail_json: { "stocktake_id": req.stocktake_id, "total_cost": total_cost, "total_items": all_items.len(), "adjusted_count": adjusted_items.len(), "force_fill_used": req.force_fill && uncounted_count > 0 }
   - 操作ログ記録失敗は警告のみ（業務処理のcommitは完了済み）
9. **TX外: 整合性チェック自動実行（D-2統合）**
   - integrity_service::run_integrity_check(conn) を呼出し
   - 成功 → integrity_result = Some(result)
   - 失敗 → integrity_result = None + eprintln! 警告（整合性チェック失敗で棚卸し確定をロールバックしない）
10. StocktakeResult { total_cost, adjusted_items, total_items: all_items.len(), integrity_result } を返す

**TX境界**: ステップ3〜7が1TX。操作ログ記録（ステップ8）・整合性チェック（ステップ9）はTX外。

**設計判断 — operation_log TX外（architecture/biz-task-specs.md との差異）**: architecture/biz-task-specs.md BIZ-06「棚卸し確定」は operation_log をTX内に記載しているが、第4段階の先決事項D-6「operation_log TX境界: 全てTX外」を BIZ-05/06/07 でも継承する。理由: ログ記録失敗で業務TXがロールバックするのは過剰。BIZ-03/BIZ-04 と同じ方針。例外: BIZ-07 の fix_integrity のみ D-6 の明示例外として操作ログをTX内必須とする（movement を残さないため操作ログが唯一の監査痕跡になる — BIZ-07-D3 / [D-051](../decision-log.md)、36-biz-integrity-check.md §21.4）。run_integrity_check 側は D-6 継承のまま。BIZ-06 自身のTX外方針は不変。

**エラーハンドリング**:
- 棚卸しが見つからない → BizError::NotFound
- 棚卸しが完了済み → BizError::StocktakeNotInProgress
- 未入力ありかつforce_fill=false → BizError::ValidationFailed
- 商品が見つからない（FK違反の異常事態）→ BizError::NotFound
- 仕入原価総額オーバーフロー → BizError::ValidationFailed
- DB操作失敗 → RAII自動ROLLBACK → BizError::DatabaseError(DbError)

**設計判断 — apply_stock_change を使わない理由**:
- 棚卸し確定は「差異補正」であり、通常の在庫変動（入庫/出庫/販売）とは性質が異なる。apply_stock_change は find_by_product_code → stock計算 → update_stock_quantity → insert_movement の4ステップを内部で実行するが、complete_stocktake では既に product を取得済み（ステップ5a）であり、stock_after も actual_count として確定済み。apply_stock_change を使うと同じ商品を2回 find_by_product_code する無駄が生じる
- また、棚卸し補正の stock_after は「actual_count そのもの」であり、「現在在庫 + 変動量」の計算ではない。apply_stock_change の stock_after 算出ロジック（INV-2）とは意味が異なる
- よって、inventory_repo::update_stock_quantity + inventory_repo::insert_movement を直接呼び出す

**設計判断 — total_cost のオーバーフロー対策**:
- worst case: 4000商品 × 原価999,999円 × 在庫9,999個 = 約40兆。i64の上限（約9.2 × 10^18）に収まるが、万一の不正データに備えて checked_mul / checked_add で検査する
- 実運用では原価平均500円 × 在庫平均20個 × 4000商品 = 4,000万円程度（i64で余裕）

**設計判断 — force_fill パラメータ**:
- 年末棚卸しは10月〜大晦日の長期作業。全4000商品のカウントが現実的に完了しない場合がある（特に端切れ布やボタンの小物）
- force_fill=true で「未入力の商品は現在のシステム在庫をそのまま確定」を許可する。差異なしとして処理されるため、カウント漏れがあっても棚卸しを完了できる
- force_fill=false がデフォルト（CMD層が渡す）。UI-10の確定ボタンで未入力がある場合に確認ダイアログを表示し、利用者が「未入力をシステム在庫と同じとみなす」を選択した場合のみ force_fill=true で再呼出し

**設計判断 — valuation_cost_price のタイミング**:
- 確定時の products.cost_price を使用する。棚卸し開始時ではない。理由: 棚卸しは数ヶ月に及ぶ長期作業であり、その間に原価が変わることがある。税理士報告用の仕入原価総額は「確定時点の原価」が正しい
- DB_DESIGN.md に「確定時にproducts.cost_priceの値をコピーしてくる」と明記済み

**入力例**:
```
CompleteStocktakeRequest { stocktake_id: 1, force_fill: false }
```

**出力例**:
```
Ok(StocktakeResult {
    total_cost: 42350000,  // ¥42,350,000
    adjusted_items: [
        AdjustedItem {
            product_code: "4976383262108",
            product_name: "ﾊﾏﾅｶ ｱﾐｱﾐ極太 col.42",
            system_stock: 15,
            actual_count: 12,
            difference: 3,
            stock_after: 12,
        },
        AdjustedItem {
            product_code: "HZ-0012",
            product_name: "ヘアゴム ブラック M",
            system_stock: 5,
            actual_count: 7,
            difference: -2,
            stock_after: 7,
        },
    ],
    total_items: 3847,
})
```

---

### 20.6 get_stocktake_progress

**関数要求**: 現在の棚卸しの進捗状況を返す。棚卸し画面の進捗バー表示用

**シグネチャ**:
```
fn get_stocktake_progress(
    conn: &DbConnection,
    stocktake_id: i64,
) -> Result<StocktakeProgress, BizError>
```

**処理ステップ**:

1. **棚卸しの存在確認**
   - stocktake_repo::find_stocktake_by_id(conn, stocktake_id)
   - None → BizError::NotFound("棚卸しが見つかりません: ID {stocktake_id}")
2. **進捗集計**
   - stocktake_repo::get_stocktake_progress(conn, stocktake_id) → StocktakeProgress { total_items, counted_items, uncounted_items }
3. StocktakeProgress { stocktake_id, total_items, counted_items, uncounted_items } を返す（status は stocktake から取得して付与）

**エラーハンドリング**:
- 棚卸しが見つからない → BizError::NotFound
- DB読み取り失敗 → BizError::DatabaseError(DbError)

---

### 20.7 非目的

このモジュールが**やらないこと**を明示する。責務境界の誤解を防ぐため。

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| 棚卸し中のCSV取込み処理 | 棚卸し中もCSV取込みは許可（SP-205-09）。差異は動的計算で吸収 | BIZ-03 |
| 棚卸し中の新規商品登録時のstocktake_items自動追加 | 商品登録のTX内で実施済み | BIZ-01（create_product ステップ6） |
| 整合性チェック（stock_quantity突合） | 棚卸し確定後の自動実行は第5段階で統合 | BIZ-07（PR-5で実装） |
| 棚卸し画面の表示・フィルタ・ページング | UI層の責務 | UI-10 |
| 物理DELETE | 棚卸しの削除はサポートしない。completedのまま保持 | — |
| 棚卸しの「中止」（途中破棄） | 初期バージョンでは不要。中断→再開で対応 | 将来拡張 |
| 操作ログのカウント入力ごとの記録 | 頻度が高すぎて有用なログが埋もれる | — |
| 棚卸し明細の一覧取得の業務ルール | 一覧取得はBIZ層の `get_stocktake_items` が `stocktake_repo::list_stocktake_items` + 進捗集計を束ねる薄いwrapperとして提供（2026-04-13 `882cec6` でCMD直ラップからBIZ経由に変更、[42-cmd-sales-stocktake.md](42-cmd-sales-stocktake.md) §22.5 参照）。フィルタ・ページングの実体はIO層 | BIZ-06 wrapper + stocktake_repo |

---

### 20.8 対応不変条件

| 不変条件 | 本モジュールでの対応 |
|---------|-----------------|
| INV-2: stock_after算出責任 | complete_stocktake のステップ5g で stock_after = actual_count を直接使用。通常の「stock_quantity + quantity」計算ではなく、actual_count が確定的な stock_after となる。insert_movement に渡す stock_after は actual_count そのもの |
| INV-3: 負在庫ポリシー | complete_stocktake では actual_count が利用者入力のため、0以上が保証される（update_count のバリデーション）。棚卸し補正で stock_after < 0 にはならない |
| INV-8: products物理DELETE禁止 | 本モジュールは products を UPDATE のみ（stock_quantity）。DELETE 操作なし。find_stocktake_eligible_products は is_discontinued フラグで絞り込む |
| INV-1a: 入力値は常に正数 | update_count で actual_count >= 0 を検証。complete_stocktake の adjustment_quantity は正負どちらもあり得る（棚卸し補正は INV-1a の対象外。INV-1a は Request 構造体の quantity フィールドに適用され、棚卸し補正の adjustment_quantity はBIZ層内部で算出される値） |

---

### 20.9 stocktake_repo への依存（新規関数）

BIZ-06 が使用するIO関数のうち、既存の find_active_stocktake / insert_stocktake_item 以外に必要な新規関数:

| 関数 | 用途 | シグネチャ |
|------|------|---------|
| insert_stocktake | 棚卸しヘッダINSERT | `fn insert_stocktake(conn: &DbConnection, started_at: &str) -> Result<i64, DbError>` |
| find_stocktake_by_id | 棚卸しIDで取得 | `fn find_stocktake_by_id(conn: &DbConnection, id: i64) -> Result<Option<Stocktake>, DbError>` |
| find_stocktake_eligible_products | 棚卸し対象商品の取得 | `fn find_stocktake_eligible_products(conn: &DbConnection) -> Result<Vec<ProductForStocktake>, DbError>` |
| find_stocktake_item_with_parent_status | 明細+親ステータス取得 | `fn find_stocktake_item_with_parent_status(conn: &DbConnection, item_id: i64) -> Result<Option<(StocktakeItem, String)>, DbError>` |
| update_stocktake_item_count | カウント更新 | `fn update_stocktake_item_count(conn: &DbConnection, item_id: i64, actual_count: i64, counted_at: &str) -> Result<bool, DbError>` |
| count_uncounted_items | 未入力件数 | `fn count_uncounted_items(conn: &DbConnection, stocktake_id: i64) -> Result<i64, DbError>` |
| get_stocktake_progress | 進捗集計 | `fn get_stocktake_progress(conn: &DbConnection, stocktake_id: i64) -> Result<StocktakeProgress, DbError>` |
| list_uncounted_items | 未入力明細の一覧 | `fn list_uncounted_items(conn: &DbConnection, stocktake_id: i64) -> Result<Vec<UncountedItem>, DbError>` |
| get_stocktake_items_for_complete | 全明細取得（確定用） | `fn get_stocktake_items_for_complete(conn: &DbConnection, stocktake_id: i64) -> Result<Vec<StocktakeItemForComplete>, DbError>` |
| update_stocktake_item_valuation | 評価原価記録 | `fn update_stocktake_item_valuation(conn: &DbConnection, item_id: i64, valuation_cost_price: i64) -> Result<(), DbError>` |
| complete_stocktake | ヘッダ確定更新 | `fn complete_stocktake(conn: &DbConnection, stocktake_id: i64, total_cost: i64, completed_at: &str) -> Result<(), DbError>` |

**ProductForStocktake構造体**: product_code: String, stock_quantity: i64, cost_price: i64, is_discontinued: bool

**StocktakeItem構造体**: id: i64, stocktake_id: i64, product_code: String, system_stock: i64, actual_count: Option\<i64\>, counted_at: Option\<String\>

**UncountedItem構造体**: stocktake_item_id: i64, product_code: String

**StocktakeItemForComplete構造体**: id: i64, product_code: String, actual_count: i64（force_fill後はNULLなしを保証。i64で直接取得）

---

### 20.10 BizError 追加バリアント

BIZ-06 で新たに使用する BizError バリアント:

```
enum BizError {
    ValidationFailed(String),     // 既存
    NotFound(String),             // 既存 — 棚卸し/明細/商品の不存在
    DuplicateProductCode(String), // 既存（本モジュールでは不使用）
    DatabaseError(DbError),       // 既存
    ImportError(String),          // 既存（本モジュールでは不使用）
    IdempotencyConflict(String),  // 既存（本モジュールでは不使用）
    StocktakeInProgress(String),  // ← 新規追加: 進行中の棚卸しが既に存在
    StocktakeNotInProgress(String), // ← 新規追加: 棚卸しが既に完了済み
}
```

**StocktakeInProgress**: start_stocktake で進行中チェック失敗時。CMD層では CmdError { kind: "stocktake_in_progress" } に変換

**StocktakeNotInProgress**: update_count / complete_stocktake で完了済み棚卸しへの操作時。CMD層では CmdError { kind: "stocktake_not_in_progress" } に変換

---

### 更新履歴

| 日付 | PR | 内容 |
|------|-----|------|
| 2026-04-12 | PR #21 | 初版作成（BIZ-06 stocktake_service 4関数 + stocktake_repo 12関数） |
| 2026-04-12 | PR #21 | StocktakeItemForComplete を 5フィールド（IO設計書版）→ 3フィールド（id/product_code/actual_count）に統一。BIZ設計書を採用した理由: complete_stocktake の処理ステップ5で必要なのは更新対象IDと商品コードと実カウントのみで、system_stock や counted_at は product_repo::find_by_product_code から取得する方が責務分離として正しい |
