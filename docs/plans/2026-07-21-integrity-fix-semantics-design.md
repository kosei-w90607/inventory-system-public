# Plan Packet — 整合性補正の不変条件の正本確定（監査是正 順 3、design phase）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: plan-gate
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable 5（本 session）
- Writer: Fable 5（design docs 改訂）
- Plan Reviewer: 独立 subagent（fresh context、Writer と別）
- Final Reviewer: 独立 fresh context（Plan Reviewer と別）+ Codex 独立 2 pass（Double Audit）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Draft PR の owner 確認 + Ready 承認 + Ready 後の explicit `workflow_dispatch` 1 run（docs-only は paths-ignore で自動 event 対象外のため、ci.md R3 経路の hosted final は owner 指示の dispatch で満たす）+ merge

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 15分
- relay 往復上限: 1

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。
補正意味論の owner 裁定（2026-07-21、下記 Design Sources）は packet 起票前に完了しており、この予算に含めない。

## Risk

Risk: R3

Reason:
docs-only の design phase だが、[adjudication](../research/audit-2026-07/adjudication.md) が順 3 に「R3 design-first」を明示付与しており、対象は在庫数（`products.stock_quantity`）を直接書き換える destructive 寄りの操作契約と operator 向け文言の正本。PR #14（順 1+2 design phase、R3）の前例に従う。R4 としない理由: 本 PR 自体は destructive 操作を実行せず（docs のみ、git revert で完全に巻き戻せる）、実挙動が変わるのは後続実装 PR 側。R3 の必須物（Spec Contract / Trace Matrix / Data Safety / Test Design Matrix / Contract Coverage Ledger / 独立レビュー）は本 packet で満たす。

## Goal

Goal Invariant:

### 最小完了条件

- `docs/function-design/36-biz-integrity-check.md` の整合性補正契約が、owner 裁定 2026-07-21（意味論 A: `inventory_movements` = 在庫推移の原本 / `products.stock_quantity` = 派生 cache / 補正は movement 行を追加しない直接更新 / 補正内容は同一 TX の `integrity_fix` 操作ログへ old/new 付きで必須記録）どおりに**内部矛盾なく**正本確定し、`docs/architecture/biz-task-specs.md` BIZ-07・`docs/function-design/75-ui-integrity-check.md`・`docs/function-design/74-ui-operation-logs.md` の関連記述が同じ意味論を指す。後続実装者が設計書のみから実装 follow-up PR を計画できる。

### 失敗定義

- §21.4（movement 挿入を要求）と §21.6（direct update と記載）の内部矛盾、または「補正後に再チェックが収束しない」手順が正本に残る。
- 実装（`integrity_service.rs` の「設計書からの逸脱」自己申告コメント）がどちらへ直しても別契約を壊す状態（監査 P7-1 の害経路）が解消されない。
- operator 向け文言（75-ui「棚卸し補正として記録します」等）が確定した意味論と乖離したまま残る。
- 設計改訂が既存の正しい契約（run_integrity_check のチェックロジック、UI-13 の選択・確認 flow、D-6 の一般原則）を壊す。

### 非目的

- 実装コード（`src/` `src-tauri/`）の変更（後続実装 follow-up PR で行う）。
- 順 4（mutation→consumer query 契約）・順 5 以降の設計。
- 75-ui の state machine・画面構成・選択 flow の変更（文言表の同期のみ scope 内）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- `docs/function-design/36-biz-integrity-check.md`:
  - §21.4 関数要求文の改訂（BIZ-07-D2）: 冒頭 summary「棚卸し補正と同じ方式（movement_type='stocktake'）で inventory_movements に補正レコードを追加する」を direct update 記述へ書き換え（Plan Gate round 4 P1 で検出 — 処理ステップだけ直して入口説明が旧意味論のまま残ると P7-1 の「正本内部の相反」を §21.4 内で再生産する）。
  - §21.4 処理ステップ 3e 改訂（BIZ-07-D2）: `insert_movement` 要求を撤回し、direct update（`update_stock_quantity` のみ）を正本化。撤回理由（補正 movement を挿入すると movements_sum 自体が変わり再チェックが収束しない — 監査 P7-1 / adjudication P7-1 補強の算術）を設計判断として明記。
  - §21.4 ステップ 5 改訂（BIZ-07-D3）: 操作ログ記録を「TX外・警告のみ（先決事項 D-6）」から「**同一 TX 内・必須記録**（失敗時は補正ごと rollback、`BizError::DatabaseError`）」へ変更。D-6 の一般原則（操作ログは best-effort）は維持し、`integrity_fix` を明示例外とする理由（movement 行を残さないため操作ログが唯一の監査痕跡。痕跡なしの在庫直接書換えを構造的に禁止する）を明記。detail_json に old/new（`old_stock` / `new_stock` / `adjustment`）を必須で含める。
  - §21.4 設計判断「reference_id=0 の理由（先決事項 D-3）」（BIZ-07-D5）: movement を作らない意味論では不要になるため撤回・書き換え（「仮想棚卸し」概念の退役を明記）。
  - §21.6 対応不変条件（BIZ-07-D1 / D4）: INV-2 行を direct update の正本記述へ一本化。新規行として原本/cache 確定（`inventory_movements` = 原本、`stock_quantity` = 派生 cache）と収束性不変条件（fix_integrity 成功直後の run_integrity_check は対象商品で difference = 0）を追加。
  - エラーハンドリング節: ログ記録失敗 → rollback の分岐を追加。
  - テスト方針節: BIZ-07-D3/D4 の実装 follow-up テスト契約を明文化（Matrix #12 の oracle — 失敗系: `integrity_fix` ログ INSERT の注入失敗で `BizError::DatabaseError` + 全対象商品 stock 不変 + movement 行数増 0 / 成功系: detail_json.adjustments[] の product_code / old_stock / new_stock / adjustment を具体値検証 / 収束系: 補正成功直後の run_integrity_check で対象商品 difference = 0。Codex round 6 P2 で Scope への同期漏れを是正）。
