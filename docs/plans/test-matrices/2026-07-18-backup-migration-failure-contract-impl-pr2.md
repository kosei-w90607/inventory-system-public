# Test Design Matrix: backup / migration failure contract 実装 PR2

## Risk

Risk: R4

fixture / 注入の必須条件: (1) cleanup テストの削除対象は temp dir 内 synthetic ファイルのみ（実 `app_data/backups` 非参照）。(2) 設定読取の DB error 注入は決定論的に行う（例: 接続 close 済み / `app_settings` テーブル drop 済みの接続、または PR1 の `RestoreFileOps` trait 抽象に相当する注入可能抽象。乱数・タイミング依存は禁止）。(3) COMMIT BUSY は実 2 接続 lock で再現する（Contract Probe A で決定論的手順を実証済み: 別接続が shared lock 保持中の COMMIT は `SQLITE_BUSY`）。(4) ROLLBACK 失敗注入は注入可能抽象（execute 層の failpoint）で決定論的に。(5) 意味的完了条件 = 「破壊的操作は入力と前提状態を確定できた場合のみ実行され、確定できない失敗は既定値・成功へ変換されず記録付きで安全側に倒れる」。

## Contracts Under Test

- MNT-01-D2（71 §71.9): resolve_backup_dir の Result 化。DB error は Err、fallback は未設定/空文字のみ。
- MNT-01-D3（71 §71.8): cleanup 保持日数の確定条件。DB error / parse 失敗は skip + warn、削除実行しない。
- MNT-03-D1（22 §3.2): ROLLBACK/COMMIT 失敗の記録 + 併合 + transaction 状態確定（is_autocommit）+ FK 復元の再読取検証。

## Failure Modes

- DB error が既定値（既定 dir / 既定 3 日）へ無言変換され、誤ディレクトリ参照・誤削除が走る。
- 設定破損（parse 不能値）が未設定と同一視され、既定日数で削除が走る。
- ROLLBACK/COMMIT/FK 復元の失敗が無記録で握りつぶされ、transaction/lock 状態不明のまま後続処理が二次エラーを出す。
- FK 復元 PRAGMA が transaction 中 no-op（成功返却）のまま検証されず、FK 無効のまま運用が継続する。

## Test Matrix

### resolve_backup_dir（MNT-01-D2）

| # | Contract | Failure Mode | Test Type | 検査 | 期待 / Would fail if... |
|---|---|---|---|---|---|
| C1 | MNT-01-D2 | DB error の無言 fallback | unit | 設定読取に DB error を注入して `resolve_backup_dir` を呼ぶ | `Err(DbError)` が返る。`.ok().flatten()` に戻すと red |
| C2 | MNT-01-D2 | — | unit（回帰） | 設定行不存在（None） | `Ok(app_data/backups)` |
| C3 | MNT-01-D2 | 空文字の扱い誤り | unit | `backup_path` = 空文字 | `Ok(app_data/backups)`（空文字は未設定扱い） |
| C4 | MNT-01-D2 | — | unit（回帰） | `backup_path` = 有効パス | `Ok(設定値)` |
| C5 | MNT-01-D2 | 起動経路の配線漏れ | integration（自動化可能範囲） | lib.rs 起動契約と同形の呼び出しで resolve Err | warn 記録 + check_auto_backup 不実行 + 処理継続（panic / Err 伝搬で停止しない） |
| C6 | MNT-01-D2 | CMD 経路の配線漏れ | CMD unit | `get_backup_dir` 経由で DB error 注入 | `CmdError`（internal、既存 error 変換規約）が返る |
| C7 | MNT-01-D2 | 呼び出し元の取り残し | 機械走査 + review | `rg 'resolve_backup_dir' src-tauri/src/` で全呼び出し元 enumeration | 全呼び出し元（lib.rs / settings_cmd.rs get_backup_dir）が Result 契約を処理。旧シグネチャ前提の箇所ゼロ |
| C8 | MNT-01-D2 | D-032 経路の回帰 | regression | restore / 復元前強制バックアップの既存テスト | green 維持（create_backup 経由の DB error 伝搬は既存挙動のまま） |

### cleanup 確定条件（MNT-01-D3）

