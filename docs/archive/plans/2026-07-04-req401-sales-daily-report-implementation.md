# Plan Packet: REQ-401 SALES 日報取込み実装（第1スライス）

> **親文書**: [Plans.md](../../Plans.md) / workflow: [DEV_WORKFLOW.md](../../DEV_WORKFLOW.md)
> **設計正本**: PR #119 で merge 済みの source docs（§Design Sources）と decision-log D-025。設計合意の経緯は archived packet `docs/archive/plans/2026-06-30-sales-daily-report-design.md`
> **実装担当**: Codex CLI（経路A: 本 packet を実装指示として手渡し）

## Risk

Risk: R3

Reason:
DB migration（daily_report_* 4テーブル新設）、POS CSV パーサー新設、Tauri command DTO / generated bindings 新設、operator-facing UI-07 の主動線変更に触れる。

## Goal

PR #119 で確定した REQ-401 SALES 再設計（D-025）の第1スライスとして、Z001/Z002/Z005 日報 bundle の Parse → Validate → Preview → Commit → Rollback を DB/IO/BIZ/CMD/UI で実装し、現店舗の日報主入力をアプリに取り込める状態にする。日報取込みは `daily_report_imports` + 3 行テーブルのみに書き、`sale_records` / `inventory_movements` / 在庫を一切変更しない。

## Scope

実装は設計書が正。以下は対象モジュールの列挙であり、詳細仕様は §Design Sources の各設計書を読むこと。

