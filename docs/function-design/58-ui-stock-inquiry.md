> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: ARCHITECTURE.md（UI-06a タスク仕様）、SCREEN_DESIGN.md（在庫照会画面 L120-133 / L167-176）、screen_mockups.html（モックアップ、historical reference）、20-io-product-repo.md（IO-01 get_stock_detail / list_low_stock / search_products）、44-cmd-inventory.md（CMD-06 get_stock_detail / list_low_stock）、40-cmd-product.md（CMD-01 search_products）、57-ui-monthly-sales.md（UI-09b 業務ロジックあり版テンプレ）、56-ui-daily-sales.md（UI-09a 2 useQuery 部分障害許容テンプレ）

## 58. UI-06a: 在庫照会画面

### 本書のテンプレ判定（業務ロジックあり版・簡潔版、共通 6 項目）

| 観点 | 本画面の選択 | 根拠 |
|---|---|---|
| useQuery 数 | **3 useQuery 部分障害許容**（list query = `search_products` または `list_low_stock`、detail query = `get_stock_detail`、departmentOptions query = `listDepartments`） | `get_stock_detail` と `list_low_stock` / `search_products` は独立 CMD で BIZ 内一体化されていない（UI-09a 横展開、機械的横展開でなく BIZ DTO 設計に従う）。`listDepartments` は page/q/dept/status 非依存の独立 query（UI-06a-D2、round 1 P1-3） |
| URL state | TanStack Router `validateSearch`（zod 4 直接渡し、`.optional().catch(undefined)` で不正値吸収）、`q` / `dept` / `status` / `page` / `selected` の 5 key | desktop-app-ui-constraints.md「状態の URL 化」、`selected` URL 化で詳細カード展開状態の F5 耐性、`page` は UI-06a-D1 pagination 導入で追加 |
| 派生純関数 | 4 個（derive-stock-state / format-stock-display / format-last-date / filter-low-stock-list） | UI-09a/b 同型、業務ルールを純関数に閉じる。閾値判定は持たない（BIZ 責務） |
| factory | 1 種類（`makeMockProductWithRelations` + `makeMockStockDetail`、test-fixtures.ts に集約） | テスト DRY、DTO + UI 派生型を 1 file に集約 |
| ファイル分離 | `src/features/stock-inquiry/` 内閉鎖（types / lib / hooks / components）+ shadcn primitives は `src/components/ui/` | UI-09a/b 同型。`toggle` / `toggle-group` は新規 add（`collapsible` も add したが F1 行インライン展開化で現在未使用、primitive 残置） |
| Sonner dedup | id-based（`stock-inquiry-list-error` / `stock-inquiry-detail-error`、リトライ成功で `toast.dismiss`） | UI-00 PR #56 Round 2 P2-B 確立、連続失敗時の toast 山積み回避 |

---

### 58.1 概要

- **対応 REQ**: REQ-301（SP-301-01〜03、商品別在庫照会）+ REQ-302（SP-302-01〜04、在庫切れ/少一覧）。REQ-303（在庫変動履歴）は UI-06c `/stock/$code/movements` への active link で接続する
- **サイドバー「在庫少一覧」との関係（D-047、2026-07-16）**: UI-06b「在庫少一覧」は独立画面 `/stock/low` を作らず、サイドバーから本画面 `/stock` への `search: { status: "low_stock" }` deep-link として提供する。既存の `status` StatusChips フィルタ（§58.4/§58.10）をそのまま再利用し、REQ-302 の常設到達導線を担う。`/stock` を指すサイドバー 2 項目（在庫照会・在庫少一覧）の排他 active 判定は `docs/function-design/52-ui-shared-layout.md` §52.6 UI-12-D1 を参照
- **対応 task**: UI-06a（[ARCHITECTURE.md §UI-06a](../architecture/ui-task-specs.md)）
- **呼び出す CMD**:
  - list query: `search_products(query: ProductSearchQuery)`（status === "all"）または `list_low_stock(includeDiscontinued: boolean)`（status === "stockout" | "low_stock"）
  - detail query: `get_stock_detail(productCode: string)`（commit 1 で specta 化）
- **route**: `/stock`（`src/routes/stock/index.tsx`、[52-ui-shared-layout.md](52-ui-shared-layout.md) UI-12 合意書で確定済）
- **主動線**: UI-00 ホームの「在庫照会」ボタン / サイドバー「在庫照会」から遷移、検索欄 → 結果一覧 → 詳細カード展開 → 発注判断
- **失敗 4 状態**:
  1. list query API fail → ProductListTable 領域 Alert + toast（`stock-inquiry-list-error`）
  2. list query items 空配列 → 「該当する商品がありません」EmptyState
  3. detail query fail → 詳細カード内 inline エラー（部分障害許容、一覧表示は維持） + toast（`stock-inquiry-detail-error`）
  4. status === "all" かつ `q` 空文字 → search_products を呼ばず EmptySearchPlaceholder（検索駆動表示、§58.10 契約 I）

### 58.2 ファイル構成（命名規約 + 型 export）

#### bindings 由来の型（specta 出力、commit 1 で生成、`src/lib/bindings.ts` 実出力で検証済）

```ts
// src/lib/bindings.ts
export type Product = {
  product_code: string;
  jan_code: string | null;
  name: string;
  department_id: number;
  supplier_id: number | null;
  selling_price: number;
  cost_price: number;
  tax_rate: ProductTaxRate;
  maker_code: string | null;
  stock_quantity: number;
  stock_unit: ProductStockUnit; // "pcs" | "cm"（Q-4）
  is_discontinued: boolean;
  plu_dirty: boolean;
  plu_exported_at: string | null;
  pos_stock_sync: boolean;
  created_at: string;
  updated_at: string;
};

// Product フィールドは serde flatten でトップレベルに展開される（intersection 型）
export type ProductWithRelations = {
  department_name: string;
  supplier_name: string | null;
} & Product;

export type StockDetail = {
  product: ProductWithRelations;       // named field（flatten ではない）
  last_receiving_date: string | null;
  last_sale_date: string | null;
};

export type ProductSearchQuery = {
  keyword: string | null;
  department_id: number | null;
  is_discontinued: boolean | null;
  sort_key: SortKey;                   // "Name" | "ProductCode" | "StockQuantity" | "SellingPrice"（PascalCase）
  sort_order: SortOrder;               // "Asc" | "Desc"（PascalCase）
  page: number;                        // 1 始まり
  per_page: number;                    // 1 以上、デフォルト 50、上限 200。200 超は IO 層でクランプ
};

export type PaginatedResult<T> = {
  items: T[];
  total_count: number;
  page: number;
  per_page: number;
};
```

**型アクセスの重要差異**（bindings 実出力で確認、`feedback-design-doc-tech-premise-verify-from-output.md`）:
- `list_low_stock` 戻り値 = `ProductWithRelations[]`（配列、`PaginatedResult` ではない）。flatten で `item.stock_quantity` / `item.product_code` を直接参照
- `search_products` 戻り値 = `PaginatedResult<ProductWithRelations>`（`data.items` / `data.total_count`）
- `StockDetail.product` は named field のため `detail.product.stock_quantity` / `detail.product.department_name`（flatten される Product フィールドは `detail.product.*` 下に展開）
- `commands.searchProducts(query)` の callsite は `ProductSearchQuery` を**直接渡す**（`{ query: {...} }` で wrap しない。Tauri invoke 引数 `{ query }` は binding 内部で wrap 済）

#### features/stock-inquiry/

