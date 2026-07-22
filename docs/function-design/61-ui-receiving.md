# 61. UI-02: 入庫記録

> 対応仕様: REQ-201 / UI-02
>
> 入力ドキュメント: `docs/architecture/ui-task-specs.md` UI-02、`docs/architecture/cmd-task-specs.md` CMD-02、`docs/architecture/biz-task-specs.md` BIZ-02、`docs/function-design/31-biz-inventory-service.md`、`docs/function-design/44-cmd-inventory.md`、`docs/SCREEN_DESIGN.md`、`docs/UI_TECH_STACK.md` §5.3

入庫記録は、仕入れ商品が店舗に届いた時に複数商品の数量と原価をまとめて記録し、商品在庫を加算する operator-facing flow である。UI は商品選択、数量・原価入力、取引先選択、保存結果確認を担当し、在庫加算、入庫伝票・明細・在庫変動履歴・操作ログの永続化は BIZ-02 / CMD-02 に委譲する。

## 61.0 関数要求 / シグネチャ / 処理ステップの扱い

**関数要求**: UI-02 は frontend page / hooks / component 群として、入庫ヘッダと明細行を `commands.createReceiving(req)` に渡し、成功時に商品在庫系 query を無効化し、入庫記録結果と最近の入庫一覧を表示する。

**シグネチャ**: frontend の境界は `commands.createReceiving(req)`、`commands.listReceivings(page, perPage, dateFrom, dateTo)`、商品追加用の `commands.searchProducts(query)`、取引先候補用の `commands.listSuppliers()` である。React component の詳細 props は §61.2、command / DTO の詳細は §61.4 に定義する。

**処理ステップ**: 画面全体の状態遷移は §61.3、表示・操作は §61.5、エラー復旧は §61.6 に定義する。

## 61.1 設計判断