- `docs/architecture/biz-task-specs.md` BIZ-07: 処理構造ステップ 5「各不整合商品について棚卸し補正として処理（BIZ-06の確定処理と同じ方式）」「inventory_movementsにstocktakeレコードを追加（差分を記録）」を新意味論（direct update + 同一 TX 必須ログ、movement なし）へ改訂。あわせてステップ 6「operation_logsに記録（operation_type='integrity_check', detail_jsonに不整合件数・補正有無)」が check/fix の操作ログを単一エントリに混在させて描写している点を、36-biz の実設計（§21.3 = `integrity_check` ログ best-effort / §21.4 = 独立の `integrity_fix` ログ TX 内必須 old/new 付き）に一致する 2 ログ分離記述へ改訂（Plan Gate round 3 P2 で検出）。
- `docs/architecture/ui-task-specs.md` UI-13 節: 「fix_integrity（棚卸し補正としての inventory_movements 追加）」「棚卸し補正として確定」「棚卸し補正として記録します」、および利用者操作フロー step 7「確定 → inventory_movements に movement_type='stocktake' で補正行追加、products.stock_quantity を更新」の movement 挿入意味論を新意味論へ改訂（前者 3 句は起票後の adjacent-contract sweep、step 7 は Plan Gate round 3 P1 で検出 — 「補正行追加」文言は grep anchor にも追加）。
- `docs/ARCHITECTURE.md` UI-13 行: 「棚卸し補正としての確定確認」を新意味論の語彙へ同期（同 sweep で検出）。
- `docs/DB_DESIGN.md` §「stock_quantity整合性チェック」復旧方針の箇条書き全体: 確認文言引用「「棚卸し補正として現在の在庫数を確定しますか？」と確認」（round 4 P2 で検出 — 75-ui の新 operator 語彙と矛盾したまま残る恐れ）と「確定した場合のみ stocktake として inventory_movements に補正レコードを追加し、stock_quantity を更新する」を、direct update + 同一 TX 必須ログ + 新 operator 語彙へ一体で改訂（「自動上書きはしない」原則は不変）。同節の pos_stock_sync=0 記述にある「棚卸し補正」は実棚卸し（BIZ-06）文脈のため非変更 — design 中に文脈を再確認。
- `docs/function-design/65-inventory-record-traceability.md`: 整合性補正は movement を作らないため在庫変動履歴に現れず、追跡は `integrity_fix` 操作ログ側で行う旨を追跡対象の整理へ 1 行追記する（36-biz / D-051 側の明記とあわせて確約 — Plan Gate round 1 P3 の指摘により「design 中に要否判定」の保留を廃し、追記を確定事項へ変更）。
- `docs/function-design/35-biz-stocktake-service.md` 設計判断「operation_log TX外」: 「先決事項 D-6『operation_log TX境界: 全てTX外』を BIZ-05/06/07 でも継承する」の断言が本 PR 後に fix_integrity（BIZ-07-D3）に関して不正確になるため、fix_integrity のみ明示例外である旨の 1 行注記を追加（run_integrity_check 側は D-6 継承のまま。Plan Gate round 2 P2 で検出）。BIZ-06 自身の TX 外方針は不変。
- `docs/function-design/75-ui-integrity-check.md`: 文言表の同期（UI-13 拡張 decision ID を付す）。確認 dialog title「棚卸し補正として記録します」と確定ボタン「棚卸し補正として確定」の「棚卸し補正」語彙を、実挙動（在庫数を入出庫の合計へ補正し、操作ログへ記録する）に一致する operator 語彙へ改訂。UI-13-D8 の原則（色非依存、非IT operator 可読）と本画面の語彙判断（「システム在庫」「入出庫の合計」、UI-13 Amendment 5）は維持。
- `docs/function-design/74-ui-operation-logs.md`: `integrity_fix` の詳細表示について、detail_json（old/new 内訳）が補正の**唯一の監査痕跡**である旨を registry 周辺へ同期し、表示期待を decision として確定する（Codex round 5 P2 で「現状維持か改修か未決」を指摘され裁定）: **integrity_fix の adjustments は商品コード・旧在庫→新在庫・差分の operator-readable 形式で表示し、raw JSON は技術情報として残す**方向を 74-ui の decision ID 付きで正本化する（非IT operator が唯一の監査痕跡を読めることは意味論 A の説明可能性の前提。実装 = `OperationLogsPage.tsx`/test の follow-up PR、Non-scope 参照）。
- `docs/decision-log.md`: **D-051** 新設 — 原本/cache の確定と補正意味論の durable 判断。why（収束性 + 原本性 + 監査痕跡の一意化）、rejected alternatives（①movement 挿入 = 数学的に収束せず原本を汚染 ②sum に影響しない marker movement 行（quantity=0 等）= schema/CHECK 制約・movement_type 語彙・履歴画面 noise の追加設計が必要で、操作ログで代替可能 ③stock 原本化 = 既存原則の破壊）、revisit trigger を記録。あわせて D-6（操作ログ best-effort）の例外の現状整理を 1 行含める: BIZ-01 `product_service.rs` の TX 内必須ログ 3 箇所が既存の未文書化例外であり、integrity_fix（BIZ-07-D3）はこれに続く 2 例目の文書化例外（Plan Gate round 1 P3）。D-051 は固定小見出し **invariant / audit / retention / rejected / revisit** で構成する（Codex round 5 改善提案の採用）。retention 小見出しには「唯一の監査痕跡である integrity_fix 操作ログは MNT-02 の 365 日自動削除の対象であり、365 日超の補正履歴は消える」事実を明記。revisit trigger は固定条件で記録する: ①操作ログ保持期間を超える恒久補正履歴が要求された場合、②在庫変動履歴画面だけで全在庫変化理由を追跡する要求が確定した場合。その際の再設計候補は quantity=0 marker movement ではなく専用 correction ledger を含めて評価する（Codex round 5 P2）。
- `docs/Plans.md`: 進行中作業に本 design phase を追加、次の行動 0 を active packet リンクへ更新。実装 follow-up PR（integrity_service.rs のログ TX 内移動 + 逸脱コメント解消 + `IntegrityCheckPage.tsx`/test 文言同期 + `OperationLogsPage.tsx`/test operator-readable 表示 + テスト追随）を次アクション候補として明記。

