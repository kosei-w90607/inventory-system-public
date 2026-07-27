# Plan Packet: operation log 系 query key の共通 factory 収容（監査是正 順17 / P5-4、wave 1 lane 1）

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable 5（本 thread。wave 編成・packet 作成・レビュー裁定）
- Writer: Codex（owner relay 発注。plan-approved 後の単独 writer）
- Plan Reviewer: Sonnet 5 fresh context（Coordinator が subagent として起動し、findings を Coordinator が裁定）
- Final Reviewer: Sonnet 5 fresh context（同上、Plan Reviewer とは別 context）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Ready 承認（wave batch 可）/ merge。視認・L3 なし（挙動不変 refactor で画面変更を含まない）

Narrative（append-only）:

- 2026-07-28 plan-draft -> plan-gate: packet + Test Design Matrix を wave 1 scaffolding として main 上に commit（D-055 Wave Operation）。lane branch `agent/oplog-query-key-factory` はこの commit 以降の main から分岐する。wave 編成と lane 状態の正本は `Plans.md` `Wave Registry`。
- 2026-07-28 plan-gate round 1（Sonnet 独立 fresh context）: P1×1 = Workflow State の必須 field 7 点欠落（DEV_WORKFLOW :75-86 の field 定義と順8 先行 packet の precedent を Coordinator が独立実読し CONFIRMED。両 lane 系統的、fail-closed 条項該当）/ P2×1 = Matrix C4/X3 の実質防御（既存 `d052InvalidationOracle` 厳密一致）が非明記で literal sweep 単独充足と誤認するリスク / P3×1 = D-052-E1 の語義重複（scope 外、backlog 記録で処置）。P1/P2 accept・in place 是正（field 補完・C4/X3 是正）、P3 は Plans.md backlog へ記録。Phase は plan-gate のまま round 2 で再検査。

## Owner Effort Budget

- D-038 既定: 介入 ≤3 / hands-on ≤30 分 / relay ≤2。wave batch 承認は decision point 単位で本 lane に個別計上する（D-055）
- 現況: 介入 0/3

## Risk

Risk: R3

- 理由: production の query cache key 契約に触れる。key の typo・segment 変更は cache 分断・stale 表示として顕在化し、既存 RTL test が key 文字列を検証していない（2026-07-28 事前調査で 0 hit 実測）ため既存 gate では検出不能。監査是正 順6〜9 と同格の R3 精査を維持する（wave pilot でも検査の深さは薄めない、D-055 pilot 条項の owner 決定）
- rollback: revert 1 commit。key 実文字列が不変のため cache 互換で、DB・永続データへの影響なし

## Goal

Goal Invariant: operation log domain の 3 query key（`["settings","logOperationTypes"]` / `["settings","logs",<search>]` / `["settings","integrity","latest-check"]`）が `src/lib/query-keys.ts` の共通 factory に収容され、page 内 literal 直書きが 0 になり、query-keys.ts の「直書き禁止」規範が期限付き例外なしで成立する。**key の実文字列と invalidation 意味論（当該 key は invalidate 対象外のまま）は一切変えない。**

### 最小完了条件

- `queryKeys` に operation log domain の factory が追加され、`OperationLogsPage.tsx`（2 key）と `IntegrityCheckPage.tsx`（1 key）が factory 経由になる
- 上記 3 key の literal 直書きの live hit が 0（factory 本体と独立転記 oracle test を除く）
- `src/lib/query-keys.ts` の D-052-E1 期限付き例外コメント（「P5-4 で収容までの現状維持」）が撤去される
- `docs/function-design/74-ui-operation-logs.md` の literal key 設計記述が factory 契約表記へ同期される
- key 文字列を独立転記 oracle で固定する契約 test と、literal 再導入防止 sweep test が green

### 失敗定義

- key 実文字列の変更（segment の追加・削除・改名・順序変更・引数透過の変質）
- invalidation 対象の拡大・縮小（`invalidation-contract.ts` への当該 key の追加、latest-check の invalidate 化 = PR #21 裁定の逆転）
- 他 domain key の再編への scope 拡大

### 非目的

- P5b-1（棚卸し確定の横断 invalidation 欠落）の是正 — 別是正単位
- 順15（OperationLogsPage を触る他の是正）— 同一 file 干渉 pair のため本 wave に同居させない（report.md 干渉 matrix）
- invalidation 契約・fetch option（staleTime 等）の機能変更

