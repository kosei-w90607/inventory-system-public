## MNT-01: バックアップ・リストア

### 71.1 モジュール構成

```
src-tauri/src/
  mnt/
    mod.rs        -- pub mod backup（既存宣言済み）
    backup.rs     -- バックアップ・リストア・自動チェック（本セクション）
  db/
    system_repo.rs -- get_setting, upsert_setting, insert_operation_log を使用
  lib.rs          -- setup hook に check_auto_backup 呼び出しを追加
```

---

### 71.2 依存クレート

追加なし。`chrono`（既存依存）と `rusqlite`（VACUUM INTO）を使用。

---

### 71.3 型定義

#### BackupResult構造体

```
#[derive(Debug, serde::Serialize)]
struct BackupResult {
    file_path: String,      // バックアップファイルの絶対パス
    file_name: String,      // ファイル名のみ（例: inventory_backup_20260413_130000.db）
    size_bytes: u64,        // ファイルサイズ
}
```

#### BackupInfo構造体

```
#[derive(Debug, serde::Serialize)]
struct BackupInfo {
    file_name: String,      // ファイル名
    file_path: String,      // 絶対パス
    size_bytes: u64,        // ファイルサイズ
    created_at: String,     // ファイル名から抽出した日時（YYYY-MM-DD HH:MM:SS）
}
```

#### バックアップファイル名規約

`inventory_backup_{YYYYMMDD}_{HHMMSS}.db`

例: `inventory_backup_20260413_130000.db`

---

### 71.4 create_backup

**関数要求**: SQLiteデータベースの安全なバックアップを作成する。WALモードでもデータ整合性を保証する

**シグネチャ**:
```
fn create_backup(
    conn: &DbConnection,
    backup_dir: &Path,
) -> Result<BackupResult, DbError>
```

**処理ステップ**:
1. `backup_dir` が存在しなければ `std::fs::create_dir_all` で作成
2. 現在日時からファイル名を生成: `inventory_backup_{YYYYMMDD}_{HHMMSS}.db`
3. バックアップ先パスを構築: `{backup_dir}/{ファイル名}`
4. `VACUUM INTO '{バックアップ先パス}'` を実行
   - VACUUM INTO はWAL変更を取り込んだ単一.dbファイルを生成する（SQLite 3.27+）
   - rusqlite 0.31はSQLite 3.45+をバンドルしているため利用可能
5. バックアップファイルのメタデータ（サイズ）を取得
6. `system_repo::insert_operation_log` で記録:
   - `operation_type`: `"backup_create"`
   - `summary`: `"バックアップを作成しました: {ファイル名}"`
   - `detail_json`: `Some(json!({"file_name": ..., "size_bytes": ...}))`
7. `BackupResult` を返す

**エラーハンドリング**:
- ディレクトリ作成失敗 → `DbError::QueryFailed` に変換して返す
- VACUUM INTO失敗（ディスク容量不足等）→ `DbError::QueryFailed` を返す
- 操作ログ記録失敗 → `tracing::warn!` で警告、バックアップ自体は成功扱い

**注意事項**:
- VACUUM INTO はパスをSQLリテラルとして渡す。パスにシングルクォートが含まれるケースを考慮し、エスケープまたはバリデーションを行う
- バックアップ先パスにシングルクォートが含まれる場合は `''` にエスケープする

---

### 71.5 cleanup_old_backups

**関数要求**: 保持日数を超えた古いバックアップファイルを削除する

**シグネチャ**:
```
fn cleanup_old_backups(
    backup_dir: &Path,
    retention_days: u32,
) -> Result<u32, std::io::Error>
```

戻り値: 削除したファイル数

**処理ステップ**:
1. `backup_dir` 内のファイル一覧を `std::fs::read_dir` で取得
   - ディレクトリが存在しない → `Ok(0)` を返す
2. 各ファイルについて:
   a. ファイル名が `inventory_backup_YYYYMMDD_HHMMSS.db` パターンに一致するか確認
   b. パターン不一致 → スキップ
   c. ファイル名からYYYYMMDD部分を抽出し `chrono::NaiveDate` にパース
   d. パース失敗 → スキップ
   e. `chrono::Local::now().date_naive() - file_date > retention_days` → 削除対象
   f. `std::fs::remove_file` で削除
   g. 削除失敗 → `tracing::warn!` で警告。次のファイルに進む