- **MNT-03 migration v4**: `src-tauri/src/db/schema_v4.rs` 新設 + `db/mod.rs`（20-22 行の `mod schema_v1/v2/v3;` の並び）へ `mod schema_v4;` 追加 + `migration.rs` の migrations() へ v4 登録（v3 の直後、`migration.rs:45-49` の並び）。DDL のみで backfill がないため `MigrationKind::Sql(schema_v4::get_v4_daily_report_schema())` を採用（v1 と同型。v2/v3 の `Custom` は backfill/再作成が理由であり本件には不要）。**既存テストの契約書き換え（rally R1 P1-1）**: `schema_v2.rs:258` の `assert_eq!(max_version, 3)` は v4 追加で確実に fail するため `4` へ更新し、同 252 行の「最新の v3 まで適用する」コメントも v4 へ追従する（matrix Z0 行）。内容: `daily_report_imports` / `daily_report_summary_lines` / `daily_report_payment_lines` / `daily_report_department_lines` の CREATE TABLE（CHECK 制約: status / source_adapter / source_file、FK: daily_report_import_id / department_id）+ インデックス 5 本（`daily_report_imports(report_date)` / `daily_report_imports(bundle_hash)` / `daily_report_summary_lines(daily_report_import_id)` / `daily_report_payment_lines(daily_report_import_id)` / `daily_report_department_lines(daily_report_import_id, department_id)`）。仕様: [db-design/pos-tables.md](../../db-design/pos-tables.md) 12b-12e、[DB_DESIGN.md](../../DB_DESIGN.md) インデックス方針
- **IO-01 sales_repo**: [24-io-csv-import-repo.md](../../function-design/24-io-csv-import-repo.md) §14.14-14.20 の 9 関数を `db/sales_repo.rs` へ追加（`insert_daily_report_import` / `insert_daily_report_summary_lines` / `insert_daily_report_payment_lines` / `insert_daily_report_department_lines` / `find_daily_report_import_by_id` / `find_blocking_daily_report_by_bundle_hash` / `find_daily_report_imports_by_report_date` / `rollback_daily_report_import` / `list_daily_report_imports`）。§14.21-14.22（BIZ-05 レポート表示用 query）は第2スライスへ defer
- **IO-07 daily_report_parser**: `src-tauri/src/io/daily_report_parser.rs` 新設（`io/` 直下単独ファイル + inline `#[cfg(test)]`、`z004_parser.rs` と同じ配置規約）。型・関数・error_type は [29-io-daily-report-parser.md](../../function-design/29-io-daily-report-parser.md) §29.2-29.5。SHA-256 は既存 `sha2 = "0.10"` を流用し、file_hash は生バイト基準 hex 小文字 64 文字（z004_parser と同規約）
- **IO-07 行構造の事実確認（実装内 fact-finding）**: Z001/Z002/Z005 の行構造・`line_key` / `payment_key` の具体対応は設計時に意図的に defer されている（PR #119 Design Readiness）。L3-R1で CV17 1.1.1 のツール内部ディレクトリ常在ファイル（layout A）とレジスターツールのエクスポート機能出力（layout B）をローカル実ファイル、CSVヘッダ行、`SRS4000_JA3.pdf` / `ECRCV17.pdf` のレポート仕様に突合して列構成・行種別を導出した。運用主経路は owner 追加事実によりエクスポート機能の可能性が高く、なお現地手順確認中のため、parser は layout A/B を両方正式サポートする。「レジ明細 - 見せる用.xlsx」はsanitized版のため数値突合には使わず、列構成・ラベル・行の並びの参照に限定する。**匿名化した shape（列数・キー名・行種別・メタ行位置のみ、実金額/実店舗値を含まない）を [29-io-daily-report-parser.md](../../function-design/29-io-daily-report-parser.md) §29.4 へ同一 PR で追記する**。gross_sales / net_sales の導出元行もここで確定する。テスト fixture は shape から合成した synthetic データのみ
- **BIZ-08 daily_report_import_service**: `src-tauri/src/biz/daily_report_import_service/` をサブディレクトリ構成で新設（`mod.rs` 型定義 + `parse.rs` / `commit.rs` / `rollback.rs` / `list.rs` + `tests/`。`csv_import_service/` と同型。design_compliance_test の既登録マッピングがこのサブモジュール構成を前提にしている）。DTO は [37-biz-daily-report-import-service.md](../../function-design/37-biz-daily-report-import-service.md) §37.2、処理は §37.3-37.6。bundle_hash は Z001→Z002→Z005 順に `source:file_hash:size` を連結して SHA-256。部門照合は `departments.name` 完全一致（未一致は warning + `department_id=None`）。operation_logs は `daily_report_import` / `daily_report_rollback`（成功時、TX 外、失敗は `tracing::warn!` のみ。`csv_import_service/commit.rs:65-73` の失敗時パターンと同型、成功時ログの実例は `commit.rs:224-234`）、parse 失敗時は `daily_report_parse_failed`（B-2 Stage 1 の要求。37-biz §37.3 のステップ一覧にはこの記録が未記載のため、**同一 PR の docs 同期で §37.3 へ追記する**（rally R1 P2、B-2 が正））
- **CMD-12 daily_report_import_cmd**: `src-tauri/src/cmd/daily_report_import_cmd.rs` 新設（4 コマンド、[45-cmd-daily-report-import.md](../../function-design/45-cmd-daily-report-import.md)）。`AppState`（`cmd/mod.rs:32-37`）へ `daily_report_preview_cache: Mutex<HashMap<String, CachedDailyReportPreview>>` を追加。TTL / 上限は既存 `constants::PREVIEW_CACHE_TTL_SECS`（30分）/ `PREVIEW_CACHE_LIMIT` を流用し、**cache 挿入時の FIFO eviction（`csv_import_cmd.rs:76-85` の `len() >= LIMIT` で最古 `created_at` を remove する実装）も daily_report_preview_cache へ同型実装する**（rally R1 P2、matrix C7）。`list_daily_report_imports` は 45-cmd §45.6 どおり status パラメータを持たないため、BIZ の `ListDailyReportImportsQuery.status` へは `None` 固定で渡す（全状態表示。status filter の wire 公開は第2スライス以降の履歴 UI 設計時に判断 = rally R1 P2-4）。`lib.rs` の `collect_commands!`（53-99 行）と `generate_handler!`（233-294 行）の**両方**へ 4 コマンドを登録し、`cargo run --bin generate_bindings` で bindings 再生成。CmdError 変換は §45.7
- **UI-07 再構成**: route path は `/csv-import` を維持（デスクトップ URL は内部識別子）。`routes/csv-import.tsx` の mount 先を tab コンテナ `SalesImportPage` に変更し、タブ「日報取込み」（既定）/「商品別CSV取込み（Z004）」の 2 トラック構成にする（[55-ui-csv-import.md](../../function-design/55-ui-csv-import.md) §55.0）。既存 `CsvImportPage` / `useCsvImportFlow` / reducer は Z004 タブとして無改変流用（文言のみ §55.0 に従い「商品別CSV取込み（Z004）」系へ変更）。`src/config/navigation.ts` の ui-07 entry（65-72 行）label / title を「売上データ取込み」へ変更
- **UI 日報取込みフロー新設**: `src/features/daily-report-import/` を新設（`types.ts` / `reducer.ts` / `hooks/useDailyReportImportFlow.ts` / `components/`）。state machine は csv-import と同型の 6 variant discriminated union（idle / parsing / preview / importing / result / error）+ 3 useMutation + `useBlocker`（importing 中 block）。ファイル選択は Windows native L3 の WebView2 white screen 回避のため `@tauri-apps/plugin-dialog.open` + `@tauri-apps/plugin-fs.readFile` を使う。Preview は対象日 / 3 ファイル名 / 総売上・純売上 / 支払集計 / 部門別集計 / 部門未対応 warning / 重複・上書き判定を表示。Result は取込み結果サマリ + **「取消しても在庫数は変わりません」の明示**（[55-ui-csv-import.md](../../function-design/55-ui-csv-import.md) §55.0 手順 6）+ rollback + ホームへ戻る
- **query-keys**: `src/lib/query-keys.ts` へ `dailyReportImports(page, perPage)` / `dailyReportImportLists()` prefix helper を追加。commit / rollback 成功時の invalidation は `dailyReportImportLists()` + `["daily-sales"]` prefix + `monthlySalesRoot()`（第2スライスの official 表示に備えた先行 invalidation。UI-00 の `csvImports` は日報と無関係のため触らない）
- **docs 同期（同一 PR）**: [29-io-daily-report-parser.md](../../function-design/29-io-daily-report-parser.md) §29.4 へ line_key / payment_key 具体表（匿名化 shape）追記、[55-ui-csv-import.md](../../function-design/55-ui-csv-import.md) §55.1 のモジュール構成表を tab 構成 + daily-report-import feature へ更新、[45-cmd-daily-report-import.md](../../function-design/45-cmd-daily-report-import.md) §45.2 の既存 cache 型表記を実コード名 `CachedPreview` へ訂正（実装との命名乖離の解消。既存コードの rename はしない）+ §45.6 へ「BIZ の `status` フィールドは wire 非公開、CMD は `None` 固定」注記追加、[37-biz-daily-report-import-service.md](../../function-design/37-biz-daily-report-import-service.md) §37.3 へ parse 失敗時 `daily_report_parse_failed` operation_logs 記録ステップを追記（B-2 との不整合解消）、`90-traceability.md` 再生成
- **テスト**: Test Design Matrix（[test-matrices/2026-07-04-req401-sales-daily-report-implementation.md](test-matrices/2026-07-04-req401-sales-daily-report-implementation.md)）の全行。テスト名は `test_<対象>_req401_<ケース>` 規約（traceability regex `_req([0-9]{3})` が拾う形）。既存テストの削除・skip は不可

