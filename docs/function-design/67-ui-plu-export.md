# UI-08: PLU書出し

> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **対応REQ**: REQ-402
> **Design Phase**: 2026-07-01 UI-08 PLU design readiness / 2026-07-03 D-028 JANなし商品のPLU対象扱い（三分バケット・要修正一覧・Full-only 投入ガード。実装は後続 R3 PR）

## 67.1 目的

UI-08 は、商品マスタから CASIO PCツール用 PLUタブ区切りテキストを作成し、利用者が保存したファイルを PCツール / SDカード / レジへ手動投入できるようにする operator-facing flow である。

アプリが保証するのは「対象商品からCP932 PLUファイルを生成し、利用者が保存済みとして扱う対象を記録する」までである。CV17の受理、SDカード書出し、SR-S4000への反映は外部手順であり、アプリから自動確認できない。

## 67.2 関数要求

**関数要求**: UI-08は、PLUファイルの作成、native save dialogでの保存、保存済み確認、差分対象プレビューを1画面で扱う。ファイル生成時点ではDBを更新せず、利用者が保存済み扱いを明示した後にだけ `confirm_plu_export_saved` を呼ぶ。

## 67.3 シグネチャ

```
function PluExportPage(): JSX.Element
```

主要入力はURL route `/products/plu-export` とコマンド結果である。search paramsでmodeを永続化せず、画面内stateでDiff/Fullを切り替える。

## 67.4 処理ステップ

1. `commands.listPluDirty()` で差分対象を取得し、件数と一覧を表示する
2. 利用者がDiffまたはFullを選ぶ
3. `commands.preparePluExport({ mode })` を呼び、`bytes_base64` と `target_product_codes` と `excluded`（要修正一覧）を受け取る。`excluded` が空でなければ、生成結果と併せて理由付き一覧を表示し、商品マスタ修正へ誘導する（生成自体はブロックされない）
4. native save dialogで保存先を選び、CP932 PLUファイルバイト列を書き込む
5. 保存キャンセルまたは保存失敗では `confirm_plu_export_saved` を呼ばず、未反映を残す
6. 保存成功後は `target_product_codes`、保存先、件数、文字コード、保存日時を復帰用 `localStorage` に保存する。PLUファイル本文 (`bytes_base64`) は保存しない
7. 画面再表示時に保存済み未確認の復帰状態があれば、ページ上部に `保存済みで未確認のPLU書出しがあります` を表示し、同じ exact product_code set で未反映解除できる導線を出す
8. 利用者が保存済み扱いを確認した場合だけ `commands.confirmPluExportSaved({ product_codes })` を呼ぶ。復帰状態がある場合は復帰状態の `targetProductCodes` を使い、現在の差分一覧から再計算しない
9. confirm成功後に D-052-C14 の SSOT helper を適用し、復帰状態を削除して未反映解除結果を表示する

## 67.5 Design Decisions

