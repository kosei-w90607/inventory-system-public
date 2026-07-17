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
3.5. durable manifest `{db_path}.restore_manifest` を作成する（MNT-01-D5: attempt ID + 退避対象存在集合 + phase=active を記録し、書込み → `sync_all` → 親 directory sync の完了後にのみ次へ進む。前回の manifest / `.restore_backup` 遺物が残存していれば restore を開始せず Err）
4. 現在のDBファイル一式を退避する。**main / 存在する WAL / 存在する SHM のすべてで退避（rename）成功が必須**（rename は main → WAL → SHM の順、各 rename は親 directory sync で永続化。MNT-01-D5）:
   - `{db_path}` → `{db_path}.restore_backup`
   - `{db_path}-wal` → `{db_path}-wal.restore_backup`（存在する場合）
   - `{db_path}-shm` → `{db_path}-shm.restore_backup`（存在する場合）
   - いずれかの rename が失敗 → 退避済みファイルを元の名前へ巻き戻し、**本体置換に進まず** `DbError::QueryFailed` で restore を中止する（MNT-01-D1）。巻き戻し完了後は manifest を durable 削除する（Codex 再々レビュー P3）
   - 巻き戻し自体がさらに失敗した場合 → ステップ 8e と同等の致命的エラーとして扱う（`tracing::error!` 記録、`DbError::QueryFailed`、アプリ再起動が必要。manifest は残置し、次回起動の reconcile に委ねる）

**MNT-01-D1: 退避は一式成功が必須、失敗時は置換前に中止**

- 決定: 上記ステップ2/4 のとおり。checkpoint 失敗の非致命扱いは「旧 DB 一式を退避できた場合」に限定し、WAL/SHM の退避失敗を warn 継続にしない。「checkpoint 失敗」には SQL としては成功したが `PRAGMA wal_checkpoint(TRUNCATE)` の戻り行（busy / log / checkpointed の 3 列）が busy = 1 を示す不完全 checkpoint を含む — SQL 実行の成否だけで checkpoint 完了と判定しない
- Why: checkpoint が失敗し WAL の退避も失敗した状態で本体だけ置換すると、旧 WAL が元の `{db_path}-wal` に残ったまま新 snapshot の `{db_path}` へ接続が開かれ、旧 WAL の再生で選択時点より後の変更が混入するか接続が失敗し得る（監査 P3b-2）。「指定 backup へ安全に復元」の成否を warn で決めてはならない
- Rejected alternatives: WAL 退避失敗時に WAL を削除して続行（checkpoint 失敗時の WAL は退避対象のデータそのものであり、削除は旧 DB 側の復元可能性を壊す）
- 見直し契機: restore の実装を接続 API ベース（`rusqlite::backup` 等）へ置き換えるとき

**MNT-01-D4: 失敗時の復旧再接続は no-create、復旧不能は recoverable に偽装しない（PR #14 Codex P1-1）**

- 決定: restore の失敗は「**退避復元済み**（元 DB 一式を元の名前へ戻せた）」と「**状態不明/未復旧**（巻き戻し失敗・二重失敗を含む）」を区別して呼び出し元へ伝える。CMD 層の復旧再接続は次の契約に従う:
  - 「退避復元済み」の場合のみ再接続を試みる。再接続は **create 能力のない open**（`SQLITE_OPEN_CREATE` を含まない `open_with_flags`）で行い、成功時のみ recoverable（再試行可能エラー）として返す
  - 「状態不明/未復旧」の場合、または no-create 再接続が失敗した場合は、再接続を試みず unrecoverable（`アプリを再起動してください` を含む既存文言）を返す
  - 区別の伝搬は message 文字列比較に依存せず型・variant レベルで行う（DbError の variant 追加か戻り値の構造化かは実装 PR1 で確定）。**CMD → UI の伝搬も同様に構造化された分類識別子で行い、frontend が文言の部分一致で分岐しない**（68 §68.7 参照。Codex 再々レビュー P2-2）
- Why: 現行 CMD パターンの `db::init_database` による復旧は create 能力を持つため、二重失敗で main が `{db_path}.restore_backup` 側に残ったまま `{db_path}` が不在の状態では**空 DB を新規作成して migration まで成功**し、復旧不能な状態が recoverable として UI（68 §68.7 の `restore_failed_recovered`）に渡る。operator は「現在のデータに戻した」と誤認して空 DB へ入力を続ける — 本設計が塞ぐべき空 DB 隠蔽経路そのもの
- Rejected alternatives: 現行の create-capable `init_database` による復旧（上記の偽装経路）/ message 文字列での分岐追加のみ（文字列は契約として脆く、監査 P3-4 = 順 8 で是正予定の分裂をさらに深める）
- 見直し契機: 順 8（error 表示 contract 統一)で CmdError に相関 ID / kind 拡張が入るとき

