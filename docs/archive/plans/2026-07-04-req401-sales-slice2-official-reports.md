# Plan Packet: REQ-401 SALES 第2スライス — official 日報のレポート表示（BIZ-05 拡張 + UI-09a/b + CTA）

## Risk

Risk: R3

Reason:
Tauri command DTO（`DailySalesReport` / `MonthlySalesReport`）の wire shape 拡張、generated bindings 再生成、日次/月次レポートの reporting semantics（公式日報 vs 商品別明細の分離）、operator-facing 画面変更を含む。DEV_WORKFLOW R3 規定により Plan Packet + Test Matrix + targeted gates + review-only（Codex 実装のため orchestrator 受け入れレビューで代替）+ Windows native L3。

## Goal

PR #125（第1スライス）で保存できるようになった `daily_report_*`（Z001/Z002/Z005 由来の公式日報）を、日次売上（UI-09a）・月次売上（UI-09b）で商品別明細と**分離したまま**表示できるようにする（D-025「BIZ-05 reports must distinguish official daily report aggregates from item-level sales details」の実装）。あわせて日報取込み結果画面から「日次売上を見る」CTA で当該日のレポートへ遷移できるようにする（第1スライスで T15 failure mode 回避のため defer した項目の回収）。

## Scope

実装順序は「official 表示 → CTA」を厳守する（CTA を先に入れると、第1スライスが defer した理由 = 空の商品別明細への誘導で「売上なし」誤読、を再度踏むため）。

### Backend（IO-01 / BIZ-05 / CMD-09）

1. `sales_repo.rs`: `get_latest_completed_daily_report(conn, report_date)`（24-io §14.21。`report_date=? AND status='completed'` の最新 1 件 + payment/department lines を `sort_order ASC, id ASC` で取得）
2. `sales_repo.rs`: `get_monthly_official_department_totals(conn, date_from, date_to)`（24-io §14.22。completed 親対象、department_id/label 単位集計。対象日報 0 件 → `Ok(None)`、あれば `Ok(Some(rows))`）
3. `biz/sales_service.rs`: `OfficialDailyReportSummary` / `OfficialDailyPaymentLine` / `OfficialDailyDepartmentLine` / `OfficialMonthlyDepartmentTotal` の 4 型定義（34-biz §19.2、`Serialize` + `specta::Type`）
4. `DailySalesReport` に `official_daily_report: Option<OfficialDailyReportSummary>` 追加 + `get_daily_sales` ステップ 3（34-biz §19.3。未取込みは `None` = 正常系。`items` を日報から水増ししない）
5. `MonthlySalesReport` に `official_department_totals: Option<Vec<OfficialMonthlyDepartmentTotal>>` 追加 + `get_monthly_sales` ステップ 6（34-biz §19.4。mode に関係なく常に返す）
5b. `OfficialDailyReportSummary.warnings` の生成仕様を確定実装する（SALES2-D5）: `department_lines` に `department_id IS NULL` 行が n 件あるとき「部門マスタと対応していない部門が n 件あります（部門名のまま表示しています）」を 1 件追加。それ以外は空配列。設計正本は型のみ定義し生成仕様が未記載のため、本決定を 34-biz docs 同期（Scope 15）で §19.3 へ昇格する。永続データから導出できない preview 時警告（37-biz §37.3 step 7）は復元しない
6. `cmd/sales_cmd.rs` は `sales_service::DailySalesReport` / `MonthlySalesReport` をそのまま返す transparent passthrough（`sales_cmd.rs:38,56`、42-cmd §22.4「そのまま返す」）のため、**CMD 側の修正は不要**。BIZ 型へのフィールド追加だけで wire へ透過する（コマンドシグネチャ不変）
7. `cargo run --bin generate_bindings` で `src/lib/bindings.ts` 再生成

### Frontend（UI-09a / UI-09b / UI-07）

