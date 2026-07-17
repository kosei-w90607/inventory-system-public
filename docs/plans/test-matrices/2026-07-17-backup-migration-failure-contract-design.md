# Test Design Matrix: backup / migration failure contract 正本確定（design phase）

docs-only の design phase につき、検査は機械 token 検査 + 既存 gate の回帰実行 + レビュー突合。自動テストコードの追加はない（failure injection / 実 WAL fixture テストは後続 R4 実装 2 PR の完了条件として本改訂が設計書に固定する）。

| # | Contract | 検査 | 期待 |
|---:|---|---|---|
| 1 | MNT-03-D1（ROLLBACK 失敗の記録 + 併合） | `rg "MNT-03-D1" docs/function-design/22-mnt-migration.md` + 該当節に「記録」「併合」「transaction 状態不明」相当の契約文言 | ID と契約文言が存在 |
| 2 | MNT-03-D2/D3（VACUUM INTO 移行 + 完成品不変条件） | `rg "MNT-03-D2\|MNT-03-D3" docs/function-design/22-mnt-migration.md` + 一時名生成 → rename、失敗時削除、通常モード open の記述 | ID と契約文言が存在 |
| 3 | MNT-03-D4（移行失敗の fail-closed 起動中止 + dialog 可視化） | `rg "MNT-03-D4" docs/function-design/22-mnt-migration.md` + 空 DB 隠蔽禁止の理由と tradeoff 記述 | ID・理由・tradeoff が存在 |
| 4 | MNT-01-D1（退避失敗での restore 中止 + 二重失敗契約） | `rg "MNT-01-D1" docs/function-design/71-mnt-backup.md` + 巻き戻し失敗 = 致命的エラーの明記 | ID と二重失敗契約が存在 |
| 5 | MNT-01-D2（resolve_backup_dir Result 化） | `rg "MNT-01-D2" docs/function-design/71-mnt-backup.md` + §71.9 コード例から `.ok().flatten()` 消滅 | ID 存在、握りつぶしコード例なし |
| 6 | MNT-01-D3（cleanup 保持日数の確定条件） | `rg "MNT-01-D3" docs/function-design/71-mnt-backup.md` + 「DB error / parse 失敗 = skip」「未設定のみ既定 3 日」の区別 | ID と確定条件が存在 |
| 7 | D-048（durable decision） | `rg "^## D-048" docs/decision-log.md` | 1 hit、柱 3 本 + 2 PR 分割を含む |
| 8 | 5 findings の被覆 | PR body の findings → 改訂節 対応表を、findings の害経路記述と突合（独立 Final Review） | P3-1/P3-3/P3b-1/P3b-2/P8b-3 全行に改訂節が対応 |
| 9 | 実装 PR テスト方針の固定（P8b-3） | 22 テスト方針 / 71 §71.10 に実 WAL fixture・失敗注入の完了条件行 | 追加行が存在 |
| 10 | 回帰（gate 不変） | `bash scripts/doc-consistency-check.sh` / `--target plan` | ERROR 0、既存 WARN 増加なし |
| 11 | 回帰（design compliance） | `cd src-tauri && cargo test --test design_compliance_test` | pass（71/22 の必須セクション維持） |
| 12 | 回帰（既存契約の非破壊） | §71.7 CMD 再接続パターン・v2 foreign_keys 復元保証・D-032 復元前強制バックアップの記述が削除・矛盾していないこと（独立 Final Review） | 矛盾なし |
| 13 | L1 full | `bash scripts/local-ci.sh full` | PASS / start CLEAN / end CLEAN |
