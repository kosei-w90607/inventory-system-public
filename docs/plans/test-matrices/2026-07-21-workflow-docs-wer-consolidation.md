# Test Design Matrix — workflow docs WER consolidation

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-WERC-D1〜D13（packet Contract Coverage Ledger 参照。採用規範文 = anchor phrase 契約、defer/非変更 = 不変 guard 契約）

## 実装制約（M-DIFF 前提）

全追記は**新規行**として行う。既存行への同一行内追記（行の書換）は M-DIFF が削除行として検出し reject する。段落へ文を足す場合は空行を挟まず直後の行に書く（Markdown は空行なしの連続行を同一段落として rendering するため、視覚上は段落内追記・diff 上は純追加になる）。例外は `docs/DEV_SETUP_CHECKLIST.md:248,:251` の 2 行置換（M-D6 が個別 guard）と、`docs/templates/subagent-review-packet.md` / `.agents/skills/inventory-code-review/SKILL.md` の D4-A 文言追随（既存行の改訂を許可、M-DIFF の対象外パス）。

## Anchor Phrase Contract（Plan Gate round 2 修正時点で固定）

各採用規範文は下表の **anchor phrase を字句どおり含む文**で実装する。全 anchor は対象ファイルにおいて **baseline 0 件を実証済み**（plan-gate 修正 commit 時点。実行記録は PR body へ転記し、本 doc には count を書かない）。したがって各 assertion は「未実装なら必ず red → 実装後に green」の弁別性を持つ。意味等価性（WER 原文 ↔ 規範文）は rg では検証できず、Double Audit の人的突合で閉じる。

| Decision ID | Anchor phrase（字句一致） | 対象 |
|---|---|---|
| D1 | `親文書の目次・索引を更新` | `docs/templates/plan-packet.md` Registration 表の row 内（義務そのものを表す phrase。ファイル名参照だけでは pass しない） |
| D2-1 / D2-2 / D2-3 | `attach a concrete fix proposal` / `mutual adjudication` / `objection channel` | `docs/DEV_WORKFLOW.md` Review Rules |
| D3 | `escape hatch` | `docs/DEV_WORKFLOW.md` Design checklist + `docs/templates/plan-packet.md` Design Intent Audit |
| D4 / D4-A | `inject a real mutation` | Contract Audit + 隣接 2 doc（各ファイル個別 assert） |
| D7 | `volatile counts` | Evidence Ownership 段落 |
| D8 | `repo-wide grep for the old wording` | Draft PR Checkpoint |
| D9 | `cargo check --release`（同一行に `L3` または `Human Gate`） | Implementation Rules + plan-packet Test Plan（各ファイル個別 assert） |
| D10 | `cited test` | `docs/templates/test-design-matrix.md` + Design checklist |
| D11 | `adjacent-contract sweep` | Contract Audit + plan-packet Ledger 節 |

## Assertion Commands（literal、repo root で実行）

各行 1 コマンド。`期待: 0` = exit 0（hit あり / 差分なし）、`期待: 1` = exit 1（hit なし）。

