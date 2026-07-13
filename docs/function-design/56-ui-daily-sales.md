> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: ARCHITECTURE.md（タスク仕様）、[ui-task-specs.md §UI-09a/09b](../architecture/ui-task-specs.md)（タスク要求）、[SCREEN_DESIGN.md §日次売上レポート画面](../SCREEN_DESIGN.md)（レイアウト判断）、[2026-05-17-phase-2-ui-09a.md](../archive/plans/2026-05-17-phase-2-ui-09a.md)（実装プラン archive、本書の判断根拠）

## 56. UI-09a: 日次売上レポート画面

> **2026-06-30 REQ-401 redesign note**: 日次売上画面は、Z001/Z002/Z005由来の公式日報集計と、Z004/手動販売由来の商品別売上明細を分けて表示する。日報取込み済みでも商品別明細が空の場合があるため、「商品別がない=売上がない」と扱わない。

### 本書のテンプレ判定（業務ロジックあり版、共通 6 項目）

UI 層関数設計書の 2 段階テンプレ（業務ロジック有無で使い分け、`memory/frontend-function-design-granularity.md`）に従い、UI-09a は**業務ロジックあり版**と判定する。

**判定根拠**:

- CMD 呼び出し: `commands.getDailySales(date)` ×2（当日 + 前日 useQuery、部分障害許容）+ `commands.exportSalesCsv("daily", date)` ×1（useMutation、Blob ダウンロード）
- 入力バリデーション: URL search params の zod 4 validateSearch + `<input type="date">` ネイティブバリデーション
- 画面内部 state 駆動のフロー分岐: 単価派生計算 + 部門小計行挿入 + 前日比カード部分障害 fallback + 列ソート（5 列対応、`unit_price=null` 末尾配置） + CSV エクスポート Blob memory 安全性

→ **業務ロジックあり版**。共通 6 項目（コンポーネント構成 / React State / CMD 呼び出し / 利用者操作フロー / エラー表示 / ローディング表示）+ ショートカット / 備考 / 非目的 + 更新履歴の 10 章構成。

UI-00 ホーム同型の「簡潔版 = useState + useQuery + 純関数」を採用（useReducer は不要、状態数 6 未満 + 並行/cancel なし、`memory/feedback-recommend-with-explicit-basis.md`）。React 19 React Compiler で memoize 自動化、`useMemo` / `useCallback` 明示なし。

---

### 56.1 概要

`/reports/daily` route 配下に配置する読み取り専用ダッシュボード。SP-501-01〜07 + REQ-501 に直接対応する。SCREEN_DESIGN.md L100 の主動線「CSV取込み完了 → 売上レポート確認」を成立させる。

**REQ-401再設計後の表示領域**:

| 領域 | データソース | 表示意味 |
|---|---|---|
| 日報サマリ | `DailySalesReport.official_daily_report`（daily_report_imports / daily_report_*_lines） | レジ日報の公式集計。総売上、純売上、支払集計、部門別集計 |
| 商品別明細 | `DailySalesReport.items`（sale_records） | Z004商品別CSVまたは手動販売出庫から得た商品別売上 |
| 商品別部門小計 | `DailySalesReport.department_subtotals`（sale_records集計） | 商品別明細が存在する範囲の部門小計 |

`UI-09a-D12`: 日報サマリと商品別明細を1つの表に混ぜない。Z001/Z002/Z005は商品コードを持たないため、商品名・JAN付き一覧を生成できない。商品別一覧はPLU/Z004または手動販売出庫の範囲だけを表す。

#### REQ-401 第2スライス表示詳細

- `DailySalesPage` は `SummaryCardsBar` の下に「レジ日報（公式）」セクションを表示する。
- `official_daily_report === null` の場合は「この日付のレジ日報は未取込みです。」の軽量 note を表示し、画面全体 error や大きな EmptyState にはしない。
- `official_daily_report` がある場合は、総売上 / 純売上、支払集計、部門別集計を表示する。支払行の `amount` は nullable のため「未取得」を許容し、部門行の `amount` は必須金額として表示する。
- `official_daily_report.warnings` が非空の場合は、公式日報セクション内に warning トーンの注記（アイコン + テキスト）を表示する。上部 Alert 帯は取得失敗やデータ安全系状態に限定し、部門未対応 warning とは混ぜない。
- official があり `items.length === 0` の場合、商品別明細セクションは「商品別明細は未取込み」と表示する。「売上なし」と誤読される文言は使わない。

**ファイル構成（18 file = lib 7 + hooks 2 + components 6 + page 1 + types 1 + route 1）**:

| ファイル | 責務 | 行数目安 |
|---|---|---|
| `src/routes/reports/daily.tsx` | TanStack Router file route + zod 直接渡し + `<DailySalesPage />` mount + `SearchParams` 型 export | 25-35 |
| `src/features/daily-sales/DailySalesPage.tsx` | 最上位レイアウト | 110-140 |
| `src/features/daily-sales/types.ts` | `SortColumn` (5 列、`unit_price` 含む) / `SortDirection` / `GroupedSection` / `SalesLineSummary` / `DepartmentOption` | 40-60 |
| `src/features/daily-sales/lib/sort-items.ts` | `sortDailyItems` 純関数（5 列対応、`unit_price` で `calculateEffectiveUnitPrice` 計算 + null 末尾） | 40-55 |
| `src/features/daily-sales/lib/group-items.ts` | `groupItemsByDepartment` 純関数 | 40-60 |
| `src/features/daily-sales/lib/filter-items.ts` | `filterItemsByDepartment` 純関数 | 15-25 |
| `src/features/daily-sales/lib/compute-summary.ts` | `computeSalesLineSummary` 純関数（BIZ-05 で source 別集計未提供のため UI 派生） | 25-40 |
| `src/features/daily-sales/lib/calculate-unit-price.ts` | `calculateEffectiveUnitPrice` 純関数（user Option 1.5 採用、`Math.round(abs(amount)/abs(quantity))`） | 20-30 |
| `src/features/daily-sales/lib/date-nav.ts` | `addDays` / `formatJpDate` / `useTodayDate()` hook（daily-sales 内閉鎖、UI-00 `useYesterdayDate` 同型） | 50-75 |
| `src/features/daily-sales/lib/test-fixtures.ts` | `makeMockItem(overrides: Partial<DailySaleItem>): DailySaleItem` factory | 20-30 |
| `src/features/daily-sales/hooks/useDailySalesReport.ts` | 2 useQuery + 派生 5 純関数 orchestration + `derived.departmentOptions` 生成 | 100-140 |
| `src/features/daily-sales/hooks/useExportDailySalesCsv.ts` | useMutation + Blob ダウンロード + `setTimeout(100)` で `revokeObjectURL` + Sonner id-based dedup（UI-09b PR #66 で `useExportFile` 共通化 + 本 hook は wrapper 化 = 20-30 行に縮退） | 80-110 |
| `src/features/daily-sales/components/DateNavigator.tsx` | 前日 button + `<input type="date">` + 翌日 button | 60-80 |
| `src/components/sales/TabsHeader.tsx` | 日次（`/reports/daily`）+ 月次（`/reports/monthly`）切替（router-driven `<Link>` 視覚表現、UI-09b PR #66 で共通化 + daily/monthly 共有） | 45-60 |
| `src/components/patterns/DepartmentFilter.tsx` | shadcn Select 単一選択、hook 側 `derived.departmentOptions` を pure に描画（PR-B で 3 feature のローカル実装を統合、allLabel 既定「すべての部門」、[59-ui-shared-patterns.md](59-ui-shared-patterns.md)） | 50-70 |
| `src/features/daily-sales/components/SummaryCardsBar.tsx` | 4 カード（売上合計 / 販売点数 / 売上明細数 + Tooltip / 前日比） | 90-130 |
| `src/features/daily-sales/components/ProductTable.tsx` | shadcn Table 6 列 + 列ソート（5 列対応）+ 部門小計行 + 手動バッジ + 単価列 null = 「—」placeholder | 140-180 |
| `src/features/daily-sales/components/ExportBar.tsx` | CSV 出力 button（active）+ 印刷 button（aria-disabled + Tooltip） | 50-70 |

合計 **18 file**。frontend code 1000-1300 行 + 関数設計 500-600 行 + test 270-340 行。

---

### 56.2 ファイル構成（命名規約 + 型 export）

**snake_case 維持 (specta-typescript デフォルト)**:

- Rust 側 BIZ-05 DTO（`DailySaleItem` / `DailySalesReport` / `DeptSubtotal` / `GrandTotal`）は specta-typescript のデフォルト設定で **snake_case のまま** `src/lib/bindings.ts` 経由で TypeScript 側に flow する（serde rename 等は未付与）。camelCase 変換が必要になったら別 PR で specta 設定を検討
- `bindings.ts:94-102` `DailySaleItem` の 7 field（`product_code` / `name` / `department_name` / `department_id` / `quantity` / `amount` / `source`）は specta 出力の現状仕様で、**snake_case + `source: string`** のまま、本 PR では型変動なし
- `source` field は Rust 側で `String` 型のため bindings.ts では `source: string` として出力される。`"auto" | "manual"` literal union は **使われていない** (将来 specta side で `#[serde(tag/rename)]` 等で literal 化する場合は別 PR、Backlog D-10)

