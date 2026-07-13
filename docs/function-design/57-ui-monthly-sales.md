> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: ARCHITECTURE.md（UI-09b タスク仕様）、SCREEN_DESIGN.md（月次売上レポート画面）、screen_mockups.html（モックアップ、historical reference）、34-biz-sales-service.md（BIZ-05 get_monthly_sales）、42-cmd-sales-stocktake.md（CMD-09 get_monthly_sales / export_sales_csv）、56-ui-daily-sales.md（UI-09a 業務ロジックあり版テンプレ）

## 57. UI-09b: 月次売上レポート画面

> **2026-06-30 REQ-401 redesign note**: 月次売上画面は、Z001/Z002/Z005日報由来の公式部門集計と、Z004/手動販売由来の商品ランキングを分けて表示する。日報取込み済みでも商品ランキングが空の場合があるため、ランキング空を月間売上ゼロとして扱わない。

### 本書のテンプレ判定（業務ロジックあり版・簡潔版、共通 6 項目）

| 観点 | 本画面の選択 | 根拠 |
|---|---|---|
| useQuery 数 | **1 useQuery**（`get_monthly_sales` 単一呼出、`prev_month_comparison` field を派生表示） | BIZ-05 が当月 + 前月比較を 1 call で返す設計（Q-5、UI-09a 2 useQuery 機械的横展開は誤り） |
| URL state | TanStack Router `validateSearch`（zod 4 直接渡し、`.optional().catch(undefined)` で不正値吸収） | desktop-app-ui-constraints.md「状態の URL 化」、テスト容易 + F5 耐性 + queryKey 独立 |
| 派生純関数 | 6 個（summary / period-label / comparison / composition / pick-top-ranking / sort-items / format-month-label） | UI-09a 同型、業務ロジックを純関数に閉じる |
| factory | 2 種類（`makeMockMonthlyItem` / `makeMockProductRankingRow` + `makeMockDeptCompositionRow`） | テスト DRY、UI 派生型は別 factory（G-12） |
| ファイル分離 | `src/features/monthly-sales/` 内閉鎖（types / lib / hooks / components）+ Progress wrapper は `src/components/ui/` + TabsHeader は `src/components/sales/` 共通化 | UI-09a 同型 + UI-09b で共通化先を分離 |
| Sonner dedup | id-based（`export-${reportType}-success` / `export-${reportType}-error`） | 8-7 useExportFile 共通化先で reportType ラベル付き id（PR #66 で `-csv-` セグメント削除） |

---

### 57.1 概要

