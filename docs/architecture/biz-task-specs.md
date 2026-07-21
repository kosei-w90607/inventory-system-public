# タスク仕様（BIZ層）

> **親文書**: [ARCHITECTURE.md](../ARCHITECTURE.md)
> **入力ドキュメント**: `docs/spec/requirements.md`、`docs/spec/requirements-coverage.md`、DB_DESIGN.md（テーブル定義書）

---

### BIZ-01: 商品管理ロジック

**タスク要求**: 商品マスタの登録・修正・廃番管理・独自コード発番・売価変更履歴記録・一括インポートの業務ロジックを提供する

**理由**: 商品マスタはシステムの中心であり、入出庫・CSV取込み・棚卸し・売上レポートの全てがproductsテーブルを参照する。商品データの整合性を保つルールをBIZ層に集約することで、CMD層やUI層から直接DB操作する事故を防ぐ

**【データ構造】**

入力データ:
- 商品登録: product_code（JANまたは自動発番）, name, department_id, selling_price, cost_price, tax_rate, stock_unit, 初期在庫数, jan_code（任意）, maker_code（任意）, supplier_id（任意）
- 商品修正: product_code（変更不可）, 変更対象フィールド群
- 廃番切替: product_code, is_discontinued
- 一括インポート: CSVファイルバイト列

出力データ:
- 登録結果: 生成されたproduct_code（独自コード発番時）、成功/失敗
- 検索結果: 商品一覧（ページング対応）、在庫数・売価・原価含む
- 一括インポート結果: プレビューデータ（正常行/エラー行/重複行）、取込み結果サマリ

内部で扱うテーブル: products, departments, suppliers, price_history, inventory_movements, stocktake_items, operation_logs

**【処理構造】**

**商品新規登録:**
1. product_codeの決定
   - JANコード入力あり → product_codeとjan_codeの両方に同じ値をセット
   - JANコード入力なし → departmentsのcode_prefix + next_seqで自動発番（例: HZ-0047）。発番後にnext_seq+1
   - product_codeの重複チェック（既存商品との衝突確認）
2. 入力バリデーション
   - name: 必須、空文字不可
   - department_id: departmentsに存在すること
   - selling_price, cost_price: 0以上の整数
   - tax_rate: '10', '8', '0'のいずれか
   - stock_unit: 'pcs', 'cm'のいずれか
3. トランザクション内で実行
   - productsにINSERT（plu_dirty=1, plu_exported_at=NULL, pos_stock_sync=デフォルト1。利用者が商品登録画面で明示的にOFFにできる。stock_unit='cm'の場合は初期値0を提案するがUIで変更可能）
   - 初期在庫 > 0 の場合 → inventory_movementsにINSERT（movement_type='receiving', quantity=初期在庫, stock_after=初期在庫）
   - 進行中の棚卸し（stocktakes.status='in_progress'）があれば → stocktake_itemsに自動追加（actual_count=NULL）
   - operation_logsに記録（operation_type='product_create'）

**商品修正:**
1. product_codeで既存商品を取得（存在しなければエラー）
2. 入力バリデーション（登録時と同じルール）
3. 売価または原価が変わる場合 → price_historyにINSERT（old/new両方記録）
4. 売価が変わる場合 → plu_dirty=1にセット
5. productsをUPDATE（updated_at更新）
6. operation_logsに記録（operation_type='product_update', detail_jsonに変更前後）

**廃番切替:**
1. product_codeで既存商品を取得
2. is_discontinuedを反転
3. plu_dirty=1にセット（レジのPLUからも除外/復帰が必要）
4. operation_logsに記録（operation_type='product_discontinue'）

**独自コード発番:**
1. department_idからdepartmentsを取得
2. code_prefixがNULL → エラー（この部門は独自コード対象外）
3. code_prefix + '-' + next_seqを0埋め4桁でフォーマット（例: "HZ-0047"）
4. 生成したコードでproductsの重複チェック
5. departments.next_seqを+1
6. 生成したproduct_codeを返す