**`SearchParams` 型 export**（`src/routes/reports/daily.tsx`）:

```ts
export type SearchParams = z.output<typeof searchSchema>;
```

- `z.output` を使うのは zod 4 で `.optional()` + `.catch()` の挙動が input/output で差異あるため、TanStack Router の `Route.useSearch()` の型推論と整合させる
- 各 component / hook で `SearchParams` を import せず、`Route.useSearch()` 経由で型推論を受ける（DRY、本 repo 初の validateSearch 採用パターン）

**source enum 化（将来 D-10）**:

- 現状 `source: string` (literal union 化されていない)、`computeSalesLineSummary` 内で `if (item.source === "auto") ... else if (item.source === "manual") ...` の防御的 if-else で集計、未知 source は total に含むが auto/manual 内訳には含めない設計
- 第 3 値追加（例: `"adjustment"`）が必要になった場合は本関数の if-else 分岐を追加するか、specta 側で `#[serde(tag)]` 等で literal union 化して `switch` + `never` 戻り型による網羅性チェックに切り替える方針（Backlog D-10、別 PR）

---

### 56.3 データフロー

```
URL search params (?date=...&dept=...&sortBy=...&sortDir=...)
  ↓ TanStack Router validateSearch（zod 4 直接渡し）
  ↓ Route.useSearch() = SearchParams
DailySalesPage
  ↓ useDailySalesReport({ date, dept, sortBy, sortDir })
    ↓ today useQuery: commands.getDailySales(date)
    ↓ yesterday useQuery: commands.getDailySales(yesterday(date))
    ↓ 派生 5 純関数 orchestration:
      ├ filterItemsByDepartment(items, dept)
      ├ sortDailyItems(filtered, sortBy, sortDir)
      ├ groupItemsByDepartment(sorted)
      ├ computeSalesLineSummary(items)
      └ derived.departmentOptions = unique by department_id, sort by id
  ↓ 戻り値:
    { todaySales, yesterdaySales, grouped, summary, departmentOptions, isLoading, error, partialError }
SummaryCardsBar / ProductTable / DepartmentFilter / DateNavigator / TabsHeader / ExportBar
  ↓ useExportDailySalesCsv() → commands.exportSalesCsv("daily", date) → Blob ダウンロード
```

**派生計算の責務**:

- フィルタ / ソート / グルーピング / 集計 / 単価計算 はすべて hook 内で実行、components は pure（props を受け取って描画するだけ）
- `departmentOptions` 生成も hook 側責務（DepartmentFilter は pure component）

---

### 56.4 URL state 設計（zod 4 直接渡し、sortBy 5 列対応）

```ts
// src/routes/reports/daily.tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DailySalesPage } from "@/features/daily-sales/DailySalesPage";

const searchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  dept: z.coerce.number().int().positive().optional().catch(undefined),
  sortBy: z.enum(["product_code", "name", "quantity", "unit_price", "amount"]).optional().catch(undefined),
  sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
});

export type SearchParams = z.output<typeof searchSchema>;

export const Route = createFileRoute("/reports/daily")({
  validateSearch: searchSchema,
  component: DailySalesPage,
});
```

**デフォルト値とフォールバック**:

| param | 未指定時 | 不正値時 |
|---|---|---|
| `date` | 当日（`useTodayDate()` から取得） | undefined fallback → 当日 |
| `dept` | `null` = すべて | undefined fallback → すべて |
| `sortBy` | `null` = ソートなし（BIZ 層の `department_id` 昇順を維持） | undefined fallback → ソートなし |
| `sortDir` | `"asc"`（sortBy 指定時のみ意味あり） | undefined fallback |

**不正値の挙動**:

- `?date=invalid` / `?dept=abc` / `?sortBy=garbage` / `?sortBy=department`（enum 5 値外で一見有効）→ `.optional().catch(undefined)` で各 field 単位に undefined fallback
- schema 全体は throw しない、画面は当日 + 全部門 + ソートなしで描画
- F5 耐性: URL を bookmark / 再読込しても同じ状態が復元される

**search params 部分更新**（TanStack Router 関数形式で他 param 温存）:

```ts
const search = Route.useSearch();  // 型推論 = SearchParams
const navigate = Route.useNavigate();

const handleDateChange = (newDate: string) => {
  navigate({ search: (prev) => ({ ...prev, date: newDate }) });
};

const handleSortChange = (column: SortColumn) => {
  navigate({
    search: (prev) => ({
      ...prev,
      sortBy: column,
      sortDir: prev.sortBy === column && prev.sortDir === "asc" ? "desc" : "asc",
    }),
  });
};
```