## Non-scope

- 実装コード（`src/` `src-tauri/`）の変更一切。実装 follow-up PR で: 操作ログ挿入の TX 内移動と必須化、逸脱自己申告コメントの解消、**frontend 文言・テストの同期（`src/features/integrity-check/IntegrityCheckPage.tsx` の確定ボタン「棚卸し補正として確定」/ dialog title「棚卸し補正として記録します」/ 本文、および `IntegrityCheckPage.test.tsx` の当該文言 assert 4 箇所 — Plan Gate round 1 P1）**、**UI-11c の integrity_fix operator-readable 表示（`OperationLogsPage.tsx` + `OperationLogsPage.test.tsx` — Codex round 5 P2 の裁定）**、`integrity_cmd.rs` tautological test 実呼び化（既存 backlog）の吸収検討。
- `run_integrity_check`（§21.3）のチェックロジック・`integrity_check` 操作ログ（TX なし・best-effort のまま）の変更。
- 順 4（mutation→consumer query 契約）の設計。UI-13 の補正成功後 invalidation 契約は現行のまま（順 4 の入力として引き継ぐ）。
- D-6 の一般原則自体の変更（integrity_fix の例外化のみ）。
- 監査 finding P7-1 自体の再検証（独立検証 CONFIRMED 済み）。

## Acceptance Criteria