**一括インポート:**
1. IO-03を呼んでファイル読込み＋エンコーディング判定＋パース
2. ヘッダ検証（必須列の存在確認）
3. 各行をバリデーション → 正常行/エラー行/重複行（product_codeが既存）に分類
4. プレビューデータとして返す（ここでは保存しない）
5. 利用者が「取り込む」を選択 → 重複行は「上書き」「スキップ」を行ごとに選択可能
6. トランザクション内で正常行＋上書き対象行をINSERT/UPDATE
7. 各商品について初期在庫ありならinventory_movementsにINSERT
8. operation_logsに記録

**【制御構造】**
- 独自コード発番はトランザクション内でnext_seqのread→increment→writeを行い排他制御（SQLiteの暗黙ロックで十分）
- 一括インポートは「プレビュー」と「コミット」が別リクエスト。プレビュー結果はフロントエンド側で保持し、コミット時にバックエンドへ送信
- 商品修正中に他の操作が同じ商品を触るケース → 1人運用なので楽観ロック不要。将来拡張でupdated_at一致チェックを追加可能

---

### BIZ-02: 在庫変動ロジック

**タスク要求**: 入庫・返品・手動販売出庫・廃棄による在庫変動を統一的に処理する。products.stock_quantityの更新とinventory_movementsの記録を常にセットで実行する

**理由**: 在庫変動は4つの異なる画面（入庫/返品/手動販売/廃棄）から発生するが、「在庫を増減してその履歴を記録する」という共通処理がある。これをBIZ-02に集約することで、在庫整合性のルールが1箇所にまとまる

**【データ構造】**

入力データ（共通）:
- product_code, quantity（プラス=増加/マイナス=減少）, movement_type, reference_type, reference_id

入庫固有の入力:
- receiving_record: supplier_id, receiving_date, note
- receiving_items[]: product_code, quantity, cost_price

返品固有の入力:
- return_record: return_type('return'/'exchange'), return_date, register_processed, receipt_image_path, note
- return_items[]: product_code, direction('in'/'out'), quantity

手動販売出庫固有の入力:
- manual_sale: sale_date, reason('plu_unregistered'/'other'), note
- manual_sale_items[]: product_code, quantity, amount

廃棄固有の入力:
- disposal_record: disposal_date
- disposal_items[]: product_code, disposal_type('disposal'/'damage'/'other'), quantity, cost_price, reason

出力データ:
- 処理結果: 成功/失敗、変動後の在庫数、在庫マイナス警告の有無

内部で扱うテーブル: products, inventory_movements, receiving_records/items, return_records/items, manual_sales/items, disposal_records/items, sale_records, operation_logs

**【処理構造】**

**共通在庫変動処理（全ての入出庫から呼ばれる内部関数）:**
1. product_codeでproductsを取得
2. 新しい在庫数を計算: stock_after = products.stock_quantity + quantity
3. stock_after < 0 の場合 → 在庫マイナス警告フラグをセット（処理は止めない）
4. products.stock_quantityをstock_afterに更新
5. inventory_movementsにINSERT（movement_type, quantity, stock_after, reference_type, reference_id）

**入庫記録の処理手順:**
1. 入力バリデーション（supplier_idがsuppliersに存在、各itemのproduct_codeが存在、quantity > 0）
2. トランザクション内で実行
   - receiving_recordsにINSERT → record_idを取得
   - 各receiving_itemについて:
     - receiving_itemsにINSERT
     - 共通在庫変動処理を呼び出し（quantity=+入庫数, movement_type='receiving', reference_type='receiving_record', reference_id=record_id）
   - operation_logsに記録（operation_type='receiving_create'）

**返品・交換記録の処理手順:**
1. 入力バリデーション（各itemのproduct_codeが存在、quantityが正の整数）
2. トランザクション内で実行
   - return_recordsにINSERT → record_idを取得
   - 各return_itemについて:
     - return_itemsにINSERT
     - register_processed=1（レジ戻し済み）の場合 → 在庫は動かさない（CSV取込みで自動反映）
     - register_processed=0（レジ未処理）の場合:
       - direction='in'（戻り）→ 共通在庫変動処理（quantity=+数量, movement_type='return'）
       - direction='out'（渡し）→ 共通在庫変動処理（quantity=-数量, movement_type='return'）
   - operation_logsに記録（operation_type='return_create'）

