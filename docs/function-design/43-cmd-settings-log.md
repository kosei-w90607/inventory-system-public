## CMD-11残り: 設定・ログ・バックアップ・画像コマンド群

> CMD-11の整合性チェック部分（run_integrity_check, fix_integrity）は `42-cmd-sales-stocktake.md` に記載済み。
> 本セクションは設定CRUD・操作ログ閲覧・バックアップ・画像保存コマンドを扱う。

### 43.1 モジュール構成

```
src-tauri/src/
  cmd/
    mod.rs             -- pub mod settings_cmd を追加
    settings_cmd.rs    -- 設定・ログ・バックアップ・画像コマンド（本セクション）
    integrity_cmd.rs   -- 既存（CMD-11の整合性チェック部分）
  lib.rs               -- invoke_handler に8コマンドを追加
```

---

### 43.2 型定義

#### リクエスト型

```
#[derive(Debug, serde::Deserialize, specta::Type)]
struct UpdateSettingRequest {
    key: String,
    value: String,
}

#[derive(Debug, serde::Deserialize, specta::Type)]
struct LogQuery {
    page: u32,
    per_page: u32,  // system_repo がD-031共有定数により200クランプ
    operation_type: Option<String>,
    start_date: Option<String>,  // UI-11c-D3。YYYY-MM-DD。JST暦日 start inclusive
    end_date: Option<String>,    // UI-11c-D3。YYYY-MM-DD。JST暦日 end-next-day exclusive
}
```

`start_date` / `end_date` は [74-ui-operation-logs.md](74-ui-operation-logs.md) §74.4 の Design Phase で追加が確定した。既存呼び出し元は両方 `None` を渡すことで現行動作を完全維持する（生成 binding 再生成後、既存 Rust テスト・フロントエンド呼び出しはこの2フィールドを明示的に渡す必要がある）。

```

#[derive(Debug, serde::Deserialize, specta::Type)]
struct RestoreBackupRequest {
    backup_path: String,
}

#[derive(Debug, serde::Deserialize, specta::Type)]
struct SaveImageRequest {
    image_base64: String,     // Base64エンコードされた画像データ
    extension: String,        // "jpg", "png" 等
}
```

注意: `extension` は generated binding 上も `string` として出る。許可拡張子の UI 側候補は `jpg|jpeg|png|gif|webp` に絞るが、CMD/IO の最終 validation は `String` 値を検証して validation error を返す。

#### レスポンス型

```
#[derive(Debug, serde::Serialize, specta::Type)]
struct SaveImageResponse {
    relative_path: String,    // DBに格納する相対パス
}
```

注意: `AppSetting`, `OperationLog`, `PaginatedResult`, `BackupResult`, `BackupInfo` は各モジュールで定義済みの型を再利用する。

---

### 43.3 get_settings

**シグネチャ**:
```
#[tauri::command]
fn get_settings(state: State<AppState>) -> Result<Vec<AppSetting>, CmdError>
```

**処理**: `system_repo::get_all_settings(conn)`を呼び出して返す。

---

### 43.4 update_setting

**シグネチャ**:
```
#[tauri::command]
fn update_setting(state: State<AppState>, request: UpdateSettingRequest) -> Result<(), CmdError>
```

**処理**: `system_repo::upsert_setting(conn, &request.key, &request.value)` を呼び出す。

---

### 43.5 list_logs

**シグネチャ**:
```
#[tauri::command]
fn list_logs(state: State<AppState>, query: LogQuery) -> Result<PaginatedResult<OperationLog>, CmdError>
```

**処理**: `query.start_date` / `query.end_date` が `Some` の場合、まずASCII strict `YYYY-MM-DD`（長さ10、4/7文字目`-`、年4・月2・日2がASCII digit）を検証し、次にchronoで実在暦日を検証する。両方 `Some` かつ `start_date > end_date` なら早期にvalidation errorを返す（[74-ui-operation-logs.md](74-ui-operation-logs.md) §74.4.2）。検証を通過したら `system_repo::list_operation_logs(conn, query.page, query.per_page, query.operation_type.as_deref(), query.start_date.as_deref(), query.end_date.as_deref())` を呼び出す。per_page の上限クランプ（200）は IO 層（system_repo）が D-031 の `PAGINATION_MAX_PER_PAGE = 200` で実行し、レスポンスの per_page もクランプ後の値を返す。

**エラーハンドリング（追加分、UI-11c-D2/D3）**:
- `start_date` / `end_date` がASCII strict `YYYY-MM-DD`形式でない、または実在しない暦日 → `CmdError { kind: "validation", message: "開始日・終了日はYYYY-MM-DD形式で入力してください" }`
- 両方 `Some` かつ `start_date > end_date` → `CmdError { kind: "validation", message: "開始日は終了日と同じ日か、それより前の日付にしてください" }`
- 両方 `None` の場合は既存動作を完全維持する（既存呼び出し元・既存テストへの影響なし）。

