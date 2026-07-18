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
- ROLLBACK 自体が失敗した場合の契約は **MNT-03-D1**（下記）に従う。`conn.execute_batch("ROLLBACK;").ok()` のような失敗の無言破棄は禁止

**MNT-03-D1: ROLLBACK / COMMIT 失敗の記録と併合**

- 決定: SQL 実行・バージョン記録・FK 検査の失敗後に実行する ROLLBACK が自身も失敗した場合、(1) `tracing::error!` で記録し、(2) 返す `DbError::MigrationFailed` のメッセージへ元エラーと ROLLBACK エラーを併合し、「transaction 状態不明」であることを明示する（例: `v{n} SQL実行失敗: {e}（ROLLBACK も失敗: {e2}、transaction 状態不明）`）。migration.rs / schema_v2.rs / schema_v3.rs（以降の schema_vN も同様）の全 ROLLBACK 箇所に共通ヘルパーで適用し、個別再実装をしない
- **COMMIT 失敗も本契約の対象とする（PR #14 Codex P2-3）**: SQLite は SQLITE_BUSY での COMMIT 失敗時に transaction を active のまま残す。COMMIT の Err を直接返す現行実装は transaction/lock 状態不明のままエラーを返す。契約: COMMIT 失敗時は `Connection::is_autocommit()` で transaction 状態を確認し、transaction 中なら ROLLBACK を試行して結果を上記の併合規則で報告する
- **PRAGMA foreign_keys 復元との関係**: `PRAGMA foreign_keys` は transaction 中は no-op のため、v2 の復元保証（scopeguard）は transaction が閉じた後にのみ有効。COMMIT 失敗で transaction が残ったまま復元 PRAGMA を実行しても効かない — 上記の状態確認 + ROLLBACK が復元保証の前提条件であることを明記する。復元は `is_autocommit()` で transaction が閉じたことを確認してから実行し、**`PRAGMA foreign_keys` の再読取で復元後の値が元値と一致することを検証する** — transaction 中の PRAGMA は成功を返しつつ no-op になり得るため、実行結果の記録だけでは復元を確認できない（PR #14 Codex 再レビュー P2）。transaction を閉じられない（ROLLBACK も失敗した）場合は復元を試みず、**接続の破棄を必須とする**構造化された致命エラーとして返す。復元 PRAGMA・再読取の失敗も本契約の記録対象とし、無言で握りつぶさない（現行実装は inner Err 時の復元失敗を無記録で通す）
- Why: ROLLBACK 失敗を `.ok()` で破棄すると、呼び出し元は transaction が閉じたと誤認する。接続が transaction 中または lock 保持のままなら後続処理が二次エラーを出し、最初の応答だけでは復旧不能状態を診断できない（監査 P3-1 系列の P3-3）。`.claude/rules/implementation-quality.md` の Result 握りつぶし禁止の適用でもある
- Rejected alternatives: ROLLBACK 失敗時の自動再試行（lock 起因では悪化するだけで、migration は起動時実行のため再起動が最短復旧）/ ROLLBACK 失敗を独立エラーとして元エラーを差し替える（一次原因を隠す）
- 見直し契機: migration を起動時以外から呼ぶ経路（例: 実行中の restore 後再初期化）を追加するとき

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

**foreign_keys=ON の復元保証**: COMMIT 後だけでなく、ROLLBACK やエラー時も PRAGMA foreign_keys=ON の復元を行う。ただし復元は MNT-03-D1（§3.2）の契約に従う: `is_autocommit()` で transaction が閉じたことを確認してから実行し、再読取で復元値を検証する。transaction を閉じられない場合は復元を試みず接続破棄必須の致命エラーとする — Drop トレイト / scopeguard で finally 相当を実装する場合も、この is_autocommit ゲートと検証を省略した無条件実行にしてはならない（transaction 中の PRAGMA は成功を返す no-op になり得るため）

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

## 12. MNT-03 追加: legacy path 移行（migrate_legacy_db）

旧実装が相対パス `inventory.db`（CWD）を使っていたため、起動時に CWD の旧 DB を `app_data_dir` 配下へ移行するフォールバック。従来この契約はコードコメント（PR #25 起源の「3ファイルセット」）にしか存在しなかったため、本節を正本とする（2026-07 監査 P3b-1 / P8b-3 起源）。

### 12.1 シグネチャ

```
fn migrate_legacy_db(
    old_dir: &std::path::Path,
    new_dir: &std::path::Path,
) -> Result<bool, std::io::Error>
```

戻り値: `Ok(true)` = 移行実行、`Ok(false)` = 移行不要（旧 DB 無し or 新 DB 既存）。シグネチャは現行と同一（`std::io::Error` に SQLite エラーを `std::io::Error::other` 相当で包む実装差し替えは可、実装 PR で決める）。

### 12.2 処理ステップ

