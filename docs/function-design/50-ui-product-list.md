# 50. UI-01a: 商品検索・一覧

> 最終更新: 2026-06-09 / Design Phase readiness trial
>
> 対応仕様: REQ-103 / UI-01a
>
> 入力ドキュメント: `docs/architecture/ui-task-specs.md` UI-01a、`docs/SCREEN_DESIGN.md` 商品検索・一覧画面、`docs/function-design/20-io-product-repo.md` `search_products`、`docs/function-design/30-biz-product-service.md` `search_products`、`docs/function-design/40-cmd-product.md` `search_products`

## 50.1 位置付け

商品検索・一覧は、商品管理の入口画面である。商品名 / 商品コード / JAN コード検索、部門絞込み、廃番状態の切替、並替え、ページングを扱い、商品登録・修正画面への導線を提供する。

この設計は UI 実装前の Design Phase 成果物であり、バックエンド関数 / CMD / DTO / DB 契約は既存の `search_products` をそのまま使う。実装計画やテスト設計は Plan Packet / Test Design Matrix に置き、ここには実装者が迷わないための durable な設計判断を残す。

## 50.2 Design Intent Trace

| Spec / requirement ID | Decision ID | 設計判断 | 理由 / 捨てた案 |
|---|---|---|---|
| REQ-103 / UI-01a | UI-01a-D1 | 初期表示で廃番以外の商品を一覧表示する。`page=1`, `per_page=50`, `is_discontinued=false` を既定値にする。 | 商品管理の入口は「探すまで何も出ない」より、既存商品の把握と修正対象探しを優先する。在庫照会 UI-06a の検索駆動表示を機械的に横展開しない。 |
| REQ-103 / UI-01a | UI-01a-D2 | 検索条件、廃番モード、並替え、ページングは TanStack Router search params に持つ。 | F5 耐性、URL による再現、queryKey の安定、レビュー時の状態共有を優先する。ローカル `useState` のみは採用しない。 |
| REQ-103 / UI-01a | UI-01a-D3 | Tauri CMD は既存 `commands.searchProducts(query)` だけを使う。 | 既存 `ProductSearchQuery` が keyword / department / discontinued / sort / paging を持つため、新規 CMD や BIZ 追加は不要。 |
| REQ-103 / UI-01a | UI-01a-D4 | UI-01a はページング UI を実装する。`perPage` は 50 / 100 / 200 の選択式にし、200 超を UI から送らない。 | 商品マスタは 4000 件規模がありうる。既存 IO 契約は 200 超クランプだが、UI は契約内の選択肢に制限する。 |
| REQ-103 / UI-01a | UI-01a-D5 | バーコードスキャナは HID キーボード入力として検索欄に入る前提にする。専用スキャンボタン / 連続スキャン UX は実装しない。 | UI_TECH_STACK §5.3 と UI-06a の方針を継承する。未設計の HW 連携を実装済みに見せない。 |
| REQ-103 / SP-103-08 | UI-01a-D6 | 生地は在庫数を単位付きで表示する。cm / m 表示切替はこの画面の初回実装では必須にせず、商品登録・修正や横断表示設定と合わせて再評価する。 | 現行 backend DTO は在庫数量と単位情報を返せる。cm / m 切替 UI は初回実装の範囲から外し、REQ を trace したうえで誤った局所設定を作らない。 |
| REQ-103 / UI-01a | UI-01a-D7 | 部門フィルタ候補は `list_departments` CMD で departments 全件を取得する。 | `search_products` の現在ページから候補を派生すると、検索条件・ページング・廃番状態で候補が欠ける。既存 IO `product_repo::list_departments` を BIZ/CMD 経由で公開する設計を採用する。 |
| REQ-103 / UI-01a | UI-01a-D8 | 廃番状態は専用「状態」列を持たず、廃番商品のみ商品名セル内に `廃番` text badge を出し、行を `text-muted-foreground` にする。「表示中」badge は出さない。 | 表示中が大多数の一覧で全行に状態 badge を出すと密度が上がり、注目すべき廃番が埋もれる。色だけで符号化しない（[design-system/00-foundations.md §業務ステータスの視認性](../design-system/00-foundations.md)）ため text badge を併用する。部門列は維持し、L3 で密度過多なら次候補とする。 |

## 50.3 画面構成

実装時の想定ファイル:

```text
src/routes/products/index.tsx
src/features/products/ProductListPage.tsx
src/components/patterns/SearchBar.tsx        # 旧 ProductSearchBar、PR-B で統合（commit 型）
src/components/patterns/DepartmentFilter.tsx # 旧 features/products/components/DepartmentFilter、PR-B で統合
src/features/products/components/ProductTable.tsx
src/features/products/components/ProductPagination.tsx
```

`src/routes/products/index.tsx` は route / search params / title を管理し、画面本体は `ProductListPage` に委譲する。`ProductListPage` は CMD 呼び出し、派生表示、子コンポーネントへの props 配線を担当する。業務判定や DB 操作は UI に置かない。

## 50.4 URL State

