# Test Design Matrix: D-045 follow-up workflow guards

## Risk

Risk: R3

## Contracts Under Test

- D-046-1: 承認接点のカウンタ + 利用者可視完了1文（template / 規範 token）
- D-046-3: STATECAP forward 限定 + `state-backtrack` subject 除外 + cap 回避防止
- D-046-4: WER `## Retired / Consolidated Rules` 必須（新規 WER のみ、WARN）
- D-046-6: packet Goal Invariant 構造（最小完了条件 / 失敗定義 / 非目的、WARN）
- 既存互換: 既存 archived 文書・既存 STATECAP forward 挙動の不変

## Failure Modes

- checker が新構造の欠落を検知しない（WARN が出ない）
- checker が既存 archived 文書へ遡及して偽陽性 WARN を出す
- backtrack subject が forward cap にカウントされ、正当補正が ERROR で阻まれる
- forward 遷移のみの commit を `state-backtrack` subject に偽装して cap を回避できる
- template 改訂が PK1/PK2/PK4 の既存検査を壊す
- 規範 token（Review Rules 三分類、4項目、one-shot 様式、D-046）が drift する

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| D-046-6 | Goal Invariant 欠落を見逃す / 遡及偽陽性 | CLI (drift test) | T1 goal-invariant-warn 両方向 | 新規 packet の欠落で WARN が出ない、または既存 archived packet に WARN が出る |
| D-046-1 | template から カウンタ欄が欠落 | schema (token) | T2 approval-counter-token | plan-packet template / DEV_WORKFLOW Draft PR Checkpoint から「介入」「予算」token が消える |
| D-046-3 | 正当 backtrack が cap で ERROR | CLI (drift test) | T3 statecap-backtrack-exempt | forward 3 + `state-backtrack` 1 の履歴で check-workflow-git.sh が fail する |
| D-046-3 | cap 回避 | CLI (drift test) | T4 statecap-backtrack-evasion | forward 遷移のみを含む `state-backtrack` subject が ERROR にならない |
| D-046-4 | Retired 節欠落を見逃す / 遡及偽陽性 | CLI (drift test) | T5 wer-retired-warn 両方向 | 新規日付 WER の欠落で WARN が出ない、または既存 WER に WARN が出る |
| 規範 token | 規範 drift | CLI (drift test) | T6 d046-norm-tokens | DEV_WORKFLOW の三分類 / 4項目 / goal-drift signal / one-shot 参照、decision-log の D-046 のいずれかの token が消える |
| 既存互換 | 既存検査の破壊 | integration | T7 checker-self-pass | `bash scripts/doc-consistency-check.sh` が本 PR の tree で ERROR 0 で通らない |

## State Lifecycle Matrix

workflow-state changes 該当分のみ。UI / data / cache 非接触のため他行は not applicable。

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| content candidate -> L1 / independent review -> state-only human-confirm commit | 現行どおり | — | 現行どおり（本 change で不変） | — | — | — | — | — | — | T7 |
| owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge | 現行どおり | — | 現行どおり（本 change で不変） | — | — | — | — | — | — | T7 |
| state-only violation（allowlist + hunk 検査） | 現行どおり | — | 現行どおり | — | — | — | — | 検出 = implementing へ戻る | — | 既存検査（本 change で不変） |
| 正当 backtrack（correction で早期 phase へ） | forward cap 3 に阻まれうる（現行） | `state-backtrack` subject で記録 | cap 対象外で PASS | — | — | resume は packet Phase から冪等 | — | forward-only 偽装は ERROR | — | T3 / T4 |
| hosted-not-required incidental failure | 現行どおり | — | 現行どおり | — | — | — | — | — | — | 既存検査 |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| canonical state-only subject（`docs(plans): state-only遷移 <from>-><to>`）の token 判定 | scripts/check-workflow-git.sh `check_state_only_commit_cap` / DEV_WORKFLOW 118行 / templates | `state-backtrack` subject を同形式で追加 | pre-push / local-ci の呼出し口は変更しない（検査本体のみ改訂） | T3 / T4 |
| 新規文書のみ対象の日付 prefix 判定 | doc-consistency-check.sh の Evidence Ownership 系日付判定（2026-07-12 以降限定の前例） | WER Retired 検査（2026-07-15 以降）/ Goal Invariant 検査（新規 packet） | archived ディレクトリは対象外 | T1 / T5 |
| WARN 開始で導入し運用後に ERROR 昇格を検討 | slice 2「no-active-plan check（WARN から）」前例 | T1 / T5 の両 check | — | drift test で WARN 文字列を検証 |