| Root | Decision ID | Decision | Why |
|---|---|---|---|
| REQ-402 / D-027 | UI-08-D1 | PLUファイル生成とPLU未反映解除を分離する。`prepare_plu_export` はDBを変えず、`confirm_plu_export_saved` だけが対象商品の `plu_dirty=false` / `plu_exported_at=now` を更新する。 | 生成成功だけでは外部投入成功を意味しない。CV17取込み失敗時も `plu_dirty` が残っているため、Full再書出しで同じ内容を含めて回復できる（UI-08-D9）。 |
| REQ-402 / adapter boundary | UI-08-D2 | UI文言では「アプリで確認できるのはPLUファイル保存まで」と明示し、レジ反映済みとは書かない。 | D-011/D-023。レジ側APIがなく、誤って反映確認済みに見せると運用リスクになる。 |
| REQ-402 / CV17 1.1.1 | UI-08-D3 | UI-08 は CV17 1.1.1 `スキャニングPLU(商品)` adapter profile の `.txt` タブ区切りテキストを保存する。ヘッダは11列、memory No. は通常PLU使用数 + 1 始まり、スキャニングコードは13桁JAN必須とし、product_code fallbackは禁止する。工場出荷時配分（SR-S4000 取説確認済み: PLU総枠 5,000 = 通常 216 + スキャニング 4,784）により217始まり。 | 2026-07-03 field gate で、同形状の `.txt` は `CV17 TXT import -> PC tool SD settings write -> SR-S4000 設定読み -> barcode/register behavior confirmation` の流れで反映できることを確認した。CV17 import成功だけでは完了扱いにせず、実際のgateはレジ側バーコード確認までとする。 |
| REQ-402 / recovery | UI-08-D4 | 保存キャンセル・保存失敗では `plu_dirty` を残し、再保存または再生成を案内する。CV17取込み失敗以降の回復は、confirm前後を問わず保存済みFullファイルの再投入またはFull再書出しで行う（Diffファイルは投入しない = UI-08-D9）。 | `plu_dirty` は未反映差分の把握に使う。confirm後はapp-side exported stateとして扱うためDiffから外れる。CV17 import はメモリNo. キーの部分更新のため、投入用ファイルは常にFullとする。 |
| REQ-402 / safety | UI-08-D5 | Full書出しでは既存PLUバックアップ確認を画面内 Alert として出す。実バックアップファイルはrepoに入れない。SR-S4000 のPLU総枠5000は通常PLUとスキャニングPLUで共有される（取説確認済みの工場出荷時配分: 通常 216 + スキャニング 4,784）ため、書出し上限は 4,784件とする。 | Full投入は外部レジ側の既存PLUを広く変える可能性がある。アプリ内で破壊的操作はしないが、操作手順上の注意が必要。 |
| REQ-402 / D-028 | UI-08-D8 | PLU書出し対象は三分バケットで表示する。対象外（`plu_target=0`）は差分一覧・書出しに現れない。要修正（`plu_target=1` かつ JAN不備・同一JAN価格不一致）は prepare 結果の `excluded` として理由付き一覧で表示し、商品マスタ修正へ誘導する。生成はブロックしない。 | JANなし商品が1件あるだけでPLU書出し全体が止まる構造（Full恒久失敗・Diff恒久残留・通知汚染）を解消する。decision-log D-028。 |
| REQ-402 / D-028 | UI-08-D9 | CV17 へ投入してよいのは Full 書出しファイルのみ。Diff 書出しはアプリ内の未反映確認・点検用途に限定し、UI の注意文言と操作手順に明記する。CV17取込み失敗以降の回復は保存済みFull再投入またはFull再書出しで行う。 | CV17 の import はメモリNo. キーの部分更新（`ECRCV17.pdf` p.71-73）であり、現行の書出しは毎回 217 始まりで再採番するため、Diff ファイルを import すると既存スロットの別商品を上書きする。スロット永続割当の恒久設計（Plans.md backlog）までの暫定ガード。 |
| REQ-402 / status visibility | UI-08-D6 | PLUファイル保存、保存失敗、キャンセル、未反映解除結果はページ上部の注意文直下に表示し、状態遷移後はページ先頭へスクロールする。ページ全体は既存業務画面と同じ内側余白を持つ。confirm失敗は成功色の保存済み表示に混ぜず、失敗タイトルと再試行導線を持つ別 Alert にする。 | 保存後の `この書出しを未反映から外す` は次操作の要であり、下部に出すと利用者が見落とす。confirm失敗が成功表示に混ざると未反映解除に失敗した事実を見落とす。UI-02/03/04/05 の保存結果 visibility follow-up と DSR-01 の共通レイアウト継承に合わせる。 |
| REQ-402 / D-028 L3 | UI-08-D10 | 注意情報はページ上部圏に集約する: 要修正一覧（excluded）は状態表示 section の直後・コンテンツ 2 カラムより前に置き、見出しに warning アイコン + 説明 1 行を添える。CV17 回復手順文言は保存完了の成功 Alert に埋めず、warning トーンの独立 Alert（タイトル `PCツールに取り込めなかった場合の回復手順`）とし、restored pending Alert 内にも同文を強調表示する。 | PR #124 L3 の owner 指摘（要修正一覧が最下部でスクロールしないと見えない / 事故防止文言が埋もれている）。安全側の案内は視線が最初に通る場所 + 強調（色のみ不可）で初めて効く。memory feedback-operator-ui-critical-notes-placement、DSR-03（データ安全系 = 上部 Alert 帯）整合。 |
| REQ-402 / recovery | UI-08-D7 | PLUファイル保存後、未反映解除前に画面遷移・アプリ終了・PC再起動が起きても復帰できるよう、保存済み未確認状態を軽量 `localStorage` に残す。保存するのは `version`、mode、保存先、保存日時、推奨ファイル名、件数、文字コード、exact product_code set、上限警告だけで、ファイル本文や実ファイル内容は保存しない。confirm成功または `破棄して再書出し` で削除する。 | PCツール、SDカード、レジ操作はアプリ外の時間が長く、画面を開きっぱなしにする前提は実運用に合わない。履歴/監査ではないためDBテーブルは作らず、未完了作業の復帰に必要な最小状態だけを保持する。 |

