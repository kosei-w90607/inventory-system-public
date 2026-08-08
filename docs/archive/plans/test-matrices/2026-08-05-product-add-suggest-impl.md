# Test Design Matrix: 商品追加欄 live 候補プレビュー（ProductAddSuggest）実装

## Risk

Risk: R3

## Contracts Under Test

- SPEC-SUGGEST-D1〜D11（`docs/design-system/02-component-catalog.md` ⑮、凍結正本。D11 = IME 全角数字正規化 + compositionend commit、gated Amendment 3 で追加）
- UI-02-D14 / UI-04-D16 / UI-03-D21 / UI-05-D16 / UI-10-D12（画面別適用）
- UI-05-D15（disposal lock ref 整合）/ UI-10-D2（find_stocktake_item 確定経路）/ UI-10-D11（focus 遷移の候補確定経由同一発火）
- 凍結義務: 既存 5 画面 test file（T17/T23 含む）の diff 0 + 全 green

## Failure Modes

- 表示直後・差し替え直後の自動 active 化により、スキャナ Enter が意図しない候補を確定する（D2 破り）
- onChange 同期解除の欠落により、旧 active / 旧リストが Enter・click で stale 確定する（D2 破り）
- sequence token / 検索語二重一致の欠落により、遅延応答が新入力のリストを差し替える（D4 破り）
- close 系 event で timer cancel / in-flight 不採用が漏れ、close 後にリストが再 open する（D4 破り）
- isComposing 中の ↓/↑ が IME 変換候補操作と衝突して active を生成する（D5 破り）
- focus がリストへ移動し、スキャナ連続入力の input 保持が壊れる（D6 破り）
- 候補確定が既存 handler を迂回し、画面固有の後続処理（focus 復帰・行 merge 等）が発火しない（D7 破り）
- lock 中の fetch 発火・リスト残置（D10 破り）
- 既存 commit 経路コード・test の変更（D1/D9 破り、凍結義務違反）
- mock 貫通 tautology: W 系が実 handler を通らず mock 応答だけで green になる
- 日本語 IME 有効時にスキャナ入力が全角数字 composition となり、Enter が変換確定に消費されて検索/追加が発火せず次スキャンが連結される（D11 破り = gated Amendment 3 起点の実機 blocker）
- compositionend 起点 commit と直後の Enter keydown で commit が二重発火する、または stale closure で旧 state 値を検索する（D11 破り）

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.
- S 系 = `src/components/patterns/ProductAddSuggest.test.tsx`（新設、synthetic mock）。W 系 = 各画面 `*.suggest.test.tsx`（新設 file 隔離。既存 test file への追記禁止）。
- oracle 独立性: debounce 200ms / per_page 5 / footer 文言は test 内 literal 転記とし、production 定数・共有定数 module を import しない。
- gated Amendment 3（2026-08-09）: S22〜S27 / W13〜W17 / X22〜X26 を追加（D11）。test 内の数字列は synthetic のみ（実 JAN / 実 ISBN、初回 L3 実測で用いた ISBN を含め使用禁止）。実 IME のイベント順 race は RTL harness で再現不能のため、S24 の guard 検証は合成イベント列によるロジック検証であり、実機挙動の最終検証は Windows native L3 の所掌。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| D3 | 発火条件破り | unit | S1 入力 1 文字 + debounce 200ms 後に per_page 5 で fetch（fake timers、199ms では未発火） | debounce 値・per_page・最小文字数のいずれかが契約とずれる |
| D3 | 0 件時の誤表示 | unit | S2 0 件応答でリスト非表示・メッセージなし | 0 件 UI が新設される |
| D3/D6 | footer 契約破り | unit | S3 総件数超過時 footer「ほか N 件（候補未選択で Enter: 従来の検索）」表示、footer は role="option" なし・↓/↑ 対象外 | footer が選択可能になる / 文言 drift |
| D2 | 自動 active 化 | unit | S4 表示直後 active なし、Enter は onCommitFallback（既存経路 callback）を呼ぶ | 表示直後や先頭行の自動 active 化 |
| D2/D6 | active 移動破り | unit | S5 ↓/↑ で active 移動、端で wrap しない | wrap 実装 / 移動不能 |
| D2 | 確定分岐破り | unit | S6 active あり Enter は候補確定 callback を呼び、onCommitFallback を呼ばない | Enter 二重発火 / 分岐逆転 |
| D2 | stale active | unit | S7 入力値変化の onChange で active 同期解除 + リスト close | 同期解除の欠落・非同期化 |
| D2 | active 持ち越し | unit | S8 リスト差し替え（再 fetch 反映）後 active なし、再度 ↓ で新リストに active | 差し替え後の active 持ち越し |
| D4 | 遅延応答採用 | unit | S9 旧 token の遅延応答を不採用（新入力のリストを差し替えない） | token 判定欠落 |
| D4 | 検索語不一致採用 | unit | S10 token 一致でも検索語が現在入力値と不一致なら不採用 | 二重一致の片側欠落 |
| D4 | close 後再 open | unit | S11 Esc / blur / Tab / 候補確定 / Enter commit / 入力 clear / unmount の各 close 系 event で timer cancel + in-flight 応答（success/error とも）不採用 | いずれかの event で cancel 漏れ → close 後リスト再 open |
| D5 | IME 衝突 | unit | S12 isComposing 中は Enter / ↓ / ↑ / Esc の suggest 処理を行わない（active 非生成・close なし・確定なし） | guard が Enter のみ等の部分実装 |
| D6 | a11y 構造破り | unit | S13 combobox / aria-expanded / aria-controls / aria-activedescendant / listbox / option の構造、focus は常に input | 構造欠落 / focus 奪取 |
| D6 | click race | unit | S14 候補行 click は active 無関係に即確定、onMouseDown で default 抑止（blur close との race なし） | mousedown 抑止欠落 → blur 先行で確定不能 |
| D6 | hover active | unit | S15 mouseenter で active を生成しない | hover 選択の実装 |
| D7 | 行表示破り | unit | S16 候補行 = 商品コード + 商品名 + 部門名の 3 項目のみ。department_name null の variant case を 1 件含める（oracle は既存「複数件候補テーブル」の実表記を Writer が実査して独立転記） | 画面固有列の追加 / 項目欠落 / null 表記の独自発明 |
| D1 | error 波及 | unit | S17 fetch error で silent close（error UI なし、onCommitFallback 経路は生存） | error 表示の新設 / commit 経路へ波及 |
| D10 | lock 中発火 | unit | S18 isLocked() true で fetch 不発火 + 表示中リスト close | lock 判定欠落 |
| D10/D4 | 保存 event 連動漏れ | unit | S19 invalidateAndClose() 同期呼出しで close + timer cancel + in-flight 不採用 | API 未実装 / 非同期化 |
| D5 | onChange 側 guard 誤追加 | unit | S20 isComposing 中の onChange でも debounce/fetch が発火する（変換途中文字列での候補更新を許容 = D5 の Don't 側契約） | onChange / debounce 経路に composing guard が追加される |
| D4 | 外部 clear 経路の close 漏れ | unit | S21 onChange 非経由の外部 value 変更（既存 commit 経路の `setSearchText("")` 相当）で open リストの同期 close + debounce timer cancel（in-flight 不採用は S10 の token + 検索語二重一致が既に cover。gated Amendment 2） | value prop 監視の close 経路が除去され、スキャナ連続スキャン時に旧リスト残置 |
| D11 | IME 全角数字の取りこぼし | unit | S22 compositionend で確定値が全角数字のみなら、正規化値（半角）での onChange 1 回 + onComposedDigitsCommit(正規化値) 1 回（synthetic 数字列） | 正規化・commit のいずれかが欠落 / 複数回発火 / 全角値のまま commit |
| D11 | 過剰正規化 | unit | S23 英字・かな・記号を含む確定値は無加工のまま、onComposedDigitsCommit を呼ばない | 混在値で正規化・commit が発火する |
| D11 | 二重 commit | unit | S24 compositionend 起点 commit 直後の isComposing=false Enter keydown で commit が再発火しない（one-shot guard。合成イベント列によるロジック検証、実機は L3） | guard 欠落で 1 スキャン 2 発火 |
| D11 | 半角確定の取りこぼし | unit | S25 確定値が半角数字のみでも onComposedDigitsCommit 1 回（IME 半角英数モードの変換確定吸収） | 全角時のみ commit する分岐 |
| D11/D2 | 確定経路混線 | unit | S26 リスト open 中（active なし）の compositionend commit は onComposedDigitsCommit のみ呼び、候補確定 callback（onSelect）を呼ばない | selectSuggestion 経由の誤確定 |
| D11 | util 境界破り | unit | S27 正規化 util 単体: U+FF10/U+FF19 境界写像・空文字不変・全角記号（－/．等）混在は不変・写像対象は全角数字 10 文字のみ | 写像範囲の過不足（かな/記号まで変換 or 境界文字漏れ） |
| D7/UI-02-D14 | 確定迂回 | integration | W1 Receiving: 候補確定が既存 `addProduct` と同一経路で行追加（明細行の実 DOM 出現で assert、REQ-201） | suggest 独自の追加経路が生える |
| D7/UI-04-D16 | 同上 | integration | W2 ManualSale: 同上（REQ-203） | 同上 |
| D7/UI-03-D21 | direction 欠落 | integration | W3 ReturnExchange: 候補確定が `addProduct(candidate, effectiveAddDirection)` の direction 込み経路を通る（REQ-202） | direction 引数の欠落 |
| D10/UI-05-D16/UI-05-D15 | disposal lock 整合 | integration | W4+W6 Disposal: 候補確定の行追加 + 保存 event（lock ref 更新と同一 event 内）で invalidateAndClose が呼ばれリスト close（REQ-204） | 二重 lock 不整合 / 保存中リスト残置 |
| D8/UI-10-D12 | 棚卸し確定経路迂回 | integration | W5 Stocktake: 候補確定が findMutation（find_stocktake_item）経由で selectItem に到達 | searchProducts 結果の直接 selectItem |
| UI-10-D11 | focus 契約破り | integration | W7 Stocktake: 候補確定成功で数量欄へ focus 遷移（T17 と同一契約の候補確定経由版） | 候補確定経由で focus 遷移が発火しない |
| D1/D2 | commit 経路退行 | integration | W8 各画面: active なし Enter が既存 commit 経路を実行（suggest 配線後の smoke、5 画面各 1 case） | suggest 層が Enter を横取りする |
| D10 | 保存 event 呼出し漏れ | integration | W9 Receiving: 保存 event handler 内の invalidateAndClose() 同期呼出しで表示中リスト close | Receiving 配線で invalidateAndClose() 呼出しが省かれ保存中リスト残置 |
| D10 | 保存 event 呼出し漏れ | integration | W10 ManualSale: 同上（保存 event で表示中リスト close を実 DOM assert） | ManualSale 配線で呼出しが省かれる |
| D10 | 保存 event 呼出し漏れ | integration | W11 ReturnExchange: 同上 | ReturnExchange 配線で呼出しが省かれる |
| D10 | 確定 event 呼出し漏れ | integration | W12 Stocktake: 棚卸し確定 event（completeMutation 実行 = isCompleting の source。update_count 単位ではない）で invalidateAndClose() が同期呼出しされリスト close | Stocktake 配線で確定 event の呼出しが省かれる |
| D11/UI-02-D14 | stale closure | integration | W13 Receiving: onComposedDigitsCommit が正規化済み文字列を明示引数で既存検索関数へ渡し、引数値で検索が実行される（state 旧値でないことを assert） | 配線欠落 / state 暗黙参照の stale 検索 |
| D11/UI-04-D16 | 同上 | integration | W14 ManualSale: 同上 | 同上 |
| D11/UI-03-D21 | 同上 | integration | W15 ReturnExchange: 同上 | 同上 |
| D11/UI-05-D16 | lock 中 commit | integration | W16 Disposal: 同上 + isLocked() true 中は compositionend でも正規化・commit とも不発火（D11 (b) の isLocked 尊重） | lock 中のスキャンが追加を発火する |
| D11/UI-10-D12 | 確定経路迂回 | integration | W17 Stocktake: 同上（既存 resolveItem 経由、UI-10-D2 の find_stocktake_item 確定経路不変） | resolveItem 迂回の独自検索経路 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| suggest リスト | 非表示 | debounce 待ち（199ms 未発火 = S1） | open + active なし（S4） | onChange 同期 close（S7）/ close 系 event（S11） | 差し替えで active 解除（S8） | 再入力で再 open（S1） | unmount で cancel（S11） | silent close（S17） | 再入力で回復（S1） | S 系 |
| active 候補 | なし | — | ↓/↑ でのみ生成（S5） | 入力変化 / close / 差し替えで解除（S7/S8/S11） | — | 新リストで再操作要（S8） | — | — | — | S 系 |
| in-flight 応答 | — | token 発行済み | token + 検索語二重一致で採用（S9/S10） | close 系 event で不採用（S11/S19） | — | — | — | error も不採用（S11） | — | S 系 |
| lock 連動 | unlock | — | — | lock 成立で close + 発火停止（S18/S19/W4+W6） | — | unlock 後は通常動作 | — | — | — | S18/S19/W 系 |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| IME isComposing guard | 5 画面 commit 経路（Receiving L417 / ManualSale L464 / ReturnExchange L674 / Disposal L371 / Stocktake L517・L600）+ SearchBar live | suggest 層 onKeyDown 冒頭（D5、全 suggest キー） | 既存 commit 経路 guard は不変（D1）。onChange 側 guard は置かない（D5 契約） | S12 + AC3 |
| Enter handling | 5 画面 `handleProductSearch` ×3 hit / `resolveItem` | suggest 層は active 有無で分岐のみ追加（D2） | commit 経路の Enter 処理本体は不変 | S4/S6/W8 |
| focus 復帰 | Receiving L215・L258 / ManualSale L210・L237・L281 / ReturnExchange L311・L356 / Disposal L217・L262 / Stocktake L406・L486 | 変更なし（focus は常に input 保持 = D6、確定は既存 handler 経由で既存 focus 復帰が発火） | リストへの focus 移動は禁止 | S13/W7 |
| lock source | isFormLocked（3 画面）/ isFormLockedRef（disposal）/ isCompleting（stocktake） | isLocked() へ各画面の既存 source を渡す（D4/D10 の 3 分類） | 新規 lock 機構の追加禁止 | S18/W4+W6/W7 |
| 候補テーブル選択 handler | addProduct ×4 / selectCandidate→findMutation→selectItem | 候補確定は同一 handler へ委譲（D7/D8） | 候補テーブル自体は不変（Non-scope） | W1〜W5 |
| debounce 実装（SearchBar 直書き precedent） | `SearchBar.tsx` LiveSearchBar（timerRef + setTimeout） | useProductAddSuggest 内に独立実装（sequence token 込み。SearchBar の共通化・変更はしない） | SearchBar は用途別 pattern（⑨ vs ⑮）で共有しない | S1/S9〜S11 |

