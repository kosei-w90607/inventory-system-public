# Plan Packet: wave 運用（pipeline + wave 編成）の DEV_WORKFLOW amendment（D-055 候補）

## Workflow State

- Phase: plan-draft
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable
- Writer: Fable（design board 例外の適用: workflow design-only change、owner 明示指示 = 2026-07-27 wave 運用決定・引き継ぎ書。実装 code の Writer には割り当てない）
- Plan Reviewer: pending（Codex or Sonnet fresh context、Writer と独立）
- Final Reviewer: pending（Codex 独立 fresh context、Double Audit 2 pass 目担当）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending（D-055 plan 承認 + wave 1 lane 選定 / Ready 化 / merge）

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
workflow gate change（Workflow State の packet selection rule、Owner Effort Budget の介入計上、merge gate 前後の運用、Subagent Budget を改訂する）。docs-only だが Risk Tiers の「merge gate changes」に該当し、Double Audit と hosted final（explicit dispatch 経由）が必要。

## Goal

Goal Invariant:

### 最小完了条件

- 監査是正の残 13 単位（順10〜22）を、owner 介入 1 回あたり複数単位分進められる wave 運用の契約が DEV_WORKFLOW に正本化され、wave 1（2 lane pilot）を fail-closed 停止なしに開始できる状態になる。

### 失敗定義

- wave 運用を導入した結果、per-unit の検査の深さ（plan-first、mutation 独立再実測、oracle 独立性、Contract Audit、L3 準備義務）のいずれかが削られる、または複数 active packet の fail-closed 保護が registry 外でも無効化される。

### 非目的

