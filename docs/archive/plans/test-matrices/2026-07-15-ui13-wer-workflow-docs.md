# Test Design Matrix: UI-13 WER 起源の workflow docs 正本化

docs-only の workflow gate change につき、検査は全て機械 token 検査 + 既存 gate の回帰実行。自動テストコードの追加はない。

| # | Contract | 検査 | 期待 |
|---:|---|---|---|
| 1 | SPEC-WF-UI13WER-D1 | `rg "Registration / Generation Obligations" docs/templates/plan-packet.md` | 節 header 1 hit |
| 2 | SPEC-WF-UI13WER-D1 | checklist の個別 token（packet AC ①〜⑨: collect_commands / specta::specta / generate_bindings / design_compliance_test / 必須セクション / generate_traceability / generate:routes / navigation / 到達導線） | 各 1 hit 以上 |
| 3 | SPEC-WF-UI13WER-D1 | 新節が「該当行を Scope と（R3/R4 は）Ledger に反映」を要求する文言を含む | 文言存在 |
| 4 | SPEC-WF-UI13WER-D2 | `rg "是正を仮適用" docs/DEV_WORKFLOW.md docs/templates/plan-packet.md` | 両ファイル hit |
| 5 | SPEC-WF-UI13WER-D3 | `rg "check-workflow-git.sh" docs/DEV_WORKFLOW.md` | state-only 遷移規則の文脈で hit |
| 6 | 回帰（gate 不変） | `bash scripts/doc-consistency-check.sh` | ERROR 0 |
| 7 | 回帰（gate 不変） | `bash scripts/local-ci.sh full` | PASS / start CLEAN / end CLEAN / MERGE_EVIDENCE_VALID=true |
| 8 | 回帰（enum / token 不変） | 追記 diff が既存行の削除・変更を含まない（PR diff レビュー、追加行のみ） | diff は追加のみ |
