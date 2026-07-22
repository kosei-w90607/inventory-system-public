# Plan Packet — 監査是正 順 3 実装 follow-up: 整合性補正 D-051 意味論のコード追随

## Workflow State

- Phase: implementing
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 62a4b16
- Amendments: none
- Coordinator: Fable（main thread）
- Writer: Codex（実装発注、レビュー前に PR 作成）
- Plan Reviewer: Codex 先行 plan review（考慮漏れ観点付き）→ Fable 裁定・修正 → Plan agent self rally（Codex findings 非開示の独立 critique、新規指摘 0 まで）。今回の試行順序（通常の rally 先行と逆順）。
- Final Reviewer: 独立 fresh context（Double Audit 2 pass 想定: 1 pass = Fable inline 契約突合 / 2 pass = Codex 独立 + 実 mutation）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Ready 承認 + operator 可視変更の human visual confirmation（Writer が synthetic fixture で用意した UI-13 確定 dialog / UI-11c 詳細表示のスクリーンショットを owner が目視確認）。Windows native L3 は not-required — 画面別の独立根拠: **UI-13** = 75-ui §75.12 が「差異あり → 選択補正」を DB 直接操作の fault injection 要のため L3 対象外と規定済み（Codex 先行 review P1-2）。**UI-11c** = 到達に補正実行 or sqlite3 synthetic INSERT（§74.15 L3-8 方式）が必要で、DEV_WORKFLOW `L3 Eligibility` 条件 (3) が synthetic row insertion 等の fault-injection 級手動手順を L3 に置かず自動テストへ route すると規定済み（UI-11c L3-7/L3-8 の waive 実績がこの規則の起源と明記されている）。よって T9〜T13 の自動テスト + synthetic fixture visual confirmation で担保する。§74.15 への機能別 L3 行追加（L3-4/L3-5 の既存規律）と roadmap 1-4 受入テスト台本への操作ログ確認ステップ追加は、1-4 の台本作成時に検討する将来事項とし、本判断の根拠にはしない。本 PR では Non-scope を維持（rally round 1 指摘の反映、round 3 で根拠を一次規定へ差替え）

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 30分
- relay 往復上限: 2

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
在庫という中核データの補正経路で DB TX 境界を変更する（ログ記録を commit 前へ移動し、失敗時は補正ごと rollback する経路を新設）。データ移行・スキーマ変更はないが、監査痕跡の必須化（BIZ-07-D3）と operator 可視 UI 2 画面（UI-13 確定 flow / UI-11c 詳細表示）の変更を含むため R2 では足りない。R4 要素（migration / 破壊的 IO / 復元系）はない。

## Goal

Goal Invariant:

### 最小完了条件

- `fix_integrity` の `integrity_fix` 操作ログが同一 TX 内で必須記録され、ログ記録失敗時は補正が一切確定しない（BIZ-07-D3）。
- UI-13 確定 flow（ボタン / dialog title / 説明）から「棚卸し」語彙が排され UI-13-D9 の契約文言に一致し、UI-11c で `integrity_fix` の adjustments が operator-readable 一覧（商品コード / 旧在庫 → 新在庫 / 差分）で読める。
- 36-biz §21.7 の 3 oracle テスト（失敗注入 / 成功系 detail_json 具体値 + movement 行数不変 / 収束系 mismatches 非出現 + SQL 等式）が green。

### 失敗定義

- 操作ログ記録が TX 外（commit 後）のまま、または失敗時に補正が確定する経路が残る。
- §21.7 のいずれかの oracle が未実装のまま green を名乗る（tautological / 感度なし）。
- UI-13 確定 flow に「棚卸し」語彙・旧文言が残存する。
- 補正実行で `inventory_movements` 行が増える regression（D-051 rejected ①②の再侵入）。

### 非目的

- `run_integrity_check`（§21.3）のチェックロジック・`integrity_check` 操作ログ（TX なし best-effort）の変更。
- 順 4（mutation→consumer query 契約)の設計・実装。UI-13 の補正成功後 invalidation 契約は現行のまま。
- 設計書（36-biz / 75-ui / 74-ui / decision-log 等）の再編集。D-051 正本は PR #19 で Double Audit 済み確定。今回は純粋にコード側の追随のみ（設計書と実装の乖離を実装側で解消する）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