3. 削除したファイル数を返す

---

### 71.6 list_backups

**関数要求**: バックアップディレクトリ内のバックアップファイル一覧を返す

**シグネチャ**:
```
fn list_backups(backup_dir: &Path) -> Result<Vec<BackupInfo>, std::io::Error>
```

**処理ステップ**:
1. `backup_dir` 内のファイル一覧を `std::fs::read_dir` で取得
   - ディレクトリが存在しない → `Ok(vec![])` を返す
2. 各ファイルについて:
   a. ファイル名が `inventory_backup_YYYYMMDD_HHMMSS.db` パターンに一致するか確認
   b. パターン不一致 → スキップ
   c. ファイル名からYYYYMMDD_HHMMSS部分を抽出 → `YYYY-MM-DD HH:MM:SS` 形式に変換して `created_at` に格納
   d. `std::fs::metadata` でファイルサイズを取得
   e. `BackupInfo` を作成してリストに追加
3. `created_at` の降順（新しい順）でソート
4. リストを返す

---

### 71.7 restore_backup

**関数要求**: バックアップファイルからDBを復元する。DB接続を新しいものに切り替える

**シグネチャ**:
```
fn restore_backup(
    current_conn: DbConnection,
    backup_path: &Path,
    db_path: &Path,
) -> Result<DbConnection, DbError>
```

注意: `current_conn` は所有権を取得する（dropしてファイルロックを解放するため）

**処理ステップ**:
1. バックアップファイルの存在確認。存在しなければ `DbError::NotFound` を返す
2. 現在の接続でWALをフラッシュ: `PRAGMA wal_checkpoint(TRUNCATE)`
   - 失敗 → `tracing::warn!` で警告して続行。**この非致命扱いの根拠は、ステップ4で旧DB一式（WAL含む）を退避することにある。したがってステップ4の退避が成功する場合に限り有効**（MNT-01-D1）
3. `current_conn` をdrop（ファイルロック解放）
4. 現在のDBファイル一式を退避する。**main / 存在する WAL / 存在する SHM のすべてで退避（rename）成功が必須**:
   - `{db_path}` → `{db_path}.restore_backup`
   - `{db_path}-wal` → `{db_path}-wal.restore_backup`（存在する場合）
   - `{db_path}-shm` → `{db_path}-shm.restore_backup`（存在する場合）
   - いずれかの rename が失敗 → 退避済みファイルを元の名前へ巻き戻し、**本体置換に進まず** `DbError::QueryFailed` で restore を中止する（MNT-01-D1）
   - 巻き戻し自体がさらに失敗した場合 → ステップ 8e と同等の致命的エラーとして扱う（`tracing::error!` 記録、`DbError::QueryFailed`、アプリ再起動が必要）

**MNT-01-D1: 退避は一式成功が必須、失敗時は置換前に中止**

- 決定: 上記ステップ2/4 のとおり。checkpoint 失敗の非致命扱いは「旧 DB 一式を退避できた場合」に限定し、WAL/SHM の退避失敗を warn 継続にしない
- Why: checkpoint が失敗し WAL の退避も失敗した状態で本体だけ置換すると、旧 WAL が元の `{db_path}-wal` に残ったまま新 snapshot の `{db_path}` へ接続が開かれ、旧 WAL の再生で選択時点より後の変更が混入するか接続が失敗し得る（監査 P3b-2）。「指定 backup へ安全に復元」の成否を warn で決めてはならない
- Rejected alternatives: WAL 退避失敗時に WAL を削除して続行（checkpoint 失敗時の WAL は退避対象のデータそのものであり、削除は旧 DB 側の復元可能性を壊す）
- 見直し契機: restore の実装を接続 API ベース（`rusqlite::backup` 等）へ置き換えるとき
5. バックアップファイルを `{db_path}` にコピー
6. `db::init_database(db_path)` で新しい接続を作成
   - PRAGMA再設定＋マイグレーション実行が含まれる