---

### 43.5.1 list_log_operation_types（PR #164で実装済み、UI-11c-D4）

**シグネチャ**:
```
#[tauri::command]
fn list_log_operation_types(state: State<AppState>) -> Result<Vec<String>, CmdError>
```

**処理**: `system_repo::find_distinct_operation_types(conn)` を呼び出して返す薄いラッパー。フィルタ・ページングを持たない。

**目的**: [74-ui-operation-logs.md](74-ui-operation-logs.md) §74.5 の operation_type filter 候補は、現在ページや現在の filter 済み結果から生成してはならない（Missing UI item 4）。保持中の operation_logs 全体から distinct な operation_type を返すことで、canonical registry（frontend 日本語ラベル辞書）と突き合わせる際の実在値ソースにする。

**非目的**: 日本語ラベル・カテゴリ分類は持たない（frontend `operation-type-labels.ts` の責務）。

---

### 43.6 create_backup

**シグネチャ**:
```
#[tauri::command]
fn create_backup(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<BackupResult, CmdError>
```

**処理ステップ**:
1. `app_handle.path().app_data_dir()` でapp_data_dirを取得
2. `backup_dir = app_data_dir.join("backups")` でバックアップディレクトリ決定
   - `backup_path`設定があればそちらを優先（空文字ならデフォルト使用）
3. `mnt::backup::create_backup(conn, &backup_dir)` を呼び出す

---

### 43.7 check_auto_backup

**シグネチャ**:
```
#[tauri::command]
fn check_auto_backup(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<bool, CmdError>
```

**処理**: `mnt::backup::check_auto_backup(conn, &backup_dir)` を呼び出す。フロントエンドの `setInterval(60秒)` から呼ばれる。

---

### 43.8 list_backups

**シグネチャ**:
```
#[tauri::command]
fn list_backups(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<Vec<BackupInfo>, CmdError>
```

**処理**: `resolve_backup_dir`でbackup_dirを決定し、`mnt::backup::list_backups(&backup_dir)` を呼び出す。
※ `backup_path`設定の読み取りにDB接続が必要なため`state`引数を追加。

---

### 43.8.1 get_effective_backup_dir

**関数要求**: `backup_path` 未設定時にアプリが実際にバックアップを保存するディレクトリ（アプリ既定フォルダ）を利用者へ提示するための読み取り専用コマンド。UI-11b の常時表示 follow-up（PR #144 L3 / Fable 裁定起源）で追加。

**シグネチャ**:
```
#[tauri::command]
fn get_effective_backup_dir(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, CmdError>
```

**処理ステップ**:
1. 既存ヘルパ `get_backup_dir(&conn, &app_handle)`（§43 冒頭ヘルパー、内部で `mnt::backup::resolve_backup_dir` を呼ぶ）を呼び出す。
2. 返された `PathBuf` を `to_string_lossy().to_string()` で文字列化して返す。

**非目的**: バリデーション・パス加工・設定更新は行わない。CMD層は薄いラッパーのまま。

---

### 43.9 restore_backup

**シグネチャ**:
```
#[tauri::command]
fn restore_backup(
    state: State<AppState>,
    app_handle: tauri::AppHandle,
    request: RestoreBackupRequest,
) -> Result<(), CmdError>
```

**処理ステップ**:
1. `app_handle.path().app_data_dir()` でapp_data_dirを取得
2. `db_path = app_data_dir.join("inventory.db")`（ファイルパス。ディレクトリではない）
3. DB Mutexのロックを取得
4. `std::mem::replace` で現在の `DbConnection` を取り出す（一時的にin-memory接続を入れる）
5. `match mnt::backup::restore_backup(old_conn, &backup_path, &db_path)` で分岐:
   - `Ok(new_conn)` → `*guard = new_conn`
   - `Err(e)` → 復旧再接続は 71 §71.7 MNT-01-D4 の契約に従う: 「退避復元済み」の場合のみ **create 能力のない open** で再接続して `*guard` に入れ、recoverable な `CmdError` を返す。「状態不明/未復旧」または no-create 再接続失敗は再接続を試みず unrecoverable（再起動誘導文言）を返す。**create 能力のある `db::init_database` を復旧再接続に使ってはならない**（main 不在時に空 DB を作り recoverable に偽装する）
6. **`?`で早期returnしてはならない**（Mutex内のdummy接続が残るため）

**注意**: リストア中は他のコマンドがブロックされる（Mutexロック中）。単一ユーザーアプリのため問題なし。