1. **`src-tauri/src/biz/integrity_service.rs` `fix_integrity` の TX 構造是正**: 操作ログ INSERT を「補正実行 → ログ記録 → commit」の順序へ移動（現状は「補正実行 → commit → ログ（best-effort）」）。ログ記録失敗時は TX ごと rollback し `BizError::DatabaseError` を返す（§21.4 ステップ 4 / BIZ-07-D3）。`insert_operation_log` へは `&tx` を渡す（§21.4 本文どおり）。detail_json の adjustments[] に product_code / old_stock / new_stock / adjustment が必須で入ることを現実装 shape と突合し、不足があれば是正する。
2. **逸脱自己申告コメントの解消**: `integrity_service.rs` の「設計書からの逸脱: movement 挿入を行わない」コメント（現 172-174 行付近）を、D-051 / BIZ-07-D2 参照の正コメントへ置換する。D-051 成立後この挙動は逸脱ではなく正本仕様のため、「逸脱」という自己申告を repo から全廃する。
3. **UI-13-D9 文言同期（確定 flow の全可視・accessible copy）**: `src/features/integrity-check/IntegrityCheckPage.tsx` の確定 flow に残る旧語彙を「3 箇所」限定ではなく全数同期する。対象 = 確定ボタン「補正を確定」/ dialog title「在庫数を入出庫の合計に合わせて補正します」/ **可視 AlertDescription と sr-only AlertDialogDescription の両方**を UI-13-D9 契約説明文「補正すると元に戻せません。選択した商品のシステム在庫を入出庫の合計に合わせて更新し、操作ログに記録します。」へ / 内訳見出し「補正する商品（現在の在庫数 → 補正後の在庫数）」を §75.6 正本語彙で「補正する商品（システム在庫 → 入出庫の合計）」へ。`IntegrityCheckPage.test.tsx` の旧ボタン名参照（`openFixDialog` 等 4 箇所）と文言 assert を同期し、可視要素で assert する（sr-only だけ契約文に置換して可視文言が旧のまま green になる実装を封じる — Codex 先行 review P1-3）。警告 Alert は `StocktakePage.tsx` の確立パターン（AlertTitle = 短文警告 / AlertDescription = 本文 / sr-only AlertDialogDescription = 「title。本文」の結合文）に倣う: AlertTitle「補正すると元に戻せません」は維持し、可視 AlertDescription は契約説明文の残部「選択した商品のシステム在庫を入出庫の合計に合わせて更新し、操作ログに記録します。」、sr-only は契約説明文**全文**とする。可視 Title + Description の結合 = 契約全文となり、Title と Description の同一フレーズ 2 連続表示を避ける（rally round 1 指摘の反映）。
4. **UI-11c-D14 operator-readable 表示**: `src/features/operation-logs/OperationLogsPage.tsx` の詳細表示に、`integrity_fix` の `adjustments[]` を「商品コード / 旧在庫 → 新在庫 / 差分」の一覧としてレンダリングする分岐を追加。生 JSON は既存の折りたたみ「技術情報（JSON）」（現行ラベル文字列を維持）に残す（74-ui UI-11c-D14）。specialized 一覧は既存 `Detail` component の共通防御（parse / 文字数上限 / text-only / raw JSON 折りたたみ = §74.8、UI-11c-D6）を**通した上で**追加し、早期 return で共通防御を迂回しない。一覧の件数境界は §74.8 の「先頭 20 key」方式に倣い**先頭 20 件のみ描画 + 「他 N 件は技術情報（JSON）で確認」の残数行**とする（配列要素数への既定基準が §74.8 にないため packet で確定 — rally round 1 指摘の反映。単一 operator 運用の現実の補正は数件规模で、20 件境界は防御的上限）。既知 key 要約（UI-11c-D6）は現行維持しつつ、`integrity_fix` ログに限り `adjustments`（および specialized 表示に統合する場合は `fixed_count` / `skipped_count`）を**汎用 dt/dd 列挙から除外**する — 除外しないと adjustments 配列全体が `JSON.stringify` の可視 1 行として specialized 一覧の隣に重複表示され、operator-readable 化の目的を自壊する（rally round 2 指摘）。`OperationLogsPage.test.tsx` に表示 assert（重複表示の否定 assert 含む）を追加。
5. **§21.7 の 3 oracle テスト実装**（`src-tauri` テスト、Test Design Matrix T1〜T5）:
   - 失敗系: SQLite trigger（`BEFORE INSERT ON operation_logs ... RAISE(ABORT)` 相当）で `integrity_fix` ログ INSERT を注入失敗させ、`BizError::DatabaseError` / 全対象商品の stock_quantity 不変 / inventory_movements 行数増 0 を assert。
   - 成功系: detail_json.adjustments[] の 4 フィールド具体値 + 補正前後で inventory_movements の総行数・対象商品ごとの行数不変。
   - 収束系: 補正成功直後の `run_integrity_check` mismatches に adjustments[].product_code 非出現 + 同一 committed state での SQL 等式 `stock_quantity = SUM(quantity WHERE is_voided = 0)`。