7. 成功の場合:
   a. 退避ファイルを削除（`.restore_backup` ファイル群）
   b. `system_repo::insert_operation_log` で記録:
      - `operation_type`: `"backup_restore"`
      - `summary`: `"バックアップから復元しました: {ファイル名}"`
   c. 新しい `DbConnection` を返す
8. 失敗の場合（ステップ5-6でエラー）:
   a. 退避ファイルから復元: `{db_path}.restore_backup` → `{db_path}`
   b. WAL/SHMも復元（存在する場合）
   c. 退避ファイル削除
   d. `DbError::QueryFailed` を返す（元のDBファイルは復元済みだが、接続は呼び出し元が再確立する必要がある）
   e. 退避からの復元も失敗した場合 → `DbError::QueryFailed` で致命的エラー

**重要: 失敗時の契約**
- `restore_backup` は失敗時に `Err(DbError)` を返す。この時点でDBファイルは退避から復元済みだが、有効なDbConnectionは返さない
- **CMD層が `?` で早期returnすると、Mutex内がdummy接続のまま残り、以降の全コマンドが失敗する**
- CMD層は必ず `match` で処理し、`Err` パスでも `init_database` で有効な接続を再確立してguardに入れること

**CMD層での呼び出しパターン**:
```
let mut guard = state.db.lock().map_err(|_| CmdError::internal(...))?;
let dummy = rusqlite::Connection::open_in_memory().map_err(...)?;
let old_conn = std::mem::replace(&mut *guard, dummy);
let db_path = app_data.join("inventory.db");  // ファイルパス（ディレクトリではない）

match mnt::backup::restore_backup(old_conn, &backup_path, &db_path) {
    Ok(new_conn) => {
        *guard = new_conn;
        Ok(())
    }
    Err(e) => {
        // restore_backup内で退避からDBファイルは復元済み
        // dummy接続を有効な接続に差し替える（これを怠ると以降全コマンド死亡）
        match db::init_database(db_path.to_str().unwrap_or("")) {
            Ok(recovered) => *guard = recovered,
            Err(e2) => tracing::error!(error = %e2, "DB接続の復旧にも失敗"),
        }
        Err(CmdError::internal(&format!("バックアップの復元に失敗: {}", e)))
    }
}
```

**エラーハンドリング**:
- バックアップファイル不在 → `DbError::NotFound`
- コピー失敗 → 退避から復元を試みてから `Err` を返す
- init_database失敗 → 退避から復元を試みてから `Err` を返す
- 退避からの復元も失敗 → `DbError::QueryFailed`（致命的。アプリ再起動が必要）

---

### 71.8 check_auto_backup

**関数要求**: 自動バックアップの条件を判定し、必要なら実行する。setup hook（起動時）とフロントエンドタイマー（60秒間隔）から呼ばれる

**シグネチャ**:
```
fn check_auto_backup(
    conn: &DbConnection,
    backup_dir: &Path,
) -> Result<bool, DbError>
```

戻り値: `true` = バックアップ実行、`false` = スキップ

**処理ステップ**:
1. `system_repo::get_setting(conn, "backup_enabled")` を取得
   - `None` or 値 ≠ "1" → `Ok(false)` を返す
2. 今日の日付を `YYYYMMDD` 形式で取得
3. `backup_dir` 内のファイルを走査し、今日のバックアップが存在するか確認
   - ファイル名が `inventory_backup_{今日のYYYYMMDD}_` で始まるものがあるか
4. 今日のバックアップが1件もない場合:
   - `create_backup(conn, backup_dir)` を実行
   - `cleanup_old_backups` を実行（保持日数は **MNT-01-D3** の確定条件を満たす場合のみ）
   - `Ok(true)` を返す