## Non-scope

- BIZ-05 拡張（`OfficialDailyReportSummary` / 月次公式部門集計 DTO）と UI-09a/b の official 日報表示（設計 matrix T13-T18、repo §14.21-14.22 含む）→ 第2スライス
- Result step の「日次売上を見る」CTA（§55.0 手順 5）→ 第2スライスへ defer。理由: 第1スライス時点の日次売上画面は official 日報を表示できず、空の商品別明細へ誘導すると「売上なし」誤読（設計 matrix T15 の failure mode）を先に踏むため。deferral は §55.0 の完成形記述を縮めるものではなく、CTA 追加を第2スライスの scope に固定する
- seed への日報デモデータ追加（L3 は synthetic fixture ファイルを UI から取り込んで検証するため不要。official 表示が入る第2スライスで再判断）
- 日報取込み履歴一覧 UI（`list_daily_report_imports` を消費する画面）→ Z004 の取込み履歴一覧と同じく Phase 3 以降へ defer（55-ui の既存 Z004 側 defer 宣言と同型）。CMD `list_daily_report_imports` / query-keys helper は後続 UI に備えた先行実装のみ。**取込み直後以外の rollback 導線は本スライスでは提供しない**。誤取込みの実運用回復は同日 bundle 再取込み時の OverwriteRequired フロー（旧 import 自動 rolled_back）で成立する（rally R1 P2-1）
- `Z006` / `Z009` / `Z011` の取込み、Excel 帳票の取込み
- 既存 Z004 track（IO-02 / BIZ-03 / CMD-07）のロジック変更（文言・タブ配置のみ変更）
- REQ-403 整合性照合、PLU / CV17 関連、Z004 側の plugin-dialog 移行

## Acceptance Criteria

