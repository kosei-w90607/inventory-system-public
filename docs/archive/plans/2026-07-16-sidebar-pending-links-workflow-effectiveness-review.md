# Workflow Effectiveness Review: サイドバー pending 2 項目の解消（UI-01b + UI-06b、Public PR #9）

## Workflow Used

- Plan Packet / Test Design Matrix: [packet](2026-07-16-sidebar-pending-links.md) / [matrix](test-matrices/2026-07-16-sidebar-pending-links.md)
- 体制: Codex 発注 relay（owner コピペ実行）+ Fable Coordinator 裁定
- review: 独立 Sonnet Plan Review（一巡目 P2×5 / P3×3 → 是正 → targeted 再レビュー 8/8 resolved）、独立 Final Review（R3 Contract Audit、Ledger 全 4 行 pass）
- gates: Contract Probe（plan 段階）、L1 full、hosted CI、owner L3
- dogfood: UI-13 起源の登録・生成義務 checklist（`docs/templates/plan-packet.md` 常設化後の初適用）

## What Worked

- UI-13 起源の登録・生成義務 checklist が本 change の性質そのもの（nav 到達導線の繋ぎ忘れ 2 件が今回の解消対象）を事前に構造化でき、Amendment 0 件で完走した（UI-13 は同種の列挙漏れで Amendment 4 件）。
- 独立 Plan Review が実装前に設計の穴（`SidebarLink` の排他判定機構が未規定だった点 → `activeMatch` のデータ駆動化）を P2 で検出し、実装後の手戻りがゼロだった。
- Codex 発注 relay は 1 往復（上限 2）、owner 介入は 2 回（予算 3 回）で Budget 内完走。cwd pin（memory `project-codex-launch-directory-pitfall` 起源）により発注事故なし。
- 受け入れ検分での drift 是正が「19 項目」表記の repo 横断退治として機能した（`52-ui-shared-layout.md` §52.3 冒頭表記 + `SCREEN_DESIGN.md` 2026-05-08 注記の 2 箇所を同一 content commit で一括是正）。

## What Did Not Work

- 「項目数・件数を prose に転記する」書き方自体が恒常的な drift 源になっている。今回検出した「19 項目」表記は `navigation.ts` コメント / `52-ui-shared-layout.md` / `SCREEN_DESIGN.md` / 過去の packet 草稿 / matrix 草稿の 5 箇所で独立に陳腐化していた。D-038 Evidence Ownership（volatile な証跡は転記せず参照する）の思想を「設計 doc 内の可変 count の prose 転記」にも拡張する規範が必要 — 今回 `SCREEN_DESIGN.md` 側は「転記しない」書き方に是正済みで、これを先行事例として記録する。
- L3 実施時、Windows native clone の `git remote` origin が旧 private repo を指したままだったため 1 往復の手戻りが発生した（D-040 の 2 clone 体制の Windows 側が public 移行に追随していなかった）。`DEV_SETUP_CHECKLIST.md` §4.6 の L3 同期手順に origin 確認の 1 行を本 closeout で追記した。

## Issues Caught Before Implementation

- 独立 Plan Review 一巡目 P2（5 件）のうち、`SidebarLink` の排他 active 判定機構が Scope に未規定だった点を検出。是正で `NavItem.activeMatch` のデータ駆動設計（UI-12-D1）を Scope 化し、component 内へのルート文字列ハードコード禁止という汎用性契約も同時に固定した。
- Plan Review の P3 未満メモ（`search.status` と `activeMatch.is` の `"low_stock"` 値重複が将来ズレるリスク）は Scope 化せず Review Focus の既存観点で実装レビュー時に確認する運用とした。最終的に Final Review で P3-1 として再検出され backlog 化（下記）。

## Issues Caught by Tests