8. UI-09a `DailySalesPage`: 「レジ日報（公式）」セクション新設。`official_daily_report` が `Some` のとき日報サマリ（総売上 / 純売上）+ 支払集計 + 部門別集計を表示。`None` のときは 1 行の未取込み note（大仰な EmptyState にしない）。既存の商品別明細・部門小計・SummaryCardsBar とは**表もラベルも混ぜない**（UI-09a-D12）
9. UI-09a: official あり・商品別明細 0 件のとき、商品別明細セクションに「商品別明細は未取込み」系の文言を表示し、「この日の売上なし」と誤読させない（T15 failure mode。文言は 56-ui docs 同期で確定させ L3 で実機確認）
9b. UI-09a: `warnings` が非空のとき公式日報セクション内に注記表示（warning トーン + アイコン + テキスト。データ安全系ではないため上部 Alert 帯は使わない = DSR-03 3 階層整合。色のみ符号化禁止）
10. UI-09b `MonthlySalesPage`: 「公式部門集計（レジ日報由来）」セクション新設。`official_department_totals` を既存 DepartmentTable（商品別由来）と別セクション・別ラベルで表示（UI-09b-D8）。商品ランキングは日報のみの月では空のまま（T17）
11. UI-07 `DailyReportImportPage` の `DailyReportResultStep` に「日次売上を見る」CTA 追加。遷移先は `/reports/daily?date={reportDate}`（取込み対象日。設計判断 SALES2-D2）
12. 視覚言語は既存 UI-09a/b の TabsHeader / SummaryCardsBar / テーブル規約を継承（design-system PR #126 反映後の DSR-03 3 階層 / DSR-08 / catalog ③ に従う。新規視覚言語を発明しない）

### Docs 同期（同一 PR 内）

13. `56-ui-daily-sales.md` / `57-ui-monthly-sales.md`: official 表示のコンポーネント構成・hook 拡張・文言・状態分岐を §56.2 以降 / §57.2 以降へ具体化（現状は冒頭 note + §56.1/§57.1 のみで詳細設計が第1スライス前提のまま）
14. `55-ui-csv-import.md` §55.0 手順 5: CTA 遷移先仕様（`/reports/daily?date={reportDate}`）を明記
15. `34-biz-sales-service.md`: SALES2-D5（warnings 生成仕様）を §19.3 へ**必須昇格**（現行設計は型のみで生成仕様未記載のため差分は確実に発生）。`24-io-csv-import-repo.md` はその他の実装突合差分が出た場合のみ更新

### Tests（設計 matrix T13-T18 + 本 packet 追加分）

16. Rust: T13/T14/T16/T17 + repo 2 関数の直接テスト（テスト名は `_req501` / `_req502`。sales 系既存テストと同一系列で traceability REQ-501/502 行に加算される）
17. Vitest/RTL: T15（DailySalesPage 日報あり明細なし文言）/ T18（MonthlySalesPage official ラベル分離）+ CTA 遷移テスト

## Non-scope

- 「一部日だけ日報がある月」の取込み済み日数表示（34-biz §19.4 L265 が「後続 UI PR で具体化」とする論点）: 本スライスでは official 部門集計の合計表示のみとし、日数 coverage 表示は**明示的に defer**。Plans.md backlog へ「UI-09b 日報 coverage 表示」として記録する（SALES2-D3）
- seed への日報デモデータ追加: L3 は実 bundle を UI から取り込む経路で検証するため不要（第1スライス判断を維持）。L3 手順に「事前に日報取込み操作」を含める
- 日報取込み履歴一覧 UI（Phase 3 以降 defer 維持）/ 取込み直後以外の rollback 導線
- `Z006` / `Z009` / `Z011` / Excel 帳票の取込み
- 既存 Z004 track（IO-02 / BIZ-03 / CMD-07）のロジック変更、Z004 layout A 対応（backlog 維持）
- REQ-403 整合性照合、PLU / CV17 関連
- CSV エクスポート（`export_sales_csv`）への official 集計の追加（既存の商品別明細エクスポートは不変。official 集計のエクスポート要否は利用者要望が出てから）
- SD カード生ファイル同一性確認（owner 調査待ち、blocker ではない）

## Acceptance Criteria

