# UI-11b: バックアップ・復元画面

> 親文書: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> 対応REQ: QR-05 / REQ-905
> Design Phase: 2026-07-06。PR #141 で settings / log / backup 系 command bindings は配線済み。実効保存先常時表示（PR #144 L3 / Fable 裁定起源の follow-up）を追記。

UI-11b は、ローカル SQLite DB の手動バックアップ、バックアップ設定、バックアップ一覧、復元を operator が 1 画面で扱うための画面である。backend 契約の正本は [71-mnt-backup.md](71-mnt-backup.md) と [43-cmd-settings-log.md](43-cmd-settings-log.md) に置き、本書は UI 側の状態遷移、文言、安全確認、query cache の扱い、Windows native L3 を固定する。

## 68.1 目的

- 非IT高齢オーナーが、バックアップ作成・保存先確認・復元を単独で完遂できる。
- 復元は DB 全体を過去状態へ戻す destructive 操作として扱い、真の Undo がないことを UI が隠さない。
- DB 破損からの復旧シナリオでは、現在状態を保存できない場合だけ break-glass で復元を続けられる。
- backup 系設定（`backup_enabled` / `backup_time` / `backup_path` / `backup_retention_days`）はこの画面が所有し、UI-11a 閾値設定へ混ぜない。

## 68.2 関数要求

| ID | 要求 |
|---|---|
| UI-11b-F1 | 画面表示時に `commands.getSettings()` と `commands.listBackups()` を読み、バックアップ設定とバックアップ一覧を表示する。 |
| UI-11b-F2 | `backup_enabled` / `backup_time` / `backup_retention_days` を UI-11b で更新できる。 |
| UI-11b-F3 | `backup_path` は native directory picker で選んだパスだけを `commands.updateSetting()` に渡す。自由入力欄は作らない。 |
| UI-11b-F4 | 手動バックアップは `commands.createBackup()` を呼び、成功後に一覧を再取得する。 |
| UI-11b-F5 | 自動バックアップ確認は frontend の 60 秒 interval から `commands.checkAutoBackup()` を呼ぶ。現 `src/` には未実装のため、UI-11b implementation PR の scope に含める。 |
| UI-11b-F6 | 復元は、事前バックアップ作成、詳細提示、最終確認、`commands.restoreBackup({ backup_path })`、cache clear、ホーム遷移、結果 Alert の順で扱う。 |
| UI-11b-F7 | 復元失敗時は CMD 層の再接続契約に合わせ、recoverable failure と double failure を UI 状態として分ける。 |

## 68.3 シグネチャ

UI は PR #141 で生成済みの `commands.*` だけを使う。

| Command | UI 用途 | 戻り値 / 入力 |
|---|---|---|
| `commands.getSettings()` | backup 系設定の初期表示。 | `AppSetting[]` |
| `commands.updateSetting(request)` | backup 系設定の保存。 | `UpdateSettingRequest { key, value }` |
| `commands.listLogs(query)` | 直近の backup 操作ログを補助表示する場合だけ使う。全操作ログ UI は UI-11c が所有する。 | `LogQuery` -> `PaginatedResult<OperationLog>` |
| `commands.createBackup()` | 手動バックアップ、復元前の強制事前バックアップ。 | `BackupResult { file_path, file_name, size_bytes }` |
| `commands.checkAutoBackup()` | 60 秒 interval の自動バックアップ確認。 | `boolean` |
| `commands.listBackups()` | バックアップ一覧。 | `BackupInfo[]` |
| `commands.getEffectiveBackupDir()` | `backup_path` 未設定時の実効保存先（アプリ既定フォルダ）常時表示。 | `String` |
| `commands.restoreBackup(request)` | 選択バックアップへの復元。 | `RestoreBackupRequest { backup_path }` -> `null` |

## 68.4 処理ステップ

### 初期表示

1. `getSettings` と `listBackups` を並列に読む。
2. `backup_enabled` / `backup_time` / `backup_path` / `backup_retention_days` を UI 用 state に変換する。
3. `BackupInfo.created_at` は和式日時に変換し、`size_bytes` は MB 表示にする。
4. 一覧の先頭行に `最新` Badge を付ける。

