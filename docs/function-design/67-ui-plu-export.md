# UI-08: PLU書出し

> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **対応REQ**: REQ-402
> **Design Phase**: 2026-08-18 D-072 / REQ-907 PLU slot 永続割当・Z004 占有読込み・段階導入へ更新（SPEC-PLS-D2、D5、D7。実装は後続 R3 PR）

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

1. `commands.listPluDirty()` で未反映商品を取得し、`getPluSlotSummary` の `release_pending_count` と合算して Diff 対象件数を表示する。解除待ちは商品一覧と別に説明文を表示する
2. 利用者がDiffまたはFullを選ぶ
3. `getPluSlotSummary` を読み、snapshot 未読込みなら共通 FilePicker（D-054）で Z004 を選ぶ「レジ登録状況を読み込む」step を先に表示する。`importPluRegisterSnapshot({ fileBytes })` 成功後は D-052-C17 の SSOT helper を適用し、最終読込み日時と占有要約を above the fold に表示する
4. `commands.preparePluExport({ mode })` を呼び、`bytes_base64`、memory No. 付き prepared rows、`target_product_codes`、`excluded`（要修正一覧）を受け取る。成功後は slot 状態が変わり得るため D-052-C18 の SSOT helper を適用する。`excluded` が空でなければ理由付き一覧を表示し、商品マスタ修正へ誘導する
5. native save dialogで保存先を選び、CP932 PLUファイルバイト列を書き込む
6. 保存キャンセルまたは保存失敗では `confirm_plu_export_saved` を呼ばず、未反映を残す
7. 保存成功後は `target_product_codes`、保存先、件数、文字コード、保存日時を復帰用 `localStorage` に保存する。PLUファイル本文 (`bytes_base64`) は保存しない
8. 画面再表示時に保存済み未確認の復帰状態があれば、ページ上部に `保存済みで未確認のPLU書出しがあります` を表示し、同じ exact product_code set で未反映解除できる導線を出す
9. 利用者が保存済み扱いを確認した場合だけ `commands.confirmPluExportSaved({ product_codes, prepared_rows })` を呼ぶ。復帰状態がある場合は復帰状態の `targetProductCodes` / `preparedRows` を使い、現在の差分一覧から再計算しない
10. confirm成功後に D-052-C14 の SSOT helper を適用し、復帰状態を削除して未反映解除結果を表示する

## 67.5 Design Decisions