- `cargo test`（src-tauri）全通過。追加テストに `get_daily_sales_includes_official_report_req501` / `get_daily_sales_no_fake_items_req501` / `get_monthly_sales_official_department_totals_req502` / `get_monthly_sales_no_fake_ranking_req502` を含む
- `npm test` 全通過。追加テストに `DailySalesPage` の日報あり明細なし文言テストと `MonthlySalesPage` の official ラベル分離テストを含む
- `cargo run --bin generate_bindings` 後の `src/lib/bindings.ts` に `official_daily_report` / `official_department_totals` が出現し、`git diff --exit-code` で drift なし（CI `Rust generated drift` gate green）
- `cargo fmt --check` / `cargo clippy -- -D warnings` / `npm run typecheck` / `npm run lint` / `npm run build` 全通過
- `./scripts/doc-consistency-check.sh` 全通過（56/57/55 docs 同期後）
- `cargo run --bin generate_traceability -- --check` drift なし（REQ-501/502 行のテスト件数が増える）
- 日報のみ取込み済みの日で `get_daily_sales` を呼んだとき `items` が空配列のまま（水増しなし）で `official_daily_report` が `Some`（T14 テストで evidence）
- Windows native L3: 実 bundle（Z001/Z002/Z005）を UI から取り込み → CTA で日次売上へ遷移 → 公式日報セクション表示 / 商品別明細「未取込み」文言 / 月次 official 部門集計の分離表示を owner 目視確認（チェックリストは L3 依頼時に画面 / 場所 / 合格基準の表形式で提示）

## Design Sources

- Requirements / spec: REQ-401(SP-401 系日報 redesign)、REQ-501 / REQ-502（表示本体）
- Architecture: docs/ARCHITECTURE.md BIZ-05 / POS Adapter Boundary（日報 = daily_report_* 正本、sale_records へ擬似展開しない）
- Function / command / DTO: [34-biz-sales-service.md](../../function-design/34-biz-sales-service.md) §19.2-19.4 / [24-io-csv-import-repo.md](../../function-design/24-io-csv-import-repo.md) §14.21-14.22 / [42-cmd-sales-stocktake.md](../../function-design/42-cmd-sales-stocktake.md)
- DB: [db-design/pos-tables.md](../../db-design/pos-tables.md) daily_report_* 4 テーブル（migration v4 済み、本スライスでスキーマ変更なし）
- Screen / UI: [56-ui-daily-sales.md](../../function-design/56-ui-daily-sales.md) §56.1 / [57-ui-monthly-sales.md](../../function-design/57-ui-monthly-sales.md) §57.1 / [55-ui-csv-import.md](../../function-design/55-ui-csv-import.md) §55.0 手順 5 / design-system PR #126（DSR-03 3 階層 / catalog ③）
- Decision log / ADR: D-025（日報と商品別売上の分離）/ UI-09a-D12 / UI-09b-D8

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 34-biz §19.2-19.4 / 24-io §14.21-14.22 | existing sufficient |
| Command / DTO / generated binding / wire shape | 42-cmd（DTO は BIZ 型の透過。additive optional フィールド） | existing sufficient（差分が出たら同 PR 更新） |
| DB / transaction / audit / rollback / migration | 変更なし（読み取りのみ追加） | 該当なし |
| Screen / UI / route state / Japanese wording | 56-ui / 57-ui の official 表示詳細、55-ui の CTA 遷移先仕様 | **updated in this PR**（Scope 13-14） |
| CSV / TSV / report / import / export format | 変更なし | 該当なし |
| Durable decision / ADR | SALES2-D1〜D5（下記 Trace）を 34-biz/55/56/57 docs 同期時に該当設計書へ記録 | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-501 / D-025 | 34-biz §19.3 / 56-ui §56.1 | UI-09a-D12（既存） | 公式日報と商品別明細を 1 表に混ぜると正本が曖昧になり会計上の誤読を生む。代替案（items へ擬似行注入）は D-025 で棄却済み | sales_repo §14.21 + get_daily_sales + DailySalesPage 公式セクション | T13 / T14 / T15 |
| REQ-502 / D-025 | 34-biz §19.4 / 57-ui §57.1 | UI-09b-D8（既存） | 公式部門集計と商品ランキングは母集団が異なる（全売上 vs PLU 登録済み商品のみ）。混合表示は傾向誤読を生む | sales_repo §14.22 + get_monthly_sales + MonthlySalesPage 公式セクション | T16 / T17 / T18 |
| REQ-401 SP（取込み後導線） | 55-ui §55.0 手順 5 | SALES2-D2（新規） | CTA 遷移先は取込み対象日 `/reports/daily?date={reportDate}`。代替案「当日」は取込みが翌朝運用のとき前日日報を見せられず棄却 | DailyReportResultStep CTA | CTA 遷移テスト（Vitest） |
| REQ-501/502 テスト命名 | 90-traceability REQ-501/502 行 | SALES2-D1（新規） | テスト名は `_req501` / `_req502`（sales 系既存テストと同一系列、traceability coverage=required 行へ加算）。`_req401` 系列は取込み lifecycle（第1スライス）に限定 | Rust 追加テスト名 | traceability --check |
| 34-biz §19.4 L265 | 同左 | SALES2-D3（新規） | 「一部日だけ日報がある月」の日数 coverage 表示は defer（最小構成優先、非 IT 利用者への情報過多回避）。本スライスは §19.4 が言う「後続 UI PR」に該当するが、coverage 表示のみ切り出して再 defer する判断であることを自覚的に記録。backlog 記録 | なし（Non-scope） | なし |
| 34-biz §19.2 warnings | 同左 | SALES2-D5（新規） | warnings の生成仕様が設計未記載。永続データから導出可能な「部門マスタ未対応 n 件」のみ生成し、preview 時警告の復元はしない（daily_report_department_lines に警告テキスト列がなく復元不能）。代替案「常に空配列」は DTO フィールドが恒久的に死に、命名と実態の乖離を生むため棄却 | get_daily_sales + UI-09a 公式セクション注記 | S2-18 / S2-19 |
| DSR-03 / DSR-08（PR #126） | design-system 01/02 | SALES2-D4（新規） | official セクションの視覚言語は既存 UI-09a/b を継承。日報由来 / 商品別由来の区別はセクション見出し + 説明文言で示し、色のみで符号化しない | DailySalesPage / MonthlySalesPage | T15 / T18 + L3 |