- 該当なし（Amendment 0 件。テストが実装中に不具合を単独で検出した記録はない）。ただし Test Design Matrix の Mutation-style Adequacy Questions（5 問）が正逆双方向テストの検出力を実装前に裏取りしており、`SidebarLink.test.tsx` の正逆両方向 + 複合 search param テストは Contract Coverage Ledger 全 4 行の自動検証手段として機能した。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| `navigation.ts` の `"low_stock"` が `search.status` と `activeMatch.is` に二重記述（SSOT 定数なし） | evidence quality（本 PR diff 外の恒久対処） | accept・non-blocker。`navigation.test.ts` の `toMatchObject` が両 field を固定し回帰は CI 検出可能。`LOW_STOCK_FILTER_VALUE` 定数化を Plans.md backlog へ |
| sidebar リンクの focus-visible styling 不足 | evidence quality（既存 gap、回帰ではない） | accept・non-blocker。a11y polish として Plans.md backlog へ |

## Issues Caught by L3 / Owner / 実 Operator

- 該当なし。owner L3（商品登録 到達・active / 在庫照会 単独 active / 在庫少一覧 low_stock 反映・単独 active / 往復切替、Windows native）は初回で全 PASS。UI-13 で発覚した navigation 導線 disabled 残置（Amendment 4）と同型の failure class を、本 change では checklist が事前に潰していたことの実証。

## Escaped / Late Findings

- 現時点でなし（merge 後の escape 報告なし）。

## Test Adequacy

Strong tests:

- `SidebarLink.test.tsx` の排他 active 正逆両方向テスト + 複合 search param テスト（`status=low_stock&q=毛糸`）が UI-12-D1 の判定ロジック反転を機械的に検出できることを Mutation-style Adequacy Questions で裏取り済み。
- `navigation.test.ts` の pending 0 件回帰テストが D-047（`/stock/low` 非新設）を全 20 項目監査で担保。

Weak or missing tests:

- SSOT 定数未整備（P3-1）による二重記述は `toMatchObject` の固定値一致でのみ回帰検出でき、値そのものの単一情報源保証はテストでは表現できていない。
- focus-visible styling（P3-2）は自動テスト圏外、a11y polish backlog として扱う。

## Signal / Noise

- sub-agent findings total: 2（Final Review P3 のみ）
- accepted: 2（いずれも non-blocker・backlog 化）
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- useful cost: 独立 Plan Review（P2 検出で activeMatch 設計を事前確定）、Contract Probe、独立 Final Review + Contract Audit、owner L3。いずれも具体的欠陥の発見か契約の実証に直結。
- excessive friction: Windows native clone の origin 未移行による 1 往復（本 closeout で手順書是正）。
- owner 実働: 介入 2 / 予算 3、relay 1 / 上限 2。予算に対して余裕を残して完走。

## Retired / Consolidated Rules

- retire: なし（本 change で退役させた規範なし）。
- consolidate 候補: 「可変 count の prose 転記禁止」を D-038 Evidence Ownership の拡張として次の workflow docs PR で規範化を検討する。本 WER では候補記録に留め、規範化は行わない。

## Recommended Workflow Adjustment

Keep:

- 登録・生成義務 checklist の Plan Packet 常設運用（Amendment 0 件で実証済み）。
- 独立 Plan Review による実装前設計穴の検出と、承認カウンタ付き Owner Effort Budget の運用。

Change:

- `DEV_SETUP_CHECKLIST.md` §4.6 の L3 同期手順に Windows clone origin 確認を追記（本 closeout で実施済み）。

Follow-up:

- D-038 Evidence Ownership を「設計 doc 内の可変 count の prose 転記」へ拡張する規範化（次の workflow docs PR で判断）。
- `52-ui-shared-layout.md` §52.3 ルーティング表の URL 陳腐化是正（`/pos/*` 表記 vs 実 route、本 PR closeout 起源、backlog）。
- `low_stock` filter 値の SSOT 定数化、sidebar リンクの focus-visible styling（Plans.md backlog 済み）。

## Applied / Deferred Workflow Changes

Applied:

- `DEV_SETUP_CHECKLIST.md` §4.6 への Windows clone origin 確認の追記（本 closeout commit）。

Deferred:

- D-038 拡張（可変 count の prose 転記禁止）の規範化は次の workflow docs PR で判断する。