**手動販売出庫の処理手順:**
1. 入力バリデーション
2. 各itemのproduct_codeについてPLU登録済みチェック:
   - plu_dirty=0 かつ plu_exported_at IS NOT NULL → 警告フラグ付与（「この商品はレジで打てます」）
   - 利用者が警告を確認した上で続行する場合のみ処理
3. トランザクション内で実行
   - manual_salesにINSERT → sale_idを取得
   - 各manual_sale_itemについて:
     - manual_sale_itemsにINSERT
     - sale_recordsにINSERT（source='manual', csv_import_id=NULL）
     - 共通在庫変動処理（quantity=-数量, movement_type='sale_manual', reference_type='manual_sale', reference_id=sale_id）
   - operation_logsに記録（operation_type='manual_sale_create'）

**廃棄・破損記録の処理手順:**
1. 入力バリデーション（quantity > 0, cost_price >= 0, reason非空）
2. トランザクション内で実行
   - disposal_recordsにINSERT → record_idを取得
   - 各disposal_itemについて:
     - disposal_itemsにINSERT
     - 共通在庫変動処理（quantity=-数量, movement_type='disposal', reference_type='disposal_record', reference_id=record_id）
   - operation_logsに記録（operation_type='disposal_create'）

**【制御構造】**
- 全てのヘッダ+明細+在庫更新+変動履歴はBEGIN〜COMMITで一括。途中で失敗したらROLLBACK
- 在庫マイナス警告はエラーではなく警告。処理は続行する（利用者が後で確認）
- 返品のregister_processedフラグは画面入力時に決定。BIZ層では渡された値に従って分岐するだけ

---

### BIZ-03: Z004商品別CSV取込みパイプライン

**タスク要求**: Z004ファイルを読み込み、売上記録の作成と在庫更新を4段階パイプラインで実行する

**理由**: Z004はPLU登録後の商品別売上・在庫引落し候補である。ファイルフォーマットの癖（CP932/NEL）、マスタ未登録商品への対応、ロールバック可能性を考慮すると、段階的な処理パイプラインが必要。current operation の日報主入力（Z001/Z002/Z005）は BIZ-08 で扱う

**【データ構造】**

入力データ:
- Z004ファイルバイト列

段階間受け渡しデータ:
- ParseResult: settlement_date, parsed_rows[]{line_no, normalized_jan, name, quantity, amount}, parse_errors[]{line_no, error_type, error_message}
- ValidateResult: matched_rows[]{line_no, product_code, quantity, amount, pos_stock_sync}, error_rows[]{line_no, normalized_jan, name, quantity, amount, error_type, error_message}, excluded_count
- PreviewData: file_info{filename, settlement_date, file_hash}, matched_summary{count, total_amount}, error_summary{count, items[]}, duplicate_check_result

出力データ:
- 取込み結果: csv_import_id, status('completed'/'completed_partial'), total_items, total_amount, skipped_count

内部で扱うテーブル: csv_imports, csv_import_errors, sale_records, products, inventory_movements, operation_logs

**【処理構造】**

※ 4段階パイプラインの詳細はdb-design/pos-tables.mdの「B-1: Z004パース仕様」セクションに記載済み。ここでは各段階の責務とBIZ層の判断ポイントを記述する。

**Stage 1: Parse（IO-02に委譲）**
1. IO-02（Z004パーサー）を呼び出し
2. ParseResultを受け取る
3. parse_errorsが存在し、parsed_rowsが0件 → 「有効なデータがありません」で中断。operation_logsに記録（csv_import_parse_failed）
4. parse_errorsが存在し、parsed_rowsも存在 → Stage 2に進む（行エラーは最終的にcsv_import_errorsに記録）

**Stage 2: Validate**
1. parsed_rowsの空レコード除外（JAN=0000...、quantity=0 and amount=0）
2. 実データ行についてproducts.jan_codeで検索
   - ヒット1件 → matched_rowsに追加。pos_stock_syncフラグをコピー
   - ヒット0件 → error_rowsに追加（error_type='unmatched_product'）
   - ヒット複数件 → ORDER BY product_code ASCで先頭に紐付け
3. Stage 1のparse_errorsもerror_rowsにマージ
4. ValidateResultを構築

**Stage 3: Preview（フロントエンドとの連携ポイント）**
1. file_hashで重複チェック
   - status IN ('completed','completed_partial') → ブロック
   - status = 'rolled_back' → 許可