5. 今日のバックアップがある場合:
   a. `system_repo::get_setting(conn, "backup_time")` を取得
   b. `None` or 空文字 → `Ok(false)` を返す（定時バックアップ未設定）
   c. `backup_time` を `HH:MM` 形式でパース。現在時刻と比較
   d. 現在時刻 < `backup_time` → `Ok(false)` を返す（まだ時間前）
   e. `backup_time` 以降に作成されたバックアップがあるか確認
      - ファイル名の `HHMMSS` 部分を `backup_time` と比較
   f. `backup_time` 以降のバックアップなし → `create_backup` + `cleanup_old_backups` を実行 → `Ok(true)`
   g. `backup_time` 以降のバックアップあり → `Ok(false)`

**エラーハンドリング**:
- `backup_dir` の読み取り失敗 → `DbError::QueryFailed` に変換
- `backup_time` のパース失敗 → 定時バックアップをスキップ（`tracing::warn!` で警告）
- `create_backup` 失敗 → エラーをそのまま返す
- `backup_retention_days` の読取失敗・parse 失敗 → **MNT-01-D3** に従い cleanup をスキップ

**MNT-01-D3: 破壊的 cleanup は保持日数を確定できた場合のみ実行**

- 決定: `cleanup_old_backups`（ファイル削除）を駆動する保持日数は、(a) `backup_retention_days` の読取が成功しかつ数値として parse できた、または (b) 設定行が存在しない（未設定 = 初期状態、既定 3 日を適用）、のどちらかの場合のみ確定とする。**DB error での読取失敗、および設定値はあるが数値として parse できない場合は、既定値へ fallback せず cleanup 自体をスキップ**して `tracing::warn!` を記録する（バックアップ作成の成否には影響させない）
- Why: 読取失敗を既定 3 日へ潰すと、例えば 90 日保持を設定済みの利用者の設定読取だけが失敗したとき、4 日目以降のバックアップを誤って削除する（監査 P3-1 の中核経路）。cleanup の skip は「バックアップが溜まる」方向の安全な失敗であり、次回成功時に自然回復する
- Rejected alternatives: 現行の `.ok().flatten().unwrap_or(3日)`（destructive fallback そのもの）/ parse 失敗も既定適用（未設定と設定破損を区別できず、破損時に削除が走る）
- 見直し契機: 設定値の書込み時 validation（数値以外を保存不能にする）が導入され、parse 失敗経路が構造的に消えたとき

---

### 71.9 lib.rs 起動シーケンスの変更

**追加箇所**: MNT-02 操作ログ自動削除（ステップ6）の後、State管理（ステップ8）の前

```
// 7. 自動バックアップチェック（起動時）
// backup_dir は設定値を優先、未設定/空ならデフォルト（app_data/backups）
// 設定読取の DB error 時はチェックをスキップして起動継続（MNT-01-D2）
match mnt::backup::resolve_backup_dir(&conn, &app_data) {
    Ok(backup_dir) => {
        if let Err(e) = mnt::backup::check_auto_backup(&conn, &backup_dir) {
            tracing::warn!(error = %e, "自動バックアップチェックに失敗");
        }
    }
    Err(e) => tracing::warn!(error = %e, "バックアップ保存先の設定読取に失敗（自動バックアップをスキップ）"),
}
```

**resolve_backup_dir（共通ヘルパー）**:
```
pub fn resolve_backup_dir(conn: &DbConnection, app_data: &Path) -> Result<PathBuf, DbError> {
    let setting = system_repo::get_setting(conn, "backup_path")?; // DB error は握りつぶさず返す
    Ok(setting
        .filter(|p| !p.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| app_data.join("backups")))
}
```
全てのバックアップ操作（create/list/check/restore）はこのヘルパーで統一的にbackup_dirを決定する。

**MNT-01-D2: resolve_backup_dir は DB error と未設定を区別する（Result 化）**

- 決定: `get_setting` の DB error は `Err` として呼び出し元へ返し、既定ディレクトリへの fallback は「未設定または空文字」の場合に限る。本節の旧コード例（`.ok().flatten()` で両者を潰す形）は設計自体の欠陥だったため書き換えた（監査 P3-1 補強）。呼び出し元の契約:
  - lib.rs 起動時チェック: `Err` → `tracing::warn!` を記録して自動バックアップチェックをスキップし、起動は継続する
  - CMD 層（settings_cmd）: `Err` → internal error として返す（既存の error 変換規約どおり）
