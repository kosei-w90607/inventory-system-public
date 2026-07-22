## 7. UI-01b: 商品登録・修正

> 対応仕様: REQ-101 / REQ-102 / UI-01b
>
> 入力ドキュメント: `docs/architecture/ui-task-specs.md` UI-01b、`docs/SCREEN_DESIGN.md` 商品登録・修正画面、`docs/function-design/30-biz-product-service.md` `create_product` / `update_product` / `toggle_discontinue` / `get_product`、`docs/function-design/40-cmd-product.md` CMD-01、`docs/function-design/20-io-product-repo.md` products / departments / suppliers

商品登録・修正は、商品マスタを作成・更新する operator-facing form である。商品検索・一覧 UI-01a からの新規登録 / 修正導線を受け、既存の BIZ-01 / CMD-01 契約を generated binding 経由で呼び出す。

説明書作成時は、商品登録と入庫記録の役割差を明記する。商品登録は商品マスタ作成と初期在庫の設定に使い、通常の仕入で在庫を増やす作業は UI-02 入庫記録で行う。

## 7.1 設計判断

| Spec | Decision ID | 決定 | 理由 / 不採用案 |
|---|---|---|---|
| REQ-101 / UI-01b | UI-01b-D1 | route は `/products/new` と `/products/$code/edit` に分ける。file route は `src/routes/products/new.tsx` と `src/routes/products/$code.edit.tsx`。 | create / edit の状態差が大きいため path で mode を明示する。query param だけで mode を切り替える案は、直接 URL 共有時に意図が読み取りにくいため不採用。 |
| REQ-101 / REQ-102 | UI-01b-D2 | 保存成功後は商品一覧へ戻る。`returnTo` search param は `/products` 一覧 route とその search params だけ許可し、それ以外は `/products` に戻す。 | UI-01a の検索条件 URL state を保って戻れるようにする。一方でフォーム route、import route、外部 URL、他画面 route への遷移は不要で、保存後の循環や誤遷移を生むため許可しない。 |
| CMD-01 / UI-01b | UI-01b-D3 | UI は generated `commands.*` だけを使う。実装 PR では `createProduct` / `updateProduct` / `toggleDiscontinue` / `listSuppliers` を tauri-specta に追加し、`src/lib/bindings.ts` を更新する。 | `typedInvoke` fallback は Phase 2 closeout で退役済み。UI-01b だけ ad hoc invoke に戻す案は contract drift のため不採用。 |
| REQ-101 | UI-01b-D4 | create mode の商品コード入力は「JANコードあり」と「JANなし独自コード自動発番」に分ける。JAN blank + 選択部門に `code_prefix` がある場合だけサーバー発番を使い、`code_prefix` がない部門では保存前 validation で止める。 | 現行 `ProductCreateRequest` は任意 `product_code` 手入力を受けない。UI が手入力欄を出しても backend に送れないため不採用。JANなし商品は独自コード発番対象部門を選ぶ。 |
| REQ-102 / SP-102-04 | UI-01b-D5 | edit mode では `product_code` と `jan_code` を読取専用、`stock_quantity` と `stock_unit` も初回 UI-01b 実装では読取専用にする。 | `product_code` 変更不可は DB 設計と仕様で確定済み。`ProductUpdateRequest` は `stock_unit` / `stock_quantity` を更新しない。単位変更は在庫履歴・閾値・POS 連動への影響が大きいため別 Design Phase。 |
| REQ-101 / pos_stock_sync | UI-01b-D6 | create mode で `stock_unit='cm'` にした場合は `pos_stock_sync=false` を提案し、利用者は toggle で true に戻せる。BIZ は UI から受け取った値を尊重する。 | `stock_unit='cm'` だけで POS 在庫同期を決める案は、DB_DESIGN の `pos_stock_sync` 明示フラグ方針に反する。 |
| REQ-101 / suppliers | UI-01b-D7 | 取引先候補は `commands.listSuppliers()` 由来の complete master data とする。inline 新規取引先作成は初回 UI-01b 実装では非 scope。 | `suppliers` は任意項目で、誤った master 追加は後から直しづらい。`find_or_create_supplier` の公開 CMD と新規追加 UX は別途設計してから扱う。 |
| REQ-101 / REQ-102 | UI-01b-D8 | form は部分障害を分ける。部門候補取得失敗は保存不可、取引先候補取得失敗は取引先未指定なら保存可能、edit の `getProduct` 失敗は form 本体を出さず一覧へ戻る導線を出す。 | 商品登録で部門は必須、取引先は任意。全取得が成功するまで画面全体を空にする案は、復旧操作を阻害するため不採用。 |
| REQ-101 / REQ-102 | UI-01b-D9 | 日本語入力を伴う form のため、実装 PR では Windows native L3 を計画する。 | Tauri 2 Linux WebView には IME 制約があり、商品名・メーカー品番・取引先名の入力品質は Linux だけでは判断できない。 |
| REQ-101 / REQ-102 | UI-01b-D10 | form を「商品の識別」「分類と取引先」「価格」「在庫」の 4 セクションに分割し、各セクション見出しを h2 `text-xl font-semibold` + Separator + 1 行説明にする。メーカー品番は「商品の識別」に置く。 | 1 列のフラットな入力列は、非IT利用者が入力順を把握しづらい。意味の塊でグルーピングし、入力の流れを明示する。section ごとの説明で登録後変更できない項目を予告する。 |
| REQ-102 | UI-01b-D11 | read-only 入力（商品コード / edit の JANコード・現在庫）は `readOnly` + `bg-muted` で示す。数量単位 select は `disabled` を維持する。 | `disabled` の opacity-50 は値が読みづらく、read-only と操作不能の意味が混ざる。表示専用の値は読める muted 背景にする。`<select>` は readOnly 属性が効かないため数量単位だけ `disabled` を残す。 |
| REQ-101 / REQ-102 | UI-01b-D12 | 必須項目（商品名・部門・売価・原価、create 時は初期在庫）のラベルに `（必須）` を付ける。色で必須を符号化しない。JANコードは対象外。 | 非IT利用者には必須項目が分かりやすい方がよい。色（赤 * 等）だけの符号化は [design-system/00-foundations.md §業務ステータスの視認性](../design-system/00-foundations.md) に反するため、テキストで明示する。JAN は任意（独自コード発番経路がある）ため必須にしない。 |
| REQ-102 | UI-01b-D13 | 「廃番にする」操作は確認ダイアログ（`DiscontinueConfirmDialog`、shadcn AlertDialog）を通す。「表示に戻す」は確認なしで直接実行する。 | 廃番化は一覧の通常表示から外れる片方向の状態変更で、誤操作の影響が大きいため確認する。復帰は影響が小さく、戻す操作にさらに確認を挟むと操作が重くなるため直接実行する。先例は CSV 取込みの `OverwriteConfirmDialog`。 |
| REQ-101 / REQ-102 | UI-01b-D14 | 保存成功は `toast.success`（`id: "product-save-success"`、`duration: 5000`）で示し、navigate より前に発火する。create は登録した商品コードを含め、edit は保存完了を伝える。 | 保存後すぐ一覧へ戻るため、成功は一覧に遷移してからでなく form 上の通知で確実に伝える。id 固定で連打時に通知が積み重ならないようにする。alert を画面内に残すと遷移と二重になるため toast を使う。 |
| REQ-101 / REQ-102 | UI-01b-D15 | create、update、廃番化・復帰の成功時 invalidation は [D-052](../decision-log.md) C1/C2 と `src/lib/invalidation-contract.ts` を正本とし、form 内に query key 集合を列挙しない。 | 商品・在庫・PLU・棚卸し consumer への追随を mutation 単位の SSOT で保証し、page と設計書の二重管理を避ける。 |

