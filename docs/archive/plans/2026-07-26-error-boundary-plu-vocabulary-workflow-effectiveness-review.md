# Workflow Effectiveness Review — 監査是正 順8: error 境界 + PLU 語彙

## Workflow Used

- R3 / Execution Mode: fable-window（初適用）。Coordinator = Fable 5（scope 精査・Design
  Phase・packet・裁定）、Writer = Codex（owner relay 発注 2 回）、Plan Reviewer /
  Final Reviewer = Sonnet 5 fresh context（Fable が subagent 起動・裁定）。
- plan-first content commit（design 正本化 + packet + Matrix 同梱）→ Plan Review 3 round
  → owner Plan 承認 → Codex 実装 → Final Review（Contract Audit + mutation 独立再実測、
  worktree 隔離）2 round → 視認 + Ready → hosted final 三点一致 → merge。
- owner 介入 3/3（Plan 承認 / 視認+Ready / merge）、relay 2/2（実装発注 / P2 追発注）で
  予算内完走。scope 裁定（UI 直接表示 約15 箇所の除外）は着手前に owner 裁定を取得。

## What Worked

- **Plan Review が実装前に P1 を捕捉**: restore_* 3 kind を実際に発生させる唯一の画面が
  error_id を表示しない配線ギャップ。AC・視認 gate では素通りする構造まで指摘された。
- **主張と修正方向の分離裁定**: P1 の指摘自体は accept しつつ、reviewer の修正案
  （describeError 置換）は 68 §68.7 の確定済み recovery 設計を壊すため差し替え、
  「文言維持 + error_id 別要素併記」へ裁定。`claude-codex-review-loop` の判断軸が
  subagent レビューでも機能した。
- **mutation 独立再実測**: Final Reviewer が X1〜X8 全件を clean tree に実注入して red を
  再実測（writer 記録の転記なし）。`feedback-mutation-kill-claims-need-reproduction` の
  運用が worktree 隔離 subagent でそのまま成立した。
- **同一 reviewer context の差分再レビュー**: 是正 round を fresh 起動し直さず SendMessage
  継続にしたことで、3 round の plan rally と 2 round の final review が低コストで収束。

## What Did Not Work

- plan-first commit を main に直接積み、branch へ載せ替える手戻りが発生
  （memory `branch-before-plan-first-commit` に保存済み）。
- Plan Review P1 の是正時、packet 内 4 セクション（Boundary / Wire Contract・Spec
  Contract・Design Intent Trace・Review Focus）の追随を落とし、再レビューで P2
  （packet 自己矛盾）を招いた。契約文言の drift 一括修正は「同一 packet 内」にも適用が要る。
- Writer の新規 test の REQ タグ誤記（REQ-402/REQ-401）が `generate_traceability` の
  literal scan を通じて生成 SSOT `90-traceability.md` を silent 汚染。`--check` は
  presence のみ検査するため機械検出されなかった（Final Review が捕捉）。

## Issues Caught Before Implementation

- P1: restore_* error_id の画面配線ギャップ（Plan Review 一次）。
- P3: `CmdError` struct literal 16 箇所 + `BizError` Display arm の機械追随の scope 漏れ、
  41-cmd-pos DatabaseError 行の error_id 不整合、error_id の DOM 配置未規定。
- P2: 是正で生じた packet 内自己矛盾（再レビュー）。

## Issues Caught by Tests

- 実装フェーズの回帰は Writer 側 gate（cargo / vitest / 生成系）内で消化され、
  レビューへ漏れた test 起因の欠陥は 0。

## Issues Caught by Review-only Sub-agent

- Final Review 一次 P2: REQ タグ誤記による traceability 汚染（実装・契約は全 clean、
  Contract Audit 10 項目 + X1〜X8 再実測で他指摘なし）。

## Issues Caught by External Review

- なし（Codex は Writer として参加。外部 review round は未使用）。

## Escaped / Late Findings

- なし（merge 時点）。残存リスクとして `restore_failed_recovered` の既存 message==detail
  raw text を記録（本 PR 非接触、follow-up は Plans.md）。

## Test Adequacy

- X1〜X8 の全 mutation が指定 test 単位で red（独立再実測）。oracle は期待文言・
  error_id regex とも独立転記で、production 定数 import なし（tautology なし）。
- 静的 sweep（ローカル describeError 再導入 / internal raw-detail 混入）を lint でなく
  test 化したことで X7 が mutation 検証可能になった。
- 残ギャップは Matrix 記載どおり（error_id 厳密一意性・日次ローテ跨ぎ検索性は許容済み）。

## Signal / Noise

- reviewer findings 7 件（plan 5 + final 2）全て accept（うち 1 件は修正方向差し替え）。
  noise 0。subagent への targeted 観点指定 + file 全文 dump 禁止の発注書式が寄与。

## Cost / Friction

- plan rally 3 round + final 2 round はいずれも差分確認で軽量。最重量は Final Review の
  mutation 再実測（意図的な投資、O(10) 分）。
- push 毎の Plans.md 同期 hook で dashboard commit が細かく増えた（実害なし、微摩擦）。

## Recommended Workflow Adjustment

- **REQ タグの domain 整合検査**（起票のみ、採否は次回裁定）: `generate_traceability` の
  literal scan は REQ 番号の誤記をそのまま SSOT へ転写する。test path ↔ REQ 番号の
  domain 対応（feature dir 単位）を checker で警告する案。発動条件事実 = 順8 で 1 回
  実発生し Final Review でのみ捕捉。機械化コスト対効果は再発時に再評価。
- packet 是正時の「同一 packet 内 drift 一括修正」は既存 drift-fix 判断軸の適用面拡張で
  あり、新規 rule は起こさない（`claude-codex-review-loop` の運用に含める）。

## Retired / Consolidated Rules

- なし。

## Applied / Deferred Workflow Changes

- Applied: fable-window mode の役割分担（Fable 裁定 + Sonnet fresh review + Codex writer）を
  本 change で初運用し、そのまま次の順9 でも使う。
- Deferred: REQ タグ domain 整合検査（上記。再発時に採否裁定）。
- Follow-up（workflow 外・製品側、Plans.md 記録）: raw message 直接表示 約15 箇所の
  共通 describeError 化 / `restore_failed_recovered` raw text の CMD-ERR-D2 整合。