---

### 43.10 save_receipt_image

**シグネチャ**:
```
#[tauri::command]
fn save_receipt_image(
    app_handle: tauri::AppHandle,
    request: SaveImageRequest,
) -> Result<SaveImageResponse, CmdError>
```

**処理ステップ**:
1. `request.image_base64` をBase64デコード → バイト列に変換
   - デコード失敗 → `CmdError { kind: "validation", message: "画像データが不正です" }`
2. `app_handle.path().app_data_dir()` でapp_data_dirを取得
3. `io::image_manager::save_receipt_image(&app_data_dir, &image_bytes, &request.extension)` を呼び出す
4. 返された相対パスを `SaveImageResponse` に格納して返す

**エラーハンドリング**:
- Base64デコード失敗 → validation エラー
- 拡張子不正（`InvalidInput`）→ validation エラー（利用者入力起因のため）
- その他IO::Error → internal エラー

---

### 43.11 lib.rs invoke_handler への登録

PR #164で`list_log_operation_types`を含む10コマンドすべてを `#[specta::specta]` 化済み。`tauri::generate_handler!` と `tauri_specta::collect_commands!` の両方へ登録し、UI は generated `commands.*` を使う。

```
.invoke_handler(tauri::generate_handler![
    // ... 既存の21コマンド ...
    // CMD-11 残り: 設定・ログ・バックアップ・画像
    cmd::settings_cmd::get_settings,
    cmd::settings_cmd::update_setting,
    cmd::settings_cmd::list_logs,
    cmd::settings_cmd::list_log_operation_types,
    cmd::settings_cmd::create_backup,
    cmd::settings_cmd::check_auto_backup,
    cmd::settings_cmd::list_backups,
    cmd::settings_cmd::get_effective_backup_dir,
    cmd::settings_cmd::restore_backup,
    cmd::settings_cmd::save_receipt_image,
])
```

---

### 43.12 テスト方針

CMD層のテストは主にBizError/DbError → CmdError変換とパラメータの受け渡しを検証する。

| テスト名 | 検証内容 | REQ |
|---------|---------|---|
| `test_get_settings_cmd11` | 設定一覧が取得できる | REQ-905 |
| `test_update_setting_cmd11` | 設定値の更新と読み戻し | REQ-905 |
| `test_list_logs_req902_pagination` | ページングパラメータの受け渡し | REQ-902（是正済み、§43.12.1） |
| `test_list_logs_req902_filter` | operation_typeフィルタの受け渡し（日付両方省略） | REQ-902（是正済み、§43.12.1） |
| `test_list_logs_req902_invalid_page_to_cmderror` | 不正pageのCmdError変換 | REQ-902（是正済み、§43.12.1） |
| `test_create_backup_cmd11` | バックアップ作成とBackupResult返却 | REQ-905 |
| `test_list_backups_cmd11` | バックアップ一覧の返却 | REQ-905 |
| `test_save_receipt_image_cmd11_valid` | 正常なBase64画像の保存と相対パス返却 | REQ-906 |
| `test_save_receipt_image_cmd11_invalid_base64` | 不正Base64でvalidationエラー | REQ-906 |

UI-11c 実装 PR で追加・確認した実テスト（結合testはbranchごとのassertionを保持。Test Design Matrix参照）:

| 実テスト名 | 検証内容 | REQ |
|---|---|---|
| `test_list_logs_req902_date_validation_contract` | 同日許可、不正形式、`start_date > end_date`の各validation branch | REQ-902 |
| `test_list_operation_logs_req902_date_range_row_count_predicate_equivalence` | 両日指定 + operation_type複合条件でitems/countのpredicate一致 | REQ-902 |
| `test_list_operation_logs_req902_one_sided_and_end_exclusive` | start/end片側指定とend翌日exclusive境界 | REQ-902 |
| `test_list_operation_logs_req902_filter_type` | 日付両方省略時の既存operation_type filter | REQ-902 |
| `test_find_distinct_operation_types_req902_dedup_order_unknown_and_empty` | empty、重複排除、昇順、未知値保持 | REQ-902 |

#### 43.12.1 REQ-902/REQ-905 traceability 是正（UI-11c-D12）

`list_logs` のpagination / operation_type filter / invalid page変換を検証する3テストは、実体がREQ-902（ログ管理）であるため、UI-11c実装PRで関数名・コメントを`req905`から`req902`へ是正済み。現行実名は上表の`test_list_logs_req902_pagination` / `test_list_logs_req902_filter` / `test_list_logs_req902_invalid_page_to_cmderror`である。根拠は [74-ui-operation-logs.md](74-ui-operation-logs.md) §74.2 UI-11c-D12 および `docs/decision-log.md` D-036を参照。