## Design Intent Audit

- Source docs can answer what/why: BIZ/IO は 34-biz / 24-io が実装可能レベルで既述。UI の詳細（コンポーネント構成・文言）は未記載のため本 PR で 56/57 を同期（Scope 13）
- Plan-only durable decisions: SALES2-D1〜D5 は docs 同期時に 34-biz/55/56/57 の設計判断欄へ昇格する
- Assumptions: daily_report_* テーブルと lines の shape は第1スライスのまま不変。additive optional フィールドのため既存 UI 消費コードは無修正でコンパイル可能
- Deferred gaps: 日数 coverage 表示（SALES2-D3）、official 集計 CSV エクスポート
- Test Design Matrix: [test-matrices/2026-07-04-req401-sales-slice2-official-reports.md](test-matrices/2026-07-04-req401-sales-slice2-official-reports.md)

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | 適用 — 本スライスは app core 内（daily_report_* → レポート表示）。レジ固有概念（Z001 等のファイル名）を UI 文言へ漏らさない（「レジ日報」等の operator 語彙を使う） | 56/57 文言、L3 |
| Fact check / design decision split | 適用 — 実コード棚卸しで設計と現状の gap を確認済み（未実装 13 項目、risks 5 件） | 本 packet Scope / Trace |
| Lifecycle / retry | 適用 — 表示は read-only。rollback 済み日報（status='rolled_back'）を表示対象から除外するのは §14.21/22 の completed 条件で担保 | T13 系テストの negative case |
| Operator workflow | 適用 — 取込み → CTA → 日次確認 → 月次確認の動線が今回初めて閉じる。T15/T18 の誤読防止文言が operator 肝 | L3 チェックリスト |
| Replacement path | 適用 — official 表示は daily_report_* の app 内モデルのみ消費。レジ換装時は adapter 差し替えで本画面は不変（D-023 整合） | なし |
| Data safety / evidence | 適用 — 実 bundle は local-only。テスト fixture は合成データのみ | Data Safety 節 |
| Reporting / accounting semantics | 適用 — 公式日報（レジ精算の正本）と商品別明細（Z004/手動、PLU 登録済み分のみ）の意味分離が本スライスの中核。合計不一致は正常でありエラー表示しない | 56/57 設計判断欄 + T14/T17 |
| Manual verification | 適用 — 実 bundle 取込み後の表示確認は自動テスト不能（Windows native L3、実データ経路。memory feedback-adapter-real-sample-gate の表示版） | L3 チェックリスト |

