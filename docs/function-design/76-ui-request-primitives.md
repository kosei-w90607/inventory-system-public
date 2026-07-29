# 76. UI request builder shared primitives

> 対応仕様: REQ-201 / REQ-202 / REQ-203 / REQ-204
>
> 入力ドキュメント: `61-ui-receiving.md`、`62-ui-manual-sale.md`、`63-ui-return-exchange.md`、`64-ui-disposal.md`、`docs/research/audit-2026-07/findings/p1-component-reuse.md` P1-4

入庫・返品交換・手動販売・廃棄の request builder は業務固有の DTO 組立と validation 文言を各 feature に残し、domain 非依存の idempotency key、local calendar date、strict safe integer parser だけを `src/lib/request-helpers.ts` が所有する。画面、wire、payload、retry / key rotation lifecycle は変更しない。

## 76.1 関数要求 / シグネチャ / 処理ステップ（UI-REQUEST-D1）

**関数要求**: 4 request builderに重複するdomain非依存primitiveを1 ownerへ集約し、feature固有wrapperとDTO組立の外部挙動を維持する。

**シグネチャ**:

`src/lib/request-helpers.ts` は次の3関数の唯一の implementation owner とする。

```ts
createPrefixedIdempotencyKey(prefix: string): string
getLocalDateString(date?: Date): string
parseRequiredSafeInteger(value: string, min: number): number | null
```

**処理ステップ**:

- `createPrefixedIdempotencyKey`: `crypto.randomUUID()` が利用可能なら `${prefix}-${uuid}`。利用不能時は `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`。
- `getLocalDateString`: `getFullYear()` / `getMonth()` / `getDate()` の local calendar getter だけを使い、月日を2桁にして `YYYY-MM-DD` を返す。UTC getterは禁止する。
- `parseRequiredSafeInteger`: trim後のASCII digitsだけを受理し、`Number.isSafeInteger`かつinclusive `>= min`ならnumber、それ以外は`null`。

## 76.2 Feature wrapper compatibility

4 feature moduleは既存の公開名を維持し、prefix / minだけをshared helperへ渡す。`getLocalDateString`も各moduleからnamed export可能なままにする。

| Feature module | Idempotency wrapper | Exact prefix | Integer boundaries |
|---|---|---|---|
| receiving | `createReceivingIdempotencyKey` | `receiving` | quantity min 1 / cost_price min 0 |
| return-exchange | `createReturnExchangeIdempotencyKey` | `return` | quantity min 1 |
| manual-sale | `createManualSaleIdempotencyKey` | `manual-sale` | quantity min 1 / amount min 0 |
| disposal | `createDisposalIdempotencyKey` | `disposal` | quantity min 1 / cost_price min 0 |

DTO field、null normalization、signature、validation文言、confirmation token、receipt path、Page側のkey保持/rotationは61〜64の各正本を維持する。

## 76.3 エラーハンドリング

shared helperは例外を新設しない。integer不正は`null`でfeature builderへ返し、各featureは61〜64の既存日本語validation文言を維持する。UUID APIが利用不能な場合だけ既存fallbackを使う。Dateやnumberの不正を自動補正せず、payload生成・command error・retryの扱いはfeature側の既存契約に委譲する。

## 76.4 Test contract

- shared helper testはUUID/fallback、local getter、ASCII grammar、safe integer、min境界を直接検証する。
- local date testはlocal getterとUTC getterが必ず異なるstubを使い、実行hostのtimezoneに依存させない。
- 4 wrapperのexact prefix、各moduleの`getLocalDateString` named export、各builderのmin境界をconsumer-level testで直接検証する。
- source ownership guardは4 request fileに`randomUUID`、calendar getter、`Number.isSafeInteger`のlocal bodyが戻った場合に失敗する。
- 新規helper test内のREQ-201〜204 tokenは各1 occurrenceだけとし、traceability generatorの件数を決定的にする。

## 76.5 Non-scope

- feature固有のDTO組立、row normalization、validation文言の共有化
- Page、route、CMD / BIZ / DB、wire、screen、key lifecycleの変更
- 他featureのdate / integer / UUID helperへの横展開

## 76.6 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-29 | 監査順21 P1-4の共有owner、API、wrapper互換、portable test contractを正本化 |