6. **`src-tauri/src/cmd/integrity_cmd.rs` tautological test の実呼び化**（無条件 in-scope）: 既存 `test_fix_integrity_req904_empty_codes_validation` をロジック複製の自己 assert から実コマンド呼び出しへ置換する。`tauri::test::mock_builder().manage(...)` + `app.state::<AppState>()` の既存 precedent（`stocktake_cmd.rs` テスト群）を踏襲。`fix_integrity` は同期関数のため直接呼び出し（await 不要）。

## Non-scope

- `run_integrity_check` のロジック・`integrity_check` 操作ログの TX 化（§21.3 契約どおり best-effort のまま）。
- `OperationLogsPage.tsx` の `integrity_fix` 以外の operation type の表示ロジック変更（`integrity_check` 種別を含む）。
- 順 4（mutation→consumer query 契約）、UI-13 補正成功後 invalidation 契約の変更。
- 設計書・decision-log の内容変更（正本確定済み。例外 = 90-traceability の自動再生成のみ、Registration / Generation Obligations 参照）。
- MNT-02 保持期間（365 日）等 retention 方針の変更。

## Acceptance Criteria

- `cargo test`（workspace）green。うち §21.7 対応テスト T1〜T5 が存在し green。テスト関数名は既存慣習の `_req904_` を**保持したまま** Matrix ID を追加する（例: `test_fix_integrity_req904_t1_log_insert_failure`）— `generate_traceability` の REQ 抽出は `_req([0-9]{3})` 直後が `_` か終端の完全一致のみのため、`_req904_` を落とすと traceability 集計から静かに漏れる（rally round 2 指摘）。
- 失敗注入テスト（T1）が「ログ INSERT 失敗 → `BizError::DatabaseError` + 全対象 stock_quantity 不変 + movements 行数増 0」を assert している（rollback 実証）。
- `rg '設計書からの逸脱' src-tauri/src/` が 0 件。
- `npm test` green。`IntegrityCheckPage.test.tsx` が UI-13-D9 の契約文言を**可視要素**（`toBeVisible()` + dialog 内 scope）で assert（T7/T8）: ボタン「補正を確定」/ AlertDialogTitle「在庫数を入出庫の合計に合わせて補正します」/ 可視 AlertTitle + AlertDescription の結合 = 契約説明文と完全一致 / sr-only AlertDialogDescription = 契約説明文全文と完全一致。
- `rg -n '棚卸し補正|現在の在庫数|移動記録の合計' src/features/integrity-check/` が 0 件（確定 flow の旧語彙全廃）。
- `OperationLogsPage.test.tsx` が `integrity_fix` ログの「商品コード / 旧在庫 → 新在庫 / 差分」表示を**専用一覧 container 内に scope** して assert し、「技術情報（JSON）」折りたたみ内 raw JSON 保持を assert（T9/T10）。
- 実 mutation 実測: X1（ログを commit 後へ戻す）/ X2（quantity=0 marker movement 挿入）/ X4（旧文言復帰）が対応テストで red になる（Test Design Matrix `Mutation-style Adequacy Questions` 全 5 種のうち Writer 完了条件は X1/X2/X4、残りは independent-review で実測）。
- `npm run typecheck` / `npm run lint` / `npm run format:check` 全通過、`bash scripts/doc-consistency-check.sh` 通過、`cargo run --bin generate_traceability` 再生成で差分が 90-traceability の REQ-904 行のみ（doc-consistency / traceability は npm script ではないため呼び出し形式を明示 — rally round 2 指摘）。
- `integrity_cmd.rs` のテストが実コマンド関数を呼んでいる（ロジック複製 assert の残存 0）。