## Negative Paths

- missing input: Goal 節はあるが「最小完了条件」小見出しがない packet → T1 WARN
- invalid input: `state-backtrack` subject に forward 遷移 token のみ → T4 ERROR
- duplicate/ambiguous input: active packet 複数の既存 fail-closed は不変（T7 で既存検査が生きていることを確認）
- unknown reference: not applicable
- dependency missing: rg / bash のみ使用、新規依存なし
- permission/write failure: not applicable（checker は read-only）
- dry-run side effect: checker / git 検査は読取専用（副作用なし、既存性質を維持）

## Boundary Checks

- threshold: STATECAP forward cap = 3 は不変。backtrack は cap 非対象（0 でも n 個でも PASS、ただし T4 の偽装は ERROR）
- null/default: `Amendments: none` の既存挙動不変
- empty/non-empty: Retired 節が存在するが空 → WARN（placeholder 検出は PK2 前例に合わせる）
- status/policy enum: Phase enum / Execution Mode 3値は不変（PK4 非接触を T7 で確認）
- その他（wire type / precision / cross-language 等）: not applicable（repo 内 bash 契約のみ）

## Compatibility Checks

- old schema/input: 既存 archived packet / WER に新 WARN が出ない（T1 / T5 の遡及なし側）
- new schema/input: 本 packet 自身が Goal Invariant 構造で PASS（自己 dogfood）
- output order: checker の出力順序は既存 PK 番号順を維持
- optional field behavior: Goal Invariant / Retired 節は新規文書にのみ要求（WARN）、既存文書は optional のまま

## Data Safety Checks

- source-derived data: 非接触
- generated outputs: 非接触
- secrets: 非接触
- local-only files: 非接触
- synthetic sample boundaries: drift test の fixture は合成 subject 文字列のみ使用

## Main Wiring / Integration Checks

- helper connected to main path: 新 drift test が `scripts/tests/` に置かれ local-ci が実行する
- output reaches manifest/report: checker の WARN/ERROR カウンタに新 check が加算される
- effective config reaches runtime: pre-push / local-ci が改訂版 check-workflow-git.sh を呼ぶ（呼出し口不変を確認）
- CLI arg reaches implementation: not applicable

## Mutation-style Adequacy Questions

- If a guard is removed（backtrack 除外を消す）: T3 が fail する。
- If a key branch is inverted（forward-only 偽装を PASS にする）: T4 が fail する。
- If a threshold comparison changes（forward cap 3→4）: 既存 STATECAP drift test が fail する（本 change で維持）。
- If an output field is omitted（WARN 文言から check 名が消える）: T1 / T5 の文字列 assertion が fail する。
- If tracked Workflow State stores the current PR HEAD: 既存設計どおり PR metadata に保持（本 change 非接触、T7）。
- If a state-only commit edits Scope/AC in the same packet file: 既存 hunk 検査が拒否（本 change 非接触）。
- 残り（mock / invalidate / JSON range / round-trip / dry-run / output order）: not applicable — UI / data / wire 非接触。

## Residual Test Gaps

- 承認依頼カウンタの会話上の運用（PR body 外）は機械検査不能 — 本 PR と UI-13 の手動 dogfood で観察し、WER で評価する。
- goal-drift signal 停止手順（D-046-8）は発動条件が実地のため drift test 対象外 — token 存在（T6）のみ。
- one-shot irreversible 様式の実効性は次回の不可逆作業まで検証不能（dogfood target として明示）。
