# Test Design Matrix — workflow docs WER consolidation

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-WERC-D1〜D13（packet Contract Coverage Ledger 参照。採用規範文 = anchor phrase 契約、defer/非変更 = 不変 guard 契約）

## Anchor Phrase Contract（Plan Gate 修正時点で固定）

各採用規範文は下表の **anchor phrase を字句どおり含む文**で実装する。全 anchor は plan-gate 修正 commit 時点で対象ファイル全てにおいて **baseline 0 件（rg -F miss）を実証済み**（実行記録は PR body に転記。Evidence Ownership に従い本 doc には count を書かない）。したがって各 rg assertion は「未実装なら必ず exit 1（red）→ 実装後に exit 0（green）」の弁別性を持つ。意味等価性（WER 原文 ↔ 規範文）は rg では検証できず、Double Audit の人的突合で閉じる。

| Decision ID | Anchor phrase（rg -F、字句一致） | 対象ファイル |
|---|---|---|
| D1 | `FUNCTION_DESIGN.md` | `docs/templates/plan-packet.md`（Registration 表内） |
| D2-1 | `attach a concrete fix proposal` | `docs/DEV_WORKFLOW.md`（Review Rules） |
| D2-2 | `mutual adjudication` | 同上 |
| D2-3 | `objection channel` | 同上 |
| D3 | `escape hatch` | `docs/DEV_WORKFLOW.md`（Design checklist）+ `docs/templates/plan-packet.md`（Design Intent Audit） |
| D4 | `inject a real mutation` | `docs/DEV_WORKFLOW.md`（Contract Audit） |
| D4-A | `inject a real mutation` | `docs/templates/subagent-review-packet.md` + `.agents/skills/inventory-code-review/SKILL.md` |
| D7 | `volatile counts` | `docs/DEV_WORKFLOW.md`（Evidence Ownership 段落） |
| D8 | `repo-wide grep for the old wording` | `docs/DEV_WORKFLOW.md`（Draft PR Checkpoint） |
| D9 | `cargo check --release` | `docs/DEV_WORKFLOW.md`（Implementation Rules）+ `docs/templates/plan-packet.md`（Test Plan） |
| D10 | `cited test` | `docs/templates/test-design-matrix.md` + `docs/DEV_WORKFLOW.md`（Design checklist） |
| D11 | `adjacent-contract sweep` | `docs/DEV_WORKFLOW.md`（Contract Audit）+ `docs/templates/plan-packet.md`（Ledger 節） |

## Failure Modes

- 意味改変（希釈・増幅・条件脱落）/ 節ズレ / 既存文破壊（splice）/ 不変対象への変更（Workflow State・ci.md・DEV_SETUP_CHECKLIST 対象外行）/ 列挙残存 / 裁定不整合

## Test Matrix

全 assertion は repo root で実行。期待値は exit code / 出力で機械判定可能。

