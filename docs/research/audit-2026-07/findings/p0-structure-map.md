# P0 構造マップ

## 監査時点

- 対象 branch: `agent/arch-audit-2026-07`
- 対象 HEAD: `3e335944302cc9c5a1034de5251560947aa68960`
- 規範上の依存方向: `UI -> CMD -> BIZ -> IO/MNT`（`docs/ARCHITECTURE.md` §1）
- 目録方法: production source のファイル一覧、route から feature への import、frontend の shared component import、Rust の `crate::` import を照合した。テストは配置把握に含めたが、再利用数の集計からは除外した。

## 全体概観

```text
src/routes ──> src/features ──> src/components / src/lib
                    │
                    └─ commands.* (generated bindings)
                              │
src/lib/bindings.ts ──────────┴─> src-tauri/src/cmd
                                           │
                                           v
                                  src-tauri/src/biz
                                      │         │
                                      v         v
                              src-tauri/src/db  src-tauri/src/io
                                      ^
                                      │
                              src-tauri/src/mnt
```

- frontend IPC は production source では `src/lib/bindings.ts` の `commands.*` と `src/lib/invoke.ts` の `unwrapResult` に集約されている。`@tauri-apps/api/core` の直接 `invoke` は `bindings.ts` 以外で検出しなかった。
- TanStack Query key は `src/lib/query-keys.ts` が共通 factory。feature 側の query hooks/page がこれを参照する。
- backend の command 登録と generated binding 出力は `src-tauri/src/lib.rs`、command state/error 境界は `src-tauri/src/cmd/mod.rs` にある。
- backend は設計上の IO を、外部ファイル処理の `io/` と SQLite repository の `db/` に実装分割している。

## Frontend モジュール目録

### feature と route

| feature | 主な route / 到達元 | 内部構成の概観 |
|---|---|---|
| `home` | `/` | `HomePage`、summary/action/PLU notification components、summary query hooks |
| `products` | `/products/`, `/products/new`, `/products/$code/edit`, `/products/import` | list/form/import pages、form/table/pagination components、query hooks、request/search/return-to helpers |
| `stock-inquiry` | `/stock/` | page、list/detail/status components、query hook、表示・状態導出 helpers |
| `stock-movements` | `/stock/$code/movements` | page、`MovementTable`、query hook、formatter |
| `receiving` | `/inventory/receiving/` | page、request/row helpers、feature-local types |
| `return-exchange` | `/inventory/return/` | page、request/row/receipt-image helpers、feature-local types |
| `manual-sale` | `/inventory/manual-sale/` | page、request/row helpers、feature-local types |
| `disposal` | `/inventory/disposal/` | page、request/row helpers、feature-local types |
| `inventory-records` | `/inventory/records` と receiving/return/manual-sale/disposal detail routes | hub page、4 detail pages、共有 search type |
| `csv-import` | `/csv-import` の Z004 tab | page、6-state reducer、flow hook、step/dropzone/dialog/table components |
| `daily-report-import` | `/csv-import` の日報 tab | page、6-state reducer、flow hook、feature-local types |
| `plu-export` | `/products/plu-export` | page 内に prepare/confirm/list flow |
| `daily-sales` | `/reports/daily` | page、report/export hooks、table/summary/date/export components、集計・sort/filter helpers |
| `monthly-sales` | `/reports/monthly` | page、report hook、table/summary/month/export components、集計・比較・sort helpers |
| `stocktake` | `/stocktake` | page、6 query/mutation hooks、formatter、feature-local types |
| `threshold-settings` | `/settings/thresholds` | page、load/save hooks、zod form schema と抽出 helper |
| `backup-restore` | `/settings/backup` | page 内に settings/list/backup/restore state と mutations |
| `operation-logs` | `/settings/logs` | page、operation type registry、search type |
| `integrity-check` | `/settings/integrity` | page 内に idle/running/completed/fix flow |
| `shortcuts` | `RootLayout` から dialog | dialog、shortcut table/key components、data/types/hook |

### route / config / lib

- `src/routes/`: 31 files（production route/root 30 + route test 1）。file-based route は薄く、page と URL search validation/title を接続する。
- `src/config/navigation.ts`: sidebar navigation と active 判定のデータ定義。`navigation.test.ts` が到達先と active contract を固定する。
- `src/lib/bindings.ts`: Rust command/DTO の tauri-specta generated contract。
- `src/lib/invoke.ts`: generated Result の unwrap、`InvokeError`、`CmdError` 正規化、error kind constants。
- `src/lib/query-keys.ts`: query key factory と invalidate prefix。
- `src/lib/hooks/useExportFile.ts`: report export の共通 command/file-save hook。
- `src/lib/{utils,env,display-scale,page-scroll}.ts`: class merge、公開環境設定、表示倍率、route 遷移時 scroll の横断 helper。

## 共有部品目録

### repository-wide component 層