- `cd src-tauri && cargo test` PASS（既存 + Test Matrix 新規行。既存 Z004 suite `csv_import_service` / `z004_parser` は無改変 green = T12）
- `cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo test --test design_compliance_test` PASS（既登録の `io::daily_report_parser` / `biz::daily_report_import_service::*` / `cmd::daily_report_import_cmd` マッピングが実体を得る）
- `cd src-tauri && cargo run --bin generate_bindings` 後の `src/lib/bindings.ts` diff に `parseAndValidateDailyReport` / `commitDailyReportImport` / `rollbackDailyReportImport` / `listDailyReportImports` と `DailyReportPreviewData` 系 DTO が現れる
- `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` OK（ERROR 0。REQ-401 は coverage=required のため新規 `_req401` テストが T3 を満たす。**T4 は FE 未参照ファイル数 baseline=22 の増減両方向 ERROR のため、新規 FE テスト全ファイルの describe/it に `REQ-401` または `UI-07` literal を必ず含める**（rally R1 P1-2。既存例: `src/features/csv-import/reducer.test.ts:171`。baseline 変更はしない））
- `bash scripts/doc-consistency-check.sh` / `--target plan` PASS
- fixtures は synthetic のみ: `rg` で実店舗値（実 JAN / 実商品名 / 実金額列）の非混入を確認し、`approved-readable` / `docs/research/real-csv/` 配下・実 CSV 本文を commit に含めない。local-only gate は3月期 bundle と6月期 bundle の両方で実施し、結果値はPR本文にもcommitにも含めない
- 既存テストの削除・skip・弱体化なし（`git diff` レビューで確認）

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-401（coverage=required、対応レイヤー UI-07 / IO-07 / BIZ-08 / CMD-12 / BIZ-03。BIZ-03/Z004 は既存不変のため本スライスの実装対象外）
- Architecture: [ARCHITECTURE.md](../../ARCHITECTURE.md) POS Adapter Boundary / IO-07 / BIZ-08 / CMD-12 行、[architecture/io-task-specs.md](../../architecture/io-task-specs.md)、[architecture/biz-task-specs.md](../../architecture/biz-task-specs.md)、[architecture/cmd-task-specs.md](../../architecture/cmd-task-specs.md)
- Function / command / DTO: [29-io-daily-report-parser.md](../../function-design/29-io-daily-report-parser.md)、[37-biz-daily-report-import-service.md](../../function-design/37-biz-daily-report-import-service.md)、[45-cmd-daily-report-import.md](../../function-design/45-cmd-daily-report-import.md)、[24-io-csv-import-repo.md](../../function-design/24-io-csv-import-repo.md) §14.14-14.20
- DB: [DB_DESIGN.md](../../DB_DESIGN.md)、[db-design/pos-tables.md](../../db-design/pos-tables.md) 12b-12e / B-2
- Screen / UI: [55-ui-csv-import.md](../../function-design/55-ui-csv-import.md) §55.0、[SCREEN_DESIGN.md](../../SCREEN_DESIGN.md)
- Decision log / ADR: [decision-log.md](../../decision-log.md) D-025（D-022 / D-023 と併読）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 29-io / 37-biz / 45-cmd / 24-io §14.14-14.20 | existing sufficient（PR #119 で作成済み） |
| Command / DTO / generated binding / wire shape | 45-cmd + 本 packet Boundary / Wire Contract | existing sufficient |
| DB / transaction / audit / rollback / migration | DB_DESIGN.md / pos-tables.md 12b-12e / B-2 | existing sufficient（migration v4 の DDL 化のみ実装判断） |
| Screen / UI / route state / Japanese wording | 55-ui §55.0 | existing sufficient。§55.1 モジュール表は本 PR で更新 |
| CSV / TSV / report / import / export format | 29-io §29.4 | **updated in this PR**（line_key 具体表の匿名化 shape 追記） |
| Durable decision / ADR | decision-log D-025 | existing sufficient |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-401 | pos-tables 12b-12e / B-2 | D-025 | 集計日報を sale_records へ擬似展開しない（却下: 単一テーブル統合） | migration v4 + sales_repo + BIZ-08 | matrix M / R / B 行 |
| REQ-401 | ARCHITECTURE POS Adapter Boundary / 29-io | D-023 / D-025 | レジ依存の文字コード・改行・source 判定を IO adapter に閉じ込める | io/daily_report_parser.rs | matrix IO 行 |
| REQ-401 | 37-biz §37.4-37.5 | D-025 | rollback は論理取消のみで在庫補正なし（却下: movement void 方式） | biz/daily_report_import_service | matrix B6-B11 行 |
| REQ-401 | 55-ui §55.0 | UI-07-D9 / D10 / D11 | 日報と商品別取込みを別トラック表示、部門未対応は warning | SalesImportPage + daily-report-import feature | matrix F 行 |
| REQ-401 | 45-cmd §45.2-45.4 | BIZ-08 §37.2 所有 | preview cache は型を分けて同一 AppState、CMD 薄層維持 | cmd/daily_report_import_cmd.rs | matrix C 行 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes（D-025 + PR #119 昇格済み source docs）
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: なし（line_key 具体表は実装 PR 内で 29-io へ昇格する）
- Assumptions and constraints: CASIO SR-S4000 adapter、CP932/NEL、実サンプルは git 管理外ローカルのみ、実装は既存 csv_import 系の層別パターンを踏襲
- Deferred design gaps, risk, and follow-up target: BIZ-05 / UI-09a/b official 表示は第2スライス（Plans.md 次の行動で追跡）。line_key 対応表は実装内 fact-finding で確定し 29-io へ追記
- Test Design Matrix can cite design decision IDs or source doc sections: yes（本 packet 併置 matrix が設計 matrix T1-T12 / T19-T22 を実装粒度へ展開）

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | 適用。Z001/Z002/Z005 の列構造・line_key 命名は adapter（IO-07）所有。daily_report_* モデルが app core | 29-io §29.4 追記 |
| Fact check / design decision split | 適用。実サンプルからの行構造導出は事実確認であり、匿名化 shape として 29-io へ記録。app core 契約は変更しない | 29-io §29.4 / 本 packet |
| Lifecycle / retry | 適用。Parse→Validate→Preview→Commit、重複、上書き、rollback、cache 期限切れの全経路を matrix で固定 | Test Matrix |
| Operator workflow | 適用。3 ファイル選択 → preview → 取込み → 結果（在庫不変明示）が operator-facing。Windows native L3 対象 | §Test Plan manual 節 |
| Replacement path | 適用。レジ更改時は io/daily_report_parser.rs（+ source 判定）差し替えのみで daily_report_* モデルは不変 | ARCHITECTURE / 29-io |
| Data safety / evidence | 適用。実 CSV は git 管理外。source_files_json は filename/hash/size/source のみで本文非保存。fixture は合成のみ | §Data Safety |
| Reporting / accounting semantics | 適用。日報集計は正本だが商品別明細ではない。sale_records / 在庫と分離（T9/T10 で機械固定） | Test Matrix B6 / B11 |
| Manual verification | 適用。ファイル選択・日本語文言・在庫不変文言の operator 理解は Windows native L3 でしか検証できない | §Test Plan manual 節 |

## Design Readiness