| 配置 | ファイル | 責務 | 規模 |
|---|---|---|---|
| 新規 | `src/routes/stock/index.tsx` | route + `validateSearch`（zod 4）+ navigate ラップ | 40-60 |
| 新規 | `src/features/stock-inquiry/StockInquiryPage.tsx` | 最上位 page、失敗 4 状態出し分け + 主動線 + sub 動線 | 100-140 |
| 新規 | `src/features/stock-inquiry/types.ts` | `StockStatus = "ok" \| "low" \| "stockout"` / `ListChipFilter = "all" \| "stockout" \| "low_stock"` / `StockInquiryListResult` 正規化型 | 30-45 |
| 新規 | `src/features/stock-inquiry/lib/derive-stock-state.ts` | 在庫状態派生（source 引数で色分け契約 H 準拠、閾値持たない） | 20-30 |
| 新規 | `src/features/stock-inquiry/lib/format-stock-display.ts` | 在庫数 + 単位表示（Q-4 `"pcs"` / `"cm"` + fallback「—」） | 20-30 |
| 新規 | `src/features/stock-inquiry/lib/format-last-date.ts` | `string \| null → string`（None → 「—」、Q-2） | 15-25 |
| 新規 | `src/features/stock-inquiry/lib/filter-low-stock-list.ts` | `list_low_stock` 結果の q / dept sub-filter + stockout/low 分岐 | 30-45 |
| 新規 | `src/features/stock-inquiry/lib/test-fixtures.ts` | `makeMockProductWithRelations` + `makeMockStockDetail` factory | 30-45 |
| 新規 | `src/features/stock-inquiry/hooks/useStockInquiry.ts` | 3 useQuery 部分障害許容 + `StockInquiryListResult` 正規化 + 1 件自動展開 + selected 不在 clear useEffect | 100-140 |
| 新規 | `src/components/patterns/SearchBar.tsx`（実装当時は `stock-inquiry/components/SearchBar.tsx`、PR-B で統合） | 検索 input（placeholder + `autoFocus` + Enter 検索 + debounce 200ms = live 型、[59-ui-shared-patterns.md](59-ui-shared-patterns.md)） | 50-70 |
| 新規 | `src/features/stock-inquiry/components/StatusChips.tsx` | 3 チップ（shadcn `ToggleGroup`、件数バッジなし、Q-5） | 40-55 |
| 新規 | `src/components/patterns/DepartmentFilter.tsx`（実装当時は UI-06a 用ローカル実装、PR-B で 3 feature を統合） | shadcn Select 単一選択（`DepartmentOption` 型は patterns/ が定義、[59-ui-shared-patterns.md](59-ui-shared-patterns.md)） | 40-60 |
| 新規 | `src/features/stock-inquiry/components/ProductListTable.tsx` | shadcn Table（`source` prop 受取 → derive-stock-state 引き渡し、状態列で Badge + icon + 日本語ラベル表示。stockout red / low yellow / ok default は在庫数セルの補助シグナル）+ 行クリックで選択 + 選択行直下に colSpan インライン展開（`detailQuery` props → StockDetailContent 共用） | 90-150 |
| 新規 | `src/features/stock-inquiry/components/StockStatusBadge.tsx` | `StockStatus` を `Badge + lucide icon + 日本語ラベル` に変換（在庫切れ / 在庫少 / 通常）。閾値判定は持たない | 25-40 |
| 新規 | `src/features/stock-inquiry/components/EmptySearchPlaceholder.tsx` | status=all + q 空文字時の centered muted text（契約 I） | 20-30 |
| ~~新規~~ 撤去 | ~~`src/features/stock-inquiry/components/TruncatedResultsAlert.tsx`~~ | `truncated` 時に shadcn Alert で絞り込み案内（契約 I）。**2026-08-03 batch B（UI-06a-D1）で撤去**: pagination 導入により全件へ到達可能になったため、打ち切り告知は不要（§58.10 契約 I 参照） | 25-35 |
| 新規 | `src/features/stock-inquiry/components/StockDetailContent.tsx` | 詳細の内側描画（在庫数/売価/原価/最終入庫日/最終販売日 + 商品修正/入庫記録 disabled CTA + 在庫変動履歴 active link、isLoading/isError/data 全状態内包）。行インライン展開とフォールバックカードで共用 | 90-130 |
| 新規 | `src/features/stock-inquiry/components/StockDetailCard.tsx` | list 失敗時フォールバックカード（`StockDetailContent` を Card で包み独立描画 = 部分障害許容）、collapsible 不使用（条件描画） | 20-30 |

**2026-08-03 batch B 追加（UI-06a-D1）**: pagination は新規 file を作らず、既存 canonical `src/features/products/components/ProductPagination.tsx`（[02-component-catalog.md](../design-system/02-component-catalog.md) ⑩）を結線する。`StockInquiryPage` が `total_count` から最終ページを計算して渡す。

#### components/ui（shadcn primitives 新規 add、shadcn CLI 不使用 = npm install 凍結遵守）

| 配置 | ファイル | 責務 | 規模 |
|---|---|---|---|
| 新規 | `src/components/ui/collapsible.tsx` | Radix Collapsible wrapper（`accordion.tsx` パターン踏襲、`@radix-ui/react-collapsible` は `radix-ui: ^1.4.3` umbrella transitive 既存）。※ F1 で StockDetailCard がインライン展開化したため現在未使用（primitive 残置、UI-06c 等で再利用余地。UI-06b は D-047 により独立画面化しないため対象外） | 20-30 |
| 新規 | `src/components/ui/toggle.tsx` | Radix Toggle wrapper（StatusChips の ToggleGroup item 基盤、`@radix-ui/react-toggle` 既存） | 30-45 |
| 新規 | `src/components/ui/toggle-group.tsx` | Radix ToggleGroup wrapper（StatusChips の 3 チップ用、`@radix-ui/react-toggle-group` 既存） | 40-60 |

#### 更新枠（既存 file）

| 配置 | ファイル | 責務 |
|---|---|---|
| 更新 | `src/lib/query-keys.ts` | `stockInquiry.list(status, q, dept)` / `stockInquiry.detail(productCode)` helper + `stockInquiryRoot()` prefix helper 追加 |
| 更新 | `src/config/navigation.ts` | UI-06a entry の `to: null → "/stock"` / `status: "pending" → "active"` |
| 更新 | `src/features/csv-import/hooks/useCsvImportFlow.ts` | commit / rollback success は D-052-C8/C9 の SSOT helper を適用（在庫照会 consumer を含む） |

合計: 新規 18 + 更新 3 = **21 file** + Vitest 8 = **29 file 実体**。frontend code 1100-1500 行 + 関数設計 450-550 行 + test 350-450 行。

### 58.3 データフロー

```
URL search params (q, dept, status, page, selected)
  ↓ validateSearch + zod 4 fallback
useStockInquiry({ status, q, dept, page, selected, navigate })
  ↓ list useQuery（status により分岐）
  │   status === "all" + q あり → commands.searchProducts(ProductSearchQuery { page, per_page: 50, ... }) → PaginatedResult<ProductWithRelations>
  │   status === "stockout" | "low_stock" → commands.listLowStock(false) → ProductWithRelations[]（page 非対象、既存挙動）
  │   ↓ StockInquiryListResult { items, totalCount, source } に正規化（UI-06a-D1: `truncated` は撤去済み）
  ├ detail useQuery（selected != null）
  │   commands.getStockDetail(selected) → StockDetail
  ├ departmentOptions useQuery（page / q / dept / status 非依存、独立、UI-06a-D2）
  │   commands.listDepartments() → Department[] → DepartmentOption[]（hook 内変換、round 2 P1-1）
  ↓ 派生純関数（derive-stock-state / filter-low-stock-list / format-*）
{ listQuery, detailQuery, departmentOptionsQuery, departmentOptions, isAllEmpty }
  ↓
StockInquiryPage（EmptySearchPlaceholder / Skeleton / Alert / EmptyState 出し分け、EmptyState は絞り込み非既定時に「絞り込みを解除」action、catalog ⑥）
  ↓ render
SearchBar + StatusChips + DepartmentFilter（options={departmentOptions} / selected / onChange / disabled={departmentOptionsQuery.isLoading}）+ ProductListTable（状態列 + 選択行直下に StockDetailContent インライン展開）+ StockDetailCard（list 失敗時フォールバック）+ ProductPagination（status === "all" のみ、UI-06a-D1）
```

**派生 4 純関数の責務分担**:
1. `derive-stock-state` → `(item, source) → StockStatus`（色分け契約 H、`source === "search" && stock_quantity > 0` のみ `"ok"`）
2. `format-stock-display` → `(quantity, unit) → string`（`"10 個"` / `"300 cm"` / fallback「—」、Q-4）
3. `format-last-date` → `(value: string | null) → string`（None → 「—」、Q-2）
4. `filter-low-stock-list` → `(items, q, dept, status) → ProductWithRelations[]`（`list_low_stock` 結果の sub-filter + stockout/low 分岐）