| Root | Decision ID | Decision | Why |
|---|---|---|---|
| REQ-402 / D-072 | UI-08-D1 | PLUファイル生成とPLU未反映解除を分離する。`prepare_plu_export` は slot 予約を永続化するが商品を反映済みにせず、`confirm_plu_export_saved` が reserved→active / release_pending→free と `plu_dirty=false` を同時確定する。 | 生成成功だけでは外部投入成功を意味しない一方、再 prepare でも同じ memory No. を使う必要がある。 |
| REQ-402 / adapter boundary | UI-08-D2 | UI文言では「アプリで確認できるのはPLUファイル保存まで」と明示し、レジ反映済みとは書かない。 | D-011/D-023。レジ側APIがなく、誤って反映確認済みに見せると運用リスクになる。 |
| REQ-402 / CV17 1.1.1 | UI-08-D3 | UI-08 は CV17 1.1.1 `スキャニングPLU(商品)` adapter profile の `.txt` タブ区切りテキストを保存する。ヘッダは11列、memory No. は通常PLU使用数 + 1 始まり、スキャニングコードは13桁JAN必須とし、product_code fallbackは禁止する。工場出荷時配分（SR-S4000 取説確認済み: PLU総枠 5,000 = 通常 216 + スキャニング 4,784）により217始まり。 | 2026-07-03 field gate で、同形状の `.txt` は `CV17 TXT import -> PC tool SD settings write -> SR-S4000 設定読み -> barcode/register behavior confirmation` の流れで反映できることを確認した。CV17 import成功だけでは完了扱いにせず、実際のgateはレジ側バーコード確認までとする。 |
| REQ-402 / recovery | UI-08-D4 | 保存キャンセル・保存失敗では `plu_dirty` と予約を残し、再保存または再生成を案内する。CV17取込み失敗以降は保存済みファイルの再投入、または Diff / Full の再書出しで回復する。 | memory No. は永続しており両 mode を安全に投入できる。confirm 後も slot identity は変わらない。 |
| REQ-402 / safety | UI-08-D5 | Full書出しでは既存PLUバックアップ確認を画面内 Alert として出す。実バックアップファイルはrepoに入れない。217〜5000 の **4,784 slot** は固定件数上限との比較ではなく、snapshot と永続状態で空き・管理範囲を判定する。 | Full投入は app 管理 slot 全体と解放分を扱うため、操作手順上の注意が必要。 |
| REQ-402 / D-028 | UI-08-D8 | PLU書出し対象は三分バケットで表示する。対象外（`plu_target=0`）は差分一覧・書出しに現れない。要修正（`plu_target=1` かつ JAN不備・同一JAN価格不一致）は prepare 結果の `excluded` として理由付き一覧で表示し、商品マスタ修正へ誘導する。生成はブロックしない。 | JANなし商品が1件あるだけでPLU書出し全体が止まる構造（Full恒久失敗・Diff恒久残留・通知汚染）を解消する。decision-log D-028。 |
| REQ-402 / D-072 | UI-08-D9 | Diff / Full とも CV17 へ投入できる。Full は app 管理 slot 全体の再同期、Diff は未反映対象 + 解放分と説明する。旧設計で生成した memory No. 永続化前の Full 書出しファイルは再投入しない。 | `plu_slots` により memory No. が固定され、部分 import の暫定リスクを解消した。旧 file にはこの保証がない。 |
| REQ-402 / status visibility | UI-08-D6 | PLUファイル保存、保存失敗、キャンセル、未反映解除結果はページ上部の注意文直下に表示し、状態遷移後はページ先頭へスクロールする。ページ全体は既存業務画面と同じ内側余白を持つ。confirm失敗は成功色の保存済み表示に混ぜず、失敗タイトルと再試行導線を持つ別 Alert にする。 | 保存後の `この書出しを未反映から外す` は次操作の要であり、下部に出すと利用者が見落とす。confirm失敗が成功表示に混ざると未反映解除に失敗した事実を見落とす。UI-02/03/04/05 の保存結果 visibility follow-up と DSR-01 の共通レイアウト継承に合わせる。 |
| REQ-402 / D-028 L3 | UI-08-D10 | 注意情報はページ上部圏に集約する: 要修正一覧（excluded）は状態表示 section の直後・コンテンツ 2 カラムより前に置き、見出しに warning アイコン + 説明 1 行を添える。CV17 回復手順文言は保存完了の成功 Alert に埋めず、warning トーンの独立 Alert（タイトル `PCツールに取り込めなかった場合の回復手順`）とし、restored pending Alert 内にも同文を強調表示する。 | PR #124 L3 の owner 指摘（要修正一覧が最下部でスクロールしないと見えない / 事故防止文言が埋もれている）。安全側の案内は視線が最初に通る場所 + 強調（色のみ不可）で初めて効く。memory feedback-operator-ui-critical-notes-placement、DSR-03（データ安全系 = 上部 Alert 帯）整合。 |
| REQ-402 / recovery | UI-08-D7 | PLUファイル保存後、未反映解除前に画面遷移・アプリ終了・PC再起動が起きても復帰できるよう、保存済み未確認状態を軽量 `localStorage` に残す。保存するのは `version`、mode、保存先、保存日時、推奨ファイル名、件数、文字コード、exact product_code / memory_no set だけで、ファイル本文や実ファイル内容は保存しない。confirm成功または `破棄して再書出し` で削除する。 | PCツール、SDカード、レジ操作はアプリ外の時間が長く、画面を開きっぱなしにする前提は実運用に合わない。履歴/監査ではないためDBテーブルは作らず、未完了作業の復帰に必要な最小状態だけを保持する。 |
| REQ-907 / D-072 | UI-08-D11 | 「レジ登録状況を読み込む」で共通 FilePicker（D-054）から Z004 を選び、最終読込み日時と free / external / app managed / conflict の占有要約をページ上部に表示する。summary は app managed の内数として `release_pending_count` も返し、0 より大きければ解除待ち説明を出す。Diff 件数は `listPluDirty` 件数 + `release_pending_count` とし、両方 0 のときだけ Diff を無効化する。snapshot 未読込みは書出しより先に step と導線を出す。 | 既存登録を空きと推測せず、operator が現在の占有 source を確認してから予約できるようにする。商品側 dirty が 0 でも解除 clear 行だけを Diff 出力できる必要がある（SPEC-PLS-D2、D5、D7）。 |

## 67.6 Route / Components

想定routeは `/products/plu-export`。商品管理エリアの独立画面として扱い、商品一覧のsearch paramsでmode切替しない。

主要component:

- `PluExportPage`: page orchestration、query/mutation、save dialog、状態分岐
- `PluDirtySummary`: 差分件数、最終書出し目安、0件空状態
- `PluRegisterSnapshotPanel`: Z004 FilePicker、最終読込み日時、占有要約、conflict warning（above the fold）
- `PluExportModePanel`: Diff / Full の二択、対象 / clear 件数、Full バックアップ注意
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
| `commands.getPluSlotSummary()` | なし | `snapshot_at`, free / external / app managed / conflict counts, `release_pending_count` | snapshot 状態を above the fold に表示。解除待ちは app managed の内数として Diff 件数へ加算 |
| `commands.importPluRegisterSnapshot({ fileBytes })` | Z004 の bytes（FilePicker `PickedFile.bytes` を `number[]` へ） | snapshot summary | FilePicker D-054 で選択（path は渡らない）。実コードは UI に一覧表示しない。成功後は D-052-C17 の SSOT helper を適用 |
| `commands.preparePluExport({ mode })` | `"diff"` / `"full"` | `bytes_base64`, `suggested_filename`, `content_type`, `encoding`, `count`, `target_product_codes`, `prepared_rows[memory_no]`, `excluded` | snapshot 未読込みは `register_snapshot_required`。`no_free_slot` を含む要修正は生成から除外。slot 予約・再対象化復元は永続化し、成功後は D-052-C18 の SSOT helper を適用 |
| `commands.confirmPluExportSaved({ product_codes, prepared_rows })` | prepare結果の `target_product_codes` / `prepared_rows` | `updated_count`, `confirmed_at` | 保存済み確認。成功後は D-052-C14 の SSOT helper を適用 |

`target_product_codes` はprepare時のexact setである。confirm時にUIが現在の差分一覧から再計算しない。

**enum 契約化（D-061）**: `preparePluExport({ mode })` は bindings 由来の `ExportMode` generated union を利用する。値・wire 表現は不変。

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
- snapshot required: `レジ設定の読込みが必要です` / action `Z004を選んでレジ登録状況を読み込む`
- failure note before confirm: `PCツールに取り込めなかった場合は、保存済みファイルを再投入するか、差分または全件を書き出し直してください。`（UI-08-D10: 独立 warning Alert）
- legacy file warning: `メモリNo.を永続化する前に作成した全件ファイルは再投入しないでください。`
- excluded list lead: `これらの商品は今回のPLUファイルに含めていません。商品マスタでJANコード・売価・税率を修正すると、次回の書出しから含まれます。`（UI-08-D10 L3 P3: 修正対象を除外理由の全種（JAN不備 / 同一JANの売価・税率不一致）と一致させ、後半の行動文を強調表示して muted 一色の見落としを防ぐ）
- format validation note: `JANコードが未登録または不正な商品は、スキャニングPLU書出しに含められません。商品マスタで13桁JANを確認してください。`
- excluded list title: `書出しに含めなかった商品（要修正）`
- excluded reasons: `JAN未登録` / `JANが13桁ではありません` / `JANのチェックディジットが不正です` / `同じJANの商品で売価または税率が一致していません`
- import note: `Diff / Full ともレジへ投入できます。`
- restored pending title: `保存済みで未確認のPLU書出しがあります`
- discard button: `破棄して再書出し`

保存、保存失敗、キャンセル、未反映解除結果はページ上部の注意文直下に出す。保存後確認ボタンを差分一覧や書出し設定の下に置かない。保存後は `この書出しを未反映から外す` を主動線とし、再書出しボタンは副導線として表示する。要修正一覧（excluded）は状態表示の直後・コンテンツ 2 カラムより前に置き、見出しに warning アイコンを添える（UI-08-D10。色のみで符号化しない）。

状態は色だけで示さない。`未反映`, `保存済み`, `未反映から外しました`, `レジ反映は未確認` の日本語ラベルを主情報にする。

## 67.10 Query Invalidation

- prepare成功: D-052-C18 の SSOT helper で slot summary を invalidate する。`plu_dirty` は変わらないが、予約・external採用・再対象化復元で slot status が変わり得る
- save cancel / save failure: invalidateしない
- 商品 update / 廃番 toggle 成功: D-052-C2、confirm成功: D-052-C14 を適用し、いずれも slot summary を stale 化する。具体的な query key 集合と除外判断は本書へ複製しない。

## 67.11 Error / Recovery

- Diff対象0件: `listPluDirty` と `release_pending_count` がともに 0 なら prepareを呼ばず、空状態で「差分はありません」を表示する。Full書出しは選べる。app managed が 1 以上でも解除待ち 0 なら Diff を有効化しない
- prepare validation error: Alertで表示し、差分一覧へ戻れる
- snapshot 未読込み: `register_snapshot_required` を表示し、Z004 FilePicker へフォーカスを戻す
- JANなし / 13桁以外 / チェックディジット不正 / 同一JAN価格不一致 / `no_free_slot`: prepareは失敗せず、該当商品を `excluded`（要修正一覧）として理由付きで表示する。既存 slot は維持し、今回のファイルには含めない
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
- Z004 FilePicker、snapshot_required 分岐、最終読込み日時と占有要約が above the fold で読める
- external / app managed / conflict の区別が色以外の label / icon / text でも読める
- 保存後、confirm前なら同じ memory No. で Diff / Full を再書出しでき、どちらも CV17 へ投入できる
- memory No. 永続化前に作成した旧 Full file の再投入禁止文言が読める
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