2. settlement_dateで既存チェック
   - 同じ日の取込みが存在 → 上書き確認フラグ付与
3. PreviewDataを構築してフロントエンドに返す
4. **ここでフロントエンドからの利用者操作を待つ**

**Stage 4: Commit**
1. 上書き確認で「上書き」が選択された場合 → 既存csv_importをロールバック（後述のrollback処理を呼び出し）
2. トランザクション内で実行
   - csv_importsにINSERT → import_idを取得
   - matched_rowsの各行について:
     - sale_recordsにINSERT（source='auto', csv_import_id=import_id, source_line_no=line_no）
     - pos_stock_sync=1の場合:
       - 在庫視点でquantityを変換（返品:sale_records.quantity<0→inventory_movements.quantity=+|quantity|、通常販売→inventory_movements.quantity=-quantity）
       - products.stock_quantity更新 + inventory_movementsにINSERT（movement_type='sale_auto', reference_type='csv_import', reference_id=import_id）
     - pos_stock_sync=0の場合 → sale_recordsのみ、在庫は動かさない
   - error_rowsがある場合 → csv_import_errorsにINSERT
   - csv_imports.status / total_items / total_amount / skipped_countを確定
   - operation_logsに記録（operation_type='csv_import'）
3. COMMIT

**ロールバック処理:**
1. csv_import_idで対象を特定
2. トランザクション内で実行
   - 関連するsale_recordsをis_voided=1に更新
   - 関連するinventory_movementsをis_voided=1に更新
   - is_voided=1にした各inventory_movementsについてproducts.stock_quantityを逆方向に補正
   - csv_imports.statusを'rolled_back'に更新
   - operation_logsに記録（operation_type='csv_rollback'）

**【制御構造】**
- Stage 3→4の間に利用者の操作待ちがある。Preview結果はサーバ側キャッシュに保持し、フロントエンドはpreview_tokenのみを保持してcommit時に送り返す（有効期限30分）
- Commit中はUIロック（D-3排他制御: Preview開始〜Commit完了/キャンセルまでdisabled）
- ロールバックは物理削除ではなく論理無効化（is_voided=1）

---

### BIZ-08: 日報取込みロジック

**タスク要求**: Z001/Z002/Z005 の1営業日分bundleを読み込み、日報サマリ・支払集計・部門別売上を4段階パイプラインで保存する。商品別売上や在庫変動へは擬似展開しない

**理由**: 2026-06-30 field-check により、現在の店舗日報主入力は Z001/Z002/Z005 であると分かった。これらは商品コード/JAN単位の明細ではないため、既存 `sale_records` や `inventory_movements` に入れると reporting/accounting 意味が壊れる。日報集計を別モデルとして保存し、Z004商品別取込みとは分ける

**【データ構造】**

入力データ:
- DailyReportSourceFile[]（filename, bytes）

段階間受け渡しデータ:
- DailyReportParseResult（IO-07出力）
- DailyReportValidateResult: report_date, source_files, summary_lines, payment_lines, department_lines{department_id?}, warnings[], duplicate_check
- DailyReportPreviewData: file_info{report_date, source_files, bundle_hash}, totals{gross_amount?, net_amount?}, payment_summary, department_summary, warnings, duplicate_check

出力データ:
- DailyReportImportResult: daily_report_import_id, status('completed'), report_date, gross_amount?, net_amount?, warning_count

内部で扱うテーブル:
- daily_report_imports
- daily_report_summary_lines
- daily_report_payment_lines
- daily_report_department_lines
- departments
- operation_logs

**【処理構造】**

**Stage 1: Parse（IO-07に委譲）**
1. IO-07（POS日報bundleパーサー）を呼び出す
2. parse_errors がある場合は commit 不可として中断し、`daily_report_imports` は作らない
3. parse失敗は operation_logs に `daily_report_parse_failed` として記録する

**Stage 2: Validate**
1. Z001/Z002/Z005 の report_date が一致することを確認する
2. bundle_hash を source順（Z001→Z002→Z005）と個別file_hashから計算する
3. 必須サマリ行の存在と数値変換済みであることを確認する
4. Z005の部門名を departments.name に照合する
   - 一致 → department_id を付与
   - 不一致 → warning とし、department_id=NULL で続行可能