## 67.6 Route / Components

想定routeは `/products/plu-export`。商品管理エリアの独立画面として扱い、商品一覧のsearch paramsでmode切替しない。

主要component:

- `PluExportPage`: page orchestration、query/mutation、save dialog、状態分岐
- `PluDirtySummary`: 差分件数、最終書出し目安、0件空状態
- `PluExportModePanel`: Diff / Full の二択、件数、工場出荷時配分の4,784件上限エラー、バックアップ注意
- `PluDirtyProductTable`: 差分対象商品一覧（`plu_target=1` の商品のみが対象。対象外商品はここに現れない）。商品コード、JANコード、商品名、売価、在庫を表示し、JAN未登録は `未登録` と出す
- `PluExcludedTable`: prepare 結果の要修正一覧（D-028）。商品コードと理由（JAN未登録 / 13桁でない / チェックディジット不正 / 同一JAN内の価格・税率不一致）を表示し、商品マスタ編集への導線を出す
- `PluExportResultPanel`: ページ上部の状態表示。保存結果、confirm導線、外部手順、未反映解除結果を注意文直下に出す

## 67.7 State Machine

| State | Meaning | Allowed actions |
|---|---|---|
| `idle` | 差分一覧を表示中 | mode変更、prepare開始 |
| `preparing` | `prepare_plu_export` 実行中 | 操作disabled |
| `save_dialog` | 保存先選択・保存処理中 | 操作disabled |
| `saved` | PLUファイル保存済み、まだ未反映解除していない | 再保存、Diff再生成、書出し済み確認 |
| `restored_pending` | 画面再表示時に保存済み未確認状態を復元した | 書出し済み確認、破棄して再書出し |
| `confirming_exported` | `confirm_plu_export_saved` 実行中 | 操作disabled |
| `confirmed` | app-side exported state更新済み | 差分一覧再取得、商品一覧へ戻る、PCツール手順確認 |
| `error` | prepare/save/confirm 失敗 | 再試行、戻る |

保存キャンセルは `idle` または `saved` に戻す。保存キャンセルと保存失敗は `confirm_plu_export_saved` を呼ばない。

## 67.8 Command Contract

