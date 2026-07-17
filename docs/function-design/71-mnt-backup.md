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

- 決定: 上記ステップ2/4 のとおり。checkpoint 失敗の非致命扱いは「旧 DB 一式を退避できた場合」に限定し、WAL/SHM の退避失敗を warn 継続にしない。「checkpoint 失敗」には SQL としては成功したが `PRAGMA wal_checkpoint(TRUNCATE)` の戻り行（busy / log / checkpointed の 3 列）が busy = 1 を示す不完全 checkpoint を含む — SQL 実行の成否だけで checkpoint 完了と判定しない
- Why: checkpoint が失敗し WAL の退避も失敗した状態で本体だけ置換すると、旧 WAL が元の `{db_path}-wal` に残ったまま新 snapshot の `{db_path}` へ接続が開かれ、旧 WAL の再生で選択時点より後の変更が混入するか接続が失敗し得る（監査 P3b-2）。「指定 backup へ安全に復元」の成否を warn で決めてはならない
- Rejected alternatives: WAL 退避失敗時に WAL を削除して続行（checkpoint 失敗時の WAL は退避対象のデータそのものであり、削除は旧 DB 側の復元可能性を壊す）
- 見直し契機: restore の実装を接続 API ベース（`rusqlite::backup` 等）へ置き換えるとき

**MNT-01-D4: 失敗時の復旧再接続は no-create、復旧不能は recoverable に偽装しない（PR #14 Codex P1-1）**

- 決定: restore の失敗は「**退避復元済み**（元 DB 一式を元の名前へ戻せた）」と「**状態不明/未復旧**（巻き戻し失敗・二重失敗を含む）」を区別して呼び出し元へ伝える。CMD 層の復旧再接続は次の契約に従う:
  - 「退避復元済み」の場合のみ再接続を試みる。再接続は **create 能力のない open**（`SQLITE_OPEN_CREATE` を含まない `open_with_flags`）で行い、成功時のみ recoverable（再試行可能エラー）として返す
  - 「状態不明/未復旧」の場合、または no-create 再接続が失敗した場合は、再接続を試みず unrecoverable（`アプリを再起動してください` を含む既存文言）を返す
  - 区別の伝搬は message 文字列比較に依存せず型・variant レベルで行う（DbError の variant 追加か戻り値の構造化かは実装 PR1 で確定）
- Why: 現行 CMD パターンの `db::init_database` による復旧は create 能力を持つため、二重失敗で main が `{db_path}.restore_backup` 側に残ったまま `{db_path}` が不在の状態では**空 DB を新規作成して migration まで成功**し、復旧不能な状態が recoverable として UI（68 §68.7 の `restore_failed_recovered`）に渡る。operator は「現在のデータに戻した」と誤認して空 DB へ入力を続ける — 本設計が塞ぐべき空 DB 隠蔽経路そのもの
- Rejected alternatives: 現行の create-capable `init_database` による復旧（上記の偽装経路）/ message 文字列での分岐追加のみ（文字列は契約として脆く、監査 P3-4 = 順 8 で是正予定の分裂をさらに深める）
- 見直し契機: 順 8（error 表示 contract 統一)で CmdError に相関 ID / kind 拡張が入るとき

**MNT-01-D5: restore の中断（process/power interruption）復旧契約（PR #14 Codex P1-2）**