| Contract | Test Name | Exact command | 期待（実装後） | Would fail if... |
|---|---|---|---|---|
| D1 | M-D1 | `sed -n '/^## Registration \/ Generation Obligations/,/^## /p' docs/templates/plan-packet.md \| rg -F "FUNCTION_DESIGN.md"` | exit 0 | doc 目次行が Registration 表外 or 未追加 |
| D2 | M-D2 | 3 コマンド: `sed -n '/^## Review Rules/,/^## /p' docs/DEV_WORKFLOW.md \| rg -F "<anchor>"` を D2-1/D2-2/D2-3 で個別実行 | 各 exit 0 | 3 要素（修正案添付/相互採否裁定/異議窓口）のいずれか脱落 or Review Rules 節外 |
| D3 | M-D3 | `sed -n '/Design checklist/,/^## /p' docs/DEV_WORKFLOW.md \| rg -F "escape hatch"` + `sed -n '/^## Design Intent Audit/,/^## /p' docs/templates/plan-packet.md \| rg -F "escape hatch"` | 各 exit 0 | 自己突合行が対象 checklist 外 or 未追加 |
| D4 | M-D4 | `sed -n '/^## Contract Audit/,/^## /p' docs/DEV_WORKFLOW.md \| rg -F "inject a real mutation"` | exit 0 | 実 mutation 要求が Contract Audit 外 or 未追加 |
| D4-A | M-D4A | `rg -F "inject a real mutation" docs/templates/subagent-review-packet.md .agents/skills/inventory-code-review/SKILL.md` | 両ファイルで hit（exit 0、2 path 出力） | 隣接 2 doc のどちらかが旧文言のまま |
| D5N | M-D5N | `git diff main --unified=0 -- docs/DEV_WORKFLOW.md \| rg "STATECAP\|state-backtrack\|state-only"` | exit 1（hit なし） | Workflow State の cap / backtrack / state-only 規則に変更が混入 |
| D6 | M-D6 | (1) `git diff --numstat main -- docs/DEV_SETUP_CHECKLIST.md` = `2	2` (2) `rg -c -F 'C:\Users\Owner\projects\inventory-system-public' docs/DEV_SETUP_CHECKLIST.md` = 2 (3) `rg -P 'projects\\inventory-system(?!-public)' docs/DEV_SETUP_CHECKLIST.md` = exit 1 (4) `git diff main -- docs/DEV_SETUP_CHECKLIST.md \| rg "inventory-system\.git\|旧 private"` = exit 1 | 各期待どおり | 2 行以外の変更 / `:92`/`:261` の誤置換 / パス残存 |
| D7 | M-D7 | `sed -n '/Evidence Ownership/,/^$/p' docs/DEV_WORKFLOW.md \| rg -F "volatile counts"` + 不変 guard `git diff main --unified=0 -- docs/DEV_WORKFLOW.md \| rg "^-.*2026-07-12"` | 前者 exit 0 / 後者 exit 1 | 拡張が段落外 / cutoff 行が書き換わった |
| D8 | M-D8 | `sed -n '/^## Draft PR Checkpoint/,/^## /p' docs/DEV_WORKFLOW.md \| rg -F "repo-wide grep for the old wording"` | exit 0 | evidence 要求が checkpoint 外 or 未追加 |
| D9 | M-D9 | `rg -F "cargo check --release" docs/DEV_WORKFLOW.md docs/templates/plan-packet.md` の各 hit 行が `rg "L3\|Human Gate"` にも match | 両ファイル hit + 条件語同居 | 無条件要求に増幅 or 条件脱落 or 未追加 |
| D9-A | M-D9A | `git diff --quiet main -- docs/ci.md` | exit 0（無変更） | CI gate 化の先走り混入 |
| D10 | M-D10 | `rg -F "cited test" docs/templates/test-design-matrix.md` + `sed -n '/Design checklist/,/^## /p' docs/DEV_WORKFLOW.md \| rg -F "cited test"` | 各 exit 0 | 実在確認要求が未追加 or 対象外配置 |
| D11 | M-D11 | `sed -n '/^## Contract Audit/,/^## /p' docs/DEV_WORKFLOW.md \| rg -F "adjacent-contract sweep"` + `sed -n '/^## Contract Coverage Ledger/,/^## /p' docs/templates/plan-packet.md \| rg -F "adjacent-contract sweep"` | 各 exit 0 | sweep 要求が対象節外 or 未追加 |
| D12 | M-D12 | `sed -n '/^## D-050/,/^## /p' docs/decision-log.md` に対し rg -F で `採用` / `部分採用` / `不採用 defer` / `(iv)` を個別 assert | 各 exit 0 | 3 区分欠落 / defer 4 件目（D5）の消失 |
| D13 | M-D13 | `sed -n '/^1\. 中期 roadmap/,/^2\./p' docs/Plans.md \| rg -F "<stale>"` を 4 語（`checklist の template 昇格` / `Contract Probe 手順明文化` / `materialize 局所 workflow-git 検査` / `read-safe-file.sh`）で個別実行 | 各 exit 1（不在） | 消化済み項目が roadmap 1-1 に残存（完了履歴節は範囲外のため誤検出しない） |
| M-DIFF | M-DIFF | `git diff main --unified=0 -- docs/DEV_WORKFLOW.md docs/templates/ \| rg "^-([^-]\|$)"` | exit 1（削除行なし） | 追記のみ制約に反する削除・書換 hunk |
| M-HANDOFF | M-HANDOFF | `git diff --name-only main \| rg -F "docs/PROJECT_HANDOFF.md"` | exit 0 | Handoff 同期義務（AGENTS.md）の未実施 |

## State Lifecycle Matrix