- `bash scripts/doc-consistency-check.sh --target plan` と full が ERROR 0（既存 WARN = 75-ui paging 上限 1 件から増加なし）。
- 36-biz に BIZ-07-D1〜D5、decision-log に D-051 が存在し、D-051 が固定 5 小見出し（invariant / audit / retention / rejected / revisit）を持ち、retention に 365 日自動削除の事実、revisit に固定 2 条件が記載されている（Codex round 6 P2 で検査対象化）。
- `docs/function-design/36-biz-integrity-check.md` のテスト方針節に `docs/plans/test-matrices/2026-07-21-integrity-fix-semantics-design.md` #12 相当の実装 follow-up テスト契約（失敗注入 / detail_json 具体値 / 収束）が存在する。
- `rg "棚卸し補正として" docs/function-design/75-ui-integrity-check.md docs/architecture/ui-task-specs.md docs/ARCHITECTURE.md docs/DB_DESIGN.md` が 0 件（文言同期後 — DB_DESIGN は round 4 P2 で追加）。`rg "insert_movement" docs/function-design/36-biz-integrity-check.md` が 0 件（§21.4 撤回後）。`rg "棚卸し補正と同じ方式" docs/function-design/36-biz-integrity-check.md` が 0 件（関数要求文改訂後 — round 4 P1）。`rg "補正レコードを追加" docs/DB_DESIGN.md docs/function-design/36-biz-integrity-check.md` が 0 件（復旧方針・関数要求文改訂後）。`rg "補正行追加" docs/architecture/ui-task-specs.md` が 0 件（step 7 改訂後 — round 3 P1）。`rg "stocktakeレコードを追加|補正有無" docs/architecture/biz-task-specs.md` が 0 件（ステップ 5/6 改訂後 — round 3 P1/P2）。
- **全数照合（round 4 P3 — anchor 積み上げの構造的弱点への最終ゲート。Codex round 5 改善提案の部分採用で多 pattern 化、round 6 P2 で 2 command に分離）**: ①語彙系 `rg -n "棚卸し補正|補正レコード|補正行追加|stocktakeレコードを追加|補正有無" docs/ --glob '!docs/archive/**' --glob '!docs/research/**' --glob '!docs/plans/**'` と ②整合性補正文脈限定 `rg -n "insert_movement" docs/function-design/36-biz-integrity-check.md docs/function-design/75-ui-integrity-check.md docs/architecture/biz-task-specs.md docs/architecture/ui-task-specs.md docs/DB_DESIGN.md` の全ヒット行が、「本 PR の改訂対象（Scope 列挙）」または「実棚卸し（BIZ-06）等の正当文脈の明示除外（Matrix Adjacent Pattern Audit）」のどちらかに 1:1 で対応することを PR body の対応表で示す（分類不能な行が 1 つでもあれば改訂漏れとして差し戻し。`insert_movement` を docs 全域にしないのは、20-io / 30-biz / 31-biz / 10-common 等の正当な repository API 記述が大量ヒットし allowlist 保守が gate の焦点を薄めるため — Codex round 6 の推奨を採用）。
- 監査 P7-1 の害経路（`docs/research/audit-2026-07/findings/p7-readability-idioms-naming.md` P7-1 の証拠 8 箇所）それぞれについて、改訂後のどの節が塞ぐかを PR body の対応表で示せる（Matrix #7）。
- 独立 Final Review（改訂後設計 vs P7-1 / vs 実装現状の突合、`docs/plans/test-matrices/2026-07-21-integrity-fix-semantics-design.md` の #2/#4/#7 を含む）の報告で P1 = 0 / P2 = 0。

## Design Sources

