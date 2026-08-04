# Plan Packet: 商品追加欄 live 候補プレビュー（variant B）design-first

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 61cd269
- Amendments: none
- Coordinator: Fable 5（main thread）
- Writer: Fable 5（design amendment 起草。docs-only、実装 PR は本 packet の後続で Codex 発注）
- Plan Reviewer: Sonnet 5 独立 subagent（rally）+ Codex（プラン全体レビュー、owner relay。D-062: Writer と別 vendor 要件は Fable 起草のため Sonnet/Codex どちらでも充足）
- Final Reviewer: Codex（owner relay）
- Reviewed Content HEAD: 046ef8f
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required（R3 は原則 hosted final 1 run — docs/ci.md Risk Routing。docs-only の paths-ignore で auto run が作成されない場合は CI-TRIGGER-D1 に従い `workflow_dispatch` を 1 回実行し、PR HEAD = PR body L1 SHA = hosted headSha の三点一致を merge 条件とする。Final Review round 1 P2-1 是正 — 当初の not-required は誤分類）
- Human Gate: owner plan 承認 / Ready 承認（docs-only のため L3 なし。スキャナ実測は実装 PR 側 L3）

## Owner Effort Budget

- 介入回数上限: 3（plan 承認 / Codex relay 起点 / Ready 承認）
- 実働時間上限: 30分
- relay 往復上復: 3（Codex プラン全体レビュー想定 2 round + 予備 1）

承認依頼フォーマット: `この change での介入 N 回目 / 予算 3 回` + 利用者可視の完了 1 文。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

（Codex レビューは通常の発注書 relay 方式。§5.5 の order branch 分離は使わない）

## Risk

Risk: R3

Reason:
5 画面横断で operator の主要入力動線（スキャン一挙動追加フロー）に隣接する設計契約の拡張。挙動退行が起きると全取引記録の入力速度に直結する。design-first docs-only だが、確定する契約が後続実装 PR の凍結義務になるため R3。

## Goal

Goal Invariant:

### 最小完了条件

- 取引 4 画面 + 棚卸しの商品追加欄に「入力中の live 候補プレビュー」を追加するための設計契約（variant B）が、5 画面 function-design doc + 横断正本（component-catalog / UI_TECH_STACK）に確定し、後続実装 PR を発注書 1 本で Codex に出せる状態になる。

### 失敗定義

- Enter commit（スキャン一挙動追加）経路の意味論が 1 箇所でも変更される設計になった場合。
- 契約に実装者の任意解釈余地（発火条件・破棄条件・キーボード分岐の曖昧さ）が残った場合。

### 非目的

- 実装そのもの（後続 PR）。
- 5 画面の既存 commit 経路コード（`handleProductSearch` / `resolveItem` / focus 復帰 / IME guard）のリファクタ・共通化。
- SearchBar 系 live 型 3 画面（商品一覧 / 在庫照会 / 入出庫履歴）の変更。
- Enter commit 後の既存「複数件候補テーブル」の変更・プレビューへの統合。
- 新規 npm 依存の追加（`cmdk` 等は不採用を契約化する）。

## Scope

- `docs/function-design/61-ui-receiving.md`: UI-02-D14 新設（live 候補プレビュー契約）+ §61.5 表示・操作追記
- `docs/function-design/62-ui-manual-sale.md`: UI-04-D16 新設 + §62.5 追記
- `docs/function-design/63-ui-return-exchange.md`: UI-03-D21 新設 + §63.5 追記
- `docs/function-design/64-ui-disposal.md`: UI-05-D16 新設（UI-05-D15 async lock との整合明記込み）+ §64.5 追記
- `docs/function-design/73-ui-stocktake.md`: UI-10-D12 新設（UI-10-D2 / D11 との接続明記）+ §73.5 追記
- `docs/design-system/02-component-catalog.md`: 新 pattern ⑮「商品追加欄 live 候補プレビュー（ProductAddSuggest）」正本新設（component / hook の API 契約・a11y 構造・SearchBar §⑨ との使い分け境界）
- `docs/UI_TECH_STACK.md`: §5.3 バーコードスキャナー連携へ「候補プレビューは commit 経路に不干渉」の横断 1 段落、§5.4 フォーカス管理へ「focus は input 保持（aria-activedescendant 方式）」追記
- `docs/SCREEN_DESIGN.md`: 商品追加欄再掲箇所の同期
- `docs/Plans.md`: backlog 行へ着手注記 + 「次の行動」active packet link
- 本 packet + Test Design Matrix