```bash
# M-D1 期待: 0（Registration 表の table row 内に義務 phrase）
sed -n '/^## Registration \/ Generation Obligations/,/^## /p' docs/templates/plan-packet.md | rg '^\|.*親文書の目次・索引を更新'
# M-D2a 期待: 0
sed -n '/^## Review Rules/,/^## /p' docs/DEV_WORKFLOW.md | rg -F 'attach a concrete fix proposal'
# M-D2b 期待: 0
sed -n '/^## Review Rules/,/^## /p' docs/DEV_WORKFLOW.md | rg -F 'mutual adjudication'
# M-D2c 期待: 0
sed -n '/^## Review Rules/,/^## /p' docs/DEV_WORKFLOW.md | rg -F 'objection channel'
# M-D3a 期待: 0
sed -n '/Design checklist/,/^## /p' docs/DEV_WORKFLOW.md | rg -F 'escape hatch'
# M-D3b 期待: 0
sed -n '/^## Design Intent Audit/,/^## /p' docs/templates/plan-packet.md | rg -F 'escape hatch'
# M-D4 期待: 0
sed -n '/^## Contract Audit/,/^## /p' docs/DEV_WORKFLOW.md | rg -F 'inject a real mutation'
# M-D4Aa 期待: 0
rg -F 'inject a real mutation' docs/templates/subagent-review-packet.md
# M-D4Ab 期待: 0
rg -F 'inject a real mutation' .agents/skills/inventory-code-review/SKILL.md
# M-D5N 期待: 0（Workflow State 節の byte 一致 = 完全不変）
diff -u <(git show main:docs/DEV_WORKFLOW.md | sed -n '/^## Workflow State/,/^## /p') <(sed -n '/^## Workflow State/,/^## /p' docs/DEV_WORKFLOW.md)
# M-D6a 期待出力: "2	2	docs/DEV_SETUP_CHECKLIST.md"
git diff --numstat main -- docs/DEV_SETUP_CHECKLIST.md
# M-D6b 期待出力: 2
rg -c -F 'C:\Users\Owner\projects\inventory-system-public' docs/DEV_SETUP_CHECKLIST.md
# M-D6c 期待: 1
rg -P 'projects\\inventory-system(?!-public)' docs/DEV_SETUP_CHECKLIST.md
# M-D6d 期待: 1（:92 / :261 の不改変）
git diff main -- docs/DEV_SETUP_CHECKLIST.md | rg -e 'inventory-system\.git' -e '旧 private'
# M-D7a 期待: 0
sed -n '/Evidence Ownership/,/^$/p' docs/DEV_WORKFLOW.md | rg -F 'volatile counts'
# M-D7b 期待: 1（cutoff 行の不改変）
git diff main --unified=0 -- docs/DEV_WORKFLOW.md | rg '^-.*2026-07-12'
# M-D8 期待: 0
sed -n '/^## Draft PR Checkpoint/,/^## /p' docs/DEV_WORKFLOW.md | rg -F 'repo-wide grep for the old wording'
# M-D9a 期待: 0（DEV_WORKFLOW 側、条件語同居）
rg -F 'cargo check --release' docs/DEV_WORKFLOW.md | rg -e 'L3' -e 'Human Gate'
# M-D9b 期待: 0（template 側、条件語同居）
rg -F 'cargo check --release' docs/templates/plan-packet.md | rg -e 'L3' -e 'Human Gate'
# M-D9A 期待: 0（ci.md 完全不変）
git diff --quiet main -- docs/ci.md
# M-D10a 期待: 0
rg -F 'cited test' docs/templates/test-design-matrix.md
# M-D10b 期待: 0
sed -n '/Design checklist/,/^## /p' docs/DEV_WORKFLOW.md | rg -F 'cited test'
# M-D11a 期待: 0
sed -n '/^## Contract Audit/,/^## /p' docs/DEV_WORKFLOW.md | rg -F 'adjacent-contract sweep'
# M-D11b 期待: 0
sed -n '/^## Contract Coverage Ledger/,/^## /p' docs/templates/plan-packet.md | rg -F 'adjacent-contract sweep'
# M-D12 共通: 抽出範囲は D-050 節のみ（次の decision 見出しの直前で閉じる。round 3 F2 — D-051 追加時の誤集計を遮断、mock 実証済み）
# M-D12a 期待: 0（区分 marker の完全一致 3 種）
awk '/^## D-050$/{d050=1; next} d050 && /^## D-[0-9]+$/{exit} d050' docs/decision-log.md | rg -F '**採用** ='
# M-D12b 期待: 0
awk '/^## D-050$/{d050=1; next} d050 && /^## D-[0-9]+$/{exit} d050' docs/decision-log.md | rg -F '**部分採用** ='
# M-D12c 期待: 0
awk '/^## D-050$/{d050=1; next} d050 && /^## D-[0-9]+$/{exit} d050' docs/decision-log.md | rg -F '**不採用 defer** ='
# M-D12d 期待出力: 4（defer (i)〜(iv) の各「発動条件事実:」構造形。コロン付きで Why/Revisit 行のメタ言及を除外。4 = defer 件数の構造定数）
awk '/^## D-050$/{d050=1; next} d050 && /^## D-[0-9]+$/{exit} d050' docs/decision-log.md | rg -o -F '発動条件事実:' | rg -c .
# M-D12e 期待出力: 4（同・「却下理由:」）
awk '/^## D-050$/{d050=1; next} d050 && /^## D-[0-9]+$/{exit} d050' docs/decision-log.md | rg -o -F '却下理由:' | rg -c .
# M-D12f 期待出力: 4（同・「revisit:」小文字コロン付き）
awk '/^## D-050$/{d050=1; next} d050 && /^## D-[0-9]+$/{exit} d050' docs/decision-log.md | rg -o -F 'revisit:' | rg -c .
# M-D13a 期待: 1（stale 不在。範囲 = roadmap item 1 のみ、完了履歴節は範囲外）
sed -n '/^1\. 中期 roadmap/,/^2\./p' docs/Plans.md | rg -F 'checklist の template 昇格'
# M-D13b 期待: 1
sed -n '/^1\. 中期 roadmap/,/^2\./p' docs/Plans.md | rg -F 'Contract Probe 手順明文化'
# M-D13c 期待: 1
sed -n '/^1\. 中期 roadmap/,/^2\./p' docs/Plans.md | rg -F 'materialize 局所 workflow-git 検査'
# M-D13d 期待: 1
sed -n '/^1\. 中期 roadmap/,/^2\./p' docs/Plans.md | rg -F 'read-safe-file.sh'
# M-DIFF 期待: 1（純追記 guard。対象 = DEV_WORKFLOW + plan-packet + test-design-matrix template。subagent-review-packet.md は D4-A 改訂許可のため対象外）
git diff main --unified=0 -- docs/DEV_WORKFLOW.md docs/templates/plan-packet.md docs/templates/test-design-matrix.md | rg '^-([^-]|$)'
# M-HANDOFF 期待: 0（§2「直近の作業状態」節内・同一 bullet 行に 3 要素 + 完全遷移列を一括 assert。節外配置・要素分散・遷移列欠落は exit 1 — round 4 F1、baseline exit 1 / 正配置 exit 0 / 誤配置 exit 1 を実測済み）
sed -n '/^### 直近の作業状態/,/^### /p' docs/PROJECT_HANDOFF.md | rg -F 'impl/workflow-docs-wer-consolidation' | rg -F 'docs/plans/2026-07-21-workflow-docs-wer-consolidation.md' | rg 'Double Audit.*Ready.*merge'
```