## Design Sources

- Requirements / spec: REQ-904（整合性チェック: 在庫数突合 / 修復）
- Architecture: `docs/architecture/biz-task-specs.md` BIZ-07 / `docs/architecture/ui-task-specs.md` UI-13
- Function / command / DTO: `docs/function-design/36-biz-integrity-check.md` §21.4 / §21.6 / §21.7
- DB: `docs/DB_DESIGN.md` 復旧方針（D-051 Impact 反映済み）、operation_logs / inventory_movements
- Screen / UI: `docs/function-design/75-ui-integrity-check.md` UI-13-D9 / `docs/function-design/74-ui-operation-logs.md` UI-11c-D14 / UI-11c-D6
- Decision log / ADR: `docs/decision-log.md` D-051（+ 旧・第4段階先決事項D-6 の明示例外）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 36-biz §21.4（TX 構造・エラー）§21.7（oracle） | existing sufficient（PR #19 で正本確定済み） |
| Command / DTO / generated binding / wire shape | detail_json shape は 36-biz §21.4 / D-051 Audit 節に確定済み。cmd シグネチャ変更なし → bindings 再生成不要 | existing sufficient |
| DB / transaction / audit / rollback / migration | 36-biz §21.4 ステップ 4 + D-051 Audit 節（同一 TX 必須・失敗 rollback） | existing sufficient |
| Screen / UI / route state / Japanese wording | 75-ui UI-13-D9 / 74-ui UI-11c-D14（文言・表示形式の契約文あり） | existing sufficient |
| CSV / TSV / report / import / export format | 非該当 | — |
| Durable decision / ADR | D-051 | existing sufficient |

## Registration / Generation Obligations

新規 Tauri command / function-design doc / route / operator 画面は該当なし。REQ coverage: T1〜T6 のテスト追加で 90-traceability の REQ-904 行（ファイル別テスト件数）が**確実に**変わるため、`cargo run --bin generate_traceability` による再生成を本 PR の義務とする（AUTO-GENERATED 維持、手動編集禁止のまま。Codex 先行 review P2-3 — generator は Rust テスト関数名を集計するため「場合により」ではない）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-904 | 36-biz §21.4 ステップ4 | BIZ-07-D3 | 補正の唯一の監査痕跡を TX 内必須化。best-effort 継続は「痕跡なしの在庫直接書換え」を許すため rejected | `integrity_service.rs` `fix_integrity` | T1 / T2 |
| REQ-904 | 36-biz §21.4 / D-051 rejected ①② | BIZ-07-D2 | movement 挿入は数学的に収束せず原本を汚染。marker 行は schema 追加設計が過剰 | 同上（挿入しない現行維持 + コメント正本化） | T3 |
| REQ-904 | 36-biz §21.6 | BIZ-07-D4 | 収束性の観測可能 oracle 化（mismatches 非出現 = difference 0 と等価） | 同上 | T4 / T5 |
| REQ-904 | 75-ui §UI-13-D9 | UI-13-D9 | 補正は棚卸しではない（D-051 意味論）。「棚卸し」語彙は operator の概念を汚染 | `IntegrityCheckPage.tsx` | T7 / T8 |
| REQ-904 | 74-ui §UI-11c-D14 | UI-11c-D14 | adjustments は唯一の監査痕跡であり、生 JSON では operator が読めない | `OperationLogsPage.tsx` | T9 / T10 / T11 / T12 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes（D-051 + 36-biz §21.4/§21.6/§21.7 + 75-ui/74-ui で完結）。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: なし（本 packet は既確定正本への追随のみ。probe P2 不成立時の backlog 差し戻しは packet 記録で足りる）。
- Assumptions and constraints: `insert_operation_log` が Transaction 参照で呼べること（Contract Probe P3）。SQLite trigger による INSERT 失敗注入がテストで機能すること（P1）。
- Deferred design gaps, risk, and follow-up target: 順 4（mutation→consumer query 契約）は本 PR 完了後の次是正。
- Test Design Matrix can cite design decision IDs or source doc sections: yes（各行に BIZ-07-D* / UI-*-D* を付与）。
- Absolute guarantee / escape hatch self-check completed: 「必須記録」の絶対保証は T1 の失敗注入で実証する。escape hatch（ログ失敗でも補正を通す経路）は仕様上存在しない — `run_integrity_check` の best-effort ログは §21.3 契約でありこの保証の例外ではない（対象 TX が異なる）。互換性: 既存の `integrity_fix` ログ読取側（UI-11c）は detail_json shape 不変のため互換。