本 repo 初の `validateSearch` 採用（`rg -n "validateSearch" src/` → 0 件、PR #65 で確立）。

**関連 memory**:

- `feedback-desktop-app-url-design.md`: URL 状態化原則（テスト容易・F5 耐性・queryKey 独立・コード分割）
- `zod-4`: v4 では `z.coerce.number()` のまま、`z.enum()` の breaking change は string literal 配列のみ受理（本 plan 準拠済）

---

### 56.5 hook 設計

#### useDailySalesReport

```ts
type Args = {
  date: string;          // YYYY-MM-DD
  dept: number | null;   // null = すべて
  sortBy: SortColumn | null;
  sortDir: SortDirection;
};

type Result = {
  todaySales: DailySalesReport | undefined;
  yesterdaySales: DailySalesReport | undefined;
  grouped: GroupedSection[];        // 部門小計挿入済み
  summary: SalesLineSummary;        // 売上明細数 = items.length + 自動/手動内訳
  departmentOptions: DepartmentOption[];
  isLoading: boolean;
  error: Error | null;              // 当日 fail = 画面全体 Alert
  partialError: { yesterday: Error | null };  // 部分障害（前日比カードのみ）
};

export function useDailySalesReport(args: Args): Result;
```

**実装方針**:

- `today useQuery`: `queryKeys.dailySales(args.date)` / `staleTime: 5 * 60_000`（UI-00 と統一）/ `gcTime: 10 * 60_000`
- `yesterday useQuery`: `queryKeys.dailySales(addDays(args.date, -1))` / 同 staleTime、**`enabled: true` 常時**（UI-00 部分障害許容パターン `53-ui-home.md §53.4 D-3` と整合）
- 派生計算は `useQuery` 完了後に同期実行（5 純関数を順次適用、React Compiler 自動 memoize）
- `partialError.yesterday` を SummaryCardsBar に渡し、前日比カードのみ「比較データなし」描画（他 3 カード + テーブルは正常）

**staleTime 統合の根拠**:

- UI-00 が `queryKeys.dailySales(yesterday)` を 5min staleTime で購読、本 hook も同 queryKey + 同 staleTime で重複しても問題なし
- 動的 staleTime（当日 30sec / 過去日 24h）は同 queryKey 異 staleTime の anti-pattern、却下（§9 代替案）

#### useExportDailySalesCsv

```ts
type Args = {
  date: string;
};

type Result = {
  exportCsv: (args: Args) => void;
  isExporting: boolean;
};

export function useExportDailySalesCsv(): Result;
```

**実装方針**:

- UI-09b PR #66 で `useExportFile({ reportType, target })` 共通化、`useExportDailySalesCsv` は `exportFile({ reportType: "daily", target: date })` wrapper に縮退（80-110 行 → 20-30 行）
- queryKey なし（副作用なし、cache invalidate しない）
- `onSuccess`: base64 → Uint8Array → Blob → `URL.createObjectURL` → `<a download>` click → `setTimeout(() => URL.revokeObjectURL(url), 100)`（共通化先 `useExportFile` に集約）
- `onSuccess` Sonner: `toast.success("日次売上 を保存しました（${n} 件）", { id: "export-daily-success" })` ← id-based dedup（連続クリックでも重複トースト 0、PR #66 で `-csv-` セグメント削除 + reportType ラベル化）
- `onError` Sonner: `toast.error("出力に失敗しました: ${message}", { id: "export-daily-error" })`

**Blob memory 安全性の 3 罠**（実装時に必ず踏襲）:

1. **revokeObjectURL タイミング**: `setTimeout(() => URL.revokeObjectURL(url), 100)` で Chromium download 中断回避（即時 revoke すると download が中断するケースあり）
2. **IPC payload size**: `bytes_base64` は 1 日 sale_records 最大想定 1000 件 × ~200 byte = ~200KB、Tauri 2 IPC payload 上限（WebView2 256MB 公称、現実 50MB degrade）内、安全マージン十分
3. **base64 改行混入**: Rust 側 `cmd::sales_cmd::export_sales_csv` で `base64::engine::general_purpose::STANDARD.encode` 使用 = 改行なし pure base64 → UI 側 `atob(bytes_base64)` 直 decode 安全。`MIME` engine のみ改行混入リスクあり、本実装の `STANDARD` engine は安全（`.replace(/\s/g, '')` 前処理不要）