## Test Matrix（overview — 正本は上の Assertion Commands）

| Contract | Assertions | Would fail if... |
|---|---|---|
| D1 | M-D1 | 目次更新義務が表 row 外 / ファイル名参照のみで義務 phrase 欠落 |
| D2 | M-D2a〜c | 3 要素のいずれか脱落（個別 assert のため他要素で代償不可）or 節外 |
| D3 | M-D3a〜b | 自己突合行が対象 checklist / 節外 or 未追加 |
| D4, D4-A | M-D4, M-D4Aa〜b | Contract Audit 未強化 / 隣接 2 doc のどちらかが旧文言のまま |
| D5N | M-D5N | Workflow State 節への一切の変更（byte 一致要求。語彙非依存） |
| D6 | M-D6a〜d | 2 行以外の変更 / `:92`/`:261` 誤置換 / パス残存 |
| D7 | M-D7a〜b | 拡張が段落外 / cutoff 行の書換 |
| D8 | M-D8 | evidence 要求が checkpoint 外 or 未追加 |
| D9, D9-A | M-D9a〜b, M-D9A | 条件脱落 / 片側ファイル未実装 / ci.md への先走り変更 |
| D10 | M-D10a〜b | 実在確認要求が未追加 or 対象外配置 |
| D11 | M-D11a〜b | sweep 要求が対象節外 or 片側未追加 |
| D12 | M-D12a〜f | 区分 marker 不正 / defer 4 件の事実・却下理由・revisit の欠落 |
| D13 | M-D13a〜d | 消化済み項目が roadmap 1-1 に残存 |
| 全体 | M-DIFF, M-HANDOFF | 純追記制約違反 / Handoff の実質同期（§2 節内・同一 bullet に branch / packet path / 完全遷移列）未実施・誤配置・要素分散 |