5. bundle_hash と report_date で重複・上書き判定を作る

**Stage 3: Preview**
1. 対象日、3ファイル、総売上/純売上、支払集計、部門別集計、部門未対応warningを返す
2. 同一bundleのcompleted取込みはブロックする
3. 同一report_dateの別bundleがある場合は上書き確認を要求する
4. preview_token を返し、CMD層cacheに30分保持する

**Stage 4: Commit**
1. 上書き確認済みなら同一report_dateの既存completed日報取込みを `rolled_back` にする
2. トランザクション内で実行
   - daily_report_importsにINSERT
   - summary/payment/department linesをINSERT
3. COMMIT
4. operation_logsに `daily_report_import` を記録する
   - ログ記録失敗は日報取込み自体を巻き戻さず、診断ログまたは後続確認対象として扱う

**ロールバック処理:**
1. daily_report_import_idで対象を特定する
2. トランザクション内で status='rolled_back' と rolled_back_at を更新する
3. COMMIT
4. operation_logsに `daily_report_rollback` を記録する
   - ログ記録失敗はrollback済み状態を戻さず、診断ログまたは後続確認対象として扱う
5. sale_records、inventory_movements、products.stock_quantity は変更しない

**【制御構造】**
- BIZ-03と同じく Parse→Validate→Preview→Commit を採用するが、書込先とrollback意味は別物
- 日報取込みは日報集計の正本であり、商品別ランキングや在庫引落しの根拠にはならない
- 部門未対応は取込み失敗ではなくwarning。後続の部門マッピング改善やREQ-403照合で扱う

---

### BIZ-04: PLU書出しロジック

**タスク要求**: 商品マスタからカシオPCツール用のPLU登録TSVを生成し、保存済み確認後にアプリ側のPLU未反映状態を更新する

**理由**: レジでバーコードスキャン販売するには、商品をPLUとしてレジに登録する必要がある。商品マスタの情報をレジが読み込める形式に変換して書き出す機能

**【データ構造】**

入力データ:
- 書出し準備: 書出しモード 'full'（全件=plu_target=1 かつ is_discontinued=0）/ 'diff'（差分=plu_target=1 かつ plu_dirty=1）
- 書出し済み確認: prepare時に返した対象 product_code[]

出力データ:
- TSVファイルバイト列（IO-04が生成）
- 書出しサマリ: 書出し行数、対象 product_code[]（同一JAN dedup 群の全メンバーを含む）、要修正リスト（JAN不備・同一JAN価格不一致の商品と理由）、上限チェック結果
- 確認結果: 更新件数、確認日時

内部で扱うテーブル: products, operation_logs

**【処理構造】**

**prepare_plu_export:**
1. 書出し対象の抽出（D-028 三分バケット。plu_target=0 の「対象外」は抽出しない）
   - full: plu_target=1 かつ is_discontinued=0 の商品
   - diff: plu_target=1 かつ plu_dirty=1 の商品のみ
2. 要修正分離: JAN不備（未登録 / 13桁でない / チェックディジット不正）の商品を生成から除外し、理由付きリストで返す（生成はブロックしない）
3. 同一JAN dedup: グループコード商品は売価・税率が全一致なら代表1行に集約、不一致なら群全体を要修正リストへ
4. スキャニングPLU上限チェック: dedup 後の生成行数が4,784件（工場出荷時配分: 総枠5,000 - 通常PLU216）を超える場合 → エラー
5. 対象商品のリストをIO-04に渡してTSV生成
6. TSVファイル、行数、対象 product_code[]（dedup 群の全メンバー）、要修正リスト、上限警告を返す
7. この時点では `plu_dirty` / `plu_exported_at` を更新しない

**confirm_plu_export_saved:**
1. product_code[] が空、重複ありならvalidation error（件数上限比較は行わない。dedup 群展開により書出し行数を正当に超え得るため = D-028）
2. トランザクション内で実行
   - 対象商品の存在を再確認する。存在しない商品があれば全体を失敗させ、部分更新しない
   - 対象商品の `plu_dirty=0`, `plu_exported_at=現在日時` に更新する
3. COMMIT
4. TX外で operation_logs に記録（operation_type='plu_export', detail_jsonに件数）
5. 更新件数と確認日時を返す

