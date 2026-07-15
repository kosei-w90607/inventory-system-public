# UI-13 WER 起源の workflow docs 正本化（登録・生成義務 checklist / Contract Probe 手順 / materialize 局所検査）

## Workflow State

- Phase: plan-draft
- Risk: R2
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable
- Writer: Fable（docs 3 file の軽微修正につき Coordinator 直接実装。自己承認回避のため Plan / Final review は独立 context に出す）
- Plan Reviewer: independent Sonnet review context
- Final Reviewer: independent Sonnet review context（Plan Reviewer とは別 context）+ Fable 裁定
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required（workflow 契約 docs の変更。docs-only につき PR event は filter され、Ready 後の owner-directed `workflow_dispatch` で final を取得する）
- Human Gate: none（owner 事前指示 2026-07-15「このまま1の workflow docs PR もおねがい」= plan scope・Ready・merge の事前承認、介入 1 回目 / 予算 1。scope 逸脱・review P1/P2 発生時はこの事前承認を失効させ owner に戻す）

## Owner Effort Budget

- 介入回数上限: 1
- 実働時間上限: 15分
- relay 往復上限: 0

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R2

Reason:
docs-only の workflow 規範・template 変更。gate ロジック（checker / CI / git 検査）には触れず、runtime contract の変更もない。ただし workflow 契約 docs であるため hosted final は required。

## Goal

Goal Invariant:

### 最小完了条件

- 次に R2+ の Plan Packet を書く作業者が、template を開いた時点で登録・生成義務 checklist（UI-13 Amendment 1〜4 の failure class 対策）を参照でき、Contract Probe の「是正仮適用で end-to-end」手順と forward materialize commit 直後の `check-workflow-git.sh` 局所実行が `docs/DEV_WORKFLOW.md` の正本に存在する。

### 失敗定義

- checklist が Claude 私有 memory にしか存在しない状態が続く。
- 規範文言の追加が既存 gate の挙動・enum・checker 期待 token を変えてしまう。

### 非目的

- checker / hook / CI への機械強制の実装（D-046-7 のとおり docs 宣言だけでは不十分な失敗クラスだが、機械化は発動データを見て別 PR で判断する）。
- 既存 packet・archive の遡及修正。
- Plan Packet template の checklist 以外の構造変更。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/templates/plan-packet.md`: `## Registration / Generation Obligations` 節を Required Design Artifacts の直後に新設（新規 command / 新設 doc / 新規 REQ / 新規 route / 新規 operator 画面の登録・生成義務チェック表。該当行は Scope と、R3/R4 では Contract Coverage Ledger に反映してから Plan Gate に出す。operator 到達導線は Ledger 標準行）。Contract Probe 節に「登録漏れ是正を含む probe は是正を仮適用した状態で end-to-end に回す」1 文を追記
- `docs/DEV_WORKFLOW.md`: Contract Probe 規定（Plan Packet Rules 内)に同旨の 1 文を追記。Workflow State の state-only 遷移規則に「forward materialize commit を作成したら直後に `bash scripts/check-workflow-git.sh` を実行し、STATECAP 超過を commit 時点で検出する」1 文を追記

## Non-scope

- `scripts/doc-consistency-check.sh` / `scripts/check-workflow-git.sh` / CI workflow / hook の変更
- 既存 enum・checker 期待 token・phase 遷移表の変更
- memory 側 checklist の削除（template 昇格後も Claude 向け運用注記として残す）

## Acceptance Criteria

- `rg "Registration / Generation Obligations" docs/templates/plan-packet.md` が 1 節を返し、checklist に specta 登録 / specta 属性対 / bindings 再生成 / compliance test 登録 / traceability 再生成 / route 生成 / navigation 有効化 + 到達テスト / Ledger 到達導線行 が含まれる
- `rg "是正を仮適用" docs/DEV_WORKFLOW.md docs/templates/plan-packet.md` が両ファイルに hit する
- `rg "check-workflow-git.sh" docs/DEV_WORKFLOW.md` が materialize 規則の文脈で hit する
- `bash scripts/doc-consistency-check.sh` ERROR 0
- `bash scripts/local-ci.sh full` PASS / CLEAN（gate 挙動が変わっていないことの回帰確認を兼ねる）

## Design Sources

