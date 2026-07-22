# Plan Packet — 監査是正 順 3 実装 follow-up: 整合性補正 D-051 意味論のコード追随

## Workflow State

- Phase: plan-draft
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable（main thread）
- Writer: Codex（実装発注、レビュー前に PR 作成）
- Plan Reviewer: Codex 先行 plan review（考慮漏れ観点付き）→ Fable 裁定・修正 → Plan agent self rally（Codex findings 非開示の独立 critique、新規指摘 0 まで）。今回の試行順序（通常の rally 先行と逆順）。
- Final Reviewer: 独立 fresh context（Double Audit 2 pass 想定: 1 pass = Fable inline 契約突合 / 2 pass = Codex 独立 + 実 mutation）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Ready 承認 + Windows native L3 軽量 2 項目（下記 Test Plan の L3-1/L3-2）

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 30分
- relay 往復上復上限: 2

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
3. **UI-13-D9 文言同期**: `src/features/integrity-check/IntegrityCheckPage.tsx` の 3 箇所（確定ボタン「補正を確定」/ dialog title「在庫数を入出庫の合計に合わせて補正します」/ 説明「補正すると元に戻せません。選択した商品のシステム在庫を入出庫の合計に合わせて更新し、操作ログに記録します。」）を 75-ui UI-13-D9 の契約文言へ完全一致で同期。`IntegrityCheckPage.test.tsx` の当該文言 assert（archived packet 記載の 4 箇所、実装時に rg で全数特定）を同期。
4. **UI-11c-D14 operator-readable 表示**: `src/features/operation-logs/OperationLogsPage.tsx` の詳細表示に、`integrity_fix` の `adjustments[]` を「商品コード / 旧在庫 → 新在庫 / 差分」の一覧としてレンダリングする分岐を追加。生 JSON は折りたたみ「技術情報」に残す（74-ui UI-11c-D14）。既知 key 要約（UI-11c-D6）は現行維持。`OperationLogsPage.test.tsx` に表示 assert を追加。
5. **§21.7 の 3 oracle テスト実装**（`src-tauri` テスト、Test Design Matrix T1〜T5）:
   - 失敗系: SQLite trigger（`BEFORE INSERT ON operation_logs ... RAISE(ABORT)` 相当）で `integrity_fix` ログ INSERT を注入失敗させ、`BizError::DatabaseError` / 全対象商品の stock_quantity 不変 / inventory_movements 行数増 0 を assert。
   - 成功系: detail_json.adjustments[] の 4 フィールド具体値 + 補正前後で inventory_movements の総行数・対象商品ごとの行数不変。
   - 収束系: 補正成功直後の `run_integrity_check` mismatches に adjustments[].product_code 非出現 + 同一 committed state での SQL 等式 `stock_quantity = SUM(quantity WHERE is_voided = 0)`。
6. **`src-tauri/src/cmd/integrity_cmd.rs` tautological test の実呼び化**（条件付き in-scope）: Contract Probe P2（tauri::test mock での State 構築 + cmd 実呼び）が成立した場合、既存 `test_fix_integrity_req904_empty_codes_validation` をロジック複製から実コマンド呼び出しへ置換。probe 不成立の場合は本項を scope から外し、不成立の実験記録を packet に残して backlog へ差し戻す（AC からも外れる）。

## Non-scope

- `run_integrity_check` のロジック・`integrity_check` 操作ログの TX 化（§21.3 契約どおり best-effort のまま）。
- `OperationLogsPage.tsx` の `integrity_fix` 以外の operation type の表示ロジック変更（`integrity_check` 種別を含む）。
- 順 4（mutation→consumer query 契約）、UI-13 補正成功後 invalidation 契約の変更。
- 設計書・decision-log の内容変更（正本確定済み。90-traceability の自動再生成のみ、テスト追加で REQ coverage が変わる場合に発生し得る）。
- MNT-02 保持期間（365 日）等 retention 方針の変更。

## Acceptance Criteria

- `cargo test`（workspace）green。うち §21.7 対応テスト T1〜T5 が存在し green（テスト名は Test Design Matrix の ID を含む命名）。
- 失敗注入テスト（T1）が「ログ INSERT 失敗 → `BizError::DatabaseError` + 全対象 stock_quantity 不変 + movements 行数増 0」を assert している（rollback 実証）。
- `rg '設計書からの逸脱' src-tauri/src/` が 0 件。
- `npm test` green。`IntegrityCheckPage.test.tsx` が UI-13-D9 の 3 文言（ボタン / title / 説明）を契約文言の完全一致で assert（T7/T8）。
- `OperationLogsPage.test.tsx` が `integrity_fix` ログの「商品コード / 旧在庫 → 新在庫 / 差分」表示と「技術情報」折りたたみ内 raw JSON を assert（T9/T10）。
- 実 mutation 実測: X1（ログを commit 後へ戻す）/ X2（quantity=0 marker movement 挿入）/ X4（旧文言復帰）が対応テストで red になる（Test Design Matrix `Mutation-style Adequacy Questions` 全 5 種のうち Writer 完了条件は X1/X2/X4、残りは independent-review で実測）。
- `npm run typecheck` / lint / format / doc-consistency / traceability 全通過。
- Scope 6 が in-scope 確定した場合: `integrity_cmd.rs` のテストが実コマンド関数を呼んでいる（ロジック複製 assert の残存 0）。

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

該当なし（新規 Tauri command なし / function-design doc 新設なし / route 新設なし / operator 画面新設なし）。REQ coverage はテスト追加により `cargo run --bin generate_traceability` の再生成が必要になる場合のみ実施（AUTO-GENERATED 維持）。

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