- **対応 REQ**: REQ-502（SP-502-01〜06）
- **対応 task**: UI-09b（[ARCHITECTURE.md §UI-09b](../architecture/ui-task-specs.md#ui-09b-月次売上)）
- **呼び出す CMD**: `get_monthly_sales(month, mode)` + `export_sales_csv(reportType, target)`（8-7 共通化先 `useExportFile` 経由）
- **route**: `/reports/monthly`（TabsHeader 共通化で `/reports/daily` ⇄ `/reports/monthly` を `<Link>` 切替、router-driven）
- **主動線**: TabsHeader「日次」←→「月次」切替、UI-00 ホームの「月次売上」ボタンから遷移
- **失敗 4 状態**（Q-5）:
  1. API fail → 画面全体 Alert（Skeleton 撤去）
  2. items 空配列 → 「当月データなし」EmptyState
  3. `prev_month_comparison === null` または `[]` 空配列 → サマリ「比較不可」+ 各行「—」。**BIZ contract**: 通常 BIZ-05 は前月データなしも `Some(空Vec)` を返す（[`34-biz-sales-service.md` §1](34-biz-sales-service.md) + `sales_service.rs:196-197` 実装、`prev_month_comparison = Some(prev_items)` 常時セット）、`null` は specta `Option<Vec<T>>` 境界の defensive guard。UI 側 (`compute-comparison.ts`) は `null` / `[]` 両ケースを safely 扱う
  4. 前月だけ fail → 構造的不可能（1 useQuery 設計、Q-5）

**REQ-401再設計後の表示領域**:

| 領域 | データソース | 表示意味 |
|---|---|---|
| 公式部門集計 | `MonthlySalesReport.official_department_totals`（daily_report_department_lines） | 日報取込み済み日のZ005部門別売上合計 |
| 商品ランキング | `MonthlySalesReport.items` when mode=by_product（sale_records） | Z004商品別CSVまたは手動販売出庫から得た商品別ランキング |
| 商品別由来の部門集計 | `MonthlySalesReport.items` when mode=by_department（sale_records） | 商品別明細が存在する範囲の部門集計 |

`UI-09b-D8`: 公式部門集計と商品ランキングを同一の正本として混ぜない。Z005は部門別売上を持つが商品別JANを持たず、商品ランキングはZ004/手動販売出庫が根拠になるため。

#### REQ-401 第2スライス表示詳細

- `MonthlySalesPage` は既存の商品ランキング / 商品別由来の部門集計の前に「公式部門集計（レジ日報由来）」セクションを表示する。
- `official_department_totals === null` の場合は「この月のレジ日報は未取込みです。」の軽量 note を表示する。
- `official_department_totals` が空配列の場合は「公式部門集計の行はありません。」を表示し、対象月に日報親はあるが部門行がない状態と未取込み状態を分ける。
- 公式部門集計は `daily_report_department_lines` 由来、商品ランキング / 部門別構成比は `sale_records` 由来として、見出し・説明文・表を分ける。日報のみの月でも `items` は水増しせず、既存ランキング側は空のまま扱う。

### 57.2 ファイル構成（命名規約 + 型 export）

#### bindings 由来の型（specta 出力、PR #66 commit 2 で生成）

```ts
// src/lib/bindings.ts
export type SalesMode = "by_product" | "by_department";

export type SalesReportType =
  | "daily"
  | "monthly_by_product"
  | "monthly_by_department";

export type MonthlySaleItem = {
  key: string;            // by_product = product_code、by_department = department_id 文字列
  label: string;          // by_product = 商品名、by_department = 部門名
  quantity: number;
  amount: number;
  ranking: number;        // BIZ-05 row_number、1-based、同順位なし前提
};

export type MonthlySalesReport = {
  month: string;          // "YYYY-MM"
  mode: SalesMode;
  items: MonthlySaleItem[];
  prev_month_comparison: MonthlySaleItem[] | null;  // Option<Vec<T>> → null
};
```

**重要**: `prev_month_comparison` は `MonthlySaleItem[] | null`（TypeScript で `null`、`undefined` ではない）。Rust 側 `Option<Vec<T>>` の specta 出力規約。UI 派生で `null` ガード必須（失敗 4 状態 #3）。

#### features/monthly-sales/

| 配置 | ファイル | 責務 | 規模 |
|---|---|---|---|
| 新規 | `src/routes/reports/monthly.tsx` | route + `validateSearch`（zod 4） | 40-60 |
| 新規 | `src/features/monthly-sales/MonthlySalesPage.tsx` | 最上位 page、Alert / EmptyState / Skeleton 出し分け（失敗 4 状態） | 80-110 |
| 新規 | `src/features/monthly-sales/types.ts` | `SortColumn` / `SortDirection` / `SalesViewMode` / `ProductRankingRow` / `DeptCompositionRow` | 30-45 |
| 新規 | `src/features/monthly-sales/lib/compute-summary.ts` | total quantity / amount 集計（純関数） | 20-30 |
| 新規 | `src/features/monthly-sales/lib/compute-period-label.ts` | 「YYYY/MM/DD-MM/DD」固定文言生成（Q-1 B 案、F-10 文字列操作 + G-9 不正月 fallback） | 30-45 |
| 新規 | `src/features/monthly-sales/lib/compute-comparison.ts` | key 突合 + `prev_amount <= 0` ガード（Q-7、Z004 返品超過月対策） | 50-70 |
| 新規 | `src/features/monthly-sales/lib/compute-composition.ts` | 部門別構成比 %（`grand_total === 0` ガード含む） | 30-45 |
| 新規 | `src/features/monthly-sales/lib/pick-top-ranking.ts` | 上位 10 抽出（BIZ-05 row_number 同順位なし前提） | 20-30 |
| 新規 | `src/features/monthly-sales/lib/sort-items.ts` | 列ソート + null 末尾配置（4 列 + ranking バッジ追従） | 40-60 |
| 新規 | `src/features/monthly-sales/lib/format-month-label.ts` | `formatMonthLabel("2026-01")` → `"2026年1月"`（H-3、zero-pad なし）、`prevMonth` / `nextMonth` 戻り値のみ `padStart(2, "0")` | 45-65 |
| 新規 | `src/features/monthly-sales/lib/test-fixtures.ts` | `makeMockMonthlyItem` + `makeMockProductRankingRow` / `makeMockDeptCompositionRow` factory（G-12） | 30-45 |
| 新規 | `src/features/monthly-sales/hooks/useMonthlySalesReport.ts` | 1 useQuery + 派生 6 純関数 orchestration + `derived` 生成 | 80-120 |
| 新規 | `src/features/monthly-sales/components/MonthNavigator.tsx` | 前月 button + `<input type="month">` + 翌月 button | 60-80 |
| 新規 | `src/features/monthly-sales/components/ModeTabs.tsx` | mode 切替（`?mode=by_product\|by_department`）。`SegmentedControl` で商品別ランキング / 部門別構成比の二択を描画し、active tone は shared stone selection tone | 40-55 |
| 新規 | `src/features/monthly-sales/components/SummaryCardsBar.tsx` | 4 カード（売上合計 / 販売点数 / 期間表示 / 前月比） | 100-140 |
| 新規 | `src/features/monthly-sales/components/DepartmentTable.tsx` | shadcn Table 4 列 + `<Progress>` 構成比バー + 前月比色分け（Q-4 商品数列は `MonthlySaleItem` DTO 不在で非対応、Plans.md Backlog 参照） | 110-150 |
| 新規 | `src/features/monthly-sales/components/ProductRankingTable.tsx` | 上位 10 + 1 位黄色バッジ強調（`item.ranking === 1` 追従、G-3） | 90-120 |
| 新規 | `src/features/monthly-sales/components/ExportBar.tsx` | CSV 出力 button（active）+ 印刷 button（aria-disabled + Tooltip） | 50-70 |

#### components/ui + components/sales（共通化）

| 配置 | ファイル | 責務 | 規模 |
|---|---|---|---|
| 新規 | `src/components/ui/progress.tsx` | shadcn `<Progress>` wrapper（`import { Progress as ProgressPrimitive } from "radix-ui"` 統合パッケージ慣習、G-2） | 25-35 |
| 移送 | `src/components/sales/TabsHeader.tsx` | UI-09a 由来、router-driven `<Link>` 視覚表現、daily/monthly 共通使用（Q-3）。active tone は shared stone selection tone | 45-60 |

#### lib/hooks（8-7 共通化）

| 配置 | ファイル | 責務 | 規模 |
|---|---|---|---|
| 新規 | `src/lib/hooks/useExportFile.ts` | `useMutation` + Blob ダウンロード共通化、`SalesReportType` を bindings から import（H-5 drift 耐性）、try/catch + Sonner id reportType ラベル化（G-4） | 80-110 |
| 更新 | `src/features/daily-sales/hooks/useExportDailySalesCsv.ts` | wrapper 化（`useExportFile({ reportType: "daily" })` 経由、20-30 行に縮退） | 20-30 |

#### 更新枠（既存 file）

| 配置 | ファイル | 責務 |
|---|---|---|
| 更新 | `src/lib/query-keys.ts` | `monthlySales(month, mode)` helper 追加 |
| 更新 | `src/config/navigation.ts` | UI-09b ブロック `to` / `status` 更新 |
| 更新 | `src/routes/reports/daily.tsx` | TabsHeader import 先変更（`features/daily-sales/components/` → `components/sales/`） |

#### 削除枠

| 配置 | ファイル | 理由 |
|---|---|---|
| 削除 | `src/features/daily-sales/components/TabsHeader.tsx` | `components/sales/` に移送、daily 専用版は廃止（Q-3） |

合計: 新規 20 + 移送 1 + 更新 5 + 削除 1 = **27 file** + Vitest 7 = **34 file 実体**。frontend code 1500-1800 行 + 関数設計 500-600 行 + test 320-400 行。

### 57.3 データフロー

```
URL search params (month, mode, sortBy, sortDir)
  ↓ validateSearch + zod 4 fallback
useMonthlySalesReport({ month, mode })
  ↓ useQuery(["monthly-sales", month, mode], () => commands.getMonthlySales(month, mode))
MonthlySalesReport DTO (month / mode / items / prev_month_comparison: T[] | null)
  ↓ 派生 6 純関数 orchestration
{ summary, periodLabel, productRankingRows, deptCompositionRows, comparisonMap }
  ↓
MonthlySalesPage（Alert / EmptyState / Skeleton 出し分け）
  ↓ render
SummaryCardsBar + ModeTabs + DepartmentTable | ProductRankingTable + ExportBar
```

**派生 6 純関数の責務分担**:
1. `compute-summary` → `{ totalAmount, totalQuantity }`
2. `compute-period-label` → `"YYYY/MM/DD-MM/DD"` 固定文言（month の月初〜月末を派生、Q-1 B 案）
3. `compute-comparison` → `Map<key, { prevAmount, diff, ratio | null, isComparable: boolean }>`（key 突合 + `prev_amount <= 0` 比較不可ガード）
4. `compute-composition` → `{ key, label, amount, ratio }[]`（部門別構成比、`grand_total === 0` ガード）
5. `pick-top-ranking` → `MonthlySaleItem[]` 上位 10（BIZ-05 row_number 順、同順位なし前提）
6. `sort-items` → 列ソート + null 末尾配置（4 列 + `item.ranking === 1` バッジ追従）。**sort 適用先: `ranking` + `composition` 双方** (raw `items` 非適用)。理由は (a) `ranking` 順位列の `ranking` field 保持で badge 追従 (G-3、sort-items.test.ts:79-90 で検証済)、(b) `composition` 部門別 sort 軸は ranking と独立 (利用者は順位 sort と部門集計 sort を別操作)。UI-09a (フラット → グルーピング) vs UI-09b (multi-derived) の派生木差異に対応する非対称設計

### 57.4 URL state 設計（zod 4 直接渡し）

```ts
// src/routes/reports/monthly.tsx
import { z } from "zod";

const searchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  mode: z
    .enum(["by_product", "by_department"])
    .optional()
    .catch(undefined),
  sortBy: z
    .enum(["name", "quantity", "amount", "prev_month_diff"])
    .optional()
    .catch(undefined),
  sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
});
```

- `month` undefined → 当月 fallback（`useCurrentMonth` hook）
- `mode` undefined → `"by_product"` fallback
- 不正値（例: `?month=2026-13`、`?mode=invalid`）→ zod `.catch(undefined)` で吸収、ユーザに通知せず黙って fallback（UI-09a 同方針）
- BIZ-05 `validate_month` が月番号 1-12 + 年範囲を保証（G-9）
- `sortBy` enum 4 値のうち `"quantity"` は ProductRankingTable のみ UI 露出 (商品ランキング数量列)、DepartmentTable では UI 露出しない (構成比列はソート対象外、quantity 列なし)。URL paste で `?sortBy=quantity&mode=department` 注入時は `DeptCompositionRow.quantity` field 不在のため `sortMonthlyItems extractValue` が `null` fallback → 全行 `null` → 入力順保持 (BIZ row_number/department_id 由来順序) で table 破綻なし (defensive 動作、test `DepartmentTable.test.tsx` (c) で検証済)

### 57.5 hook 設計

#### useMonthlySalesReport（1 useQuery + 派生 6 純関数）

```ts
export function useMonthlySalesReport(params: {
  month: string;
  mode: SalesMode;
  sortBy: SortColumn | null;
  sortDir: SortDirection;
}) {
  const query = useQuery({
    queryKey: queryKeys.monthlySales(params.month, params.mode),
    queryFn: () => unwrapResult(commands.getMonthlySales(params.month, params.mode), {
      source: "commands",
      cmd: "get_monthly_sales",
    }),
    staleTime: 60_000,    // 1 min（売上は数十秒単位で動かない）
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const derived = useMemo(() => {
    if (!query.data) return null;
    const { items, prev_month_comparison: prev } = query.data;
    const summary = computeSummary(items);
    const periodLabel = computePeriodLabel(params.month);
    const comparisonMap = computeComparison(items, prev);  // prev: T[] | null OK
    // ranking / composition 双方に sort 適用 (raw items 非適用、§57.3 非対称根拠参照)
    const rankingRaw = pickTopRanking(items);
    const compositionRaw = computeComposition(items);
    const ranking = sortMonthlyItems(rankingRaw, params.sortBy, params.sortDir);
    const composition = sortMonthlyItems(compositionRaw, params.sortBy, params.sortDir);
    return { summary, periodLabel, comparisonMap, ranking, composition };
    // deps に sortBy/sortDir を含める: URL state 変更時の派生 memo 再計算担保、
    // primitive 個別追加で object reference equality trade-off を構造的に回避
  }, [query.data, params.month, params.sortBy, params.sortDir]);

  return { query, derived };
}
```

#### useExportFile（8-7 共通化、`SalesReportType` 引数化）

```ts
import type { SalesReportType, SalesExportResponse } from "@/lib/bindings";

export interface ExportFileArgs {
  reportType: SalesReportType;   // bindings 由来の literal union（H-5）
  target: string;
}

const REPORT_LABEL: Record<SalesReportType, string> = {
  daily: "日次売上",
  monthly_by_product: "月次売上（商品別）",
  monthly_by_department: "月次売上（部門別）",
};

export function useExportFile() {
  const mutation = useMutation<SalesExportResponse, Error, ExportFileArgs>({
    mutationFn: ({ reportType, target }) =>
      unwrapResult(commands.exportSalesCsv(reportType, target), {
        source: "commands",
        cmd: "export_sales_csv",
      }),
    onSuccess: (data, args) => {
      try {                          // G-4 try/catch + private 移送
        downloadBlobFromBase64(data);
        toast.success(`${REPORT_LABEL[args.reportType]} を保存しました（${data.record_count} 件）`, {
          id: `export-${args.reportType}-success`,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`出力に失敗しました: ${message}`, {
          id: `export-${args.reportType}-error`,
        });
      }
    },
    onError: (error, args) =>
      toast.error(`出力に失敗しました: ${error.message}`, {
        id: `export-${args.reportType}-error`,
      }),
  });
  return { exportFile: mutation.mutate, isExporting: mutation.isPending };
}
```

- `downloadBlobFromBase64` は private 関数（hook 内閉鎖）、UI-09a `useExportDailySalesCsv` から移送
- Sonner id `export-${reportType}-success/error` で reportType ごとに dedup（連続クリック時の重複 toast 0）

#### useCurrentMonth（monthly-sales 内閉鎖）

`useMemo(() => formatYearMonth(new Date()), [])`。JST 当月の `"YYYY-MM"` を返す（UI-00 `useYesterdayDate` 同型）。

### 57.6 純関数（テスト対象 6 + factory 2 + format-month-label 1 = 9 個）

#### compute-summary（[items] → { totalAmount, totalQuantity }）
- 空配列 → `{ totalAmount: 0, totalQuantity: 0 }`
- 負数 amount（返品超過月）→ そのまま合計（純関数、業務判断は呼出側）

#### compute-period-label（[month: "YYYY-MM"] → string）
- F-10 文字列操作: `month.split("-")` → 数値分解
- 月末日数: `new Date(year, month, 0).getDate()`（JS Date は month 1-based の前月末日）
- 出力: `"2026/03/01-03/31"`（slash 区切り、月-日 zero-pad あり、固定文言、Q-1 B 案）
- G-9 不正月 fallback: 月番号 13 / 00 等は `"—"` 返却、throw new Error しない

#### compute-comparison（[currentItems, prevItems | null] → Map<key, ComparisonInfo>）
- `prevItems === null` → 全件 `isComparable: false`（失敗 4 状態 #3）
- `prevItems !== null` → key 突合（current.key === prev.key で match）
- **Q-7 ガード**（user P2 反映、Z004 返品超過月対策）:
  - `prev.amount === 0` → `isComparable: false`（除算ガード）
  - `prev.amount < 0` → `isComparable: false`（色分け逆転回避、業務上比較困難）
  - それ以外: `ratio = (current.amount - prev.amount) / prev.amount`
- 戻り値: `{ prevAmount, diff, ratio, isComparable }` per key

#### compute-composition（[items] → CompositionRow[]）
- `grandTotal = sum(items.amount)`、`grandTotal === 0` → 全件 `ratio: 0`
- 各 row `ratio = item.amount / grandTotal`、`<Progress value={ratio * 100} />` で描画

#### pick-top-ranking（[items] → MonthlySaleItem[]）
- BIZ-05 が `ranking` field を 1-based row_number で返す（同順位なし前提）
- UI 側は `items.filter((x) => x.ranking <= 10).sort((a, b) => a.ranking - b.ranking)`

#### sort-items（[rows, column, direction] → rows[]）
- 4 列: `name` / `quantity` / `amount` / `prev_month_diff`
- null 末尾配置（`prev_month_diff: number | null` の場合）
- `item.ranking === 1` は ProductRankingTable 側で `<Badge>` 強調（sort で順序が変わっても追従、G-3）

#### format-month-label（H-3 UI 表示「2026年1月」）
- `formatMonthLabel("2026-01")` → `"2026年1月"`（zero-pad なし、モックアップ + UI-09a Intl 出力準拠）
- `formatMonthLabel("2026-12")` → `"2026年12月"`
- `prevMonth("2026-01")` → `"2025-12"`（ISO 再構築のみ `padStart(2, "0")` 適用、年またぎ）
- `nextMonth("2025-12")` → `"2026-01"`（年またぎ）
- G-9 不正月: `formatMonthLabel("2026-13")` → `"—"`

#### makeMockMonthlyItem / makeMockProductRankingRow / makeMockDeptCompositionRow（factory 2 種類、G-12）
- `makeMockMonthlyItem(overrides: Partial<MonthlySaleItem>): MonthlySaleItem`
- `makeMockProductRankingRow(overrides: Partial<ProductRankingRow>): ProductRankingRow`
- `makeMockDeptCompositionRow(overrides: Partial<DeptCompositionRow>): DeptCompositionRow`
- DRY 原則: DTO 5 field + UI 派生 row（`prev_month_diff?: number | null` 含む）

### 57.7 UI コンポーネント

#### MonthlySalesPage（最上位、Alert / EmptyState / Skeleton 出し分け）

```tsx
function MonthlySalesPage() {
  const { month, mode } = Route.useSearch();
  const navigate = Route.useNavigate();
  const monthValue = month ?? useCurrentMonth();
  const modeValue = mode ?? "by_product";
  const { query, derived } = useMonthlySalesReport({ month: monthValue, mode: modeValue });

  return (
    <div className="...">
      <TabsHeader />                              {/* 共通 */}
      <MonthNavigator month={monthValue} onChange={(m) => navigate({ search: { month: m } })} />
      {query.isLoading && <Skeleton />}
      {query.isError && <Alert variant="destructive">取得に失敗しました</Alert>}
      {query.data && (
        <>
          <SummaryCardsBar summary={derived!.summary} periodLabel={derived!.periodLabel} prevComparison={query.data.prev_month_comparison} />
          <ModeTabs mode={modeValue} onChange={(m) => navigate({ search: { mode: m } })} />
          {query.data.items.length === 0 ? (
            <EmptyState message="当月データなし" />
          ) : modeValue === "by_department" ? (
            <DepartmentTable rows={derived!.composition} comparisonMap={derived!.comparisonMap} />
          ) : (
            <ProductRankingTable rows={derived!.ranking} comparisonMap={derived!.comparisonMap} />
          )}
          <ExportBar reportType={modeValue === "by_department" ? "monthly_by_department" : "monthly_by_product"} target={monthValue} />
        </>
      )}
    </div>
  );
}
```

#### MonthNavigator
- 前月 button → `prevMonth(month)` 戻り値で `navigate({ search: { month: prevMonth(month) } })`
- `<input type="month" value={month} onChange={...}>` → HTML5 native picker（F-11 Windows native 標準動作）
- 翌月 button → 同様。**未来月もガードなし**（business: 当月以後を選択可能、月途中状態を見たい場合あり）

#### ModeTabs
- `SegmentedControl` 2 値（商品別ランキング / 部門別構成比）、`?mode` URL state に反映
- active tone は日次/月次 TabsHeader と同じ shared segmented control tone を使い、同一画面内の「今見ている view」を一貫して示す。二択切替の list / item / active / inactive visual は `src/components/ui/segmented-control.tsx` を参照し、active border は押しボタン状に見えない `border-stone-300` とする
- 選択状態は色だけに依存せず、`aria-pressed` と `data-state=active|inactive` を出す。商品別から部門別、部門別から商品別へ直接切り替えられることを `ModeTabs.test.tsx` で検証する

#### SummaryCardsBar（4 カード）
- カード 1: 月間売上合計（`summary.totalAmount` 円表記）
- カード 2: 月間販売点数（`summary.totalQuantity` 点）
- カード 3: 期間表示「YYYY/MM/DD-MM/DD」固定文言（Q-1 B 案、`periodLabel`）
- カード 4: 前月比（`prev_month_comparison === null` または `[]` 空配列 → 「比較不可」灰、通常 BIZ contract は `Some(空Vec)` で空配列ケース、`null` は specta `Option<Vec<T>>` 境界の defensive guard）
- **カード溢れ対策（PR-3 (f)）**: `Card` は `flex flex-col` のため grid item の `min-width:auto` で縮まず、長い金額・期間ラベル（「2026/05/01-05/31」等）で `lg:grid-cols-4` のカードが溢れる（B2/B3、CSS 起因で論理バグでない）。`Card` + `CardContent` 両方に `min-w-0` を付与し（CardContent は flex child なので min-w-0 が確定で必須）、value div を `truncate` する。日次版 `daily-sales/components/SummaryCardsBar.tsx`（SimpleCard + CardWithTooltip）も同方針

#### DepartmentTable（4 列 + Progress バー、Q-4 商品数非対応）
- 列: 部門 / 売上 / 構成比（数値 + `<Progress>` バー）/ 前月比（商品数列は `MonthlySaleItem` DTO に `product_count` field 不在のため非対応、Plans.md Backlog 参照）
- **SortableHeader 適用列 (3 列、構成比列はソート対象外)**: 部門名 (`name`) / 売上 (`amount`) / 前月比 (`prev_month_diff`)。click で `onSortChange(column)` 発火 → MonthlySalesPage の `handleSortChange` が `sortBy/sortDir` 切替 (同列再 click → desc toggle / 別列 → asc) を `onSearchChange` 経由で URL state 更新
- 前月比色分け（F-15 ±1.0% 閾値 + Q-7 prev <= 0 ガード）:
  - 緑（`bg-success-soft text-success`）: `ratio >= 0.01`
  - 灰（`bg-stone-50 text-stone-600`）: `-0.01 < ratio < 0.01`
  - 赤（`bg-destructive-soft text-destructive`）: `ratio <= -0.01`
  - **「—」灰**: `isComparable: false`（`prev === null` / `prev_amount = 0` / `prev_amount < 0`）

#### ProductRankingTable（上位 10 + 1 位バッジ）
- 列: 順位（`ranking`）/ 商品名 / 数量 / 金額 / 前月比 / -
- `item.ranking === 1` → 行に黄色バッジ `<Badge className="bg-rank-top-badge-bg text-rank-top-badge-text">1位</Badge>` 強調表示（sort で順序変わっても `ranking === 1` 追従、G-3。token は PR-C で `rank-top` 系へ移行、00-foundations.md 参照）
- **SortableHeader 適用列 (4 列、順位列はソート対象外)**: 商品名 (`name`) / 数量 (`quantity`) / 金額 (`amount`) / 前月比 (`prev_month_diff`)。click で `onSortChange(column)` 発火 → MonthlySalesPage の `handleSortChange` が `sortBy/sortDir` 切替 (同列再 click → desc toggle / 別列 → asc) を `onSearchChange` 経由で URL state 更新

#### ExportBar
- CSV 出力 button: `exportFile({ reportType: "monthly_by_product" | "monthly_by_department", target: month })`、`isExporting === true` で button disabled + spinner
- 印刷 button: aria-disabled + Tooltip「準備中」 + onClick `preventDefault` + `cursor-not-allowed opacity-60`（memory `feedback-radix-tooltip-aria-disabled.md` 3 層パターン）

### 57.8 エラー処理（失敗 4 状態の網羅）

| 状態 | 描画 | 復旧手段 |
|---|---|---|
| **#1 API fail**（`query.isError`） | 画面全体 `<Alert variant="destructive">` + 「再試行」button（`query.refetch()`） | 再試行 button or ページ再読込 |
| **#2 items 空配列** | `<EmptyState message="当月データなし" />` + 「月を変える」案内 | MonthNavigator で別月選択 |
| **#3 prev_month_comparison === null または `[]`** | サマリ前月比カード「比較不可」灰、テーブル前月比列「—」 | 業務上正常（BIZ-05 は前月データなしも `Some(空Vec)` を返す = `sales_service.rs:196-197` 常時セット、`null` は specta `Option<Vec<T>>` 境界の defensive guard）、復旧不要 |
| **#4 前月だけ fail** | 構造的不可能（1 useQuery 設計、BIZ-05 が 1 call で両方返す、Q-5） | N/A |

- CSV 出力 fail（`useExportFile` `onError`）: Sonner toast.error、画面状態は維持
- 印刷 button click: aria-disabled でクリック不可、Tooltip で「準備中」案内のみ

### 57.9 テスト戦略（Vitest 純関数 42-55 ケース、7 file）

| file | ケース数 | 主内容 |
|---|---|---|
| `compute-summary.test.ts` | 4-5 | 空 / 1 件 / 複数 / 負数（返品月） / 大量（500 件） |
| `compute-period-label.test.ts` | 6-8 | 1 月（31 日） / 2 月閏年 2024（29 日） / 2 月非閏年 2025（28 日） / 12 月 / 月番号 13（「—」） / 00（「—」） / 2000 年（閏） / 2100 年（非閏） |
| `compute-comparison.test.ts` | 8-10 | 当月>前月 / <前月 / 同 / 前月 0 / 前月 null（全件） / +1000% / **Q-7: prev = 0 → 比較不可 / prev < 0（例 -500）→ 比較不可 / prev < 0 + current < 0 → 比較不可** |
| `compute-composition.test.ts` | 5-7 | 空 / 100%（1 件） / 合計 100% / 端数（合計 99.99%） / grand_total = 0 → 全件 ratio 0 |
| `pick-top-ranking.test.ts` | 5-7 | 空 / 5 件（全部 top10）/ 10 件 / 15 件（top10 抽出） / BIZ row_number 同順位なし前提 / ranking=11 除外 |
| `sort-items.test.ts` | 6-8 | 空 / 4 列ソート（name/quantity/amount/prev_month_diff）/ 同値（安定ソート保証）/ null 末尾 / **G-3: ranking バッジ追従テスト**（sort 後も `ranking === 1` 識別可能） |
| `format-month-label.test.ts` | 10-12 | 月またぎ（1→2） / 年またぎ（12→翌年 1）/ 不正値 13/00 → 「—」 / **H-3: `formatMonthLabel("2026-01")` → `"2026年1月"` zero-pad なし** / `"2026年12月"` / UTC/JST 同結果担保 / 閏年 2024-02 → "2024年2月" |

合計テストケース **44-57 ケース**（plan §7 表 42-55 に整合）。

### 57.10 業務ルール

#### Q-1 営業日数の扱い（B 案採用）
- BIZ-05 が営業日数 / 日平均を返さないため、サマリカード #3 は「期間: YYYY/MM/DD-MM/DD」**固定文言**で代替（Q-1 B 案、user 確定）
- 「営業日数」「日平均」の語は本画面で**使わない**（誤解防止）
- 将来 BIZ-05 拡張で営業日数追加する場合は別 PR（Plans.md Backlog）

#### Q-4 部門情報の非対応
- `MonthlySaleItem` DTO に部門情報（`department_id` / `department_name`）が**含まれない**（BIZ-05 設計）
- → 部門フィルタ Select **非対応**（UI で派生不可能、UI → CMD → BIZ → IO 境界違反回避）
- → 商品ランキングテーブルに「部門」列**なし**（同上）
- 将来 BIZ-05 拡張で部門情報追加する場合は別 PR（Plans.md Backlog）

#### Q-7 prev_amount <= 0 ガード（Z004 返品超過月対策）
- Z004 売上 CSV は返品超過月で `amount < 0` になりうる（部門合計が月またぎ返品でマイナス）
- `(current - prev) / prev` で色分けすると、prev < 0 の場合に符号が逆転して誤誘導
- → `prev_amount <= 0`（0 含む）で「比較不可」灰「—」表示、業務上の異常値を symbolic に示唆

#### 前月比色分け閾値 ±1.0%（F-15）
- 緑: `ratio >= 0.01`（+1.0% 以上）
- 灰: `-0.01 < ratio < 0.01`（±1.0% 範囲内、誤差扱い）
- 赤: `ratio <= -0.01`（-1.0% 以下）
- 「比較不可」灰: `isComparable: false`（Q-7 ガード + null）

### 57.11 ショートカット

- グローバル `Ctrl+/`: ShortcutsDialog（UI-shortcuts で実装済、本画面では追加 hook 不要）
- 画面固有ショートカット: 本 Phase では未定義（次フェーズで判定）

### 57.12 表記揺れ + UI 表示フォーマット（H-3 + G-9）

| 系統 | 表示 | 内部 |
|---|---|---|
| 月ラベル UI 表示 | **「2026年1月」**（zero-pad なし、H-3） | ISO `"2026-01"` |
| 月ラベル不正月 | 「—」（G-9 fallback） | throw しない |
| ISO 再構築（prevMonth/nextMonth 戻り値） | `"2025-12"` / `"2026-01"`（`padStart(2, "0")`） | - |
| 期間表示（Q-1 B 案） | 「2026/03/01-03/31」（slash + 月日 zero-pad あり） | - |
| 前月比「比較不可」 | 「—」灰 | `isComparable: false` |
| 金額 | 「¥1,234」 | `Intl.NumberFormat` |
| 数量 | 「12 点」 | integer |
| 構成比 | 「45.2%」 | `Math.round(ratio * 1000) / 10` |

**page h1**: 「月次売上」（PR-1 で mockup の「売上レポート」から分離、§56.12 と同方針）。日次/月次は TabsHeader で同居するため、h1 が「売上レポート」だと L3 デモで判別不能だった（U4）。サイドバー label・navigation.title とも「月次売上」で一致。

### 57.13 非目的（IO/BIZ 同型表）

| やらないこと | 理由 | 責務を持つモジュール |
|---|---|---|
| 月選択カスタム picker 実装 | HTML5 `<input type="month">` で十分（F-11 Windows native 標準）、非 IT 利用者向け minimal build（memory `feedback-non-it-user-feature-minimal-build.md`） | shadcn DatePicker 採用は将来判定（Plans.md Backlog） |
| chart library 導入（Chart.js / Recharts 等） | shadcn `<Progress>` バーで構成比は十分視覚化、月次推移グラフ等は Phase 3 以降の判定 | 将来別 PR |
| 営業日数 / 日平均算出 | BIZ-05 DTO に存在しない、UI で派生すると業務不整合（祝日マスタ等が必要） | BIZ-05 拡張別 PR（Q-1 Backlog） |
| 部門フィルタ Select | MonthlySaleItem DTO に部門情報不在、UI で派生不可能（DTO 境界違反） | BIZ-05 拡張別 PR（Q-4 Backlog） |
| 印刷機能本実装 | 仕様未定（Q40 障害時対応と合わせて Phase 4 で具体化、Plans.md Backlog） | UI-13 整合性検証画面と合わせて判定 |
| Sonner id 後方互換 wrapper | 内部 dedup key の実態整合性を優先（外部 API ではない）、memory `feedback-naming-must-match-reality.md` 系判断軸 | 廃止 |
| bindings trim 自動化 | `npm run format` の `.prettierignore` 除外設計を尊重、手動 `sed` または `prettier --ignore-path /dev/null` で対処（F-5） | scripts/pre-push.sh ④ で env-safety 同様 baseline 確認のみ |

### 更新履歴

| 日付 | PR | 内容 |
|---|---|---|
| 2026-05-19 | #66 | 新規作成（UI-09b 月次売上レポート、1 useQuery + 派生 6 純関数 + 失敗 4 状態 + 8-7 useExportFile 共通化 + TabsHeader 共通化 + Progress wrapper + SalesReportType specta 化 / Plan rally 6 round 累積 53 件発見 converged） |
| 2026-05-22 | PR-1 (tone/nav fix) | page h1 を「売上レポート」→「月次売上」に分離（U4、§57.12）。TabsHeader の `activeOptions.includeSearch:false` で search params 付き URL の active 維持（B1） |
| 2026-05-22 | PR-3 (tone/nav fix) | SummaryCardsBar カード溢れ対策（§57.7）: Card + CardContent に `min-w-0` + value div `truncate`（B2/B3、CSS 起因）。日次版も同方針 |
| 2026-06-08 | selection-tone follow-up | TabsHeader と ModeTabs の active tone を shared stone selection tone に統一し、Sidebar / StatusChips と同じ選択状態の視覚言語へ寄せた。日次/月次と商品別ランキング/部門別構成比の二択切替は `SegmentedControl` primitive を共有する |
