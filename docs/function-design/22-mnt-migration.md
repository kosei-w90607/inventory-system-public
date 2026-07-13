## 3. MNT-03: スキーママイグレーション

### 3.1 モジュール構成

```
src-tauri/src/
  db/
    migration.rs  -- マイグレーション管理
    schema_v1.rs  -- 初期スキーマ
    schema_v2.rs  -- 冪等性カラム追加（4テーブル再作成）
    schema_v3.rs  -- PLU対象フラグ追加
    schema_v4.rs  -- 日報取込みテーブル追加
```

### 3.2 migrate

**関数要求**: schema_versionsテーブルを確認し、未適用のマイグレーションを順番に実行する

**シグネチャ**:
```
fn migrate(conn: &DbConnection) -> Result<(), DbError>
```

**処理ステップ**:
1. schema_versionsテーブルの存在チェック（SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'）
2. 存在しない → create_schema_versions_table() を呼ぶ
3. SELECT MAX(version) FROM schema_versions → current_version（NULLなら0）
4. コード内のマイグレーションリスト（MIGRATIONS定数）からcurrent_versionより大きいものを取得
5. 各マイグレーションについて順番に:
   a. BEGIN
   b. SQLを実行
   c. INSERT INTO schema_versions (version, applied_at) VALUES (?, 現在日時)
   d. COMMIT
   e. いずれかのステップで失敗 → ROLLBACK → DbError::MigrationFailed(詳細)を返す（詳細にはバージョン番号と失敗SQLの概要を含める）
6. 全て成功 → Ok(())

**エラーハンドリング**:
- 個々のマイグレーションSQL失敗 → そのバージョンのROLLBACK。それ以降は実行しない
- エラーメッセージにはバージョン番号と失敗したSQLの概要を含める

### 3.3 get_initial_schema

**関数要求**: バージョン1の初期スキーマ（18テーブルのCREATE TABLE文）を返す

**シグネチャ**:
```
fn get_initial_schema() -> &'static str
```

**処理ステップ**:
1. DB_DESIGN.mdの全18テーブル定義に基づくCREATE TABLE文を文字列定数として返す
2. CHECK制約、INDEX、初期データINSERT（departments 21件、app_settings初期値）も含む

---

## 9. MNT-03 追加: migration v2（冪等性カラム）

migration v2 を schema_versions に追加。対象テーブル: receiving_records, return_records, manual_sales, disposal_records

**追加カラム（4テーブル共通）**:
- idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) > 0)
- request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint) > 0)

**手順（テーブル再作成方式）**:
SQLite の UNIQUE は NULL を複数許容するため、ALTER TABLE ADD COLUMN（NULLABLE）では冪等性保証が破綻する。テーブル再作成で NOT NULL を正しく担保する。

```
PRAGMA foreign_keys = OFF
BEGIN
  -- 4テーブルそれぞれについて:
  1. CREATE TABLE {table}_new（完全DDL: 列順・CHECK・DEFAULT・FK を全て明示。省略禁止）
  2. INSERT INTO {table}_new (列一覧) SELECT (列一覧), '__legacy__:' || id, '__legacy__' FROM {table}
     - SELECT * 禁止。列マッピングを明示
  3. DROP TABLE {table}
  4. ALTER TABLE {table}_new RENAME TO {table}
  5. CREATE UNIQUE INDEX idx_{table}_idempotency ON {table}(idempotency_key)

  -- 全4テーブル完了後:
  PRAGMA foreign_key_check
  - 結果件数 > 0 → ROLLBACK → DbError::MigrationFailed で中断
  - （foreign_key_check は結果行を返すだけで自動failしないため、コード側で件数チェック必須）
COMMIT
PRAGMA foreign_keys = ON
```

**FK制御の理由**: foreign_keys=ON のまま DROP TABLE すると子テーブル参照が壊れるリスクがある

**foreign_keys=ON の復元保証**: COMMIT 後だけでなく、ROLLBACK やエラー時も必ず PRAGMA foreign_keys=ON を実行する。Rust 実装では Drop トレイトまたは scopeguard で finally 相当の復元を保証する

**完全DDLの構築**: 各テーブルの DDL は schema_v1.rs の定義 + 新カラム2列で構築する。実装時に schema_v1.rs と不整合がないことを確認する

## 10. MNT-03 追加: migration v3（plu_target カラム）

migration v3 を schema_versions に追加。対象テーブル: products（D-028 JANなし商品のPLU対象扱い）

**追加カラム**:
- plu_target BOOLEAN NOT NULL DEFAULT 0

**手順（ALTER TABLE 方式）**:
v2 がテーブル再作成を要した理由（UNIQUE NOT NULL は ALTER TABLE ADD COLUMN で担保できない）は plu_target に該当しない。UNIQUE 制約のない NOT NULL DEFAULT 付きカラムは ALTER TABLE で追加できる。

