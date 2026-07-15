> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: ARCHITECTURE.md（UI-13 / REQ-904）、SCREEN_DESIGN.md（在庫整合性検証）、36-biz-integrity-check.md（BIZ-07）、42-cmd-sales-stocktake.md §22.7（CMD-11 integrity）、59-ui-shared-patterns.md（共有 UI 部品）
> **Plan Packet**: [archived plan](../archive/plans/2026-07-15-ui13-integrity-check.md)（Design Phase 出典）

## 75. UI-13: 在庫整合性検証画面

### 75.1 概要

- **対応 REQ**: REQ-904
- **route**: `/settings/integrity`
- **呼び出す CMD**: `runIntegrityCheck()` / `fixIntegrity(productCodes)` / `listLogs(query)`
- **主動線**: idle で明示実行 → running overlay → completed で差異なし、または差異一覧 → 行単位選択 → 確認dialog → fix結果 → 必要なら手動再チェック。

**関数要求**: `products.stock_quantity` と有効な `inventory_movements` 合計の整合性を、利用者の明示操作で検証する。補正は行単位の明示選択と確認dialogを必須とし、選択した商品コードだけを既存CMD-11へ渡す。成功、部分スキップ、失敗、再試行を日本語で区別し、色だけで状態を表現しない。

**シグネチャ**:

```ts
export function IntegrityCheckPage(): JSX.Element;
```

**処理ステップ**:

1. mount時にidle状態を表示し、`listLogs`から直近確認日時だけを取得する。
2. 利用者の明示操作で`runIntegrityCheck`を実行し、running中は画面内overlayで他操作を抑止する。
3. 完了後、差異0件なら成功表示、差異ありなら100件単位の一覧を表示する。
4. 利用者が補正対象を行単位で選択し、確認dialogで商品コードと`stock_quantity → movements_sum`の内訳を確認する。
5. confirm時だけ選択した商品コードを`fixIntegrity`へ渡し、補正結果・補正済み表示・部分スキップ警告を表示する。
6. 再確認は利用者が「再度チェック」を押した場合だけ実行し、旧結果と選択を破棄して新しいcheckを開始する。

**エラーハンドリング**: §75.9を参照。check失敗時は日本語messageと再試行、fix失敗時は選択を保持した日本語messageと補正再試行を表示し、直近確認日時の取得失敗はcheck主動線を塞がない。

### 75.2 Design Decisions

| ID | 決定 | 理由 / 棄却案 |
|---|---|---|
| UI-13-D1 | routeは`/settings/integrity`。URL search stateは持たず、check result、page、選択、fix resultは画面ローカルの一時状態とする。mount時は必ずidle。 | 結果はその場のDB状態を検証した実行セッション限り。URLへpage/resultを置くと古い結果を再現可能に見せるため棄却。 |
| UI-13-D2 | 直近確認日時は`listLogs({ page: 1, per_page: 1, operation_type: "integrity_check", start_date: null, end_date: null })`の最新行から導出する。 | 専用setting keyはbackend変更とlogとの二重管理を生む。`integrity_fix`は対象に含めない。 |
| UI-13-D3 | 差異行ごとに「補正する」checkboxを置く。select-allは置かず、未選択時は確定disabled。確認dialogへ商品コードと`stock_quantity → movements_sum`を列挙し、confirm時だけ選択codeを送る。 | 「1件ずつ確認」は盲目的な全件補正を防ぐ意図。明示列挙付き複数選択は反復modalより確認しやすい。 |
| UI-13-D4 | check/fix中は画面内overlay、Progress、処理中文言を出す。pending中は実行・選択・確定・retryを無効にし、handlerでも二重発火を防ぐ。 | 旧結果・選択と新結果の混入を防ぐ。cancel可能には見せない。 |
| UI-13-D5 | fix成功後は自動再チェックしない。`fixed_count` / `adjustments` summaryと「補正済み」Badgeを表示し、「再度チェック」でのみ新checkを始める。 | checkは重い処理であり、利用者の意図なく暗黙実行しない。 |
| UI-13-D6 | `skipped_count > 0`は独立warningで表示する。CmdErrorは日本語messageとretryを表示し、fix失敗時の選択を保持する。 | 部分未補正と再選択負担を成功表示へ埋没させない。 |
| UI-13-D7 | frontendは生成済み`commands.*`と`unwrapResult`のみを使う。手書き`invoke`とfrontend独自DTOを禁止する。 | Rust型をwire contractのSSOTにする。 |
| UI-13-D8 | 「差異なし」「差異あり」「システム在庫が多い」「入出庫の合計が多い」「補正済み」「一部未補正」を日本語で示し、icon/Badge/Alert/位置とsemantic色を併用する。 | 非IT・高齢operatorが色識別に依存せず状態を言い分けられることを機能要件とする。 |

### 75.3 State / Lifecycle

```ts
type IntegrityPhase = "idle" | "running" | "completed";
```