### 手動バックアップ

1. `createBackup` を呼ぶ。
2. 成功時は `listBackups` を再取得し、作成ファイル名とサイズを success Alert で表示する。
3. 失敗時は入力・設定 state を保持し、保存先の確認と再試行を促す。

### backup_path 変更

1. native directory picker を開く。
2. operator がキャンセルした場合は何も保存しない。
3. 選択されたディレクトリだけを `updateSetting({ key: "backup_path", value })` で保存する。
4. 保存後に `listBackups` と `getEffectiveBackupDir` を再取得し、新しい保存先の一覧・表示へ切り替える。

### 実効保存先の常時表示（PR #144 follow-up）

1. 画面表示時に `getEffectiveBackupDir` を読み、バックアップ設定カード内の `backup_path` 導線の近くに「現在の保存先」として常時表示する。
2. `backup_path` が空（未設定）の場合、実効パスはアプリ既定フォルダ（Windows では `AppData/Roaming/com.kosei.inventory/backups` 相当）になるため、「保存先が未設定のためアプリ既定フォルダに保存されます」を補足表示する。
3. 取得失敗時は表示行そのものを出さない。手動バックアップ・復元等の他機能は取得失敗の影響を受けない。
4. `backup_path` 保存成功後は本 query を invalidate し、新しい実効保存先へ表示を追随させる。

### 復元

1. 一覧行から復元対象を選ぶ。
2. 詳細提示で日時・サイズ・補助的なファイル名 / パスを表示し、「この時点の状態に戻ります。この控えより後に記録した内容は消えます」を表示する。
3. 第一段として `createBackup` を自動実行する。成功しない限り通常経路では復元へ進めない。
4. 事前バックアップ自体が失敗した場合だけ、break-glass checkbox「今の状態は保存できませんが、復元を続けます」を表示する。operator が自分でチェックした時だけ最終確認へ進める。
5. 最終確認 AlertDialog で「元に戻せません」と対象日時を再掲し、実行ボタンのラベルに対象日時を含める。
6. `restoreBackup({ backup_path })` を呼ぶ。
7. 成功時は React Query cache を `invalidate` ではなく全消去し、ホームへ遷移して success Alert を出す。プロセス再起動は求めない。
8. 失敗時は `CmdError.message` と double failure 判定に従って、recoverable failure または restart-required failure を表示する。

## 68.5 Design Decisions

| Decision ID | Decision | Rationale / source |
|---|---|---|
| UI-11b-D2 | 復元前の事前バックアップは強制。`createBackup` 成功前に通常の復元へ進めない。例外は事前バックアップ失敗時だけの break-glass checkbox。 | D-032。通常経路の安全策を弱めず、DB 破損復旧だけを残す。 |
| UI-11b-D3 | 確認は 2 段。一覧選択後の詳細提示と、最終確認 AlertDialog。復元実行ボタンのラベル自体に対象日時を含める。 | D-032。3 段以上は儀式化するため採用しない。 |
| UI-11b-D4 | 復元成功後は React Query cache を全消去し、ホームへ遷移し、成功 Alert を出す。アプリ再起動は不要。 | DB 全体が入れ替わるため invalidate では不足。backend は成功時に新接続を返す。 |
| UI-11b-D5 | restore 失敗 + 退避復元も失敗した double failure は、DSR-03 上部帯の全画面 destructive Alert、restart guidance、画面内操作 disabled で扱う。ページ離脱の強制ブロックはしない。 | 再起動が唯一の解であり、強制ブロックより誘導文言を優先する。 |
| UI-11b-D6 | `backup_enabled` / `backup_time` / `backup_path` / `backup_retention_days` は UI-11b が所有する。 | operator のメンタルモデルは「バックアップのことはバックアップ画面」。UI-11a は業務パラメータのみ。 |
| UI-11b-D7 | バックアップ一覧は和式日時を主情報、MB サイズを副情報、行ごとの復元導線、先頭行 `最新` Badge とする。ファイル名・絶対パスは主表示にしない。 | ファイル名やパスより「いつの控えか」が operator の判断軸。 |
| UI-11b-D8 | `backup_path` 変更は native directory picker のみ。自由入力は不可。現在の保存先は表示のみ。 | PR #125 の file dialog 移行前例に合わせ、WebView path 入力の誤操作を避ける。 |
| UI-11b-D9 | `checkAutoBackup` の 60 秒 interval は frontend 未実装。UI-11b implementation PR の scope に含める。 | `src/` grep で `checkAutoBackup` 呼び出しと `setInterval` 実装が未検出。backend / binding は実装済み。 |
| UI-11b-D10 | Windows native L3 で、手動バックアップファイル、復元によるデータ切替、復元前自動バックアップ、backup_path 変更後出力を目視確認する。double failure は自動テスト + 文言目視のみ。 | ファイル実体と DB 入れ替わりは native runtime でしか最終確認できない。 |

