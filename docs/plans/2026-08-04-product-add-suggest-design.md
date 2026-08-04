# Plan Packet: 商品追加欄 live 候補プレビュー（variant B）design-first

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 61cd269
- Amendments: none
- Coordinator: Fable 5（main thread）
- Writer: Fable 5（design amendment 起草。docs-only、実装 PR は本 packet の後続で Codex 発注）
- Plan Reviewer: Sonnet 5 独立 subagent（rally）+ Codex（プラン全体レビュー、owner relay。D-062: Writer と別 vendor 要件は Fable 起草のため Sonnet/Codex どちらでも充足）
- Final Reviewer: Codex（owner relay）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: not-required（docs-only、`paths-ignore` 構成どおり。Ready 時に変更 path 実績で CI-TRIGGER-D1 の 4 state から再判定）
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
- AC2: SPEC-SUGGEST-D1〜D10（下記 Spec Contract）の各契約文が catalog ⑮ 正本に 1 対 1 で存在する（anchor literal は Matrix 参照）
- AC3: 「スキャナ Enter が候補 async 読込み前に届いても既存 commit 経路が実行される」根拠（自動 active 化禁止 + debounce）が catalog ⑮ に明文化されている
- AC4: `scripts/local-ci.sh full` PASS/CLEAN（docs-only、doc-consistency / traceability 差分なし）
- AC5: Plans.md backlog 行と「次の行動」が本 packet へ link し PK4 を充足する
- AC6: Codex によるプラン全体レビューが実施され、P1/P2 = 0 で closure している（owner relay 証跡は PR body）

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
- Assumptions and constraints: 本 change が新規に置く物理前提（UI-02-D5 の HID キーボード前提の拡張であり、D5 自体は方向キーに言及しない）: HID スキャナは「コード文字列 + Enter」を人間のタイピングより高速に送出し、方向キーは送出しない。実装 PR L3 での実機検証必須（Ledger 前積み済み）
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
| Manual verification | スキャナ実測（debounce 200ms 下で候補 fetch 非発火 + Enter commit 不変）は実装 PR L3 必須項目として Ledger に前積み | Ledger L3 行 |
| 環境・再現性 | 新規環境依存なし（npm 依存追加ゼロを契約化） | SPEC-SUGGEST-D9 |

## Design Readiness

- Existing design docs are sufficient because: 変更対象 5 画面の commit 型契約・IME・focus 契約は正本化済み（UI-02-D4/D5、UI-04-D4/D5、UI-03-D9/D10、UI-05-D5/D6/D15、UI-10-D2/D11）で、本 PR はそれらへの「追加層」契約を拡張 amendment する
- Source docs updated in this PR: Scope 節参照
- Design gaps intentionally deferred: 候補テーブル統合 / daily-report 系への展開なし
- Layer ownership: UI のみ
- Backend function design: 不変
- Command / DTO / data contract: 不変（ProductSearchQuery 流用、per_page はプレビュー専用値 5 を UI 側定数で持つ — D-031 clamp と無関係）
- Persistence / transaction / audit impact: なし
- Operator workflow / Japanese UI wording: 候補行 = 商品コード + 商品名 + 部門名、footer 文言「ほか N 件（Enter で検索）」を catalog ⑮ で確定
- Error, empty, retry, and recovery behavior: fetch 失敗は silent close（commit 経路の error 表示と分離）、0 件は非表示
- Testability and traceability IDs: 各 D-ID + SPEC-SUGGEST-Dn

## Contract Probe