#### useTodayDate（daily-sales 内閉鎖）

- `src/features/daily-sales/lib/date-nav.ts` 内に `useTodayDate(): string` を `useYesterdayDate.ts` と同型で実装（`toLocaleDateString("sv-SE")` + Visibility API listener）
- UI-00 の `useYesterdayDate` との実装重複は 5-10 行レベルで許容（DRY 違反軽微）
- 将来 UI-09b / UI-06a 等で today/yesterday hooks を多用するようになったら `src/lib/dates/` に共通化（Backlog 候補）

---

### 56.6 純関数（テスト対象 6 個）

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `sortDailyItems` | `(items: DailySaleItem[], by: SortColumn \| null, dir: SortDirection) => DailySaleItem[]` | 5 列対応。`unit_price` で `calculateEffectiveUnitPrice` を計算してから数値比較。`null` 行は末尾配置（asc/desc 共通）。同値タイブレークは入力順保持（安定ソート） |
| `groupItemsByDepartment` | `(items: DailySaleItem[]) => GroupedSection[]` | 部門ごとに小計行を挿入。部門順は `department_id` 昇順固定（BIZ-05 順を尊重）。各 section は `{ departmentId, departmentName, items, subtotalQuantity, subtotalAmount }` |
| `filterItemsByDepartment` | `(items: DailySaleItem[], deptId: number \| null) => DailySaleItem[]` | `deptId === null` で恒等関数（items そのまま）。該当行なしの場合は空配列を返す |
| `computeSalesLineSummary` | `(items: DailySaleItem[]) => SalesLineSummary` | `{ total: items.length, autoCount: items.filter(i => i.source === "auto").length, manualCount: items.filter(i => i.source === "manual").length }`。BIZ-05 で source 別集計未提供のため UI 派生（将来 BIZ 拡張で削除可能） |
| `calculateEffectiveUnitPrice` | `(item: DailySaleItem) => number \| null` | `item.quantity === 0` → `null`、それ以外 → `Math.round(Math.abs(item.amount) / Math.abs(item.quantity))`。返品行（quantity<0, amount<0）も絶対値で「単価の大きさ」として正数表示（user Option 1.5 採用） |
| `addDays` | `(date: string, days: number) => string` | YYYY-MM-DD 形式の日付に N 日加算。月またぎ / 年またぎ / 閏年 2/29 を正しく処理（`new Date(date)` + `setDate(getDate()+days)` + `toLocaleDateString("sv-SE")`） |

**`calculateEffectiveUnitPrice` 仕様**（user Option 1.5 確定、§56.10 業務ルール参照）:

```ts
// src/features/daily-sales/lib/calculate-unit-price.ts

/**
 * 売上明細の実績単価を計算する純関数。
 * 商品マスタの販売単価ではなく、売上記録の金額 ÷ 数量で求めた派生値。
 * 返品行（quantity<0 + amount<0）では絶対値で「単価の大きさ」として表示。
 * quantity=0 の場合は null を返し、表示側で「—」placeholder。
 * 端数は四捨五入で整数円表示（Math.round）。
 */
export function calculateEffectiveUnitPrice(item: DailySaleItem): number | null {
  if (item.quantity === 0) return null;
  return Math.round(Math.abs(item.amount) / Math.abs(item.quantity));
}
```

**`computeSalesLineSummary` 根拠**（BIZ-05 で source 別集計未提供のため UI 派生）:

- BIZ-05 `DailySalesReport` の `GrandTotal` は `{ quantity, amount }` のみ、source 別 count を返さない
- UI で `items` 配列を再走査して `auto / manual` カウントを派生計算
- 将来 BIZ-05 を拡張して `GrandTotal.auto_count` / `manual_count` を追加すれば本関数は削除可能（Backlog 候補）
- `source: string` に対する防御的 if-else 実装（`compute-summary.ts:14-17`）で `"auto"` / `"manual"` を識別、未知値は内訳に含めない（防御的設計、bindings.ts では literal union 化されていない）

---

### 56.7 UI コンポーネント

**UI component 利用一覧**:

| component | 利用箇所 |
|---|---|
| `Card` | SummaryCardsBar（4 カード） |
| `Button` | DateNavigator（前日/翌日）、ExportBar（CSV出力/印刷） |
| `Select` | DepartmentFilter |
| `SegmentedControl` visual primitive | TabsHeader（日次 / 月次 切替、router-driven `<Link>` 視覚表現、UI-09b PR #66 で `src/components/sales/` 共通化）。二択切替の見た目は `src/components/ui/segmented-control.tsx` の list/item/active/inactive class を使い、active border は押しボタン状に見えない `border-stone-300` とする |
| `Table` | ProductTable（6 列） |
| `Tooltip` | SummaryCardsBar（売上明細数）、ExportBar（印刷 disabled） |
| `Badge` | ProductTable（手動行の黄色「手動」バッジ） |
| `Alert` | DailySalesPage（当日 fail 時の画面全体 error） |
| `Skeleton` | DailySalesPage / ProductTable（loading 時） |