## 68.6 Route / Components

| 要素 | 設計 |
|---|---|
| Route | `/settings/backup` を予定。`src/config/navigation.ts` の `ui-11b` は現状 `to: null` / `pending` なので、implementation PR で route file と navigation を同時に active 化する。 |
| Page | `BackupRestorePage` |
| Components | `BackupSettingsPanel`, `ManualBackupPanel`, `BackupListTable`, `RestoreDetailPanel`, `RestoreConfirmDialog`, `BackupPathPicker`, `RestoreFatalAlert` |
| Query hooks | `useBackupSettings`, `useBackupList`, `useEffectiveBackupDir`, `useCreateBackup`, `useUpdateBackupSetting`, `useRestoreBackup`, `useAutoBackupCheck` |
| Native API | `@tauri-apps/plugin-dialog` の directory picker。自由入力 path は置かない。 |

## 68.7 State Machine

| State | Entry / action | Next | UI behavior |
|---|---|---|---|
| `loading` | `getSettings` + `listBackups` | `ready` / `load_error` | skeleton または progress を表示。 |
| `ready` | 初期表示完了 | `creating_backup` / `path_selecting` / `restore_detail` | 設定、手動作成、一覧、復元導線を操作可能。 |
| `creating_backup` | 手動 `createBackup` | `ready` / `backup_error` | 画面内の destructive ではない操作を一時 disabled。 |
| `path_selecting` | directory picker | `ready` / `path_update_error` | cancel は state 変更なし。 |
| `restore_detail` | 一覧行選択 | `pre_restore_backup` / `ready` | 対象日時・サイズ・「この控えより後に記録した内容は消えます」を表示。 |
| `pre_restore_backup` | 自動 `createBackup` | `restore_confirm` / `pre_backup_failed` | 成功しない限り通常復元へ進めない。 |
| `pre_backup_failed` | 事前バックアップ失敗 | `restore_confirm` / `restore_detail` | break-glass checkbox を表示。checkbox 未チェックでは進行不可。 |
| `restore_confirm` | 最終 AlertDialog | `restoring` / `restore_detail` | 「元に戻せません」と日時を再掲。実行ボタンに日時を含める。 |
| `restoring` | `restoreBackup` | `restore_succeeded` / `restore_failed_recovered` / `restore_failed_unrecoverable` | 画面内操作を disabled。 |
| `restore_succeeded` | CMD が Ok を返す | home route | Query cache を `clear` し、ホームへ遷移して success Alert。 |
| `restore_failed_recovered` | CMD が **recoverable 分類**の Err を返す（DB 接続再確立済み） | `ready` | 復元失敗を表示し、一覧を再取得して再試行可能にする。 |
| `restore_failed_unrecoverable` | CMD が **unrecoverable 分類**の Err を返す | terminal | DSR-03 上部帯の full-page destructive Alert、全操作 disabled、「アプリを閉じて、もう一度開いてください」。 |