| Spec | Decision ID | 決定 | 理由 / 不採用案 |
|---|---|---|---|
| REQ-201 / UI-02 | UI-02-D1 | route は `/inventory/receiving` とし、file route は `src/routes/inventory/receiving.tsx`、画面本体は `src/features/receiving/ReceivingPage.tsx` に置く。 | 入出庫エリアの独立作業であり、商品一覧や在庫照会の query param で mode を切り替えない。将来の UI-03〜05 と route prefix をそろえる。 |
| REQ-201 / CMD-02 | UI-02-D2 | UI は generated `commands.createReceiving(req)` / `commands.listReceivings(page, perPage, dateFrom, dateTo)` のみを使う。実装 PR では既存 Rust command に `#[specta::specta]` を付け、`ReceivingCreateRequest` / `ReceivingItemInput` / `ReceivingCreateResult` / `ReceivingRecordWithSupplier` を generated binding に出す。 | `receiving_cmd` は runtime `generate_handler!` には存在するが、現状 `collect_commands!` / `bindings.ts` にはない。`typedInvoke` fallback は退役済みなので ad hoc invoke は採用しない。 |
| REQ-201 / suppliers | UI-02-D3 | 取引先候補は `commands.listSuppliers()` 由来の complete master data とする。inline 新規取引先作成は初回 UI-02 実装では扱わない。 | 取引先は任意項目だが、誤った master 追加は後から直しづらい。UI-01b と同じ候補取得方針にそろえる。 |
| REQ-201 / product add | UI-02-D4 | 商品追加欄は商品コード / JAN / 商品名を同じ入力で扱い、Enter で `commands.searchProducts` を実行する。1件なら明細へ追加、複数件なら候補リストから選ぶ、0件なら商品登録への導線を出す。 | 未登録商品の作成を入庫画面内に持ち込むと UI-01b の validation と重複する。REQ-201 の「未登録商品」は `/products/new` へ逃がす。 |
| REQ-201 / scanner | UI-02-D5 | バーコードスキャナは HID キーボードとして商品追加欄へ入力される前提にする。初回実装はグローバルスキャン検知を置かず、フォーカス中の入力欄 + Enter で追加し、追加後は商品追加欄へフォーカスを戻す。 | 20ms 間隔などのグローバル検知は入力中の誤検知やフォーカス奪取リスクがある。実店舗確認前に全画面へ広げない。 |
| REQ-201 / rows | UI-02-D6 | 同じ `product_code` を再追加した場合は既存行の数量を +1 し、重複行を増やさない。原価は既存行の値を維持し、必要なら利用者が編集する。 | 連続スキャンでは同一商品の数量増加が自然。重複明細を許すと確認負荷が上がる。原価差のある入庫は手入力で調整できる。 |
| REQ-201 / quantities | UI-02-D7 | 数量は整数 `> 0`、原価は整数 `>= 0` として保存前に frontend で止める。生地は `stock_unit='cm'` を表示し、cm 整数で入力する。 | BIZ-02 も同じ validation を持つが、operator-facing form では保存前に日本語 field error を出す。m 表示切替は横断表示方針で扱うため非 scope。 |
| REQ-201 / idempotency | UI-02-D8 | `idempotency_key` は画面で1保存試行単位に生成し、保存失敗後の同内容再試行では同じ key を再利用する。保存成功、フォームリセット、別伝票開始、または保存失敗後に伝票内容を編集して再送する場合は新しい key にする。 | 通信・内部エラー後の同内容再送で二重入庫を避ける。BIZ fingerprint は `note` を除外するため、同じ key のまま note だけ変えても保存済み伝票へ反映されない。fingerprint 対象項目を変えると conflict になるため、編集再送は新規伝票試行として扱う。 |
| REQ-201 / submit | UI-02-D9 | 保存中はヘッダ、明細、商品追加、戻る/リセット導線を disabled にし、中断可能に見せない。 | backend は単一 TX。UI だけで cancel 可能に見せると在庫反映状態を誤認させる。 |
| REQ-201 / result | UI-02-D10 | 保存成功後は record_id、登録明細数、stock_warnings、`idempotent_replay` の有無を表示し、「続けて入庫」「在庫照会へ戻る」の導線を出す。 | 店頭作業では連続入庫があり得る。保存済みの証跡は record_id と件数で確認できるようにする。 |
| REQ-201 / list | UI-02-D11 | 画面下部に最近の入庫記録を `listReceivings(1, 10, null, null)` で表示する。詳細表示・編集・削除は初回実装では扱わない。 | CMD-02 の一覧契約を UI から疎通確認でき、直近伝票の保存結果も確認しやすい。詳細/取消は業務影響が大きく別設計にする。 |
| REQ-201 / cache | UI-02-D12 | 保存成功時の invalidation は [D-052](../decision-log.md) C4 と `src/lib/invalidation-contract.ts` を正本とする。 | 入庫で変わる在庫・履歴とその consumer を table.column 導出で一貫して stale 化し、画面側の key 列挙を廃止する。 |
| REQ-201 / UI-02 | UI-02-D13 | Windows native L3 は owner 目視確認を必須にする。確認対象は navigation、取引先候補、商品検索/スキャン相当 Enter 追加、同一商品数量加算、cm 表示、validation、保存中 disable、結果表示、recent list、在庫照会/商品登録導線。 | 新規 operator-facing screen であり、連続入力・日本語商品名・フォーカス戻しは CI だけでは判断しづらい。 |

## 61.2 Component / Route 構成

```text
src/
  routes/
    inventory/
      receiving.tsx
  features/
    receiving/
      ReceivingPage.tsx
      components/
        ReceivingHeaderForm.tsx
        ReceivingProductSearch.tsx
        ReceivingItemTable.tsx
        ReceivingRecentList.tsx
        ReceivingResultPanel.tsx
      hooks/
        useReceivingForm.ts
        useReceivingOptions.ts
      lib/
        build-receiving-request.ts
        receiving-validation.ts
        receiving-row-utils.ts
        test-fixtures.ts
```