- 決定: 逐次 rename は I/O エラーには MNT-01-D1 で巻き戻せるが、プロセス中断・電源断には原子的でない。次の marker + 起動時 reconcile で「元 snapshot または新 snapshot のどちらか一方が完全な形で残り再接続可能」の不変条件を再起動をまたいで保証する:
  - restore は最初のファイル mutation より前に durable marker `{db_path}.restore_inprogress` を作成し、**成功時は新接続確立の直後（退避ファイル削除より前）**、失敗時は巻き戻し完了後に削除する。ファイル mutation（退避 rename / 本体コピー / 巻き戻し）は marker 存在下でのみ行う
  - 起動シーケンス（lib.rs）は `init_database` より前に reconcile を実行する: marker または `.restore_backup` 遺物が存在する場合、**DB を開かず・新規作成もせず**、次の決定論的規則（3 分岐）で解消してから通常起動に進む
    - marker **あり** + 退避 main（`{db_path}.restore_backup`）**あり** = 復元は未完 → 退避を正とする。巻き戻しは「存在する退避ファイルごとに、対応する元名ファイルを削除してから rename で戻す」単位で行い、**退避側に存在しないファイルの元名は削除しない**。完了後に marker を削除する
    - marker **あり** + 退避 main **なし** = mutation 未着手のまま中断（marker 作成直後） → `{db_path}` 一式は無傷なのでファイル操作をせず、marker のみ削除する
    - marker **なし** + 退避遺物あり = 復元は完了済みで掃除だけが中断 → `{db_path}` 一式を正とし、退避遺物を削除する
  - reconcile 自体の失敗は起動中止（MNT-03-D4 と同じ fail-closed + operator 可視化）とし、遺物を残したまま `init_database` に進んで空 DB を作ることを禁止する
  - reconcile は **legacy 移行判定（22 §12）より前に**実行する。restore 中断で `{db_path}` が不在の間に legacy 移行判定が走ると「新 DB 無し」と誤認して旧 CWD DB を publish し得るため、順序は reconcile → legacy 移行判定 → `init_database` で固定する
- Why: 退避 rename 後・コピー完了前に中断すると `{db_path}` が不在になり、現行起動は `init_database` が空 DB を新規作成して実データ（退避側に無傷で存在）を隠蔽する。marker の有無を「`{db_path}` を信頼してよいか」の判定基準にすることで、全中断タイミングで解消先が一意に決まる。marker 削除を退避削除より前に置くのは、成功後の掃除中断を「main 優先」で解消するため。なお「新接続確立直後〜marker 削除前」の中断だけは、完了していた復元が reconcile で旧データへ巻き戻る（不変条件には違反しない安全側の挙動。operator は復元を再実行すればよく、この挙動は受容して文書化する）
- Rejected alternatives: attempt ごとの一意 staging 名 + manifest（単一 instance のデスクトップ app には過剰で、固定名 + marker で決定論を確保できる。多重 attempt の残骸は reconcile が毎起動で先に解消する）/ reconcile なしで「退避があれば常に戻す」（成功後の掃除中断で完了済みの復元が巻き戻り、operator の操作結果を無効化する）
- 見直し契機: single-instance ガード（Plans.md backlog）導入時、または restore を接続 API ベースへ置き換えるとき
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
- `restore_backup` は失敗時に「退避復元済み」か「状態不明/未復旧」かを区別できる `Err` を返す（MNT-01-D4）。有効なDbConnectionは返さない
- **CMD層が `?` で早期returnすると、Mutex内がdummy接続のまま残り、以降の全コマンドが失敗する**
- CMD層は必ず `match` で処理する。`Err` パスの再接続は MNT-01-D4 に従う: 「退避復元済み」の場合のみ **no-create open** で再接続し、それ以外（状態不明/未復旧、または no-create 再接続の失敗）は unrecoverable（再起動誘導文言）を返す。create 能力のある `init_database` を復旧再接続に使ってはならない