## Impact Review Lenses

not applicable — 実地調査・実機・外部ツール・POS 連携・帳票形式変更を含まない。設計正本確定済みのコード追随のため、レンズは Plan Gate の contract 突合で代替する。

## Design Readiness

- Existing design docs are sufficient because: D-051 / 36-biz §21.4・§21.6・§21.7 / UI-13-D9 / UI-11c-D14 が PR #19 の Double Audit（mutation testing 込み）を通過した正本として存在し、実装 follow-up の scope・oracle・文言まで具体指定済み。
- Source docs updated in this PR: なし（traceability 自動再生成を除く）。
- Design gaps intentionally deferred: UI-11c-D14 の一覧の具体 component 構造（table か dl か）は契約が表示内容のみ規定するため Writer 裁量。既存 `Detail` component のパターン（dt/dd）踏襲を推奨として発注書に記載。
- Durable decisions discovered in this plan and promoted to source docs: なし。

Minimum design checks:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 変更は BIZ（integrity_service）と UI（2 画面）に閉じる。CMD は scope 6 のテストのみ、IO/MNT 非接触。
- Backend function design: §21.4 ステップ列と 1:1 対応（TX 開始 → 対象取得 → 補正 → ログ → commit）。
- Command / DTO / data contract: cmd シグネチャ・DTO・bindings 変更なし。
- Persistence / transaction / audit impact: TX 境界変更が本 PR の核。rollback 経路を T1 で実証。
- Operator workflow / Japanese UI wording: UI-13-D9 の契約文言へ完全一致同期。UI-11c は「商品コード / 旧在庫 → 新在庫 / 差分」の日本語ラベル。
- Error, empty, retry, and recovery behavior: ログ失敗 = `BizError::DatabaseError`（既存 kind、frontend 文言変更なし）。adjustments 欠落/空の degrade は T12。
- Testability and traceability IDs: REQ-904 系テスト命名 + traceability 再生成。

## Contract Probe

外部未検証前提なし（N/A）。当初 probe 対象とした 3 前提は、Codex 先行 review（2026-07-22）でいずれも既存 repo 内 precedent により verified 済みと確認されたため、実験ではなく実装方式の参照先として記録する:

- P1（SQLite trigger による operation_logs INSERT 失敗注入）: `src-tauri/src/mnt/restore.rs` のテストに同型 precedent（`CREATE TRIGGER ... BEFORE INSERT ON operation_logs WHEN NEW.operation_type = '...' BEGIN SELECT RAISE(ABORT, ...); END`）が実在 -> verified。T1 はこの方式を踏襲する。
- P2（tauri::test mock での CMD 実呼び）: `src-tauri/src/cmd/stocktake_cmd.rs` のテストに `tauri::test::mock_builder().manage(app_state_for_test(conn)).build(...)` + `app.state::<AppState>()` の precedent が実在 -> verified。T6 はこの方式を踏襲する。`fix_integrity` は同期関数（async ではない）のため直接呼び出し。
- P3（`insert_operation_log` の Transaction 対応）: シグネチャは `&DbConnection`（`src-tauri/src/db/system_repo.rs`）で、`&Transaction` を渡す既存呼出しが `src-tauri/src/biz/product_service.rs` に実在（rusqlite `Transaction` の `Deref<Target = Connection>`）-> verified。シグネチャ変更不要。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| BIZ-07-D3（同一 TX 必須ログ・失敗 rollback） | `integrity_service.rs` `fix_integrity` | T1（失敗注入）/ T2（detail_json 具体値） | — |
| BIZ-07-D2（movement 不挿入） | 同上（現行維持 + コメント正本化） | T3（行数不変） | — |
| BIZ-07-D4（収束性） | 同上 | T4（mismatches 非出現）/ T5（SQL 等式） | — |
| §21.4 エラーハンドリング（ログ失敗 → DatabaseError） | 同上 | T1 | — |
| BIZ-07-D1（movements 原本 / stock 派生 cache） | 同上 | T5（SQL 等式 = 派生関係の直接検査） | — |
| INV-2（stock_after 算出責任 — fix は movement を作らず `apply_stock_change` 非経由） | 同上 | T3（movement 不挿入で間接検証） | — |
| INV-3（負の movements_sum → 負在庫へ補正） | 同上 | 既存 `test_fix_integrity_req904_negative_movements_sum`（維持必須、削除・skip 不可） | — |
| INV-4（is_voided=0 のみ合計、movement 0 件は COALESCE 0） | 同上 | T2 / T5（fixture に voided movement + movement 0 件商品） | — |
| INV-8（products 物理 DELETE 禁止・既存 movement 非破壊） | 同上 | T3（行数 + 既存行 snapshot 不変） | — |
| §21.4 skipped 契約（不存在商品 / difference 0 → skipped_count++） | 同上 | T2（skipped_count 検証を含む） | — |
| UI-13-D9（確定 flow 文言 3 点 + 可視/accessible copy 全数） | `IntegrityCheckPage.tsx` | T7 / T8 | human visual confirmation（synthetic fixture screenshot） |
| UI-11c-D14（adjustments operator-readable 一覧 + 技術情報（JSON） raw 保持） | `OperationLogsPage.tsx` | T9 / T10 / T12 / T13 | human visual confirmation（synthetic fixture screenshot） |
| UI-11c-D6（既知 key 要約・§74.8 共通防御の現行維持） | 同上 | T11（非 integrity_fix 表示不変）+ T13（上限迂回なし） | — |
| REQ-904 CMD validation（空 codes） | `integrity_cmd.rs`（Scope 6） | T6（実呼び） | — |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-22-integrity-fix-semantics-impl.md](test-matrices/2026-07-22-integrity-fix-semantics-impl.md)

- targeted tests: T1〜T13（Matrix 参照）
- negative tests: T1（失敗注入）、T6（空 codes validation）、T12（malformed adjustments degrade）、T13（巨大 payload 上限）
- compatibility checks: T11（既存 operation type 表示不変）、detail_json shape 不変（読取側互換）
- data safety checks: テストは in-memory / 一時 DB + synthetic データのみ。実在庫データ非使用。
- main wiring/integration checks: cmd 登録・bindings・route 変更なしのため bindings / routes は差分ゼロ。90-traceability は REQ-904 のテスト件数が確実に変わるため `cargo run --bin generate_traceability` で再生成し、REQ-904 行の生成差分のみ許容。
- Human Gate visual confirmation: Writer が synthetic fixture で UI-13 確定 dialog（新文言）と UI-11c `integrity_fix` 詳細（adjustments 一覧 + 技術情報（JSON））のスクリーンショットを PR に添付し、owner が目視確認する。Windows native L3 は not-required（画面別の独立根拠は Workflow State `Human Gate` 欄参照。実機確認は roadmap 1-4 受入テストへ集約）。
- Writer 完了条件に `cargo check --release` を含める（L3 非依存で維持 — 全 gate が debug profile のため release compile 断絶の早期検出として。memory `project-release-build-blind-spot`）。

## Boundary / Wire Contract

