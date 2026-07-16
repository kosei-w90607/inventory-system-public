# P3 error handling 一貫性

## 確認範囲

- production Rust source の `unwrap()` / `let _ = Result` / `.ok()` / `Err(_)` と、filesystem・migration・backup の継続時処理
- `DbError` → `BizError` → `CmdError` の型変換と、direct `CmdError::internal` 経路
- frontend production source の `InvokeError` 正規化、query/mutation の catch・`onError`、toast / Alert / inline error 表示
- `DbError` / `BizError` / `CmdError` の層別型と generated `commands.*` + `unwrapResult` の基本経路は維持されている

### P3-1: backup 設定の読取失敗が既定の保存先・保持日数へ変換される
- 観点: error handling 一貫性
- 証拠: `src-tauri/src/mnt/backup.rs:98`、`src-tauri/src/mnt/backup.rs:100`、`src-tauri/src/mnt/backup.rs:104`、`src-tauri/src/mnt/backup.rs:452`、`src-tauri/src/mnt/backup.rs:454`、`src-tauri/src/mnt/backup.rs:457`
- 害の経路: 一貫性破壊 / 回帰リスク — `get_setting` の DB error と「未設定」を同じ `.ok().flatten()` に潰すため、設定済みの外部 backup path を読めない時に気付かず app data 配下へ保存し、設定済み保持日数を読めない時は3日へ縮めて cleanup を実行する。たとえば90日保持の設定読取だけが失敗すると、4日目以降の backup を誤って削除し得る。
- repo 規範との対照: `.claude/rules/implementation-quality.md:14` は Result の握りつぶしを禁止する。`docs/function-design/71-mnt-backup.md:244` は設定値を読んで cleanup すると定めるが、設定読取失敗時の destructive fallback は定義していない。
- 提案方向: DB error と未設定・不正値を分離し、破壊的 cleanup は設定を確定できた時だけ行う。
- 想定労力: M
- 確度: 確実

### P3-2: filesystem maintenance の個別失敗が複数経路で無記録のまま捨てられる
- 観点: error handling 一貫性
- 証拠: `src-tauri/src/mnt/backup.rs:307`、`src-tauri/src/mnt/backup.rs:309`、`src-tauri/src/mnt/backup.rs:333`、`src-tauri/src/mnt/backup.rs:382`、`src-tauri/src/mnt/diagnostic_log.rs:103`、`src-tauri/src/mnt/diagnostic_log.rs:106`
- 害の経路: 一貫性破壊 / 回帰リスク — restore の退避ファイル削除失敗は残骸を残してもログに出ず、auto-backup の directory entry error は「本日のbackupなし」と誤判定して余分なbackupを作り得る。診断ログ cleanup も読めない entry を無言で飛ばすため、保持期限超過ログが残り続けても運用から観測できない。
- repo 規範との対照: `.claude/rules/implementation-quality.md:41` は継続可能な補助ファイル操作でも必ず `tracing::warn!` を残すと定め、同 `:56` は filesystem の catch-all を禁止して NotFound と permission/IO error の区別を要求する。
- 提案方向: 個別 entry・remove の失敗を少なくとも warn 記録し、一覧判定を変える IO error は上位へ返す。
- 想定労力: S
- 確度: 確実

### P3-3: migration の ROLLBACK 失敗を捨てて元エラーだけを返す
- 観点: error handling 一貫性
- 証拠: `src-tauri/src/db/migration.rs:92`、`src-tauri/src/db/migration.rs:93`、`src-tauri/src/db/migration.rs:100`、`src-tauri/src/db/migration.rs:104`、`src-tauri/src/db/schema_v2.rs:69`、`src-tauri/src/db/schema_v2.rs:70`、`src-tauri/src/db/schema_v2.rs:84`、`src-tauri/src/db/schema_v2.rs:105`、`src-tauri/src/db/schema_v3.rs:25`、`src-tauri/src/db/schema_v3.rs:36`
- 害の経路: 回帰リスク / 読み手の混乱 — SQL・version記録・FK検査の失敗後に ROLLBACK 自体が失敗しても `.ok()` で破棄され、呼び出し元は transaction が閉じたと誤認する。接続が transaction 中または lock 保持状態のままなら、その後の migration や起動処理が二次エラーを出し、最初の応答だけでは復旧不能状態を診断できない。
- repo 規範との対照: `.claude/rules/implementation-quality.md:14` は Result の握りつぶしを禁止し、`docs/function-design/22-mnt-migration.md:34` と同 `:38` は失敗時に ROLLBACK することを migration contract として要求する。
- 提案方向: rollback error を記録し、元エラーと併合して接続状態不明を呼び出し元へ伝える。
- 想定労力: M
- 確度: 確実

