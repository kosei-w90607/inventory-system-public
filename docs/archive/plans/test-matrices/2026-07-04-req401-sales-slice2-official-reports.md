# Test Design Matrix: REQ-401 SALES 第2スライス — official 日報のレポート表示

> **親 packet**: [../2026-07-04-req401-sales-slice2-official-reports.md](../2026-07-04-req401-sales-slice2-official-reports.md)
> 設計 matrix T13-T18 は [archive/plans/test-matrices/2026-06-30-sales-daily-report-design.md](2026-06-30-sales-daily-report-design.md) から引き継ぎ。ID は設計 matrix のものを維持し、本 matrix 追加分は S2-xx を振る。
> テスト関数名は repo 規約の `test_` prefix を付ける（例: `test_get_daily_sales_includes_official_report_req501`）。本 matrix の Proposed test target は実装名へ照合済み。traceability の REQ 抽出は backend（Rust test fn 名）が `_req(\d{3})` regex（prefix 非依存）、frontend（テスト本文）が `\bREQ-([0-9]{3})`（ダッシュ付き本文一致）の別 regex（いずれも generate_traceability.rs）。FE テストを coverage に乗せるにはテスト本文へ `REQ-501` 形式の記載が必要。

## IO-01 repository（sales_repo 追加 2 関数、24-io §14.21-14.22）

| ID | Contract / failure mode | Test type | Proposed test target | Expected failure caught |
|---|---|---|---|---|
| S2-01 | completed 日報がある日: 最新 1 件の summary + payment/department lines を sort_order ASC, id ASC で返す | Rust repo test | `test_get_latest_completed_daily_report_returns_latest_req501` | 古い日報 / 順序崩れの表示 |
| S2-02 | rolled_back のみの日: `Ok(None)`（表示対象に混入しない） | Rust repo test | `test_get_latest_completed_daily_report_excludes_rolled_back_req501` | 取消済み日報の誤表示 |
| S2-03 | 同日に rolled_back + completed（上書き取込み後）: completed 側のみ返す | Rust repo test | `test_get_latest_completed_daily_report_after_overwrite_req501` | 上書き前の値の混入 |
| S2-04 | 月内に completed 日報あり: department_id/label 単位で amount/quantity/count を合算 | Rust repo test | `test_get_monthly_official_department_totals_aggregates_req502` | 部門集計の合算誤り |
| S2-05 | 対象日報 0 件の月: `Ok(None)`（空 Vec と区別） | Rust repo test | `test_get_monthly_official_department_totals_none_req502` | 「日報なし」と「部門行なし」の混同 |
| S2-06 | department_id が NULL の行（部門マスタ未突合）: label 単位で集約され欠落しない | Rust repo test | `test_get_monthly_official_department_totals_null_department_req502` | 未突合部門の売上欠落 |

## BIZ-05（設計 T13/T14/T16/T17、34-biz §19.3-19.4）

| ID | Contract / failure mode | Test type | Proposed test target | Expected failure caught |
|---|---|---|---|---|
| T13 | 日報がある日の `get_daily_sales`: `official_daily_report` が Some（summary + lines がマッピングされる） | Rust BIZ test | `test_get_daily_sales_includes_official_report_req501` | UI が公式日報を表示できない |
| T14 | 日報のみの日（sale_records なし）: `items` は空のまま水増しなし + `official_daily_report` は Some | Rust BIZ test | `test_get_daily_sales_no_fake_items_req501` | 日報から偽の商品行が生成される |
| S2-07 | 日報未取込みの日: `official_daily_report: None` で既存フィールドは従来どおり（正常系、エラーでない） | Rust BIZ test | `test_get_daily_sales_without_official_report_req501` | 未取込み日のエラー化 / 既存表示の破壊 |
| T16 | 月内の Z005 department lines が `official_department_totals` に集計される（mode 非依存で常に返る） | Rust BIZ test | `test_get_monthly_sales_official_department_totals_req502` | 月次公式部門集計の欠落 |
| T17 | 日報のみの月: 商品ランキング（items）は空のまま水増しなし | Rust BIZ test | `test_get_monthly_sales_no_fake_ranking_req502` | 部門集計から偽ランキング生成 |
| S2-18 | `department_id IS NULL` 行が n 件あるとき `warnings` に「部門マスタと対応していない部門が n 件」が 1 件生成される。NULL 行なしなら空配列（SALES2-D5） | Rust BIZ test | `test_get_daily_sales_warnings_unmatched_department_req501` | warnings フィールドが恒久的に空の死にフィールド化 / 未対応部門の不可視化 |