### 58.4 URL state 設計（zod 4 直接渡し）

```ts
// src/routes/stock/index.tsx
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().min(1).max(100).optional().catch(undefined),
  dept: z.coerce.number().int().positive().optional().catch(undefined),
  status: z.enum(["all", "stockout", "low_stock"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  selected: z.string().min(1).max(20).optional().catch(undefined),
});
```

- `status` の有限集合と `LOW_STOCK_FILTER = "low_stock"` は `src/features/stock-inquiry/types.ts` を単一所有者とする。route schema、`ListChipFilter`、サイドバー deep-link の `search.status`、`activeMatch.is/isNot` は同じ tuple / 定数を参照し、`"low_stock"` を別々に複製しない（UI-STATE-D2）。
- `q` undefined → `""` fallback（page 内）
- `dept` undefined → `null` fallback（全部門）
- `status` undefined → `"all"` fallback
- `page` undefined または invalid（0 / 負数 / 小数 / 非数値）→ `1` fallback（zod `.catch(undefined)` で吸収後、page 内で `page ?? 1`。50 §50.4 と同型、UI-06a-D1）
- `selected` undefined → `null` fallback（詳細カード閉）
- 不正値（例: `?status=invalid`、`?dept=abc`）→ zod `.catch(undefined)` で吸収、ユーザに通知せず黙って fallback（UI-09a/b 同方針）
- `selected` URL 化で詳細カード展開状態の F5 耐性を担保（detail query のみ再 fetch）
- `q` / `dept` / `status` の変更で `page=1` に戻す。page 移動だけは検索条件を維持する（50 §50.4 慣行の踏襲）。対象は `status === "all"`（`search_products` 経路）のみで、在庫少 / 在庫切れ（`list_low_stock` の client filter 経路）には pagination を適用しない（既存挙動維持）
- **範囲外 page**（UI-06a-D3、round 1 P1-2 対応）: `items` 空 かつ `total_count > 0` かつ `page > 1` のとき、通常の EmptyState（filter-empty reset action を含む）ではなく専用メッセージ「このページには表示する商品がありません」+「先頭ページに戻る」ボタン（`page=1` へ navigate、`q` / `dept` / `status` は維持）を表示する。74 §74.10（UI-11c-D8）と同型。この判定は EmptyState 系より優先する（§58.10 参照）

#### `selected` ライフサイクル（race condition 回避）

- **status チップ切替時** = `selected` を URL から clear（`navigate` で `selected: undefined`）。新 list query 結果 1 件で自動展開が再発火可能、状態の race を回避
- **q / dept 変更時** = `selected` を URL から clear（status チップ切替時と同じ。新 list 取得後の非同期な含有判定を避けて race を回避する。Phase 2 では選択を「現 list 条件に対する状態」として扱い、stale な詳細カードを残さない。結果 1 件なら自動展開が再発火するため絞り込み動線は崩れない）
- 自動展開 useEffect の発火条件は `selected == null` ガードで 1 度のみ
- **list 成功時に `selected` が現 list の items に不在**（stale/手打ち URL、CSV 取込み invalidation 後の該当外化）= `selected` を clear（`navigate` で `selected: undefined`、C-P2-1）。行インライン展開（§58.8）の描画先消失を防ぎ「選択は現 list 条件に対する状態」を一貫させる。`listQuery.isSuccess` ガードで loading 中の誤判定を回避。1 件なら clear 後に自動展開が後続発火し現 list の唯一商品へ収束する（"selected 不在 = 詳細が必ず消える" ではない）
- **検索前（isAllEmpty: status=all + q 空）に `selected` が残る**（手打ち/F5/bookmark URL）= `selected` を clear（Codex 実装レビュー Round 1 P2-2）。list は EmptySearchPlaceholder なのに detail query が空振りするのを防ぐ。detail query の `enabled` にも `!isAllEmpty` guard を入れて二重防御（§58.5）

### 58.5 hook 設計

#### useStockInquiry（3 useQuery 部分障害許容 + 正規化型）

```ts
import type { Department, ProductWithRelations, StockDetail } from "@/lib/bindings";
import type { DepartmentOption } from "@/components/patterns/DepartmentFilter"; // stock-inquiry/types.ts が re-export（59 §59.3）

export type StockInquiryListResult = {
  items: ProductWithRelations[];
  totalCount: number | null;       // source="search" 時のみ数値、source="low_stock" 時 null
  source: "search" | "low_stock";
};
// UI-06a-D1（2026-08-03）: `truncated` field は撤去済み。pagination 導入により
// 全件へページ送りで到達できるため、打ち切り告知フラグを持つ理由がなくなった。

export function useStockInquiry(params: {
  status: ListChipFilter;
  q: string;
  dept: number | null;
  page: number;                    // 1 始まり。status !== "all" では無視（既存 client filter 経路は非対象）
  selected: string | null;
  navigate: (search: Partial<StockInquirySearch>) => void;
}) {
  const isAllEmpty = params.status === "all" && !params.q.trim();

  const listQuery = useQuery({
    queryKey: queryKeys.stockInquiry.list(params.status, params.q, params.dept, params.page),
    queryFn: async (): Promise<StockInquiryListResult> => {
      if (params.status === "all") {
        const data = await unwrapResult(
          commands.searchProducts({
            keyword: params.q.trim() || null,
            department_id: params.dept ?? null,
            is_discontinued: false,
            sort_key: "ProductCode",
            sort_order: "Asc",
            page: params.page,
            per_page: 50,
          }),
          { source: "commands", cmd: "search_products" },
        );
        return {
          items: data.items,
          totalCount: data.total_count,
          source: "search",
        };
      }
      const rows = await unwrapResult(commands.listLowStock(false), {
        source: "commands",
        cmd: "list_low_stock",
      });
      const filtered = filterLowStockList(rows, params.q, params.dept, params.status);
      return { items: filtered, totalCount: null, source: "low_stock" };
    },
    enabled: !isAllEmpty,           // status=all + q 空文字 → search_products 呼ばない（契約 I）
    staleTime: 10_000,              // 10 sec（UI_TECH_STACK.md UI-06a 既定値、CSV 取込み直後の即時反映）
    gcTime: 5 * 60_000,
    retry: 1,
  });

  // UI-06a-D2（DSR-10 準拠、round 1 P1-3 対応）: 部門候補は listDepartments() の master 全件から作る。
  // page / q / dept / status のいずれにも依存しない単一 query とし、filtered result からの派生を禁止する。
  // implementation target（round 2 P1-1 対応）: src/lib/query-keys.ts の `stockInquiry.departmentOptions`
  // は現状 `(status, q)` 引数付き（["stock-inquiry", "department-options", { status, q }]）。本 change で
  // 無引数・一定 key（["stock-inquiry", "department-options"] as const 相当）へ変更する。対象は
  // src/lib/query-keys.ts / useStockInquiry.ts / useStockInquiry.test.tsx の 3 file。
  const departmentOptionsQuery = useQuery({
    queryKey: queryKeys.stockInquiry.departmentOptions(),
    queryFn: () => unwrapResult(commands.listDepartments(), {
      source: "commands",
      cmd: "list_departments",
    }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
  // Department[] → DepartmentOption[] の変換は hook 側の責務（画面側は options={departmentOptions} を
  // そのまま渡すだけにする、useProductList.ts の departmentOptions 派生と同型）。
  const departmentOptions: DepartmentOption[] = (departmentOptionsQuery.data ?? [])
    .map((department) => ({ id: department.id, name: department.name }))
    .sort((a, b) => a.id - b.id);

  const detailQuery = useQuery({
    queryKey: queryKeys.stockInquiry.detail(params.selected ?? ""),
    queryFn: () => unwrapResult(commands.getStockDetail(params.selected!), {
      source: "commands",
      cmd: "get_stock_detail",
    }),
    enabled: !isAllEmpty && params.selected != null && params.selected.length > 0,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  // 結果 1 件で自動展開（Q-3 補強、selected == null ガードで 1 度のみ）
  useEffect(() => {
    const result = listQuery.data;
    if (result && result.items.length === 1 && params.selected == null) {
      params.navigate({ selected: result.items[0].product_code });
    }
  }, [listQuery.data, params.selected]);

  // selected を「現 list 条件に対する状態」に保つための clear（§58.4）。2 ケース:
  // (a) 検索前（isAllEmpty）に selected が残る（手打ち/F5/bookmark URL）→ detail 空振り防止で clear
  //     （Codex 実装レビュー Round 1 P2-2、detail enabled の !isAllEmpty guard と二重防御）。
  // (b) list 成功時に selected が現 list に不在 → 行インライン展開（§58.8）の描画先消失を防ぐ（C-P2-1）。
  //     isSuccess ガードで loading 中の誤判定を回避。1 件なら clear 後に自動展開が後続発火し収束。
  useEffect(() => {
    if (isAllEmpty && params.selected != null) {
      params.navigate({ selected: undefined });
      return;
    }
    const items = listQuery.data?.items;
    if (
      listQuery.isSuccess &&
      params.selected != null &&
      !(items ?? []).some((item) => item.product_code === params.selected)
    ) {
      params.navigate({ selected: undefined });
    }
  }, [isAllEmpty, listQuery.isSuccess, listQuery.data, params.selected]);

  return { listQuery, detailQuery, departmentOptionsQuery, departmentOptions, isAllEmpty };
}
```