## Non-scope

- `src/` 配下の一切（実装 PR で実施）
- 既存 test の変更（既存 test は後続実装の回帰安全網としてそのまま維持）
- `search_products` backend / bindings / per_page 定数（D-031）の変更
- 複数件候補テーブルのキーボード操作追加（プレビュー側にのみ新設。テーブル側は現状維持で明示除外）

## Acceptance Criteria

- AC1: 新設 5 D-ID（UI-02-D14 / UI-04-D16 / UI-03-D21 / UI-05-D16 / UI-10-D12）が各 doc の設計判断表 + 表示・操作節に存在し、`rg -c` で各 doc 内 2 箇所以上に出現する
- AC2: SPEC-SUGGEST-D1〜D10（下記 Spec Contract）の各契約文が catalog ⑮ 正本に 1 対 1 で存在する（検査 = Matrix M-A6〜M-A15・M-A18〜M-A26 の `rg -c "<literal>" docs/design-system/02-component-catalog.md` が全て期待 count で PASS）
- AC3: 「supported sequence〈バーコード文字列 + Enter〉が候補 async 読込みと無関係に既存 commit 経路へ到達する」根拠（入力変化時の active 同期解除 + リスト close + 自動 active 化禁止 + close 時 timer cancel / in-flight 不採用 = timing 非依存の software contract）が catalog ⑮ に明文化されている（観測 = Matrix M-A7・M-A22・M-A24・M-A26 の `rg -c` PASS）
- AC4: `scripts/local-ci.sh full` PASS/CLEAN（docs-only、doc-consistency / traceability 差分なし）
- AC5: Plans.md backlog 行と「次の行動」が本 packet へ link し PK4 を充足する
- AC6: Codex によるプラン全体レビューが実施され、P1/P2 = 0 で closure している（証跡 = PR body に verdict「Plan Gate closure 可（P1/P2=0）」を転記し `gh pr view --json body` で確認可能。round 別 findings と裁定は本 packet の Review Response 節に記録）

## Design Sources

- Requirements / spec: REQ-201〜204（取引 4 画面）、棚卸し（73）
- Architecture: `docs/ARCHITECTURE.md`（UI -> CMD -> BIZ -> IO 境界。本 change は UI 層のみ）
- Function / command / DTO: `docs/function-design/20-io-product-repo.md`（search_products 契約）/ `40-cmd-product.md` / `30-biz-product-service.md`
- Screen / UI: `61-ui-receiving.md` / `62-ui-manual-sale.md` / `63-ui-return-exchange.md` / `64-ui-disposal.md` / `73-ui-stocktake.md` / `65-inventory-record-traceability.md`（TRACE-D12 live 意味論）/ `50-ui-product-list.md`（UI-01a-D9）
- Design system: `docs/design-system/02-component-catalog.md` §⑨ / `docs/UI_TECH_STACK.md` §5.3・§5.4・§5.7
- Decision log / ADR: 該当 D なし（商品検索系判断は画面別 D-ID 管理、実査 2026-08-04 で確認済み）。D-031（pagination clamp）は参照のみ

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 変更なし（search_products 流用） | existing sufficient |
| Command / DTO / generated binding / wire shape | 変更なし | existing sufficient |
| DB / transaction / audit / rollback / migration | 変更なし | existing sufficient |
| Screen / UI / route state / Japanese wording | 61/62/63/64/73 + catalog ⑮ + UI_TECH_STACK §5.3/§5.4 | updated in this PR |
| CSV / TSV / report / import / export format | 変更なし | existing sufficient |
| Durable decision / ADR | 画面別 D-ID + catalog 正本で保持（decision-log 新 D は不要 — 横断判断は catalog ⑮ が正本） | updated in this PR |

