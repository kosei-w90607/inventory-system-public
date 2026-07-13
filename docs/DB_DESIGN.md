# 在庫管理システム テーブル定義書

> **最終更新**: 2026-07-03 / D-028 JANなし商品のPLU対象扱い（products.plu_target、migration v3）を追加
> **テーブル数**: 24テーブル（マスタ3 + トランザクション8 + POS連携7 + 在庫追跡2 + 棚卸し2 + システム2）

---

## テーブル一覧

| # | テーブル名 | 種別 | 対応REQ | 役割 |
|---|-----------|------|---------|------|
| 1 | products | マスタ | REQ-101〜104 | 商品マスタ。システムの中心 |
| 2 | departments | マスタ | REQ-103, 402 | 部門マスタ。Z005対応＋独自コード発番 |
| 3 | suppliers | マスタ | REQ-201 | 取引先マスタ。サジェスト入力の元データ |
| 4 | receiving_records | トランザクション | REQ-201 | 入庫記録ヘッダ |
| 5 | receiving_items | トランザクション | REQ-201 | 入庫記録明細（商品ごと） |
| 6 | return_records | トランザクション | REQ-202 | 返品・交換記録ヘッダ |
| 7 | return_items | トランザクション | REQ-202 | 返品・交換記録明細（商品ごと） |
| 8 | manual_sales | トランザクション | REQ-203 | 手動販売出庫ヘッダ |
| 9 | manual_sale_items | トランザクション | REQ-203 | 手動販売出庫明細（商品ごと） |
| 10 | disposal_records | トランザクション | REQ-204 | 廃棄・破損記録ヘッダ |
| 11 | disposal_items | トランザクション | REQ-204 | 廃棄・破損記録明細（商品ごと） |
| 12 | csv_imports | POS連携 | REQ-401 | CSV取込み履歴 |
| 12a | csv_import_errors | POS連携 | REQ-401 | CSV取込みエラー・スキップ行 |
| 12b | daily_report_imports | POS連携 | REQ-401 | 日報取込み履歴（Z001/Z002/Z005の束） |
| 12c | daily_report_summary_lines | POS連携 | REQ-401, 501, 502 | 日計サマリ行（Z001由来） |
| 12d | daily_report_payment_lines | POS連携 | REQ-401, 501, 502 | 取引キー・支払集計行（Z002由来） |
| 12e | daily_report_department_lines | POS連携 | REQ-401, 501, 502 | 部門別売上集計行（Z005由来） |
| 13 | sale_records | POS連携 | REQ-401, 501, 502 | 売上レコード（自動＋手動の統合） |
| 14 | inventory_movements | 在庫追跡 | REQ-303 | 在庫変動履歴（全ての在庫増減の記録） |
| 15 | price_history | 在庫追跡 | REQ-102 | 価格変更履歴 |
| 16 | stocktakes | 棚卸し | REQ-205 | 棚卸しヘッダ |
| 17 | stocktake_items | 棚卸し | REQ-205 | 棚卸し明細（商品ごとの実カウント） |
| 18 | operation_logs | システム | QR-06 | 操作ログ |
| 19 | app_settings | システム | QR系 | アプリ設定（キー・バリューストア） |

---

## テーブル定義（詳細）

各テーブルのカラム定義・設計意図・業務シナリオは以下のサブドキュメントに記述:

| グループ | ファイル | テーブル |
|---------|---------|---------|
| マスタ | [db-design/master-tables.md](db-design/master-tables.md) | products, departments, suppliers |
| トランザクション | [db-design/transaction-tables.md](db-design/transaction-tables.md) | receiving_records/items, return_records/items, manual_sales/items, disposal_records/items |
| POS連携 | [db-design/pos-tables.md](db-design/pos-tables.md) | csv_imports, csv_import_errors, daily_report_imports, daily_report_summary_lines, daily_report_payment_lines, daily_report_department_lines, B-1/B-2パース仕様, sale_records |
| 在庫追跡・棚卸し・システム | [db-design/tracking-system-tables.md](db-design/tracking-system-tables.md) | inventory_movements, price_history, stocktakes/items, operation_logs, app_settings |

---

## 設計方針メモ