1. `new_dir/inventory.db` の存在を確認。**既存なら `Ok(false)`**（この判定に旧 DB 側の情報は不要）。存在確認の metadata error はステップ 2 と同じく「無い」に潰さず `Err` として返す
2. 旧 DB の存在を確認する。**存在判定は metadata error を「無い」に潰さない**（`try_exists` 相当。error は `Err` として返す）。旧 DB が確実に無い → `Ok(false)`
3. 旧 DB を **create 能力なしで開く**（`SQLITE_OPEN_READ_WRITE` のみ、`SQLITE_OPEN_CREATE` を含めない `open_with_flags`。read-only にしないのは open 時の WAL recovery を SQLite に委ねるため、CREATE を外すのは存在確認後に旧 DB が消える TOCTOU で空の旧 DB を作らないため）。open 失敗 → `Err`
4. `VACUUM INTO '{new_dir}/inventory.db.migrating'` を実行（一時ファイル名。パスのシングルクォートは 71 §71.4 と同じ規約でエスケープ）
5. 旧 DB 接続を閉じる
6. `{new_dir}/inventory.db.migrating` → `{new_dir}/inventory.db` へ publish。**publish は no-clobber**: rename 直前に destination 不在を再確認し、既存 destination を置換しない手段を用いる。**実装 PR1 確定形**: 同一 directory の `std::fs::hard_link(staging, destination)` で destination 名を作成し、成功後に staging 名を unlink する（native Windows / Unix とも既存 destination は `AlreadyExists` で内容非置換。Rust std `rename` は採用しない）。destination が出現していた場合は一時ファイルを削除して `Err`（同時二重起動の直列化は single-instance ガードが担う — 71 §71.7 MNT-01-D5 の前提条件。no-clobber はガード障害時の defense-in-depth）
7. `Ok(true)` を返す。旧 3 ファイル（main/-wal/-shm）は削除しない（現行どおり手動削除の運用）

**呼び出し元の存在確認契約（PR #14 Codex P1-3）**: lib.rs は `std::env::current_dir()` の失敗を `if let Ok(cwd)` で無言 skip してはならない。ステップ 1 の「新 DB 既存 → skip」は CWD に依存しないため先に判定し、新 DB が無い場合の CWD 解決失敗・存在確認 error・その他の「旧 DB の有無を確定できない」状態はすべて `Err` として MNT-03-D4（fail-closed 起動中止）へ流す。「旧 DB が無い」と「有無を確認できない」を同じ skip に潰すと、P3b-1 の空 DB 隠蔽経路が discovery failure の形で残る

**MNT-03-D2: VACUUM INTO 方式の採用**

- 決定: 3 ファイル（main / -wal / -shm）の個別 file copy を廃止し、旧 DB を開いて `VACUUM INTO` で単一完全ファイルを生成する方式にする。WAL に残る commit 済み変更の取込みが SQLite の保証になる
- Why: 個別 copy 方式は「本体成功 + WAL 失敗」の部分状態を作り得る。WAL にのみ存在する commit 済み在庫・売上更新を欠いた DB が起動対象になり、新 DB 本体が既存になるため次回起動も移行を skip し欠落を自動回復できない（P3b-1）。WAL/SHM の意味論を自前で守る必要をなくすのが最短の構造的解決で、`VACUUM INTO` は 71 §71.4 create_backup で確立済みの慣用
- Rejected alternatives: 3 ファイル copy + WAL 失敗を致命扱い + 失敗時の部分削除（可能だが、SHM の要否・copy 順序・live WAL の整合など自前で守る意味論が残り続ける）
- 見直し契機: 旧 DB が SQLite として open 不能な破損個体への移行要求が実際に発生したとき（その場合 copy でも結局 init_database で開けないため、現時点では想定しない）

**MNT-03-D3: 「完成品しか存在しない」不変条件**

- 決定: `new_dir` の `inventory.db` は完成した移行結果としてのみ出現する。生成は一時名（`.migrating` 接尾辞）で行い、成功時のみ最終名へ rename する。ステップ 3〜6 のいずれかが失敗した場合は一時ファイルを削除して `Err` を返し、部分状態を残さない（次回起動で再試行可能）
- Why: 部分状態が最終名で残ると、次回起動の「新 DB 既存 → skip」判定が部分 DB を正当な移行結果として確定してしまう（P3b-1 の恒久 skip 経路）。一時ファイルの削除自体が失敗した場合は `.migrating` のまま残り、最終名判定に影響しない
- Rejected alternatives: 最終名へ直接生成 + 失敗時削除（削除自体の失敗で部分 DB が最終名に残る窓が閉じない）

### 12.3 エラーハンドリング

- 旧 DB open 失敗 / VACUUM INTO 失敗 / rename 失敗 → 一時ファイルを削除（削除失敗は `tracing::warn!` 記録）して `Err`
- `Err` 時の呼び出し元（lib.rs）の挙動は **MNT-03-D4** に従う