**【制御構造】**
- `prepare_plu_export` はTSV生成のみでDB状態を変更しない。TSV生成に失敗した場合も `plu_dirty` は変更されない
- `confirm_plu_export_saved` は、利用者が保存後に明示確認した exact product_code[] だけを更新する
- PCツール投入失敗時は `plu_dirty` が残っているため、Full 再書出しで同じ内容を含めて再投入できる（Diff 書出しは未反映確認用で CV17 へは投入しない = UI-08-D9）
- アプリはPCツール受理やレジ反映を検知しない。`plu_exported_at` はアプリ側の書出し済み確認日時に限定する
- CV17 へ投入してよいのは Full 書出しファイルのみ（D-028 / UI-08-D9: CV17 import はメモリNo. キーの部分更新であり、毎回217始まりで再採番する現行書出しでは Diff ファイル投入が既存スロットを上書きするため）

---

### BIZ-05: 売上集計ロジック

**タスク要求**: 日次・月次の売上データを集計し、レポート画面とCSVエクスポートに必要なデータを提供する

**理由**: 利用者が日々の売上を把握し、月次で経営判断するためのデータ。is_voided=0のレコードのみを対象にし、ロールバック済みデータを除外する

**【データ構造】**

入力データ:
- 日次: 対象日（YYYY-MM-DD）
- 月次: 対象月（YYYY-MM）、集計モード（'by_product' / 'by_department'）

出力データ:
- 日次売上一覧: [{product_code, name, department_name, quantity, amount, source('auto'/'manual')}], 部門小計[], 総合計
- 月次売上集計: [{product_code or department_name, quantity, amount, ranking}], 前月比較データ

内部で扱うテーブル: sale_records, products, departments

**【処理構造】**

**日次売上一覧:**
1. sale_recordsからis_voided=0 AND sale_date=対象日のレコードを取得
2. productsとJOINして商品名・部門名を付与
3. 部門別にグルーピングして小計を計算
4. sourceで記録元（auto/manual）を区別して返す

**月次売上集計（商品別）:**
1. sale_recordsからis_voided=0 AND sale_dateが対象月内のレコードを集計
2. product_codeでGROUP BY、SUM(quantity), SUM(amount)
3. amountの降順でランキング付与
4. 前月の同集計を取得して比較データを生成

**月次売上集計（部門別）:**
1. sale_records + productsをJOINしてdepartment_idでGROUP BY
2. SUM(quantity), SUM(amount)
3. 前月比較

**CSVエクスポート:**
1. 上記の集計結果を受け取り、IO-05に渡してCSV生成

**【制御構造】**
- 集計クエリは読み取り専用。トランザクション不要
- ページングは月次の商品別で必要になる可能性がある（4000商品）。LIMIT/OFFSETで対応

---

### BIZ-06: 棚卸しロジック

**タスク要求**: 棚卸しの開始・カウント入力・確定を管理し、仕入原価総額を算出する

**理由**: 年末棚卸し（10月〜大晦日の長期作業）で、全商品の実在庫をカウントしてシステム在庫との差異を補正する。税理士報告用の仕入原価総額の算出も行う

**【データ構造】**

入力データ:
- 棚卸し開始: なし（全商品を対象に自動生成）
- カウント入力: stocktake_item_id, actual_count
- 棚卸し確定: stocktake_id, force_fill（true=未入力をシステム在庫と同じとみなす。先決事項D-1、2026-04-12確定）

出力データ:
- 棚卸し一覧: [{product_code, name, department_name, system_stock, actual_count, difference, counted_at}], 進捗（入力済み/未入力件数）
- 確定結果: total_cost（仕入原価総額）、差異があった商品一覧

内部で扱うテーブル: stocktakes, stocktake_items, products, inventory_movements, operation_logs

**【処理構造】**

**棚卸し開始:**
1. 進行中の棚卸し（status='in_progress'）が存在するかチェック → 存在すればエラー（1件まで制約）
2. stocktakesにINSERT（status='in_progress'）→ stocktake_idを取得
3. 全商品（is_discontinued=0、または is_discontinued=1かつstock_quantity>0）について:
   - stocktake_itemsにINSERT（system_stock=現在のproducts.stock_quantity, actual_count=NULL）