- Requirements / spec: REQ-904（整合性チェック〈在庫数突合/修復〉、割当 = BIZ-07 / UI-13。`docs/spec/requirements.md` — Codex round 5 P1 で REQ-701〈診断ログ〉の誤引用を訂正）、BIZ-07（`docs/architecture/biz-task-specs.md`）
- Architecture: `docs/ARCHITECTURE.md`（UI -> CMD -> BIZ -> IO/MNT）
- Function / command / DTO: `docs/function-design/36-biz-integrity-check.md`、`docs/function-design/75-ui-integrity-check.md`、`docs/function-design/74-ui-operation-logs.md`
- DB: `docs/DB_DESIGN.md`（inventory_movements / products / operation_logs、stock_quantity 整合性チェックの前提）
- Screen / UI: `docs/function-design/75-ui-integrity-check.md`（文言表のみ）
- Decision log / ADR: 新規 D-051。owner 裁定 2026-07-21（本 session、verbatim）: 「inventory_movements を在庫推移の原本、products.stock_quantity を派生 cache として確定し、整合性補正は cache を movements 合計へ直接更新する。補正は実入出庫・棚卸しではないため movement 行を追加しない。補正内容は同一 TX の integrity_fix 操作ログへ old/new 付きで必須記録し、UI-13 の棚卸し表現と UI-11c の詳細表示を意味論に同期する。」
- 監査証拠: `docs/research/audit-2026-07/findings/p7-readability-idioms-naming.md` P7-1、`docs/research/audit-2026-07/adjudication.md`（P7-1 補強 = 3e は数学的に収束しない）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 36-biz-integrity-check.md / biz-task-specs.md BIZ-07 | updated in this PR |
| Command / DTO / generated binding / wire shape | 変更なし（`fix_integrity` の CMD wire / `IntegrityFixResult` は不変。operation log detail_json は既存 shape の必須化のみ） | existing sufficient |
| DB / transaction / audit / rollback / migration | 36-biz §21.4 の TX 境界改訂（ログを TX 内へ）。schema 変更なし | updated in this PR |
| Screen / UI / route state / Japanese wording | 75-ui 文言表 + 74-ui integrity_fix 詳細表示の同期 | updated in this PR |
| CSV / TSV / report / import / export format | 該当なし | existing sufficient |
| Durable decision / ADR | decision-log D-051 | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / route / function-design doc / REQ の追加なし。既存 doc の改訂と decision-log 追記のみ。traceability はテスト追加を伴わない設計書改訂のため再生成不要 — テスト追随は実装 follow-up PR 側）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| BIZ-07 | 36-biz §21.6 | BIZ-07-D1（原本/cache 確定） | movements は操作ごとの記録 = 原本、stock は派生 cache（既存原則の明文昇格）。rejected: stock 原本化 | docs（正本記述） | Matrix #2 / #5 |
| BIZ-07 | 36-biz §21.4 3e | BIZ-07-D2（direct update、movement 追加禁止） | 挿入すると movements_sum が動き再チェック非収束（P7-1 算術）。rejected: movement 挿入 / marker 行 | docs + 実装 follow-up | Matrix #2 / #3 |
| BIZ-07 | 36-biz §21.4 ステップ5 | BIZ-07-D3（同一 TX 必須ログ、D-6 例外） | movement を残さないため操作ログが唯一の監査痕跡。痕跡なし補正を構造的に禁止。rejected: best-effort 継続 | docs + 実装 follow-up | Matrix #6 / #12 |
| BIZ-07 | 36-biz §21.6 新規行 + テスト方針 | BIZ-07-D4（収束性不変条件） | 補正直後の再チェック difference=0 を検証可能な不変条件として固定 | docs + 実装 follow-up テスト | Matrix #5 / #12 |
| BIZ-07 | 36-biz §21.4 設計判断 D-3 | BIZ-07-D5（仮想棚卸し概念の退役） | movement を作らない意味論では reference_id=0 の識別設計が不要 | docs | Matrix #3 |
| UI-13 | 75-ui 文言表 | UI-13 拡張 decision ID（design 中に採番） | 「棚卸し補正」語彙は movement 記録を示唆し実挙動と乖離。operator 語彙へ同期 | docs + 実装 follow-up | Matrix #3 / #8 |
| UI-11c | 74-ui registry 周辺 + 表示 decision | UI-11c 拡張 decision ID（design 中に採番） | integrity_fix detail_json = 唯一の監査痕跡である旨 + adjustments の operator-readable 表示（商品コード・旧在庫→新在庫・差分、raw JSON は技術情報に保持）。rejected: raw JSON のみの現状維持 = 非IT operator が唯一の監査痕跡を読めない | docs + `OperationLogsPage.tsx`/test follow-up | Matrix #9 / #10 |
| BIZ-07 / 65 | 65-inventory-record-traceability 追跡対象整理 | 追記（decision ID 不要の同期） | 補正は在庫変動履歴に現れず操作ログで追跡する旨の 1 行（round 1 P3 で確定） | docs | Matrix #7 |
| BIZ-07 / BIZ-06 | 35-biz 設計判断「operation_log TX外」 | BIZ-07-D3 の例外注記 | 「BIZ-05/06/07 でも継承」の断言が fix_integrity で不正確になる残存矛盾の解消（round 2 P2） | docs | Matrix #6 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 改訂後の 36-biz + D-051 が意味論・理由・却下代替案を保持する（owner 裁定 verbatim は本 packet Design Sources と D-051 に記録）。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: 補正意味論 → D-051 へ昇格（本 PR 内）。
- Assumptions and constraints: rusqlite の TX 内 operation_logs INSERT（`insert_operation_log(&tx, ...)?`、失敗時 rollback）は BIZ-01 `product_service.rs` の product_create 等 3 箇所で実績のある内部パターンであり外部前提なし（当初「daily-report 系」と誤引用 — 実際の daily/csv commit は TX 外 best-effort。Plan Gate round 1 P2 で訂正）。
- Deferred design gaps, risk, and follow-up target: 実装 follow-up PR（ログ TX 内移動・コメント解消・`IntegrityCheckPage.tsx`/test 文言同期・`OperationLogsPage.tsx`/test operator-readable 表示・テスト追随）を Plans.md 次アクションに記録。順 4 の invalidation 契約は非目的として引き継ぎ。
- Test Design Matrix can cite design decision IDs or source doc sections: 全行が BIZ-07-D1〜D5 / UI-13 / P7-1 を引用（Matrix 参照）。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: 「必ず操作ログが残る」の例外 = ログ INSERT 失敗時は補正自体が rollback され何も起きない（痕跡なし変更は発生しない）。D-6 best-effort の他箇所（integrity_check 含む）は非変更で共存を明記。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable（外部 adapter 非接触） | — |
| Fact check / design decision split | 該当: 「3e は収束しない」は算術事実（監査 + 独立検証 + Coordinator 再計算の三者一致）、「direct update + TX 内必須ログ」は owner 設計判断。事実と判断を D-051 で分離記録 | D-051 |
| Lifecycle / retry | 該当: 補正失敗（ログ失敗含む）→ TX rollback → 再試行可能。部分成功なし | 36-biz エラーハンドリング節 |
| Operator workflow | 該当: 確認 dialog / ボタンの「棚卸し補正」語彙を実挙動一致へ改訂。operator の既習語彙（システム在庫 / 入出庫の合計 / 操作ログ）に接続 | 75-ui 文言表 |
| Replacement path | not applicable | — |
| Data safety / evidence | 該当: 在庫直接書換えの監査痕跡を同一 TX 必須ログで保証 | 36-biz BIZ-07-D3 |
| Reporting / accounting semantics | 該当: 補正は実入出庫・棚卸しと明確に区別（movement を作らない = 入出庫履歴・売上/棚卸し集計を汚染しない） | D-051 / 36-biz |
| Manual verification | not applicable（docs-only。L3 は実装 follow-up PR 側で評価） | — |