**MNT-01-D5: restore の中断（process/power interruption）復旧契約（PR #14 Codex P1-2、再レビュー P1×3 で manifest 方式へ改訂）**

- 決定: 逐次 rename は I/O エラーには MNT-01-D1 で巻き戻せるが、プロセス中断・電源断には原子的でない。次の durable manifest + 起動時 reconcile で「元 snapshot または新 snapshot のどちらか一方が完全な形で残り再接続可能」の不変条件を再起動をまたいで保証する:
  - **前提: single-instance 保証**。本契約は同時に 1 プロセスのみが restore / reconcile / legacy 移行を実行することを前提とする。single-instance ガード（`tauri-plugin-single-instance` 等）の導入を**実装 PR1 の前提条件**とし、ガードなしで本契約を実装してはならない — 固定名の manifest / 退避名は多重プロセスに対して防御せず、後発 attempt の退避 rename が先発 attempt の旧 main を置換し得る（Codex 再レビュー P1-3）
  - restore は最初のファイル mutation より前に durable manifest `{db_path}.restore_manifest` を作成する。manifest は (a) 一意 attempt ID（診断・テスト固定用）、(b) **退避対象の存在集合**（`{db_path}` / `-wal` / `-shm` それぞれの退避開始時点での有無）、(c) **phase**（`active` = 作成時 / `committed` = 新接続確立済み）を記録する。**manifest の不在を「復元完了」の判定に使ってはならない** — 現行実装（manifest 導入前）も同じ固定退避名 `.restore_backup` を使っており（backup.rs:263）、manifest なしの退避遺物は「旧形式実装の任意時点中断の残骸（唯一の実データを含み得る）」と区別できない（Codex 再々レビュー P1-2）
  - **durability 契約**（Codex 再レビュー P1-2）: (a) manifest は「内容書込み → `sync_all` → 親 directory sync」の完了後にのみファイル mutation へ進む。(b) rename（退避・巻き戻し・元名復帰とも）は親 directory sync で永続化する。(c) 本体コピー完了後、`init_database` より前に新 main の `sync_all` + 親 directory sync を行う（userspace のコピー完了・page cache 経由の open 成功を永続化の根拠にしない）。(d) 成功時は新接続確立の直後（退避ファイル削除より前）に **phase=committed を原子的に durable 更新**（一時ファイル書込み + `sync_all` + rename + 親 directory sync）し、退避削除の完了後に manifest を durable 削除（unlink + 親 directory sync）する。失敗時は巻き戻し完了後に manifest を durable 削除する。phase=committed の永続化前に退避ファイルを削除してはならない
  - 退避 rename は main → WAL → SHM の順で固定する（ファイル mutation は manifest 存在下でのみ行う）
  - 起動シーケンス（lib.rs）は `init_database` より前に reconcile を実行する: manifest または `.restore_backup` 遺物が存在する場合、**DB を開かず・新規作成もせず**、次の決定論的規則で解消してから通常起動に進む
    - manifest **あり（phase=active）** + 退避側の実在集合が manifest 記録集合と**一致** = 退避完了後（本体コピー / 接続確立前）の中断。元名側に存在する DB 一式（main / WAL / SHM すべて — この attempt が生成した信頼できない世代）を削除してから、退避集合を rename で元名へ戻し、manifest を durable 削除する。記録集合に無い種別の元名側残骸（例: 元 DB が clean で WAL 無しと記録したのに `init_database` が生成した新世代 WAL が残る）もこの削除で必ず除去する — **存在ビットだけでは旧世代と attempt 生成世代を区別できないため、記録集合との一致/不一致を世代判定に使う**（Codex 再レビュー P1-1）
    - manifest **あり（phase=active）** + 退避側の実在集合が記録集合の**真部分集合**（退避ゼロ = mutation 未着手を含む） = 退避 rename 途中または未着手の中断。本体コピーは退避完了後にのみ始まるため、元名側に残るファイルは**旧世代の実データ** — 削除しない。退避側に実在するファイルのみ元名へ戻し（元名に同種別が存在する場合はそれを削除してから rename）、manifest を durable 削除する
    - manifest **あり（phase=active）** + 退避側の実在集合が記録集合の**部分集合でない**（記録に無い種別が退避側に存在する superset / mixed） = 本契約下では到達不能な状態（退避 rename は記録集合のファイルのみを対象とする）。自動解消せず起動中止（fail-closed + operator 可視化）とし、遺物を変更しない（Codex 再々レビュー P2-1）
    - manifest **あり（phase=committed）** = 復元は完了済みで掃除だけが中断 → `{db_path}` 一式を正とし、退避遺物を削除してから manifest を durable 削除する
    - manifest **なし** + 退避遺物あり = **旧形式実装（manifest 導入前）の中断残骸、または不明の遺物**。退避側が唯一の実データである可能性がある（現行実装で退避後・コピー前に中断したケース）ため、**自動削除せず**起動中止（fail-closed + operator 可視化）とする（Codex 再々レビュー P1-2。D5 実装の成功後掃除中断は phase=committed が識別するため、この分岐に落ちるのは旧形式・不明遺物のみ）
    - manifest が存在するが**読取・パース不能**（作成途中の中断による破損） = ファイル mutation は manifest の durable 化後にのみ始まるため、退避遺物が無ければ manifest のみ削除して通常起動へ進む。退避遺物が**ある**場合は自動解消せず起動中止（fail-closed + operator 可視化）とする
  - reconcile は**冪等**に設計する: 各分岐は現在の状態のみから解消先を決め、新たな中間状態を作らない。reconcile 自身が任意の時点で再中断されても（例: 一致分岐の巻き戻し途中で退避実在集合が真部分集合に減る）、再起動後の reconcile が同じ規則で残状態を一意に解消できる
  - restore 開始時に前回の manifest または `.restore_backup` 遺物が残存している場合、restore を開始せず Err を返す（reconcile は起動時に完了しているはずで、実行中の残存は掃除失敗の兆候。fail-closed）
  - reconcile 自体の失敗は起動中止（MNT-03-D4 と同じ fail-closed + operator 可視化）とし、遺物を残したまま `init_database` に進んで空 DB を作ることを禁止する
  - reconcile は **legacy 移行判定（22 §12）より前に**実行する。restore 中断で `{db_path}` が不在の間に legacy 移行判定が走ると「新 DB 無し」と誤認して旧 CWD DB を publish し得るため、順序は reconcile → legacy 移行判定 → `init_database` で固定する