| Event | Before | After | 保持 / 破棄 |
|---|---|---|---|
| mount / remount | — | idle | result、selection、fix result、errorなし |
| check開始 | idle / completed | running | 旧result、selection、fix result、errorを破棄 |
| check成功 | running | completed | 新result、page=1、selection空 |
| check失敗 | running | 実行前phase | errorを表示。retryは新規check |
| fix開始 | completed | running相当の抑止 | resultとselectionを保持 |
| fix成功 | pending | completed | result、fix result、補正済みcode集合を保持。自動checkなし |
| fix失敗 | pending | completed | resultとselectionを保持しerror/retryを表示 |
| 再度チェック | completed | running | 旧result、selection、fix result、補正済み表示を破棄 |

- checkとfixを同時に走らせない。URL、localStorage、Zustand、Query cacheへresultを保存しない。
- 直近確認日時は画面表示時とcheck成功後に再取得する。取得失敗はcheck主動線を塞がない。

### 75.4 Data Flow / Wire Contract

```text
/settings/integrity
  └ IntegrityCheckPage
      ├ listLogs(integrity_check, latest 1) → OperationLog
      ├ runIntegrityCheck()                 → IntegrityResult
      └ fixIntegrity(selected codes)        → IntegrityFixResult
```

- `IntegrityResult`: `mismatches`, `mismatch_count`, `checked_count`
- `IntegrityMismatch`: `product_code`, `name`, `stock_quantity`, `movements_sum`, `difference`
- `IntegrityFixResult`: `fixed_count`, `skipped_count`, `adjustments`
- `StockAdjustment`: `product_code`, `old_stock`, `new_stock`, `adjustment`
- UIは補正量を再計算して送らない。fix入力は選択した`product_code[]`のみ。
- empty code集合はUIで到達不能にし、CMD/BIZ validationも防御境界として維持する。

### 75.5 Status Presentation

| 状態 | 主表示 | 非色シグナル |
|---|---|---|
| idle | 「整合性チェック実行」 | 説明文 + 主動線button |
| running | 「在庫データを確認しています」または「補正を記録しています」 | overlay + Progress + `role="status"` |
| 差異なし | 「差異はありません」 | Check icon + success Alert + checked件数 |
| 差異あり | 「差異が見つかりました」 | AlertTriangle icon + warning Alert + mismatch件数 |
| 補正済み | 「補正済み」 | row Badge + fix summary |
| skippedあり | 「一部の商品は補正されませんでした」 | warning Alert + skipped件数 |

### 75.6 Difference Table / Pagination

業務値5列は、商品コード、名前、システム在庫、入出庫の合計、差異。行ごとのcheckboxは別の操作列とする。

- client-side pagingは100件固定。101件ならpage 1に100件、page 2に1件。check再実行時はpage 1へ戻る。
- `ProductPagination`を`totalCount=mismatches.length`、`perPage=100`で再利用する。
- tableは横overflow可能なwrapperと安定した列幅を持つ。商品名は回復不能なtruncateをしない。
- `difference > 0`は「システム在庫が多い」、`difference < 0`は「入出庫の合計が多い」。0は防御的に「差異なし」。
- UI-10棚卸し（73-ui-stocktake.md UI-10-D10）の列名「現在在庫」とは意図的に語彙を分ける。本画面はシステムに記録された数字自体の正しさを疑う場であり、「現在」と断言する語を使うと検証対象の数字を無条件に信頼しているように読める。「システム在庫」は検証対象であることを示し、「入出庫の合計」はsidebarで既習の「入出庫」語彙に寄せて計算根拠を伝える。

### 75.7 Selection / Confirmation / Fix Result

- checkboxのaccessible nameは「{商品コード}を補正する」、可視labelは「補正する」。headerにselect-allを置かない。
- 「棚卸し補正として確定」は選択0件またはpending中にdisabled。
- dialogはtitle「棚卸し補正として記録します」と説明を持ち、選択行ごとに商品コード、商品名、`stock_quantity → movements_sum`を列挙する。
- cancelは副作用なし。confirmでのみ`fixIntegrity`を1回呼ぶ。
- success summaryはfixed件数と各adjustmentの`old_stock → new_stock`を列挙する。
- `adjustments.product_code`だけを補正済み集合へ追加し、skipped codeを補正済みと表示しない。

### 75.8 Latest Check Time

- payloadは`page=1`, `per_page=1`, `operation_type="integrity_check"`, `start_date=null`, `end_date=null`固定。
- 1件なら`created_at`の`T`を空白へ置換して表示。0件は「まだ実行されていません」、失敗は「取得できませんでした」。
- `integrity_fix`や他operation_typeの日時をfallbackに使わない。

### 75.9 Error / Retry / Loading

| 状態 | 表示 / 回復 |
|---|---|
| check error | destructive Alert + CmdErrorの日本語message + 「再試行」 |
| fix error | destructive Alert + CmdErrorの日本語message + 「補正を再試行」。resultとselectionを保持 |
| latest log error | 補助文言だけを失敗表示し、主動線を塞がない |
| running | 画面内overlay、Progress、処理中文言。背景controlsをdisabled |

- `isInvokeError`なら`cmdError.message`、その他は日本語の汎用回復文言を表示する。
- retry handlerは二重実行guardを共有し、成功時にerrorを消す。

