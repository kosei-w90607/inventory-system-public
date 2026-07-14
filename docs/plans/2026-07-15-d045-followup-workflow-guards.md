# D-045 follow-up: workflow guards（goal invariant / adjudication / budget hard stop / backtrack 補正）

## Workflow State

- Phase: plan-draft
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable
- Writer: Codex（発注 relay、owner がコピペ実行）
- Plan Reviewer: independent Sonnet review context
- Final Reviewer: Double Audit = independent Codex context + independent Sonnet context
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Codex 発注 relay、Ready/merge approval

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

承認依頼フォーマット（本 packet から先行適用）: すべての owner 承認接点に「この change での介入 N 回目 / 予算 M 回」と「承認すると利用者から見て何が完了するか1文」を含める。

## Risk

Risk: R3

Reason:
workflow gate change（`docs/DEV_WORKFLOW.md` の gate 規範、Plan Packet / WER template、PK checker、STATECAP git 検査に接触）。Subagent Budget / Double Audit は workflow gate change の規則（budget 3、Contract Audit 二重実行）を適用する。

## Goal

Goal Invariant（最小完了条件、利用者可視 outcome。6項目すべて Plans.md 次の行動1 と WER Addendum が名指しする優先実装に対応）:

1. owner 承認接点に「介入カウンタ + 利用者可視の完了1文」が必須欄として存在し、owner が budget を承認インターフェース上で執行できる。
2. 不可逆作業の finding が D-045 の4項目なしに destructive repair を正当化できない裁定規則が Review Rules に存在する。
3. 正当な backtrack が STATECAP に阻まれて履歴改変へ追い込まれない補正契約が存在し、機械検査が対応する。
4. WER が「retire するルール」を明示しないと通らない削減圧力が template + checker に存在する。
5. 一回きり × 不可逆 × owner gate の作業に owner 同席 time-boxed 様式を選べる規範が AGENT_OPERATING_MANUAL に存在する。
6. Plan Packet の Goal が「最小完了条件 / 失敗定義 / 非目的」構造を持ち、Goal Invariant > AC > supporting evidence の優先順位が規範化されている。

失敗定義: 上記が docs 宣言のみ（template 必須欄・機械チェックの裏付けなし）で着地すること。または本 change 自体が新規 ledger / 儀式 / 検査面を Goal Invariant の範囲を超えて増やすこと。

非目的: workflow の全面再設計、hook 実装、merge queue / required contexts、既存 archived 文書の遡及改訂。

## Scope

- `docs/DEV_WORKFLOW.md`: Owner Effort Budget 節を hard stop + 承認依頼フォーマット + goal-drift signal 停止手順へ改訂。Review Rules に finding classification 三分類（既存「review lane」語彙との衝突を避けるため lane と呼ばない）と不可逆 finding 4項目要件を追加。Plan Packet Rules に Goal Invariant 構造（最小完了条件 / 失敗定義 / 非目的、優先順位 Goal Invariant > AC > supporting evidence）を追加。Workflow State に backtrack 補正契約（`state-backtrack` canonical subject、STATECAP forward cap 対象外、Amendments 追記型）を追加。Draft PR Checkpoint の PR body 要素に Human Gate 欄（カウンタ + 完了1文）を追加。
- `docs/templates/plan-packet.md`: Goal 節を Goal Invariant 構造へ、Owner Effort Budget 節に承認依頼フォーマット1行。
- `docs/templates/workflow-effectiveness-review.md`: `## Retired / Consolidated Rules` 節を新設（最低1件、なければ `none` + 理由）。
- `docs/AGENT_OPERATING_MANUAL.md` §3: 一回きり × 不可逆 × owner gate 作業向けの owner 同席 time-boxed 同期セッション様式を新設（vendor 軸の Execution Mode と直交する task-shape 軸として）。新規スクリプトは「防ぐ具体的経路1文」を条件とする。
- `scripts/doc-consistency-check.sh`: active packet（`docs/plans/` 直下、既存 `iter_active_dated_plans` のディレクトリ分離で遡及なし）の Goal Invariant 構造存在チェック（WARN）。新規 WER の Retired 節存在チェック（WARN）は、`docs/archive/plans/*-workflow-effectiveness-review.md` のファイル名日付 prefix を `2026-07-15` と辞書順比較する**新規機構**（ISO 日付は文字列比較で順序が保存される。前例なしを明示、既存 WER は対象外）。
- `scripts/check-workflow-git.sh`: STATECAP を forward 遷移のみ対象へ限定し、`docs(plans): state-backtrack <from>-><to>` subject を別扱いにする。判定機構: 順序付き phase 配列を本 script 内にも定義し（`doc-consistency-check.sh` の `WORKFLOW_STATE_PHASES` と同内容。意図的な script 分離を維持するため source せず複製し、両配列の一致を drift test T8 で担保）、`index(from) > index(to)` を backward と判定する。`state-backtrack` subject は**単一の backward 遷移のみ**を許容し、forward 遷移・複数遷移チェーン・未知 phase は ERROR（cap 回避と混在チェーンの曖昧さを排除。correction は最早影響 phase へ1手で戻り、以後の forward は通常規則で進む）。
- `scripts/tests/`: 上記 checker / git 検査変更の drift test。
- `docs/decision-log.md`: D-046 起票（8 sub-decision、「docs 宣言のみの規則追加は暴走系 failure class の是正手段として単独不十分」の durable 化を含む）。
- 実装時に repo 全体で `Owner Effort Budget` / 承認依頼 / WER template 参照の drift-fix sweep（`.agents/skills/` 含む）。