- 検査 gate の削減・簡略化（順9 WER の教訓: mutation 全 red でも P1 は独立 diff review だけが捕捉した。深さは per-lane で全て維持する）
- 複数是正単位の 1 packet への統合（lane = 1 単位 = 1 packet は不変）
- wave 1 の lane 選定そのもの（本 packet 承認後に owner が編成案から選定する）
- 監査残単位の実装着手

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/DEV_WORKFLOW.md`: 下記 D-055 契約（D1〜D7）の正本化。対象節 = `Workflow State`（packet selection rule）、`Subagent Budget`、`Owner Effort Budget`、`Draft PR Checkpoint`、`Post-Merge Closeout`、新設の `Wave Operation` 節（他節から link）
- `docs/decision-log.md`: D-055 の新設（決定・理由・棄却代替案・revisit 条件）
- `Plans.md`: `Wave Registry` 節の新設（現 wave の lane 一覧の置き場所。中身の lane 登録は wave 1 編成時）
- `docs/PROJECT_HANDOFF.md`: workflow 変更の同期 1 行
- `docs/AGENT_OPERATING_MANUAL.md`: §4 router 表への wave 運用 1 行（必要最小限）

## Non-scope

- 監査残単位（順10〜22）の packet 起票・実装（wave 1 編成は本 PR merge 後の別作業）
- `scripts/doc-consistency-check.sh` / `check-workflow-git.sh` への wave 対応機械 check の追加（pilot で摩擦を実測してから機械化を判断。D-039 の「checker」語彙は不変）
- Workflow State の phase enum・遷移表・STATECAP・state-backtrack 契約の変更（per-lane で全て不変）
- CI routing（`ci.md`）の変更（hosted 1 change 1 final run は per-lane で不変）

## Acceptance Criteria

- `rg -n "Wave Registry" Plans.md docs/DEV_WORKFLOW.md` が両 file で hit する（registry の定義と置き場所が接続されている）
- `rg -n "D-055" docs/decision-log.md docs/DEV_WORKFLOW.md` が hit し、Matrix の anchor phrase A1〜A8 が全て baseline-red → 実装後 green で実測されている
- `bash scripts/doc-consistency-check.sh` PASS（active plan があるため `--target plan` も PASS）
- Matrix X1〜X6 の実 mutation 注入で、対応する `rg` assertion が exit 1 へ反転することを clean tree で実測し、注入 → red → 復元 → green の記録を PR body に残す
- 旧文言 grep evidence: `rg -n 'single active packet' docs/ Plans.md AGENTS.md .agents/ .claude/` の live hit（archive 配下の歴史記述を除く）が 0、または読み替え注記の同一 PR 追記で解消済みであることを PR body に記録

## Design Sources

- Requirements / spec: なし（workflow 変更、製品仕様非接触）
- Architecture: なし
- Function / command / DTO: なし
- DB: なし
- Screen / UI: なし
- Decision log / ADR: D-034（Workflow State / Subagent Budget）、D-035（state/evidence 分離）、D-038（Owner Effort Budget / Findings Freeze / STATECAP cap）、D-039（Plan Commit ancestry）、D-050（WER consolidation）。owner 決定の一次記録 = agent memory `project-wave-operation-pilot`（2026-07-27。本 packet が repository 正本化の実施物）
- 設計入力（順10 拡張 scope 精査、2026-07-27 実施）: 残単位の正本 = `docs/research/audit-2026-07/report.md` 優先度付き是正リスト（順10〜22 の 13 単位が残、順1〜9 は PR #14〜#26 で消化済み）。干渉 pair の実読確認 = 順13×順14（`src/lib/bindings.ts` 生成物共有）、順15×順17（`OperationLogsPage.tsx`）、順15×順18（`navigation.ts`）、順15×順21（`ManualSaleRecordDetailPage.tsx`、findings p7/p1 の証拠行で確認）、順10×順18（`53-ui-home.md`）。UI_TECH_STACK.md の弱い重複（順13/14/16/18/19）は着手時に実編集要否を個別確認

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | なし | 該当なし |
| Command / DTO / generated binding / wire shape | なし | 該当なし |
| DB / transaction / audit / rollback / migration | なし | 該当なし |
| Screen / UI / route state / Japanese wording | なし | 該当なし |
| CSV / TSV / report / import / export format | なし | 該当なし |
| Durable decision / ADR | `docs/decision-log.md` D-055 | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / route / 画面 / function-design doc なし。新設するのは DEV_WORKFLOW 内の節と decision-log entry で、doc-consistency-check の既存対象内。`Wave Operation` 節は DEV_WORKFLOW 内部の節追加であり親文書の索引義務は Source Index 表の変更なしで満たされる — 節 link は同 file 内の相互参照で行う）

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-WAVE | DEV_WORKFLOW `Wave Operation`（新設） | D-055-D1 | lane/wave 定義と編成入口条件。棄却: 複数単位の 1 packet 統合（レビュー独立性と Findings Freeze の単位が崩れる） | DEV_WORKFLOW 新節 | Matrix X4 / anchor A1,A2 |
| SPEC-WF-WAVE | DEV_WORKFLOW `Workflow State` packet selection rule | D-055-D2 | Wave Registry による意図された複数 active の区別。棄却: fail-closed の全面撤廃（誤 resume 保護を失う） | DEV_WORKFLOW / Plans.md | Matrix X1 / anchor A3,A4 |
| SPEC-WF-WAVE | DEV_WORKFLOW `Owner Effort Budget` | D-055-D3 | wave batch 承認の介入計上。棄却: per-change 予算の緩和（3 回/change 構造は owner 決定で維持） | DEV_WORKFLOW | Matrix X3 / anchor A5 |
| SPEC-WF-WAVE | DEV_WORKFLOW `Draft PR Checkpoint` / `Post-Merge Closeout` | D-055-D4 | merge train（並列 Draft・直列 merge・train 先頭のみ ready-hosted-final）。棄却: 全 lane 同時 Ready（rebase ごとに hosted run が増え 1 change 1 final run と衝突） | DEV_WORKFLOW | Matrix X2 / anchor A6,A7 |
| SPEC-WF-WAVE | DEV_WORKFLOW `Review Rules` 参照 | D-055-D5 | レビュー並列化と裁定直列。棄却: 裁定も並列化（Coordinator の一貫裁定が崩れ相互修正案方式と不整合） | DEV_WORKFLOW 新節から参照 | anchor A8 |
| SPEC-WF-WAVE | DEV_WORKFLOW `Subagent Budget` | D-055-D6 | 全 lane 合算の同時上限。棄却: 無制限（裁定品質と機材保護） | DEV_WORKFLOW | Matrix X5 |
| SPEC-WF-WAVE | decision-log D-055 | D-055-D7 | 2 lane pilot 条項と rollback 条件。棄却: 即 3+ lane 本格化（owner 決定は pilot first） | decision-log | Matrix X6 |

## Design Intent Audit

- Source docs can answer what/why without chat history: D-055 本文に決定・理由・棄却代替案・revisit 条件を記録し、DEV_WORKFLOW 各節は D-055 を参照する
- Plan-only durable decisions found and promoted: 本 packet の D1〜D7 は全て DEV_WORKFLOW / decision-log へ正本化される（packet は証跡のみ）
- Assumptions and constraints: Codex 発注予算は無制限（owner 決定）。owner 介入予算は per-change 3 回を維持。lane 実装 Writer は Codex、レビュー一次は発注書駆動（Opus 5 / Codex）、裁定は Coordinator
- Deferred design gaps: wave 対応の機械 check（PK 系）は pilot 後に判断。3 lane 化は pilot WER 後の owner 判断
- Test Design Matrix cites decision IDs: X1〜X6 が D1〜D7 に対応
- Absolute guarantee / escape hatch self-check: 「registry 外複数 active は従来どおり fail-closed」の例外は Wave Registry 経由のみ。conflict-free rebase の Phase 維持は patch-id 同値の機械証明がある場合のみで、証明できなければ既存規則（content change → implementing 戻り）に落ちる

## Impact Review Lenses

not applicable — field investigation / 実機 / POS / CSV 形式変更を含まない workflow docs 変更のため。lens で見るべき運用リスク（rebase 失敗、budget 超過、fail-closed 誤発火）は D-055-D7 の pilot 条項と Test Matrix で扱う。

## Design Readiness

- Existing design docs are sufficient because: 変更対象は DEV_WORKFLOW 自身。現契約の全文実読（2026-07-27）に基づき、改訂対象文の現行文言を Matrix の anchor に固定済み
- Source docs updated in this PR: DEV_WORKFLOW / decision-log / Plans.md（registry 節）/ PROJECT_HANDOFF / AGENT_OPERATING_MANUAL（1 行）
- Design gaps intentionally deferred: 機械 check 化、3 lane 化条件の精緻化（pilot WER 入力待ち）
- Durable decisions discovered in this plan and promoted: D-055 全体

Minimum design checks: 製品 code 非接触のため layer ownership / DTO / persistence / operator UI / error recovery は該当なし。Testability = docs anchor + checker（下記 Matrix）。

## Contract Probe

- `git patch-id` で conflict-free rebase の内容不変を機械判定できる（D4 の前提）: scratch repo で lane branch の rebase 前後に `git diff main...HEAD | git patch-id --stable` を比較（2026-07-27 実測）-> conflict-free では patch-id 完全一致、競合時は rebase が非 0 exit で停止し検出可。D4 の判定 command はこの形で確定
- `scripts/doc-consistency-check.sh --target plan` が複数 active packet を正しく検査する（D2 の前提）: 本 packet の複製を synthetic 2 つ目の packet として一時配置し実行（2026-07-27 実測、検証後撤去・非 commit）-> 両 packet が検査対象になる。同時に **PK4 は packet ごとに `Plans.md` の『次の行動』節内リンクを要求する**と判明。したがって D2 の Wave Registry は『次の行動』節内に置き各 lane の packet link を含める形とし、checker 変更なし（Non-scope 維持）で PK4 を満たす

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-055-D1 lane/wave 定義・編成入口条件（footprint 互いに素、生成 file 再生成 lane は wave に 1 つ、同一 source doc 編集 lane の同居禁止） | DEV_WORKFLOW `Wave Operation` 新節 | anchor A1/A2 baseline-red→green、X4 mutation red | non-scope（実運用は wave 1 pilot で dogfood） |
| D-055-D2 Wave Registry と packet selection rule 改訂（registry 記載の複数 active は許可、registry 外・不一致は fail-closed 維持） | DEV_WORKFLOW `Workflow State` + Plans.md `Wave Registry` 節 | anchor A3/A4、X1 mutation red | non-scope |
| D-055-D3 wave batch 承認（per-change 介入 ≤3 不変、batch は各 lane に 1 回計上、wave summary 依頼形式） | DEV_WORKFLOW `Owner Effort Budget` | anchor A5、X3 mutation red | non-scope |
| D-055-D4 merge train（Draft 並列・merge 直列・train 先頭のみ ready-hosted-final・conflict-free rebase は patch-id 証明で Phase 維持 + L1 full 再実行・conflict は implementing 戻り・rebase は Codex） | DEV_WORKFLOW `Draft PR Checkpoint` / `Post-Merge Closeout` | anchor A6/A7、X2 mutation red、Contract Probe 1 | non-scope |
| D-055-D5 レビュー並列・裁定直列（per-lane 独立 reviewer、mutation 再実測・Findings Freeze・Double Audit 不変） | DEV_WORKFLOW `Wave Operation` 新節（Review Rules 参照） | anchor A8 | non-scope |
| D-055-D6 subagent 合算同時上限 4（per-lane 上限は D-034 表のまま） | DEV_WORKFLOW `Subagent Budget` | X5 mutation red | non-scope |
| D-055-D7 pilot 条項（wave 1 = 2 lane、WER 必須、rollback 条件 = fail-closed / budget 超過の同時多発で単線へ戻す） | decision-log D-055 | X6 mutation red | non-scope |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-27-wave-operation-dev-workflow-amendment.md](test-matrices/2026-07-27-wave-operation-dev-workflow-amendment.md)

- targeted tests: anchor phrase A1〜A8 の baseline-red 固定（実装前に `rg` で 0 hit を実測）→ 実装後 green
- negative tests: X1〜X6 の実 mutation 注入（clean tree、実装後）で anchor 検査 or checker が red
- compatibility checks: `bash scripts/doc-consistency-check.sh`（full + `--target plan`）、`bash scripts/check-workflow-git.sh`
- data safety checks: 実 POS / 店舗 data 非接触。commit 対象は docs のみ
- main wiring/integration checks: 旧文言（単一 active packet 前提）の repo-wide sweep evidence を PR body に記録

## Boundary / Wire Contract

該当なし（JSON / CSV / DTO / bindings / DB 非接触の docs-only workflow 変更）。

## Review Focus

- D2: Wave Registry が fail-closed 保護を弱めていないか（registry 外の複数 active、registry と packet の不一致、registry 自体の陳腐化の 3 経路で従来どおり停止するか）
- D4: merge train が既存の merge gate（三点一致）・hosted 1 change 1 final run・pre-push Ready guard・STATECAP と矛盾なく接続するか。特に「train 先頭のみ ready-hosted-final」で後続 lane の hosted run が増えないこと、conflict-free rebase の patch-id 証明が escape hatch にならないこと
- D3: batch 承認が「介入予算の実質緩和」に化けていないか（per-lane 計上の定義が曖昧だと予算が形骸化する）
- 検査の深さ per-lane 維持が全 D で明文化されているか（Goal Invariant 失敗定義との突合）
- 既存文言との drift: Workflow State / Review Rules / Contract Audit 節の「change 単位」前提の記述で、wave 化により読み替えが必要な箇所の列挙漏れ

## Spec Contract

Contract ID: SPEC-WF-WAVE-2026-07-27

- D1: wave = file footprint が互いに素な 2〜3 lane の集合。lane = 1 是正単位 = 1 Plan Packet = 1 branch = 1 Draft PR（既存 change 概念の別名であり、per-lane の workflow 契約は一切変更しない）
- D2: `Plans.md` `Wave Registry` に列挙された lane の packet 群のみ、複数 active packet として正当。registry は `Plans.md` の『次の行動』節内に置き、各 lane の packet link を含める（PK4 の per-packet link 要件を checker 変更なしで満たす。Contract Probe 2 の実測制約）。resume は registry の lane 単位で packet を選択。registry 外の複数 active / registry と packet の不一致 / registry の陳腐化検知は fail-closed（停止して owner 報告）
- D3: owner 承認は wave 単位で batch 可能。batch 1 セッションで進めた各 lane に介入 1 回を計上し、per-lane 予算（既定 3 回）は不変。依頼は lane ごとの `介入 N/M + 完了 1 文` を束ねた wave summary 形式
- D4: Draft PR までは lane 並列。ready-hosted-final への遷移は merge train 先頭の lane のみ。先頭 merge 後、次 lane は Codex が rebase し、patch-id 同値を証明できる conflict-free rebase は Phase 維持 + rebase 後 HEAD での L1 full 再実行 + PR body 更新で merge gate を再充足。conflict が出たら content change として implementing へ戻る。owner の train 承認 1 回で train 全 lane の Ready 遷移実行を Coordinator へ委任できる
- D5: Plan Reviewer / Final Reviewer は lane ごとに独立 fresh context。一次レビューは並列可、裁定は Coordinator 直列。mutation 独立再実測・oracle 独立性・Findings Freeze・Double Audit・L3 準備義務は per-lane 不変
- D6: subagent は per-lane 上限（D-034 表）に加え、全 lane 合算同時 4 を上限とする
- D7: wave 1 は 2 lane pilot。完了時 WER で摩擦を実測記録し、3 lane 化は owner 判断。複数 lane で fail-closed 停止 / budget 超過が同時発生したら wave を中断し単線運用へ戻す

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-WAVE D1 | DEV_WORKFLOW 新節執筆 | A1/A2, X4 | 編成入口条件の抜け | Matrix 実測記録 |
| SPEC-WF-WAVE D2 | Workflow State 改訂 + Plans.md registry | A3/A4, X1, Probe 2 | fail-closed 3 経路 | Matrix 実測記録 |
| SPEC-WF-WAVE D3 | Owner Effort Budget 改訂 | A5, X3 | 予算形骸化 | Matrix 実測記録 |
| SPEC-WF-WAVE D4 | Draft PR Checkpoint / Post-Merge Closeout 改訂 | A6/A7, X2, Probe 1 | 三点一致 / hosted 1 run 整合 | Matrix 実測記録 |
| SPEC-WF-WAVE D5 | 新節（Review Rules 参照） | A8 | 深さ維持の明文化 | Matrix 実測記録 |
| SPEC-WF-WAVE D6 | Subagent Budget 改訂 | X5 | 上限の実効性 | Matrix 実測記録 |
| SPEC-WF-WAVE D7 | decision-log D-055 | X6 | rollback 条件の実行可能性 | Matrix 実測記録 |

## Data Safety

- 実 POS CSV / 店舗 data / DB file / backup / log / secret は commit しない（本 change は docs のみ）
- local-only paths: `.local/ci-evidence/`（L1 証跡、非 commit）
- synthetic-only paths: Contract Probe 2 の synthetic packet は検証後に撤去し commit しない

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