## Registration / Generation Obligations

該当なし（docs-only。route / command / doc 新設なし — catalog は既存 doc への節追加。REQ coverage 変更なしのため traceability 再生成差分なしを AC4 で確認）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-201 | 61 §61.1/§61.5 | UI-02-D14 | variant B（commit 維持 + プレビュー追加）。純 autocomplete はスキャナ Enter race で退行のため不採用（backlog 起票時 owner 方針） | 後続実装 PR | 後続実装 PR + Matrix anchor |
| REQ-203 | 62 §62.1/§62.5 | UI-04-D16 | 同上 | 同上 | 同上 |
| REQ-202 | 63 §63.1/§63.5 | UI-03-D21 | 同上 | 同上 | 同上 |
| REQ-204 | 64 §64.1/§64.5 | UI-05-D16 | 同上 + UI-05-D15 lock ref との stale 破棄整合 | 同上 | 同上 |
| 棚卸し | 73 §73.3/§73.5 | UI-10-D12 | suggest fetch は searchProducts、確定は UI-10-D2 既存経路。D11 focus 契約不変 | 同上 | 同上 |
| 横断 | catalog ⑮ | SPEC-SUGGEST-D1〜D10 | 下記 Spec Contract | 同上 | Matrix M-A 系 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history: catalog ⑮ に「なぜ variant B か（スキャナ race）」「なぜ cmdk 不採用か（供給網防御下の依存追加回避 + 既存 radix-ui で不足）」を理由ごと正本化する
- Plan-only durable decisions found and promoted: 実装形態（プレビュー層のみ共通部品化、commit 経路 5 箇所は不変）を catalog ⑮ へ昇格
- Assumptions and constraints: HID スキャナは「コード文字列 + Enter」を高速送出するという運用前提（UI-02-D5 の拡張）は UX 見込み（debounce 中の候補非発火）にのみ関与する。安全性は D2 の入力変化時 active 同期解除 + リスト close、D4 の close 時 timer cancel / in-flight 不採用により、supported sequence「バーコード文字列 + Enter」の範囲で timing 非依存に成立する。方向キーを挿入する sequence は入力契約の対象外（L3 は機器の supported sequence 適合の互換性確認 + UX 確認）
- Deferred design gaps: 複数件候補テーブルとプレビューの将来統合は非目的として defer（要望発生時に別 change）
- Test Design Matrix can cite design decision IDs: M 系 anchor が各 D-ID / SPEC-SUGGEST-Dn を引用
- Absolute guarantee / escape hatch self-check: 「既存 commit 経路不変」は全 5 画面の既存 test（T17/T23 含む）が実装 PR の凍結義務として担保。例外なし

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | UI 層内で完結。CMD/BIZ/IO 不変 | not applicable |
| Fact check / design decision split | 実装実査 + 契約実査（2026-08-04、Explore 2 系統）で 5 画面コピペ実装・catalog 不在・radix-ui Popover 同梱を事実確認済み | 本 packet 実査記録 |
| Lifecycle / retry | suggest fetch の stale 破棄・form lock 連動を SPEC-SUGGEST-D4/D10 で契約化 | Matrix State Lifecycle |
| Operator workflow | スキャン一挙動フロー不変が Goal Invariant。候補プレビューは目視補助のみ | 実装 PR L3 |
| Replacement path | 置換なし（追加のみ）。既存候補テーブルは残置を明示 | Non-scope |
| Data safety / evidence | 実データ不使用（docs-only） | Data Safety 節 |
| Reporting / accounting semantics | not applicable（表示層のみ） | — |
| Manual verification | スキャナ実測は supported sequence 適合の互換性確認 + UX 確認として実装 PR L3 に前積み（安全性は software contract、保証 scope は Codex round 2 P1-1 裁定で確定） | Ledger L3 行 |
| 環境・再現性 | 新規環境依存なし（npm 依存追加ゼロを契約化） | SPEC-SUGGEST-D9 |

## Design Readiness