## Design Readiness

- Existing design docs are sufficient because: BIZ/IO/CMD は 34-biz §19.2-19.4 / 24-io §14.21-14.22 が DTO・シグネチャ・処理ステップ・エラーまで既述（PR #119 で merge 済み）
- Source docs updated in this PR: 56-ui / 57-ui（official 表示詳細）、55-ui（CTA 遷移先）
- Design gaps intentionally deferred: SALES2-D3（日数 coverage）
- Durable decisions promoted: SALES2-D1〜D5

Minimum design checks:

- Layer ownership: UI → CMD-09 → BIZ-05 → IO-01(sales_repo)。UI から repo 直呼びなし
- Backend function design: §14.21-14.22 / §19.3-19.4 既述
- Command / DTO: additive optional フィールドのみ。コマンド追加なし
- Persistence / transaction / audit: 読み取りのみ。TX 変更なし。operation_logs 追記なし（表示は監査対象外、既存 get_daily_sales と同等）
- Operator workflow / Japanese wording: 56/57 同期で確定、L3 で実機確認
- Error, empty, retry: 日報未取込み = `None` = 正常系（エラーにしない）。取得失敗は既存の部分障害許容（UI-09a 2 useQuery / UI-09b 失敗 4 状態）を踏襲
- Testability / traceability: `_req501` / `_req502` 命名で REQ-501/502 行へ自動加算

## Test Plan

Test Design Matrix: [test-matrices/2026-07-04-req401-sales-slice2-official-reports.md](test-matrices/2026-07-04-req401-sales-slice2-official-reports.md)

- targeted tests: T13-T18 + repo 直接テスト（completed のみ対象 / rolled_back 除外 / 最新 1 件選択 / 月次集計の department_id NULL 行の label 集約）
- negative tests: 日報未取込み日 → `official_daily_report: None` で既存表示が不変 / rolled_back のみの日 → `None`
- compatibility checks: bindings drift gate、既存 UI-09a/b テストの無修正通過（additive 変更の証明）
- data safety checks: fixture は合成データのみ、実 bundle は local-only
- main wiring/integration checks: CTA 遷移（route + date param）、取込み commit 後の query invalidation で official セクションが自動更新されること（第1スライス実装済み invalidation の実効確認）

## Boundary / Wire Contract

- producer: CMD-09 `get_daily_sales` / `get_monthly_sales`（tauri-specta）
- consumer: `src/features/daily-sales/` / `src/features/monthly-sales/`（generated bindings 経由）
- wire type: `DailySalesReport.official_daily_report: OfficialDailyReportSummary | null` / `MonthlySalesReport.official_department_totals: OfficialMonthlyDepartmentTotal[] | null`
- internal type: 34-biz §19.2 の Rust 型（`Option<...>`）
- precision/range: 金額は i64（円整数、既存 daily_report_* lines と同一）。`gross_amount` / `net_amount` / `quantity` / `count` は `Option<i64>`（Z001/Z002/Z005 の欠測を NULL のまま透過、0 へ潰さない）。`amount` は DTO で異なる: `OfficialDailyPaymentLine.amount` = `Option<i64>`、`OfficialDailyDepartmentLine.amount` / `OfficialMonthlyDepartmentTotal.amount` = `i64`（34-biz §19.2 のとおり）
- round-trip path: DB (daily_report_* lines) → repo DTO → BIZ DTO → JSON → bindings 型。逆方向なし（read-only）
- invalid input: 不正 date 形式は既存 validation（CMD 層の date 検証）を踏襲
- compatibility: additive optional フィールドのみ。既存フィールドの型・名前変更なし。旧 bindings 消費コードはコンパイル可能（フィールド未参照のため）