## Non-scope

- `.claude/hooks/` への hook 実装（sandbox 書込み制約。slice 2 で follow-up 降格した経緯を踏襲）。
- PR body の機械検査（gh / network 依存になるため。interface 強制は template + checklist + PK の範囲で行う）。
- Plans.md 次の行動 4 の slice 2 follow-up 群（Amendments strict 化、section-scoped 抽出、pipefail、no-active-plan check）。
- merge queue、required contexts、`paths-ignore` 再設計。
- 既存 archived packet / WER の遡及改訂。

## Acceptance Criteria

- `docs/templates/plan-packet.md` の Goal 節に「最小完了条件」「失敗定義」「非目的」の必須構造が存在する（`rg '最小完了条件' docs/templates/plan-packet.md` が hit）。
- `docs/DEV_WORKFLOW.md` Owner Effort Budget 節に承認依頼フォーマット（カウンタ + 完了1文）と超過見込み時の停止手順、owner 違和感 = goal-drift signal の停止手順が存在する。
- Review Rules に三分類（candidate safety / mutation authority / evidence quality）と、不可逆 finding の4項目（actual harm path / affected candidate or mutation / non-destructive revalidation / blocker reason）必須要件が存在する（`rg 'actual harm path' docs/DEV_WORKFLOW.md` が hit）。
- `scripts/check-workflow-git.sh` が `state-backtrack` subject を STATECAP cap から除外し、forward 遷移のみを含む backtrack subject を ERROR にする。drift test が両方向（正当 backtrack = PASS / cap 回避 = ERROR）で検証する。
- `docs/templates/workflow-effectiveness-review.md` に `## Retired / Consolidated Rules` 節があり、checker が新規 WER の節欠落を WARN する。
- `docs/AGENT_OPERATING_MANUAL.md` に one-shot irreversible 様式が存在し、`docs/DEV_WORKFLOW.md` から参照される。
- `docs/decision-log.md` に D-046 が存在する。
- `bash scripts/doc-consistency-check.sh` PASS（本 packet 自身が Goal Invariant 構造チェックを通る = 自己 dogfood）、`bash scripts/tests/` の新規 drift test PASS、`bash scripts/local-ci.sh full` PASS。

## Design Sources