## 7.2 Component / Route 構成

```
src/
  routes/
    products/
      new.tsx              -- create route
      $code.edit.tsx       -- edit route
  features/
    products/
      ProductFormPage.tsx
      components/
        ProductForm.tsx                -- 4 セクション分割（UI-01b-D10）
        StockUnitField.tsx
        DiscontinueConfirmDialog.tsx   -- 廃番確認（UI-01b-D13）
```

既存 UI-01a は `src/features/products` 配下に実装済みのため、UI-01b も同 feature に置く。商品コード / 部門 / 取引先の入力は `ProductForm` 内のセクションに inline で持たせ、shared 化は複数画面で再利用が必要になった時点で別 PR に切り出す。`ProductForm` は内部の `FormSection`（h2 見出し + Separator + 説明）で「商品の識別」「分類と取引先」「価格」「在庫」を構成する（UI-01b-D10）。

## 7.3 Route / State

### `/products/new`

- mode: `create`
- search params:
  - `returnTo?: string`
- 初期値:
  - `jan_code = ""`
  - `name = ""`
  - `department_id = null`
  - `selling_price = 0`
  - `cost_price = 0`
  - `tax_rate = "10"`
  - `stock_unit = "pcs"`
  - `initial_stock = 0`
  - `maker_code = ""`
  - `supplier_id = null`
  - `pos_stock_sync = true`

### `/products/$code/edit`

- mode: `edit`
- path param:
  - `code: string`
- search params:
  - `returnTo?: string`