`restore_backup` の MNT 層は失敗時に DB ファイルを退避から戻すが、有効な接続は返さない。CMD 層は `match` で処理し、「退避復元済み」の失敗に限り **create 能力のない open**（71 §71.7 MNT-01-D4）で再接続を試み、成功すれば recovered connection を Mutex に戻してから Err を返す。UI はこの recoverable failure を通常の再試行可能エラーとして扱う。復元後の状態が確定できない失敗、または no-create 再接続に失敗した double failure が restart-required 状態である（create 能力のある `init_database` を復旧再接続に使うと、main 不在時に空 DB が作られ recoverable に偽装される — MNT-01-D4 参照）。

recoverable / unrecoverable の判別は **CMD が返す構造化された `CmdError.kind`** で行う。**実装 PR1 確定値**は `restore_failed_recovered` / `restore_failed_unrecoverable` / `restore_durability_unknown` であり、**エラーメッセージ文字列の部分一致に依存しない**（順 8 = P3-4 の error 表示統一と前方互換）。unrecoverable 分類内でも表示文言は結果確定度で異なる — 復元結果が durability 不明のケース（71 MNT-01-D5 (e)(ii)）は失敗を断定せず「復元が完了したか確定できませんでした。アプリを再起動してください。」とし、結果は再起動後の reconcile が確定し、確認手段は §68.11 の best-effort 契約（操作ログが第一手段、記録系障害の持続時は復元対象日時のデータ内容確認）に従う（state machine への影響なし、terminal 分岐のまま。Codex 第 8 round P2-2）。文言（「アプリを再起動してください」等）は表示専用とし、frontend テストも識別子で固定する（PR #14 Codex 再々レビュー P2-2）。

## 68.8 Command Contract

| UI action | Command | Contract note |
|---|---|---|
| 初期設定読込 | `commands.getSettings()` | `AppSetting[]` から backup 系 4 key を抽出する。不明 key は無視。 |
| 設定保存 | `commands.updateSetting({ key, value })` | UI-11b は backup 系 key だけを保存する。`backup_path` は native picker 由来のみ。 |
| 操作ログ補助表示 | `commands.listLogs(query)` | full 操作ログ画面は UI-11c。UI-11b では backup 操作の直近表示に限定する。 |
| 手動 / 事前バックアップ | `commands.createBackup()` | `BackupResult` の `file_name` と `size_bytes` を表示。`file_path` は詳細/補助表示のみ。 |
| 自動バックアップ確認 | `commands.checkAutoBackup()` | 60 秒 interval で呼び、`true` の時は一覧を再取得する。 |
| 一覧読込 | `commands.listBackups()` | `created_at` は `YYYY-MM-DD HH:MM:SS` 文字列。UI で和式日時へ整形する。 |
| 復元 | `commands.restoreBackup({ backup_path })` | 成功時は new DB connection が Mutex に入る。失敗時も CMD が再接続を試み、二重失敗では再起動文言を含む Err を返す。 |

## 68.9 UI / Wording

- 画面タイトル: `バックアップ・復元`
- 手動バックアップ button: `今すぐバックアップを作成`
- 保存先表示: `現在の保存先`（`getEffectiveBackupDir` が返す実効パスを表示。`backup_path` 未設定時は「保存先が未設定のためアプリ既定フォルダに保存されます」を補足）
- 保存先変更 button: `保存先を選ぶ`
- backup_path は表示専用。絶対パスは小さめの補助テキストにし、主情報にしない。
- 一覧主表示: `7月3日 21:00` のような和式日時。先頭行に `最新` Badge。
- サイズ表示: `12.4 MB` のような人間可読 MB。
- 復元詳細文言: `この時点の状態に戻ります。この控えより後に記録した内容は消えます`
- break-glass checkbox: `今の状態は保存できませんが、復元を続けます`
- 最終確認 title: `元に戻せません`
- 復元実行 button: `7月3日 21:00 の控えに戻す`
- double failure: `アプリを閉じて、もう一度開いてください`
- 状態は色だけで表さない。`最新`、`保存先`、`復元できません`、`再起動が必要です` の日本語ラベルを主情報にする。

## 68.10 Query Invalidation

