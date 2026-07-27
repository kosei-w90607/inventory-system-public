# Plan Packet: 動的 SQL placeholder の既存慣用統一（監査是正 順22 / P7-2、wave 1 lane 2）

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

- 2026-07-28 plan-draft -> plan-gate: packet + Test Design Matrix を wave 1 scaffolding として main 上に commit（D-055 Wave Operation）。lane branch `agent/sql-placeholder-idiom` はこの commit 以降の main から分岐する。wave 編成と lane 状態の正本は `Plans.md` `Wave Registry`。
- 2026-07-28 plan-gate round 1（Sonnet 独立 fresh context）: P1×1 = Matrix F3/X4 が実在しない機構（pagination placeholder）への mutation 設計 — LIMIT/OFFSET は両 fn とも format! literal 埋め込みと Coordinator が独立実測し CONFIRMED / P2×1 = C4 の「必要なら」裁量表現が Goal Invariant「全 filter 組合せ」と内部矛盾。全 2 件 accept、in place 是正（F3 撤回注記・X4 撤去・C4 の dept×counted=false 必須化・Review Focus 同期）。Phase は plan-gate のまま round 2 で再検査。
- 2026-07-28 cross-lane 是正: lane 1 の plan-gate round 1 P1（Workflow State 必須 field 7 点欠落、DEV_WORKFLOW :75-86）が wave 1 scaffolding の系統的欠落と判明したため、本 packet にも同一是正（field 補完）を適用。round 2 で再検査。

## Owner Effort Budget

- D-038 既定: 介入 ≤3 / hands-on ≤30 分 / relay ≤2。wave batch 承認は decision point 単位で本 lane に個別計上する（D-055）
- 現況: 介入 0/3

## Risk

Risk: R3

- 理由: production の検索 query（商品検索・棚卸し明細）の SQL 生成に触れる。placeholder と bind 値の対応ずれは誤った filter 結果または実行時 bind error として顕在化する。既存 test は単一 filter 中心（product 側に組合せ oracle なし、2026-07-28 事前調査）で、対応ずれを踏み抜く検出力が不足。監査是正 順6〜9 と同格の R3 精査を維持する（wave pilot でも検査の深さは薄めない、D-055 pilot 条項の owner 決定）
- rollback: revert 1 commit。SELECT 経路のみで永続データ影響なし

## Goal

Goal Invariant: `product_repo.rs` `search_products` と `stocktake_repo.rs` `list_stocktake_items` の動的 SQL 生成が、repository 既存慣用（`params.len() + 1` から placeholder 番号を導出、独立 counter なし）に統一され、手動 `param_idx` counter と `let _ = param_idx` dummy read が `src-tauri/src/db/` 配下から 0 になる。**全 filter 組合せで結果集合と bind 対応は不変。公開 fn シグネチャも不変。**

### 最小完了条件

- 両 fn の placeholder 導出が `params.len() + 1` 慣用に統一され、`param_idx` が全廃される
- filter 組合せの挙動固定 test（product 側の組合せ gap を埋める新規 case 含む）が green で、placeholder ずれの mutation を検出できる
- 既存 unit test suite が green を維持する

### 失敗定義

- 結果集合の変化（いずれかの filter 組合せで返る行が refactor 前と異なる）
- 実行時 bind error（placeholder 番号と params 数の不一致）
- 公開 fn シグネチャ・呼び出し元（BIZ/CMD）への波及
- filter の追加・削除・意味変更（機能変更は本 packet の対象外）

### 非目的

- 既に慣用側にある repo（return / inventory / disposal / receiving）の変更
- 検索機能の仕様変更（filter 追加、sort / pagination 変更）
- 順13 / 順14（bindings 生成物系）— 別 lane 領分

## Scope

予定 file footprint（wave の互いに素条件の証明対象。lane 1 との共有 file なし、生成 file 再生成なし = DTO / bindings 不変）:

- `src-tauri/src/db/product_repo.rs` — `search_products`（現 HEAD 実測 :586-:624。手動 counter :602、dummy read :623）の慣用統一 + filter 組合せ test の追加（同 file 内 inline test）
- `src-tauri/src/db/stocktake_repo.rs` — `list_stocktake_items`（現 HEAD 実測 :461-:495。手動 counter :480、dummy read :495。param を追加しない固定条件 filter `counted_only` を含む）の慣用統一
- 本 packet / Test Design Matrix

## Non-scope

- `src-tauri/src/db/` の他 repo file（既存慣用側 4 file を含む）
- BIZ 層（`product_service.rs` :381 / `stocktake_service.rs` :95）・CMD 層（`product_cmd.rs` :60 / `stocktake_cmd.rs` :63）— シグネチャ不変のため非接触
- SQL の機能面（WHERE 句の条件式そのもの、sort、pagination 上限）

## Acceptance Criteria

- `rg -c 'param_idx' src-tauri/src/db/` の hit が 0（dummy read `let _ = param_idx` の消滅を包含）
- `cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test` PASS — dummy read なしで clippy green になること自体が慣用化の構造的証明
- `cargo test` で新規 filter 組合せ test green: oracle は seed 済み in-memory SQLite の期待結果集合を test 内に独立転記（production の SQL 生成から導出しない）
- 既存 test green 維持（単一 filter 群、stocktake の combined case `test_list_stocktake_items_req205_dept_and_counted_combined` を含む）
- `bash scripts/local-ci.sh full` CLEAN（L1）
- Matrix の mutation 実測: commit 済み clean tree で注入 → red → 復元 → green を各 X で実施し（各回 `git status` clean 確認）、PR body に記録