- 初回表示時に `commands.getProduct(code)` を呼ぶ。
- `product_code`, `jan_code`, `stock_quantity`, `stock_unit`, `created_at`, `updated_at` は表示のみ。

## 7.4 Command / DTO Contract

UI-01b 実装 PR では以下を generated binding に出す。

| Command | Existing backend | UI-01b usage |
|---|---|---|
| `commands.getProduct(productCode)` | generated 済み | edit 初期表示 |
| `commands.listDepartments()` | generated 済み | 必須部門候補 |
| `commands.listSuppliers()` | IO は既存、BIZ/CMD/generation は実装 PR で追加 | 任意取引先候補 |
| `commands.createProduct(req)` | Tauri command は既存、generated 未対応 | create 保存 |
| `commands.updateProduct(productCode, req)` | Tauri command は既存、generated 未対応 | edit 保存 |
| `commands.toggleDiscontinue(productCode)` | Tauri command は既存、generated 未対応 | edit 廃番 / 復帰 |

`ProductCreateRequest` / `ProductCreateResult` / `ProductUpdateRequest` / `ProductUpdateResult` / `Supplier` は `specta::Type` を付与し、`src/lib/bindings.ts` に生成して commit する。

## 7.5 Form Behavior

### Create

1. departments / suppliers を取得する。
2. 商品コード欄:
   - JANコードあり: JANコードを入力する。保存時は `jan_code=Some(value)` になり、BIZ が `product_code=jan_code` として登録する。
   - JANコードなし: JAN欄を空にし、独自コード発番対象部門を選ぶ。UI は「保存時に自動発番」と表示する。
   - JAN欄が空で、選択部門に `code_prefix` がない場合は保存しない。
3. 必須項目を入力する。
4. `stock_unit='cm'` に変更した場合、`pos_stock_sync=false` を提案する。`stock_unit='pcs'` に戻した場合は既定の `true` を復元する。自動提案は `onPosStockSyncSuggest`（touched を立てない）経路を使い、利用者の checkbox 操作（touched を立てる `onPosStockSyncChange`）と区別する。利用者が toggle を触った後（touched=true）はどちらの単位変更でも提案を発火しない。
4b. `plu_target`（レジにバーコード登録する）は JAN 欄の値から初期値を提案する: 13 桁数字なら on、それ以外（空・不正形式）は off。利用者は変更できる。自動提案は pos_stock_sync と同じ touched 区別パターンを使う（D-028。詳細仕様と実装は後続 R3 PR / UI-01b 実装 PR で確定）。
5. 保存時に `commands.createProduct(req)` を呼ぶ。
6. 成功時は保存された `product_code` を含む成功 toast（`toast.success`、`id: "product-save-success"`、`duration: 5000`）を navigate より前に発火し、safe な `returnTo` または `/products` へ遷移する。safe な `returnTo` は `/products` 一覧 route とその search params のみ（UI-01b-D14）。

### Edit

1. `commands.getProduct(productCode)` で既存商品を取得する。
2. editable fields:
   - `name`
   - `department_id`
   - `selling_price`
   - `cost_price`
   - `tax_rate`
   - `maker_code`
   - `supplier_id`
   - `pos_stock_sync`
   - `plu_target`（D-028。off→on に変更した場合、その商品は PLU 未反映（plu_dirty=1）扱いになり UI-08 の差分に現れることを補足文言で示す）
3. read-only fields:
   - `product_code`
   - `jan_code`
   - `stock_quantity`
   - `stock_unit`
4. 保存時は変更された field だけを `ProductUpdateRequest` に入れる。nullable field は以下の通り:
   - supplier 未指定へ戻す: `supplier_id: Some(None)` 相当の generated value
   - maker_code 空へ戻す: `maker_code: Some(None)` 相当の generated value
5. 廃番 / 復帰は edit mode だけに出す。状態は色だけでなく「廃番」「表示中」の日本語 badge と button label で示す。「廃番にする」は確認ダイアログ（`DiscontinueConfirmDialog`）を通し、「表示に戻す」は確認なしで直接実行する（UI-01b-D13）。

## 7.6 Validation / Error / Recovery

Frontend validation:

- `name`: 空文字 → `商品名を入力してください`
- `department_id`: 未選択 → `部門を選択してください`
- `selling_price`: 0 未満または整数でない → `売価は0以上の整数で入力してください`
- `cost_price`: 0 未満または整数でない → `原価は0以上の整数で入力してください`
- `initial_stock`: create mode で 0 未満または整数でない → `初期在庫は0以上の整数で入力してください`
- `tax_rate`: `"10" | "8" | "0"` 以外 → `税率を選択してください`
- `stock_unit`: create mode で `"pcs" | "cm"` 以外 → `数量単位を選択してください`
- `jan_code` blank + `department.code_prefix == null` → `JANコードを入力するか、独自コード発番対象の部門を選択してください`

