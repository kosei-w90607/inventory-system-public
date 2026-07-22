> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: ARCHITECTURE.md（UI-06c / REQ-303）、SCREEN_DESIGN.md（在庫照会 / 入出庫履歴・在庫変動追跡）、44-cmd-inventory.md（CMD-06 list_movements）、58-ui-stock-inquiry.md（在庫照会からの導線）、65-inventory-record-traceability.md（完成形 traceability contract）

## 66. UI-06c: 商品別在庫変動履歴

### 66.1 概要

- **対応 REQ**: REQ-303（在庫変動履歴）+ REQ-207（在庫変動から元業務記録へ戻る）
- **route**: `/stock/$code/movements`
- **呼び出す CMD**:
  - `getStockDetail(productCode)` — 見出し、現在庫、商品名、部門表示
  - `listMovements(query: MovementQuery)` — 商品別 movement 一覧
- **主動線**:
  1. `/stock` の商品詳細カードから「在庫変動履歴」を開く
  2. 商品別に日時降順の movement を確認する
  3. movement 行の元記録ラベルから業務記録詳細へ遷移する
  4. 「在庫照会へ戻る」で `/stock?selected=$code` に戻る
- **初回実装の非対象**: CSV出力、印刷、取消/訂正、元 movement 関係表示、横断 `/inventory/records`、業務記録詳細画面そのもの。

**関数要求**: 商品コードごとの在庫変動履歴を URL search state 付きで表示し、各 movement の日時、種別、増減、変動後在庫、元業務記録リンク、備考を operator-facing な日本語 UI として確認できるようにする。

**シグネチャ**:

```ts
export function StockMovementsPage(props: {
  productCode: string;
  search: StockMovementsSearch;
  onSearchChange: (updater: (prev: StockMovementsSearch) => StockMovementsSearch) => void;
}): JSX.Element;

export function useStockMovements(args: {
  productCode: string;
  search: NormalizedStockMovementsSearch;
}): {
  productQuery: UseQueryResult<StockDetail>;
  movementsQuery: UseQueryResult<PaginatedResult<MovementRecord>>;
};
```

**処理ステップ**:

1. Route が path param `code` と search params `dateFrom/dateTo/type/page` を zod で検証し、不正値を fallback する。
2. `StockMovementsPage` が search params を `NormalizedStockMovementsSearch` に正規化する。
3. `useStockMovements` が `getStockDetail(code)` と `listMovements(MovementQuery)` を独立 query として呼ぶ。
4. 商品 query 成功時は商品名、商品コード、部門、現在庫を表示する。失敗時は商品情報だけ inline warning にする。
5. movement query 成功時は `MovementTable` に渡し、日時、種別、増減、変動後在庫、元記録、備考を表示する。
6. filter 変更時は `onSearchChange` で該当 search param を更新し、`page` を 1 に戻す。
7. pagination 操作時は `page` だけを更新する。

**エラーハンドリング**:

- `getStockDetail` 失敗時は商品サマリ欄に「商品情報の取得に失敗しました」を表示し、movement list は表示継続する。
- `listMovements` 失敗時は destructive Alert「在庫変動履歴の取得に失敗しました」を表示する。
- `MovementRecord.source` が null の場合は行を落とさず、「元記録なし」を表示する。
- 未知の `movement_type` はエラーにせず、元文字列を outline Badge で表示する。

### 66.2 Design Decisions

| ID | 決定 | 理由 / 棄却案 |
|---|---|---|
| UI-06c-D1 | route は `/stock/$code/movements` とし、商品コードを path param に置く。 | 商品別台帳であり、F5 / bookmark / 共有時に対象商品が一意になる。query だけで `product_code` を持つ案は在庫照会本体の検索 state と衝突しやすいため棄却。 |
| UI-06c-D2 | search params は `dateFrom` / `dateTo` / `type` / `page` に限定する。 | 初回 UI は調査に必要な絞り込みに絞る。perPage は 20 固定で、表示件数選択は実利用で必要になったら追加する。 |
| UI-06c-D3 | product header と movement list は 2 useQuery とし、部分障害を許容する。 | movement が失敗しても商品名・現在庫を表示して対象商品を確認できる。商品詳細が失敗しても movement は商品コード単位で取得できる。 |
| UI-06c-D4 | movement 種別は frontend で日本語ラベルへ変換し、未知種別は元文字列を表示する。 | backend contract は string。表示不能にせず調査可能性を優先する。未知値で落とす案は legacy/corrupt row の追跡を妨げるため棄却。 |
| UI-06c-D5 | 増減数量は `+N` / `-N` と日本語の「増加」「減少」ラベルで示し、色だけに頼らない。 | DSR-08。業務上の意味を非IT利用者が判別できる必要がある。 |
| UI-06c-D6 | `MovementRecord.source` がある行だけ「元記録」リンクを出し、ない行は「元記録なし」と表示する。 | PR #112 の source-link contract を使う。初期在庫や legacy 行は movement 自体を表示し、リンク欠落だけを明示する。 |
| UI-06c-D7 | 元記録 route がまだ未実装でも link URL は `source.route` をそのまま表示対象にする。 | UI-06c の責務は movement から元記録へ戻るための contract 表示。未実装詳細 route の完成は後続スライスで扱う。 |
| UI-06c-D8 | Windows native L3 は必要。 | 新規 operator-facing 調査画面であり、表の密度、数量符号、元記録リンク、戻り導線の視認性を確認する必要がある。 |