## Design Readiness

- Existing design docs are sufficient because: 不十分（P7-1 のとおり内部矛盾）。本 PR がその是正そのもの。
- Source docs updated in this PR: 36-biz / biz-task-specs BIZ-07（ステップ 5・6）/ ui-task-specs UI-13 節 / ARCHITECTURE UI-13 行 / DB_DESIGN 復旧方針 / 75-ui 文言表 / 74-ui 追記 + 表示 decision / 65 追跡対象整理 1 行 / 35-biz 例外注記 / decision-log D-051 / Plans.md 同期（Codex round 5 P3 で Scope と同期）。
- Design gaps intentionally deferred: 実装反映（コード + テスト）は follow-up PR。順 4 invalidation 契約。
- Durable decisions discovered in this plan and promoted to source docs: D-051（補正意味論）。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 補正ロジックと TX 境界は BIZ（integrity_service）、CMD は薄いまま不変。
- Backend function design: fix_integrity の処理ステップ・エラー分岐・不変条件を 36-biz で確定。
- Command / DTO / data contract: wire 不変（Required Design Artifacts 参照）。
- Persistence / transaction / audit impact: TX 境界にログ INSERT を内包。schema 不変。
- Operator workflow / Japanese UI wording: 75-ui 文言表を意味論同期。
- Error, empty, retry, and recovery behavior: ログ失敗 → rollback → 再試行可能を明文化。
- Testability and traceability IDs: BIZ-07-D1〜D5 を実装 follow-up のテスト目標として引用可能に。

## Contract Probe

N/A — 本 plan は未検証の外部前提（外部 library / OS / hardware 挙動)に依存しない。収束性は算術で確定し（監査・独立検証・Coordinator 再計算の三者一致）、TX 内 operation_logs INSERT は `src-tauri/src/biz/product_service.rs`（BIZ-01、`insert_operation_log(&tx, ...)?` 3 箇所）で使用済みの内部パターン（Plan Gate round 1 P2 で引用先を訂正）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| BIZ-07-D1 原本/cache 確定 | 36-biz §21.6 / D-051 | Matrix #2 / #5（doc 整合 + anchor） | non-scope（docs-only） |
| BIZ-07-D2 direct update・movement 追加禁止 | 36-biz §21.4 3e / biz-task-specs BIZ-07 / ui-task-specs UI-13 / ARCHITECTURE UI-13 行 / DB_DESIGN 復旧方針 | Matrix #2 / #3（旧記述 grep 0 件） | non-scope（実装は follow-up PR） |
| BIZ-07-D3 同一 TX 必須ログ（D-6 例外） | 36-biz §21.4 ステップ5 + エラーハンドリング / biz-task-specs BIZ-07 ステップ6 の 2 ログ分離 / 35-biz「BIZ-05/06/07 でも継承」への fix_integrity 例外注記 / D-051 の例外現状整理 | Matrix #6（anchor + 例外理由明記）+ #12（実装 follow-up の失敗注入 oracle を 36-biz テスト方針に固定） | non-scope（実装は follow-up PR） |
| BIZ-07-D4 収束性不変条件 | 36-biz §21.6 新規行 + テスト方針 | Matrix #5 / #12 | non-scope |
| BIZ-07-D5 仮想棚卸し概念の退役 | 36-biz §21.4 設計判断 | Matrix #3 | non-scope |
| 75-ui 文言同期 | 75-ui 文言表 | Matrix #3 / #8 | non-scope（画面実装は follow-up PR） |
| 74-ui integrity_fix 詳細表示同期 + operator-readable 表示 decision（UI-11c 拡張 decision ID） | 74-ui registry 周辺 + 表示 decision 節 | Matrix #9 / #10 | non-scope（`OperationLogsPage.tsx` 実装は follow-up PR） |
| 65 追跡対象整理への補正 1 行追記 | 65-inventory-record-traceability | Matrix #7（P7-1 対応表に含める）+ 独立レビュー | non-scope |
| D-051 durable adjudication（固定 5 小見出し invariant/audit/retention/rejected/revisit、365 日保持事実、却下案 3 件、固定 2 revisit 条件、D-6 例外現状整理） | `docs/decision-log.md` D-051 | AC 検査 + Matrix #13 | non-scope（Codex round 7 P1 で独立行化） |
| P7-1 害経路の全塞ぎ | PR body 対応表 | Matrix #7 | non-scope |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-21-integrity-fix-semantics-design.md](test-matrices/2026-07-21-integrity-fix-semantics-design.md)