- Existing design docs are sufficient because: PR #119 が DB / IO / BIZ / CMD / UI の契約を実装可能な粒度まで昇格済みで、rally + review 収束済み。残る唯一の設計 gap（line_key 具体表）は「実装内 fact-finding + 同一 PR での source doc 追記」として扱いが確定している
- Source docs updated in this PR: 29-io §29.4（line_key 表）、55-ui §55.1（モジュール表）、45-cmd §45.2（cache 型名表記訂正）、90-traceability.md（再生成）
- Design gaps intentionally deferred: BIZ-05 DTO 拡張 / UI-09a/b official 表示 / repo §14.21-14.22（第2スライス）、日報取込み履歴一覧 UI（Phase 3 以降）
- Durable decisions discovered in this plan and promoted to source docs: なし（発生した場合は実装を止めて Design Phase に戻す）
- 既知の設計書内不整合（rally R1 で検出、同一 PR の docs 同期で解消）: ① 37-biz §37.3 に B-2 Stage 1 の `daily_report_parse_failed` operation_logs 記録ステップが未記載（B-2 が正）② 37-biz §37.2 `ListDailyReportImportsQuery.status` が 45-cmd §45.6 の wire に存在しない（BIZ 内部専用と明確化し、CMD は `status: None` 固定と 45-cmd へ注記）③ 45-cmd §45.2 の既存 cache 型表記 `CachedCsvPreview` は実コード名 `CachedPreview` と乖離（表記訂正）④ 37-biz §37.3 step 6 の必須サマリ条件は「いずれかを導出できない場合」から「両方を導出できない場合」へ緩和した。これは B-2 の「総売上または純売上」表現、および実装 `parse.rs:74` の `gross_amount.is_none() && net_amount.is_none()` と整合させる意図的変更。

Minimum design checks:

- Layer ownership（`UI -> CMD -> BIZ -> IO/MNT`）: IO-07 が parse、BIZ-08 が validate/commit/rollback + TX 制御、CMD-12 は薄層 + cache 管理のみ、UI-07 は表示と操作のみ
- Backend function design: 29-io / 37-biz / 45-cmd / 24-io §14.14-14.20 で関数・エラー・不変条件が定義済み
- Command / DTO / data contract: §37.2 所有の DTO を CMD-12 が `specta::Type` 付き wire 型として公開
- Persistence / transaction / audit impact: migration v4、TX 境界は BIZ-08、operation_logs は TX 外記録、rollback は親 status 更新のみ
- Operator workflow / Japanese UI wording: §55.0 の日報主動線 + 在庫不変明示文言
- Error, empty, retry, and recovery behavior: §29.5 error_type 7 種 + §37.7 の UI 案内対応表 + cache 期限切れ回復
- Testability and traceability IDs: REQ-401 required、`_req401` テスト命名、matrix が設計 matrix T 番号を引く

## Test Plan

- Test Design Matrix: [test-matrices/2026-07-04-req401-sales-daily-report-implementation.md](test-matrices/2026-07-04-req401-sales-daily-report-implementation.md)
- targeted tests: `cargo test daily_report --lib` / `cargo test migration` / `cargo test --test design_compliance_test` / `npm test -- --run src/features/daily-report-import/`
- negative tests: matrix IO2-IO6 / B2-B5 / B8-B10 / C1-C4（欠損・重複・未知 source、decode 失敗、日付不一致、数値不正、二重取込み、上書き未確認、期限切れ）
- compatibility checks: generate_bindings diff、既存 Z004 suite 無改変 green（T12）、既存 csv-import RTL green
- data safety checks: fixture 合成のみ、実 CSV 本文・実店舗値の非混入 rg 確認
- main wiring/integration checks: 3 ファイル選択 → preview → commit → daily_report_* 4 テーブル書込み → rollback の through 確認（Rust integration + RTL）

Manual（Windows native L3、Draft PR の pending checks として記録）:

- `/csv-import` で既定タブが「日報取込み」、Z004 タブが「商品別CSV取込み（Z004）」表記であること
- synthetic Z001/Z002/Z005 の 3 ファイル選択 → preview（対象日 / 総売上 / 支払集計 / 部門別集計 / 部門未対応 warning）→ 取込み → 結果画面
- 結果画面と取消し確認に「在庫数は変わりません」系文言が表示され、色のみの状態符号化がないこと
- 同一 bundle 再取込みブロックと、同日別 bundle の上書き確認ダイアログ

## Boundary / Wire Contract

- producer: frontend 3 ファイル入力 → `DailyReportSourceFileRequest[]`（`{ filename: string, fileBytes: number[] }`、specta camelCase 変換）
- consumer: CMD-12 → BIZ-08
- wire type: `parse_and_validate_daily_report(files) -> DailyReportPreviewResponse { preview_data, preview_token }`、`commit_daily_report_import(preview_token, overwrite_confirmed) -> DailyReportImportResult`、`rollback_daily_report_import(daily_report_import_id) -> DailyReportRollbackResult`、`list_daily_report_imports(page, per_page, date_from, date_to) -> PaginatedResult<DailyReportImport>`
- internal type: `DailyReportPreviewData` / `CachedDailyReportPreview` / `DailyReportImportResult` / `DailyReportRollbackResult` / `DailyReportImport` / `ListDailyReportImportsQuery`（所有元 = 37-biz §37.2。IO-07 §29.2 が `DailyReportSourceKind` / `DailyReportSourceFile` を所有。`ListDailyReportImportsQuery.status` は BIZ 内部専用フィールドで wire に公開しない — CMD-12 は `status: None` 固定で呼ぶ）
- precision/range: 金額・数量・件数は i64。ファイル上限 20MB × 3。preview token は UUID、TTL 30 分（`constants::PREVIEW_CACHE_TTL_SECS` 流用）
- round-trip path: UI 3 ファイル選択 → CMD-12 parse → BIZ-08 preview → cache token → CMD-12 commit → daily_report_* 4 テーブル → rollback（結果画面から）。`list_daily_report_imports` は wire として実装するが消費 UI は Phase 3 以降（Non-scope 参照）
- invalid input: ファイル数 ≠ 3、20MB 超、欠損/重複/未知 source、CP932 decode 失敗、行構造不正、日付不一致、数値不正、必須サマリ（gross_sales / net_sales とも）導出不可、期限切れ token、取込み済み bundle、上書き未確認
- compatibility: CMD-07 / Z004 系 command は名称・契約とも不変（additive）。`collect_commands!` と `generate_handler!` の両方へ登録漏れがないこと。bindings 再生成 diff は新規 4 command + DTO のみが期待値

