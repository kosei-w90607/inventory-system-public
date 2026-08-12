# Plan Packet — 棚卸し確定結果の差異符号表示 drift 是正（UI-10-D10）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

- Phase: archive
- Risk: R2
- Execution Mode: fable-window
- Plan Commit: 7a555b9
- Amendments: none
- Coordinator: Fable (main thread)
- Writer: Fable (main thread、1 行 + test の軽微是正。PR #64/#67 の Coordinator/Writer 兼務先例)
- Plan Reviewer: skip（R2 rounds 0-1 の 0 適用。理由は Review Response 参照）
- Final Reviewer: Sonnet subagent（独立 context）
- Reviewed Content HEAD: fb4fd1b
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none（表示是正の実機確認は受入台本 change の再 L3 Step 4 が兼ねる — PR #74 参照）

## Owner Effort Budget

- 介入回数上限: 1（PR merge 承認のみ）
- 実働時間上限: 10分
- relay 往復上限: 0
- Plan Review round 天井: 3（既定 3）

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R2

Reason:
実装 1 行（既存 formatter の適用箇所追加）+ frontend test。wire / DTO / route / DB / 設計契約は不変 — 設計正本 UI-10-D10 / 73 §73.6 が既に規定する「符号付き数値・進行中一覧と結果画面の表現統一」へ実装を追随させる drift 是正であり、契約変更を含まない。

## Goal

Goal Invariant:

### 最小完了条件

- 棚卸し確定結果画面（`adjusted_items` テーブル）の差異列が、進行中一覧と同じ `formatListDifference` 表現（正 = `+N` / 負 = `-N`）で表示される。

### 失敗定義

- 正差異が符号なし（`1`）のまま表示される、または進行中一覧側・他列の表示が変わる。

### 非目的

- 差異の計算式・色分け・列構成の変更。UI-10-D10 契約自体の改訂。受入台本 change（PR #74）の内容変更。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `src/features/stocktake/StocktakePage.tsx` 確定結果テーブルの差異 cell を生値 `{item.difference}` から `formatListDifference(item.difference)` へ変更（import 済み関数の適用のみ）。
- `StocktakePage` の結果画面 test に、正差異 `+N` / 負差異 `-N` の表示固定 assert を追加（既存 test の改変なし、追加のみ）。
- REQ token を含む test 追加に伴う `cargo run --bin generate_traceability` の 90-traceability.md 再生成（該当する場合）。

## Non-scope

- 進行中一覧・カウント入力欄の表示（既に契約準拠）。
- 0 差異の結果画面表示（`adjusted_items` は差異非 0 の商品のみで、結果画面に 0 は出ない — 35-biz §20.5 手順 5g）。
- 受入台本 change（別 packet）の変更。

## Acceptance Criteria

- 結果画面 test: 正差異ケースで `+1`（または同型の `+N`）の text assert が green、負差異ケースで `-N` assert が green。
- 是正前 code（生値表示）へ戻すと当該 test が red（mutation 感度、Coordinator 実測）。
- `npm test`（対象 file）/ eslint / prettier / `tsc --noEmit` clean、`./scripts/doc-consistency-check.sh` 全通過。
- 90-traceability.md が test 追加後の再生成で drift 0（CI generated drift gate pass）。

## Design Sources

- Requirements / spec: REQ-205（棚卸し）
- Function / command / DTO: `docs/function-design/73-ui-stocktake.md` UI-10-D10 / §73.6（差異列 = 符号付き数値のプレーンテキスト、結果画面と表現統一）、`docs/function-design/35-biz-stocktake-service.md` §20.4（difference 定義）
- Screen / UI: 同上
- Decision log / ADR: 起源 = 受入台本 L3 round 2 の owner 観察（PR #74 comment 2026-08-13）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Screen / UI / route state / Japanese wording | 73 UI-10-D10 / §73.6 | existing sufficient（実装を正本へ追随させる方向、doc 変更なし） |
| Backend / DTO / DB / CSV / Durable decision | 該当なし | — |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| REQ coverage 追加（結果画面 test） | `cargo run --bin generate_traceability` で `90-traceability.md` 再生成 |

他は該当なし。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-205 | 73 §73.6 差異列 | UI-10-D10 | 生値表示は「符号付き・表現統一」契約からの drift（owner L3 実機観察 + Coordinator 4 点実読で confirmed）。formatter 新設ではなく既存 `formatListDifference` の適用で統一 | StocktakePage.tsx 結果テーブル | 結果画面 test の +N/-N assert |

## Design Intent Audit

- Source docs can answer what is being built and why: yes — UI-10-D10 が表現契約を規定済み、本 change は追随のみ。
- Plan-only durable decisions: なし。
- Assumptions and constraints: `adjusted_items` は差異非 0 のみ（35-biz §20.5 5g）のため null/0 分岐は結果画面で不要、`formatListDifference` の null 分岐は到達しない（型は number）。
- Deferred design gaps: なし。
- Test Design Matrix: R2 optional、AC の mutation 感度確認で代替。
- Absolute guarantee / escape hatch self-check: 挙動追加なし、該当なし。

## Impact Review Lenses

not applicable — 実機観察起源だが、事実確認（drift の実在）は正本・formatter・両表示箇所の 4 点実読で完了しており、設計前提の変更を伴わない表示是正のため。operator workflow 影響は Goal そのもの（符号の業務的意味の可視化）。

## Design Readiness

- Existing design docs are sufficient because: UI-10-D10 / §73.6 が表現契約を明文化済み。
- Source docs updated in this PR: なし。
- Design gaps intentionally deferred: なし。
- Durable decisions discovered: なし。

Minimum design checks: Layer ownership 変更なし / backend 変更なし / DTO 変更なし / 永続化影響なし / operator 文言 = 符号付き数値（契約どおり）/ エラー系変更なし / traceability = REQ-205 token test。

## Contract Probe

N/A（R2、外部前提なし — drift は実コード 4 点実読で確認済み）。

## Contract Coverage Ledger

R2 につき N/A。

## Test Plan

- targeted tests: StocktakePage 結果画面 test（+N / -N 表示固定）、対象 file の vitest 実行。
- negative tests: なし（表示是正のみ）。
- compatibility checks: 90-traceability 再生成 drift 0。
- data safety checks: 該当なし。
- main wiring/integration checks: なし（既存 formatter の適用のみ）。

## Boundary / Wire Contract

not applicable — wire / DTO / API 変更なし。

## Review Focus

- 生値 `{item.difference}` → `formatListDifference(item.difference)` の変更が結果テーブルの差異 cell のみに閉じているか。
- test が正・負両方向の表示を固定し、既存 test を改変していないか。
- 進行中一覧側（既に準拠）への波及がないか。

## Spec Contract

R2 につき N/A。

## Trace Matrix

R2 につき N/A。

## Data Safety

- 該当なし（表示ロジックのみ、データ・fixture 変更なし）。

## Implementation Results

- `StocktakePage.tsx` 確定結果テーブルの差異 cell へ `formatListDifference` を適用（import 済み関数の適用 1 箇所、prettier 整形で 2 行化）。T21 新設（正 `+2` / 負 `-3` の表示固定 + 生値 `2` の不在 assert、既存 26 test 無改変）。
- 検証: 対象 file vitest 27/27 green / eslint / prettier / tsc clean / `generate_traceability --check` ERROR 0（REQ token 数不変のため再生成不要と実測確認）/ doc-consistency 全通過。
- mutation 感度: 生値表示へ戻した mutant で T21 のみ red（他 26 green）を Coordinator 実測、復元済み。
- 遷移記録（recording compression、gate skip なし）: plan-draft → plan-gate（packet commit `7a555b9`）→ plan-approved（owner が PR #74 comment round 2 で本是正を明示提案 + 「着手できるやつはやってしまおう」の標準承認。設計裁量ゼロの drift 是正）→ implementing → local-verified（上記検証 pass）。PR link は Review 後に記載。

## Review Response

- Plan Review skip 理由（R2 rounds 0-1 の 0 適用）: 是正方向は owner L3 実機観察（PR #74 comment round 2）+ Coordinator の正本・実装 4 点実読の二重独立確認で確定済みで、設計裁量が実質ゼロ（既存 formatter の適用のみ）。独立検証は Final Review（Sonnet）で実施する。
- Findings Freeze: frozen after Final Review; post-freeze exceptions: none.

### Final Review（独立 Sonnet、対象 = Reviewed Content HEAD `fb4fd1b`）: CLOSED（P1 = 0）

- 6 項目とも自前実測で確認 — 契約整合（73:213 実読、進行中一覧 :760 と結果画面 :910 が同一 formatter 共有）/ 変更閉じ込め（既存 T1〜T20 の削除行なし）/ T21 実効性（27/27 green、null 分岐到達不能を bindings 型 + 35-biz §20.5 5g で裏取り）/ **mutation 独立再実測**（生値 mutant で T21 のみ red、復元 clean 確認）/ packet 適合 / traceability drift 0。
- P2×1: Plans.md エントリの phase 表記が plan-draft のまま → 本 commit で human-confirm へ追随（accept）。
- P3×1: packet の節番号誤引用（§20.4 → 正 = §20.5 手順 5g、2 箇所 sweep）→ 本 commit で是正（accept。Coordinator も節構成 rg で独立確認）。
- 遷移記録: local-verified → independent-review（FR 従事）→ human-confirm（P1 = 0、P2/P3 は本 commit で解消。Reviewed Content HEAD = `fb4fd1b`、post-audit 差分は docs 表記のみ）。本遷移は content commit 同乗。次 = PR open → owner merge 承認（介入 1/1）。
