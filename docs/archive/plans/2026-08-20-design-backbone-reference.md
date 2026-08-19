# Plan Packet: デザインの背骨（04-backbone）と参考 mockup の正本化

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: ready-hosted-final
- Risk: R2
- Execution Mode: fable-window
- Plan Commit: e29c27e
- Amendments: none
- Coordinator: Fable
- Writer: Fable（docs-only。設計判断の起草者 = Coordinator。独立 Sonnet reviewer で自己承認を回避）
- Design Board Exception: AGENT_OPERATING_MANUAL §3.1 適用（design-only change。owner 明示指示 2026-08-20「背骨 C これでいい / お手本をどこかに残して背骨と合わせて参考資料に」。Plan Gate / Final Reviewer は Sonnet 独立 fresh context、実装 code の Writer には割り当てない）
- Plan Reviewer: Sonnet subagent（独立、fresh context）
- Final Reviewer: Sonnet subagent（独立、fresh context）
- Reviewed Content HEAD: f3e0b64
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner plan approval / Ready / merge（docs-only のため visual confirmation なし。背骨 v1.0 と mockup C の内容自体は owner が 2026-08-20 に Artifact 上で「これでいい」と採用済み）

Transition narrative（append-only）:

- 本 packet 作成 commit で kickoff → spec-check → design → plan-draft → plan-gate を materialize する。evidence: task scope と Risk は本 packet に記録 / in-scope は design-system docs のみで設計判断は Opus 5 提案 A・B の突合裁定（Coordinator）と owner 採用で確定済み / packet を単独 commit（R2、Test Matrix 省略）。

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 15分
- relay 往復上限: 0
- Plan Review round 天井: 3（既定 hard cap）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` に従う。介入 = plan approval / Ready 承認。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R2

Reason:
docs-only。`docs/design-system/` に上位要約 doc（04-backbone）と参考資料（reference/）を追加し README を更新する。runtime 契約・code・CSV / PLU / DB に触れない。保守性（以後の UI batch packet の Required Design Artifacts と review 根拠）に影響するため R2。

## Goal

Goal Invariant:

### 最小完了条件

- 実装者・レビュアーが `docs/design-system/04-backbone.md` の 12 行を読めば、UI の見せ方について「まず守る骨」と、その骨が既存 00〜03 のどこに反映されるかが分かる。
- 統合案 C の mockup 3 画面（ホーム / 商品一覧 / 在庫照会）と Opus 5 提案 A / B の原文が `docs/design-system/reference/` に残り、README から辿れる。

### 失敗定義

- 04-backbone の行が 00〜03 と矛盾したまま「どちらが正か」を示さない。
- mockup が外部資源を参照する、または実 JAN / 実商品名を含む。
- reference が「実装の正本」と誤読される書き方になっている。

### 非目的

- 00〜03 / review-checklist への反映そのもの（UI batch 1 packet で行う）、実装の変更、表示スケール拡張（別 packet）。

## Scope

In scope:

1. `docs/design-system/04-backbone.md` 新設（位置付け / 前提 / 12 原則 + 由来 / foundations 追記 token 表 / 00〜03 への反映先 / 適用順序の参考 / 更新履歴）。
2. `docs/design-system/reference/README.md` + `mockup-c-{home,products,stock}.html`（統合案 C、静的・外部資源なし・ダミーデータ）+ `2026-08-20-proposal-{A-rules-bound,B-blank-slate}.md`（Opus 5 原文、file:line は snapshot と明記）。
3. `docs/design-system/README.md` のサブ docs 一覧と命名規約に 04 / reference を追加。
4. `docs/Plans.md` 次の行動へ本 packet を登録（+ follow-up: UI batch 1〜4 と表示スケール拡張の packet）。

## Non-scope

- 00〜03 / SCREEN_DESIGN / review-checklist の本文変更、`src/` 変更、decision-log（背骨は design-system 内の採用済み判断として 04 に記録し、D-0xx は起票しない — 規範の正本化は batch 1 で 00〜03 に入るため）。

## Acceptance Criteria

- `bash scripts/doc-consistency-check.sh` ERROR 0（既存 WARN `per_page` 1 件は可）。
- `rg -c 'https?://' docs/design-system/reference/*.html` が 0（外部資源なし）、`rg -n '490[0-9]{10}' docs/design-system/reference/*.html` の hit が test 既出の架空 JAN のみ（実 JAN なし）。
- `docs/design-system/README.md` から 04-backbone と reference/README へのリンクが存在し、04-backbone から 00〜03 の反映先が節単位で列挙されている。
- 独立 Sonnet Final Review で P1/P2 = 0（観点: 04 と 00〜03 の矛盾の有無と「意図 / 現行基準」の読み分けが明記されているか、reference の位置付け文言、mockup の実データ非含有）。
- L1 `scripts/local-ci.sh full` PASS、hosted CI と exact-HEAD 三点一致。

## Design Sources

- `docs/design-system/00-foundations.md` / `01-decision-rules.md` / `02-component-catalog.md` / `03-philosophy.md` / `README.md`
- `docs/SCREEN_DESIGN.md` §1〜§3、`docs/UI_TECH_STACK.md` §2.2〜2.3、`docs/quality/review-checklist.md` カテゴリ 9、`.agents/skills/inventory-operator-ui/SKILL.md`
- 裁定の経緯: Opus 5 提案 A / B（reference/ に原文）と Coordinator 裁定（Artifact、2026-08-20）、owner 裁定（info は warning トーン / 行高 48px 見送り / 検索欄 live + ボタン併記 / 背骨 C 採用）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Screen / UI / Japanese wording | design-system 00〜03 | intentionally deferred（04-backbone に反映先を列挙、UI batch 1 packet で更新） |
| Design system index | design-system/README.md | updated in this PR |
| Durable decision / ADR | 04-backbone 自体（採用済み判断を design-system 内に記録） | updated in this PR |
| Backend / DB / CSV / command | — | 該当なし |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| `docs/design-system/04-backbone.md` / `reference/` | `docs/design-system/README.md` の一覧 + 命名規約へ登録（本 PR） |
| Plans.md | 次の行動へ packet link（PK4） |
| route / command / REQ / bindings | 該当なし |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| design-system 横断 | 00〜03 | 04-backbone 原則 1〜12 | A / B の突合: 規範の履行（A）を土台に system 要素（B）を追加。icon 28 / 行高 48 は既存規範・密度哲学と衝突で不採用 / 見送り | 04-backbone.md / reference/ | review + doc check |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: はい。04-backbone が位置付け・経緯・12 原則・反映先を自己完結で持ち、A / B 原文を reference に置く。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: 背骨 12 行と owner 裁定 3 点（info / 行高 / 検索欄）→ 04-backbone。
- Assumptions and constraints: 00〜03 への反映は batch 1 で行う。反映までの「意図 / 現行基準」の読み分けを 04 冒頭に明記。
- Deferred design gaps, risk, and follow-up target: 表示スケールの段数（小さめ）と最小ウィンドウ高（owner 所見 2026-08-20）は別 packet。
- Test Design Matrix can cite design decision IDs or source doc sections: R2 docs-only のため Matrix 省略、AC で代替。
- Absolute guarantee / escape hatch self-check completed: reference は「正本ではない」を README 冒頭に明記し、正本との二重化を避ける。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Operator workflow | 背骨 7（検索欄 live 統一）/ 9（1 行説明）は operator の学習コストを下げる意図。実装は batch 2 | batch 2 packet |
| Manual verification | docs-only のため不要。mockup は static HTML で目視可能 | — |
| Data safety / evidence | mockup のダミーデータは架空、JAN は test 既出の架空値のみ | AC |
| 他 lens | 該当なし | — |

## Design Readiness

- Existing design docs are sufficient because: 00〜03 は存在し、本 PR はその上位要約と参考資料の追加のみ。
- Source docs updated in this PR: design-system/README.md、04-backbone.md（新設）、reference/*（新設）。
- Design gaps intentionally deferred: 00〜03 本文への反映（batch 1）。
- Durable decisions discovered in this plan and promoted to source docs: 04-backbone 12 行。

Minimum design checks for business-app work:

- Layer ownership: docs のみ。
- Backend function design / Command / Persistence: 該当なし。
- Operator workflow / Japanese UI wording: 04-backbone の文言は既存 UI 語彙（在庫切れ / 在庫少 / 未反映 / 廃番 等）に合わせる。
- Error, empty, retry, and recovery behavior: 該当なし。
- Testability and traceability IDs: 該当なし（REQ 非接触）。

## Contract Probe

N/A — 外部前提なし（docs-only）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| 04-backbone 原則 1〜12 と 00〜03 の整合（矛盾は「意図 / 現行基準」として明記） | 04-backbone.md | doc check + review | — |
| reference の位置付け（正本ではない） | reference/README.md | review | — |
| mockup の自己完結性・実データ非含有 | reference/*.html | AC の rg | — |

## Test Plan

- targeted tests: `bash scripts/doc-consistency-check.sh`、AC の rg 2 本。
- negative tests: 該当なし。
- compatibility checks: 既存 00〜03 の本文は不変（`git diff --stat` で 00〜03 が出ない）。
- data safety checks: mockup に実 JAN / 実商品名なし。
- main wiring/integration checks: README リンクの到達（相対 path）。

## Boundary / Wire Contract

該当なし（docs-only）。

## Human Gate Proposal

- Human Gate = owner plan approval / Ready / merge。内容（背骨 v1.0・mockup C）は owner が 2026-08-20 に採用済み。visual confirmation は不要（実装なし）。
- 不採用 alternative: 背骨を decision-log D-0xx として起票 — 規範の正本化は batch 1 で 00〜03 に入るため、design-system 内の 04 に採用済み判断として置く方が参照動線が短い。

## Review Focus

- 04-backbone の各行が 00〜03 の既存記述と矛盾する箇所を列挙し、矛盾が「意図 / 現行基準」の読み分けで吸収されているか。
- reference/README の「正本ではない」位置付けと、提案原文の file:line が snapshot である注記。
- mockup 3 file が同一 token から生成され、画面間で枠・検索欄・行・badge の作りが揃っているか（HTML を実読）。

## Spec Contract

R2 につき任意。04-backbone の 12 行を契約とする（上記 Ledger）。

## Trace Matrix

R2 につき任意。

## Data Safety

- 実 JAN / 商品名 / 価格を docs に入れない（mockup は架空データ、JAN は test 既出の架空値 `4901234567894` / `4900000000012` 系のみ）。
- local-only: なし。物理 DELETE なし。

## Implementation Results

Fill after implementation.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

### Plan Gate round 1（2026-08-20、独立 Sonnet Plan Reviewer、対象 `e29c27e` + 未コミット docs draft）

- Verdict: P1 0 / P2 1 / P3 3。事実主張（token / 色値 / DisplayScale 3 段 / minHeight 720 / button h-9 / mockup 同一 CSS・外部資源 0・実 JAN なし / doc check / 00〜03 不変 / PK4 / A・B 原文の file:line）は全件 OK。12 行判定: 一致 5 / 拡張 6 / 矛盾明記 1、すべて冒頭の「意図 / 現行基準」条項で吸収可。
- P2（accept）: Writer = Fable は AGENT_OPERATING_MANUAL §3.1 design board 例外に当たり、Workflow State への適用 1 行記録と owner 明示指示の根拠が欠けていた → `Design Board Exception` 行を追加（owner 指示 2026-08-20 を根拠、plan approval で役割割当ごと確認する）。
- P3-1（accept）: 原則 4 の反映先に `02-component-catalog.md ⑬` を追加。
- P3-2（accept）: 原則 1 の由来を A（16px）+ B（12px は badge 内）に訂正し、caption 段の退役規模（badge 外 20 箇所超）と batch 1 での 00-foundations 更新を明記。
- P3-3（accept）: 原則 6 に 00-foundations「space-8 = ページ余白」との数値相違と batch 1 での修正を明記。
- Phase は plan-gate に留まる in-place 是正。round 2 は fresh delta 再検証。

### Plan Gate round 2（2026-08-20、fresh 独立 Sonnet Plan Reviewer、対象 `e4a1c9e` + draft）

- round 1 是正 4 件は全件適正（§3.1 要件充足と PK4 非衝突を script 実行で確認 / 反映先 ⑬ 実在 / `text-xs` 39 hit で badge 外 20 超の主張を裏付け / space-8 = 32px との相違は事実）。新規 P1 0 / P2 0 / P3 0 → **Plan Gate 収束**。owner plan approval 待ち。
- 付記: Hosted CI Requirement は docs-only で `not-required` も選べるが、安全側の `required` を維持。

### owner plan approval / 遷移記録（2026-08-20）

- owner plan approval（介入 1 回目 / 予算 2 回、owner 発言 `承認するよ`。§3.1 design board 例外の役割割当ごと承認）。
- state-only 遷移（append-only、STATECAP forward 1 本目）: `plan-gate -> plan-approved -> implementing`。plan-approved の evidence = Plan Gate round 2 P1/P2 = 0（`dbe8f2d`）+ owner approval。implementing の evidence = Plan Commit `e29c27e`（plan-first、content commit に先行）。
- 以後: docs content commit（04-backbone / reference / README）→ L1 full → 独立 Sonnet Final Review → Ready 承認（介入 2/2）→ state-only 2 本目（`local-verified -> independent-review -> human-confirm -> ready-hosted-final` の隣接 forward 圧縮、`implementing -> local-verified` は content commit 同乗）。

### Final Review round 1（2026-08-20、独立 Sonnet Final Reviewer、content `c103d1c`）

- Verdict: P1 0 / P2 1 / P3 0。AC 実証: 外部資源 0 / 架空 JAN のみ / README リンク / commit 順序（plan-first 先行）/ Plans.md 登録 / §3.1 5 要件 すべて OK。事実主張 12 件 OK（mockup 3 file の style block は `<title>` 以外完全一致、navigation label 18 件・StockStatusBadge 3 語彙・PR #86 の PLU badge 3 語彙と文言一致）。
- P2（accept、docs-only 是正）: 原則 7 の反映先に `02-component-catalog.md ⑨`（canonical `SearchBar` が live「ボタンなし」/ commit の 2 実装で本行と異なる）が欠けていた → 原則 7 の行内注記と反映先リストに追加。
- L1 full は `c103d1c` で RESULT=PASS / END_TREE_STATE=CLEAN / MERGE_EVIDENCE_VALID=true（evidence は PR body）。是正後の HEAD で fresh delta 再検証 → Ready 承認後の state-only 遷移 commit の exact HEAD で L1 再取得。
- fresh delta 再検証（`f3e0b64`）: ⑨ の事実関係（live 型ボタンなし / commit 型）と反映先追加を確認、docs/plans 以外の変更は 04-backbone のみ、Workflow State 不変、新規 P1/P2 = 0 → Final Review 収束。

### owner Ready 承認 / 遷移記録（2026-08-20）

- owner Ready 承認（介入 2 回目 / 予算 2 回、owner 発言 `承認するよ`）。Human Gate の owner 項目は全消化。
- state-only 遷移（append-only、STATECAP forward 2 本目、post-implementation 1 本目）: `implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final`（隣接 forward の recording compression）。evidence: local-verified = content candidate `c103d1c` の L1 full RESULT=PASS / END_TREE_STATE=CLEAN / MERGE_EVIDENCE_VALID=true（evidence は PR body）/ independent-review = 独立 Sonnet Final Review round 1（P1 0 / P2 1 / P3 0）+ P2 是正 `f3e0b64` の fresh delta 再検証 P1/P2 = 0 / human-confirm = findings 裁定済み、Reviewed Content HEAD = `f3e0b64`（content の最終 = 04-backbone 原則 7 注記まで）/ ready-hosted-final = owner Ready 承認。
- 遷移後: 本 exact HEAD で L1 full 再実行 + PR body 全面 refresh → owner が Ready トリガー → hosted CI → merge → Post-Merge Closeout（packet を archive、Plans.md 同期）。
- Owner Effort Budget 実績: 介入 2/2、relay 0/0、STATECAP forward 2/3。