## Review Focus

- commit が daily_report_* 4 テーブル以外（sale_records / inventory_movements / products）へ書いていないこと（T9 相当のテストと実装の両方）
- 上書き commit の TX 内で旧 import の rolled_back 化と新規 INSERT が原子的であること（B-2 Stage 4）
- rollback が論理取消のみで、行テーブルを物理削除していないこと（repo §14.19 注意書き）
- parser の error_type 7 種が §29.5 と一致し、parse_errors がある場合に BIZ が commit 不可としていること
- 29-io §29.4 への追記が匿名化 shape に留まり、実店舗値を含んでいないこと
- 既存 Z004 track のロジック・テストが無改変であること（文言と tab 配置のみの変更に留まる）
- CMD-12 が業務ルールを持たず薄層であること（ファイル数・サイズ・token 形式の入口検証のみ）

## Spec Contract

Contract ID: SPEC-REQ401-DAILY-IMPORT-IMPL（親: SPEC-SALES-DAILY-REPORT-2026-06-30）

- 日報取込み commit は `daily_report_imports` + 3 行テーブルのみに書き、`sale_records` / `inventory_movements` / `products.stock_quantity` を変更しない
- 同一 bundle_hash の completed 取込みは再取込みブロック、同一 report_date の別 bundle は上書き確認必須で、上書き時は旧 import を同一 TX 内で rolled_back にする
- rollback は親 status の論理取消のみで冪等、在庫・売上レコードへの影響ゼロ
- IO-07 は CP932 strict decode + NEL/CRLF/LF/CR 正規化を行い、欠損・重複・未知 source / decode 失敗 / 行構造不正 / 日付不一致 / 数値不正（§29.5 の 7 error_type）を parse error として commit 不可にする
- Z005 部門未対応は warning + `department_id=NULL` で取込み可能（hard failure にしない）
- preview は 30 分 TTL の token cache で保持し、期限切れ・cache miss は再選択可能なエラーとして返す

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-REQ401-DAILY-IMPORT-IMPL-1（書込み分離） | BIZ-08 commit | matrix B6 / B11 | sale_records / movements / stock 不変 | `cargo test daily_report --lib` |
| SPEC-REQ401-DAILY-IMPORT-IMPL-2（重複/上書き） | BIZ-08 preview/commit | matrix B4 / B5 / B7 / B8 / B9 | 同一 TX の rolled_back + INSERT | 同上 |
| SPEC-REQ401-DAILY-IMPORT-IMPL-3（論理 rollback） | BIZ-08 rollback + repo | matrix B11 / R4 | 冪等 + 物理削除なし | 同上 |
| SPEC-REQ401-DAILY-IMPORT-IMPL-4（parser 契約） | IO-07 | matrix IO1-IO7 | error_type 7 種 + 正規化 | `cargo test daily_report_parser` |
| SPEC-REQ401-DAILY-IMPORT-IMPL-5（部門 warning） | BIZ-08 preview | matrix B3 | warning で取込み可能 | `cargo test daily_report --lib` |
| SPEC-REQ401-DAILY-IMPORT-IMPL-6（cache TTL） | CMD-12 | matrix C3 / C4 / C5 | 期限切れ回復経路 | `cargo test --lib cmd` |
| SPEC-REQ401-DAILY-IMPORT-IMPL-7（wire） | CMD-12 + bindings | matrix C6 | 4 command + DTO が bindings に出る | `generate_bindings` diff |
| SPEC-REQ401-DAILY-IMPORT-IMPL-8（UI 動線） | UI-07 tab + daily-report-import | matrix F1-F7 | 在庫不変文言 + 2 トラック分離表示 | `npm test` + L3 |

## Data Safety

- 実 POS CSV（Z001/Z002/Z004/Z005）、実 PLU ファイル、実 JAN / 実商品名 / 実金額、店舗 DB、バックアップ、レシート画像、secrets を読み込んだままの commit・fixture 化をしない
- local-only paths: `/home/kosei/Downloads/inventory-field-check/approved-readable/`、`docs/research/real-csv/`、`.local/`、app data directory（実サンプル参照は shape 導出のみに使う）
- synthetic-only paths: `src-tauri/src/io/daily_report_parser.rs` 内 fixture、`src-tauri/src/biz/daily_report_import_service/tests/`、`src/features/daily-report-import/` の RTL mock（金額・部門名・日付はすべて合成値。部門名は departments 初期データ（migration v1 の 21 部門）の名称を使ってよい — これは店舗実データではなく app 初期マスタ）
- `source_files_json` に CSV 本文を保存しない（filename / hash / size / source のみ）

