# 50. UI-01a: 商品検索・一覧

> 最終更新: 2026-06-09 / Design Phase readiness trial
>
> 対応仕様: REQ-103 / REQ-105 / UI-01a
>
> 入力ドキュメント: `docs/architecture/ui-task-specs.md` UI-01a、`docs/SCREEN_DESIGN.md` 商品検索・一覧画面、`docs/function-design/20-io-product-repo.md` `search_products`、`docs/function-design/30-biz-product-service.md` `search_products`、`docs/function-design/40-cmd-product.md` `search_products`

## 50.1 位置付け

商品検索・一覧は、商品管理の入口画面である。商品名 / 商品コード / JAN コード / メーカー品番検索、部門絞込み、廃番状態の切替、並替え、ページングを扱い、商品登録・修正画面への導線を提供する（SPEC-PRV-D2）。

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
| REQ-103 / UI-01a | UI-01a-D9 | 検索欄を在庫照会と同型の live 型へ統一する（`debounceMs=200` / `type="search"` + native clear / 外付け Label・検索ボタン非表示 / `aria-label="商品検索"` 維持）。 | Why = commit 型維持の業務理由が owner 調査で確認できず、共通化時の既存挙動温存だった。live 型でも HID スキャナの Enter 即時確定・IME 変換確定 Enter の誤発火防止・条件変更時の `page` reset は維持される。Rejected = commit 型の維持（画面間の操作一貫性を損なう理由が説明できない）（owner L3 判断 2026-08-03、gated amendment）。 |
| REQ-907 / SPEC-PLS-D7 | UI-01a-D10 | PLU 移行状態を独立列「PLU」に置き、`plu_target=0 -> 対象外`、`plu_target=1 && plu_dirty=1 -> 未反映`、`plu_target=1 && plu_dirty=0 -> 反映済み` の 3 語彙で導出する。`plu=all|target|pending|synced|excluded` を URL search param に持つ。 | DSR-04: この画面では PLU 移行状態が filter / 一括操作の主情報であり、全行に値があるため商品名セル内へ詰め込まない。badge は text / icon を併用し、色だけで状態を符号化しない。PLU 状態による行減衰は行わない。 |
| REQ-907 / SPEC-PLS-D6 | UI-01a-D11 | 現在の q / dept / discontinued / plu filter に一致する全件を「PLU 対象にする / 対象から外す」で更新する。実行前に件数付き dialog、実行後に更新 / JAN 不備 skip / 廃番 skip の結果を表示する。 | page 内だけ、または PLU filter を落とした更新は operator が見ている集合とずれる。BIZ-01 の 1 TX command に判断を集約する。 |
| REQ-907 / D-052 | UI-01a-D12 | 一括操作成功後は D-052 C19（`productList.root / pluDirty / productForm.root / pluSlotSummary`）を invalidate する。 | 一覧 badge、ホーム未反映件数、商品詳細、slot 要約の stale を同じ production SSOT から解消する。 |
| REQ-103 / SP-103-04 / SPEC-PRV-D10 | UI-01a-D13 | 原価列を基本列に追加し、売価の右隣に置く（owner 裁定 2026-08-22）。 | 聞き取り第 3 陣 Q4 により PC 画面は通常客から見えず、店主の棚卸し・税理士対応・値付けは原価中心と確認できた。列密度より日常の参照性を優先する。 |

## 50.3 画面構成

実装時の想定ファイル:

```text
src/routes/products/index.tsx
src/features/products/ProductListPage.tsx
src/components/patterns/SearchBar.tsx        # 旧 ProductSearchBar、PR-B で統合（live 型 debounceMs=200、2026-08-03 owner L3 是正で commit 型から変更）
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
| `plu` | `all` / `target` / `pending` / `synced` / `excluded` | `all` | 同名の `PluMigrationFilter`。無効値は `all` へ正規化 |
| `sort` | `product_code` / `name` / `stock_quantity` / `selling_price` | `product_code` | `product_code -> ProductCode`, `name -> Name`, `stock_quantity -> StockQuantity`, `selling_price -> SellingPrice` |
| `dir` | `asc` / `desc` | `asc` | `asc -> Asc`, `desc -> Desc` |
| `page` | number >= 1 | `1` | `page` |
| `perPage` | `50` / `100` / `200` | `50` | `per_page` |

検索語、部門、廃番モード、PLU 移行 filter、並替え、`perPage` が変わったときは `page=1` に戻す。ページ移動だけは現在の検索条件を維持する。

`q` は live 型（[59-ui-shared-patterns.md](59-ui-shared-patterns.md) §59.1 SearchBar、`debounceMs=200`）で、入力から 200ms 後に search param へ反映する。Enter は debounce を待たず即時反映し（trim なし）、IME 変換確定中の Enter は `event.isComposing` で除外して検索確定と取り違えない。CMD 呼び出し直前の `keyword` 変換でのみ trim する（UI-01a-D9、2026-08-03 owner L3 判断、gated amendment）。

**controlled value の責務分離（UI-01a-D9 追補、amendment Plan Review round 1 P1-1）**: SearchBar の controlled `value` には raw の `search.q ?? ""` を渡す。`normalizedSearch.q`（`normalizeString` = trim + 空→undefined）は CMD query の `keyword` 変換・filter 既定判定・`returnTo` の導出専用とし、入力欄の表示値には使わない。normalized 値を controlled value に結線すると、live 反映のたびに trim 済み値が入力欄へ書き戻され「trim なし」契約が main path で破れる。

## 50.5 CMD / DTO 契約

UI は `commands.searchProducts(query: ProductSearchQuery)` を呼ぶ。

`ProductSearchQuery`（SPEC-PRV-D2 により keyword は `maker_code` を含む）:

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

- 検索欄は商品名 / 商品コード / JAN コード / メーカー品番（`maker_code`）を同じ入力で扱う（SPEC-PRV-D2）。placeholder は「商品コード・商品名・JAN・メーカー品番で検索」とする。live 型（[59-ui-shared-patterns.md](59-ui-shared-patterns.md) §59.1、`debounceMs=200`）で入力から 200ms 後に search params を更新し、Enter は debounce を待たず即時反映する（IME 変換確定中の Enter は無視）。`type="search"` のネイティブ clear を使い、外付け Label と検索ボタンは持たない。`aria-label="商品検索"` で識別する（UI-01a-D9）。
- 部門フィルタは `commands.listDepartments()` 由来の全 21 部門から選ぶ。検索結果の現在ページから候補を作らない。
- 廃番モードは `表示中` / `すべて` / `廃番のみ` の意味が日本語で分かる segmented control にする。
- テーブル列は 商品コード、商品名、部門、売価、原価、在庫数、操作導線を基本にする。原価は売価の右隣に置く（SPEC-PRV-D10）。廃番状態は専用列を持たず、商品名セル内に表す（UI-01a-D8）。
- 商品コードと商品名は並べて見せ、商品コード単独で利用者判断を強制しない。
- 廃番状態は色だけで表さず、廃番商品のみ商品名セル内に `廃番` text badge を出し、行を muted 表示にする。「表示中」badge は出さない（UI-01a-D8）。
- PLU 移行状態は独立列「PLU」で `対象外` / `未反映` / `反映済み` の text badge と補助 icon で示す。filter 一致全件の一括操作は件数付き確認 dialog を通し、成功は toast、失敗は destructive Alert で示す（UI-01a-D10〜D12）。

| 用途 | 文言 |
|---|---|
| badge | `対象外` / `未反映` / `反映済み` |
| ボタン | `PLU 対象にする` / `PLU 対象から外す` |
| dialog title | `表示中の商品をPLU対象にしますか` / `表示中の商品をPLU対象から外しますか` |
| dialog description | `現在の絞り込み条件に一致する {n} 件が対象です。レジへの反映には PLU 書出しと PC ツールの取込みが別途必要です。` |
| 成功 toast | `{updated} 件を更新しました（JAN 不備 {a} 件 / 廃番 {b} 件は対象外）` |
- 行クリックは商品修正へ遷移する。新規登録ボタンは商品登録へ遷移する。正確な UI-01b route は UI-01b Design Phase で確定し、UI-01a 実装時は `navigation.ts` と UI-01b 設計に合わせる。

## 50.7 Loading / Empty / Error

- Loading: 検索条件エリアは残し、一覧領域で loading を示す。
- Empty: 条件に一致する商品がない場合は、検索条件を維持したまま空状態を表示する。絞り込み（`q` / `dept` / `discontinued` / `plu`）が既定値以外かつ 0 件のときは、既存の「商品を登録する」action を常設のまま維持し、`action` slot 内に「絞り込みを解除」ボタンを横並び併置する。押下で `q` / `dept` / `discontinued` / `plu` と `page` を既定値へ戻す。`sort` / `dir` / `perPage` は変更しない。絞り込みが既定値のまま 0 件（真にデータなし）のときは reset ボタンを出さない。
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
- UI-01a-D9: 検索欄が live 型（`debounceMs=200`）で動作し、Enter は debounce を待たず即時反映、IME 変換確定中の Enter は発火しない。`q` の変更・クリアで `page` が既定へ戻る。外付け Label・検索ボタンは表示されない。
- UI-01a-D10: 3 語彙の導出式、`plu` URL 復元、色以外の符号が一致する。
- UI-01a-D11: page 外も含む filter 全件の件数確認と、更新 / JAN 不備 skip / 廃番 skip の結果を表示する。
- SPEC-PRV-D10: 「原価」列ヘッダが「売価」の右隣に存在し、値が基本列として表示される。

## 50.9 Deferred

- UI-01b 商品登録・修正 route の最終ファイル構成と form 設計。
- SP-103-08 の cm / m 表示切替 UI。初回 UI-01a 実装で扱う場合は、横断表示方針または商品管理内の設計判断を追加してから実装する。
- 専用バーコードスキャン UX / 連続スキャン検知。