## Scope

予定 file footprint（wave の互いに素条件の証明対象。lane 2 との共有 file なし、生成 file 再生成なし）:

- `src/lib/query-keys.ts` — operation log domain factory 追加 + D-052-E1 例外コメント（現 HEAD :8-9）撤去
- `src/features/operation-logs/OperationLogsPage.tsx` — literal 2 箇所（現 HEAD 実測 :239 / :250。監査時 :155-:167 から PR #23 由来のドリフトあり、再ロケート済み）の factory 置換
- `src/features/integrity-check/IntegrityCheckPage.tsx` — literal 1 箇所（現 HEAD 実測 :75）の factory 置換
- `docs/function-design/74-ui-operation-logs.md` — literal key 記述（現 HEAD :60 / :286）の factory 表記同期
- `docs/function-design/75-ui-integrity-check.md` — :46 の D-052-E1 参照文が literal 例外を前提とする場合のみ文言同期（invalidate 対象外の意味論は不変のまま）
- 新規 test（`src/lib/` 配下）: query key 契約 oracle test + literal 再導入防止 sweep test
- 本 packet / Test Design Matrix

## Non-scope

- `src/lib/invalidation-contract.ts` — 変更禁止（失敗定義と対応）
- 既存 18 domain の factory 本体
- backend / IPC / DTO / bindings（対象外変更のため再生成不要）
- OperationLogsPage 内の本 packet 対象 2 key 以外の行（順15 の領分）

## Acceptance Criteria

- `npm test`（vitest）で契約 oracle test green: 期待 key を test 内に独立転記（production 定数から導出しない）し、factory 出力と `toEqual` 完全一致比較。search 引数の透過も含む
- sweep test green: `src/` 配下の当該 key literal を検索し、許容 list（query-keys.ts + oracle test）以外で hit 0
- `rg -c 'D-052-E1' src/lib/query-keys.ts` が 0（例外コメント撤去）、かつ「直書き禁止」規範文言は残存
- `docs/function-design/74-ui-operation-logs.md` の該当箇所が factory 表記になっている（Matrix anchor で機械確認）
- 既存 `OperationLogsPage.test.tsx` / `IntegrityCheckPage.test.tsx` green 維持
- frontend gate（typecheck / lint / format / test / build）PASS、`bash scripts/local-ci.sh full` CLEAN（L1）
- Matrix の mutation 実測: commit 済み clean tree で注入 → red → 復元 → green を各 X で実施し（各回 `git status` clean 確認）、PR body に記録

## Design Sources

- `docs/UI_TECH_STACK.md` の query key / invalidation 方針（mutation 成功時の影響 entity 明示列挙）
- `docs/function-design/74-ui-operation-logs.md` / `docs/function-design/75-ui-integrity-check.md`
- `src/lib/query-keys.ts` ヘッダ規範（:1-10）
- 監査 finding: `docs/research/audit-2026-07/findings/p5-state-query.md` P5-4
- 先行裁定: PR #21 = latest-check は invalidate 対象から一律除外（`docs/archive/plans/2026-07-22-mutation-consumer-query-contract.md:58`）。本 packet はこの裁定を維持する

## Required Design Artifacts

- 新規設計 doc 不要。74/75 の同期は本 Scope 内で実施する

## Registration / Generation Obligations

- 新規 command / route / REQ / 画面: なし。新規 test file は vitest の自動収集対象（追加登録不要）。bindings / traceability 再生成: 不要（対象外変更）

## Design Intent Trace

| Source | Decision | Target | Test |
|---|---|---|---|
| P5-4 提案方向 | 3 key を共通 factory に収容 | query-keys.ts + 2 page | Matrix C1/C2/C3 |
| query-keys.ts 規範（直書き禁止） | 例外撤去で規範を無例外化 | query-keys.ts :8-9 | Matrix C5 |
| PR #21 裁定 | latest-check の invalidate 除外を維持 | invalidation-contract.ts 非変更 | Matrix C4 |
| 74 §74.12 / 75 :46 | 設計 doc を factory 契約表記へ同期 | 74/75 doc | Matrix C6 |