## Review Focus

- `items` / ランキングへの水増しが一切ないこと（T14/T17 が実装をバイパスしていないか、mock でなく実 DB 経路のテストか）
- rolled_back 日報が表示に混入しないこと（§14.21/22 の completed 条件）
- T15/T18 文言が「売上なし」誤読を防げているか（operator 視点）
- specta 生成で `Option` フィールドが nullable として bindings 化されること（CMD は BIZ 型を透過するため CMD 側修正は不要）
- `amount` の Option 性は DTO ごとに異なる（`OfficialDailyPaymentLine.amount` = `Option<i64>`、`OfficialDailyDepartmentLine.amount` / `OfficialMonthlyDepartmentTotal.amount` = `i64` 非 Option）。一律 Option 化 / 一律非 Option 化の誤実装に注意
- 56/57 docs 同期と実装の一致

## Spec Contract

Contract ID: SPEC-SALES2-OFFICIAL-SEPARATION

- 公式日報集計（daily_report_* 由来）と商品別明細（sale_records 由来）は、DTO・画面セクション・ラベルのすべてで分離され、相互に水増し・合算されない（D-025）
- 日報未取込みは正常系（`None`）であり、エラー表示・空 EmptyState の誤用をしない
- CTA は official 表示が存在する状態でのみ意味を持つ動線として、取込み結果画面から取込み対象日の日次売上へ遷移する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-SALES2-OFFICIAL-SEPARATION | Scope 1-5 | get_daily_sales_includes_official_report_req501 / get_daily_sales_no_fake_items_req501 / get_monthly_sales_official_department_totals_req502 / get_monthly_sales_no_fake_ranking_req502 | 水増しなし / rolled_back 除外 | cargo test 出力 |
| SPEC-SALES2-OFFICIAL-SEPARATION | Scope 8-10 | DailySalesPage 日報あり明細なし文言（T15）/ MonthlySalesPage official ラベル分離（T18） | 誤読防止文言 | npm test 出力 + L3 |
| SALES2-D2 | Scope 11 | CTA 遷移テスト（date param = reportDate） | 遷移先仕様 | npm test 出力 + L3 |
| SALES2-D5 | Scope 5b / 9b | get_daily_sales_warnings_unmatched_department_req501（S2-18）/ DailySalesPage official-warnings（S2-19） | 未対応部門の可視化・誤読防止 | cargo test + npm test 出力 |
| SPEC-SALES2-OFFICIAL-SEPARATION | Scope 7 | bindings drift gate | additive 契約 | CI `Rust generated drift` green |

## Data Safety

- 実店舗の Z001/Z002/Z005 ファイル・実売上値・実部門構成は commit しない（テスト fixture は合成データのみ）
- 実 bundle での確認は local-only（第1スライスの実ファイル gate と同じ扱い。結果は shape/count のみ記録）
- L3 証跡は匿名化した画面確認結果のみ記録

## Rally Record

- R1（並列 2 レンズ、2026-07-04）:
  - Lens 1 事実突合: P1×1（CMD 層「DTO 二重定義」は誤り。実際は `sales_cmd.rs:38,56` が BIZ 型を透過返却 → Scope 6 / S2-08 / Review Focus を修正。orchestrator が rg で実証確認済み）、P3×2（`test_` prefix 規約注記 / `amount` の DTO 別 Option 性明記）→ 全反映
  - Lens 2 契約縮退: P1×0、P2×1（`warnings: Vec<String>` の生成仕様が設計未記載のまま実装者判断に落ちる → SALES2-D5 として確定: 部門マスタ未対応 n 件のみ導出生成、S2-18/S2-19 追加、34-biz docs 同期対象化）、P3×1（SALES2-D3 に「本スライス自体が後続 UI PR に該当する」自覚を追記）→ 全反映。gross/net_amount の取得経路（daily_report_imports 親行のカラム）は lens が追跡し問題なしと確認