| # | Contract | Failure Mode | Test Type | 検査 | 期待 / Would fail if... |
|---|---|---|---|---|---|
| D1 | MNT-01-D3 (b) | — | unit | 設定行不存在 + 期限超過 synthetic ファイル（4 日前） | 既定 3 日で削除実行（確定条件 (b) の成立）。未設定まで skip にすると red |
| D2 | MNT-01-D3 | DB error → 既定日数 fallback | unit | 保持日数読取に DB error を注入 + 期限超過ファイルあり + backup 作成条件成立 | **削除 0 件** + `tracing::warn!` 記録 + **backup 作成自体は成功**（同時 assert）。`unwrap_or(3)` に戻すと red |
| D3 | MNT-01-D3 | parse 失敗 → 既定日数 fallback | unit | `backup_retention_days` = `"abc"` + 期限超過ファイルあり | **削除 0 件** + warn 記録。parse 失敗を既定適用にすると red |
| D4 | MNT-01-D3 (a) | 確定値の無視 | unit | `backup_retention_days` = `"90"` + 4 日前ファイル | 削除 0 件（90 日基準）。既定 3 日で上書きする実装だと red（4 日前ファイルが消えて検出） |
| D5 | MNT-01-D3 | — | regression | 既存 cleanup テスト（`test_cleanup_old_backups_req901_*`） | green 維持（期限超過削除・パターン不一致 skip 等） |

### migration ROLLBACK / COMMIT / FK 復元（MNT-03-D1）

| # | Contract | Failure Mode | Test Type | 検査 | 期待 / Would fail if... |
|---|---|---|---|---|---|
| E1 | 22 §3.2 | — | unit（回帰） | SQL 失敗 + ROLLBACK 成功 | `DbError::MigrationFailed` に version + 失敗 SQL 概要（既存契約維持） |
| E2 | MNT-03-D1 | ROLLBACK 失敗の無言破棄 | unit（失敗注入） | SQL 失敗後の ROLLBACK に失敗を注入 | `tracing::error!` 記録 + 併合メッセージ（元エラー + ROLLBACK エラー + `transaction 状態不明`）。`.ok()` に戻すと red |
| E3 | MNT-03-D1 | COMMIT 失敗の状態不確定 | integration（実 2 接続 lock） | 別接続の shared lock 保持中に COMMIT（Probe A 手順） | `is_autocommit()` 確認 → ROLLBACK 試行 → 併合規則で報告。lock 解放後の再実行で migration 成功（transaction が残っていないこと） |
| E4 | MNT-03-D1 | 閉塞不能時の FK 復元続行 | unit（失敗注入） | COMMIT 失敗 + ROLLBACK も失敗（注入） | FK 復元を試みず、接続破棄必須を示す構造化された致命エラー。復元続行する実装だと red |
| E5 | MNT-03-D1 | FK 復元の no-op 素通り | unit | v2 経路で FK 復元後の再読取一致検証を assert（transaction 開放済み経路 + transaction 残存経路の両方） | 復元後再読取 = 元値。再読取検証を除去すると red（Probe B: transaction 中 PRAGMA は成功を返す no-op のため、実行記録だけでは検出不能） |
| E6 | MNT-03-D1 | ヘルパー適用漏れ | 機械走査 + review | `rg 'ROLLBACK' src-tauri/src/db/` で全 8 箇所（migration.rs:2 / schema_v2.rs:4 / schema_v3.rs:2 相当）enumeration | 全箇所が共通ヘルパー経由。裸の `execute_batch("ROLLBACK").ok()` 残存ゼロ |
| E7 | MNT-03-D1 | 復元・再読取失敗の無記録 | unit（失敗注入） | inner Err 時の FK 復元失敗 / 再読取失敗を注入 | 記録（tracing）+ エラー報告に反映。無記録通過（現行挙動）に戻すと red |

### 実 mutation 注入（回帰感度、PR #15 教訓、Double Audit 2 pass = Codex）

| # | Contract | Mutation | 期待 |
|---|---|---|---|
| X1a | MNT-03-D1 | ROLLBACK 失敗の併合を除去（元エラーのみ返す） | E2 が red |
| X1b | MNT-03-D1 | COMMIT 失敗後の is_autocommit 確認 + ROLLBACK 試行を除去 | E3 が red |
| X1c | MNT-01-D3 | 確定条件を `unwrap_or(3)` 相当へ戻す | D2 / D3 / D4 のいずれかが red |
| X1d | MNT-01-D2 | `resolve_backup_dir` を `.ok().flatten()` へ戻す | C1 / C6 が red |
| X1e | MNT-03-D1 | FK 復元の再読取一致検証を除去 | E5 が red |