**SummaryCardsBar overflow 対策（PR #70 / PR-3）**:

- `Card` + `CardContent` に `min-w-0`、value div に `truncate` を付与する。monthly と同じく、grid item の `min-width:auto` と長い金額・期間ラベルによるカード溢れを止めるための CSS 対策。

**商品コード readability（2026-06-07 follow-up）**:

- H-6 Windows native 5 画面通し確認で「商品コードは小さい」と feedback があったため、日次売上 `ProductTable` の商品コードセルは `font-mono text-sm font-medium` とする。旧 `text-xs` は最小級で、全体 WebView 表示スケール導入後も単独で読みにくさが残るため使わない。

**DatePicker 非採用根拠**:

- shadcn Date Picker は dayjs 依存 + 7 追加 component
- `<input type="date">` ネイティブで十分（OS タイムゾーン / 日本語 / キーボード操作 / accessibility 全て揃う）
- WSL2 / Windows native 両環境で動作確認済（UI-00 で実証）

**部門小計行の表現**:

```tsx
<tr className="bg-stone-100 dark:bg-stone-800 font-medium">
  <td colSpan={3}>{departmentName}</td>
  <td className="text-right">{subtotalQuantity}</td>
  <td />{/* 単価列は空 */}
  <td className="text-right">¥{subtotalAmount.toLocaleString("ja-JP")}</td>
</tr>
```

- grey 帯 = stone palette warm tones（[../design-system/00-foundations.md](../design-system/00-foundations.md)「カラーパレット」ウォーム系採用の論拠）
- 単価列は空（小計に単価概念なし）

**単価列 null = 「—」placeholder**:

```tsx
<td className="text-right">{unitPrice === null ? "—" : `¥${unitPrice.toLocaleString("ja-JP")}`}</td>
```

- `quantity=0` 行は表示上「—」、ソート時末尾配置
- em-dash "—" を使用（hyphen "-" ではない、視覚的に「データなし」を明確化）

**Sonner dedup pattern**:

```ts
toast.success("日次売上 を保存しました（23 件）", { id: "export-daily-success" });
toast.error("出力に失敗しました: ロックされたファイル", { id: "export-daily-error" });
```

**PR #66 改名注記**: `export-daily-csv-success`/`export-daily-csv-error` は本 PR (UI-09a) 当時の id、UI-09b PR #66 で `useExportFile` 共通化に伴い `-csv-` セグメント削除 + reportType (`daily` / `monthly_by_product` / `monthly_by_department`) ラベル化に rename。同 id 内 dedup 動作は維持、内部 dedup key の実態整合性を優先（memory `feedback-naming-must-match-reality.md` 系の判断軸、外部公開 API ではないため後方互換 wrapper 不要）。

- `id` を固定すると、同 id の既存トーストが置換される（dismiss + 再表示ではない）
- 連続クリック時の重複トースト発火を防止（PR #56 P2-B horizontal pattern を継承）

---

### 56.8 エラー処理

**3 階層のエラー扱い**:

| エラー源 | 影響範囲 | 表示 |
|---|---|---|
| 当日 useQuery fail | 画面全体 | `<Alert variant="destructive">` + 「再試行」ボタン、サマリ + テーブル + エクスポート全て描画されない |
| 前日 useQuery fail | 前日比カードのみ | 「比較データなし」+ カード内 inline icon、他 3 カード + テーブル正常 |
| export useMutation fail | トースト | Sonner error トースト（id-based dedup）、画面状態は不変 |

**当日 fail = 画面全体 Alert** の根拠:

- 主要表示データが取得できない以上、サマリ・テーブル・エクスポート全て無意味
- UI-00 ホーム同型（部分障害許容パターン `53-ui-home.md §53.4`）

**前日 fail = 前日比カードのみ部分障害** の根拠:

- 前日データは「補助情報」、欠損しても当日業務には影響しない
- 当日 0 円のケース（前日比 = 比較不可）と同じ表現を再利用

**export fail = Sonner エラー** の根拠:

- ファイルロック / ディスク満杯 / permission denied 等は一過性、画面状態を壊さず通知のみ
- 失敗後も同 button 連打で再試行可能（id-based dedup）