本 PR は workflow-state の規範文を**変更しない**（D5 defer により Workflow State 節は不改変 = M-D5N が guard）。workflow-state changes の明示行:

| State / subject | 検証内容 | Evidence |
|---|---|---|
| content candidate -> L1 / independent review -> state-only human-confirm commit | 本 packet 自体がこの遷移列を実走（dogfood） | packet State Narrative + PR body |
| owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge | docs-only のため dispatch 明示 1 run + 三点 SHA 一致 | PR body |
| state-only violation 検査 | state-only commit の file allowlist + `git diff --unified=0` hunk 検査 | review evidence |
| hosted-not-required incidental failure | 非該当（Hosted CI Requirement: required） | — |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| anti-tautology 文言（D4 の隣接） | `docs/DEV_WORKFLOW.md` Contract Audit / `docs/templates/subagent-review-packet.md:137` / `.agents/skills/inventory-code-review/SKILL.md:58`（Plan Gate F4 で全数列挙） | 3 箇所全て実 mutation 要求へ追随 | なし | M-D4 + M-D4A |
| 規範文追記スタイル | Public PR #7（UI-13 WER 正本化）の既存節追記 + 出典 lesson 併記 | 本 PR の全追記 | — | review evidence |

## Negative Paths

- missing input: WER 原文にない創作追記 → M-DIFF + Double Audit（意味等価突合）
- invalid input: 行番号ズレ → 全 assertion は節名 sed range で位置独立
- duplicate/ambiguous input: anchor phrase の二重追記 → 各 rg の hit 数異常は Double Audit で検分（正本二重化の検査）
- unknown reference: 規範文中の参照先不在 → doc-consistency-check full
- dependency missing / permission failure / dry-run: 非該当

## Boundary Checks

非該当（唯一の境界 = M-D6(3) の negative lookahead が `:92` の `inventory-system.git` 形式を誤検出しないこと — パス形 `projects\` 限定で回避、M-D6(4) が別途 guard）

## Compatibility Checks

- old schema/input: 既存規範の不変 = M-D5N（Workflow State）+ M-D9A（ci.md）+ M-DIFF（削除行ゼロ）+ M-D7 不変 guard（cutoff 行）
- new schema/input: 追記規範が既存節内で矛盾なく読めること = Double Audit 通し読み
- output order / optional field: 非該当

## Data Safety Checks

- generated outputs: `.local/ci-evidence/` を commit しない
- local-only files: `.local/`
- source-derived / secrets / synthetic: 非該当

## Main Wiring / Integration Checks

- doc-consistency-check --target plan が本 packet を active plan として検査すること
- `bash scripts/local-ci.sh full` green（completed HEAD、evidence SHA は PR body）
- hosted: workflow_dispatch 明示 1 run + 三点 SHA 一致

## Mutation-style Adequacy Questions

各 anchor phrase を実装後に一時削除（または節外へ移動）した場合、対応する M-* assertion が red になるか:

- D2 の 3 anchor のうち 1 つを削る → M-D2 の該当コマンドが exit 1 になる（3 要素個別 assert のため他 2 つでは代償されない）
- D4 の anchor を Contract Audit 節外へ移す → sed range 限定により M-D4 が exit 1
- D5N: Workflow State の既存行を 1 語でも変更 → diff に STATECAP/state-only 語が出て M-D5N が hit（fail）
- D6: `:252` を誤置換 → numstat が `2 2` を超えて M-D6(1) fail
- D7 の exclusion（固定契約定数の対象外化）を落とす → 意味等価性は Double Audit 担保（rg では検出不能と明示 — 本 Matrix は検出可能範囲を「存在・位置・不変」に限定する）
- D12 から defer (iv) を消す → M-D12 の `(iv)` assert が exit 1
- D13: stale 1 件を残す → 該当 rg が exit 0 になり fail
- tracked Workflow State に exact-HEAD SHA を書く → M-D5N が hit（fail）+ Evidence Ownership 違反として review reject

## Residual Test Gaps

- 意味等価性（WER 原文 ↔ 規範文）と「二重追記による正本二重化」は機械検証不能 — Double Audit 2 pass で人的に閉じる（R3 + Double Audit を要求した理由）。
- 規範文の将来遵守率は本 PR では検証不能 — 次 PR の WER で観測する。