**CMD層での呼び出しパターン**（設計レベルの擬似コード。error 型の具体形は実装 PR1 で確定）:
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
    Err(restore_err) if restore_err.is_evacuation_restored() => {
        // 退避復元済み: no-create open で再接続（空 DB を新規作成しない。MNT-01-D4）
        match db::open_existing(&db_path) {  // SQLITE_OPEN_CREATE なしの open + PRAGMA 再設定
            Ok(recovered) => {
                *guard = recovered;
                Err(CmdError::internal(&format!("バックアップの復元に失敗: {}", restore_err)))
            }
            Err(e2) => {
                tracing::error!(error = %e2, "DB接続の復旧にも失敗");
                Err(CmdError::internal(
                    "バックアップの復元に失敗し、DB接続の復旧もできませんでした。アプリを再起動してください",
                ))
            }
        }
    }
    Err(restore_err) => {
        // 状態不明/未復旧: 再接続を試みず unrecoverable（68 §68.7 の terminal 分岐へ）
        tracing::error!(error = %restore_err, "復元後の DB 状態が確定できません");
        Err(CmdError::internal(
            "バックアップの復元に失敗し、DB接続の復旧もできませんでした。アプリを再起動してください",
        ))
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

**失敗注入テスト（実装 PR の完了条件、監査 P8b-3 起源）**: 成功系・早期 NotFound 系だけでは MNT-01-D1〜D5 の契約を検証できない。以下を restore / cleanup / 設定読取の実装変更と同じ PR に含め、ファイル名・存在の構造検査ではなく「障害後に元 snapshot または新 snapshot のどちらか一方が完全な形で残り、再接続可能」という意味的完了条件を検証する。

**fixture / 注入の必須条件（PR #14 Codex P2-4）**: 偽陽性（旧実装でも green になるテスト）を防ぐため次を必須とする。
- 実 WAL fixture: SQLite は最後の接続の clean close で WAL を checkpoint して削除するため、「書いて閉じただけ」の DB は WAL frame を持たない。`wal_autocheckpoint=0` を設定するか作成側接続を開いたまま保持し、**テスト実行前に WAL ファイルが非自明なサイズ（frame を含む）で存在することを assert** してから対象処理を実行する
- ファイル操作の失敗注入: destination collision や権限変更は OS ごとに失敗にならない場合がある（Rust の `rename` は既存 destination を置換し得る）。rename / copy / remove の失敗は **注入可能な file-ops 抽象（failpoint）** で決定論的に起こす
- checkpoint の成否判定: `PRAGMA wal_checkpoint(TRUNCATE)` は SQL としては成功しても busy を返し得る。テストは戻り行 3 列（busy / log / checkpointed）を検査し、busy = 1 の不完全 checkpoint を明示的に作る系を含める

| テスト | 検証内容 |
|---------|---------|
| restore 退避失敗注入（MNT-01-D1） | 上記条件を満たす実 WAL fixture で、WAL/SHM の退避 rename を failpoint で失敗させ、本体置換が行われず元 DB が WAL 込みで再接続可能なことを検証 |
| restore 成功系の WAL 意味論（MNT-01-D1） | checkpoint 完了/busy 両系で、restore 後の DB がバックアップ時点のデータのみを持ち、旧 WAL の変更が混入しないことを再 open + row 検証で確認 |
| 二重失敗の unrecoverable 化（MNT-01-D4） | 巻き戻し失敗を注入して main 不在の状態を作り、CMD 復旧が空 DB を新規作成せず unrecoverable を返すことを検証（現行の create-capable 復旧では空 DB が作られ recoverable に化けることの回帰固定） |
| 中断 reconcile（MNT-01-D5） | 各ファイル mutation 直後で処理を打ち切る failpoint で中断状態（marker あり main 不在 / marker あり main 部分 / marker なし退避遺物あり）を作り、起動時 reconcile 後に元 DB 一式（または完了済み restore 結果）が再接続可能で遺物ゼロなことを検証 |
| retention 読取失敗（MNT-01-D3） | `backup_retention_days` の読取 DB error / 非数値値を注入し、cleanup が実行されず（削除 0 件）warn が記録されることを検証 |
| retention 未設定（MNT-01-D3） | 設定行なしで既定 3 日が適用されることを検証（既存挙動の固定） |
| resolve_backup_dir の DB error（MNT-01-D2） | `get_setting` の DB error 注入で `Err` が返ることを検証（未設定/空文字 → 既定 dir と区別） |