- producer: `integrity_service.rs` `fix_integrity`（operation_logs.detail_json）
- consumer: `OperationLogsPage.tsx`（詳細表示）
- wire type: detail_json 内 `adjustments: [{ product_code: string, old_stock: number, new_stock: number, adjustment: number }]`
- internal type: Rust 側は serde_json で構築、TS 側は unknown からの narrowing（既存 Detail component パターン）
- precision/range: Rust 側 i64、小数なし。JS number は i64 全域を正確に表現できないため、specialized 表示は `Number.isSafeInteger` を境界とする（範囲外を operator 可視の監査痕跡として誤値描画しない）
- round-trip path: BIZ 書込み → SQLite TEXT → UI parse。shape は現契約から不変（表示側の解釈のみ追加）
- invalid input: adjustments 欠落 / 空配列 / 非配列型 / 要素 field の欠落・null・型不一致 / `Number.isSafeInteger` 不成立は、specialized 一覧を生成せず既存の汎用表示（raw 技術情報（JSON））へ degrade（エラーにしない、T12）。**型として正当な string の product_code は内容が hostile（HTML 断片・制御文字等）でも degrade 対象ではなく**、§74.8 の text-only 原則どおり specialized 一覧内に plain text として安全描画する（T9 で assert、rally round 2 指摘の反映）。safe-integer 境界は UI-11c-D14 既存の「不正 JSON の安全な degrade」の一 instance として packet 内判断に留め、74-ui の改訂はしない（durable 契約への昇格が必要になったら decision-log 起票で再判定）
- compatibility: 過去に書かれた `integrity_fix` ログ（TX 外時代のもの）も同 shape のため新表示で読める

## Review Focus

- TX 順序逆転（補正 → commit → ログ を 補正 → ログ → commit へ）の rollback 完全性: ログ失敗時に**部分確定が一切残らない**こと。
- oracle の tautology 回避: T1〜T5 が実装をコピーした自己 assert になっていないこと（PR #15/#17 の教訓 = 推論でなく実 mutation で確認）。
- UI-13-D9 文言の**完全一致**（要約・言い換え・句読点差異を許さない）、かつ**可視要素**での一致（sr-only だけの契約充足を許さない）。
- UI-11c の specialized 一覧が §74.8 共通防御（parse / 上限 / text-only）を早期 return で迂回していないこと、既存 operation type 表示に副作用を出していないこと。

## Spec Contract

Contract ID: SPEC-BIZ07-IMPL-1

- `fix_integrity` は「TX 開始 → 対象取得 → stock_quantity を movements_sum へ直接更新（movement 行追加なし）→ 同一 TX 内で `integrity_fix` 操作ログ INSERT（adjustments 4 フィールド必須）→ commit」の順で実行し、ログ INSERT 失敗時は TX 全体を rollback して `BizError::DatabaseError` を返す。
- 成功直後（介在 write なし）の `run_integrity_check` mismatches に補正対象 product_code は現れない。
- UI-13 確定 flow の 3 文言は 75-ui UI-13-D9 の契約文字列と完全一致する。
- UI-11c は `integrity_fix` の adjustments を「商品コード / 旧在庫 → 新在庫 / 差分」で一覧表示し、raw JSON を折りたたみ「技術情報」に保持する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| BIZ-07-D3 | Scope 1 | T1 / T2 | rollback 完全性 | cargo test 出力 + X1/X3 mutation red |
| BIZ-07-D2 | Scope 1 / 2 | T3 | marker 行再侵入なし | X2 mutation red + `rg '設計書からの逸脱'` 0 件 |
| BIZ-07-D4 | Scope 1 | T4 / T5 | 収束 oracle の等価性 | cargo test 出力 |
| UI-13-D9 | Scope 3 | T7 / T8 | 文言完全一致（可視） | npm test 出力 + X4 mutation red + visual confirmation |
| UI-11c-D14 | Scope 4 | T9 / T10 / T12 / T13 | 表示分岐の副作用・防御迂回 | npm test 出力 + X5 mutation red + visual confirmation |
| UI-11c-D6 | Scope 4 | T11 | 既存表示不変 | npm test 出力 |
| REQ-904 (CMD) | Scope 6 | T6 | 実コマンド呼び出しへの置換 | cargo test 出力（precedent = stocktake_cmd.rs） |

## Data Safety

- 実店舗の在庫・売上データを含むファイル・スクリーンショットを commit しない（テストは synthetic のみ）。
- local-only paths: なし（本 PR で新規に生じない）。
- synthetic-only paths: `src-tauri` テスト内の一時 DB / in-memory DB。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