4. is_discontinued=1 かつ stock_quantity=0 の商品 → actual_count=0として自動入力
5. operation_logsに記録（operation_type='stocktake_start'）

**カウント入力:**
1. stocktake_itemsのactual_countを更新、counted_at=現在日時
2. 差異の表示は「現在のproducts.stock_quantity - actual_count」で動的計算（棚卸し中もCSV取込みで在庫が動くため）

**棚卸し確定:**
1. 未入力（actual_count=NULL）の商品が残っていないかチェック → 残っていれば警告（確定を阻止、または「未入力はシステム在庫と同じとみなす」選択肢）
2. トランザクション内で実行
   - 各stocktake_itemについて:
     - valuation_cost_price = 現在のproducts.cost_price をセット
     - difference = products.stock_quantity - actual_count
     - difference ≠ 0 の場合:
       - inventory_movementsにINSERT（movement_type='stocktake', quantity=actual_count - products.stock_quantity, stock_after=actual_count, reference_type='stocktake', reference_id=stocktake_id）
       - products.stock_quantityをactual_countに更新
   - total_cost = SUM(valuation_cost_price × actual_count)を計算
   - stocktakes.total_cost, completed_at, status='completed'を更新
   - operation_logsに記録（operation_type='stocktake_complete', detail_jsonに差異件数・total_cost）
3. COMMIT

**【制御構造】**
- 棚卸し中（status='in_progress'）のCSV取込みは許可（SP-205-09修正）。差異は動的計算で対応
- 棚卸し中に新規商品が登録された場合 → BIZ-01の商品登録処理内でstocktake_itemsに自動追加
- 進行中の棚卸しは1件まで。アプリ層でチェック
- カウント入力は1件ずつ保存（中断再開対応）。トランザクション不要

---

### BIZ-07: 整合性チェックロジック

**タスク要求**: products.stock_quantityとinventory_movementsの集計値を突合し、不整合を検出する

**理由**: stock_quantityはキャッシュ値であり、バグやクラッシュで実際の変動履歴合計とずれる可能性がある。定期的なチェックで不整合を早期発見する

**【前提条件】**
- inventory_movementsは全商品の完全な在庫変動履歴を持つ。初期在庫投入もmovement_type='receiving'としてinventory_movementsに記録される（DB_DESIGN.md「stock_quantity整合性チェック」の前提条件に明記済み）
- この前提が成立するため、SUM(inventory_movements.quantity WHERE is_voided=0) が理論上の正しい在庫数となる
- 初期投入漏れやpos_stock_sync=0の商品でも、inventory_movementsに記録がある限りチェックは有効

**【データ構造】**

入力データ: なし（全商品を対象）

出力データ:
- チェック結果: [{product_code, name, stock_quantity（現在値）, movements_sum（履歴合計）, difference}], 不整合件数

内部で扱うテーブル: products, inventory_movements, operation_logs

**【処理構造】**

1. 全商品について以下を計算:
   - movements_sum = SUM(inventory_movements.quantity WHERE product_code=? AND is_voided=0)
   - difference = products.stock_quantity - movements_sum
2. difference ≠ 0 の商品を不整合リストに追加
3. 不整合が0件 → 「問題ありません」で完了
4. 不整合がある場合 → 不整合リストを利用者に表示
5. 利用者が「補正する」を選択した場合:
   - 各不整合商品について products.stock_quantity を movements_sum へ直接更新する（inventory_movements に行は追加しない — BIZ-07-D2 / D-051、詳細は function-design/36-biz-integrity-check.md §21.4）
   - 補正内容は同一TX内の operation_logs（operation_type='integrity_fix'、old/new 付き）へ必須記録し、記録失敗時は補正ごとロールバックする（BIZ-07-D3、D-6の明示例外）
6. チェック実行の operation_logs 記録（operation_type='integrity_check', detail_jsonに不整合件数）はTX外 best-effort のまま（D-6準拠）。補正の記録はステップ5のTX内 'integrity_fix' ログが担う（2ログ分離）

**【制御構造】**
- チェックタイミング: CSV取込み完了時（自動）、棚卸し確定時（自動）、設定画面から手動実行
- 自動上書きはしない。必ず利用者確認を挟む
- チェック中の他の操作は制限しない（読み取り専用クエリのため）
