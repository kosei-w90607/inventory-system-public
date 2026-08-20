# Test Design Matrix: stacked train + 発注書規律の workflow docs 正本化

docs-only change。検証は anchor token の rg exact 存在（新文言 exact 存在 + 旧文言 0 hit の対 oracle 方式）+ mutation（anchor 文削除 / 意味反転で red）で行う。anchor 文字列は Writer が実装時に確定し、`rg -F -c` で repo 内重複 0 を確認してから本 Matrix に固定転記する。

| # | Ledger | 対象 doc | 検証内容 | red 条件（mutation） |
|---|---|---|---|---|
| M-S1 | L1 | DEV_WORKFLOW Wave Operation | anchor exact `逐次依存 train の適用除外` 1 hit + 「file footprint 互いに素」適用除外の明記 | 定義文削除で 0 hit |
| M-S2 | L2 | 同上 | anchor exact `origin/main 単段 merge を base 付け替えの確立手順とする` 1 hit + 多段 merge 禁止 + `git merge-tree` 事前判定の共起 | 「単段」→「多段」反転で共起検査 fail |
| M-S3 | L3 | 同上 | anchor exact `継承 commit は STATECAP の二段 cap の双方に計上されうる` 1 hit + content commit 同乗 + aggregate ≤3 / post-impl subset ≤2 の共起 | 継承計上文削除 or 二段 cap 言及削除で 0 hit |
| M-S4 | L4 | 同上 | anchor exact `実装 file まで解消した merge delta は独立再検証する` 1 hit | 条件文削除で 0 hit |
| M-S5 | L5 | DEV_WORKFLOW Review Rules | anchor exact `連番契約 registry の採番を後続 lane が確定する` 1 hit + 出典 PR 番号共起 | 規律文削除で 0 hit |
| M-S6 | L6 | AGENT_OPERATING_MANUAL §5.6 | anchor exact `doc 節番号は referent 一致まで検証する` 1 hit | 同上 |
| M-S7 | L7 | 同上 | anchor exact `REQ token 変更の発注は 90-traceability 再生成を完了条件にする` 1 hit | 同上 |
| M-S8 | L8 | DEV_WORKFLOW Human Visual Confirmation For Screen Changes | anchor exact `取込み fixture は実 encoding にそろえる` 1 hit | 同上 |
| M-S9 | AC2 | 横断 | D-055「conflict-free rebase 限定」/ D-038 cap 3 / D-039 canonical subject の既存文言が不変（`git diff` で該当行 0 変更 or 参照追記のみ） | 既存契約文の書換えが diff に現れたら fail |
| M-S10 | AC4 | 横断 | `scripts/local-ci.sh full` PASS / doc-consistency ERROR 0 / `generate_traceability --check` 不変 | — |
| M-S11 | L9 | decision-log | D-074 anchor exact `stacked train の base 付け替えを単段 merge で確立する` 1 hit + Decision / Status / Why / Revisit（merge-tree 事前判定の実測検証） | D-074 削除 or Revisit 欠落で fail |

- 実装予約: Writer は anchor 確定後、本 Matrix の「検証内容」列へ exact 文字列を転記し、mutation 実施記録（注入 → red → 復元）を Implementation Results に残す（SHA / 件数は PR body）。
- 検査は手動 rg（機械 test 化しない）。checker script への検査追加は Non-scope。