## Negative Paths

- missing input: 空文字は fetch 不発火・リスト非表示（S1 の 0 文字 case）
- invalid input: composing 途中文字列での候補更新は許容（D5、S20 で独立 assert）
- duplicate/ambiguous input: 同一検索語の再応答は token で直近のみ採用（S9）
- unknown reference: find_stocktake_item None は既存無言 no-op 継承（D8、pre-existing）
- dependency missing: fetch error → silent close（S17）
- permission/write failure: not applicable（表示のみ・永続化なし）
- dry-run side effect: not applicable

## Boundary Checks

- threshold: debounce 199ms/200ms 境界（S1）、入力 0/1 文字境界（S1）
- null/default: active なし状態の Enter 分岐（S4）
- empty/non-empty: 0 件/1 件以上/per_page 超過（S2/S3）
- min/max: active 移動の端（wrap なし、S5）
- status/policy enum: なし
- wire type: `ProductSearchQuery` / `PaginatedResult<ProductWithRelations>` 不変（型 check で担保）
- internal type: 候補行 3 field のみ参照（S16）
- producer/consumer: commands.searchProducts → useProductAddSuggest のみ新設
- round-trip token: sequence token の発行→採否（S9/S10）
- precision/range: per_page 5（S1）
- cross-language parse: not applicable

