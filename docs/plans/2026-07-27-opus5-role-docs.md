# Plan Packet: Opus 5 役割確定の正本化（D-056 候補、R2 docs-only）

## Workflow State

- Phase: plan-draft
- Risk: R2
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable
- Writer: Fable（design board 例外: workflow design-only change、owner 明示指示 = 2026-07-27 協議での「R2 docs PR で即正本化」選択。実装 code なし）
- Plan Reviewer: pending（Sonnet 独立 fresh context）
- Final Reviewer: pending（Sonnet 独立 fresh context、Plan Reviewer とも別 context）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending（Ready 化 / merge）

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R2

Reason:
docs-only の運用ルール正本化。workflow gate（merge gate / 検証 gate / state machine / Subagent Budget / Owner Effort Budget / 独立性制約の既存 5 項）はいずれも変更しない。追加するのは role assignment の適用指針（slot の適所固定）、informational slot 表の行、発注書の書式 profile、decision-log entry のみで、evidence 要件・承認経路・検査内容はすべて不変。gate に触れないため R3（merge gate changes / workflow gate change）には該当しないと判断する — この判断自体を Plan Reviewer の検証対象とする。

## Goal

Goal Invariant:

### 最小完了条件

- 2026-07-27 の owner 最終決定（Opus 5 = read-only 発注書駆動の claims-producer 専任 / メインスレッド代役不採用 / 代役ドラフト条件付き凍結 / 発注書二形化 / 難所 lane からの投入基準）が、agent memory ではなく repository 正本（AGENT_OPERATING_MANUAL + decision-log）から読める状態になる。

### 失敗定義

- 正本化の過程で workflow gate・独立性制約・予算のいずれかの意味が変わる。または「決定の理由と revisit 条件（Fable slot 恒久喪失）」が正本から読めず、将来の再協議が memory 依存のままになる。

### 非目的