## Rally Record

- Round 1（Plan agent × 2 並列 / Sonnet、cycle-time 既定の並列 1 回 rally）: ①事実突合レンズ = fact-check 10 項目中 8 一致・2 不一致検出、P1 2 / P2 3 / P3 3。②契約・縮退レンズ = P1 0 / P2 4 / P3 3（うち cache eviction は①と重複）。
- 採用と反映: P1-1（`schema_v2.rs:258` の `max_version` assert が v4 追加で確実 fail → Scope + matrix Z0 へ）、P1-2（traceability T4 baseline=22 増減両方向 ERROR、新規 FE テストへ `REQ-401`/`UI-07` literal 必須 → AC へ）、P2 群（`db/mod.rs` mod 宣言 / FIFO eviction 同型実装 + C7 / BIZ-03 引用補完 / 履歴一覧 UI の defer 宣言 + rollback 導線の実運用回復根拠 / `daily_report_parse_failed` の matrix 行 B15 + 37-biz §37.3 docs 同期 / `ListDailyReportImportsQuery.status` wire 非公開の明確化）、P3 群（navigation 行番号 / Z2 注記 / commit.rs 引用 / invalid_format・必須サマリの契約列挙補完）を全て packet / matrix へ反映済み。
- **収束判断（Round 1 で cutoff、orchestrator 判断）**: P1 2 件はいずれも「新規追加が既存の固定値 assert / baseline と衝突する」機械検出可能クラスで、`cargo test` と `generate_traceability -- --check` が確定検出する（memory `feedback-rally-cutoff-on-mechanical-class-findings` 適用）。契約レンズの P1 は 0 で、設計・契約レベルの未解決指摘なし。両レンズの P2 は全て packet 記述の欠落補完であり反映済みのため、追加 round は回さず機械ゲート（AC の全 gate）+ user final gate（Codex 委譲前の owner 確認）で閉じる。

## Self-Review

1. **前提条件**: 実コード現状（migration v3 まで / `CachedPreview` 命名 / design_compliance 既登録 / collect_commands 位置 / sales_repo 実装済み関数 / UI-07 現状ファイル / REQ-401 coverage=required）は Explore agent 棚卸しで列挙し path:line 付きで本 packet に反映済み。rally R1 で fact-check 再突合する。
2. **検証手段**: Acceptance Criteria は全て command + 期待出力の evidence token 付き。Test Matrix が設計 matrix T1-T12 / T19-T22 を実装粒度へ展開し、failure mode 起点で D-025 / UI-07-D9/D10/D11 を引ける。
3. **後処理**: merge 後に packet + matrix を archive へ移動、Plans.md / PROJECT_HANDOFF 同期、第2スライス（BIZ-05 + UI-09a/b official 表示 + repo §14.21-14.22 + 「日次売上を見る」CTA）を Plans.md 次の行動へ登録。
4. **制約整合**: 既存テスト削除・skip 禁止（CLAUDE.md）を AC に明記。CMD 薄層維持。実データ非混入（Data Safety）。UI→CMD→BIZ→IO 一方向。
5. **scope 規律**: 第2スライス境界（official 表示系）と「日次売上を見る」CTA deferral を Non-scope に明示し、§55.0 完成形記述は縮めない。設計判断の新設禁止と Design Phase 差し戻し条件を Design Readiness に明記。
6. **commit 分割**: migration v4 + repo → IO-07 parser（+ 29-io §29.4 追記）→ BIZ-08 → CMD-12 + AppState + bindings 再生成 → UI（query-keys / tab 構成 / daily-report-import feature / navigation）→ docs 同期（55-ui §55.1 / 45-cmd 表記訂正 / traceability）の順で分け、各段で targeted gate を回す（Codex への指示に含める）。
7. **残リスク**: line_key 対応表が実サンプル shape 依存のため、実装時の導出結果が設計想定（gross_sales / net_sales 導出可能）と食い違う可能性がある。食い違った場合は実装を止めて Design Phase に戻す（必須サマリ検証 §37.3 step 6 の変更は設計判断）。UI の operator 文言・L3 は owner 待ちのため Draft PR で pending 管理。

## Implementation Results

実装後に記入。

## Review Response

### Round 1（PR #125 受け入れレビュー）

- 対応範囲: 実装本体の設計適合・データ安全性は確認済み。指摘は Test Matrix が約束したテスト欠落と docs 微修正のみとして同一 PR で対応。
- P2 対応:
  - B6: `test_daily_report_req401_commit_does_not_write_sale_records_or_stock` を追加し、商品を `stock_quantity=N` で seed した直後の日報 commit が `products.stock_quantity` / `sale_records` / `inventory_movements` を汚染しないことを固定。
  - B9: `test_daily_report_req401_commit_overwrite_unconfirmed_validation_failed` を追加し、`OverwriteRequired` + `overwrite_confirmed=false` が `BizError::ValidationFailed` を返すことを固定。
  - B10: `test_daily_report_req401_commit_expired_preview_import_error` を追加し、期限切れ `CachedDailyReportPreview` が `BizError::ImportError` を返すことを固定。
  - C4/C5: CMD 層の cache lifecycle を `AppState` 直接構築パターンで検証するため `commit_daily_report_import_with_state` を内部 helper 化し、cache miss / 期限切れ token、成功時 token 削除、期限切れ以外の失敗時 cache 残存を固定。
  - IO7: `test_parse_daily_report_req401_invalid_format_z002_z005` を追加し、Z002/Z005 の 4 列反復崩れが `invalid_format` になることを固定。