- Requirements / spec: [UI-13 WER](../archive/plans/2026-07-15-ui13-integrity-check-workflow-effectiveness-review.md) Recommended Workflow Adjustment（Change 3 点）
- Architecture: `docs/DEV_WORKFLOW.md`（Plan Packet Rules / Workflow State）
- Function / command / DTO: 変更なし
- DB: 変更なし
- Screen / UI: 変更なし
- Decision log / ADR: D-046（docs 宣言 + interface 強制の系譜）、D-038

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 変更なし | existing sufficient |
| Command / DTO / generated binding / wire shape | 変更なし | existing sufficient |
| DB / transaction / audit / rollback / migration | 変更なし | existing sufficient |
| Screen / UI / route state / Japanese wording | 変更なし | existing sufficient |
| CSV / TSV / report / import / export format | 該当なし | — |
| Durable decision / ADR | UI-13 WER（判断根拠は記録済み、新規 D 不要） | existing sufficient |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-UI13WER | UI-13 WER Change 1 | SPEC-WF-UI13WER-D1 | checklist は template 常設（毎 plan で強制視認）。rejected: memory のみ（Claude 以外の作業者・Codex に届かない）、DEV_WORKFLOW 本文のみ（plan 作成時に開かれない） | `templates/plan-packet.md` | AC の rg token 検査 |
| SPEC-WF-UI13WER | UI-13 WER Change 2 | SPEC-WF-UI13WER-D2 | probe 手順は既存 Contract Probe 規定の拡張 1 文（新概念を作らない）。rejected: 独立節の新設（D-038 系の「既存レンズ拡張」方針に反する） | `DEV_WORKFLOW.md` + template Contract Probe 節 | AC の rg token 検査 |
| SPEC-WF-UI13WER | UI-13 WER Change 3 | SPEC-WF-UI13WER-D3 | materialize 直後の局所検査は手順文言で先行導入し、機械強制（hook 等）は発動データ待ち。rejected: 即 hook 化（sandbox 書込み制約 + D-039 slice 2 の hook 統合 backlog と重複） | `DEV_WORKFLOW.md` Workflow State | AC の rg token 検査 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: WER + 本変更後の DEV_WORKFLOW / template で成立
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: なし（WER 記録済み判断の正本化のみ）
- Assumptions and constraints: checker は template の節構成を token 検査していない（PK 検査対象は Workflow State / Matrix リンク / Findings Freeze 等）ため、節追加は既存 gate を壊さない — L1 full で回帰確認する
- Deferred design gaps, risk, and follow-up target: 機械強制化（hook / checker WARN）は発動実績を見て別 PR
- Test Design Matrix can cite design decision IDs or source doc sections: R2 につき Matrix 省略、AC token が代替

## Impact Review Lenses

not applicable — field investigation / 実機 / 外部ツール / POS / フォーマット変更のいずれも起点でない。UI-13 WER の Recommended Workflow Adjustment からの計画的正本化。

## Design Readiness

- Existing design docs are sufficient because: 変更対象は workflow 規範 docs そのもので、根拠は UI-13 WER に記録済み
- Source docs updated in this PR: `DEV_WORKFLOW.md` / `templates/plan-packet.md`
- Design gaps intentionally deferred: 機械強制化
- Durable decisions discovered in this plan and promoted to source docs: なし

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 変更なし
- Backend function design: 変更なし
- Command / DTO / data contract: 変更なし
- Persistence / transaction / audit impact: 変更なし
- Operator workflow / Japanese UI wording: 変更なし
- Error, empty, retry, and recovery behavior: 変更なし
- Testability and traceability IDs: AC の rg token で検査

## Contract Probe

N/A — 外部前提なし（変更対象は自 repo の docs のみ。checker が template 節構成に依存しない事実は L1 full の回帰で確認する）。

## Contract Coverage Ledger

R2 につき省略（R3/R4 必須節）。契約検証は AC の rg token + L1 full 回帰で代替。

## Test Plan

- targeted tests: AC の rg token 検査 3 点
- negative tests: なし（docs-only）
- compatibility checks: `doc-consistency-check.sh` ERROR 0、`local-ci.sh full` PASS（checker / gate の回帰）
- data safety checks: 実データなし
- main wiring/integration checks: なし

## Boundary / Wire Contract

該当なし（wire 変更なし）。

## Review Focus

- 追記文言が既存 gate の挙動・enum・checker 期待 token を変えないこと（宣言の追加に留まること）
- checklist 8 項目が UI-13 Amendment 1〜4 + memory checklist と過不足なく対応すること
- Contract Probe 追記が既存規定の拡張として読めること（新概念化していないこと）

## Spec Contract

R2 につき簡略（R3/R4 必須節）。

Contract ID: SPEC-WF-UI13WER

- template を開いた R2+ plan 作成者が登録・生成義務 checklist を視認できる
- probe 手順と materialize 局所検査が DEV_WORKFLOW 正本に存在する

## Trace Matrix

R2 につき省略（R3/R4 必須節）。AC が代替。

## Data Safety

- 実店舗データ・秘匿情報の混入なし（docs-only）

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