- Requirements / spec: [goal-drift WER + Addendum](../archive/plans/2026-07-14-public-repo-phase-b-goal-drift-workflow-effectiveness-review.md)（必須設計入力）
- Architecture: `docs/DEV_WORKFLOW.md`（Workflow State / Owner Effort Budget / Review Rules / Contract Audit）
- Function / command / DTO: not applicable
- DB: not applicable
- Screen / UI: not applicable
- Decision log / ADR: D-034 / D-035 / D-038 / D-039 / D-045

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | not applicable | not applicable |
| Command / DTO / generated binding / wire shape | not applicable | not applicable |
| DB / transaction / audit / rollback / migration | not applicable | not applicable |
| Screen / UI / route state / Japanese wording | not applicable | not applicable |
| CSV / TSV / report / import / export format | not applicable | not applicable |
| Durable decision / ADR | D-046（本 PR で起票） | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| WER Addendum「執行位置の欠陥」 | goal-drift WER Addendum | D-046-1 | budget を承認インターフェース必須欄で執行（docs 宣言は D-038 で実証失敗。hook は sandbox 制約で non-scope） | DEV_WORKFLOW Owner Effort Budget / Draft PR Checkpoint / plan-packet template | T2 / T6 |
| D-045 evidence adjudication | decision-log D-045 | D-046-2 | 三分類 + 不可逆4項目を Review Rules に正本化（WER 記載のみでは次 change に届かない） | DEV_WORKFLOW Review Rules | T6 |
| Plans.md 次の行動1 backtrack 契約 | DEV_WORKFLOW Workflow State 102行 correction 規則 | D-046-3 | `state-backtrack` subject 新設（単一 backward 遷移のみ、順序付き phase 配列で index 比較）+ forward cap 限定（cap 全廃は state spam を許すため不採用、backtrack cap 追加は正当補正を再度阻むため不採用、混在チェーン許容は判定曖昧のため不採用） | check-workflow-git.sh / DEV_WORKFLOW Workflow State | T3 / T4 / T8 |
| WER Addendum「削減圧力の欠如」 | goal-drift WER Addendum | D-046-4 | WER template 必須欄 + checker WARN（強制なしの努力目標は既存 WER で機能しなかった） | WER template / doc-consistency-check.sh | T5 |
| WER Addendum「実行モード軸の欠落」 | goal-drift WER Addendum | D-046-5 | AGENT_OPERATING_MANUAL に task-shape 軸として新設（Execution Mode の vendor 軸と混ぜると既存3値 enum と PK4 を壊すため直交させる） | AGENT_OPERATING_MANUAL §3 | T6 |
| Goal Invariant | goal-drift WER「完了条件から目的が外れた」 | D-046-6 | packet Goal 節の構造化 + 優先順位明文化 + WARN check（ERROR 開始は既存 active packet を壊すため WARN 開始 = slice 2 前例踏襲） | plan-packet template / doc-consistency-check.sh | T1 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes（D-046 + DEV_WORKFLOW 改訂で自己完結）
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: D-046 として起票予定（8 sub-decision）
- Assumptions and constraints: PK checker は bash / rg のみ（network・gh 非依存）。新 WARN check は既存 archived 文書に遡及しない（日付 prefix で判定）。
- Deferred design gaps, risk, and follow-up target: hook 実装は sandbox 制約解消後の別 change。PR body 機械検査は非採用（理由は Non-scope 記載）。
- Test Design Matrix can cite design decision IDs or source doc sections: yes（D-046-1〜6 を参照）

## Impact Review Lenses

not applicable — field investigation / real-device / POS / format 変更を含まない workflow docs + checker 変更のため。

## Design Readiness

- Existing design docs are sufficient because: 変更対象の規範（Owner Effort Budget / Review Rules / Workflow State / STATECAP / WER template）はすべて現行 DEV_WORKFLOW.md / templates / scripts に存在し、設計入力（WER Addendum / D-045）も正本化済み。
- Source docs updated in this PR: `docs/DEV_WORKFLOW.md`、`docs/AGENT_OPERATING_MANUAL.md`、templates 2件、`docs/decision-log.md`（D-046）。
- Design gaps intentionally deferred: hook 化、PR body 機械検査。
- Durable decisions discovered in this plan and promoted to source docs: D-046。

Minimum design checks for business-app work: not applicable（workflow docs / checker のみ、製品コード非接触）。

## Contract Probe

N/A — 外部 library / OS 挙動の未検証前提なし。bash / rg の挙動は既存 checker で実証済みの範囲のみ使用。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-046-1 承認依頼カウンタ interface | DEV_WORKFLOW Owner Effort Budget / Draft PR Checkpoint / plan-packet template | T2（template token）+ T6（規範 token） | 本 PR の Human Gate 欄で手動 dogfood |
| D-046-2 三分類 + 不可逆4項目 | DEV_WORKFLOW Review Rules | T6 | non-scope（裁定運用は次 R3 dogfood） |
| D-046-3 backtrack 補正契約 | check-workflow-git.sh + DEV_WORKFLOW Workflow State | T3 / T4（drift test 両方向）+ T8（phase 配列の両 script 一致） | non-scope |
| D-046-4 WER retire 欄 | WER template + doc-consistency-check.sh | T5 | non-scope |
| D-046-5 one-shot irreversible 様式 | AGENT_OPERATING_MANUAL §3 + DEV_WORKFLOW 参照 | T6（token 存在） | non-scope（次回不可逆作業で dogfood） |
| D-046-6 Goal Invariant | plan-packet template + doc-consistency-check.sh | T1（WARN 両方向） | 本 packet 自身が構造を先行適用 |
| D-046-7 durable 化判断（docs 宣言単独不十分） | decision-log D-046 | T6（D-046 存在） | non-scope |
| D-046-8 goal-drift signal 停止手順 | DEV_WORKFLOW Owner Effort Budget | T6 | non-scope（発動時に実地検証） |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-15-d045-followup-workflow-guards.md](test-matrices/2026-07-15-d045-followup-workflow-guards.md)