- targeted tests: `bash scripts/doc-consistency-check.sh --target plan` / full（ERROR 0、WARN 既存 1 件から増加なし）
- negative tests: 旧文言残存 grep（Matrix #3）、§21.4 旧ステップ再注入 mutation で独立レビューが red になる感度確認（Matrix #2）
- compatibility checks: D-6 一般原則・run_integrity_check・UI-13 flow の非変更確認（Matrix #4 / #8）
- data safety checks: 実店舗データなし、synthetic 例のみ（Data Safety 参照）
- main wiring/integration checks: docs-only のため N/A（実装 follow-up PR 側）

## Boundary / Wire Contract

該当なし — `fix_integrity` の CMD wire（引数 / `IntegrityFixResult`）と generated bindings は不変。operation log detail_json は既存 shape（old/new 内訳）の必須化のみで形は変わらない。

## Review Focus

- §21.4 / §21.6 / biz-task-specs BIZ-07 / 75-ui / 74-ui が**単一の意味論**を指しているか（一箇所でも movement 挿入を示唆する残存記述がないか）。
- BIZ-07-D3 の例外設計が D-6 の一般原則と矛盾なく共存し、例外理由が将来の実装者に自明か。
- 収束性不変条件が検証可能な形（実装 follow-up のテストが書ける形）で書かれているか。
- 75-ui 新文言が UI-13-D8（非IT operator 可読・色非依存）と Amendment 5 語彙（システム在庫 / 入出庫の合計）に整合するか。
- 実装現状との差分（TX 外ログ → TX 内必須）が follow-up PR の作業として明確に列挙されているか。
- DB_DESIGN の pos_stock_sync=0 記述にある「棚卸し補正」が実棚卸し（BIZ-06）文脈である判定の妥当性、および 65-inventory-record-traceability の「あとから追跡できる」完成形定義と「補正は在庫変動履歴に現れない」設計の整合説明が十分か。

## Spec Contract

Contract ID: SPEC-BIZ07-FIX-SEMANTICS-2026-07-21（root requirement: REQ-904 → BIZ-07 / UI-13）

- 整合性補正は `products.stock_quantity` を movements_sum へ直接更新し、`inventory_movements` に行を追加しない。
- 補正の監査痕跡は同一 TX 内の `integrity_fix` 操作ログ（old/new 付き detail_json）であり、ログ記録失敗時は補正ごと rollback される。
- fix_integrity 成功直後の run_integrity_check は、補正対象商品について difference = 0 を返す（収束性）。
- 75-ui / 74-ui の operator 向け表現は上記実挙動と一致する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-BIZ07-FIX-SEMANTICS-2026-07-21（direct update） | 36-biz §21.4 / §21.6 改訂 | Matrix #2 / #3 | 単一意味論 | PR body 対応表 + doc check |
| SPEC-BIZ07-FIX-SEMANTICS-2026-07-21（TX 内必須ログ） | 36-biz §21.4 ステップ5 + テスト方針改訂 | Matrix #6 / #12 | D-6 例外の共存 + 失敗注入 oracle の固定 | doc anchor + 独立レビュー |
| SPEC-BIZ07-FIX-SEMANTICS-2026-07-21（収束性） | 36-biz §21.6 新規行 + テスト方針 | Matrix #5 / #12 | 検証可能性 | doc anchor + 独立レビュー |
| SPEC-BIZ07-FIX-SEMANTICS-2026-07-21（operator 表現） | 75-ui / 74-ui 同期 | Matrix #3 / #8 / #9 / #10 | UI-13-D8 整合 + UI-11c operator-readable 表示・follow-up 追跡 | grep 0 件 + packet Non-scope / Plans.md 突合 + 独立レビュー |
| SPEC-BIZ07-FIX-SEMANTICS-2026-07-21（D-051 durable adjudication） | decision-log D-051（固定 5 小見出し） | Matrix #13 | retention / rejected / revisit の内容存在 | AC 検査 + 独立レビュー |