- **正規化の契約**: 自動展開 / EmptySearchPlaceholder 判定 / ProductPagination は常に `listQuery.data.items` / `.totalCount` を参照（生 `data.total_count` / `data.items` 直接参照禁止、type narrowing 維持）
- list query 失敗時も detail query は独立動作（部分障害許容）、逆も同様。`departmentOptionsQuery` も同じく独立: list query の成否に関わらず候補取得は継続する
- 部門選択肢は `listDepartments()` の master 全件から作る（UI-06a-D2、DSR-10）。`page` / `q` / `dept` / `status` のいずれを変更しても候補集合は不変で、選択中部門から別部門へ直接切り替えられる。旧実装（filtered result からの派生）は Windows native L3 feedback で「個別部門選択後に他部門へ切り替えられない」functional defect として修正済みだった経緯があり、pagination 導入でこの縮退が再発・増幅するリスクがあるため、本 change で master 全件由来へ是正する
- **候補取得失敗時の挙動**（round 2 P1-1 対応、catalog ⑨「部門候補の取得失敗は呼び出し側で別途文言表示」の具体化）: `departmentOptionsQuery.isError` を hook が公開し、`StockInquiryPage` が `DepartmentFilter` 直下に「部門候補の取得に失敗しました」（`role="alert"`、products 画面 `ProductListPage.tsx` の既存文言と同型）を表示する。`listQuery`（一覧表示）とは完全に独立し、候補取得が失敗しても一覧表示は継続する

#### CSV 取込み後の invalidation（`useCsvImportFlow.ts` への追加）

`commands.commitCsvImport` / `rollbackCsvImport` 成功時は D-052-C8/C9 の SSOT helper を適用する。`stockInquiryRoot()` は list / detail を一括無効化する prefix factory だが、mutation 集合の具体列挙は `src/lib/invalidation-contract.ts` だけに置く。

### 58.6 純関数（テスト対象 4 + factory 1）

#### derive-stock-state（[item, source] → StockStatus）

色分け契約 H（§58.10）準拠:
- `source === "search" && item.stock_quantity > 0` → `"ok"`（default 表示、色なし）
- `item.stock_quantity <= 0` → `"stockout"`（赤）
- `item.stock_quantity > 0`（source === "low_stock"）→ `"low"`（黄）
- frontend に閾値定数を持たない（Q-1 + Round 4 P2-3 で 2 重確定、drift 源排除）

#### format-stock-display（[quantity, unit] → string）

- `unit === "pcs"` → `"10 個"`（数量 + 「個」）
- `unit === "cm"` → `"300 cm"`（数量 + 「cm」、生地、SCREEN_DESIGN.md L131）
- 上記以外（unexpected）→ `"—"`（fallback、Q-4 網羅）

#### format-last-date（[value: string | null] → string）

- `value === null` → `"—"`（None 表示、Q-2）
- `value !== null` → `value` をそのまま返す（`YYYY-MM-DD`、DB_DESIGN.md 日付書式規約）

#### filter-low-stock-list（[items, q, dept, status] → ProductWithRelations[]）

- `status === "stockout"` → `items.filter((p) => p.stock_quantity <= 0)`
- `status === "low_stock"` → `items.filter((p) => p.stock_quantity > 0)`
- 加えて `q` あり → `product_code` / `name` / `jan_code` の部分一致で絞り込み
- 加えて `dept` あり → `department_id === dept` で絞り込み
- `list_low_stock` 返り値は 100 件以下想定で frontend filter で高速（Q-1 user 確定の frontend 派生範囲内）

#### makeMockProductWithRelations / makeMockStockDetail（factory、test-fixtures.ts）

- `makeMockProductWithRelations(overrides: Partial<ProductWithRelations>): ProductWithRelations`（DTO flatten field + department_name / supplier_name）
- `makeMockStockDetail(overrides: Partial<StockDetail>): StockDetail`（product / last_receiving_date / last_sale_date）

### 58.7 UI コンポーネント

#### StockInquiryPage（最上位、失敗 4 状態出し分け）

```tsx
function StockInquiryPage() {
  const { q, dept, status, page, selected } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qValue = q ?? "";
  const deptValue = dept ?? null;
  const statusValue = status ?? "all";
  const pageValue = page ?? 1;
  const selectedValue = selected ?? null;
  const { listQuery, detailQuery, departmentOptionsQuery, departmentOptions, isAllEmpty } = useStockInquiry({
    status: statusValue, q: qValue, dept: deptValue, page: pageValue, selected: selectedValue,
    navigate: (search) => navigate({ search: (prev) => ({ ...prev, ...search }) }),
  });
  // q / dept / status の変更は page も既定（1）へ戻す（UI-06a-D1、50 §50.4 慣行の踏襲）。
  // page 移動（ProductPagination の onPageChange）は他条件を維持したまま page だけ更新する。
  const isFilterDefault = !qValue && deptValue === null && statusValue === "all";
  const resetFilters = () =>
    navigate({ search: (p) => ({ ...p, q: undefined, dept: undefined, status: undefined, page: undefined, selected: undefined }) });

  return (
    <div className="...">
      <SearchBar value={qValue} onSearchChange={(v) => navigate({ search: (p) => ({ ...p, q: v || undefined, page: undefined, selected: undefined }) })} />
      <StatusChips value={statusValue} onChange={(s) => navigate({ search: (p) => ({ ...p, status: s, page: undefined, selected: undefined }) })} />
      <DepartmentFilter
        options={departmentOptions}
        selected={deptValue}
        onChange={(d) => navigate({ search: (p) => ({ ...p, dept: d ?? undefined, page: undefined, selected: undefined }) })}
        disabled={departmentOptionsQuery.isLoading}
      />
      {/* 候補取得失敗は listQuery とは独立に別途文言表示（catalog ⑨、round 2 P1-1） */}
      {departmentOptionsQuery.isError && (
        <p className="text-sm text-destructive" role="alert">部門候補の取得に失敗しました</p>
      )}
      {isAllEmpty ? (
        <EmptySearchPlaceholder />
      ) : listQuery.isLoading ? (
        <Skeleton />
      ) : listQuery.isError ? (
        <>
          <Alert variant="destructive">在庫一覧の取得に失敗しました</Alert>
          {/* list 失敗時は行インライン展開できないため、フォールバックカードで詳細を独立描画（部分障害許容、§58.8） */}
          {selectedValue && <StockDetailCard query={detailQuery} />}
        </>
      ) : listQuery.data!.items.length === 0 && listQuery.data!.totalCount !== null && listQuery.data!.totalCount > 0 && pageValue > 1 ? (
        // 範囲外 page（UI-06a-D3、74 §74.10 UI-11c-D8 と同型）。通常 EmptyState / reset action より優先判定（SPEC-UIBB-8）。
        <EmptyState
          title="このページには表示する商品がありません"
          action={
            <Button variant="outline" onClick={() => navigate({ search: (p) => ({ ...p, page: undefined }) })}>
              先頭ページに戻る
            </Button>
          }
        />
      ) : listQuery.data!.items.length === 0 ? (
        <EmptyState
          title="該当する商品がありません"
          // 絞り込みが既定値以外のときだけ reset action を出す（catalog ⑥ filter-empty reset action、SPEC-UIBB-1/2）。
          action={!isFilterDefault ? <Button variant="outline" onClick={resetFilters}>絞り込みを解除</Button> : undefined}
        />
      ) : (
        <>
          {/* list 成功時は選択行の直下に詳細をインライン展開する（detailQuery を渡す、§58.7 ProductListTable） */}
          <ProductListTable
            items={listQuery.data!.items}
            source={listQuery.data!.source}
            selected={selectedValue}
            detailQuery={detailQuery}
            onSelect={(code) => navigate({ search: (p) => ({ ...p, selected: code }) })}
          />
          {/* status === "all" のときだけ表示（UI-06a-D1、02-component-catalog.md ⑩ canonical を結線） */}
          {statusValue === "all" && listQuery.data!.totalCount !== null && (
            <ProductPagination
              page={pageValue}
              totalCount={listQuery.data!.totalCount}
              perPage={50}
              onPageChange={(next) => navigate({ search: (p) => ({ ...p, page: next }) })}
            />
          )}
        </>
      )}
      {/* 最下部固定カードは廃止。詳細は list 成功=選択行直下インライン展開 / list 失敗=フォールバックカードの
          2 経路で描画し、selected が現 list に不在なら useStockInquiry が clear する（§58.4 / §58.8、C-P2-1） */}
    </div>
  );
}
```