**State compression record（append-only、2026-07-22）**: implementing への state commit は plan-draft → plan-gate → plan-approved → implementing の隣接 forward 連続を一括実体化する。中間遷移の既存証跡: plan-gate = Codex 先行 plan review + self rally 4 round（`e7939f5`〜`62a4b16`、round 4 で新規指摘 0 収束 — 下記各 round 記録参照）。plan-approved = owner 承認 2026-07-22（介入 1/2、「plan 承認 → implementing 遷移 + Codex 実装発注」を明示承認）。gate skip なし。

- Plan Review round 1（Codex 先行、2026-07-22、read-only 発注）: P1×3（PK2/PK4 機械 gate 失敗 + probe の precedent 未反映 / L3 が 75-ui §75.12 の対象外規定と衝突 / UI-13 の可視・sr-only 文言の捕捉漏れ）+ P2×3（§74.8 共通防御の迂回リスクと T9 の screen-wide assert 弱点 / §21.6 隣接契約〈D1・INV-2/3/4/8・skipped〉の Ledger 不足 / traceability 再生成を条件付きとした誤り）+ P3×2（i64→JS number 境界 / 誤字）。Coordinator が全主張を実コード・正本の実読で裏取りし**全 accept**（P3-1 は 74-ui 非改訂の縮小採用 = 既存 degrade 契約の instance 扱い）、本 packet / Matrix / Plans.md へ反映済み。
- Self rally round 1（Plan agent 独立 context、Codex findings 非開示、2026-07-22）: 重要×2 + 軽微×1 — ①UI-11c への L3 not-required 根拠が §75.12 の誤用（UI-13 限定規定の拡張適用）→ 画面別独立根拠へ是正 ②可視 AlertDescription を契約全文にすると AlertTitle と同一フレーズ 2 連続 → StocktakePage 確立パターン（Title/Description 分割 + sr-only 結合文）採用 ③T13 の件数境界が Writer 裁量 → §74.8 の 20 key 方式に倣う先頭 20 件 + 残数行で確定。全件 accept・実読裏取り済み・反映済み。観点 1/2/3/7 は新規指摘なし（Contract Probe 3 前提の precedent 成立を独立実読で再確認）。
- Self rally round 2（同上、2026-07-22）: 重要×3 + 軽微×2 — ①adjustments の汎用 dt/dd 重複表示リスク → Scope 4 に除外指示 + T9 否定 assert ②T12 の hostile 文字列 degrade が Boundary Contract と矛盾 → 構造的欠陥のみ degrade、型正当な hostile 文字列は text-only 安全描画（T9 ②）へ分離 ③テスト命名の `_req904_` 保持を明記（generate_traceability の抽出 regex を実読確認）④Plans.md の plan commit SHA 複製を廃止（packet を正に）⑤AC の検査コマンドを実行可能形式へ分離。全件 accept・反映済み。観点 1/5/7 は新規指摘なし、Ledger 全行の T カバレッジ確認済み。
- Self rally round 3（同上、2026-07-22）: 重要×2（いずれも round 1 是正が生んだ新矛盾）— ①Matrix Residual Gaps の L3 根拠が §75.12 単独のまま未伝播 → 画面別根拠へ同期 ②「roadmap 1-4 で操作ログ確認を一気通貫」は Plans.md 実文言に存在しない未検証前提 → 一次根拠を DEV_WORKFLOW `L3 Eligibility` 条件 (3)（synthetic row insertion は自動テストへ route、L3-7/L3-8 waive がこの規則の起源）へ差替え、1-4 台本への追加は将来の検討事項へ降格（本判断の根拠から除外）。両件 accept・正本実読で裏取り・反映済み。観点 2/4/5/6/7 は新規指摘なし、round 1〜2 是正の有効性は確認済み。
- Self rally round 4（closure 確認、2026-07-22）: **新規指摘なし、収束**（致命 0 + 重要 0）。round 3 是正の三者突合（packet Human Gate ↔ Matrix Residual Gaps ↔ DEV_WORKFLOW L3 Eligibility 実文言）クリーン、Contract Probe 3 前提・現状コード記述・Ledger/T/X の 1:1 対応・traceability 抽出仕様を独立再確認。実装発注可の判定。

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.

- Findings Freeze: not yet frozen; post-freeze exceptions: none.