| URL param | 型 / 値 | 既定値 | CMD への変換 |
|---|---|---|---|
| `q` | string | `""` | trim 後に空なら `keyword = null`、非空なら `keyword = q` |
| `dept` | number or absent | absent | absent なら `department_id = null` |
| `discontinued` | `active` / `all` / `discontinued` | `active` | `active -> false`, `all -> null`, `discontinued -> true` |
| `sort` | `product_code` / `name` / `stock_quantity` / `selling_price` | `product_code` | `product_code -> ProductCode`, `name -> Name`, `stock_quantity -> StockQuantity`, `selling_price -> SellingPrice` |
| `dir` | `asc` / `desc` | `asc` | `asc -> Asc`, `desc -> Desc` |
| `page` | number >= 1 | `1` | `page` |
| `perPage` | `50` / `100` / `200` | `50` | `per_page` |

検索語、部門、廃番モード、並替え、`perPage` が変わったときは `page=1` に戻す。ページ移動だけは現在の検索条件を維持する。

## 50.5 CMD / DTO 契約

UI は `commands.searchProducts(query: ProductSearchQuery)` を呼ぶ。

`ProductSearchQuery`:

```text
keyword: string | null
department_id: number | null
is_discontinued: boolean | null
sort_key: ProductSortKey
sort_order: SortOrder
page: number
per_page: number  // 上限 200。UI は 50 / 100 / 200 のみ送信し、200 超は IO 層でクランプされる
```

戻り値は `PaginatedResult<ProductWithRelations>` とし、`items` と `total_count` をページング UI の正とする。UI は `perPage` を最大 200 に制限するが、IO 層の 200 超クランプ契約は互換性のため維持される。

部門フィルタ候補は `commands.listDepartments()` で取得する。実装 PR では [30-biz-product-service.md §4.7](30-biz-product-service.md#47-list_departmentsbiz) と [40-cmd-product.md §5.4](40-cmd-product.md#54-各コマンドの関数仕様) に従って thin BIZ/CMD を追加し、generated binding を更新してから UI を配線する。

## 50.6 表示と操作

- 検索欄は商品名 / 商品コード / JAN コードを同じ入力で扱う。Enter で検索を確定し、search params を更新する。
- 部門フィルタは `commands.listDepartments()` 由来の全 21 部門から選ぶ。検索結果の現在ページから候補を作らない。
- 廃番モードは `表示中` / `すべて` / `廃番のみ` の意味が日本語で分かる segmented control にする。
- テーブル列は 商品コード、商品名、部門、売価、在庫数、操作導線を基本にする。廃番状態は専用列を持たず、商品名セル内に表す（UI-01a-D8）。
- 商品コードと商品名は並べて見せ、商品コード単独で利用者判断を強制しない。
- 廃番状態は色だけで表さず、廃番商品のみ商品名セル内に `廃番` text badge を出し、行を muted 表示にする。「表示中」badge は出さない（UI-01a-D8）。
- 行クリックは商品修正へ遷移する。新規登録ボタンは商品登録へ遷移する。正確な UI-01b route は UI-01b Design Phase で確定し、UI-01a 実装時は `navigation.ts` と UI-01b 設計に合わせる。

## 50.7 Loading / Empty / Error

- Loading: 検索条件エリアは残し、一覧領域で loading を示す。
- Empty: 条件に一致する商品がない場合は、検索条件を維持したまま空状態を表示する。
- Error: CMD 呼び出し失敗時は一覧領域にエラーを表示し、検索条件を編集できる状態を維持する。DB / CMD の失敗を UI 側で業務成功扱いにしない。
- Recovery: 条件変更または再試行で同じ `searchProducts` を再実行できるようにする。

## 50.8 テスト観点

UI-01a 実装時は、以下を trace ID 付きで検証する。

- UI-01a-D1: 既定表示で `is_discontinued=false`, `page=1`, `per_page=50` の検索が走る。
- UI-01a-D2: URL search params の既定値、無効値補正、F5 相当の復元が効く。
- UI-01a-D3: `commands.searchProducts` に渡る payload が URL state と一致する。
- UI-01a-D4: page / perPage の変更、検索条件変更時の page reset、total_count からの最終ページ計算。
- UI-01a-D5: 検索欄 Enter で検索できる。専用スキャンボタンを前提にしない。
- UI-01a-D6: 生地在庫の単位付き表示を壊さず、cm / m 切替を実装済みとして見せない。
- UI-01a-D7: 部門候補は `listDepartments` 由来で全件表示され、現在ページの検索結果から欠落しない。
- UI-01a-D8: 専用「状態」列がなく、廃番商品のみ商品名セル内に `廃番` text badge が出て行が muted になる。「表示中」badge は出ない。

## 50.9 Deferred

- UI-01b 商品登録・修正 route の最終ファイル構成と form 設計。
- SP-103-08 の cm / m 表示切替 UI。初回 UI-01a 実装で扱う場合は、横断表示方針または商品管理内の設計判断を追加してから実装する。
- 専用バーコードスキャン UX / 連続スキャン検知。
- `DepartmentFilter` / `DepartmentOption` の feature 間共通化。