## Compatibility Checks

- old schema/input: 既存 5 画面 test file diff 0 + green（AC3、T17 = `StocktakePage.test.tsx` L255 / T23 = 同 L649 を含む。T3 の単数 combobox query 特定化のみ gated Amendment 1 の owner 承認例外 — assert 内容不変）
- new schema/input: 新規 test は新規 file のみ（S 系 1 file + W 系 5 file）
- output order: 候補行は searchProducts 応答順のまま（並び替えなし）
- optional field behavior: department_name 欠落時の表示は既存候補テーブルの実表記を継承（S16 の null variant case で assert、oracle は実表記の独立転記）

## Data Safety Checks

- source-derived data: synthetic 商品データのみ（実店舗の商品名・JAN・価格を含まない）
- generated outputs: traceability 再生成が出る場合は AUTO-GENERATED のみ
- secrets: なし
- local-only files: なし
- synthetic sample boundaries: mock 応答は design 期待値と識別可能な任意値（tautology 防止）

## Main Wiring / Integration Checks

- helper connected to main path: AC1（5 画面配線 rg）+ W1〜W5（実 handler 到達）
- output reaches manifest/report: not applicable
- effective config reaches runtime: per_page 5 / debounce 200 が実 fetch 引数に到達（S1）
- CLI arg reaches implementation: not applicable