Error recovery:

- 部門候補取得失敗: 部門必須のため保存不可。再読み込み / 一覧へ戻る導線を出す。
- 取引先候補取得失敗: 警告を出す。取引先未指定なら保存可能。
- `getProduct` not found: form を出さず「商品が見つかりません」を表示し、一覧へ戻る導線を出す。
- save validation / duplicate: field error または form-level alert を出し、入力値は保持する。
- save internal error: form-level alert を出し、保存ボタンを再度押せる状態に戻す。

## 7.7 Non-scope / Follow-up

- inline 新規取引先作成。
- 商品コードの手入力登録。
- edit mode での `stock_unit` / `stock_quantity` 変更。
- cm / m 表示切替 UI。UI-01b では `cm` を入力・表示できるが、`m` 換算表示 toggle は別 Design Phase で扱う。
- dedicated scanner UX / 連続スキャン検知。
- supplier / department select の shared component 化。

## 7.8 Test Focus

- route mode: `/products/new` は create、`/products/$code/edit` は edit。
- generated command: `createProduct` / `updateProduct` / `toggleDiscontinue` / `listSuppliers` が binding に存在する。
- create payload: JANあり / JANなし自動発番 / prefixなし部門 validation。
- edit payload: read-only fields を送らず、nullable fields を正しく clear できる。
- `stock_unit='cm'` 時の `pos_stock_sync=false` 提案と手動 override。
- 部門取得失敗 / 取引先取得失敗 / `getProduct` not found / duplicate save error の復旧。
- 廃番状態は日本語 badge + button label で示し、色だけにしない。
- form は「商品の識別」「分類と取引先」「価格」「在庫」の 4 セクションに分かれ、h2 見出しを持つ（UI-01b-D10）。
- read-only 入力（商品コード / edit の JANコード・現在庫）は `readonly` 属性を持ち、数量単位 select は `disabled` を維持する（UI-01b-D11）。
- 必須項目（商品名・部門・売価・原価、create 時は初期在庫）のラベルに `（必須）` が含まれる（UI-01b-D12）。
- 「廃番にする」は確認ダイアログを出し、キャンセルで状態が変わらない。「表示に戻す」は確認なしで直接実行する（UI-01b-D13）。
- 保存成功時に `toast.success`（`id: "product-save-success"`）が navigate より前に発火する（UI-01b-D14）。
- Windows native L3: 日本語入力、Tab 移動、保存後遷移、廃番 / 復帰の視認性。

## 7.9 変更履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-06-09 | UI-01b Design Phase | TanStack Router route、generated command 方針、supplier 候補、JANなし商品コード、edit read-only fields、cm / m defer、Windows native L3 を Design Phase 基準で整理。 |
| 2026-06-12 | UI-01b polish | UI-01b-D10〜D12 を追加（4 セクション分割、read-only 表示、必須項目ラベル）。§7.2 を実装構成へ更新。 |
| 2026-06-12 | UI-01b polish | UI-01b-D13 を追加（廃番にするの確認ダイアログ、表示に戻すは直接実行）。§7.5 step 5 を整合。 |
| 2026-06-12 | UI-01b polish | UI-01b-D14 を追加（保存成功 toast）。§7.5 Create step 6 を整合。 |
| 2026-06-12 | PR #95 Codex P2 対応 | §7.5 Create step 4 を更新: 自動提案（`onPosStockSyncSuggest`）と利用者 override（`onPosStockSyncChange`）を分離。pcs→cm で false 提案、cm→pcs で true 復元。touched=true 後は提案を発火しない。 |
| 2026-07-03 | D-028 Design Phase | §7.5 Create 4b と Edit editable fields に `plu_target`（レジにバーコード登録する）を追加。JAN 13桁数字判定からの初期値提案 + 変更可、off→on で PLU未反映扱い。実装は後続 R3 PR。 |
| 2026-06-12 | PR #95 lost update 修正 | `ProductFormProps.onValuesChange` を `(values: ProductFormValues) => void` から `React.Dispatch<React.SetStateAction<ProductFormValues>>` に変更。`update()` を functional update（`onValuesChange((prev) => ({ ...prev, [key]: value }))`）に変更し、同一 tick の連続 state 更新（単位変更 + POS 同期提案）による lost update を解消。 |
| 2026-06-25 | UI-02 L3 feedback | 説明書作成時に、商品登録は商品マスタ作成、入庫記録は通常仕入の在庫加算であることを明記する注意を追加。 |