```
BEGIN
  1. ALTER TABLE products ADD COLUMN plu_target BOOLEAN NOT NULL DEFAULT 0
  2. backfill 更新文を実行:
     - is_discontinued=0 かつ jan_code が 13 桁数字の行 → plu_target=1
     - 13 桁数字の条件: `jan_code IS NOT NULL AND length(jan_code) = 13 AND jan_code NOT GLOB '*[^0-9]*'`（sqlite3 実機で検証済み: 有効13桁JAN=1、独自コード/英字混在/12桁=0）
     - それ以外（jan_code NULL / 13桁数字でない / 廃番）→ DEFAULT 0 のまま
  3. schema_versions に v3 を INSERT
COMMIT
```

**backfill の判定範囲**: JAN/EAN-13 チェックディジット検証は SQL で行わない。チェックディジット不正は BIZ-04 prepare の「要修正」バケット（PluExcludedReason::InvalidCheckDigit）がアプリ側で捕捉する。

**廃番商品の扱い**: backfill は廃番商品を plu_target=0 にする（レジ登録対象に戻さない）。廃番切替時に plu_target を自動で 0 にするかは、スロット解放と不可分のため PLUスロット永続割当の設計（Plans.md backlog）で決める。

## 11. MNT-03 追加: migration v4（日報取込みテーブル）

migration v4 を schema_versions に追加。対象は REQ-401 の Z001 / Z002 / Z005 日報取込み用新規テーブル 4 件。テーブル定義の正本は [../db-design/pos-tables.md](../db-design/pos-tables.md) §12b〜§12e とし、本節は migration 固有の適用方式・登録順・復旧方針を記録する。

**追加テーブル / CHECK制約 / index**:

| テーブル | CHECK制約 | index |
|---|---|---|
| daily_report_imports | `source_adapter IN ('casio_sr_s4000')`, `status IN ('completed','rolled_back')` | `idx_daily_report_imports_report_date` on `(report_date)`, `idx_daily_report_imports_bundle_hash` on `(bundle_hash)` |
| daily_report_summary_lines | `source_file IN ('Z001')` | `idx_daily_report_summary_lines_import_id` on `(daily_report_import_id)` |
| daily_report_payment_lines | `source_file IN ('Z002')` | `idx_daily_report_payment_lines_import_id` on `(daily_report_import_id)` |
| daily_report_department_lines | `source_file IN ('Z005')` | `idx_daily_report_department_lines_import_department` on `(daily_report_import_id, department_id)` |

各 line テーブルは `daily_report_import_id` で daily_report_imports を参照する。daily_report_department_lines の `department_id` は departments 参照で、DB design §12e の通り NULL を許容する。列定義や業務上の意味は db-design 側に集約し、ここでは重複記述しない。

**手順（新規 CREATE TABLE 方式）**:
v4 は既存テーブルを変更せず、`schema_v4::get_v4_daily_report_schema()` の SQL を `MigrationKind::Sql` として実行する。新規 `CREATE TABLE` 4 件と `CREATE INDEX` 5 件のみで、ALTER TABLE やテーブル再作成は伴わない。

v2 の判断基準では、既存データを保持したまま NOT NULL / UNIQUE 等の制約を後付けする場合にテーブル再作成が必要だった。v4 は既存行へ制約を追加せず、日報取込み用の空テーブルを追加するだけなので、v2 の foreign_keys OFF + 再作成パターンではなく通常の SQL migration で足りる。

```
BEGIN
  1. CREATE TABLE daily_report_imports
  2. CREATE TABLE daily_report_summary_lines
  3. CREATE TABLE daily_report_payment_lines
  4. CREATE TABLE daily_report_department_lines
  5. CREATE INDEX idx_daily_report_imports_report_date
  6. CREATE INDEX idx_daily_report_imports_bundle_hash
  7. CREATE INDEX idx_daily_report_summary_lines_import_id
  8. CREATE INDEX idx_daily_report_payment_lines_import_id
  9. CREATE INDEX idx_daily_report_department_lines_import_department
  10. schema_versions に v4 を INSERT
COMMIT
```

**MIGRATIONS 登録順**: `migration.rs` の migrations() は v1 → v2 → v3 → v4 の順に登録する。v4 の description は「日報取込みテーブル追加（daily_report_imports + lines）」で、kind は `MigrationKind::Sql(schema_v4::get_v4_daily_report_schema())`。v3 適用済みDBでは schema_versions の最大値が 3 から 4 へ進み、新規DBでは v1〜v4 が順に適用され schema_versions に4件記録される。

**backfill**: 不要。v4 は新規テーブルのみを追加し、既存の products / sale_records / inventory_movements / csv_imports 等を更新しない。日報取込みデータは migration 後の BIZ-08 commit で初めて daily_report_* テーブルに保存される。

**PRAGMA foreign_keys の扱い**: v4 は PRAGMA foreign_keys を変更しない。既存テーブルの DROP / RENAME を伴わないため、v2 のような OFF / foreign_key_check / ON 復元保証は不要。外部キー制約は接続側の通常設定に従い、migration SQL 内では daily_report_imports / departments への参照を定義するだけに留める。