- Why: 退避 rename 後・コピー完了前に中断すると `{db_path}` が不在になり、現行起動は `init_database` が空 DB を新規作成して実データ（退避側に無傷で存在）を隠蔽する。manifest の記録集合は (1) 「`{db_path}` を信頼してよいか」（manifest の有無）と (2) 「元名側のファイルが旧世代か attempt 生成世代か」（退避実在集合と記録集合の一致/不一致）の両方を決定論化し、全中断タイミングで解消先が一意に決まる。存在ビットのみの固定 marker（本 D5 の旧案）では (2) を判定できず、「巻き戻しで退避に無い元名を削除する」と退避途中中断の旧 WAL 実データを失い、「削除しない」と restore 成功後中断の新世代 WAL/SHM が旧 main と混在残存する — どちらの単純規則にも反例が成立する（Codex 再レビュー P1-1）。phase=committed を退避削除より前に永続化するのは、成功後の掃除中断を「main 優先」で解消するためであり、**manifest の不在を commit 判定に使うと旧形式実装（同じ固定退避名を使用）の中断残骸 — 唯一の実データを含み得る — を成功後残骸と誤認して削除する**アップグレード境界の反例が成立するため、不在は fail-closed に送る（Codex 再々レビュー P1-2）。なお「新接続確立直後〜phase=committed 永続化前」の中断だけは、完了していた復元が reconcile で旧データへ巻き戻る（不変条件には違反しない安全側の挙動。operator は復元を再実行すればよく、この挙動は受容して文書化する）
- Rejected alternatives: 存在ビットのみの固定 marker `{db_path}.restore_inprogress`（本 D5 の旧案。上記の世代判定不能で棄却）/ **phase なしの manifest + 「manifest なし + 退避あり = 掃除中断」規則**（本 D5 の第 2 案。アップグレード境界で旧形式残骸の唯一の実データを削除する反例で棄却 — Codex 再々レビュー P1-2）/ attempt ごとの一意 staging 名（single-instance 前提下では固定退避名 + manifest 記録集合で決定論を確保でき、staging 名の列挙・掃除の複雑さに見合わない）/ reconcile なしで「退避があれば常に戻す」（成功後の掃除中断で完了済みの復元が巻き戻り、operator の操作結果を無効化する）/ 同期巻き戻し（ステップ 8）を「存在する退避だけ戻す」軽量手順にする（部分 migration が生成した新世代 WAL/SHM を残し世代混在を作る — reconcile 一致分岐と同一手順に統合。Codex 再々レビュー P1-1）
- 見直し契機: restore を接続 API ベース（`rusqlite::backup` 等)へ置き換えるとき、または multi-instance 対応が要件化されるとき
5. バックアップファイルを `{db_path}` にコピー
6. `db::init_database(db_path)` で新しい接続を作成
   - PRAGMA再設定＋マイグレーション実行が含まれる
