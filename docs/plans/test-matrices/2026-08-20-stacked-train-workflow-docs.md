# Test Design Matrix: stacked train + 発注書規律の workflow docs 正本化

docs-only change。検証は anchor token の rg exact 存在（新文言 exact 存在 + 旧文言 0 hit の対 oracle 方式）+ mutation（anchor 文削除 / 意味反転で red）で行う。anchor 文字列は Writer が実装時に確定し、`rg -F -c` で repo 内重複 0 を確認してから本 Matrix に固定転記する。

| # | Ledger | 対象 doc | 検証内容 | red 条件（mutation） |
|---|---|---|---|---|
| M-S1 | L1 | DEV_WORKFLOW Wave Operation | stacked train 定義 anchor 1 hit + 「file footprint 互いに素」適用除外の明記 | 定義文削除で 0 hit |
| M-S2 | L2 | 同上 | 単段 merge anchor 1 hit + 多段 merge 禁止 + `git merge-tree` 事前判定の共起 | 「単段」→「多段」反転で共起検査 fail |
| M-S3 | L3 | 同上 | STATECAP 継承計上 + content commit 同乗の共起 | 継承計上文削除で 0 hit |
| M-S4 | L4 | 同上 | delta 再検証条件（実装 file に及ぶ場合）1 hit | 条件文削除で 0 hit |
| M-S5 | L5 | DEV_WORKFLOW Review Rules | 連番契約 registry 採番規律 1 hit + 出典 PR 番号共起 | 規律文削除で 0 hit |
| M-S6 | L6 | AGENT_OPERATING_MANUAL §5.6 | 節番号実在確認 1 hit | 同上 |
| M-S7 | L7 | 同上 | 90-traceability 再生成の完了条件明記 1 hit | 同上 |
| M-S8 | L8 | DEV_WORKFLOW Human Visual Confirmation For Screen Changes | fixture encoding 規律 1 hit | 同上 |
| M-S9 | AC2 | 横断 | D-055「conflict-free rebase 限定」/ D-038 cap 3 / D-039 canonical subject の既存文言が不変（`git diff` で該当行 0 変更 or 参照追記のみ） | 既存契約文の書換えが diff に現れたら fail |
| M-S10 | AC4 | 横断 | `scripts/local-ci.sh full` PASS / doc-consistency ERROR 0 / `generate_traceability --check` 不変 | — |

- 実装予約: Writer は anchor 確定後、本 Matrix の「検証内容」列へ exact 文字列を転記し、mutation 実施記録（注入 → red → 復元）を Implementation Results に残す（SHA / 件数は PR body）。
- 検査は手動 rg（機械 test 化しない）。checker script への検査追加は Non-scope。
