# Test Design Matrix: backup / migration failure contract 実装 PR1

fixture / 注入の必須条件は **71 §71.10「fixture / 注入の必須条件」と 22 §12.5 冒頭を正本**とし、本 Matrix は行の列挙のみを担う（実 WAL fixture は `wal_autocheckpoint=0` または作成側接続保持 + 実行前 WAL frame 存在 assert / ファイル操作失敗は注入可能な file-ops 抽象（failpoint）で決定論的に / checkpoint 成否は戻り行 3 列検査 + busy=1 系を含める）。意味的完了条件 = 「どの失敗・中断時点でも元 snapshot または新 snapshot のどちらか一方が完全な形で残り、再接続可能」。

## legacy 移行（MNT-03-D2/D3/D4、22 §12.5 全行を継承）

| # | Contract | 検査 | 期待 |
|---|---|---|---|
| M1 | MNT-03-D2 | 実 WAL fixture（frame 存在 assert 済み）の移行 → 新パス再 open | WAL 内 row 含む全データ一致 |
| M2 | MNT-03-D2/D3 | VACUUM INTO 失敗注入 | `Err`、最終名 `inventory.db` 不存在、再実行で成功 |
| M3 | MNT-03-D3 | 一時名 → 最終名 rename 失敗注入 | 同上（部分状態ゼロ） |
| M4 | MNT-03-D2 ステップ6 | rename 直前に destination を出現させる（no-clobber、Probe #4 の primitive） | 既存 destination 非置換 + `Err` |
| M5 | MNT-03-D4 | 旧 DB 存在確認 error / CWD 解決失敗の注入 | skip（`Ok(false)`）ではなく `Err` → D4 経路 |
| M6 | MNT-03-D2 | 存在確認後に旧 DB 削除（TOCTOU）、NO_CREATE open | 空の旧 DB が作成されず `Err` |
| M7 | 回帰 | 新 DB 既存 / 旧 DB 確実不在の `Ok(false)` 経路 | 既存テスト維持 green |
| M8 | MNT-03-D4 | 移行 `Err` 時の lib.rs setup 経路（自動化可能範囲） | 起動中止（`init_database` 不到達 = 空 DB 不生成）+ 診断ログ |

## restore / reconcile（MNT-01-D1/D4/D5、71 §71.10 実装 PR1 該当行を継承）

| # | Contract | 検査 | 期待 |
|---|---|---|---|
| B1 | MNT-01-D1 | 実 WAL fixture で WAL/SHM 退避 rename 失敗注入 | 本体置換なし、元 DB が WAL 込みで再接続可能 |
| B2 | MNT-01-D1 | checkpoint 完了 / busy=1 両系の restore 成功系 | backup 時点データのみ、旧 WAL 混入なし（再 open + row 検証） |
| B3 | MNT-01-D4 | 巻き戻し失敗注入で main 不在化 → CMD 復旧 | 空 DB 不生成（no-create open）+ unrecoverable 識別子 |
| B4 | MNT-01-D5 | failpoint 中断 → reconcile（R1 一致 / R2 真部分集合 / R4 committed / 再中断）。元 DB の WAL/SHM 有無 × 中断点の全組合せ | 世代混在なく再接続可能 + 遺物ゼロ（71 §71.10 の oracle 分割に従う） |
| B5 | MNT-01-D5 | 退避後に新世代 WAL/SHM 生成 → restore 失敗 → 同期巻き戻し | 元名側に新世代 sidecar 残存なし |
| B6 | MNT-01-D5 | fail-closed 3 分岐（R3 superset / R5 manifest なし遺物あり / R7 パース不能+退避あり） | 遺物不変更 + 起動中止 + operator 可視化。R5 は退避実データ非削除を必須 assert |
| B7 | MNT-01-D5 | R6（パース不能 + 退避なし） | manifest のみ durable 削除、通常起動継続 |
| B8 | MNT-01-D5 | 補完処理の行分類 fixture 5 種（NULL detail_json / attempt_id 欠落 / 別 attempt / malformed / exact+malformed 併存） | 3 値集約（NoMatch→INSERT / Failed→残置 / AlreadyPresent→削除）どおり、記録件数厳密一致 |
| B9 | MNT-01-D5 | committed 更新 + cleanup の各操作直後 failpoint 中断（T0/R1/R4、log 補完恒久性の全系列含む） | 「manifest なし + 退避あり」誤爆ゼロ、operation_log ちょうど 1 件へ収束（71 §71.10 の oracle 分割に従う） |
| B10 | MNT-01-D5 前提 | 二重起動 | 後発 instance が restore / reconcile / legacy 移行（mutation）へ不到達 |
| B11 | Packet Decision 5（71 へ昇格） | single-instance plugin 初期化失敗の注入 | fail-closed 起動中止（ガード不在のまま mutation へ進まない） |
| B12 | MNT-01-D1 二重失敗契約 | 退避巻き戻し自体の失敗を注入（rollback-of-rollback、mnt 層） | 致命的エラー返却（`tracing::error!` 記録、71 §71.7 ステップ 8e 同等）+ 遺物（退避 + manifest）が変更されず残置され、次回起動の reconcile（R1/R2）で復旧可能 |

## frontend / wire（MNT-01-D4、68 §68.7）

| # | Contract | 検査 | 期待 |
|---|---|---|---|
| F1 | MNT-01-D4 | recoverable / unrecoverable 分岐を生成 bindings の識別子で固定、`rg "message.includes" src/features/backup-restore/` | 残存 0 件、識別子ベース分岐のテスト green |
| F2 | MNT-01-D5 (e)(ii) | durability 不明分類の非断定文言（68 文言表） | 該当 kind で非断定文言表示、他 kind と非混同 |

## 回帰感度（PR #15 教訓、Double Audit 2 pass = Codex）

| # | Contract | 検査 | 期待 |
|---|---|---|---|
| X1 | 全契約 | 実 mutation 注入: (a) 原子性巻き戻しの除去 (b) reconcile 分岐条件の取り違え (c) kind マップの取り違え (d) manifest sync 順序の除去 (e) no-clobber 確認の除去 | 各 mutation で対応テストが red になることの実証（推論ベース判定のみで完了扱いしない） |

## L3（Windows native、owner 実機）

| # | Contract | 検査 | 期待 |
|---|---|---|---|
| L3-1 | MNT-03-D4 | 移行失敗を人為的に起こし pre-window エラーダイアログ表示（Probe #1 で確定した機構） | ダイアログ視認 + 表示後終了 + 旧データ無傷 |
| L3-2 | MNT-01-D5 前提 | 実機で二重起動 | 後発が mutation へ到達しない（既存 window フォーカス等の観測可能挙動） |

## 回帰 gate

| # | Contract | 検査 | 期待 |
|---|---|---|---|
| G1 | 全体 | `cd src-tauri && cargo test` / `npm test` / typecheck / lint / format | 全 green、既存テスト削除・skip なし |
| G2 | docs 整合 | `bash scripts/doc-consistency-check.sh`（+ `--target plan`） | ERROR 0、既存 WARN 増加なし |
| G3 | L1 full | `bash scripts/local-ci.sh full` | PASS / start CLEAN / end CLEAN |