#### SearchBar（HID スキャナ前提、Q-3 補強）

- placeholder「商品コード・商品名・JANで検索」
- `autoFocus`（初期表示時に検索 input へ focus、HID スキャナがそのまま入力可能）
- `onChange` debounce 200ms で URL state `q` 更新、Enter 押下時は debounce flush して即時更新
- 専用「スキャン」ボタンは入れない（§58.13 非目的）

#### StatusChips（3 チップ、件数バッジなし、Q-5）

- shadcn `ToggleGroup`（`type="single"`）、「すべて」/ 「在庫切れ」/ 「在庫少」のラベルのみ
- 件数バッジは表示しない（検索条件・部門フィルタとの結合で意味論が壊れる、§58.13）
- 選択中 tone は shared stone selection tone（solid stone-700 ではない）+ 太字。stockout / low の rose / amber は在庫状態の補助色として残し、filter selection の背景色と意味色を衝突させない

#### DepartmentFilter（共通 `patterns/DepartmentFilter`、2026-08-03 batch B で sync）

- 共通 `src/components/patterns/DepartmentFilter.tsx`（shadcn `Select`、「すべての部門」+ `commands` 由来の部門一覧）を使う。`DepartmentOption` 型は `patterns/DepartmentFilter.tsx` が単一定義し、stock-inquiry 側は re-export を import する（[59-ui-shared-patterns.md](59-ui-shared-patterns.md) §59.3、PR-B で 3 feature 統合済み）
- 候補は `listDepartments()` master 全件（UI-06a-D2、DSR-10）で、`page` / `q` / `dept` / `status` に関わらず不変。個別部門選択中も他部門候補が縮退しない。`DepartmentFilter` 自体は pure component とし、候補取得は `useStockInquiry` の `departmentOptionsQuery` が担う
- **canonical props 結線**（round 2 P1-1 対応、59 §59.1 の `{options, selected, onChange, disabled?}` 準拠）: `StockInquiryPage` は `options={departmentOptions}`（hook が `Department[] → DepartmentOption[]` へ変換済みの配列）/ `selected={deptValue}`/ `onChange`（URL state `dept` 更新）/ `disabled={departmentOptionsQuery.isLoading}` を渡す。候補取得失敗時は `departmentOptionsQuery.isError` を見て `DepartmentFilter` 直下に「部門候補の取得に失敗しました」を別途表示し、`listQuery`（一覧表示）とは独立に一覧表示は継続する（§58.5）

#### ProductListTable（高視認性状態表示契約 H、選択行直下インライン展開）

- 列: 商品コード / 商品名 / 部門 / 状態 / 在庫数（`format-stock-display`、生地は単位付き）/ 売価
- `source` prop を `derive-stock-state(item, source)` に引き渡し、状態列で `StockStatusBadge` を表示する
  - `stockout` = `CircleAlertIcon` + 「在庫切れ」Badge
  - `low` = `TriangleAlertIcon` + 「在庫少」Badge
  - `ok` = muted 「通常」Badge
- 在庫数セルの stockout red / low yellow / ok default は二次シグナルとして残す。意味そのものは状態列の日本語ラベルで伝える
- H-6 feedback 対応として、商品コードセルと詳細 header の商品コードは `font-mono text-sm font-medium` とする。旧 `text-xs` は最小級で、全体 WebView 表示スケール導入後も読みづらさが残るため使わない
- 行クリックで `onSelect(product_code)` 発火 → `selected` URL state 更新 → **選択行の直下**に colSpan 展開行で `StockDetailContent` をインライン描画（`detailQuery` props を受け取る、collapsible 不使用 = 条件描画）。展開行は `bg-muted` を明示固定し選択行と視覚的に一体化（New-1）。list 失敗時の独立描画はフォールバック `StockDetailCard` が担う（§58.8）
- 状態列追加後のインライン展開は `colSpan=6`。旧 `colSpan=5` は table 列数と不一致になるため regression test で防ぐ

#### EmptySearchPlaceholder（契約 I）/ ProductPagination（UI-06a-D1）

- EmptySearchPlaceholder: status=all + q 空文字時、centered muted text「商品コード、商品名、または JAN コードで検索してください」（catalog ⑥ の適用除外、検索前の操作指示であり空結果ではない）
- ~~TruncatedResultsAlert~~: **2026-08-03 batch B（UI-06a-D1）で撤去**。pagination 導入により全件へページ送りで到達できるため、「他にも検索結果があります」の打ち切り告知は不要になった（打ち切り告知とページ送りの二重表現を避ける）
- ProductPagination: `status === "all"` のときだけ表示（在庫少 / 在庫切れは `list_low_stock` の client filter 経路のため対象外、既存挙動）。02-component-catalog.md ⑩ の canonical をそのまま結線し、`totalCount` から最終ページを計算する

#### StockDetailContent / StockDetailCard（インライン展開 + フォールバック共用、在庫変動履歴 link）

- `StockDetailContent`: 詳細の内側描画（在庫数 / 売価 / 原価 / 最終入庫日（`format-last-date`）/ 最終販売日（`format-last-date`））+ isLoading/isError/data 全状態を内包。行インライン展開（list 成功時、`ProductListTable` の colSpan 展開行内、Card なし）と フォールバックカード（list 失敗時、`StockDetailCard` が Card で包む）で**共用**
- `StockDetailCard`: `StockDetailContent` を Card で包む薄いラッパ（list 失敗 + selected != null のフォールバック専用、collapsible 不使用）
- `detailQuery.isError` → `StockDetailContent` 内 inline エラー表示（部分障害許容、一覧は維持。両描画経路で共通）
- disabled CTA は未実装導線（商品修正 / 入庫記録）に限定する（aria-disabled + onClick `preventDefault` + Tooltip + `cursor-not-allowed opacity-60`、memory `feedback-radix-tooltip-aria-disabled.md` 3 層パターン）:
  - 「商品修正」→ Tooltip「Phase 3 で実装予定」
  - 「入庫記録」→ Tooltip「Phase 3 で実装予定」
- 「在庫変動履歴」は UI-06c で active link 化し、`/stock/$productCode/movements` へ遷移する。UI-06c の画面本体、filter、pagination、`MovementRecord.source` 元記録リンクは [66-ui-stock-movements.md](66-ui-stock-movements.md) を正とする。