- R2（収束確認、2026-07-04）: 新規の設計欠陥 P1/P2 = 0。検出は R1 決定事項の伝播漏れのみ（S2-08 本文の書き換え忘れ、SALES2-D5 のサマリ表 3 箇所未反映）→ 全反映後、`rg "二重定義|D1〜D4|再定義側"` の機械 grep で 4 箇所目（Design Intent Audit）も検出・修正し全数確認済み。伝播漏れ = 機械検出クラスにつき rally はここで cutoff（memory feedback-rally-cutoff-on-mechanical-class-findings）。P3（Scope 15 の条件付き表現）も D5 必須昇格の明示で解消。

## Self-Review

rally 収束（R2: 新規 P1/P2 = 0）後、7 観点で実施:

1. **技術的前提**: 実装は Codex 委譲のため LSP/Skills Policy は Codex 側 harness 非適用。base は main = 39a469d（PR #126 design-system 反映済み、UI 実装は DSR-03 3 階層 / catalog ③ を参照可能）。rebase 不要（feature branch 新規）。commit prefix は `feat(sales):`（第1スライスと同系列）
2. **スクリプト詳細**: 新規スクリプトなし。`generate_bindings` / `generate_traceability -- --check` は既存 bin をそのまま使用
3. **ドキュメント修正**: 56/57 は §56.2 以降 / §57.2 以降が第1スライス前提のままという既知 drift を本 PR で同期（Scope 13）。55 は手順 5 の CTA 文面が「CTA は出さない」→「出す」へ反転するため、同一 PR 内で必ず更新（放置すると doc-consistency ではなく実装との意味矛盾になる）。34-biz は SALES2-D5 必須昇格（Scope 15）
4. **検証計画**: Acceptance Criteria に evidence token 付きで列挙（cargo test 名 / bindings drift の `git diff --exit-code` / traceability --check / L3 チェック 4 項目 S2-14〜17）。CI は Rust 3 gate + Frontend + Design doc consistency が全て走る（コード + docs 混在 PR）
5. **後処理**: memory 軽量監査は本セッションで実施済み（sentinel 更新済み、新規 memory 不要判断）。packet / matrix は merge 後 archive へ（相対リンク変換: matrix 冒頭の `../../archive/` 参照は archive 移動後 `../` へ要変換）
6. **実行制約**: Codex はローカル main に触れない（Codex 委譲条件節に明記）。orchestrator は受け入れ時に独立検証（テスト再実行・水増し有無の実 DB 経路確認・S2-08 の passthrough 維持確認）。merge / tag は owner 確認後
7. **コミット分割**: Codex 側は 実装+テスト / docs 同期 の分割を推奨するが、squash merge 前提のため厳密には要求しない。PR body に Plan Packet 参照と L3 チェックリスト（目視表形式）を含める

## Implementation Results

- Backend: `sales_repo` に `get_latest_completed_daily_report` / `get_monthly_official_department_totals` を追加し、completed 親のみ・最新日報・rolled_back 除外・月次公式部門集計を実装。BIZ DTO に `official_daily_report` / `official_department_totals` と official line 型を追加し、商品別 `items` / ranking は日報から水増ししない契約を固定。
- SALES2-D5: `department_id IS NULL` の日報部門行数から `OfficialDailyReportSummary.warnings` を1件生成する仕様を実装し、34-biz §19.3 へ昇格。
- CMD: `sales_cmd.rs` の command signature は変更せず、BIZ 型 passthrough を維持。回帰テスト `test_get_daily_sales_cmd_passes_official_report_req501` を追加。
- Frontend: `DailySalesPage` に「レジ日報（公式）」セクション、未取込み note、warning 注記、official あり明細なし時の「商品別明細は未取込み」文言を追加。`MonthlySalesPage` に「公式部門集計（レジ日報由来）」セクションを追加。`DailyReportResultStep` に `/reports/daily?date={reportDate}` CTA を追加。
- Tests: matrix S2-01〜S2-19 / T13〜T18 の実装名を照合し、Rust repo/BIZ/CMD と RTL テストを追加。`cargo test` と `npm test` は実装途中確認で green。
- Bindings: `cargo run --bin generate_bindings` により `src/lib/bindings.ts` を更新し、`official_daily_report` / `official_department_totals` の nullable wire shape を生成。
- Docs: 34-biz / 55-ui / 56-ui / 57-ui / Test Matrix を第2スライス実装内容へ同期。