## State Lifecycle Matrix

本 PR は workflow-state の規範文を**変更しない**（D5 defer、M-D5N が byte-level guard）。workflow-state changes の明示行:

| State / subject | 検証内容 | Evidence |
|---|---|---|
| content candidate -> L1 / independent review -> state-only human-confirm commit | 本 packet 自体がこの遷移列を実走（dogfood） | packet State Narrative + PR body |
| owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge | docs-only のため dispatch 明示 1 run + 三点 SHA 一致 | PR body |
| state-only violation 検査 | state-only commit の file allowlist + `git diff --unified=0` hunk 検査 | review evidence |
| hosted-not-required incidental failure | 非該当（Hosted CI Requirement: required） | — |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| anti-tautology 文言（D4 の隣接） | `docs/DEV_WORKFLOW.md` Contract Audit / `docs/templates/subagent-review-packet.md:137` / `.agents/skills/inventory-code-review/SKILL.md:58`（Plan Gate F4 で全数列挙） | 3 箇所全て実 mutation 要求へ追随 | なし | M-D4 + M-D4Aa〜b |
| 規範文追記スタイル | Public PR #7（UI-13 WER 正本化）の既存節追記 + 出典 lesson 併記 | 本 PR の全追記 | — | review evidence |

## Negative Paths

- missing input: WER 原文にない創作追記 → M-DIFF + Double Audit（意味等価突合）
- invalid input: 行番号ズレ → 全 assertion は節名 sed range で位置独立
- duplicate/ambiguous input: anchor phrase の二重追記（正本二重化）→ Double Audit で検分
- unknown reference: 規範文中の参照先不在 → doc-consistency-check full
- dependency missing / permission failure / dry-run: 非該当

## Boundary Checks

非該当（唯一の境界 = M-D6c の negative lookahead が `:92` の `inventory-system.git` 形式を誤検出しないこと — パス形 `projects\` 限定で回避、M-D6d が別途 guard）

## Compatibility Checks

- old schema/input: 既存規範の不変 = M-D5N（byte 一致）+ M-D9A（ci.md 不変）+ M-DIFF（純追記）+ M-D7b（cutoff 行）+ M-D6d（履歴行）
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

各 anchor を実装後に一時改変した場合、対応 assertion が red になるか:

- D2 の 3 anchor のうち 1 つを削る → M-D2a/b/c の該当 1 本が exit 1（個別 assert のため代償不可）
- D4 の anchor を Contract Audit 節外へ移す → sed range 限定により M-D4 が exit 1
- Workflow State 節に任意の 1 byte 変更（exact-HEAD SHA 追記や語彙を含まない編集でも）→ M-D5N の diff が非空で exit 1（round 2 F2 の反例「別節に STATECAP 語を追記」でも誤検出しない — 対象は節抽出 diff のため）
- `:252` を誤置換 → M-D6a の numstat が `2 2` を超過
- D-050 の defer (ii) から発動条件事実を消す → M-D12d の count が 3 になり fail
- D13: stale 1 件を残す → 該当 M-D13 が exit 0 になり fail
- 既存行を 1 行書換 → M-DIFF が deletion 行を検出（`^-([^-]|$)` は `-old line` を検出し `---` header を除外することを実証済み）
- 隣接 doc の片側だけ追随 → M-D4Aa または M-D4Ab が exit 1（per-file assert）

## Residual Test Gaps

- 意味等価性（WER 原文 ↔ 規範文）と「二重追記による正本二重化」は機械検証不能 — Double Audit 2 pass で人的に閉じる（R3 + Double Audit を要求した理由）。
- M-D12d〜f の期待値 4 は defer 件数の構造定数（D7 の「固定契約定数は対象外」に該当）— D-050 の defer 件数が変わる改訂時は本 Matrix も同時改訂する。抽出範囲は awk で次 decision 見出しの直前に閉じてあり、D-051 以降の追加では silent break しない（mock 実証済み）。
- 規範文の将来遵守率は本 PR では検証不能 — 次 PR の WER で観測する。