- P1（SQLite trigger による INSERT 失敗注入）: テスト DB に `CREATE TRIGGER ... BEFORE INSERT ON operation_logs ... SELECT RAISE(ABORT, ...)` を張り、`insert_operation_log` が Err になることを最小 Rust テストで確認 -> pending（Writer 着手時の最初の probe。是正仮適用状態で end-to-end）
- P2（tauri::test mock で `integrity_cmd::fix_integrity` 実呼び）: `tauri::test` feature（PR #159 で dev-dependency 導入済み）で State<AppState> を構築し cmd 関数を直接 await できるか最小実験 -> pending（不成立なら Scope 6 を backlog へ差し戻し、実験記録を本節に残す）
- P3（`insert_operation_log` の Transaction 対応シグネチャ）: `system_repo::insert_operation_log` が `&Transaction`（または Deref で Connection 互換）を受けられるか実コード確認 -> pending（シグネチャ変更が必要なら scope 1 に含め、他呼出箇所への影響を sweep）

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| BIZ-07-D3（同一 TX 必須ログ・失敗 rollback） | `integrity_service.rs` `fix_integrity` | T1（失敗注入）/ T2（detail_json 具体値） | — |
| BIZ-07-D2（movement 不挿入） | 同上（現行維持 + コメント正本化） | T3（行数不変） | — |
| BIZ-07-D4（収束性） | 同上 | T4（mismatches 非出現）/ T5（SQL 等式） | — |
| §21.4 エラーハンドリング（ログ失敗 → DatabaseError） | 同上 | T1 | — |
| UI-13-D9（確定 flow 文言 3 点） | `IntegrityCheckPage.tsx` | T7 / T8 | L3-1（実機で dialog 文言目視） |
| UI-11c-D14（adjustments operator-readable 一覧 + 技術情報 raw JSON） | `OperationLogsPage.tsx` | T9 / T10 / T12 | L3-2（実補正 → 操作ログ画面で一覧目視） |
| UI-11c-D6（既知 key 要約の現行維持） | 同上 | T11（非 integrity_fix 表示不変） | — |
| REQ-904 CMD validation（空 codes） | `integrity_cmd.rs`（Scope 6、P2 成立条件付き） | T6（実呼び） | probe 不成立時は non-scope（backlog 差し戻し） |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-22-integrity-fix-semantics-impl.md](test-matrices/2026-07-22-integrity-fix-semantics-impl.md)

- targeted tests: T1〜T12（Matrix 参照）
- negative tests: T1（失敗注入）、T6（空 codes validation）、T12（adjustments 欠落 degrade）
- compatibility checks: T11（既存 operation type 表示不変）、detail_json shape 不変（読取側互換）
- data safety checks: テストは in-memory / 一時 DB + synthetic データのみ。実在庫データ非使用。
- main wiring/integration checks: cmd 登録・bindings・route 変更なしのため L1 full の生成系検査で差分ゼロを確認。
- Human Gate L3（軽量 2 項目）: L3-1 = 整合性検証画面で差異商品を補正 → 確定 dialog の title/説明/ボタンが新文言であること。L3-2 = 補正後に操作ログ画面で `整合性補正` ログを開き「商品コード / 旧在庫 → 新在庫 / 差分」一覧と「技術情報」折りたたみが見えること。
- Writer 完了条件に `cargo check --release` を含める（L3 前提、memory `project-release-build-blind-spot`）。

## Boundary / Wire Contract

- producer: `integrity_service.rs` `fix_integrity`（operation_logs.detail_json）
- consumer: `OperationLogsPage.tsx`（詳細表示）
- wire type: detail_json 内 `adjustments: [{ product_code: string, old_stock: number, new_stock: number, adjustment: number }]`
- internal type: Rust 側は serde_json で構築、TS 側は unknown からの narrowing（既存 Detail component パターン）
- precision/range: 在庫数は i64 整数のみ、小数なし
- round-trip path: BIZ 書込み → SQLite TEXT → UI parse。shape は現契約から不変（表示側の解釈のみ追加）
- invalid input: adjustments 欠落 / 空配列 / 型不一致は既存の生 JSON 表示へ degrade（エラーにしない、T12）
- compatibility: 過去に書かれた `integrity_fix` ログ（TX 外時代のもの）も同 shape のため新表示で読める

## Review Focus

- TX 順序逆転（補正 → commit → ログ を 補正 → ログ → commit へ）の rollback 完全性: ログ失敗時に**部分確定が一切残らない**こと。
- oracle の tautology 回避: T1〜T5 が実装をコピーした自己 assert になっていないこと（PR #15/#17 の教訓 = 推論でなく実 mutation で確認）。
- UI-13-D9 文言の**完全一致**（要約・言い換え・句読点差異を許さない）。
- UI-11c の分岐追加が既存 operation type 表示に副作用を出していないこと。
- Scope 6 の probe 判定が曖昧なまま実装に入っていないこと。

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
| UI-13-D9 | Scope 3 | T7 / T8 | 文言完全一致 | npm test 出力 + X4 mutation red + L3-1 |
| UI-11c-D14 | Scope 4 | T9 / T10 / T12 | 表示分岐の副作用 | npm test 出力 + X5 mutation red + L3-2 |
| UI-11c-D6 | Scope 4 | T11 | 既存表示不変 | npm test 出力 |
| REQ-904 (CMD) | Scope 6 | T6 | probe 判定の明示 | probe 記録 + cargo test 出力 |

## Data Safety

- 実店舗の在庫・売上データを含むファイル・スクリーンショットを commit しない（テストは synthetic のみ）。
- local-only paths: なし（本 PR で新規に生じない）。
- synthetic-only paths: `src-tauri` テスト内の一時 DB / in-memory DB。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.

- Findings Freeze: not yet frozen; post-freeze exceptions: none.