## Data Safety

- 実店舗データ・実在庫数値は一切コミットしない（例示はすべて synthetic 値）。
- local-only paths: なし（docs-only）。
- synthetic-only paths: 36-biz / 75-ui 内の数値例。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
- Plan Gate rally 記録: round 1〜4 = Claude 独立 subagent（各 round fresh context）。r1 P1×1+P2×1+P3×2 / r2 P2×1+P3×1 / r3 P1×1+P2×1 / r4 P1×1+P2×1+P3×1 — 全件 accept・反映済み、各 round で前 round の反映を第三者検証。round 5 = Codex（vendor 切替、相互修正案方式）: P1×2 + P2×5 + P3×2 全件 accept・反映済み。round 6 = Codex: 新規 P2×4 + P3×1（round 5 反映の packet 後半同期漏れ）全件 accept、`68f471a` + `bd05273` で反映。逸脱 2 点（plan-gate 遷移の content commit 同乗 / 改善提案採否）は Codex 同意。round 7 = Codex: 新規 P1×1（D-051 の Ledger/Trace 独立行欠落 = R3 blocker 該当）+ P2×3 + P3×1 全件 accept、本 commit で反映（Ledger/Trace の D-051 行 + Matrix #13 新設 + #12 収束系 oracle + operator 表現行の #10 接続 + Adjacent Pattern Audit 6 系統化）。
- Codex round 5 改善提案の採否（D-050 方式の分離記録）: **採用** = D-051 固定小見出し（invariant/audit/retention/rejected/revisit）。**部分採用** = 全数照合の多 pattern 化（AC の最終ゲート command へ反映。語彙+データフロー二軸の完全化は allowlist 保守込みの将来改善）。**不採用 defer** = (a) sweep の機械可読 manifest 化 — 本 PR は PR body 対応表 + Matrix #11 で足り、設定ファイル新設は保守対象を増やす。revisit: 同型 sweep を次に必要とする監査/是正 PR 起票時 / (b) Scope の契約単位再編 — rally 5 round 済み構造の再編は churn リスクが利得を上回る。revisit: 次の design packet 起票時に初期構造として検討 / (c) REQ ID lint の PK check 化 — workflow gate change であり本 PR の scope 外。revisit: 次の workflow docs / checker PR 起票時（Plans.md 次の行動 3 の slice 2 follow-up 群と同系統）。
- Coordinator の逸脱裁定依頼（相互修正案方式、次 round で Codex の採否を問う）: round 5 P1-1 の修正案は「state-only commit で plan-gate へ遷移」だが、D-038 Evidence Ownership の forward state-only cap 3（plan-approved 進入 1 + 実装後 2）を温存するため、**本 content commit に plan-draft → plan-gate 遷移を同乗させる方式**で反映した（DEV_WORKFLOW「every other transition rides an adjacent content commit」準拠）。

## Review / Evidence Record（append-only）

- 2026-07-21 packet 起票 commit が kickoff → spec-check → design → plan-draft を materialize（記録圧縮、gate skip なし）。各遷移の evidence: kickoff → spec-check = task scope と Risk R3 を本 packet に記録（adjudication 順 3 の R3 design-first 付与）/ spec-check → design = in-scope source docs を Design Sources に列挙、設計更新が必要（P7-1 の内部矛盾）/ design → plan-draft = 設計方向は owner 裁定 2026-07-21（Design Sources に verbatim 記録）で確定済み、未解決の設計質問なし（残る設計作業 = 本 PR の内容そのもの = 正本文言の執筆）。
- 2026-07-22 本 content commit に plan-draft → plan-gate 遷移を同乗（Codex round 5 P1-1 の裁定反映）。evidence: packet + Test Design Matrix は plan-first commit `1eedb41` で committed、以後 rally 反映 commit（`efb4724` `6f75507` `6efd334` `faace3b` `9f3e8c2` `b62163f`）を経て独立 Plan Gate rally（Claude 4 round + Codex 1 round）進行中。state-only commit を使わず content commit 同乗としたのは D-038 forward state-only cap 温存のため（Review Response の逸脱裁定依頼参照）。