- Existing design docs are sufficient because: 変更対象 5 画面の commit 型契約・IME・focus 契約は正本化済み（UI-02-D4/D5、UI-04-D4/D5、UI-03-D9/D10、UI-05-D5/D6/D15、UI-10-D2/D11）で、本 PR はそれらへの「追加層」契約を拡張 amendment する
- Source docs updated in this PR: Scope 節参照
- Design gaps intentionally deferred: 候補テーブル統合 / daily-report 系への展開なし
- Layer ownership: UI のみ
- Backend function design: 不変
- Command / DTO / data contract: 不変（ProductSearchQuery 流用、per_page はプレビュー専用値 5 を UI 側定数で持つ — D-031 clamp と無関係）
- Persistence / transaction / audit impact: なし
- Operator workflow / Japanese UI wording: 候補行 = 商品コード + 商品名 + 部門名、footer 文言「ほか N 件（候補未選択で Enter: 従来の検索）」を catalog ⑮ で確定
- Error, empty, retry, and recovery behavior: fetch 失敗は silent close（commit 経路の error 表示と分離）、0 件は非表示
- Testability and traceability IDs: 各 D-ID + SPEC-SUGGEST-Dn

## Contract Probe

- N/A: 本 design が Plan Gate 前の probe を要する未検証外部前提は存在しない。安全性は既存正本が規定する supported sequence「バーコード文字列 + Enter」の範囲で timing 非依存に成立する — active は入力値変化の onChange event で同期解除 + リスト close（D2）、pending timer / in-flight 応答は close event 群で不採用（D4）。ArrowUp / ArrowDown を挿入する event sequence は当該入力契約の対象外であり、方向キー有無そのものへの無条件保証は主張しない（software では人間とスキャナの方向キーを識別できないため。Codex round 1 P1-2 裁定 b + round 2 P1-1 裁定で scope 確定）。物理挙動は「debounce 200ms 下で候補 fetch がほぼ発火しない」という UX 見込みにのみ関与し、実装 PR の L3 スキャナ実測は「使用機器が supported sequence に適合することの互換性確認 + UX 確認」として Ledger に維持する。新規 npm 依存・新規 library 挙動への依存もなし（素の絶対配置要素 + 既存 React のみ）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| UI-02-D14（61 追記） | 本 PR docs | Matrix M-A1（anchor 検査） | 実装は後続 PR |
| UI-04-D16（62 追記） | 本 PR docs | M-A2 | 同上 |
| UI-03-D21（63 追記） | 本 PR docs | M-A3 | 同上 |
| UI-05-D16（64 追記、D15 整合文含む） | 本 PR docs | M-A4 | 同上 |
| UI-10-D12（73 追記、D2/D11 接続文含む） | 本 PR docs | M-A5 | 同上 |
| SPEC-SUGGEST-D1〜D10（catalog ⑮） | 本 PR docs | M-A6〜M-A15、M-A18〜M-A26（rally + Codex review 是正追補） | 同上 |
| UI_TECH_STACK §5.3/§5.4 追記 | 本 PR docs | M-A16 | 同上 |
| SCREEN_DESIGN 再掲同期 | 本 PR docs | M-A17 | 同上 |
| Plans.md link（PK4） | 本 PR docs | doc-consistency PK4 | — |
| スキャナ実測（機器の supported sequence〈バーコード文字列 + Enter〉適合の互換性確認 + UX 確認〈debounce 下の候補非発火〉。安全性は D2/D4 の software contract 側で担保） | 後続実装 PR | — | 実装 PR L3 行（前積み） |
| 既存 commit 経路 test 不変（T17/T23 ほか全画面） | 後続実装 PR | 既存 suite green | 実装 PR 凍結義務 |

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-08-04-product-add-suggest-design.md`

- targeted tests: 契約 anchor の rg 検査（M-A 系、uniqueness 込み）、doc-consistency-check、traceability 差分なし
- negative tests: anchor mutation（契約 bullet 削除 / 数値改変）で M 系検査 red（X 系）
- compatibility checks: 既存 D-ID（UI-02-D4 等）の文言不変（M-C 系）
- data safety checks: 実データなし
- main wiring/integration checks: Plans.md link → PK4

## Boundary / Wire Contract

- producer: `commands.searchProducts`（既存、変更なし）
- consumer: 新設 suggest hook（実装 PR）
- wire type: `ProductSearchQuery` / `PaginatedResult<ProductWithRelations>`（不変）
- internal type: 候補行表示は product_code / name / department_name の 3 field のみ参照
- precision/range: per_page 5（UI 定数、D-031 clamp 200 の範囲内）
- round-trip path: なし（表示のみ、永続化なし）
- invalid input: 空文字・composing 中でも fetch 契約は SPEC-SUGGEST-D3/D5 に従う
- compatibility: 既存呼び出し 7 箇所の query 形は不変

## Review Focus

- SPEC-SUGGEST-D2（Enter 分岐）が「スキャナ一挙動フロー不変」を本当に構造的に保証しているか（自動 active 化を許す抜け道が文言にないか）
- SPEC-SUGGEST-D4（stale 破棄）と UI-05-D15（disposal の lock ref）の整合
- IME 意味論（D5）が SearchBar live 既定（PR #61 P1-2 裁定 a）と矛盾しないか
- 5 画面 D-ID 文言の横並び一致（batch 系で頻発した sweep 漏れ同型の防止）
- 棚卸し（UI-10-D12）の確定経路が UI-10-D2 の find_stocktake_item 意味論を壊さないか

## Spec Contract

Contract ID: SPEC-SUGGEST

- D1（二層構造・不干渉）: live 候補プレビューは表示専用の追加層である。既存 Enter commit 経路（検索実行・0/1/複数分岐・行追加・focus 復帰・IME guard）のロジックは変更しない。suggest 層の失敗（fetch error 含む）は commit 経路へ波及せず、候補非表示に縮退する。
- D2（Enter 分岐）: 候補リストに active 候補（aria-activedescendant が指す行）が存在する場合のみ Enter は候補確定として動作する。active 候補は ↓/↑ キー操作によってのみ生成される（表示直後の自動 active 化・先頭行自動選択は禁止）。active 候補なしの Enter は常に既存 commit 経路を実行する。候補リストの内容が更新された場合（debounce 再 fetch による差し替え）、直前の active 候補は必ず解除し持ち越さない（更新直後の Enter が意図しない行を確定することを防ぐ）。新しいリストで active を得るには再度 ↓/↑ の操作を要する。さらに、入力値が変化した onChange event の時点で active 候補を同期的に解除する。同時に表示中のリストを close し、新しいリストは現在入力値に対する最新結果の採用後にのみ open する（旧リストの表示維持・click 操作は行わない — pointer 経路の stale 確定を構造的に排除）。この同期解除 + close により、Enter commit 経路の到達はスキャナ timing・debounce 残量に依存しない。
- D3（発火条件）: debounce 200ms（TRACE-D12 と同値）。入力 1 文字以上で発火。取得は per_page 5、総件数超過時は候補末尾に「ほか N 件（候補未選択で Enter: 従来の検索）」を表示する。0 件時は非表示（メッセージなし。0 件文言は既存 commit 経路の所掌）。
- D4（破棄条件）: suggest fetch は sequence token で直近要求のみ採用する。sequence generation は各入力変更時（debounce 開始前）に更新し、応答は token と検索語が現在入力値の双方に一致する場合のみ採用する。Enter commit 実行・入力欄 clear・候補確定・lock 成立・Esc・blur / Tab・unmount の各時点では、リスト / active の close に加え、pending debounce timer を cancel し、generation を進めて in-flight 応答（success / error とも）を不採用にする。保存 lock との整合は D10 の per-画面 lock source 契約に従う（disposal のみ UI-05-D15 の lock ref、取引 3 画面〈receiving / manual-sale / return-exchange〉は各画面の既存 `isFormLocked` 派生 state、棚卸しは既存 `isCompleting`〈`completeMutation.isPending`〉派生 state を単一 source とする）。
- D5（IME）: suggest 層の onKeyDown は冒頭で `event.nativeEvent.isComposing` を判定し、true の間は Enter / ↓ / ↑ / Esc を含む suggest キー処理全体を行わず IME に委ねる（変換候補操作の方向キーで active を生成しない。既存 commit 経路の Enter guard も従来どおり維持）。onChange / debounce 経路に composing guard は置かず、変換途中文字列での候補更新を許容する（SearchBar live 型の既定意味論 = PR #61 P1-2 裁定 a と同一）。
- D6（キーボード・a11y）: input は `role="combobox"` + `aria-expanded` + `aria-controls` + `aria-activedescendant`、リストは `role="listbox"`、行は `role="option"`。focus は常に input が保持する（リストへ focus 移動しない）。↓/↑ で active 移動（端で wrap しない）、Esc で close + active 解除、blur / Tab で close。候補行のクリックは active の有無に関わらず当該行の即時候補確定として扱い、D7 の同一 handler を呼ぶ（`onMouseDown` 時点で default を抑止し、input の blur による close との race を防ぐ）。マウス hover（mouseenter 等）は active 候補を生成しない（active 生成は D2 の ↓/↑ 経由に限定）。footer 行（「ほか N 件…」）は `role="option"` を持たない非選択の装飾行であり、↓/↑ による active 移動の対象外とする。footer 表示中に active 候補なしで Enter を押した場合の挙動は D2 の既定分岐（既存 commit 経路の実行）と同一であり、footer 文言の「候補未選択で Enter: 従来の検索」はその結果（既存 commit 経路へ戻ること）を指し、全一致件数の表示を保証しない。
- D7（候補行表示・確定 semantics）: 候補行は商品コード + 商品名 + 部門名の統一 3 項目（画面固有列は出さない）。候補確定時の挙動は当該画面の既存「複数件候補テーブルからの選択」と同一 handler を通す。
- D8（棚卸し）: 棚卸しの suggest fetch は `searchProducts`（部分一致）を用い、候補確定は既存 UI-10-D2 の `find_stocktake_item` 経由で棚卸し対象化する。UI-10-D11 の focus 遷移契約（解決成功で数量欄へ）は候補確定経由でも同一に発火する。候補確定後に `find_stocktake_item` が稀に `None` を返す場合は既存 `selectCandidate` の無言 no-op 挙動をそのまま継承する（既知の pre-existing gap、本 change の scope 外）。
- D9（実装形態・依存）: プレビュー層は新規共通 component + hook として 1 箇所に実装し 5 画面へ配線する。新規 npm 依存は追加しない（cmdk 不採用。radix Popover も不使用 — focus 非奪取要件から素の絶対配置要素で実装）。既存 5 画面の commit 経路コードの共通化・移動は行わない。
- D10（無効化条件）: form 保存中 lock / disabled 状態では suggest fetch を発火せず、表示中リストは close する。suggest 層は各画面の既存 lock 状態を単一 source として受け取り、新規の lock 機構を作らない。disposal では UI-05-D15 の lock ref がその source である（二重 lock の相互不整合を構造的に排除する）。catalog ⑮ の component / hook API は、候補操作・timer・応答採否の全てが読む同期 `isLocked(): boolean` と、保存 event から同期呼出しされる `invalidateAndClose()` を持つ。disposal は UI-05-D15 の lock ref を更新した同じ event 内で `invalidateAndClose()` を呼ぶ（これは新規 lock source ではない）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-SUGGEST-D1 | catalog ⑮ 起草 | M-A6 / X1 | 不干渉の絶対保証 | rg anchor |
| SPEC-SUGGEST-D2 | 同上 | M-A7・M-A18・M-A22・M-A26 / X2・X9・X13・X17 | スキャナ race 構造解決 + active 持ち越し禁止 + onChange 同期解除・リスト close（timing 非依存） | rg anchor |
| SPEC-SUGGEST-D3 | 同上 | M-A8 / X3 | 数値（200ms/5 件）+ footer 文言の Enter 分岐整合 | rg anchor |
| SPEC-SUGGEST-D4 | 同上 | M-A9・M-A21・M-A23・M-A24 / X4・X12・X14・X15 | sequence lifecycle（token+検索語二重一致）+ close 時 cancel + lock source 3 分類 | rg anchor |
| SPEC-SUGGEST-D5 | 同上 | M-A10 / X5 | SearchBar 既定整合 | rg anchor |
| SPEC-SUGGEST-D6 | 同上 | M-A11・M-A19・M-A20 / X6・X10・X11 | a11y 構造 + pointer 契約（click 確定 / hover 非生成）+ footer 非選択 | rg anchor |
| SPEC-SUGGEST-D7 | 同上 | M-A12 | 確定 semantics 同一性 | rg anchor |
| SPEC-SUGGEST-D8 | 73 追記 | M-A13 / M-A5 | UI-10-D2/D11 接続 | rg anchor |
| SPEC-SUGGEST-D9 | catalog ⑮ | M-A14 / X7 | 依存追加ゼロ | rg anchor |
| SPEC-SUGGEST-D10 | catalog ⑮ | M-A15・M-A25 / X16 | lock 連動 + hook API 境界（isLocked / invalidateAndClose） | rg anchor |
| 画面別 D-ID ×5 | 各 doc 追記 | M-A1〜A5 / X8 | 横並び一致 | rg anchor |

## Data Safety

- 実店舗データ・実商品名は例示に使わない（synthetic 例のみ）
- local-only paths: なし
- committed 対象は docs/ のみ

## Implementation Results

PR #64（squash merge、2026-08-05）で設計契約を正本化した。catalog ⑮（SPEC-SUGGEST-D1〜D10 + variant B 採用背景 + durable 適用 manifest）、画面別 5 D-ID、UI_TECH_STACK §5.3/§5.4、SCREEN_DESIGN 再掲 2 節、pattern 数索引（15）を同期。exact-HEAD evidence・hosted run・三点一致は PR body を正とする（D-035）。後続 = 実装 PR の Codex 発注（本 packet の Ledger「後続実装 PR」行 + 既存 test 凍結義務 + L3 スキャナ互換性確認を発注書へ引き継ぐ）。

## Review Response

- Plan Gate（2026-08-04〜05）: Sonnet 5 独立 rally 3 round（P1×3 / P2×5 / P3×3、全 accept — 是正 `9be88a0` / `cdd325f` / `9ba8c31`）→ Codex プラン全体レビュー 4 round（P1×3 / P2×13 / P3×2、全 accept — 是正 `ff3479e` / `db0cb45` / `3a69c32`。相互修正案方式、owner relay 4 往復）→ round 4 verdict「Plan Gate closure 可（P1/P2=0）」。主要な設計改善 = active の onChange 同期解除 + リスト close による timing 非依存化（Codex P1-1 起点）、安全性保証の supported sequence scope 確定（同 round 2 P1-1）、pointer 経路の stale 確定排除（同 P2-1）。設計骨格（variant B・二層不干渉・↓/↑限定 active 生成）は初版から不変。
- 遷移記録（recording compression）: 本 state-only commit は `plan-gate -> plan-approved -> implementing` の隣接 forward 遷移を一括実体化する。中間遷移の evidence = plan-approved: owner plan 承認 2026-08-05（介入 1/3、承認文言は会話記録、PR body へ転記予定）+ Plan Gate closure verdict「Plan Gate closure 可（P1/P2=0）」（上記 Plan Gate 記録）/ implementing: plan-first commit `61cd269` が amendment 執筆着手に先行して確定済み。
- Final Review（Codex、owner relay）round 1（2026-08-05）: P1=0 / P2×4 全 accept — (1) Hosted CI Requirement を required へ是正（docs/ci.md Risk Routing 突合で「docs-only = not-required」が誤分類と確認。paths-ignore で auto run が無い場合は workflow_dispatch 1 回 + 三点一致）、(2) catalog ⑮ の適用 manifest を durable 化（Plan Packet 委譲を廃し、D-ID 5 列挙 + 除外 3 画面 / 候補テーブルを catalog 本文へ明記）、(3) 73 §73.5 step 2 の「既存 patterns/SearchBar」記述を実装実態（素の Input）+ ⑮ 結線へ是正（pre-existing drift、UI-10-D12 との矛盾解消）、(4) footer 文言を「候補未選択で Enter: 従来の検索」へ変更（既存 Enter 検索は per_page 10 の先頭ページのみで「全件検索」は実在しない能力の約束 — packet/catalog 計 5 hit を同期し、D6 へ「全一致件数の表示を保証しない」を明記）。是正過程の隣接発見 = catalog 見出し「14 パターン」/ README 索引「13 パターン」の pre-existing 数 drift を 15 へ一括同期（⑭ 追加時の未追随含む）。Ledger 不適合 2 行（UI-10-D12 / SPEC-SUGGEST-D1〜D10）は本是正で解消見込み — closure round で再判定。Codex は mutation 23 変種の独立再実測（全 RED、X8 cross green）と L1 full 独立実走（PASS/CLEAN）も完了済み。数値の実測 evidence: per_page 10 = reviewer 引用の実 file:line（`ReceivingPage.tsx:54` / `ManualSalePage.tsx:61` / `ReturnExchangePage.tsx:64` / `DisposalPage.tsx:60` / `StocktakePage.tsx:100`、`rg -F -n "per_page: 10" src/features` で確認可）、「全件検索」5 hit = 是正前の `rg -n "全件検索" docs/plans/ docs/design-system/` 出力（packet 3 + catalog 2）、23 変種 = Matrix X1〜X17 の変種内訳（X12 3 変種 + X14/X15/X16/X17 各 2 変種 + 単発 12）で `python3 mutation_run.py` 実行出力 23 行と一致。
- Final Review closure（2026-08-05）: 4 是正 + 隣接是正 + PK6 全て CLOSED、Ledger 不適合 2 行は適合へ再判定、packet↔catalog D1〜D10 diff 0 維持。verdict「Final Review PASS（P1/P2=0、Findings Freeze 可）」（audited content HEAD = 046ef8f、Codex 独立検証: doc-consistency 全通過 / PR #64 headRefOid 一致 / tree CLEAN）。
- 遷移記録（recording compression）: 本 state-only commit は `implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final` の隣接 forward 遷移を一括実体化する。中間遷移の evidence = local-verified: L1 full RESULT=PASS / CLEAN（HEAD 6cceccb、evidence log は .local/ci-evidence/。以降の commit は docs/plans + catalog/README/73 の review 是正のみで、Codex が 046ef8f にて doc-consistency 全通過を独立確認。046ef8f 直後にも L1 full PASS/CLEAN を実測済み — 59e0bac 時点の evidence log 参照）/ independent-review: 上記 Final Review PASS（P1/P2=0、audited content HEAD 046ef8f）/ human-confirm: Findings Freeze 発効 + Reviewed Content HEAD 設定（本 commit）+ owner Ready 承認 2026-08-05（介入 2/3。relay 実績 6/3 の超過は事前明示 + 承認時容認）/ ready-hosted-final: owner が PR #64 を Ready 化済み（draft=false 実確認）、Ready event での hosted auto run なし（docs-only paths-ignore、`gh run list` 0 件で確認）。本遷移 commit HEAD で exact-HEAD L1 full を再実行し、CI-TRIGGER-D1 の `workflow_dispatch` 1 回 + 三点一致確認へ進む。merge・closeout は owner 委任（2026-08-05）。
- 運用逸脱記録（STATECAP、append-only）: 当初 human-confirm 遷移（旧 59e0bac）と ready-hosted-final 遷移（旧 eabc5d1）を別 commit で積み、state-only 遷移 4 件で STATECAP 上限 3 を超過（check-workflow-git が検出。push 前検査を怠り旧 eabc5d1 は一時 push された）。是正 = 両遷移の evidence が本 commit 時点で全て揃っているため、単一 state-only commit への統合（recording compression、gate skip なし）で cap 内へ復帰し force-with-lease で置換。旧 SHA 59e0bac / eabc5d1 は本記録にのみ残す。
- Findings Freeze: **frozen after Final Review closure（2026-08-05）**; post-freeze exceptions: none
