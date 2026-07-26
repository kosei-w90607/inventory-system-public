# Test Design Matrix — wave 運用 DEV_WORKFLOW amendment（D-055 候補）

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-WAVE-2026-07-27 D1〜D7（packet Contract Coverage Ledger 参照。採用規範文 = anchor phrase 契約、per-lane 深さ維持 + 既存 state machine = 不変 guard 契約）

## Anchor Phrase Contract（plan-draft 時点で固定、Plan Gate で確定）

各採用規範文は下表の **anchor phrase を字句どおり含む文**で実装する。全 anchor は対象ファイルにおいて baseline 0 件を plan-draft 時点で実証する（実行記録は PR body へ転記し、本 doc には count を書かない）。したがって各 assertion は「未実装なら必ず red → 実装後に green」の弁別性を持つ。意味等価性（owner 決定 ↔ 規範文）は rg では検証できず、Double Audit の人的突合で閉じる。

| Decision ID | Anchor phrase（字句一致） | 対象 |
|---|---|---|
| D1 | `file footprint が互いに素` | `docs/DEV_WORKFLOW.md` Wave Operation 新節 |
| D1 | `生成 file を再生成する lane は 1 wave に 1 つまで` | 同上 |
| D2 | `Wave Registry` | `docs/DEV_WORKFLOW.md` Workflow State 節 + `Plans.md` |
| D2 | `registry に列挙されていない複数 active packet は従来どおり fail-closed` | `docs/DEV_WORKFLOW.md` Workflow State 節 |
| D3 | `batch で進めた各 lane に介入 1 回を計上` | `docs/DEV_WORKFLOW.md` Owner Effort Budget 節 |
| D4 | `ready-hosted-final への遷移は merge train 先頭の lane のみ` | `docs/DEV_WORKFLOW.md` Draft PR Checkpoint 節 or Wave Operation 新節 |
| D4 | `patch-id 同値` / `conflict が出た rebase は content change として implementing へ戻る` | 同上 |
| D5 | `裁定は Coordinator が直列` | `docs/DEV_WORKFLOW.md` Wave Operation 新節 |
| D6 | `全 lane 合算の同時 subagent 上限は 4` | `docs/DEV_WORKFLOW.md` Subagent Budget 節 |
| D7 | `単線運用へ戻す` | `docs/decision-log.md` D-055 |

## Assertion Commands（literal、repo root で実行）

各行 1 コマンド。`期待: 0` = exit 0（hit あり）、`期待: 1` = exit 1（hit なし）。

```bash
# M-A1a 期待: 0
rg -F 'file footprint が互いに素' docs/DEV_WORKFLOW.md
# M-A1b 期待: 0
rg -F '生成 file を再生成する lane は 1 wave に 1 つまで' docs/DEV_WORKFLOW.md
# M-A3a 期待: 0
rg -F 'Wave Registry' docs/DEV_WORKFLOW.md
# M-A3b 期待: 0
rg -F 'Wave Registry' Plans.md
# M-A4 期待: 0
rg -F 'registry に列挙されていない複数 active packet は従来どおり fail-closed' docs/DEV_WORKFLOW.md
# M-A5 期待: 0
rg -F 'batch で進めた各 lane に介入 1 回を計上' docs/DEV_WORKFLOW.md
# M-A6 期待: 0
rg -F 'ready-hosted-final への遷移は merge train 先頭の lane のみ' docs/DEV_WORKFLOW.md
# M-A7a 期待: 0
rg -F 'patch-id 同値' docs/DEV_WORKFLOW.md
# M-A7b 期待: 0
rg -F 'conflict が出た rebase は content change として implementing へ戻る' docs/DEV_WORKFLOW.md
# M-A8 期待: 0
rg -F '裁定は Coordinator が直列' docs/DEV_WORKFLOW.md
# M-A9 期待: 0
rg -F '全 lane 合算の同時 subagent 上限は 4' docs/DEV_WORKFLOW.md
# M-A10 期待: 0
rg -F '単線運用へ戻す' docs/decision-log.md
# M-D055 期待: 0（decision-log 起票 + DEV_WORKFLOW からの参照の両方）
rg -F 'D-055' docs/decision-log.md docs/DEV_WORKFLOW.md
```

## 不変 guard 契約（per-lane 深さ・state machine 非接触の機械証明）

```bash
# M-N1 期待: 1（phase enum 行の不改変）
git diff main -- docs/DEV_WORKFLOW.md | rg -F 'kickoff | spec-check | design | plan-draft'
# M-N2 期待: 1（遷移表の行を 1 行も増減・改変しない。表の行は `| <from> → <to> |` 形式）
git diff main -- docs/DEV_WORKFLOW.md | rg '^[+-]\|.*→'
# M-N3 期待: 1（STATECAP / state-backtrack 契約の不改変）
git diff main -- docs/DEV_WORKFLOW.md | rg '^[+-].*state-backtrack'
# M-N4 期待: 1（Contract Audit 節の不改変 = 検査の深さ非接触）
git diff main -- docs/DEV_WORKFLOW.md | rg '^[+-].*(Double audit|Mutation adequacy|Negative-space)'
# M-N5 期待: 1（ci.md 完全不変）
git diff --quiet main -- docs/ci.md && echo UNCHANGED
# M-N6 期待: 0（per-lane Risk 別 subagent 上限表の維持 = D-034 表が残存）
rg -F 'Max concurrent sub-agents' docs/DEV_WORKFLOW.md
# M-N7 期待: 0（per-change 介入予算既定 3 の残存）
rg -F 'interventions ≤3' docs/DEV_WORKFLOW.md
```

## Mutation 感度実測（実装後、clean tree で実注入 → red 確認 → 復元）

| Mutation ID | 注入内容 | 検出する assertion | 対応 Decision |
|---|---|---|---|
| X1 | A4 文（registry 外 fail-closed）を削除 | M-A4 が exit 1 に反転 | D2 |
| X2 | A7b 文の `implementing へ戻る` を `Phase を維持する` に書換 | M-A7b が exit 1 に反転 | D4 |
| X3 | A5 文（batch 介入計上）を削除 | M-A5 が exit 1 に反転 | D3 |
| X4 | A1a 文（互いに素）を削除 | M-A1a が exit 1 に反転 | D1 |
| X5 | A9 文の上限 `4` を `16` に書換 | M-A9 が exit 1 に反転 | D6 |
| X6 | decision-log D-055 の rollback 文（単線運用へ戻す）を削除 | M-A10 が exit 1 に反転 | D7 |

実測は commit 済み clean tree 上で行い、注入 → red 確認 → `git checkout -- <file>` 復元 → 復元後の green 再確認を X ごとに記録する（記録先 = PR body、count / SHA は tracked doc に書かない）。

## 既存 checker

```bash
# 期待: PASS
bash scripts/doc-consistency-check.sh
# 期待: PASS（active plan 存在時）
bash scripts/doc-consistency-check.sh --target plan
# 期待: PASS（state-only / STATECAP 契約）
bash scripts/check-workflow-git.sh
```

## 旧文言 sweep 契約

- 実装 commit 後、単一 active packet 前提の live 記述の sweep evidence を PR body に記録する: `rg -n 'single active packet' docs/ Plans.md AGENTS.md .agents/ .claude/`（archive 配下の歴史記述は非改変・非対象）。hit が残る場合は D2 の読み替え注記を同一 PR で追記するか、明示的に「歴史記述のため対象外」と PR body で裁定する。