`receiving.tsx` は route と title を管理し、画面本体は `ReceivingPage` に委譲する。`ReceivingPage` は form state、queries、mutation、query invalidation、子コンポーネントへの props 配線を担当する。DTO 組み立てと validation は `lib/` の純関数へ分け、component test と unit test の両方から検証する。

## 61.3 State Model

| State | 意味 | 主な表示 | 次の action |
|---|---|---|---|
| `editing` | 入庫ヘッダ/明細編集中 | header form、商品追加欄、明細表、最近の入庫一覧 | `add_product` / `update_row` / `submit` |
| `searching_product` | 商品追加欄で検索中 | 商品追加欄 loading | `product_found` / `product_candidates` / `product_not_found` / `search_failed` |
| `submitting` | createReceiving 実行中 | form disabled、spinner + 「入庫を記録しています」 | `submit_succeeded` / `submit_failed` |
| `result` | 保存完了 | result panel、続けて入庫、在庫照会へ戻る | `reset_for_next` / navigation |
| `submit_error` | 保存失敗 | Alert + 入力保持 + 再実行 | `submit_same_request` / `edit_as_new_attempt` |

フォーム state は `receivingDate`, `supplierId`, `note`, `rows`, `idempotencyKey` を持つ。`rows` は `productCode`, `productName`, `stockUnit`, `currentStockQuantity`, `quantity`, `costPrice` を持つ UI 内部型とし、command payload には `product_code`, `quantity`, `cost_price` だけを送る。`submit_error` 後に同内容を再送する場合は `idempotencyKey` を保持し、入力を編集して再送する場合は新しい `idempotencyKey` を採番する。

## 61.4 Command / DTO Contract

UI-02 実装 PR では以下を generated binding に出す。

| Command / Type | Existing backend | UI-02 usage |
|---|---|---|
| `commands.createReceiving(req)` | Rust command は既存、generated 未対応 | 入庫ヘッダ + 明細を保存 |
| `commands.listReceivings(page, perPage, dateFrom, dateTo)` | Rust command は既存、generated 未対応 | 最近の入庫記録を表示 |
| `ReceivingCreateRequest` | BIZ type は既存、`specta::Type` 未対応 | create payload |
| `ReceivingItemInput` | BIZ type は既存、`specta::Type` 未対応 | 明細 payload |
| `ReceivingCreateResult` | BIZ type は既存、`specta::Type` 未対応 | 保存結果 |
| `ReceivingRecordWithSupplier` | DB type は既存、`serde::Serialize` のみ | 最近の入庫一覧 |

`createReceiving` payload:

```text
{
  idempotency_key: string,
  supplier_id: number | null,
  receiving_date: "YYYY-MM-DD",
  note: string | null,
  items: [{ product_code: string, quantity: number, cost_price: number }]
}
```

`listReceivings` は `perPage=10` を初期値とし、CMD/BIZ の上限100を UI から超えない。

## 61.5 表示 / 操作

- PageHeader title は `入庫記録`、subtitle は仕入れ商品の到着時に在庫へ反映する作業であることを短く示す。
- ヘッダは `入庫日`（既定は今日）、`取引先`（任意）、`備考`（任意）を置く。取引先取得失敗時は警告を出し、取引先未指定の保存は許可する。
- 商品追加欄は `商品コード・JAN・商品名で追加` とし、Enter で検索する。候補が複数ある場合は小さな候補リストで商品名、商品コード、部門、現在庫を見せる。
- 商品が見つからない場合は `商品登録へ` 導線を出す。現在の入庫フォームを自動保存しないため、別画面へ移動する前に未保存であることを日本語で示す。
- 明細表は商品名、商品コード、現在庫、入庫数量、原価、単位、行削除を表示する。生地は `cm` 単位を主表示にする。
- 明細が 0 件の場合、保存ボタンは disabled にし、理由を「商品が追加されていません」と表示する。
- 保存ボタンは `入庫を記録`。保存成功後は result panel へ移り、フォーム本文は操作不可にする。保存結果や保存系エラーの Alert はページ先頭側に出るため、保存成功または command 失敗時はページ先頭へスクロールする。
- 最近の入庫一覧は日付、取引先、備考、記録日時を表示する。詳細編集や取消は出さない。

