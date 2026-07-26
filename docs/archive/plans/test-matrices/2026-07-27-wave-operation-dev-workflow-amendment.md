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
| D2 | `registry と実在 packet の不一致` | 同上（fail-closed 経路②） |
| D2 | `registry の陳腐化` | 同上（fail-closed 経路③） |
| D3 | `batch で進めた各 lane に介入 1 回を計上` | `docs/DEV_WORKFLOW.md` Owner Effort Budget 節 |
| D3 | `decision point 単位` | 同上（batch 粒度 = lane 独立採否・session 単位計上の禁止） |
| D4 | `ready-hosted-final への遷移は merge train 先頭の lane のみ` | `docs/DEV_WORKFLOW.md` Draft PR Checkpoint 節 or Wave Operation 新節 |
| D4 | `patch-id 同値` / `conflict が出た rebase は content change として implementing へ戻る` | 同上 |
| D4 | `Rebase Map` | 同上 + `scripts/check-workflow-git.sh` PK5（`Plan Commit`・`Amendments` 原 SHA 列は不変のまま、plan-first + 各 Amendment SHA の Map 適用後実効 SHA で検証。Amendment 1） |
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
# M-A4b 期待: 0
rg -F 'registry と実在 packet の不一致' docs/DEV_WORKFLOW.md
# M-A4c 期待: 0
rg -F 'registry の陳腐化' docs/DEV_WORKFLOW.md
# M-A5 期待: 0
rg -F 'batch で進めた各 lane に介入 1 回を計上' docs/DEV_WORKFLOW.md
# M-A5b 期待: 0
rg -F 'decision point 単位' docs/DEV_WORKFLOW.md
# M-A6 期待: 0
rg -F 'ready-hosted-final への遷移は merge train 先頭の lane のみ' docs/DEV_WORKFLOW.md
# M-A7a 期待: 0
rg -F 'patch-id 同値' docs/DEV_WORKFLOW.md
# M-A7b 期待: 0
rg -F 'conflict が出た rebase は content change として implementing へ戻る' docs/DEV_WORKFLOW.md
# M-A8 期待: 0
rg -F '裁定は Coordinator が直列' docs/DEV_WORKFLOW.md
# M-A11a 期待: 0（DEV_WORKFLOW 側。X7 の検出 oracle はこちら — combined 形は checker 側 hit で mutation を素通しするため分割〈Amendment 1〉。
# assertion は定義文 literal に特定化: 汎用 'Rebase Map' では Draft PR Checkpoint 節の cross-reference hit が残り、定義文削除を検出できない〈Amendment 2、Coordinator 独立再実測で実証〉）
rg -F 'Rebase Map: <旧 SHA> -> <新 SHA>' docs/DEV_WORKFLOW.md
# M-A11b 期待: 0（checker 側）
rg -F 'Rebase Map' scripts/check-workflow-git.sh
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
# M-N2 期待: 1（遷移表の行を 1 行も増減・改変しない。regex は遷移表の 2 列行形〈`| xxx → yyy | evidence |`〉に限定。
# 実装注記: D-055 の新規表 cell では `→` を使わない — この guard の誤爆防止）
git diff main -- docs/DEV_WORKFLOW.md | rg '^[+-]\|[^|]*→[^|]*\|[^|]*\|$'
# M-N3 期待: 1（STATECAP / state-backtrack 契約の不改変）
git diff main -- docs/DEV_WORKFLOW.md | rg '^[+-].*state-backtrack'
# M-N4 期待: 1（Contract Audit 節の不改変 = 検査の深さ非接触）
git diff main -- docs/DEV_WORKFLOW.md | rg '^[+-].*(Double audit|Mutation adequacy|Negative-space)'
# M-N5 期待: 0 かつ出力 UNCHANGED（ci.md 完全不変。--quiet は不変時 exit 0 — 期待表記の誤りを Amendment 1 で訂正）
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
| X1b | fail-closed 経路②文（registry と実在 packet の不一致）を削除 | M-A4b が exit 1 に反転 | D2 |
| X1c | fail-closed 経路③文（registry の陳腐化）を削除 | M-A4c が exit 1 に反転 | D2 |
| X2 | A7b 文の `implementing へ戻る` を `Phase を維持する` に書換 | M-A7b が exit 1 に反転 | D4 |
| X3 | A5 文（batch 介入計上）を削除 | M-A5 が exit 1 に反転 | D3 |
| X4 | A1a 文（互いに素）を削除 | M-A1a が exit 1 に反転 | D1 |
| X5 | A9 文の上限 `4` を `16` に書換 | M-A9 が exit 1 に反転 | D6 |
| X6 | decision-log D-055 の rollback 文（単線運用へ戻す）を削除 | M-A10 が exit 1 に反転 | D7 |
| X7 | DEV_WORKFLOW の Rebase Map 定義文（Wave Operation 節、`Rebase Map: <旧 SHA> -> <新 SHA>` を含む文）を削除 | M-A11a（定義文 literal）が exit 1 に反転 | D4 |
| X8 | D3 の decision point 計上文を削除 | M-A5b が exit 1 に反転 | D3 |

実測は commit 済み clean tree 上で行い、注入 → red 確認 → `git checkout -- <file>` 復元 → 復元後の green 再確認を X ごとに記録する（記録先 = PR body、count / SHA は tracked doc に書かない）。

## Checker 挙動テスト（PK4/PK5 最小改訂と同一 PR で常設 fixture 化）

T-PK4a/b は `scripts/tests/doc-consistency-plan-packet.test.sh` の常設 fixture として実装する（test #11 の旧・無条件 ERROR 文言 assert を新意味論へ書換え）。T-PK5 は `scripts/tests/workflow-git-checks.test.sh` の常設 fixture として実装する（既存の Plan Commit rewrite 検出・Amendments append-only fixture と共存し、それらの assert を弱めない）。両 suite は `bash scripts/local-ci.sh full` の `run_required`（`doc-consistency-plan-packet-tests` / `workflow-git-checks-tests`）であり、green が L1 evidence の一部になる。下表は fixture の期待挙動（実行記録は PR body）。

| Test ID | 状況（synthetic、検証後撤去・非 commit） | 期待 |
|---|---|---|
| T-PK4a | docs/plans/ に synthetic 2 つ目の active packet + `Plans.md`『次の行動』節内に両 packet の link | `doc-consistency-check.sh --target plan` PASS（複数 active の無条件 ERROR が撤廃されている） |
| T-PK4b | 同上から synthetic packet の link のみ除去 | 同 command が `ERROR`（link なし packet の fail-closed 維持） |
| T-PK4c | link 相当の文字列が code fence / comment 内にのみ存在 | 同 command が `ERROR`（見かけ上の link を有効と誤認する fail-open の防止。Amendment 1） |
| T-PK5 | packet に `Rebase Map:` 行あり + Map 最新 SHA が HEAD の ancestor（正例）/ Map なしで `Plan Commit` 旧 SHA が非 ancestor（負例）/ Map ありだが patch-id 同値証明のない SHA（負例、escape hatch 防止） | `check-workflow-git.sh` が正例 PASS、負例 2 つとも fail |
| T-PK5b | 多段 rebase（2 回）の Map chain 正例 / chain の途切れ（旧 SHA 不一致）負例 | 正例 PASS、負例 fail（Amendment 1） |
| T-PK5c | gated Amendment SHA を持つ lane の conflict-free rebase: plan-first + Amendment 両方の Map あり正例 / Amendment 側 Map 欠落の負例 | 正例 PASS（実効 SHA で ancestry / descendant 検証）、負例 fail（Amendment 1） |

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