**CmdError 分類**:

- BIZ-05 fail（query 内部エラー）: 「データ取得に失敗しました」
- IO-05 fail（CSV エクスポート、ファイルダイアログキャンセル）: 「保存先が指定されませんでした」（user キャンセル）/ 「ファイル書き込みに失敗しました」（IO エラー）

---

### 56.9 テスト戦略

**Vitest 純関数 only（本 PR scope）**:

`memory/feedback-vitest-react19-setup-pattern.md` §1-8 全踏襲（pretest hook 設計 / vitest.config 最小構成 / eslint+globals 連携 / tsconfig types 拡張 / setup.ts / array-type rule / mock cast pattern / table-driven + focused test 併用）。

| ファイル | ケース数 | 内容 |
|---|---|---|
| `lib/sort-items.test.ts` | 6-8 | 空 / 1 件 / 列別（5 列: product_code / name / quantity / unit_price / amount）/ 同値タイブレーク / null guard（`unit_price=null` 末尾配置） |
| `lib/group-items.test.ts` | 4-6 | 空 / 1 部門 / 複数部門 / 部門小計位置 / department_id 昇順 |
| `lib/filter-items.test.ts` | 4 | null 恒等 / 該当あり / 該当なし / 複数該当 |
| `lib/compute-summary.test.ts` | 4-5 | 空 / 全 auto / 全 manual / 混在 / 未知 source 防御 |
| `lib/calculate-unit-price.test.ts` | 5 | ① 2376/4=594 ② -594/-1=594（返品行）③ 2002/2=1001 ④ 1000/3=333（四捨五入）⑤ quantity=0=null |
| `lib/date-nav.test.ts` | 5-7 | 前日 / 翌日 / 月またぎ / 年またぎ / 閏年 2/29 / 不正 date |

合計 **30-37 ケース**、`makeMockItem` factory 利用で `DailySaleItem` 7 field 全必須を保証（`bindings.ts` との型整合）。

**factory helper**:

```ts
// src/features/daily-sales/lib/test-fixtures.ts
import type { DailySaleItem } from "@/lib/bindings";

export function makeMockItem(overrides: Partial<DailySaleItem> = {}): DailySaleItem {
  return {
    product_code: "P001",
    name: "商品A",
    department_name: "毛糸",
    department_id: 1,
    quantity: 1,
    amount: 100,
    source: "auto",
    ...overrides,
  };
}
```

**hooks/components test は本 PR スコープ外**:

- TanStack Query Provider mock / Router mock の追加は 7-7b 後続 PR
- `memory/feedback-pr-merge-gate-scope-discipline.md` 準拠、PR size を新規 19 + 更新 11 に抑える
- E2E（Playwright）は Phase 2 完了時 8-9 判定で対応

---

### 56.10 業務ルール

#### 売上明細数（user Option 1.5 採用）

- カード名 = 「売上明細数」（旧表記「取引件数」から変更、`memory/feedback-naming-must-match-reality.md` 準拠）
- 値 = `items.length`（sale_records の行数ベース）+ 内訳「自動 N / 手動 M」
- Tooltip = 「売上レコード行数ベース。レシート単位の取引件数は後続仕様で定義。」
- 後続 BIZ 拡張で receipt_id / POS 取引キー仕様確定後、レシート単位の「取引件数」を追加可能（Backlog 「REQ-501 取引件数の集計単位詳細仕様」）

#### 単価派生（user Option 1.5 採用）

- 計算式 = `Math.round(Math.abs(item.amount) / Math.abs(item.quantity))`
- 商品マスタの販売単価ではなく、売上記録の金額 ÷ 数量で求めた**実績単価**
- 返品行（quantity<0 + amount<0）も絶対値で正数表示（「単価の大きさ」として読みやすい）
- `quantity=0` → `null` → 「—」placeholder + ソート時末尾配置
- 厳密な業務意味（販売単価 / 値引前単価 / レシート単価）が必要になった場合は BIZ-05 DTO 拡張 or sale_records への `unit_price` 系カラム追加で別 PR 検討（Backlog 「REQ-501 単価列の意味精査」）

#### 前日比符号

- 計算式 = `(today.amount - yesterday.amount) / yesterday.amount * 100`
- 前日 0 円の場合 = 除算回避し「比較不可」表示
- 正の値 = green up 矢印、負の値 = red down 矢印（mockup 整合）

#### 部門小計のソート時挙動

- 列ヘッダソート時、部門小計行 + 部門グルーピングは維持し「部門内のみソート」
- `groupItemsByDepartment` 内で部門ごとに `sortDailyItems` 適用
- 部門順は `department_id` 昇順固定（BIZ-05 順、user の業務優先度順）