- Why: 設定済みの外部 backup path を DB error で読めないとき、無言で app data 配下へ fallback すると、バックアップの保存先誤認と、誤ったディレクトリに対する cleanup 実行につながる。「設定が無い」と「設定を読めない」は破壊的操作の前提として同値ではない
- D-032（復元前強制バックアップ、break-glass 含む）との整合: 当該経路は `create_backup` 呼び出し時に DB error が internal error として伝搬する既存挙動のままで矛盾しない
- Rejected alternatives: 現行どおり PathBuf を直接返し内部で warn だけ残す（呼び出し元が失敗を分岐できず、cleanup skip 等の安全側判断につなげられない）
- 見直し契機: backup 設定の保存構造を app_settings 以外へ移すとき

---

### 71.10 テスト方針

| テスト名 | 検証内容 |
|---------|---------|
| `test_create_backup_mnt01_creates_file` | VACUUM INTO でバックアップファイルが生成される |
| `test_create_backup_mnt01_filename_format` | ファイル名が `inventory_backup_YYYYMMDD_HHMMSS.db` 形式 |
| `test_create_backup_mnt01_data_integrity` | バックアップDBに現在のデータが含まれる |
| `test_create_backup_mnt01_logs_operation` | operation_type='backup_create' のログが記録される |
| `test_cleanup_old_backups_mnt01_deletes_expired` | 保持日数超過ファイルが削除される |
| `test_cleanup_old_backups_mnt01_keeps_recent` | 保持日数内のファイルが保持される |
| `test_list_backups_mnt01_returns_sorted` | 新しい順でBackupInfoが返される |
| `test_list_backups_mnt01_empty_dir` | 空ディレクトリで空Vecが返される |
| `test_restore_backup_mnt01_replaces_data` | リストア後にバックアップ時点のデータに戻る |
| `test_restore_backup_mnt01_nonexistent_file` | 存在しないファイルでNotFoundエラー |
| `test_restore_backup_mnt01_runs_migration` | 古いバックアップ復元時にマイグレーションが実行される |
| `test_check_auto_backup_mnt01_disabled` | backup_enabled=0 でスキップ |
| `test_check_auto_backup_mnt01_no_backup_today` | 今日のバックアップなしで即実行 |
| `test_check_auto_backup_mnt01_already_backed_up` | 今日のバックアップありでスキップ |
| `test_check_auto_backup_mnt01_scheduled_time` | backup_time到達で2回目のバックアップ実行 |

**失敗注入テスト（実装 PR の完了条件、監査 P8b-3 起源）**: 成功系・早期 NotFound 系だけでは MNT-01-D1〜D3 の契約を検証できない。以下を restore / cleanup / 設定読取の実装変更と同じ PR に含め、ファイル名・存在の構造検査ではなく「障害後に元 snapshot または新 snapshot のどちらか一方が完全な形で残り、再接続可能」という意味的完了条件を検証する。

| テスト | 検証内容 |
|---------|---------|
| restore 退避失敗注入（MNT-01-D1） | 未 checkpoint の commit 済み row を WAL に持つ実 SQLite DB で、WAL/SHM の退避 rename を失敗させ（destination collision または注入可能な file-ops）、本体置換が行われず元 DB が WAL 込みで再接続可能なことを検証 |
| restore 成功系の WAL 意味論（MNT-01-D1） | checkpoint 成功/失敗の両系で、restore 後の DB がバックアップ時点のデータのみを持ち、旧 WAL の変更が混入しないことを再 open + row 検証で確認 |
| retention 読取失敗（MNT-01-D3） | `backup_retention_days` の読取 DB error / 非数値値を注入し、cleanup が実行されず（削除 0 件）warn が記録されることを検証 |
| retention 未設定（MNT-01-D3） | 設定行なしで既定 3 日が適用されることを検証（既存挙動の固定） |
| resolve_backup_dir の DB error（MNT-01-D2） | `get_setting` の DB error 注入で `Err` が返ることを検証（未設定/空文字 → 既定 dir と区別） |