- 代役ドラフト 3 点（output style / hook / rules 点検）の実装（凍結対象。revisit 条件のみ D-056 に記録する）
- DEV_WORKFLOW / Subagent Budget / Wave Operation 節の変更
- Opus 5 への初回実発注（難所 lane 着手時の別作業）

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/AGENT_OPERATING_MANUAL.md`:
  - §3 の制約 list に 1 項追加: 高自律・低制約適性 slot（§3.4 で対応）は read-only の Reviewer / Explorer 発注書ロール専任とし、Writer / Coordinator に割り当てない（D-056）
  - §3.4 slot 表に `Opus` 行を追加（informational: 現行実体 = Claude Opus 5、read-only 発注書駆動の claims-producer 専任）
  - §5 に §5.4「低制約発注書 profile」を新設: 必須 5 点（goal / scope 境界 / read-only 宣言 / 報告フォーマット / subagent 生成上限）のみで構成し、過程指示・検証手順の指定を書かないことを本 manual を正本として規定
- `docs/decision-log.md`: D-056 新設（決定・理由〈公式 prompting 指針の非対称性 + workflow の claims-until-verified 構造への適所配置〉・棄却代替案〈代役整備 / 単純不使用〉・revisit 条件〈Fable slot 恒久喪失で代役ドラフト解凍を検討〉・投入基準〈難所 lane から、通常レビューは Sonnet 維持〉）
- `Plans.md`: 『次の行動』節へ本 packet link の追加（改訂後 PK4 の per-packet link 要件）と独立 track 1 行
- `docs/PROJECT_HANDOFF.md`: 同期 1 行

## Non-scope

- `docs/DEV_WORKFLOW.md` 全節（gate 非接触の機械証明は AC の diff guard で行う）
- `.claude/` / `.agents/` の skill・rules・hook（凍結ドラフトの実装を含む）
- `scripts/` 全て

## Acceptance Criteria

- `rg -F 'D-056' docs/decision-log.md docs/AGENT_OPERATING_MANUAL.md` が両 file で hit する（決定と適用指針の接続）
- `rg -F '低制約発注書 profile' docs/AGENT_OPERATING_MANUAL.md` が hit し、profile 節に必須 5 点（goal / scope 境界 / read-only / 報告フォーマット / subagent 生成上限）が全て列挙されている
- `rg -F '恒久喪失' docs/decision-log.md` が hit する（revisit 条件の正本化）
- `git diff main -- docs/DEV_WORKFLOW.md docs/ci.md scripts/` が空（gate 非接触の機械証明、exit 0 かつ無出力）
- `bash scripts/doc-consistency-check.sh` PASS（active plan があるため `--target plan` も PASS）
- 最終 HEAD で `bash scripts/local-ci.sh full` CLEAN PASS（evidence は PR body）

## Design Sources

- Requirements / spec: なし（製品仕様非接触）
- Decision log / ADR: D-034（役割・Subagent Budget）、D-055（wave 運用 = claims-until-verified のレビュー構造。Opus の席はこの構造の一次レビュアー枠）
- 一次記録: agent memory `project-opus5-order-driven-role`（owner 最終決定 2026-07-27。本 packet が repository 正本化の実施物）。背景事実 = 公式 Opus 5 prompting guide の非対称性（検証系・過程系指示は消す / 出力契約と委譲上限は足す、2026-07-26 裏取り済み）と本 repo の実測（Writer / Coordinator 双方の claims が独立検証で複数回訂正された実績 → 検証は workflow 層に置き、実行者への process 内面化を要求しない設計が既に機能している）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend / Command / DB / Screen / CSV | なし | 該当なし |
| Durable decision / ADR | `docs/decision-log.md` D-056 | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / route / 画面 / function-design doc なし。AGENT_OPERATING_MANUAL の節追加は同 file 内構成で、doc-consistency-check の既存対象内）

## Design Readiness

- Existing design docs are sufficient because: 変更は運用ルールの正本化のみで、AGENT_OPERATING_MANUAL の既存構成（§3 制約 list / §3.4 slot 表 / §5 prompt 正本群）にそのまま収まる
- Source docs updated in this PR: AGENT_OPERATING_MANUAL / decision-log / Plans.md / PROJECT_HANDOFF
- Design gaps intentionally deferred: 低制約 profile の実運用調整は難所 lane 初投入後（必要なら D-056 の revisit で追記）
- Durable decisions discovered in this plan and promoted: D-056 全体

## Test Plan

R2 のため Test Design Matrix は作成しない（Risk Tiers どおり）。検証は AC の観測 token（`rg` hit / diff guard 空 / checker PASS / L1 full CLEAN）で行う。

## Review Focus

- Risk 判定の妥当性: 本変更が workflow gate change（R3 + Double Audit 対象)に該当しないか — §3 制約 list への追加が既存独立性制約の意味を変えないか
- D-056 の記述が「決定・理由・棄却代替案・revisit 条件」を将来の再協議に十分な形で残しているか
- 低制約 profile の必須 5 点が、既存の Subagent Budget（上限表・output contract・one-writer）と矛盾なく接続するか
- model-neutral 原則: 規範文の主語が slot 抽象（§3.4 対応表経由）になっており、model 名が規範に直書きされていないか

## Spec Contract

Contract ID: SPEC-WF-OPUS5-2026-07-27

- D-056-D1: 高自律・低制約適性 slot は read-only の Reviewer / Explorer 発注書ロール専任。Writer / Coordinator / state 遷移管理に割り当てない
- D-056-D2: 当該 slot への発注書は低制約 profile（goal / scope 境界 / read-only 宣言 / 報告フォーマット / subagent 生成上限の 5 点のみ、過程指示なし）を用いる
- D-056-D3: メインスレッド代役は不採用。代役ドラフト 3 点は凍結し、revisit 条件 = Fable slot の恒久喪失
- D-056-D4: 投入基準 = レビュー難所（L 級 lane の一次等）から。通常レビューは既存分業を維持
- D-056-D5: security 隣接の敵対的レビュー迂回は従来どおり（本決定で変更しない）

## Data Safety

- 実 POS / 店舗 data 非接触。commit 対象は docs のみ

## Implementation Results

Fill after implementation.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.