各 mutation で red になったテスト名を PR body に記録する（推論ベース判定のみで完了扱いしない）。

### 回帰 gate

| # | Contract | 検査 | 期待 |
|---|---|---|---|
| G1 | 全体 | `cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test` | 全 green、既存テスト削除・skip なし |
| G2 | 全体 | `cd src-tauri && cargo check --release` | green（PR1 release build 盲点の教訓） |
| G3 | 全体 | `cargo run --bin generate_traceability -- --check` / `cargo run --bin generate_bindings` 後の `git diff --exit-code src/lib/bindings.ts` | drift ゼロ / 差分ゼロ |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| migration transaction（1 version 分） | autocommit | BEGIN 後 | COMMIT + version 記録 | — | — | — | 再起動で未適用分から再開 | SQL/COMMIT 失敗 → ROLLBACK + 状態確定（is_autocommit）+ 併合報告 | 再起動 = 再試行（自動再試行なし、rejected 済み） | E1〜E4 |
| PRAGMA foreign_keys（v2 経路） | ON（元値保存） | OFF（transaction 外で設定） | 復元 + 再読取一致 | — | — | — | 接続破棄時は新接続で既定 ON | 復元不能（transaction 残存）→ 接続破棄必須 fatal | — | E4 / E5 / E7 |
| backup_retention_days 確定 | 設定行なし = 既定 3 日 | 読取中 | (a) parse 成功値 / (b) 既定 3 日 | — | 次回 cleanup 時に再読取 | — | — | DB error / parse 失敗 → 未確定 = skip + warn（削除なし） | 次回成功時に自然回復（溜まったファイルも次回削除対象） | D1〜D4 |
| backup_path 解決 | 未設定 = app_data/backups | 読取中 | 設定値 or 既定 | 設定保存時（既存 invalidate 契約、変更なし） | — | — | 起動ごとに再解決 | DB error → Err（起動時 = skip / CMD = internal error） | 次回呼び出しで再解決 | C1〜C6 |

workflow-state 行（本 packet の遷移運用は DEV_WORKFLOW の transition table に従う。STATECAP: forward state-only 3 / post-impl 2 の cap 内で、plan-approval 系は plan-first content commit へ同乗させる）:

- content candidate -> L1 / independent review -> state-only human-confirm commit
- owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit
- state-only violation: file allowlist と `git diff --unified=0` hunks の両方を検査
- hosted-not-required incidental failure: 非該当（本 packet は hosted required）

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| ROLLBACK 失敗処理（`.ok()` 破棄の是正） | `migration.rs:93,104` / `schema_v2.rs:70,84,93,105` / `schema_v3.rs:25,36`（`rg 'ROLLBACK' src-tauri/src/db/` で全 8 箇所） | 全 8 箇所へ共通ヘルパー適用 | なし（以降の schema_vN も同ヘルパー使用を 22 §3.2 が要求） | E6 |
| 巻き戻し失敗の格上げパターン（PR1 `rollback_after_failure`、`restore.rs:324-354`） | mnt/restore.rs（PR1 実装） | 設計パターンとして migration 用ヘルパーへ転用（コード共有はしない — 層と エラー型が異なる） | mnt 層の `RestoreError` は流用しない（DB 層は `DbError`） | E2 / E4 の実装レビュー |
| tracing 構造化イディオム（`tracing::warn!(error = %e, ...)`） | `backup.rs:173,356` / `restore.rs:334` | 新規 warn/error 記録箇所（run_cleanup skip / ROLLBACK 失敗 / FK 復元失敗） | — | D2/D3/E2/E7 のログ assert または実装レビュー |
| COMMIT 直接 `?` の是正 | `migration.rs:111-112` / `schema_v2.rs:113-114` / `schema_v3.rs:43-44`（3 箇所） | 全 3 箇所へ is_autocommit 確認 + ROLLBACK 試行 | — | E3 + 実装レビュー |

## Negative Paths