### SQLite固有の考慮事項
- **外部キー制約**: SQLiteはデフォルトで外部キーが無効。`PRAGMA foreign_keys = ON;` を接続時に必ず実行する
- **日時の格納**: TEXT型でISO 8601形式（例: 2026-03-21T19:45:00）。SQLiteにはDATETIME型がないが、TEXT型でISO 8601ならソート・比較が正しく動く
- **BOOLEAN型**: SQLiteにはBOOLEAN型がないため、INTEGER型で0/1を使用
- **トランザクション**: 入庫・CSV取込み等の「ヘッダ＋明細＋在庫更新＋変動履歴」はBEGIN〜COMMITで一括コミット。途中で失敗したらROLLBACK
- **マイグレーション**: バージョン管理テーブル（schema_version）を作り、アプリ起動時にスキーマバージョンを確認→必要ならALTER TABLEで更新

### ポリモーフィック関連の整合性
- inventory_movementsのreference_type + reference_idはアプリケーション側で整合性を担保
- reference_typeの許容値はCHECK制約で固定（指摘#11対応）
- 参照先のテーブルとIDが正しいかはビジネスロジック層でチェック
- 不整合が起きた場合は操作ログに記録して警告

### POS日報と商品別売上のデータ境界（D-025 / 2026-06-30）
- `daily_report_imports` と配下の `daily_report_*_lines` は、CASIO PCツール / SDカードから取得する `Z001` / `Z002` / `Z005` の日報集計を、アプリ内部の日報モデルに変換して保存する。
- `sale_records` は、Z004または手動販売出庫から得られる商品別売上の正本である。Z001/Z002/Z005は商品コード・JAN単位の明細ではないため、`sale_records` や `inventory_movements` へ擬似展開しない。
- 日報取込みの rollback は日報取込みレコードを `rolled_back` にする論理取消に限定する。在庫変動を作らないため、在庫補正や movement void は発生しない。
- レジ依存のファイル名、列名、文字コード、改行、PCツール手順は POS adapter の責務とし、DBには app core が使う report_date / section / label / amount / quantity / count / department mapping だけを保存する。

### 日時書式規約（指摘#18対応）
- `*_date` カラム: YYYY-MM-DD（日付のみ。例: sale_date, receiving_date, disposal_date）
- `*_at` カラム: YYYY-MM-DDTHH:MM:SS（日時。例: created_at, updated_at, imported_at）
- タイムゾーン: ローカル（JST）で統一。UTCにしない（1店舗のローカルアプリのため）
- settlement_dateはYYYY-MM-DD（精算日は日付単位）

### D-6: 入出庫記録・在庫変動追跡の完成形（2026-06-27 追加）

商業用の在庫管理として、入庫・返品交換・手動販売出庫・廃棄破損・CSV取込み・棚卸し補正は、作成後に一覧・詳細・在庫変動履歴から追跡できる必要がある。完成形の DB 方針は [function-design/65-inventory-record-traceability.md](function-design/65-inventory-record-traceability.md) §65.6 を正とする。

- 業務記録ヘッダは `active` / `canceled` / `corrected` の状態を持つ方向で設計する。
- 取消は物理削除せず、取消理由と取消日時を残す。
- 訂正は元記録を取消/訂正済みにし、新しい記録を作る。
- 在庫戻しは既存 movement を消さず、逆方向 movement を追加する。
- `operation_logs` は監査・保守ログであり、業務記録や在庫変動履歴の正本にはしない。

### CHECK制約方針（指摘#17対応）
以下の列挙値カラムにCHECK制約を設定する:
- products.tax_rate: CHECK(tax_rate IN ('10','8','0'))
- products.stock_unit: CHECK(stock_unit IN ('pcs','cm'))
- sale_records.source: CHECK(source IN ('auto','manual'))
- inventory_movements.movement_type: CHECK(movement_type IN ('sale_auto','sale_manual','receiving','return','disposal','stocktake'))
- inventory_movements.reference_type: CHECK(reference_type IN ('csv_import','manual_sale','receiving_record','return_record','disposal_record','stocktake') OR reference_type IS NULL)
- return_records.return_type: CHECK(return_type IN ('return','exchange'))
- return_items.direction: CHECK(direction IN ('in','out'))
- disposal_items.disposal_type: CHECK(disposal_type IN ('disposal','damage','other'))
- csv_imports.status: CHECK(status IN ('completed','completed_partial','rolled_back'))
- csv_import_errors.error_type: CHECK(error_type IN ('unmatched_product','invalid_format','invalid_jan','invalid_number'))
- daily_report_imports.status: CHECK(status IN ('completed','rolled_back'))
- daily_report_imports.source_adapter: CHECK(source_adapter IN ('casio_sr_s4000'))
- daily_report_summary_lines.source_file: CHECK(source_file IN ('Z001'))
- daily_report_payment_lines.source_file: CHECK(source_file IN ('Z002'))
- daily_report_department_lines.source_file: CHECK(source_file IN ('Z005'))
- stocktakes.status: CHECK(status IN ('in_progress','completed'))
- manual_sales.reason: CHECK(reason IN ('plu_unregistered','other'))