#### 返品行（quantity<0）の表示

- `is_voided=0` のため返品も対象（取消し済み売上は除外）
- quantity と amount を負数表示（赤字 / 括弧書きではなく単純な負数）
- 単価列のみ `abs(amount) / abs(quantity)` で正数表示（user Option 1.5 採用、§56.10 単価派生）

---

### 56.11 ショートカット

- グローバル ショートカット（UI-shortcuts `54-ui-shortcuts.md` で定義済）+ 画面固有ショートカット:

| キー | 動作 |
|---|---|
| `Ctrl + ←` | 前日（DateNavigator 同等） |
| `Ctrl + →` | 翌日 |
| `Ctrl + S` | CSV 出力 |
| `Ctrl + /` | ショートカット一覧（グローバル） |

- 実装は本 PR scope 外（Phase 2 完了時に画面固有ショートカット統合）、SHORTCUTS 定数の `daily-sales` グループとして将来追加

---

### 56.12 表記揺れ（3 系統許容）

- **サイドバー label** = `navigation.ts:76` 「日次売上」（利用者の縦移動メニュー、簡潔さ優先）
- **page h1** = 「日次売上」（PR-1 で mockup L313 「売上レポート」から分離。日次/月次は TabsHeader で同居するため、h1 が「売上レポート」だと L3 デモで日次か月次か判別不能だった = U4。navigation label と揃える）
- **ウィンドウタイトル** = `RootLayout.tsx:33` 経由で「在庫管理システム - 日次売上」（navigation.title 由来、OS タスクバー識別性）

3 系統は読み手・用途が異なる（縦メニュー / 画面見出し / OS タスクバー）。PR-1 以降は label・h1 とも「日次売上」で一致、ウィンドウタイトルのみアプリ名 prefix 付き。

---

### 56.13 非目的（IO/BIZ 同型表）

| やらないこと | 理由 | 責務を持つモジュール |
|---|---|---|
| 印刷ボタンの本実装 | SP-501-07 仕様未定、user 合意なし | Phase 4 で window.print + プリンタ設定 UI 検討 |
| 月次タブの本実装 | UI-09b（8-5 PR）scope | UI-09b 着手時 |
| 税率別合計の表示 | モックアップ + SP-501 明示なし | BIZ-05 DTO 拡張後の別 PR（Backlog 「税率別合計の必要性確認」） |
| BIZ-05 への source 別 count 追加 | UI 派生で軽量に実装可能 | 必要になったら BIZ 拡張で削除（`computeSalesLineSummary` を破棄可能に設計） |
| DatePicker（shadcn Date Picker）採用 | `<input type="date">` で十分、依存 7 component + dayjs 不要 | 日付範囲選択が要件化された時点で別 PR |
| hooks/components の Vitest test | TanStack Query Provider mock / Router mock 整備は 7-7b 後続 PR | 7-7b 着手時 |
| E2E（Playwright）テスト | Phase 2 完了時 8-9 判定で対応 | 8-9 判定後 |
| useTodayDate の共通 `src/lib/dates/` 移送 | UI-00 既存 `useYesterdayDate.ts` への影響、本 PR scope 外 | 将来 UI-09b / UI-06a 等で多用化する時に共通化 |

---

### 更新履歴

| 日付 | PR | 内容 |
|---|---|---|
| 2026-05-17 | PR #65 | 新規作成（Phase 2 8-3 UI-09a 日次売上レポート画面、業務ロジックあり版テンプレ、URL state + 2 useQuery + 派生 5 純関数 + 単価派生 + 主動線 CTA 配線パターン初適用） |
| 2026-05-22 | PR-1 (tone/nav fix) | page h1 を「売上レポート」→「日次売上」に分離（U4、§56.12）。TabsHeader の `activeOptions.includeSearch:false` で search params 付き URL の active 維持（B1） |
| 2026-06-06 | PR #70 | SummaryCardsBar カード溢れ対策（§56.7）: Card + CardContent に `min-w-0` + value div `truncate`。月次版と同方針 |
| 2026-06-07 | display-scale follow-up | H-6 feedback 対応として `ProductTable` の商品コードセルを `font-mono text-sm font-medium` に更新し、`ProductTable.test.tsx` で `text-xs` 回帰を防止 |
| 2026-06-08 | selection-tone follow-up | TabsHeader の二択切替 visual を `SegmentedControl` primitive に寄せ、monthly ModeTabs と同じ shared segmented control 仕様を参照する形に更新 |
