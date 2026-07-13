# テーブル定義（在庫追跡・棚卸し・システム）

> **親文書**: [DB_DESIGN.md](../DB_DESIGN.md)

---

## 14. inventory_movements（在庫変動履歴）

### 役割
全ての在庫増減を時系列で記録する。在庫変動履歴画面（REQ-303）のデータソース。「在庫がおかしいとき、なぜそうなったかを追跡する」ためのテーブル。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 変動ID |
| product_code | TEXT | FK → products.product_code, NOT NULL | 商品コード |
| movement_type | TEXT | NOT NULL, CHECK(movement_type IN ('sale_auto','sale_manual','receiving','return','disposal','stocktake')) | 変動種別 |
| quantity | INTEGER | NOT NULL | 変動数量。在庫視点で常にプラス=増加、マイナス=減少 |
| stock_after | INTEGER | NOT NULL | 変動後の在庫数 |
| reference_type | TEXT | NULLABLE, CHECK(reference_type IN ('csv_import','manual_sale','receiving_record','return_record','disposal_record','stocktake') OR reference_type IS NULL) | 参照先テーブル名 |
| reference_id | INTEGER | NULLABLE | 参照先レコードID |
| note | TEXT | NULLABLE | 備考 |
| is_voided | BOOLEAN | NOT NULL, DEFAULT 0 | 論理無効化フラグ。ロールバック時に1 |
| created_at | TEXT | NOT NULL | 作成日時（YYYY-MM-DDTHH:MM:SS） |

### 符号規約（指摘#2対応、2026-03-28 確定）

sale_recordsとinventory_movementsで符号の意味が異なる。混同防止のため明文化する。

| テーブル | 視点 | プラスの意味 | マイナスの意味 |
|---------|------|-----------|------------|
| sale_records | 売上帳票視点 | 販売（売上増） | 返品（売上減） |
| inventory_movements | 在庫視点 | 在庫増加（入庫/返品戻り） | 在庫減少（販売/廃棄） |

例: Z004で返品1個（マイナス）を取り込んだ場合
- sale_records: quantity=-1, amount=-385（売上がマイナス）
- inventory_movements: quantity=+1（在庫が1個戻る）, movement_type='sale_auto'

### movement_typeの値

| 値 | 意味 | quantityの符号 | 発生元 |
|---|------|---------|--------|
| sale_auto | CSV取込みによる販売 | マイナス（返品時はプラス） | REQ-401 |
| sale_manual | 手動販売出庫 | マイナス | REQ-203 |
| receiving | 仕入入庫 | プラス | REQ-201 |
| return | 返品・交換（レジ未処理分のみ） | プラス（戻り） or マイナス（渡し） | REQ-202 |
| disposal | 廃棄・破損 | マイナス | REQ-204 |
| stocktake | 棚卸し補正 | プラス or マイナス | REQ-205 |

### 設計意図
- **全ての在庫変動を1テーブルに集約した理由**: 在庫変動履歴画面で「この商品に何が起きたか」を時系列で表示するため。入庫・販売・返品・廃棄・棚卸しの全てがここに入る
- **reference_type + reference_idの理由（ポリモーフィック関連）**: 「この変動の元の操作」を追跡する。例えばreference_type="receiving_record", reference_id=42なら、入庫記録ID:42が原因。SQLiteでは外部キー制約で強制できないため、アプリケーション側で整合性を担保
- **reference_typeの許容値をCHECK制約で固定した理由（指摘#11対応）**: ポリモーフィック関連のリスク軽減。アプリが想定外の値を書き込むのを防ぐ
- **stock_afterの理由**: 変動後の在庫数を記録しておくと、在庫推移のグラフ表示が高速になる。毎回前のレコードからの累積計算が不要
- **is_voidedの理由（指摘#3対応）**: CSVロールバック時に物理削除ではなく論理無効化で統一。操作ログとの整合性を保つ
- **通常取消と is_voided の使い分け（2026-06-27 追加）**: 業務記録の通常取消は元 movement を隠さず、逆方向 movement を追加して追跡可能にする。`is_voided=1` は CSV取込み rollback のように取込み自体を通常履歴から外す用途に限定する。完成形では `movement_kind` / `reversal_of_movement_id` の追加を検討する（[65-inventory-record-traceability.md](../function-design/65-inventory-record-traceability.md) §65.6）。

### 困りそうなケース
- **レジ戻し処理済みの返品**: register_processed=1の返品は、CSV取込み時にZ004のマイナス値を読んで、sale_recordsにはquantity=-1（売上帳票視点）、inventory_movementsにはquantity=+1（在庫視点: 在庫が1個戻る）として記録される。return_recordsは帳面記録のみで、独自のinventory_movementsは作らない。これにより二重計上を防ぐ

---

## 15. price_history（価格変更履歴）

### 役割
商品の売価・原価の変更履歴。商品修正画面の「価格履歴」セクション（REQ-102）のデータソース。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 履歴ID |
| product_code | TEXT | FK → products.product_code, NOT NULL | 商品コード |
| old_selling | INTEGER | NOT NULL | 変更前売価 |
| new_selling | INTEGER | NOT NULL | 変更後売価 |
| old_cost | INTEGER | NOT NULL | 変更前原価 |
| new_cost | INTEGER | NOT NULL | 変更後原価 |
| changed_at | TEXT | NOT NULL | 変更日時 |

### 設計意図
- **inventory_movementsとは別テーブルにした理由**: 価格変更は在庫の増減を伴わない。在庫変動履歴テーブルに混ぜると変動種別が増えて複雑になる

---

## 16-17. stocktakes + stocktake_items（棚卸し）

### 役割
年末棚卸しの記録。10月〜大晦日の長期作業に対応する中断・再開機能付き。