### インデックス方針（指摘#16対応）
jan_codeとfile_hash以外に、以下のインデックスを初期設定する:
- sale_records(sale_date) — 日次売上一覧の検索用
- sale_records(product_code, sale_date) — 商品別売上集計用
- sale_records(csv_import_id) — ロールバック時の関連レコード特定用
- daily_report_imports(report_date) — 日報取込みの対象日検索用
- daily_report_imports(bundle_hash) — 同一Z001/Z002/Z005束の重複検知用
- daily_report_summary_lines(daily_report_import_id) — 日報表示用
- daily_report_payment_lines(daily_report_import_id) — 日報表示用
- daily_report_department_lines(daily_report_import_id, department_id) — 部門別日報表示と部門マスタ突合用
- inventory_movements(product_code, created_at) — 在庫変動履歴の商品別時系列表示用
- inventory_movements(reference_type, reference_id) — 元操作からの逆引き用
- stocktake_items(stocktake_id, product_code) — 棚卸し中の商品検索用
- products(department_id) — 部門別商品一覧用
- products(is_discontinued) — 廃番フィルタリング用

### stock_quantity整合性チェック（指摘#12対応）
- **前提**: 全商品の在庫はシステム導入時の初期投入（REQ-104一括インポートまたはREQ-101個別登録）から履歴が始まる。初期投入時にinventory_movementsにmovement_type='receiving'で初期在庫レコードを作成し、全商品の履歴起点を保証する
- **pos_stock_sync=0の商品**: CSV取込みで在庫を動かさない商品は、inventory_movementsにsale_autoの行が作られない。手動販売出庫や棚卸し補正でのみ在庫が変動する。整合性チェックはこれらの商品も含めて行う
- **チェックタイミング**: CSV取込み完了時、棚卸し確定時、設定画面からの手動実行
- **チェック方法**: 各商品について `SUM(inventory_movements.quantity WHERE is_voided=0)` と `products.stock_quantity` を突合
- **差異発見時**: operation_logsに記録。画面に「在庫数に不整合があります」と警告表示。差異のある商品一覧を表示
- **復旧方針**: 自動上書きはしない（履歴起点が欠損している可能性があるため危険）。利用者に差異を提示し、「棚卸し補正として現在の在庫数を確定しますか？」と確認。確定した場合のみstocktakeとしてinventory_movementsに補正レコードを追加し、stock_quantityを更新する

### ファイルパス保存方針（指摘#19対応）
- receipt_image_path: アプリ管理下の相対パスで保存（例: images/receipts/2026-03-21_001.jpg）
- バックアップパス（app_settings.backup_path）: 利用者が指定する絶対パス。デフォルトはアプリインストールフォルダ配下
- 画像ファイルの実体はアプリのデータフォルダ内に保存。DBにはパスのみ記録

### operation_type命名規約（指摘#14対応）
操作種別は `エンティティ_動詞` の形式で統一する:
- product_create, product_update, product_discontinue
- csv_import, csv_rollback
- daily_report_import, daily_report_rollback
- receiving_create
- return_create
- manual_sale_create
- disposal_create
- stocktake_start, stocktake_complete
- plu_export
- backup_create, backup_restore
- setting_update
- log_cleanup

### D-1: 一括インポートのエンコーディング対応（2026-03-29 確定）
- **文字コード判定**: BOM（0xEF 0xBB 0xBF）があればUTF-8、なければCP932としてデコード
- **BOMなしUTF-8は非対応**: 日本語Excelから「CSV（コンマ区切り）」で保存するとCP932、「CSV UTF-8」で保存するとBOM付きUTF-8になるため、BOMなしUTF-8が出るケースはない。仕様として非対応を明記
- **フォーマット検証**: デコード後に必須ヘッダ列の検証（列名・列数の一致チェック）と区切り文字の確認をセットで行う
- **プレビュー必須**: 取込み前に先頭数行を必ずプレビュー画面で表示。CP932デコードが成功しても文字化けしている場合は利用者が目視で気づける
- **デコード失敗時**: 「ファイルの文字コードが判別できません。Excelで保存し直してください」とエラー表示