## Mutation-style Adequacy Questions

- mock 値を変えたとき、どの assertion が実装の実経路使用を証明するか → W1〜W5 は明細行の実 DOM 出現 / findMutation 呼び出しで assert（mock 定数比較のみの test を禁止）
- invalidate/refetch の順序が変わったらどれが落ちるか → S7/S8/S11（同期解除・差し替え・close の順序 assert）
- key branch 逆転 → S4/S6（Enter 分岐）
- threshold 変更 → S1（199/200ms、0/1 文字）
- guard 除去 → S12（IME）/ S18（lock）
- 出力 field 省略 → S16（3 項目）

## 必須 mutation 注入（Writer 実測 + Coordinator clean tree 独立再実測、全 red 必須）

| ID | 注入 | red になるべき test |
|---|---|---|
| X1 | 表示直後に先頭行を自動 active 化 | S4 / S8 |
| X2 | onChange の active 同期解除 + close を除去 | S7 |
| X3 | sequence token 判定を除去（全応答採用） | S9 |
| X4 | 検索語一致判定を除去（token のみ） | S10 |
| X5 | close 系 event の timer cancel を除去 | S11 |
| X6 | isComposing guard を除去 | S12 |
| X7 | footer 行に role="option" を付与 | S3 |
| X8 | mouseenter で active 生成を追加 | S15 |
| X9 | isLocked() 判定を除去 | S18 |
| X10 | 候補確定を既存 handler 迂回の独自追加処理に置換（1 画面） | 当該 W 系（W1〜W5 のいずれか） |
| X11 | active 移動を端で wrap させる | S5 |
| X12 | onMouseDown の default 抑止を除去 | S14 |
| X13 | invalidateAndClose() の close / timer cancel / in-flight 不採用処理を no-op に置換 | S19 / W6 / W9〜W12 |
| X14 | onChange / debounce 経路に composing guard を追加 | S20 |
| X15 | D2 Enter 分岐を反転（active あり Enter が既存 commit 経路 fallback を呼ぶ） | S6 |
| X16 | debounce 定数を 200ms から 500ms へ変更 | S1 |
| X17 | 候補行から department_name を省略し 2 項目表示化 | S16 |
| X18 | 0 件応答時に空状態メッセージを表示する UI を追加 | S2 |
| X19 | aria-activedescendant / role="listbox" の付与を欠落させる | S13 |
| X20 | suggest fetch error を silent close せず error 表示へ伝播させる | S17 |
| X21 | 外部 value 変更を監視する close 経路（value 監視 effect）を除去 | S21 |
| X22 | 正規化判定の文字クラスから全角数字を除外（`[0-9]+` 化） | S22 |
| X23 | onComposedDigitsCommit 呼出しを除去 | S22 / S25 |
| X24 | 二重発火 one-shot guard を除去 | S24 |
| X25 | 全体一致条件を除去し混在値も正規化・commit する | S23 |
| X26 | 画面配線の明示引数渡しを state 参照へ置換（1 画面） | 当該 W 系（W13〜W17 のいずれか） |

- 注入は commit 後の clean tree で行い、`git checkout` 復元で未 commit 是正を消さない（memory: mutation-test-on-clean-tree-only）
- Coordinator 再実測は Writer の記録を参照しない独立導出とする

## Residual Test Gaps

- スキャナ実機の supported sequence 適合・debounce 下 UX は自動 test 不能 → L3 行（PR body Human Gate）
- find_stocktake_item None の無言 no-op は pre-existing gap の継承（D8 明記済み、本 change で test 追加しない）
- W 系は jsdom 上の RTL であり、Windows native の視覚配置（絶対配置要素の重なり）は L3 視認で補完