- targeted tests: `scripts/tests/` 新規 drift test（checker WARN 両方向、STATECAP backtrack 両方向）、`bash scripts/doc-consistency-check.sh`（自己 dogfood）
- negative tests: Goal Invariant 欠落 packet で WARN、forward-only backtrack subject で ERROR、Retired 節欠落の新規 WER で WARN
- compatibility checks: 既存 archived packet / WER が新 WARN の対象外であること、既存 STATECAP forward cap 挙動が不変であること
- data safety checks: 変更は docs / scripts のみ、実データ非接触
- main wiring/integration checks: `bash scripts/local-ci.sh full` が新 drift test を拾って PASS、pre-push が check-workflow-git.sh 改訂版を呼ぶこと

## Boundary / Wire Contract

not applicable — wire / schema 非接触。canonical commit subject（`state-backtrack`）は check-workflow-git.sh と DEV_WORKFLOW.md の間の repo 内契約として Test Matrix で検証。

## Review Focus

- 新規則が Goal Invariant の範囲を超えて検査面を増やしていないか（本 change 自体の肥大チェック）。
- STATECAP forward 限定 + backtrack 除外が cap 回避経路を開いていないか。
- 新 WARN check が既存文書・既存 workflow に偽陽性を出さないか。
- D-046 が D-038 / D-039 / D-045 と矛盾しないか。

## Spec Contract

Contract ID: SPEC-WF-D046

- 承認接点は「介入 N/予算 M + 利用者可視の完了1文」を持つ（D-046-1）。
- 不可逆 finding は4項目なしに destructive repair を正当化できない（D-046-2）。
- 正当な backtrack は append-only 記録で行え、STATECAP に阻まれない。cap 回避は ERROR（D-046-3）。
- WER は retire 対象を明示する（D-046-4）。
- Goal Invariant > AC > supporting evidence の優先順位（D-046-6）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-D046 / D-046-1 | DEV_WORKFLOW + template 改訂 | T2 / T6 | カウンタ欄の実装位置 | PR body Human Gate 欄（手動 dogfood） |
| SPEC-WF-D046 / D-046-2 | Review Rules 追記 | T6 | D-045 との整合 | doc-consistency PASS |
| SPEC-WF-D046 / D-046-3 | check-workflow-git.sh 改訂 | T3 / T4 | cap 回避防止 | drift test PASS |
| SPEC-WF-D046 / D-046-4 | WER template + checker | T5 | 遡及なし | drift test PASS |
| SPEC-WF-D046 / D-046-6 | plan-packet template + checker | T1 | WARN 開始の妥当性 | 本 packet で自己適用 |

## Data Safety

- 実 POS / 店舗 artifact、DB、secret 非接触。
- 変更は `docs/` と `scripts/` のみ。
- private repository identity / evidence を新規文書に持ち込まない。

## Implementation Results

Fill after implementation.

## Review Response

- Plan review R1（independent Sonnet context、2026-07-15）: P1=3 / P2=2、revise。全件 accept — P1-1 Goal Invariant を6項目へ拡張（D-046-5/6 は次の行動1名指しの優先実装であり Goal の書き漏れと裁定）/ P1-2 backtrack 判定機構を明記（phase 配列複製 + T8 parity drift test）/ P1-3 WER 日付判定の偽前例を撤回し新規機構（ファイル名日付 prefix 辞書順比較）と明示 / P2-1 `state-backtrack` を単一 backward 遷移限定としチェーン ERROR / P2-2 「blocker lane」を「finding classification」へ改名。
- Plan review R2: fill after re-review.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