### D-2: PLU書出し→レジ反映の検知手段（2026-03-29 確定 / 2026-07-01 D-027 更新 / 2026-07-03 D-028 更新）
- **plu_dirty / plu_exported_at の更新タイミング**: PLUファイル生成だけでは更新しない。UI-08で保存先を選び、PLUファイル保存後に利用者が「この書出しを未反映から外す」と明示確認した時点で、生成時の対象商品だけを `plu_dirty=0` にし、`plu_exported_at` に現在日時を記録する。
- **plu_dirty の意味の限定（D-028）**: `plu_dirty` は `plu_target=1`（スキャニングPLU書出し対象）の商品についてのみ「レジ未反映」を意味する。`plu_target=0` の商品は `plu_dirty` の値にかかわらず PLU書出し抽出と UI-00 PLU未反映通知の対象外（抽出・通知クエリが `plu_target=1` 条件を持つ）。詳細は [db-design/master-tables.md](db-design/master-tables.md) plu_target 設計意図と decision-log D-028 を参照。
- **PCツール投入失敗時の再書出し（D-028 更新）**: `prepare_plu_export` でPLUファイルを生成しても `plu_dirty` は残る。CV17 取込み失敗時の回復は、確認前後を問わず保存済み Full ファイルの再投入または Full モードでの再書出しで行う（CV17 へ投入してよいのは Full 書出しファイルのみ = UI-08-D9）。Diff モードは未反映内容の確認用であり、Diff ファイルを CV17 へ投入しない。
- **レジ反映の確認**: レジ側にAPIがないため検知不可能。`plu_exported_at` は「アプリ側でPLUファイルを保存済みにした日時」であり、PCツール受理やレジ反映の証明ではない。
- **画面上の注意表示**: UI-08の完了画面に「アプリで確認できるのはPLUファイル保存まで。PCツールへの取込み、SDカード書出し、レジ読込みは手動確認が必要」と常時表示する。

### D-3: CSV取込み中の排他制御（2026-03-29 確定）
- **UIロック範囲**: Preview開始〜Commit完了/キャンセルまで。取込みボタンをdisabled、画面内にimport_in_progress状態を持つ
- **SQLite設定**: WALモードで読み取りをブロックしない。BUSY_TIMEOUT=5000msで書き込み競合時にリトライ
- **BUSY TIMEOUT失敗時**: 「別の処理が実行中です。しばらく待ってからもう一度お試しください」と利用者に案内
- **「戻る→再実行」事故防止**: Preview画面からブラウザバックで戻った場合もimport_in_progress状態を維持。明示的な「キャンセル」操作でのみロック解除

### D-4: 在庫少閾値の初期値（2026-03-29 確定）
- **初期値**: stock_low_threshold=3（一般商品: 3個以下）、stock_low_threshold_fabric=500（生地: 500cm=5m以下）
- **適用ルール**: products.stock_unit='cm'の商品にはstock_low_threshold_fabricを適用、それ以外にはstock_low_thresholdを適用
- **設定画面**: 利用者が変更可能。入力バリデーションで0以下の値は拒否（最小値=1）
- **商品個別閾値**: 初期バージョンでは全商品一律。将来拡張でproductsにcustom_low_thresholdカラムを追加する余地を残す

### D-5: 操作ログ保持期間（2026-03-29 確定）
- **保持期間**: 365日（app_settingsにlog_retention_days=365を追加）
- **自動削除タイミング**: アプリ起動時に1日1回だけ実行。前回チェック日をapp_settings（log_last_cleanup_date）に記録し、同日中は再実行しない
- **削除の記録**: 削除件数をoperation_logs（operation_type='log_cleanup'）に1件記録。例: 「42件の操作ログを削除しました（2025-03-29以前）」
- **アーカイブ**: 不要。1年以上前のログが必要な場合はバックアップから復元

### 技術的認知負荷の軽減方針
- 俺（Claude）は設計判断の根拠と困りそうなケースを毎回セットで出す
- マスターは業務シナリオでぶつけて「実態と合ってるか」を判断する
- 技術的妥当性の検証責任は俺が持つ
- 実装フェーズではテストコードが機械的に検証する