### 66.3 URL Search State

```ts
type StockMovementsSearch = {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  type?: "all" | "receiving" | "return" | "sale_auto" | "sale_manual" | "disposal" | "stocktake";
  page?: number;     // 1 始まり。未指定は 1
};
```

- 不正な `dateFrom` / `dateTo` は `undefined` に fallback する。
- 不正な `type` は `"all"` に fallback する。
- `page < 1` または数値化できない page は `1` に fallback する。
- `dateFrom` / `dateTo` / `type` を変更したら `page=1` に戻す。
- `per_page` は 20 固定。CMD/BIZ の上限 100 を踏まえ、UI から上限超過を送らない。

### 66.4 Data Flow

本 query を stale 化する mutation 集合は [D-052](../decision-log.md) と `src/lib/invalidation-contract.ts` を正本とし、本書へ producer 一覧を複製しない。`queryKeys.stockMovements.root()` は product / list key の共通 prefix とする。

```
Route params: code
Route search: dateFrom, dateTo, type, page
  ↓
StockMovementsPage
  ├ getStockDetail(code)
  └ listMovements({
       product_code: code,
       date_from: dateFrom ?? null,
       date_to: dateTo ?? null,
       movement_type: type === "all" ? null : type,
       page,
       per_page: 20,
     })
       ↓
MovementSummary + MovementTable + ProductPagination
```

### 66.5 UI 表示

#### Header

- `PageHeader` title: `在庫変動履歴`
- actions:
  - `在庫照会へ戻る` → `/stock?selected=$code`

#### 商品サマリ

商品詳細 query 成功時:

- 商品名
- 商品コード
- 部門
- 現在庫（`formatStockDisplay` を再利用）

商品詳細 query 失敗時:

- destructive Alert ではなく inline warning として「商品情報の取得に失敗しました」を表示する。
- movement list は表示を継続する。

#### Filters

- 日付範囲: `dateFrom` / `dateTo` の date input
- 種別: Select
  - `all`: すべて
  - `receiving`: 入庫
  - `return`: 返品・交換
  - `sale_auto`: POS売上
  - `sale_manual`: 手動販売
  - `disposal`: 廃棄・破損
  - `stocktake`: 棚卸し

#### Table

列:

1. 日時
2. 種別
3. 増減
4. 変動後在庫
5. 元記録
6. 備考

表示規則:

- 日時は `YYYY-MM-DD HH:mm:ss` 表示。変換できない値は元文字列を表示する。
- 種別は日本語 Badge。未知値は outline Badge で元文字列を表示する。
- 増減は `+N` / `-N` の tabular 表示と `増加` / `減少` / `変動なし` ラベルを併記する。
- 元記録は `source` があれば `source.label` のリンク、なければ muted text `元記録なし`。
- 備考が null/blank の場合は `—`。

### 66.6 Error / Empty / Loading

- movement loading: table 領域に Skeleton 3 行。
- movement error: destructive Alert「在庫変動履歴の取得に失敗しました」。条件変更か再試行を促す。
- movement empty: EmptyState「在庫変動履歴がありません」。商品に movement がない、または検索条件に該当しないことを説明する。
- product detail error: 商品サマリだけ inline warning。movement error と独立させる。

### 66.7 Tests

- REQ-303 / UI-06c-D1: route params の `code` を `listMovements.product_code` に渡す。
- REQ-303 / UI-06c-D2: search params を `MovementQuery` に変換し、filter 変更時は page を 1 に戻す。
- REQ-303 / UI-06c-D4/D5/D6: movement table が種別、増減、変動後在庫、元記録リンク、元記録なしを表示する。
- REQ-303 / UI-06c-D3: product detail query の失敗時も movement list を表示する。
- REQ-207 / UI-06c-D6/D7: `source.route` をリンク先に使う。
- UI-06c-D8: Windows native L3 で、在庫照会からの導線、filter、pagination、元記録リンクの視認性を確認する。