### stocktakes カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 棚卸しID |
| started_at | TEXT | NOT NULL | 開始日時 |
| completed_at | TEXT | NULLABLE | 完了日時。NULLなら作業中 |
| status | TEXT | NOT NULL, DEFAULT 'in_progress' | 状態。'in_progress' / 'completed' |
| total_cost | INTEGER | NULLABLE | 仕入原価総額（税理士報告用）。確定時に計算 |

### stocktake_items カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 明細ID |
| stocktake_id | INTEGER | FK → stocktakes.id, NOT NULL | 親ヘッダ |
| product_code | TEXT | FK → products.product_code, NOT NULL | 商品コード |
| system_stock | INTEGER | NOT NULL | カウント時点のシステム在庫 |
| actual_count | INTEGER | NULLABLE | 実カウント数。NULLなら未入力 |
| valuation_cost_price | INTEGER | NULLABLE | 確定時の評価原価（円）。total_costはこの値×actual_countの合計 |
| counted_at | TEXT | NULLABLE | カウント日時（YYYY-MM-DDTHH:MM:SS）。NULLなら未入力 |

### 設計意図
- **system_stockを明細に持つ理由**: 棚卸し中もCSV取込みで在庫が動く（SP-205-09修正）。差異の表示は「現在のproducts.stock_quantity - actual_count」で動的計算。system_stockは「カウントした時点のシステム在庫」を参考値として記録
- **actual_countがNULLABLE**: 4000商品中、まだカウントしていない商品はNULL。NULLの件数が「未入力」の件数として進捗バーに使われる
- **valuation_cost_priceの理由（指摘#4対応）**: 棚卸し確定時の原価を固定保存。商品マスタの原価が後から変わってもtotal_costがブレない。棚卸し確定時にproducts.cost_priceの値をコピーしてくる
- **total_costの理由**: 棚卸し確定時に「全商品のvaluation_cost_price×actual_count」を合計した仕入原価総額を算出（SP-205-08、税理士報告用）

### 困りそうなケースと対応方針（2026-03-28 確定）

**ケース1: 棚卸し中に商品が新規登録された**
- 問題: stocktake_itemsに対応する行がなく、棚卸し一覧に表示されない。total_cost（仕入原価総額）が過小になり税理士報告に影響
- 対応方針: **案A（商品登録時に自動追加）を採用**。商品新規登録（REQ-101）の処理で、status='in_progress'のstocktakesがあれば、stocktake_itemsに自動INSERT（actual_count=NULL, system_stock=登録時の在庫数）。棚卸し画面に「未入力」として自動的に現れる
- 不採用案: 案B（棚卸し画面を開いたときに差分チェック）は、画面を開かないまま確定するフローがあると漏れるリスクがあるため不採用

**ケース2: 年に2回棚卸しをしたい**
- 対応方針: status='in_progress'のstocktakesが1件でもあれば、新しい棚卸しの開始をブロック。「進行中の棚卸しを完了してから新しい棚卸しを始めてください」と案内。完了後は新規作成可能
- チェック箇所: 棚卸し画面の「新規棚卸し開始」ボタン押下時にアプリ側でチェック

**ケース3: 棚卸し中に商品が廃番になった**
- 問題: 既にstocktake_itemsに行があるが、商品が廃番になった。カウント対象にすべきか
- 対応方針: 在庫が0になっている廃番商品はカウント不要。actual_count=0として自動入力。在庫が残っている廃番商品はカウント対象（実際に棚に残っている可能性がある）

---

## 18. operation_logs（操作ログ）

### 役割
システムの主要操作を日時付きで記録。トラブル時の追跡用。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | ログID |
| operation_type | TEXT | NOT NULL | 操作種別（例: product_create, csv_import, backup等） |
| summary | TEXT | NOT NULL | 概要（1行。操作ログ画面のテーブルに表示） |
| detail_json | TEXT | NULLABLE | 詳細情報（JSON文字列。例: 変更前後の値等） |
| created_at | TEXT | NOT NULL | 操作日時 |

### 設計意図
- **detail_jsonの理由**: 操作の種類によって保持したい情報が違う。CSV取込みならファイル名・件数・金額、商品修正なら変更前後のフィールド名・値。カラムをいちいち追加するよりJSON文字列で柔軟に格納する
- **業務記録との役割分担（2026-06-27 追加）**: operation_logs は監査・保守ログであり、入出庫の明細・金額・取消/訂正の正本ではない。関連 record_type / record_id を detail_json に含めてもよいが、在庫変動の根拠表示は業務記録詳細と inventory_movements が担う。

---

## 19. app_settings（アプリ設定）

### 役割
システム全体の設定値をキー・バリューで格納。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| key | TEXT | PK | 設定キー |
| value | TEXT | NOT NULL | 設定値 |
| updated_at | TEXT | NOT NULL | 更新日時 |

### 初期データ例

| key | value | 説明 |
|-----|-------|------|
| stock_low_threshold | 3 | 在庫少の閾値（個） |
| stock_low_threshold_fabric | 500 | 在庫少の閾値（cm、生地用） |
| backup_enabled | 1 | 自動バックアップON/OFF |
| backup_time | 23:00 | バックアップ時刻 |
| backup_path | C:\在庫管理\backup\ | バックアップ保存先 |
| backup_retention_days | 3 | バックアップ保持日数 |
| tax_rate_standard | 10 | 標準税率 |
| tax_rate_reduced | 8 | 軽減税率 |
| last_plu_export_at | 2026-03-21T15:00:00 | 最後のPLU書出し日時 |
| log_retention_days | 365 | 操作ログ保持日数 |
| log_last_cleanup_date | 2026-03-29 | 最後にログ削除チェックした日付 |