- P3 対応:
  - C2 の 20MB 超ファイル reject、B2 の `daily_report_imports` 非作成、B13 の `daily_report_rollback` operation_log、R6 の空スライス no-op、F1 の invalid action 据え置き、F3 の 1/4 ファイル reject を追加。
  - Design Readiness に 37-biz §37.3 step 6 の必須サマリ条件緩和を追記。
  - Test Matrix の Test target 名を実装ファイル・実テスト名へ照合更新。

### L3-R1（PR #125 Windows native L3 実ファイル parse 契約バグ）

- 真因: layout B（連結型エクスポート）実サンプルから列構造を誤導出し、synthetic fixtureも誤導出shapeに寄っていたため、layout A（プリアンブル型）の実 Z001/Z002/Z005 が `invalid_number` / `invalid_format` で全滅した。
- 対応:
  - IO-07 parser を layout A（7行プリアンブル → header → 4列データ行）と layout B（先頭メタ → header → 4列反復の連結）の両対応へ修正。4列は `record_code, label, quantity_or_count, amount` とし、Z001 gross/net、Z002支払、Z005部門の数量/件数/金額 mapping をCSVヘッダ行とPDFレポート仕様に整合させた。
  - `YYYY/M/D` と `YYYY-MM-DD` の日付を IO-07 で `YYYY-MM-DD` へ正規化。
  - layout B を正式サポートする synthetic test を追加し、どちらにも該当しない構造や4列反復崩れは `invalid_format` で安全に落ちる契約を維持。
  - 29-io §29.4.1、B-2、37-biz、Test Matrix、project memory / Plans / handoff を同期。
- Local-only gate: 3月期 bundle（layout B を含む実 Z001/Z002/Z005）と6月期 bundle（layout A 実 Z001/Z002/Z005）を一時 Rust probe で `parse_daily_report_bundle` に投入し、両方で `parse_errors=0`、summary/payment/department 行数、gross/net がCSVヘッダ行とPDF仕様どおりの列から取れていること、6月期 bundle のラベル構成・行の並びが sanitized xlsx layout と整合することを確認。一時probeは削除済み。実ファイル・実値はcommitしない。

### L3-R2（PR #125 Windows native L3 preview reselect / operator alert）

- 診断: 一時計装で preview 再選択時の breadcrumb が `preview-onChange-start` → `preview-onChange-clear-before` → `preview-onChange-clear-after` で止まり、`selectFiles` の `validated` / `dispatched` / `arraybuffer-*` / IPC 入口へ進まないこと、`dr-lasterror=null` でページ内 JS 例外がないことを確認。原因は PreviewStep 内の `<Button asChild><label><input type="file" className="sr-only" /></label></Button>` が Windows WebView2 で再選択直後に不安定化し、選択処理と step unmount が同じ経路に乗る構造に寄ったものと判断。
- 対応: PreviewStep 内の label + hidden input を廃止した後も、owner 再現で「ファイルを選び直す」クリック時点で white screen、3ファイル選択後のみ復帰、2ファイル以下では white screen 継続が確認された。HTML `input[type=file]` picker 起動自体が WebView2 で不安定と判断し、日報取込みの初回選択/再選択を `plugin-dialog.open({ multiple: true })` + `plugin-fs.readFile` へ切替。invalid ファイル数は read/parse 前に toast で reject する。
- Operator UI: `AlreadyImported` は preview 上部に destructive Alert「この日報は取込み済みです。二重取込みはできません。」+ 選び直し誘導を表示。`OverwriteRequired` は warning Alert で上書き確認が必要な旨をテキスト表示。Badge は残すが、状態を色だけに依存しない。
- Test Matrix: F8（native dialog reselect）、F9（AlreadyImported / OverwriteRequired の Alert 帯）、F10（native dialog cancel / invalid count / 3ファイル read→parse）を追加し、`DailyReportImportPage.test.tsx` / `useDailyReportImportFlow.test.tsx` に RTL / hook test を追加。

### L3-R3（PR #125 Windows native L3 file selection inline feedback）

- 診断: L3-R2 で native dialog へ切替後、選択数不足や read 失敗は toast のみで通知していた。Windows native の白画面復帰問題は解消方向だが、toast を見逃すと operator が同じ選択ボタン付近で原因を再確認できない。
- 対応: `useDailyReportImportFlow` の返す `state` に `lastSelectionError: string | null` を追加。dialog 起動時と3ファイル成功選択時にクリアし、選択数不一致 / read 失敗 / サイズ超過時は1スロット置換で保存する。画面上部 Alert は引き続き `AlreadyImported` / `OverwriteRequired` のデータ安全系専用とし、ファイル選択エラーは選択ボタン直下に destructive text + icon で表示する。
- Test Matrix: F11（2ファイル選択 → inline error 表示 → 3ファイル選択成功で error clear + preview）を追加し、`DailyReportImportPage.flow.test.tsx` で実 hook + 実 page の RTL を追加。