### 12.4 lib.rs 起動契約（MNT-03-D4）

- 決定: lib.rs setup hook は `migrate_legacy_db` の `Err` で起動を中止する（fail-closed）。中止時は operator へ可視のエラーダイアログで「旧データは無事であること・アプリ再起動で再試行されること・繰り返し失敗する場合の連絡誘導」を表示し、**表示完了（または表示不能の確定）後にのみ**終了する。詳細は診断ログに記録する
- **表示機構の制約（PR #14 Codex P2-2）**: `tauri_plugin_dialog` の `blocking_show` は公式 API doc が「main thread context で使用してはならない」と明記しており（vendored source lib.rs:355-356 で確認済み）、setup hook（main thread）での同期表示を機構として指定しない。**実装 PR1 確定形**: Windows は専用 worker thread で Win32 `MessageBoxW` を表示し、setup thread が `join` で表示完了を待ってから `Err` を返す。Contract Probe の native pre-window 表示で可視性を確認済み。thread panic / API 表示不能時も診断ログを残して fail-closed 起動中止を維持する（`blocking_show` worker は main-thread dispatch との相互待ち、callback は pre-window 可視化不能のため不採用）
- Why: 現行の「`tracing::error!` + 続行」は、直後の `init_database` が新パスに**空 DB を新規作成**するため、以後の起動は「新 DB 既存」で移行を永久 skip し、旧データが空 DB に隠蔽される（operator にはデータ全損に見え、空 DB への誤入力も進行する）。可視の起動失敗（データ無傷 + 再試行可能）の方が安全側
- 前提事実: 既存の setup 失敗経路（`app_data_dir` 取得失敗・`init_database` 失敗等の `?` / `.expect`）は release build（`windows_subsystem = "windows"`）では console が無く**無言クラッシュ**になる。本契約は新設する移行失敗経路のみ dialog 可視化を要求し、既存経路の可視化は scope 外（Plans.md backlog「起動時 setup 失敗の operator 可視化」）
- Rejected alternatives: 現行の「警告して続行」（上記の隠蔽経路そのもの）/ 移行 skip して旧パスの DB をそのまま使う（パス二重管理が恒久化し、app_data 移行の目的に反する）
- 見直し契機: 既存 setup 失敗経路の可視化 backlog を実装するとき（共通の起動失敗 dialog helper へ統合する）

### 12.5 テスト方針（実装 PR1 の完了条件、P8b-3）

fixture / 注入の必須条件は 71 §71.10「fixture / 注入の必須条件」に従う（実 WAL fixture は `wal_autocheckpoint=0` または作成側接続の保持 + 実行前の WAL frame 存在 assert、ファイル操作失敗は注入可能な file-ops 抽象で決定論的に起こす。clean close は WAL を checkpoint・削除するため「書いて閉じただけ」の fixture は WAL を持たない — PR #14 Codex P2-4）。

| テスト | 検証内容 |
|---|---|
| 実 WAL fixture 移行 | 上記条件を満たす実 SQLite DB（WAL frame 存在を事前 assert 済み）を移行し、新パスの DB を再 open して WAL 内 row を含む全データを検証する |
| VACUUM INTO 失敗注入 | failpoint で失敗させ、`Err` が返り、`new_dir` に `inventory.db`（最終名）が存在しないこと・再実行で移行が成功することを検証する |
| rename 失敗注入 | 一時ファイル → 最終名の rename を failpoint で失敗させ、同上の不変条件を検証する |
| no-clobber publish | rename 直前に destination を出現させ、既存 destination が置換されず `Err` になることを検証する（MNT-03-D2 ステップ 6） |
| 存在確認エラーの分離 | 旧 DB の存在確認 error（try_exists の Err 相当）と CWD 解決失敗を注入し、skip（`Ok(false)`）ではなく `Err` → MNT-03-D4 経路に入ることを検証する |
| NO_CREATE open | 存在確認後に旧 DB を削除（TOCTOU 相当）し、空の旧 DB が作成されず `Err` が返ることを検証する |
| 既存 skip 判定の回帰 | 新 DB 既存 / 旧 DB が確実に無い場合の `Ok(false)` 経路（既存テスト維持） |

エラーダイアログの pre-window（setup hook 内、webview マウント前）表示が Windows 実機で動作することの確認（表示機構の選定を含む、MNT-03-D4 の Contract Probe）も実装 PR1 の完了条件に含める（自動化不能なら L3 相当の手動確認として実装 packet に記録）。

実 WAL fixture 移行テストは MNT-03-D2 の前提（新規接続で開いた旧 DB への `VACUUM INTO` が WAL 内 commit を取り込む）の経験的検証を兼ねる。このテストが fail する場合は実装の不具合と決めつけず、MNT-03-D2 の設計自体を再検討する。