## CMD-09 / bindings

| ID | Contract / failure mode | Test type | Proposed test target | Expected failure caught |
|---|---|---|---|---|
| S2-08 | CMD `get_daily_sales`（transparent passthrough）が BIZ 型の `official_daily_report` を無加工で返し、Tauri 境界（serde/specta シリアライズ）でフィールドが欠落しない | Rust CMD test | `test_get_daily_sales_cmd_passes_official_report_req501` | serde/specta 変換でのフィールド脱落 / 将来 CMD 側に再定義が追加された際の同期漏れ回帰 |
| S2-09 | bindings.ts に `official_daily_report` / `official_department_totals` が nullable で出現 | 機械 gate | `cargo run --bin generate_bindings` + `git diff --exit-code` | 生成漏れ / drift |

## Frontend（設計 T15/T18 + CTA）

| ID | Contract / failure mode | Test type | Proposed test target | Expected failure caught |
|---|---|---|---|---|
| T15 | official あり・商品別明細 0 件: 商品別明細セクションに「商品別明細は未取込み」系文言（「売上なし」と誤読させない） | Vitest/RTL | `test_daily_sales_page_official_without_items_req501` | 空明細を「この日は売上なし」と誤読 |
| T18 | 月次画面で公式部門集計と商品ランキングが別セクション・別ラベルで表示される | Vitest/RTL | `test_monthly_sales_page_official_department_totals_req502` | 公式集計とランキングの混同 |
| S2-10 | 日報未取込み日: 公式セクションは軽量 note 表示で、既存の商品別明細表示が不変 | Vitest/RTL | `test_daily_sales_page_no_official_note_req501` | additive 変更による既存表示の regression |
| S2-11 | `DailyReportResultStep` の「日次売上を見る」CTA が `/reports/daily?date={reportDate}` へ遷移する（当日でなく取込み対象日、SALES2-D2） | Vitest/RTL | `test_daily_report_result_cta_daily_sales_date_req501` | 遷移先日付の誤り（前日日報を見られない） |
| S2-19 | `warnings` 非空のとき公式日報セクション内に warning トーン注記（アイコン + テキスト）が表示され、上部 Alert 帯には出ない（DSR-03 3 階層整合） | Vitest/RTL | `test_daily_sales_page_official_warnings_note_req501` | 警告の不可視化 / データ安全系 Alert 帯の汚染 |
| S2-12 | 既存 UI-09a/b テストが無修正で通過（additive 契約の証明） | 既存 suite | `npm test` 全体 | 既存レポート表示の regression |

## Data safety

| ID | Contract / failure mode | Test type | Proposed test target | Expected failure caught |
|---|---|---|---|---|
| S2-13 | テスト fixture は合成データのみ（実店舗の金額・部門構成・ファイルを含まない） | review | fixture 目視 + git diff | 実データ commit |

## Manual / External Verification（Windows native L3）

| ID | Contract / failure mode | Verification | Expected failure caught |
|---|---|---|---|
| S2-14 | 実 bundle（Z001/Z002/Z005）を UI から取込み → CTA → 日次売上で公式日報セクションが実データ経路で表示される（seed でなく実データ経路。memory feedback-adapter-real-sample-gate の表示版） | Windows native L3、owner 目視 | synthetic fixture green のまま実ファイル経路で表示全滅 |
| S2-15 | T15 文言を owner が実機で読み、「この日は売上がなかった」と誤読しないことを口頭確認 | Windows native L3 | operator 誤読（文言が机上でしか通用しない） |
| S2-16 | 月次画面で公式部門集計と商品ランキングを owner が区別して説明できる（T18 の実機版） | Windows native L3 | ラベル分離が実利用者に届いていない |
| S2-17 | 取込み commit 直後に日次/月次の official セクションが自動更新される（第1スライス実装済み invalidation の実効確認） | Windows native L3 | stale cache 表示 |

## Required Gates In Implementation PR

- `cargo fmt --check` / `cargo clippy -- -D warnings` / `cargo test`
- `npm run typecheck` / `npm run lint` / `npm test` / `npm run build`
- `cargo run --bin generate_bindings` → `git diff --exit-code`（S2-09）
- `cargo run --bin generate_traceability -- --check`（REQ-501/502 行への加算確認）
- `./scripts/doc-consistency-check.sh`（56/57/55 docs 同期後）
- Windows native L3（S2-14〜S2-17、チェックリストは目視表形式で L3 依頼時に提示）