| Command | Input | Output | UI handling |
|---|---|---|---|
| `commands.listPluDirty()` | none | `ProductResponse[]` | 差分対象一覧（`plu_target=1` かつ `plu_dirty=1`、D-028）。0件は空状態でエラーではない |
| `commands.preparePluExport({ mode })` | `"diff"` / `"full"` | `bytes_base64`, `suggested_filename`, `content_type`, `encoding`, `count`, `target_product_codes`, `excluded`, `over_limit_warning` | CV17 1.1.1用 `.txt` 保存用。JAN不備・同一JAN価格不一致は `excluded`（要修正一覧）で返り生成はブロックしない。4,784件超過と生成行0件はエラー。`target_product_codes` は dedup 群の全メンバーを含むため `count` と長さが一致しないことがある。DB状態は変わらない |
| `commands.confirmPluExportSaved({ product_codes })` | prepare結果の `target_product_codes` | `updated_count`, `confirmed_at` | 保存済み確認。成功後は D-052-C14 の SSOT helper を適用 |

`target_product_codes` はprepare時のexact setである。confirm時にUIが現在の差分一覧から再計算しない。

### 67.8.1 Browser Recovery Contract

保存済み未確認状態は `localStorage` key `inventory:plu-export:pending:v1` に置く。これは履歴・監査ではなく、画面離脱やアプリ再起動後に同じ保存済みPLUファイルを未反映解除するための復帰状態である。

```json
{
  "version": 1,
  "mode": "diff",
  "savedAt": "2026-07-01T12:00:00.000Z",
  "savedPath": "PLU_20260701.txt",
  "suggestedFilename": "PLU_20260701.txt",
  "count": 1,
  "encoding": "CP932",
  "targetProductCodes": ["BT0001"],
  "overLimitWarning": false
}
```

- 保存しないもの: `bytes_base64`、PLUファイル本文、JAN、商品名、価格、実PLUファイル、PCツール/SDカード/レジ側の結果
- 読込み時にJSON不正、schema不一致、対象コード空なら削除して通常の `idle` として扱う
- 復帰状態の confirm は `targetProductCodes` を使い、画面上の現在の差分一覧や再prepare結果から対象を再計算しない
- confirm成功時と `破棄して再書出し` 実行時に削除する。confirm失敗時は保持し、再試行できるようにする

## 67.9 UI / Wording

- ページタイトル: `PLU書出し`
- Diff mode label: `差分を書き出す`
- Full mode label: `全件を書き出す`
- confirm button: `この書出しを未反映から外す`
- result note: `アプリで確認できるのはPLUファイル保存までです。PCツールへの取込み、SDカード書出し、レジ読込みは手動で確認してください。`
- failure note before confirm: `PCツールに取り込めなかった場合は、未反映を外さずに全件を書き出し直して取り込んでください。`（UI-08-D10: 保存完了時は成功 Alert に埋めず、タイトル `PCツールに取り込めなかった場合の回復手順` の warning Alert として独立表示。restored pending Alert 内にも同文を強調表示する）
- excluded list lead: `これらの商品は今回のPLUファイルに含めていません。商品マスタでJANコード・売価・税率を修正すると、次回の書出しから含まれます。`（UI-08-D10 L3 P3: 修正対象を除外理由の全種（JAN不備 / 同一JANの売価・税率不一致）と一致させ、後半の行動文を強調表示して muted 一色の見落としを防ぐ）
- format validation note: `JANコードが未登録または不正な商品は、スキャニングPLU書出しに含められません。商品マスタで13桁JANを確認してください。`
- excluded list title: `書出しに含めなかった商品（要修正）`
- excluded reasons: `JAN未登録` / `JANが13桁ではありません` / `JANのチェックディジットが不正です` / `同じJANの商品で売価または税率が一致していません`
- full-only import note: `PCツール（CV17）に取り込んでよいのは全件書出しのファイルだけです。差分書出しのファイルは取り込まないでください。`
- restored pending title: `保存済みで未確認のPLU書出しがあります`
- discard button: `破棄して再書出し`