| Event | Query handling |
|---|---|
| 設定保存成功 | backup settings query を invalidate。`backup_path` 変更時は backup list と実効保存先（`getEffectiveBackupDir`）も invalidate。 |
| 手動 `createBackup` 成功 | backup list を invalidate/refetch。 |
| `checkAutoBackup` が `true` | backup list を invalidate/refetch。 |
| 復元成功 | React Query cache を `queryClient.clear()` で全消去。DB が丸ごと変わるため invalidate ではなく clear。 |
| 復元成功後 | home route へ遷移し、遷移先で success Alert を出す。 |
| 復元失敗 recovered | cache 全消去はしない。backup settings/list を refetch し、再試行可能なエラーとして表示する。 |
| 復元失敗 unrecoverable | cache 操作より restart guidance を優先し、画面内操作を disabled にする。 |

## 68.11 Error / Recovery

| Error | Recovery |
|---|---|
| 初期読込失敗 | 設定/一覧の再読込 button を出す。 |
| 手動バックアップ失敗 | 保存先確認と再試行を促す。入力済み設定は保持する。 |
| backup_path 保存失敗 | 選択した path は未保存として扱い、現在の保存先表示を維持する。 |
| 実効保存先取得失敗 | 「現在の保存先」表示行のみ非表示。手動バックアップ・復元等の他機能は継続して操作できる。 |
| backup list 空 | `まだバックアップはありません` と表示し、手動作成導線を残す。 |
| 事前バックアップ失敗 | 通常復元は block。DB 破損復旧シナリオとして break-glass checkbox を明示した時だけ進める。 |
| restore 失敗 recovered | `バックアップの復元に失敗しました。現在のデータには戻しています。もう一度お試しください。` を表示し、操作可能状態へ戻す。 |
| restore 失敗 unrecoverable | full-page destructive Alert。`バックアップの復元に失敗し、DB接続の復旧もできませんでした。アプリを閉じて、もう一度開いてください。` と表示し、画面内操作を disabled。 |
| restore 結果 durability 不明（71 MNT-01-D5 (e)(ii)） | full-page destructive Alert（unrecoverable と同じ terminal 分岐）。ただし失敗を断定せず `復元が完了したか確定できませんでした。アプリを閉じて、もう一度開いてください。` と表示。結果は再起動後に確定し、完了していた場合は**通常は**操作ログに復元完了（起動時確定）が記録される（記録は best-effort — 記録系の障害が続く場合は現れないことがあり、その場合は復元対象日時のデータ内容で確認する。71 の補完処理契約参照）。 |

復元成功後に真の Undo は存在しない。MNT 層の `.restore_backup` 退避ファイルは成功後に削除されるため、UI は「元に戻せる」印象を与えない。

## 68.12 Windows Native L3

| ID | 確認項目 | 合格基準 |
|---|---|---|
| UI-11b-L3-1 | 手動バックアップ実行 | `createBackup` 成功後、一覧に新しい和式日時行が追加され、保存先ディレクトリに `inventory_backup_YYYYMMDD_HHMMSS.db` が実在する。 |
| UI-11b-L3-2 | 復元実行 | テスト DB で商品数など目視可能な差分を作り、復元後にデータが選択バックアップ時点へ切り替わったことを確認する。 |
| UI-11b-L3-3 | 復元前自動バックアップ | 復元操作の第一段で新しい backup file が作成され、そのファイル実体を保存先で確認できる。 |
| UI-11b-L3-4 | backup_path 変更 | native directory picker で新パスを選び、以降の手動バックアップが新パスへ出力される。 |
| UI-11b-L3-5 | double failure path | 自動テストで状態分岐・文言・操作 disabled・60秒 interval 停止を担保する。実機での誘発は求めない。 |

L3 証跡に実店舗 DB、実 JAN、実商品名、価格、backup file、log file は入れない。必要な差分確認は synthetic / test DB で行う。

## 68.13 Non-scope

- UI 実装、route file 作成、navigation active 化。
- UI-11a 閾値設定画面。
- UI-11c 操作ログ一覧画面。
- backend `check_auto_backup` の仕様変更。
- backup retention days の cleanup logic 変更。
- restore_backup 契約の変更。
- DB 破損状態を実機で意図的に作る manual gate。