- missing input: 設定行不存在（C2 / D1 — fallback / 既定日数の正当経路）。
- invalid input: parse 不能な保持日数（D3）、空文字 backup_path（C3）。
- duplicate/ambiguous input: 非該当（設定 key は単一行）。
- unknown reference: 非該当。
- dependency missing: `app_settings` テーブル不在級の DB error（C1 / D2 の注入手段候補）。
- permission/write failure: cleanup の個別ファイル削除失敗は既存契約（warn + 続行、71 §71.5）のまま — 本 PR の対象外だが回帰を D5 で担保。
- dry-run side effect: skip 経路（D2/D3）でファイルシステムへの削除副作用ゼロを assert。

## Boundary Checks

- threshold: 保持日数境界（D1 = 4 日前ファイル vs 3 日既定、D4 = 4 日前ファイル vs 90 日設定）。
- null/default: None → 既定（C2/D1）、Err → 非確定（C1/D2）。この 2 つの区別が本 PR の中核境界。
- empty/non-empty: 空文字 backup_path（C3）。
- min/max: parse は u32 既存挙動（負値・巨大値は parse 失敗 → D3 経路）。
- status/policy enum: 非該当（新 enum なし）。
- wire type / internal type / producer/consumer / round-trip token / precision/range / cross-language parse: 変更なし（packet Boundary / Wire Contract 節参照。bindings 差分ゼロ = G3）。

## Compatibility Checks

- old schema/input: 既存 DB（設定行あり/なし両方）で挙動不変（C2/C4/D1/D4）。
- new schema/input: 新 schema なし。
- output order: 非該当。
- optional field behavior: 非該当。

## Data Safety Checks

- source-derived data: 実店舗データ・実 backup 非使用。fixture は synthetic のみ。
- generated outputs: テスト生成物は temp dir に限定し tracked ファイルを汚さない。
- secrets: 非接触。
- local-only files: 実 `app_data/backups` を参照するテスト禁止。
- synthetic sample boundaries: ファイル名は実規約（`inventory_backup_YYYYMMDD_HHMMSS.db`）に従う synthetic 名のみ。

## Main Wiring / Integration Checks

- helper connected to main path: 共通 ROLLBACK ヘルパーが 8 箇所すべての実経路に配線（E6）、`resolve_backup_dir` 新契約が lib.rs / settings_cmd の実経路に配線（C5/C6/C7）。
- output reaches manifest/report: 非該当（manifest なし）。
- effective config reaches runtime: 確定した保持日数が実際に cleanup 判定へ到達（D4 — 90 日設定で 4 日前ファイルが残る）。
- CLI arg reaches implementation: 非該当。

## Mutation-style Adequacy Questions

- mock 値が設計書期待値と異なる場合に検出する assertion: D4（設定 90 vs 既定 3 の判別）、E2（併合メッセージに元エラー・ROLLBACK エラー双方の実文字列を assert — 固定文言 mock では通らない）。
- invalidate/refetch の順序: backup_path 保存時 invalidate は既存契約（変更なし、C8 回帰）。
- key branch 反転: 確定条件 (a)/(b) と Err の分岐反転 → C1 vs C2、D1 vs D2 が対で検出。
- threshold 比較変更: D1/D4 が検出。
- guard 除去: X1b（is_autocommit）、X1e（再読取検証）。
- output field 省略: E2 の併合メッセージ 3 要素（元エラー / ROLLBACK エラー / transaction 状態不明）を個別に assert。
- Workflow State に PR HEAD を書くか: 書かない（Final Exact-HEAD Evidence: PR body）。
- hosted URL/headSha の commit: しない。
- state-only commit で Scope/AC 編集: hunk-level 検査で拒否（上記 workflow-state 行）。
- output order / dry-run / JSON safe integer / state token round-trip: 非該当（wire 変更なし）。

## Residual Test Gaps

- lib.rs setup hook そのものの end-to-end 起動テストは既存制約どおり困難（PR1 M8 と同等の「自動化可能範囲」に留める）。C5 は起動契約と同形の呼び出しで代替し、実起動での観測は通常運用の起動ログで担保。
- ROLLBACK 失敗の実 SQLite 再現（注入なし）は決定論的手順が確立していないため注入で代替（COMMIT BUSY のみ実 lock で再現 = E3）。
- 「以降の schema_vN も同ヘルパー」の将来適用は本 PR では E6 の走査を CI 常設化まではせず review で担保（機械化は将来の workflow docs PR で検討）。