### 58.8 エラー処理（失敗 4 状態の網羅）

**詳細（StockDetailContent）の描画経路（行インライン展開 + フォールバック + clear）**:
- **list 成功 + selected が items に含まれる** → `ProductListTable` が選択行直下に colSpan 展開行でインライン描画（`StockDetailContent` 直接、Card なし）
- **list 成功 + selected が items に不在** → `useStockInquiry` が `selected` を clear（§58.4、C-P2-1）。展開先・detail query とも自然消滅
- **list 失敗 + selected != null** → Alert 下のフォールバック `StockDetailCard`（`StockDetailContent` を Card で包み独立描画 = 部分障害許容、Codex Round 1 P2-1 の契約を構造変更後も維持）
- 3 経路とも `StockDetailContent`（isLoading/isError/data 全状態を内包）が描画を担い、detail 失敗時の inline エラーも各経路内で表示する

| 状態 | 描画 | 復旧手段 |
|---|---|---|
| **#1 list query API fail**（`listQuery.isError`） | ProductListTable 領域 `<Alert variant="destructive">` + toast（`id: "stock-inquiry-list-error"`） | 検索条件変更 or ページ再読込、リトライ成功で同 id `toast.dismiss` |
| **範囲外 page**（UI-06a-D3、`items` 空 + `total_count > 0` + `page > 1`、round 1 P1-2 対応） | `<EmptyState title="このページには表示する商品がありません" action={<Button variant="outline">先頭ページに戻る</Button>} />`。74 §74.10（UI-11c-D8）と同型。**#2 の filter-empty reset action より優先して判定する**（SPEC-UIBB-8） | 「先頭ページに戻る」押下で `page=1`、`q` / `dept` / `status` は維持 |
| **#2 list query items 空配列** | `<EmptyState title="該当する商品がありません" />`。q / dept / status が既定値以外なら `action` に「絞り込みを解除」ボタン（catalog ⑥ filter-empty reset action、SPEC-UIBB-1/2） | 検索条件 / 部門フィルタ変更、または reset action で既定値へ一括復帰 |
| **#3 detail query fail**（`detailQuery.isError`） | 詳細の inline エラー（一覧は維持、部分障害許容）。list 成功時は選択行直下のインライン展開行内、list 失敗時はフォールバック StockDetailCard 内（両系統とも `StockDetailContent` が isLoading/isError/data を内包）+ toast（`id: "stock-inquiry-detail-error"`） | 別商品選択 or リトライ、成功で同 id `toast.dismiss` |
| **#4 status=all + q 空文字** | `<EmptySearchPlaceholder />`（search_products 呼ばない、契約 I） | 検索欄に入力 |

- `commands.getStockDetail` の `BizError::NotFound`（商品コード不正）は CmdError `kind: "not_found"` で frontend に伝播、`InvokeError` で型安全に処理（`src/lib/invoke.ts`）

### 58.9 テスト戦略（Vitest 純関数 + hook + RTL。ケース実数は D-038 Evidence Ownership により PR body / CI 出力を正とし本表に転記しない）

| file | 主内容 |
|---|---|
| `derive-stock-state.test.ts` | source=search + stock>0 → ok / source=search + stock<=0 → stockout / source=low_stock + stock>0 → low / source=low_stock + stock<=0 → stockout / stock=0 境界 |
| `format-stock-display.test.ts` | `"pcs"` → 「個」/ `"cm"` → 「cm」/ unexpected → 「—」（Q-4 網羅） |
| `format-last-date.test.ts` | null → 「—」/ `YYYY-MM-DD` そのまま / 空文字扱い |
| `filter-low-stock-list.test.ts` | stockout 分岐 / low_stock 分岐 / q 部分一致 / dept 絞り込み / 複合 / 空配列 |
| `useStockInquiry.test.tsx` | search → PaginatedResult 正規化（source/totalCount、`truncated` は撤去済み） / low_stock → 配列正規化 / status=all+q空 で enabled=false / 1 件自動展開 / status 切替 → selected clear → 新 list 1 件で再展開 / detail 部分障害 / list 成功 + selected 不在 → clear（C-P2-1） / isAllEmpty + selected → clear + detail 非発火（Round 1 P2-2） / page が queryKey とクエリ引数に反映される（SPEC-UIBB-3/4） / SPEC-UIBB-9: `departmentOptionsQuery` が `listDepartments()` を呼び、page/q/dept/status 変更後も候補が不変で選択中部門から別部門へ直接切替できる（round 1 P1-3、DSR-10）。status 変更（all → low_stock → stockout）も候補不変であることを追加 assert（round 2 P2-3）。同一 `QueryClient` 上で page/q/dept/status を変えても `listDepartments` の call count = 1 に留まる（round 2 P2-3、query-key 安定性の mutant 検出）。`queryKeys.stockInquiry.departmentOptions()` が無引数で呼ぶたびに同一・一定の key を返す unit test（round 2 P1-1、無引数化の regression 防止） |
| `SearchBar.test.tsx` + `StockInquiryPage.test.tsx` | `autoFocus` 検証 / Enter で debounce flush + 即時 search / 結果 1 件で自動展開 useEffect → URL state `selected` 更新 / list 成功 + selected でインライン展開 / 行クリックで selected 更新 → 展開（stateful harness、C-P2-3）/ list 失敗 + detail 成功でフォールバックカード独立描画（部分障害許容、Codex Round 1 P2-1）/ search flow の在庫切れ label / low_stock flow の在庫少 label（RTL + user-event）/ SPEC-UIBB-1/2: 絞り込み非既定+0件で reset action 表示・押下で全条件+page 既定復帰 / SPEC-UIBB-4: q・dept・status 変更で page=1、page 移動は条件維持 / SPEC-UIBB-5: 51 件 synthetic で page 2 に到達、`TruncatedResultsAlert` 残存 0（rg 静的 sweep） / SPEC-UIBB-8: `items` 空 + `total_count > 0` + `page > 1` で範囲外 page 専用メッセージ + 「先頭ページに戻る」を表示し、filter-empty reset action より優先判定される（UI-06a-D3、round 1 P1-2） / SPEC-UIBB-9: 候補 query pending 中は `DepartmentFilter` trigger が disabled（`departmentOptionsQuery.isLoading`、round 3 P2-3） / SPEC-UIBB-9: `listDepartments` reject + list query 成功で `role="alert"`「部門候補の取得に失敗しました」と商品一覧が**同時に**表示される（一覧独立の結合退行検出、round 3 P2-3）。test harness は QueryClient retry を無効化して失敗状態を一意に確定させる |
| `ProductListTable.test.tsx` | 状態列の「在庫切れ」「在庫少」「通常」text / 商品コード cell `text-sm` readability guard / 選択行直下インライン展開 / nextElementSibling colSpan=6 guard（旧下部固定・旧 5 列混入検出）/ 非選択時展開なし / detail 失敗 inline（C-P2-3） / 展開行 whitespace-normal guard（Round 1 P2-1） |
| `StatusChips.test.tsx` | selected chip の `data-state="on"` / chip click の filter value 発火 / deselect 空文字無視（常に 1 つ選択維持） |

`vi.mock("@/lib/bindings")` で commands mock + TanStack Router test wrapper（memory `feedback-vitest-react19-setup-pattern.md` 踏襲）。状態表示のテストは Tailwind color class ではなく text / DOM state / table structure を assert する。

### 58.10 業務ルール

#### Q-1 在庫少判定（frontend は閾値を持たない）

- frontend 責務: BIZ が返した集合を表示・分類
- BIZ 責務: 何が「在庫少」かを判定（app_settings の `stock_low_threshold` / `stock_low_threshold_fabric` を読み `list_low_stock` で適用）
- frontend に持ってよい派生: `list_low_stock` 結果内で `stock_quantity <= 0` なら「在庫切れ」、`> 0` なら「在庫少」
- frontend に持ってはいけない派生: `stock_unit === "cm" ? 500 : 3` のような閾値判定（drift 源）

#### 契約 H 在庫状態の高視認性表示（[design-system/00-foundations.md §業務ステータスの視認性](../design-system/00-foundations.md)）

