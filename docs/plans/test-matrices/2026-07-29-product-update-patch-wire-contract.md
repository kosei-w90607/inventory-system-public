# Test Design Matrix: 商品更新patch wire契約（順13 / P4b-1、wave 3 lane 2）

## Risk

Risk: R3

## Contracts Under Test

- C1: 通常fieldはomitted/null=no update、value=set
- C2: `supplier_id` / `maker_code`はomitted=no update、null=clear、value=set
- C3: generated `_Deserialize`の全propertyがoptional
- C4: builder/pageはgenerated型へ直接接続し、`Partial`/castで迂回しない
- C5: changed-only payloadとread-only不送信を維持
- C6: command/BIZ/DB/UIの既存挙動は不変

## Failure Modes

- F1: omitted fieldがrequired nullableとして生成される
- F2: nested nullがomittedと同じ`None`になりclearを失う
- F3: unchanged fieldをnullで送って省略意味を隠す
- F4: `Partial`/cast再導入でgenerated driftがtypecheckを通る
- F5: DTO metadata変更がupdate副作用やcommand shapeへ波及する

## Test Matrix

| Contract | Failure Mode | Test Type | Test / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1/F3 | Rust serde + frontend unit | `PRODUCT-PATCH-D1 ordinary fields` / builder unchanged+value | omitted/null/valueの写像またはchanged-onlyが崩れる | X1: struct serde default除去、X2: unchanged通常fieldをnull送信 |
| C2 | F2 | Rust serde + frontend unit | supplier/maker omitted/null/value table | custom deserializerまたはclear payloadが崩れる | X3: custom deserializer除去、X4: clearをomitへ変更 |
| C3 | F1 | generated contract + typecheck | `_Deserialize` optional property assertions | 1fieldでもrequiredへ戻る | X1、X5: generated normal field 1件をrequired化 |
| C4 | F4 | type/source contract | builder return type / forbidden live patterns | Partial aliasまたはsave castが戻る | X6: Partial alias再導入、X7: cast再導入 |
| C5 | F3 | frontend exact payload | existing + strengthened `buildUpdateProductRequest` | read-only送信、unchanged送信、clear/value混同 | X2/X4、existing regression |
| C6 | F5 | regression/full | product BIZ tests、ProductFormPage tests、full gate | command/error/update副作用/UIが変わる | existing suite |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| edit patch | original=unchanged、payload `{}` | save中は既存どおり | changed fieldだけ送信 | 既存query flow | 既存どおり | 再取得値をoriginal化 | 再起動後再取得 | error時入力保持 | 同じbuilderで再送 | builder/page tests |
| clearable field | original value | — | nullでclear | — | cleared value | omittedならno update | DB値再取得 | command error不変 | 再送可能 | serde + payload tests |

本変更はlifecycleを変えない。既存pending/success/failure/retryを回帰し、patch境界だけを強化する。

## Adjacent Pattern Audit

| Source pattern / contract | Sites inspected | Ported sites | Exclusions | Evidence |
|---|---|---|---|---|
| `ProductUpdateRequest` consumer | Rust DTO/CMD、bindings、builder/page/tests | DTO metadata、builder/page | BIZ update body/CMD sourceは挙動不変 | rg + diff |
| nested nullable patch | supplier/makerの2field | 両field | 他Optionはclear不可 | serde table |
| generated command input | product commands/bindings | updateProductだけ | 順14 CmdError enum | typecheck + binding diff |

## Negative Paths

- missing input: empty objectは全field no update
- invalid input: validation/error mappingは既存tests
- duplicate/unknown reference: product not found/duplicateは不変
- dependency missing: generator/build failureで停止
- permission/write failure: bindings生成失敗はcommitしない
- dry-run side effect: not applicable

## Boundary Checks

- null/default: 通常fieldとnested fieldを別tableで検査
- empty/non-empty: `{}`、単一value、単一clear
- wire/internal: JSON -> serde nested Option -> BIZ
- producer/consumer: builder -> generated command -> Rust DTO
- cross-language parse: generated optional marker + Rust serde testを両側で検査
- numeric precision/range: i64/JS safe integerの既存制約不変、本是正外

## Compatibility Checks

- old input: 全field required nullable payloadも受理
- new input: changed fieldだけのpartial JSONを型安全に受理
- output/order: responseとproperty orderは契約変更なし
- optional behavior: omittedとnullの写像をfield群別に固定

## Data Safety Checks

- synthetic JSON/mock productのみ
- generated outputは`src/lib/bindings.ts`だけ
- secrets/local DB/実価格・原価/backup/log非接触
- mutationはclean treeで注入し毎回復元

## Main Wiring / Integration Checks

- builder戻り値がcastなしで`commands.updateProduct`へ到達
- Rust metadataからgeneratorを通してbindingsへ到達
- command signature/responseとBIZ呼出しは既存pathで回帰

## Mutation-style Adequacy Questions

- struct-level serde default除去でbindingsを再生成したとき、required化をtype/source contractがredにするか
- supplier/makerのcustom deserializer除去でnull=clear testがredになるか
- unchanged通常fieldをnull送信、clear fieldをomit送信する各mutationをexact payloadが個別にkillするか
- `Partial<ProductUpdateRequest_Deserialize>`またはsave castを個別再導入してguardがredになるか
- source-doc期待値をproduction type/builderから導出せず、9fieldと三状態を独立列挙しているか
- baseline全量mutation後のoracle-only修正は変更familyの代表mutationだけを再測定し、未変更familyの全量再実行を始めないか

## Residual Test Gaps

- TypeScriptはRust `i64`全域を安全に表せないが、本変更は数値rangeを変えないため別課題。
- specta出力format自体の将来変更はgenerator/version更新時に再設計する。本PRはdependencyを更新しない。