### 75.10 Accessibility / Keyboard / 非色

- 既存Button、Checkbox、AlertDialog、Table、Progressを再利用する。
- checkboxはlabelで商品を一意に特定し、Spaceで切替可能。dialogはRadixのfocus trapとEsc/cancelを使う。
- overlayは`role="status"`と可視文言を持つ。背景controlsはdisabledとし、pointer遮断だけに依存しない。
- 差異方向、結果、補正済み、skippedはtext/role/valueでtest可能な日本語labelを持つ。
- 初期1280x800、最小1024x720でtable overflowとdialog内訳scrollを確認する。

### 75.11 Traceability

- REQ-904 / UI-13-D1: initial idle、remount、rerun lifecycle。
- REQ-904 / UI-13-D2: latest integrity_check log導出。
- REQ-904 / UI-13-D3: selection、select-all不在、disabled、confirm内訳、selected codes。
- REQ-904 / UI-13-D4: overlay、操作抑止、二重発火防止。
- REQ-904 / UI-13-D5: fix summary、補正済みBadge、no auto recheck、手動再check。
- REQ-904 / UI-13-D6: skipped warning、CmdError、retry selection保持。
- REQ-904 / UI-13-D7: generated bindingsのみ、手書きinvoke不在、command登録一致。
- REQ-904 / UI-13-D8: status / difference directionの日本語label。
- REQ-904: 100件paging、5業務列。

### 75.12 Windows native L3

| # | 画面 / 到達手順 | 観測可能な合格基準 |
|---|---|---|
| L3-1 | synthetic DBで`/settings/integrity`を開きcheck実行 | 差異なし成功表示と直近確認日時が読める |
| L3-2 | 実行直後に他操作を試す | overlayと処理中文言が表示され、二重実行できない |
| L3-3 | idle / running / 差異なしをowner目視 | 非IT operatorが日本語文言、主動線、状態差を説明できる |

「差異あり → 選択補正」はDB直接操作によるfault injectionが必要なためL3対象外。component testと既存BIZ実SQLite testで担保する。

### 75.13 非目的

| やらないこと | 理由 / 責務 |
|---|---|
| POS部門別売上照合（REQ-403 / SP-403） | UI-13とは別のdeferred要求 |
| 自動・定期check、自動fix | 利用者の明示操作と確認が安全契約 |
| select-all / 全件一括補正 | 誤操作防御に反する |
| frontendで補正量を決定して送信 | BIZ-07がauthoritative |
| URL/localStorageへのresult保存 | ephemeral lifecycleに反する |
| CMD/BIZ/IO/DBロジック変更 | 既存contractで完結。不足時はDesign/Planへ戻す |

navigation（`src/config/navigation.ts`）の ui-13 entry は `/settings/integrity` で active 化済み（Amendment 4、2026-07-15）。owner の実機確認で `to: null` / `status: "pending"` のまま = 利用者が本画面に到達できない Goal Invariant 違反が発覚したため是正した。navigation からの除外は非目的ではない。

### 75.14 Adjacent Pattern Audit

| 観点 | 参照元 | UI-13採用 |
|---|---|---|
| PageHeader / retry Alert / table overflow | `OperationLogsPage` | 再利用 |
| Progress / pending disabled / confirmation dialog | `StocktakePage` | 再利用 |
| pagination | `ProductPagination` | client-side 100件固定で再利用 |
| generated command + unwrapResult | 既存features | 同一pattern。手書きinvoke禁止 |
| URL state | `OperationLogsPage`等 | ephemeralな別scenarioのため意図的に不採用 |
| query cache | logs / stocktake | latest logだけQuery。check/fix resultはlocal state |

### 75.15 Mutation / Anti-tautology Questions

1. 選択外codeをfixtureへ混ぜてもfix引数へ入らないか。
2. confirm前にfixを呼ぶmutationが失敗するか。
3. fix成功後にcheckを自動呼出しするmutationがcall countで失敗するか。
4. `skipped_count=0`と`>0`でwarning表示が変わるか。
5. retryでselectionをclearするmutationがcheckbox valueと再送引数で失敗するか。
6. 101件fixtureの先頭、100件目、101件目を別codeにしてslice境界を検出できるか。
7. positive/negative differenceへ同じ文言を出すmutationが失敗するか。

### 75.16 Negative-space Audit

- Q40の全アプリ共通Error Boundaryは本scope外。本画面固有のCmdError/retryを実装する。
- `src/config/navigation.ts`のui-13 entry有効化はAmendment 4で追加scope化済み（§75.13参照。原scopeはroute新設のみだったが、owner実機確認で到達導線の欠落がGoal Invariant違反と判明し是正）。
- fix成功と整合性再確認を同一視せず、「再チェック済み」を自動で主張しない。
- 差異0件はempty dataではなく正常な成功結果として表示する。

### 更新履歴

| 日付 | PR | 内容 |
|---|---|---|
| 2026-07-15 | UI-13 implementation | UI-13-D1〜D8、lifecycle、wire、paging、確認、部分失敗、retry、非色表示、L3境界を正本化 |