## 61.6 Error / Recovery

- 商品検索失敗: 商品追加欄の近くに Alert を出し、既存明細は保持する。
- 商品 0 件: `商品が見つかりません` と表示し、`商品登録へ` 導線を出す。
- 取引先取得失敗: 警告を出し、取引先未指定の保存は許可する。
- 日付不正、明細 0 件、数量 0 以下、原価負数: command 呼び出し前に日本語 field error を出す。
- frontend validation error: エラー箇所が明細表や入力欄の近くに出るため、ページ先頭へはスクロールしない。
- BIZ validation error: form state を保持する。入力を修正して再送する場合は新しい `idempotencyKey` を採番し、同じ key で異なる fingerprint を送らない。
- internal error: 入力と `idempotencyKey` を保持し、同内容のまま同じ伝票として再試行できるようにする。入力を編集して再送する場合は新しい `idempotencyKey` を採番する。
- idempotent replay: result panel に「同じ内容の再送として処理済み」と表示し、二重登録ではないことを示す。

## 61.7 Cache / Navigation

- 保存成功時は D-052-C4 の SSOT helper を適用する。具体的な query key 集合は `src/lib/invalidation-contract.ts` だけに置く。
- `navigation.ts` の UI-02 は `to: "/inventory/receiving"`, `status: "active"` に切り替える。
- 在庫照会の詳細カードから入庫へ遷移する場合、将来 `?productCode=...` で初期商品追加する余地を残す。ただし初回実装では query 初期追加は非 scope とし、route だけ active にする。

## 61.8 Non-scope / Follow-up

- 入庫作成画面内での入庫伝票詳細表示、編集、取消。履歴調査用の詳細 route は `65-inventory-record-traceability.md` §65.10 の横展開 slice で扱う。
- 入庫明細の CSV import。
- inline 商品登録 / inline 取引先登録。
- グローバル barcode scan detection。
- cm / m 表示切替。
- 仕入先別原価履歴、発注書連携、レシート/納品書画像添付。
- 入庫後の PLU 書出し誘導。

## 61.9 Test Focus

- UI-02-D1: `/inventory/receiving` route で page title と navigation active が一致する。
- UI-02-D2: `createReceiving` / `listReceivings` が generated binding に存在し、ad hoc invoke を使わない。
- UI-02-D3: `listSuppliers` 失敗時も取引先未指定保存が可能。
- UI-02-D4/D5: 商品追加欄 Enter で検索し、1件なら行追加、複数件なら候補選択、0件なら商品登録導線を出す。
- UI-02-D6: 同一 `product_code` の再追加で数量が +1 され、重複行を増やさない。
- UI-02-D7: 数量/原価 validation と `cm` 単位表示。
- UI-02-D8: 同内容 retry 時に `idempotency_key` を再利用し、成功/リセット/編集再送後は新規 key になる。
- UI-02-D9: submitting 中は戻る/リセット/入力/商品追加が disabled になる。
- UI-02-D10: result で record_id、明細数、warning、idempotent replay が読め、保存成功時にページ先頭へスクロールする。
- UI-02-D11: 最近の入庫一覧を取得し、空/取得失敗/成功を表示できる。
- UI-02-D12: 保存成功時の実呼出し集合が D-052-C4 の独立 test oracle と完全一致する。
- UI-02-D13: Windows native L3 で連続入力、フォーカス戻し、日本語表示、保存結果を確認する。

## 61.10 変更履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-06-28 | Save result visibility follow-up | 保存成功または command 失敗時はページ先頭へスクロールし、result panel / Alert が画面内に入るようにした。frontend validation は近傍表示のためスクロールしない。 |
| 2026-06-25 | UI-02 Design Phase | route、generated command 方針、商品追加/スキャン前提、明細 validation、冪等キー、query invalidation、recent list、Windows native L3 を整理。 |