保存、保存失敗、キャンセル、未反映解除結果はページ上部の注意文直下に出す。保存後確認ボタンを差分一覧や書出し設定の下に置かない。保存後は `この書出しを未反映から外す` を主動線とし、再書出しボタンは副導線として表示する。要修正一覧（excluded）は状態表示の直後・コンテンツ 2 カラムより前に置き、見出しに warning アイコンを添える（UI-08-D10。色のみで符号化しない）。

状態は色だけで示さない。`未反映`, `保存済み`, `未反映から外しました`, `レジ反映は未確認` の日本語ラベルを主情報にする。

## 67.10 Query Invalidation

- prepare成功: invalidateしない。`plu_dirty` は変わらない
- save cancel / save failure: invalidateしない
- confirm成功: [D-052](../decision-log.md) C14 と `src/lib/invalidation-contract.ts` を正本として SSOT helper を適用する。具体的な query key 集合と除外判断は本書へ複製しない。

## 67.11 Error / Recovery

- Diff対象0件: prepareを呼ばず、空状態で「差分はありません」を表示する。Full書出しは選べる
- prepare validation error: Alertで表示し、差分一覧へ戻れる
- 4,784件超過: prepareを失敗させ、スキャニングPLU上限（工場出荷時配分 4,784件）を超えていることを表示する
- JANなし / 13桁以外 / チェックディジット不正 / 同一JAN価格不一致: prepareは失敗せず、該当商品を `excluded`（要修正一覧）として理由付きで表示する。生成行が0件（全件要修正）の場合のみ prepare が失敗し、対象商品コードと「商品マスタで13桁JANを確認してください」を表示する
- save cancel: dirtyは残る。トーストだけで済ませず、画面上に再保存導線を残す
- save failure: Alert + 再保存 / 再生成
- confirm failure: destructive Alert + `もう一度未反映から外す`。confirmが失敗しても保存済みPLUファイル自体は残るが、`PLUファイルを保存しました` の成功 Alert には混ぜない
- restored pending: 保存後に画面遷移、アプリ終了、PC再起動があっても、次回 `/products/plu-export` 表示時にページ上部へ復帰Alertを出す。利用者は `この書出しを未反映から外す` または `破棄して再書出し` を選べる
- invalid recovery state: `localStorage` のJSON不正やschema不一致は削除し、エラー表示ではなく通常の画面に戻す
- save cancel / save failure / save success / confirm success / confirm failure はページ先頭へスクロールし、上部の状態表示を利用者がすぐ読めるようにする

## 67.12 Windows Native L3 / Manual Gate

UI-08 implementation PRでは Windows native L3 と外部手順確認を必須にする。

- navigation: sidebarから `/products/plu-export` へ入れる
- Diff 0件 / Diffあり / Full の表示差
- native save dialogで推奨ファイル名 `PLU_{YYYYMMDD}.txt` が出る
- 保存キャンセル時に未反映が消えない
- 保存後、confirm前ならDiff再書出しできる（未反映確認用。CV17へ投入するのは全件ファイルのみ）
- 保存後確認ボタンと保存失敗時の再保存導線がページ上部に見える
- 保存後、画面遷移またはアプリ再起動相当の再表示でも `保存済みで未確認のPLU書出しがあります` がページ上部に出て、保存先・件数・文字コードを確認できる
- 復帰Alertから `この書出しを未反映から外す` と `破棄して再書出し` の両方を選べる
- confirm後に未反映件数が減り、ホーム通知も更新される
- 画面文言が「レジ反映済み」と誤読されない
- CV17 1.1.1へ保存済み `.txt` を投入し、受理可否、列差異、エラー文言を匿名化して記録する
- CV17 import が通っても、SD-card書出し / SR-S4000設定読込 / register scan-call が通るまで外部manual gateは未通過とする

## 67.13 Non-scope

- レジ反映の自動確認
- PLU export history table
- PLUファイル本文のbrowser storage保存
- Z004商品別売上の再評価
- SALES daily report implementation
- 実PLU/実CSV/レジバックアップファイルのrepo保存