> status === "all" は search_products 由来のため、stock_quantity <= 0 の在庫切れのみを明示し、stock_quantity > 0 は「通常」と表示する。在庫少は BIZ 判定済み集合である list_low_stock 由来の status === "low_stock" 表示時に限定する。frontend は閾値を保持しない。意味は状態列の日本語ラベル + icon + Badge で伝え、赤 / amber は補助シグナルとして使う。

| List source | stock_quantity <= 0 | stock_quantity > 0 |
|---|---|---|
| search_products（`status === "all"`） | `CircleAlertIcon` + 「在庫切れ」Badge + 在庫数 red 補助 | 「通常」Badge + 在庫数 default |
| list_low_stock（`status === "stockout" \| "low_stock"`） | `CircleAlertIcon` + 「在庫切れ」Badge + 在庫数 red 補助 | `TriangleAlertIcon` + 「在庫少」Badge + 在庫数 amber 補助 |

#### 契約 I 「すべて」チップの検索駆動表示（ラベルと実データの一致）

> status === "all" かつ q 空文字の場合、search_products は呼ばず「商品コード、商品名、または JAN コードで検索してください」を表示する。q 入力後のみ search_products(page, per_page: 50) を呼ぶ。per_page 上限は search_products 既存契約どおり 200 で、200 超は IO 層でクランプされる（UI-06a は固定値 50 のみ使用）。全件へは pagination（§58.4 / UI-06a-D1）でページ送りして到達する。

#### UI-06a-D1: pagination 導入 + truncated alert 撤去（2026-08-03 batch B）

- **決定**: 在庫照会「すべて」（`status === "all"`）に `page` search param と `ProductPagination`（既存 canonical、02-component-catalog.md ⑩）を導入し、`total_count` から全ページへ到達できるようにする。これに伴い `TruncatedResultsAlert` component と `StockInquiryListResult.truncated` flag を撤去する。
- **Why**: pagination により全件へページ送りで到達できるようになるため、「他にも検索結果があります」という打ち切り告知（旧 契約 I）はページ送りと二重表現になる。50 §50.4（商品一覧）の既存 page 慣行をそのまま踏襲し、在庫照会だけの新しい UX を発明しない。
- **Rejected**: truncated alert を pagination と併存させる案（「打ち切り告知」+「ページ送り」が同じ問題を二重に説明することになり、利用者が両方を読む必要が生じる）。在庫少 / 在庫切れ（`list_low_stock` 経路）への pagination 拡張（既存 100 件以下想定の client filter で十分、対象外のまま据え置き）。
- **Revisit trigger**: `list_low_stock` の返却件数が 100 件を恒常的に超える運用が確認された場合、client filter 経路への pagination 適用を再検討する。

#### UI-06a-D2: 部門候補を listDepartments master 全件へ是正（DSR-10、round 1 P1-3、2026-08-03 batch B）

- **決定**: 部門候補 query を検索結果由来（`searchProducts` 先頭 page からの派生）から `commands.listDepartments()` の master 全件へ切り替える。`page` / `q` / `dept` / `status` のいずれを変更しても候補集合は不変にする。
- **Why**: filtered result 由来の候補縮退は DSR-10 / 02-component-catalog.md ⑨「フィルタ候補のソース」で禁止されている。pagination 導入により「現在 page の商品に含まれる部門」への縮退リスクが増幅するため、同一 change で正本準拠に是正する。wire 変更なし（`listDepartments` は既存 command）。
- **Rejected**: 現状維持（dept 選択時だけ同じ q/status で dept を外した候補用 query を使う案）。個別部門選択後に他部門へ切り替えられない機能不全を過去 L3 で一度是正した実績があり、pagination 追加でさらに再発しやすくなるため据え置かない。

#### UI-06a-D3: 範囲外 page 回復（round 1 P1-2、2026-08-03 batch B）

- **決定**: `items` 空 かつ `total_count > 0` かつ `page > 1` のとき、通常の EmptyState / filter-empty reset action ではなく専用メッセージ「このページには表示する商品がありません」+「先頭ページに戻る」ボタン（`page=1` へ navigate、他条件維持）を表示する。判定は EmptyState 系より優先する。
- **Why**: 74 §74.10（UI-11c-D8）と同型の契約を踏襲し、在庫照会だけの新しい UX を発明しない。50 §50.4 / `ProductPagination.tsx` に clamp 契約は存在しないため、範囲外 page を無言で先頭ページへ丸める（clamp）案は既存 canonical の慣行から逸脱する。
- **Rejected**: 範囲外 page を `page=1` へ自動 clamp する案（既存 50 / ProductPagination に clamp 契約が実在しないため新規発明になり、利用者に無断で条件を書き換える点でも UI-11c-D8 の明示回復導線パターンと不整合）。

#### 廃番除外

- list query は `include_discontinued = false` 固定（`search_products` は `is_discontinued: false`、`list_low_stock(false)`）。UI トグルなし（SP-302-04 + scope 抑制、Phase 4 UI-11a で再検討）

### 58.11 ショートカット

- グローバル `Ctrl+/`: ShortcutsDialog（UI-shortcuts で実装済、本画面では追加 hook 不要）
- 画面固有ショートカット: 検索欄 `autoFocus` + Enter 検索（Q-3 補強）。それ以外は本 Phase では未定義

### 58.12 表記揺れ + UI 表示フォーマット

| 系統 | 表示 | 内部 |
|---|---|---|
| 在庫数（個物） | 「10 個」 | `stock_quantity` integer + `stock_unit = "pcs"` |
| 在庫数（生地） | 「300 cm」 | `stock_quantity` integer + `stock_unit = "cm"` |
| 在庫数（unexpected unit） | 「—」 | fallback（Q-4） |
| 最終入庫日 / 最終販売日 None | 「—」（Q-2） | `string \| null`（null） |
| 在庫状態（在庫切れ） | `CircleAlertIcon` + 「在庫切れ」Badge（在庫数 red は補助） | `StockStatus = "stockout"` |
| 在庫状態（在庫少） | `TriangleAlertIcon` + 「在庫少」Badge（在庫数 amber は補助） | `StockStatus = "low"`（list_low_stock 由来時のみ） |
| 在庫状態（通常） | 「通常」Badge | `StockStatus = "ok"` |
| 金額（売価 / 原価） | 「¥1,234」 | `Intl.NumberFormat` |
| 画面名「在庫照会」と CMD `get_stock_detail` / `list_low_stock` の命名差異 | 画面表示「在庫照会」 | CMD は実態（詳細取得 / 在庫少一覧）に即した命名（memory `feedback-naming-must-match-reality.md`） |

### 58.13 非目的（IO/BIZ 同型表）

| やらないこと | 理由 | 責務を持つモジュール |
|---|---|---|
| 専用スキャンボタン実装 | Phase 2 では専用スキャンボタンは実装しない。バーコードスキャナは HID キーボード入力として検索欄に入る前提で、検索欄 focus + Enter 検索まで対応する。専用スキャン UX / 連続スキャン検知は Phase 3 UI-01a/UI-02 の HW 連携時に再設計する | Phase 3 UI-01a / UI-02（HW 連携） |
| 状態チップ件数バッジ | Phase 2 では状態チップに件数バッジを表示しない。理由: 件数の意味が検索条件・部門フィルタ・在庫少閾値 contract と結合し、追加 query / count contract が必要になるため。在庫切れ・在庫少件数の常時把握はホームサマリ（UI-00）で提供し、UI-06a ではチップをフィルタ操作に限定する | Phase 4 UI-06c または count API 設計時に再評価（UI-06b は独立画面ではないため対象外、D-047） |
| 在庫変動履歴の本体実装 | UI-06c で `/stock/$code/movements` として実装。UI-06a は詳細カードから active link で接続する | 画面本体の正典は [66-ui-stock-movements.md](66-ui-stock-movements.md) |
| `list_movements` specta 化 | PR #112 で generated `commands.listMovements` / `MovementRecord.source` contract を追加済み。UI-06c はその consumer として実装する | 画面本体の正典は [66-ui-stock-movements.md](66-ui-stock-movements.md) |
| 詳細カード CSV 出力 / 印刷 | SCREEN_DESIGN.md L120-133 に言及なし | scope 外 |
| `stock_low_threshold` 設定変更 UI | 閾値設定は別画面 | UI-11a 閾値設定画面 |
| 廃番商品の表示トグル UI | `include_discontinued` 固定 false、scope 抑制 | Phase 4 で再検討 |