- N/A: 本 design は新規外部依存・未検証外部前提を導入しない（radix Popover は不採用側の判断、採用側は素の絶対配置 div + 既存 React のみ）。唯一の物理前提「HID スキャナは方向キーを送らず keystroke 間隔 < 200ms」は本 change が新規に置く前提（UI-02-D5 の HID キーボード前提の拡張。D5 自体は方向キー非送出を保証しない）であり、実装 PR の L3 スキャナ実測項目として Ledger に前積みする（design PR 内では検証不能のため）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| UI-02-D14（61 追記） | 本 PR docs | Matrix M-A1（anchor 検査） | 実装は後続 PR |
| UI-04-D16（62 追記） | 本 PR docs | M-A2 | 同上 |
| UI-03-D21（63 追記） | 本 PR docs | M-A3 | 同上 |
| UI-05-D16（64 追記、D15 整合文含む） | 本 PR docs | M-A4 | 同上 |
| UI-10-D12（73 追記、D2/D11 接続文含む） | 本 PR docs | M-A5 | 同上 |
| SPEC-SUGGEST-D1〜D10（catalog ⑮） | 本 PR docs | M-A6〜M-A15、M-A18〜M-A20（rally 是正追補: D2 active 解除 / D6 pointer / D6 footer） | 同上 |
| UI_TECH_STACK §5.3/§5.4 追記 | 本 PR docs | M-A16 | 同上 |
| SCREEN_DESIGN 再掲同期 | 本 PR docs | M-A17 | 同上 |
| Plans.md link（PK4） | 本 PR docs | doc-consistency PK4 | — |
| スキャナ実測（debounce 下の非発火 + commit 不変） | 後続実装 PR | — | 実装 PR L3 必須行（前積み） |
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
- D2（Enter 分岐）: 候補リストに active 候補（aria-activedescendant が指す行）が存在する場合のみ Enter は候補確定として動作する。active 候補は ↓/↑ キー操作によってのみ生成される（表示直後の自動 active 化・先頭行自動選択は禁止）。active 候補なしの Enter は常に既存 commit 経路を実行する。候補リストの内容が更新された場合（debounce 再 fetch による差し替え）、直前の active 候補は必ず解除し持ち越さない（更新直後の Enter が意図しない行を確定することを防ぐ）。新しいリストで active を得るには再度 ↓/↑ の操作を要する。
- D3（発火条件）: debounce 200ms（TRACE-D12 と同値）。入力 1 文字以上で発火。取得は per_page 5、総件数超過時は候補末尾に「ほか N 件（Enter で検索）」を表示する。0 件時は非表示（メッセージなし。0 件文言は既存 commit 経路の所掌）。
- D4（破棄条件）: suggest fetch は sequence token で直近要求のみ採用する。Enter commit 実行・入力欄 clear・候補確定・form lock 成立の各時点で pending fetch の結果は破棄し、リストを close する。保存 lock との整合は D10 の per-画面 lock source 契約に従う（disposal のみ UI-05-D15 の lock ref、他 4 画面は各画面の既存 `isFormLocked` 派生 state を単一 source とする）。
- D5（IME）: `event.nativeEvent.isComposing` guard は Enter keydown のみ（既存 guard を最優先で維持）。onChange / debounce 経路に composing guard は置かず、変換途中文字列での候補更新を許容する（SearchBar live 型の既定意味論 = PR #61 P1-2 裁定 a と同一）。
- D6（キーボード・a11y）: input は `role="combobox"` + `aria-expanded` + `aria-controls` + `aria-activedescendant`、リストは `role="listbox"`、行は `role="option"`。focus は常に input が保持する（リストへ focus 移動しない）。↓/↑ で active 移動（端で wrap しない）、Esc で close + active 解除、blur / Tab で close。候補行のクリックは active の有無に関わらず当該行の即時候補確定として扱い、D7 の同一 handler を呼ぶ（`onMouseDown` 時点で default を抑止し、input の blur による close との race を防ぐ）。マウス hover（mouseenter 等）は active 候補を生成しない（active 生成は D2 の ↓/↑ 経由に限定）。footer 行（「ほか N 件…」）は `role="option"` を持たない非選択の装飾行であり、↓/↑ による active 移動の対象外とする。footer 表示中に active 候補なしで Enter を押した場合の挙動は D2 の既定分岐（既存 commit 経路の実行）と同一であり、footer 文言の「Enter で検索」はその結果を指す。
- D7（候補行表示・確定 semantics）: 候補行は商品コード + 商品名 + 部門名の統一 3 項目（画面固有列は出さない）。候補確定時の挙動は当該画面の既存「複数件候補テーブルからの選択」と同一 handler を通す。
- D8（棚卸し）: 棚卸しの suggest fetch は `searchProducts`（部分一致）を用い、候補確定は既存 UI-10-D2 の `find_stocktake_item` 経由で棚卸し対象化する。UI-10-D11 の focus 遷移契約（解決成功で数量欄へ）は候補確定経由でも同一に発火する。候補確定後に `find_stocktake_item` が稀に `None` を返す場合は既存 `selectCandidate` の無言 no-op 挙動をそのまま継承する（既知の pre-existing gap、本 change の scope 外）。
- D9（実装形態・依存）: プレビュー層は新規共通 component + hook として 1 箇所に実装し 5 画面へ配線する。新規 npm 依存は追加しない（cmdk 不採用。radix Popover も不使用 — focus 非奪取要件から素の絶対配置要素で実装）。既存 5 画面の commit 経路コードの共通化・移動は行わない。
- D10（無効化条件）: form 保存中 lock / disabled 状態では suggest fetch を発火せず、表示中リストは close する。suggest 層は各画面の既存 lock 状態を単一 source として受け取り、新規の lock 機構を作らない。disposal では UI-05-D15 の lock ref がその source である（二重 lock の相互不整合を構造的に排除する）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-SUGGEST-D1 | catalog ⑮ 起草 | M-A6 / X1 | 不干渉の絶対保証 | rg anchor |
| SPEC-SUGGEST-D2 | 同上 | M-A7・M-A18 / X2・X9 | スキャナ race 構造解決 + active 持ち越し禁止 | rg anchor |
| SPEC-SUGGEST-D3 | 同上 | M-A8 / X3 | 数値（200ms/5 件）の実測整合 | rg anchor |
| SPEC-SUGGEST-D4 | 同上 | M-A9 / X4 | UI-05-D15 整合 | rg anchor |
| SPEC-SUGGEST-D5 | 同上 | M-A10 / X5 | SearchBar 既定整合 | rg anchor |
| SPEC-SUGGEST-D6 | 同上 | M-A11・M-A19・M-A20 / X6・X10・X11 | a11y 構造 + pointer 契約（click 確定 / hover 非生成）+ footer 非選択 | rg anchor |
| SPEC-SUGGEST-D7 | 同上 | M-A12 | 確定 semantics 同一性 | rg anchor |
| SPEC-SUGGEST-D8 | 73 追記 | M-A13 / M-A5 | UI-10-D2/D11 接続 | rg anchor |
| SPEC-SUGGEST-D9 | catalog ⑮ | M-A14 / X7 | 依存追加ゼロ | rg anchor |
| SPEC-SUGGEST-D10 | catalog ⑮ | M-A15 | lock 連動 | rg anchor |
| 画面別 D-ID ×5 | 各 doc 追記 | M-A1〜A5 / X8 | 横並び一致 | rg anchor |

## Data Safety

- 実店舗データ・実商品名は例示に使わない（synthetic 例のみ）
- local-only paths: なし
- committed 対象は docs/ のみ

## Implementation Results

（実装後に記入）

## Review Response

- Findings Freeze: not yet frozen