7. 成功の場合:
   a. manifest の phase を `committed` へ原子的に durable 更新する（MNT-01-D5: 退避ファイル削除より前が必須）
   b. 退避ファイルを削除（`.restore_backup` ファイル群）
   c. manifest を durable 削除する（unlink + 親 directory sync）
   d. `system_repo::insert_operation_log` で記録:
      - `operation_type`: `"backup_restore"`
      - `summary`: `"バックアップから復元しました: {ファイル名}"`
      - 注: 7a〜7d の間の中断では復元自体は完全（不変条件充足）だが operation_log レコードが欠落し得る。監査証跡の欠落として受容・文書化する（データ安全性には影響しない）
   e. 新しい `DbConnection` を返す
8. 失敗の場合（ステップ5-6でエラー）: 巻き戻しは **MNT-01-D5 reconcile の「一致」分岐と同一手順**で行う（存在する退避だけを戻す方式は、`init_database` の部分 migration が生成した新世代 WAL/SHM を元名側に残し、旧 main と混在させるため禁止 — Codex 再々レビュー P1-1）:
   a. 元名側の DB 一式（main / WAL / SHM すべて — この attempt が生成した信頼できない世代）を削除し、親 directory sync で永続化する
   b. manifest 記録集合の退避ファイルを rename で元名へ復帰する（`{db_path}.restore_backup` → `{db_path}`、WAL / SHM も記録集合に従う）
   c. 巻き戻し完了後に manifest を durable 削除する
   d. `DbError::QueryFailed` を返す（元のDBファイルは復元済みだが、接続は呼び出し元が再確立する必要がある）
   e. 巻き戻し（8a-8b）が失敗した場合 → `DbError::QueryFailed` で致命的エラー（manifest は削除しない — 次回起動の reconcile が解消する）

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
| 中断 reconcile（MNT-01-D5） | 各ファイル mutation・sync・manifest 操作の直後で処理を打ち切る failpoint で中断状態（phase=active の一致 / 真部分集合（退避ゼロ含む） / phase=committed / reconcile 自身の巻き戻し途中再中断）を作り、起動時 reconcile 後に元 DB 一式（または完了済み restore 結果）が**世代混在なく**再接続可能で遺物ゼロなことを検証。元 DB の WAL/SHM 有無 × 中断点の全組合せを含み、特に「clean な元 DB（WAL 無し記録）× restore 成功後 phase=committed 前の中断」で新世代 WAL が残らないことを固定する |
| 同期巻き戻しの世代掃除（MNT-01-D5 / ステップ 8） | 退避完了後に `init_database` の部分 migration で新世代 WAL/SHM を生成させてから restore を失敗させ、同期巻き戻し後に元名側へ新世代 sidecar が残らない（旧 main + 記録集合のみ）ことを検証（Codex 再々レビュー P1-1 の回帰固定） |
| fail-closed reconcile 分岐（MNT-01-D5） | (a) manifest なし + 退避遺物あり（旧形式実装の中断残骸を模した fixture）、(b) 実在集合が記録集合の部分集合でない superset、(c) パース不能 manifest + 退避あり — いずれも遺物を変更せず起動中止 + operator 可視化することを検証。(a) は退避側の実データが削除されないことを必須 assert とする（Codex 再々レビュー P1-2 の回帰固定） |
| single-instance ガード（MNT-01-D5 前提） | 二重起動時に後発 instance が restore / reconcile / legacy 移行へ到達しないことを検証（`tauri-plugin-single-instance` 等の導入は実装 PR1 の前提条件） |
| retention 読取失敗（MNT-01-D3） | `backup_retention_days` の読取 DB error / 非数値値を注入し、cleanup が実行されず（削除 0 件）warn が記録されることを検証 |
| retention 未設定（MNT-01-D3） | 設定行なしで既定 3 日が適用されることを検証（既存挙動の固定） |
| resolve_backup_dir の DB error（MNT-01-D2） | `get_setting` の DB error 注入で `Err` が返ることを検証（未設定/空文字 → 既定 dir と区別） |