### 更新履歴

| 日付 | PR | 内容 |
|------|-----|------|
| 2026-05-20 | #67 | 新規作成（UI-06a 在庫照会、REQ-301/302 統合 1 画面、2 useQuery 部分障害許容 + URL state 4 key + 派生 4 純関数 + StockInquiryListResult 正規化型 + 色分け契約 H + 検索駆動表示契約 I + collapsible/toggle/toggle-group 新規 add + CSV 取込み invalidation / Plan rally 6 round converged） |
| 2026-05-20 | #67 | Codex Round 1 反映: P2-1/P2-2 = StockDetailCard を一覧テーブル下部固定表示に変更（list query 分岐の外に独立描画、list 失敗時も詳細を表示 = 部分障害許容と整合）。P3-1 = q/dept 変更時も `selected` を clear（§58.4、新 list の非同期含有判定を避け race 回避）。RTL に list 失敗 + detail 成功ケース追加（§58.9） |
| 2026-05-21 | #67 | 初 Windows native L3 デモ起因 F1/F2 修正: F1 詳細を最下部固定カード → 選択行直下 colSpan インライン展開（`StockDetailContent` 抽出、collapsible 不使用化）+ list 失敗時フォールバックカード + selected 不在時 clear（§58.4/§58.7/§58.8、Codex CLI Round 3-4）。F2 状態チップ選択を solid stone-700 + 太字でコントラスト強化（§58.7）。`ProductListTable.test` 新規（C-P2-3）。collapsible.tsx は未使用化（primitive 残置） |
| 2026-05-21 | #67 | Codex CLI 実装レビュー Round 1 P2 対応: P2-1 展開行 td に `whitespace-normal align-top`（table primitive 既定 `whitespace-nowrap` を打ち消し、長い商品名 / CTA 群の折り返し）。P2-2 isAllEmpty + selected URL での detail 空振り防止 = detail query `enabled` に `!isAllEmpty` guard + clear useEffect に isAllEmpty 分岐（§58.4 / §58.5）。test 2 件追加（isAllEmpty clear + detail 非発火 / 展開行 whitespace-normal guard） |
| 2026-06-07 | #74 | 高視認性 follow-up: 状態列を追加し、在庫状態を `Badge + lucide icon + 日本語ラベル` で表示する契約へ更新。在庫数の赤 / amber は補助シグナルに格下げし、`StatusChips` active tone を中庸 stone tone に調整。`ProductListTable` 展開行は `colSpan=6` に更新 |
| 2026-06-07 | display-scale follow-up | H-6 feedback 対応として `ProductListTable` の商品コードセルと `StockDetailContent` の詳細 header 商品コードを `font-mono text-sm font-medium` に更新し、`ProductListTable.test.tsx` で `text-xs` 回帰を防止 |
| 2026-06-08 | display-scale follow-up | Windows native L3 feedback 対応として、個別部門選択中も DepartmentFilter が他部門候補を維持するよう `useStockInquiry` に dept 未指定の候補用 query を追加し、`useStockInquiry.test.tsx` で回帰を防止 |
| 2026-06-08 | selection-tone follow-up | `StatusChips` active tone を shared selection-tone 定数参照に移し、Sidebar / TabsHeader と同じ stone selection 言語へ同期 |
| 2026-06-27 | UI-06c | `StockDetailContent` の「在庫変動履歴」を disabled placeholder から `/stock/$code/movements` active link へ変更。UI-06c 画面本体と `listMovements` consumer contract は [66-ui-stock-movements.md](66-ui-stock-movements.md) に分離 |
| 2026-07-16 | sidebar pending links follow-up | サイドバー「在庫少一覧」（UI-06b）の独立画面 `/stock/low` 予約を廃止し、本画面 `status=low_stock` フィルタへの deep-link に統合（D-047）。既存フィルタ contract（§58.4/§58.10）・useStockInquiry 実装は無変更 |
| 2026-07-29 | wave 4 plan-first | UI-STATE-D2に従い、status tupleと`LOW_STOCK_FILTER`をfeature-local SSOTとしてroute / navigationへ供給する契約を追加。URL値・fallback・表示は不変 |
| 2026-08-03 | ui-polish-batch-b（本 PR） | UI-06a-D1 追加: `page` search param + 既存 canonical `ProductPagination`（02 ⑩）を結線し、「すべて」全件へページ送りで到達できるようにする（対象は `status === "all"` のみ）。`TruncatedResultsAlert` component と `truncated` flag を撤去（§58.2/§58.3/§58.5/§58.7/§58.10）。§58.7 DepartmentFilter を PR-B で統合済みの共通 `patterns/DepartmentFilter` 使用へ表記更新。§58.13 の pagination UI 行（本 change で実装）と DepartmentFilter 共通化行（PR-B で完了済み）を削除。filter-empty 0 件時の「絞り込みを解除」reset action（catalog ⑥）を追加（§58.7/§58.8） |
| 2026-08-03 | ui-polish-batch-b round 1 是正（本 PR） | UI-06a-D2 追加: 部門候補 query を `listDepartments()` master 全件へ切替（DSR-10、round 1 P1-3）、`departmentOptionsQuery` を dept/status 非依存の単一 query へ再設計（§58.5/§58.7/§58.10）。UI-06a-D3 追加: 範囲外 page（`items` 空 + `total_count > 0` + `page > 1`）に専用回復導線「先頭ページに戻る」を新設し、filter-empty reset action より優先判定（74 UI-11c-D8 同型、round 1 P1-2、§58.4/§58.7/§58.8/§58.9/§58.10）。EmptyState 疑似コードの `message=` prop を実契約 `title=` へ是正（round 1 P2-5、§58.7/§58.8） |
| 2026-08-03 | ui-polish-batch-b round 2 是正（本 PR） | round 2 P1-1 対応: `useStockInquiry` の return に `departmentOptionsQuery` / `departmentOptions`（`Department[] → DepartmentOption[]` 変換済み）を追加し、`StockInquiryPage` の `DepartmentFilter` を canonical props（`options` / `selected` / `onChange` / `disabled`、59 §59.1）へ結線（§58.3/§58.5/§58.7）。候補取得失敗時は `departmentOptionsQuery.isError` で「部門候補の取得に失敗しました」を listQuery と独立に表示する挙動を明記（§58.5/§58.7）。`queryKeys.stockInquiry.departmentOptions()` の無引数化（現状 `(status, q)` 引数付き）を implementation target として明示、対象は src/lib/query-keys.ts / useStockInquiry.ts / useStockInquiry.test.tsx（§58.5）。§58.9 SPEC-UIBB-9 に status 変更後の候補不変 assert / 同一 QueryClient での `listDepartments` call count = 1 / `departmentOptions()` 無引数・一定 key の unit test を追加 |
| 2026-08-03 | ui-polish-batch-b round 3 是正（本 PR） | P2-1（FilePicker ripple、対象は 60/63/SCREEN_DESIGN/FUNCTION_DESIGN/UI_TECH_STACK、本 file 対象外）と合わせて、本 file の要約層を詳細（§58.5/§58.3）と同期: 冒頭テンプレ判定表・§58.2 hook 行・§58.5 見出しを「2 useQuery」→「3 useQuery」、URL state を「4 key」→「5 key（q/dept/status/page/selected）」、§58.3 データフロー返却値を実疑似コードと同じ `{ listQuery, detailQuery, departmentOptionsQuery, departmentOptions, isAllEmpty }` へ修正（round 3 P2-2）。§58.9 に SPEC-UIBB-9 の loading（候補 pending 中は DepartmentFilter trigger disabled）/ error（`listDepartments` reject + list 成功で alert と一覧が同時表示、QueryClient retry 無効化）2 test を追加（round 3 P2-3） |