| 配置 | production components | 主な利用範囲 |
|---|---:|---|
| `src/components/ui/` | 27 | shadcn/Radix primitives。production import 上位は `button` 42、`alert` 31、`table` 24、`badge` 23、`skeleton` 20、`card` 13 |
| `src/components/patterns/` | 6 | `PageHeader` 24、`EmptyState` 18、`DepartmentFilter` 4、`FormSection` 3、`SearchBar` 2、`SummaryCard` 1 |
| `src/components/layout/` | 7 | `RootLayout`、sidebar 群、display-scale control/hook。全 route の共通 shell |
| `src/components/sales/` | 1 | `TabsHeader` を日次/月次 report が共有 |

### pattern ごとの主な再利用先

- `PageHeader`: home、products 3 pages、stock inquiry/movements、receiving/return/manual-sale/disposal、inventory record hub/details、CSV import、reports、stocktake、PLU、settings 3 pages、integrity。
- `EmptyState`: product/stock/report tables、入出庫 4 flows、record hub/details、logs、stocktake、movement history。
- `DepartmentFilter`: product list、stock inquiry、daily sales、stocktake。
- `FormSection`: product form、stocktake、threshold settings。
- `SearchBar`: product list、stock inquiry。
- `TabsHeader`: daily/monthly sales。

### feature-local 独自実装の目録（P1 参照候補）

- `SortableHeader`: daily sales `ProductTable`、monthly sales `DepartmentTable`、monthly sales `ProductRankingTable` の3実装。
- file input: return receipt、product import dropzone/preview、Z004 dropzone/preview の5箇所。
- `ExportBar`: daily/monthly sales の2実装。
- `SummaryCardsBar`: daily/monthly sales の2実装。
- date navigation: daily `DateNavigator` と monthly `MonthNavigator`。
- 各 feature は domain 固有 table を所有する一方、table primitive と `EmptyState` は共有する。

## Backend モジュール目録

### CMD

| module | 接続先の概観 |
|---|---|
| `product_cmd` | `biz::product_service` |
| `receiving_cmd`, `return_cmd`, `manual_sale_cmd`, `disposal_cmd` | `biz::inventory_service` |
| `inventory_cmd` | `biz::product_service` + `biz::inventory_service` |
| `csv_import_cmd` | `biz::csv_import_service` |
| `daily_report_import_cmd` | `biz::daily_report_import_service` |
| `plu_export_cmd` | `biz::plu_export_service` |
| `sales_cmd` | `biz::sales_service` |
| `stocktake_cmd` | `biz::stocktake_service` |
| `integrity_cmd` | `biz::integrity_service` |
| `settings_cmd` | `db::system_repo`、`io::image_manager`、`mnt::backup` を直接接続 |
| `mod.rs` | `AppState`（DB + 2 preview caches）、`CmdError`、`BizError -> CmdError` 変換 |

### BIZ

| module | 下位依存の概観 |
|---|---|
| `product_service` | product/system/inventory/stocktake repositories。商品 CRUD、検索、閾値、棚卸し中の商品追加 |
| `inventory_service/{common,invariants,receiving,returns,manual_sale,disposal,list}` | product/inventory と各業務 record repository、system log。stock change と movement の不変条件を集約 |
| `csv_import_service/{parse,commit,rollback,list}` | Z004 parser、product/sales/inventory/system repositories、`inventory_service::apply_stock_change` |
| `daily_report_import_service/{parse,commit,rollback,list}` | daily report parser、product/sales/system repositories |
| `plu_export_service` | product/system repositories + PLU formatter |
| `sales_service` | sales repository + report CSV exporter |
| `stocktake_service` | stocktake/product/inventory/system repositories |
| `integrity_service` | product/inventory/system repositories |
| `mod.rs` | 共通 DTO re-export と `BizError` |

### DB / IO / MNT

- `db/`: `product_repo`, `inventory_repo`, `receiving_repo`, `return_repo`, `manual_sale_repo`, `disposal_repo`, `sales_repo`, `stocktake_repo`, `system_repo`、共有 `inventory_common`、schema v1-v4、migration/test support。
- `io/`: `z004_parser`, `daily_report_parser`, `product_csv_importer`, `plu_formatter`, `report_csv_exporter`, `image_manager`。
- `mnt/`: `backup`, `log_manager`, `diagnostic_log`, `migration`。
- app bootstrap (`src-tauri/src/lib.rs`) は DB 初期化/migration、diagnostic log、plugin、command handler、generated binding export を組み立てる。

## 後続 package の参照点

- P1: feature-local 独自実装の目録と component catalog の対応を精査する。
- P2: `settings_cmd` の直接下位依存、各 CMD の処理内容、generated bindings 経由の統一を精査する。
- P3/P4: `CmdError`/`InvokeError` 境界、generated DTO と feature-local types/schema を精査する。
- P5: `queryKeys` と feature hook/page の query lifecycle を精査する。
- P6: `#[allow(dead_code)]`、未使用 UI primitive/export、route 到達性を精査する。
- P7/P8: 大型 page/service、命名/comment、test の実配線と anti-tautology を精査する。