## Design Intent Audit

- 棄却代替案: (1) literal 維持 + lint rule のみ追加 — 規範と設計 doc の矛盾（P5-4 指摘の本体）が残る。(2) invalidation-contract への同時編入 — PR #21 裁定の再開封であり非目的。(3) 3 key の改名を伴う再設計 — cache 互換を壊し S 是正の範囲を超える
- Deferred design gaps: なし

## Impact Review Lenses

- operator 可視の挙動変化: なし（key 文字列不変 = fetch / cache 挙動不変）。画面変更を含まないため Human Visual Confirmation 対象外

## Design Readiness

- Existing design docs are sufficient because: 変更は literal → factory の等価収容で新規契約を作らない。対象座標は 2026-07-28 の現 HEAD 実測（file:line、監査時ドリフトの再ロケート込み）で閉じており、74/75 と UI_TECH_STACK の現行記述が同期先として確定している

## Contract Probe

- 引数付き factory の既存 precedent: `queryKeys.stocktake.departments()` 等、parameterized 含む 18 domain が既存 factory に実在（2026-07-28 実読）→ 収容 pattern は既存慣用のまま書ける
- 既存 RTL test の検出力: 両 page の test は `queryKey` / literal key 文字列への参照 0 件（2026-07-28 rg 実測）→ 契約 oracle test 新設が必要という Test Plan 前提を実証
- 横断 literal 残存: 当該 3 key の literal は 2 file 以外に repo 残存なし（2026-07-28 rg 横断実測）→ Scope の閉包を実証

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| C1 key 文字列不変（3 tuple + 引数透過） | query-keys.ts 新 factory | oracle test（独立転記・完全一致） | non-scope |
| C2 literal 再導入防止 | sweep test | static sweep test（許容 list 明示） | non-scope |
| C3 page 配線（factory 経由） | 2 page | sweep（page 内 literal 0）+ typecheck | non-scope |
| C4 invalidation 意味論不変 | invalidation-contract.ts 非変更 | sweep（当該 key の contract 内 hit 0 維持） | non-scope |
| C5 例外コメント撤去・規範無例外化 | query-keys.ts | Matrix anchor M-A1/M-A2 | non-scope |
| C6 設計 doc 同期 | 74/75 doc | Matrix anchor M-A3/M-A4 | non-scope |

## Test Plan

- Test Design Matrix: [test-matrices/2026-07-28-oplog-query-key-factory.md](test-matrices/2026-07-28-oplog-query-key-factory.md)
- oracle 独立性規律: 期待値は production 定数・factory から導出せず test 内に独立転記し、完全一致比較する
- mutation 実測は commit 済み clean tree 限定（注入 → red → 復元 → green、各回 clean 確認）
- anchor は固定前に rg -c で一意性を確認し、定義文 literal へ特定化する

## Boundary / Wire Contract

- IPC / DTO / wire 変更なし。frontend 内 refactor のみ

## Review Focus

- 3 tuple × 各 segment の 1 文字単位の同一性（oracle の転記精度を含む）
- search 引数の透過性（`effectiveSearch` の正規化タイミングが factory 化で変質しないか）
- invalidation-contract.ts が diff に含まれないこと
- oracle test が factory から期待値を導出していないこと（SSOT 共有の自壊防止）
- sweep の許容 list が明示列挙のみで、glob 過剰除外による fail-open がないこと

## Spec Contract

- 対象: UI_TECH_STACK の query key 管理規範（production query は共通 factory 経由）+ 74 §74.12 / 75 の画面設計記述
- REQ 影響: なし（機能・挙動不変の収容）。traceability 再生成不要

## Trace Matrix

| 設計正本 | 実装 | Test |
|---|---|---|
| UI_TECH_STACK query key 規範 | query-keys.ts | Matrix C1/C2/C5 |
| 74 §74.12 | OperationLogsPage.tsx | Matrix C3/C6 |
| 75 latest-check 記述 | IntegrityCheckPage.tsx | Matrix C3/C4/C6 |

## Data Safety

- 永続データ・DB・file I/O への影響なし。key 実文字列不変のため runtime cache も互換。backup / restore 経路に非接触

## Implementation Results

（実装時に追記）

## Review Response

- Findings Freeze: not-yet（Final Review closure で発効）