## Design Sources

- 監査 finding: `docs/research/audit-2026-07/findings/p7-readability-idioms-naming.md` P7-2
- 既存慣用の正本実装: `src-tauri/src/db/return_repo.rs` `list_return_records`（:126 / :130）、`src-tauri/src/db/inventory_repo.rs` `list_movements`（:243 / :253 / :257）— いずれも 2026-07-28 現 HEAD 実測
- `docs/ARCHITECTURE.md` の層構造（db 層内で閉じる refactor であることの確認）

## Required Design Artifacts

- 新規設計 doc 不要。SQL の機能契約は不変で、設計 doc に placeholder 実装方式の記述はない（実装慣用の統一のみ）

## Registration / Generation Obligations

- 新規 command / route / REQ / 画面: なし。新規 test は既存 inline test module へ追加（登録不要）。bindings / traceability 再生成: 不要（DTO・REQ 対応不変）

## Design Intent Trace

| Source | Decision | Target | Test |
|---|---|---|---|
| P7-2 提案方向 | placeholder を params 現在長から導出する既存慣用へ統一 | 両 fn | Matrix C1/C2 |
| return/inventory repo 慣用 | 独立 counter を持たない shape を正とする | 両 fn | Matrix C2（sweep） |
| P7-2 指摘（stocktake の捨て index） | param 非消費 filter は counter 操作自体が消える形で解消 | stocktake 側 | Matrix C1/C4 |

## Design Intent Audit

- 棄却代替案: (1) dummy read の comment 補強のみ — 手動対応証明の負担（P7-2 の本体）が残る。(2) query builder crate 導入 — S 是正の範囲を超え、依存追加は npm/cargo 供給網方針と別議論が必要。(3) 全 repo の SQL 生成共通関数化 — 既存慣用 4 file が現に健全で、抽象の追加は逆に読み手負担
- Deferred design gaps: なし

## Impact Review Lenses

- operator 可視の挙動変化: なし（結果集合不変が Goal Invariant）。画面変更なしのため Human Visual Confirmation 対象外

## Design Readiness

- Existing design docs are sufficient because: 変更は db 層内の実装慣用統一で機能契約に触れない。対象座標・慣用側 precedent・既存 test の検出力 gap は 2026-07-28 の現 HEAD 実測で確定している（監査時からの乖離は行番号の微小シフトのみ）

## Contract Probe

- 慣用側 precedent の実在: `params.len() + 1` 導出は return / inventory / disposal / receiving の 4 repo に定着済み（2026-07-28 rg 実測）→ 統一先の shape は repo 内で確立している
- param 非消費 filter の適合性: `counted_only`（IS NULL / IS NOT NULL 固定条件、bind なし）は慣用側 shape では counter 操作が不要 → dummy read 問題が構造的に消滅することを precedent の形から確認
- 既存 test の検出力 gap: product 側は単一 filter 中心で組合せ oracle なし、stocktake 側は combined 1 case あり（2026-07-28 実測）→ 組合せ test 新設が必要という Test Plan 前提を実証

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| C1 結果集合不変（全 filter 組合せ） | 両 fn | 組合せ挙動 test（独立転記 oracle） | non-scope |
| C2 param_idx 全廃（慣用統一） | 両 fn | AC の rg anchor M-A1 + clippy green | non-scope |
| C3 既存挙動の regression | 両 fn | 既存 unit suite green 維持 | non-scope |
| C4 param 非消費 filter の正常動作 | stocktake 側 | 既存 combined case + 組合せ test | non-scope |

## Test Plan

- Test Design Matrix: [test-matrices/2026-07-28-sql-placeholder-idiom.md](test-matrices/2026-07-28-sql-placeholder-idiom.md)
- oracle 独立性規律: 組合せ test の期待結果は seed データから独立転記し、production の SQL 生成 logic から導出しない
- mutation 実測は commit 済み clean tree 限定（注入 → red → 復元 → green、各回 clean 確認）。mutation は refactor 後 code への注入（placeholder ずれ・push 順序交差）で新規 test の検出力を実証する

## Boundary / Wire Contract

- IPC / DTO / wire 変更なし。fn シグネチャ不変で BIZ/CMD 層に非接触

## Review Focus

- filter 句の SQL 文字列と params push の対応（組合せごとの 1 対 1 検証）
- pagination（LIMIT / OFFSET）は format! literal 埋め込みで placeholder 対象外（plan-gate round 1 P1-1 実測）— filter 併用時の結果集合検証が C1 の pagination 併用 case で担保されているか
- stocktake の固定条件 filter が param を消費しない点の扱い
- 組合せ test の oracle が生成 SQL から導出されていないこと（SSOT 共有の自壊防止）
- 既存 test の改変がないこと（挙動固定の regression を弱めない）

## Spec Contract

- 対象: 商品検索・棚卸し明細取得の既存機能契約（REQ 対応は既存 test の REQ token を踏襲、変更なし）
- REQ 影響: なし（機能・挙動不変の慣用統一）。traceability 再生成不要

## Trace Matrix

| 設計正本 | 実装 | Test |
|---|---|---|
| 既存慣用（return/inventory repo） | search_products | Matrix C1/C2 |
| 同上 | list_stocktake_items | Matrix C1/C2/C4 |
| 既存 REQ 対応（test token 維持） | 両 fn | Matrix C3 |

## Data Safety

- SELECT 経路のみで永続データ・書込み path に非接触。migration なし。backup / restore 経路に非接触

## Implementation Results

（実装時に追記）

## Review Response

- Findings Freeze: not-yet（Final Review closure で発効）