## Review Response

### 受け入れ R1（orchestrator 独立検証 + fresh review-only sub-agent、2026-07-05）

- orchestrator 独立 gates 再実行: cargo fmt/clippy/test、npm typecheck/test（533 件）/build、generate_bindings → drift なし、traceability --check OK、doc-consistency 全通過 — Codex 報告と一致
- orchestrator spot-check: 新テスト名（test_ + _req501/502）/ CMD passthrough 維持（struct 再定義なし）/ T14 の実 DB 経路（setup_test_db + seed）/ CTA date param を直接確認
- review-only sub-agent 判定: P1 0 / P2 0 / P3 3。重点確認 11 項目（CMD +66 行 = テストのみ / docs 同期の具体性 / 既存テスト修正 = fixture null 追加のみ / 水増しなし / repo 契約 / SALES2-D5 / CTA / UI 分離 / amount Option 性 / 命名 / Implementation Results 一致）全て OK
- P3 対応:
  - P3-1（日次 official セクションの loading 中「未取込み」フラッシュ、月次とガード不統一）→ 同 PR で修正: `todayQ.data` 解決後のみ描画（月次 `query.data &&` パターンと統一）
  - P3-3（matrix 注記の traceability regex 説明が backend/frontend の別 regex を混同）→ 同 PR で修正: 注記を正確化
  - P3-2（CTA の生 `<a href>` と `<Link>` の混在）→ 対応せず backlog へ。orchestrator が実証: 生アンカー internal 遷移は StockMovementsPage / ManualSaleRecordDetailPage / MovementTable（いずれも Windows native L3 通過済み）に既存で、本 PR の新規逸脱ではない。internal navigation の Link/生アンカー統一は横断課題として Plans.md backlog に記録し、本 PR の merge gate に混ぜない（scope discipline）
- Review-only note: R3 default の review-only は fresh sub-agent（sonnet）で実施済み。実装が Codex（外部）のため、orchestrator 受け入れが独立検証を兼ねる（第1スライスと同型）

### Windows native L3（2026-07-05、owner 実施）

- 目視表 #1〜#7: 全項目 OK（実 bundle 取込み → CTA 遷移（取込み対象日）→ レジ日報（公式）表示 → T15 文言の誤読なし確認 → 月次公式部門集計の分離説明 → 未取込み日の軽量 note → 取込み直後の自動更新）
- 目視表 #8（warnings 注記）: 実データでは再現不能につき条件付き合格。現店舗の実 bundle は全部門が部門マスタと一致し `department_id IS NULL` 行が発生しない（= 正常な状態）。人工改変 bundle での再現は実データ経路の趣旨に反するため実施せず、自動テスト S2-18（BIZ 生成・実 DB 経路）+ S2-19（UI セクション内注記）を担保とする
- 判定: L3 合格、merge へ

## Codex 委譲条件（経路 A）

- 実装は Codex CLI に委譲する。Codex は feature branch（例: `feat/req401-sales-slice2`）で作業し、**ローカル main には触れない**（checkout / commit / merge 禁止。前回 kickoff への追記事項）
- 本 packet と Test Matrix を手渡しし、設計正本（34-biz / 24-io / 56-ui / 57-ui / 55-ui / D-025）を一次ソースとして直読みさせる
- orchestrator（Claude）は受け入れ時に独立検証（テスト実行・水増しなしの実 DB 経路確認・bindings drift・docs 同期突合）を行う