### P3-4: internal error の利用者表示 contract が実装経路ごとに分裂している
- 観点: error handling 一貫性
- 証拠: `src-tauri/src/cmd/mod.rs:51`、`src-tauri/src/cmd/mod.rs:64`、`src-tauri/src/cmd/mod.rs:68`、`src-tauri/src/cmd/settings_cmd.rs:58`、`src-tauri/src/cmd/settings_cmd.rs:64`、`src-tauri/src/cmd/settings_cmd.rs:226`、`src/features/backup-restore/BackupRestorePage.tsx:55`、`src/features/backup-restore/BackupRestorePage.tsx:56`、`docs/UI_TECH_STACK.md:497`
- 害の経路: 一貫性破壊 / 読み手の混乱 — BIZ由来の DB error は汎用文言に変換される一方、direct `CmdError::internal` は app path・SQLite・filesystem の具体的な文言を `message` に入れ、画面は kind を見ずそのまま表示する。利用者は同じ内部障害で技術詳細または汎用文言を画面次第で受け取り、どちらにも操作ログIDがないため、画面上の事象と診断ログを確実に対応付けられない。
- repo 規範との対照: `docs/UI_TECH_STACK.md:497` は `internal` を「汎用文言 + ログ誘導 + 操作ログID」で表示すると定めるが、`CmdError` は `kind/message/field` だけで correlation ID を持たず、frontend の `describeError` も kind 別変換をしない。
- 提案方向: internal の利用者向け表現と診断相関情報を共通 error 境界で一元化する。
- 想定労力: M
- 確度: 確実

## 第2パス（recall sweep）

### P3b-1: 旧DB移行が WAL コピー失敗後も成功扱いになり、部分DBを確定する
- 観点: error handling 一貫性
- 証拠: `src-tauri/src/db/mod.rs:195`、`src-tauri/src/db/mod.rs:207`、`src-tauri/src/db/mod.rs:212`、`src-tauri/src/db/mod.rs:214`、`src-tauri/src/db/mod.rs:219`、`src-tauri/src/db/mod.rs:229`、`src-tauri/src/db/mod.rs:304`
- 害の経路: 回帰リスク / 一貫性破壊 — 本体を先にコピーした後、存在する WAL のコピー失敗を warn だけで捨てて `Ok(true)` を返すため、WAL にだけ残る commit 済み在庫・売上更新を欠いた新DBが起動対象になる。新DB本体は既に存在するので次回起動も移行を skip し、欠落を自動回復できない。
- repo 規範との対照: `src-tauri/src/db/mod.rs:195` は移行 contract を WAL/SHM を含む「3ファイルセット」と明記し、`docs/DB_DESIGN.md:169` は SQLite を WAL mode で運用すると定める。`.claude/rules/implementation-quality.md:41` の best-effort 継続は補助ファイル失敗が許容される場合に限るが、この経路は WAL を欠いた部分移行を許容可能とする根拠を持たない。
- 提案方向: WAL が存在する移行ではそのコピー失敗を致命扱いにし、部分コピーを残さない。
- 想定労力: M
- 確度: 確実

### P3b-2: restore が現DBの WAL 退避失敗後も別スナップショットを同じ basename へ開く
- 観点: error handling 一貫性
- 証拠: `src-tauri/src/mnt/backup.rs:255`、`src-tauri/src/mnt/backup.rs:279`、`src-tauri/src/mnt/backup.rs:291`、`src-tauri/src/mnt/backup.rs:295`、`docs/function-design/71-mnt-backup.md:58`、`docs/function-design/71-mnt-backup.md:162`、`docs/function-design/71-mnt-backup.md:166`、`docs/function-design/71-mnt-backup.md:303`
- 害の経路: 回帰リスク / 一貫性破壊 — checkpoint が失敗し、続く WAL rename も失敗しても処理を続け、現DBの WAL を元の `{db_path}-wal` に残したまま選択した backup を `{db_path}` へコピーして接続を開く。旧 WAL の再生で選択時点より後の変更が混入するか接続が失敗し得るため、「指定backupへ安全に復元」の成否を warn だけで決めてしまう。
- repo 規範との対照: `docs/function-design/71-mnt-backup.md:58` は WAL mode でもデータ整合性を保証するとし、同 `:163` が checkpoint 失敗を非致命とする根拠は旧DBを退避・上書きすることにある。同 `:166` の WAL 退避自体が失敗した場合にもその根拠を適用する仕様はなく、実装は失敗注入テストも持たない。
- 提案方向: 残存 WAL を退避・除去できない場合は本体置換前に restore を中止する。
- 想定労力: M
- 確度: 確実
