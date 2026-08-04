# Test Design Matrix: 商品追加欄 live 候補プレビュー（variant B）design-first

## Risk

Risk: R3

## Contracts Under Test

- UI-02-D14 / UI-04-D16 / UI-03-D21 / UI-05-D16 / UI-10-D12（5 画面 doc 拡張 amendment）
- SPEC-SUGGEST-D1〜D10（catalog ⑮ 正本）
- UI_TECH_STACK §5.3/§5.4 追記、SCREEN_DESIGN 再掲同期
- 既存契約の不変性（UI-02-D4/D5、UI-04-D4/D5、UI-03-D9/D10、UI-05-D5/D6/D15、UI-10-D2/D11、TRACE-D12、UI-01a-D9）

## Failure Modes

- 契約文の欠落・片側 drift（5 画面横並びのうち 1 画面だけ文言が欠ける / ずれる）
- 「自動 active 化禁止」が落ち、スキャナ Enter が候補確定に化ける設計解釈を許す
- リスト差し替え時の active 持ち越しで、更新直後の Enter が意図しない行を確定する
- pointer 経由（hover）の active 生成、または候補行 click の確定 semantics 未定義
- footer 行（「ほか N 件」）が option 集合に含まれ、footer active 時の Enter 挙動が未定義になる
- 入力変化後も旧 active が残存し、スキャナ Enter が旧候補確定へ化ける（timing 依存の安全性）
- 入力変更後の旧リストが表示・click 可能なまま残り、現在入力と無関係な候補が確定する
- close 後の pending timer / in-flight 応答が残存し、閉じた候補が再表示される
- IME 変換中の方向キーが suggest active を生成し、確定後の Enter が候補確定へ化ける
- anchor literal が plans/archive corpus・他 D 節と衝突し mutation survivor 化する
- 数値契約（debounce 200ms / per_page 5）の無断改変
- 既存 commit 型契約文言の意図しない書き換え
- SCREEN_DESIGN 再掲の同期漏れ

## Test Matrix

anchor 検査はすべて `rg -c "<literal>" <file>` の完全一致 count で行う。anchor literal は定義文そのものに特定化する。uniqueness の対象 corpus は**変更後の source design docs（docs/function-design/ / docs/design-system/ / docs/UI_TECH_STACK.md / docs/SCREEN_DESIGN.md）に限定し、docs/plans/** と docs/archive/** は除外する**（Packet / Matrix 自身への hit は uniqueness 違反にしない）。各 anchor は対象 file・対象節ごとの exact count で固定し、amendment commit 時に検証してから凍結する（memory: matrix-anchor-uniqueness + Codex plan review round 1 P2-4 是正）。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-02-D14 | 61 doc に契約なし | CLI (rg) | M-A1: 61 の設計判断表節と §61.5 表示・操作節を節単位に分けて各々 `rg -c "UI-02-D14"` >= 1（一括 count は両節配置を保証しないため節別検査） | 設計判断表 or §61.5 追記の欠落 |
| UI-04-D16 | 62 doc に契約なし | CLI | M-A2: 同型（62 / UI-04-D16） | 同上 |
| UI-03-D21 | 63 doc に契約なし | CLI | M-A3: 同型（63 / UI-03-D21） | 同上 |
| UI-05-D16 | 64 doc に契約なし / D15 整合文なし | CLI | M-A4: 64 の設計判断表節と §64.5 表示・操作節を節単位に分けて各々 `rg -c "UI-05-D16"` >= 1、かつ D16 本文内に `UI-05-D15` 参照 exact 1 | 別節の欠落 / 同一節重複での偽 green / D15 整合の明文化漏れ |
| UI-10-D12 | 73 doc に契約なし / D2・D11 接続なし | CLI | M-A5: 73 の設計判断表節と §73.5 実装参照節を節単位に分けて各々 `rg -c "UI-10-D12"` >= 1、かつ D12 本文内に `UI-10-D2` / `UI-10-D11` 参照各 exact 1 | 別節の欠落 / 同一節重複での偽 green / 棚卸し接続契約の欠落 |
| SPEC-SUGGEST-D1 | 不干渉契約の欠落 | CLI | M-A6: catalog ⑮ 内 literal「候補非表示に縮退する」 | commit 経路への波及を許す設計へ改変 |
| SPEC-SUGGEST-D2 | 自動 active 化の抜け道 | CLI | M-A7: literal「表示直後の自動 active 化・先頭行自動選択は禁止」 | スキャナ race 防御の核が落ちる |
| SPEC-SUGGEST-D3 | 数値改変 | CLI | M-A8: literal「debounce 200ms」+「per_page 5」（catalog ⑮ 内） | 発火条件の無断変更 |
| SPEC-SUGGEST-D4 | 破棄条件欠落 | CLI | M-A9: literal「sequence token で直近要求のみ採用」 | stale 採用を許す |
| SPEC-SUGGEST-D5 | IME 意味論 drift | CLI | M-A10: literal「onChange / debounce 経路に composing guard は置かず」+ literal「suggest キー処理全体を行わず IME に委ねる」の両方（Codex P2-2 是正で keyboard branch 全域 guard 化） | SearchBar 既定と矛盾する二重 guard 化 / 変換中方向キーの active 生成 |
| SPEC-SUGGEST-D6 | a11y 構造欠落 | CLI | M-A11: literal「focus は常に input が保持する（リストへ focus 移動しない）」（D6 固有文言。aria-activedescendant は D2 にも出現し survivor 化するため不採用 — Codex P2-3 是正） | focus 移動型（focus 奪取）実装を許す |
| SPEC-SUGGEST-D7 | 確定 semantics 分裂 | CLI | M-A12: literal「既存「複数件候補テーブルからの選択」と同一 handler」（D7 凍結文と引用符まで一致 — Codex P2-3 是正） | 画面別の独自確定経路を許す |
| SPEC-SUGGEST-D8 | 棚卸し経路 drift | CLI | M-A13: literal「find_stocktake_item」（catalog ⑮ D8 内） | searchProducts 直確定への短絡 |
| SPEC-SUGGEST-D9 | 依存追加 | CLI | M-A14: literal「新規 npm 依存は追加しない」 | cmdk 等の追加を許す |
| SPEC-SUGGEST-D10 | lock 連動欠落 | CLI | M-A15: literal「suggest fetch を発火せず、表示中リストは close」 | 保存中の候補操作を許す |
| UI_TECH_STACK 追記 | 横断規定欠落 | CLI | M-A16: §5.3 内 literal「候補プレビュー」>= 1 + §5.4 内「aria-activedescendant」>= 1 | 横断正本の同期漏れ |
| SCREEN_DESIGN 同期 | 再掲 drift | CLI | M-A17: SCREEN_DESIGN の実在する商品追加欄再掲節を amendment 時に全数列挙し、**節ごとに個別 anchor**「候補プレビュー」>= 1（一括 1 hit は特定節の同期漏れを識別できない — Codex P2-4 是正） | 写しの取り残し |
| SPEC-SUGGEST-D2 追補 | active 持ち越しによる誤確定 | CLI | M-A18: literal「直前の active 候補は必ず解除し持ち越さない」 | リスト差し替え直後の Enter が旧 index の行を確定する設計を許す |
| SPEC-SUGGEST-D6 追補 | hover active 化で race 復活 / click 未定義 | CLI | M-A19: literal「マウス hover（mouseenter 等）は active 候補を生成しない」 | pointer 経由の active 生成でスキャナ race 防御が崩れる |
| SPEC-SUGGEST-D6 追補 | footer 行の a11y 帰属未定義 | CLI | M-A20: literal「`role=\"option\"` を持たない非選択の装飾行」 | footer が option 化され、↓ で active になった footer への Enter 挙動が未定義になる |
| SPEC-SUGGEST-D4 追補 | lock source 3 分類の欠落 | CLI | M-A21: 3 literal 全て必須 — (a)「disposal のみ UI-05-D15 の lock ref」(b)「取引 3 画面〈receiving / manual-sale / return-exchange〉は各画面の既存 `isFormLocked` 派生 state」(c)「棚卸しは既存 `isCompleting`」（単一結合 literal は 1 分類欠落を素通しするため分割 — Codex round 2 P2-4 是正） | 分類の一部を落とした一般化（round 3 P2 同型）を許す |
| SPEC-SUGGEST-D2 追補 | 入力変化後の旧 active 残存 | CLI | M-A22: literal「入力値が変化した onChange event の時点で active 候補を同期的に解除する」 | ↓後スキャンの Enter が旧候補確定へ化ける（Codex P1-1） |
| SPEC-SUGGEST-D4 追補 | stale 応答の誤採用 | CLI | M-A23: 2 literal 必須 — (a)「token と検索語が現在入力値の双方に一致する場合のみ採用」(b)「sequence generation は各入力変更時（debounce 開始前）に更新」 | generation 更新時点句の削除・任意解釈で古い応答を採用しうる |
| SPEC-SUGGEST-D4 追補 | close 後の timer / in-flight 残存 | CLI | M-A24: 2 literal 必須 — (a)「pending debounce timer を cancel し、generation を進めて in-flight 応答（success / error とも）を不採用にする」(b) close event 集合全文「Enter commit 実行・入力欄 clear・候補確定・lock 成立・Esc・blur / Tab・unmount」 | event 集合の部分削除（Esc/blur 等）でも green になる survivor を防ぐ |
| SPEC-SUGGEST-D10 追補 | hook API 境界未定義 | CLI | M-A25: 2 literal 必須 — (a)「同期 `isLocked(): boolean` と、保存 event から同期呼出しされる `invalidateAndClose()`」(b)「UI-05-D15 の lock ref を更新した同じ event 内で `invalidateAndClose()` を呼ぶ」 | disposal の event 境界 race 窓が boolean prop 化 / 呼出し時点未定義で再導入される |
| SPEC-SUGGEST-D2 追補 | pending 中の旧リスト click | CLI | M-A26: 2 literal 全て必須 — (a)「旧リストの表示維持・click 操作は行わない」(b)「新しいリストは現在入力値に対する最新結果の採用後にのみ open する」（(b) 単独では旧リスト維持型への反転を検出できない — Codex round 3 P2-A 是正） | 入力変更後の旧リスト click で現在入力と無関係な候補が確定する（Codex round 2 P2-1） |
| 既存契約不変 | 意図しない書き換え | CLI | M-C1: `git diff main -- docs/function-design/` で既存 13 契約（UI-02-D4/D5、UI-04-D4/D5、UI-03-D9/D10、UI-05-D5/D6/D15、UI-10-D2/D11、TRACE-D12、UI-01a-D9）の定義行に変更 hunk なし | 拡張のはずが置換になっている |
| PK4 | packet link 欠落 | script | M-W1: `scripts/doc-consistency-check.sh` PK 系 WARN 0 | Plans.md link 漏れ |

## State Lifecycle Matrix

docs-only のため実 runtime state はないが、設計対象の suggest 層 lifecycle を契約行として固定する（実装 PR の Matrix が本表を継承する）。

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| suggest リスト | closed | debounce 200ms 待ち + fetch 中（closed — 入力変化時に close 済み、最新結果採用まで open しない） | open（<=5 行 + footer） | Enter commit / clear / 確定 / lock / Esc / blur / Tab / unmount で timer cancel + in-flight 不採用 + close | 入力変化ごとに sequence generation 更新（debounce 開始前）、採用は token + 検索語の二重一致 | 画面再訪で closed | — | silent close | 次入力で自然再試行 | SPEC-SUGGEST-D3/D4 |
| active 候補 | なし | — | ↓/↑ でのみ生成（IME composing 中は生成しない） | close 時解除 + 入力値変化の onChange で同期解除 | リスト内容更新時は解除（index 持ち越し禁止）、入力変更時に解除し最新結果が採用・open されるまで新規生成しない（pending 中のリストは closed） | — | — | — | — | SPEC-SUGGEST-D2/D5/D6 |

（リスト内容更新時の active 解除は SPEC-SUGGEST-D2 に凍結済み — rally round 1 P1-1 是正で Matrix 側言及から Spec Contract 本文へ昇格）

- unmount / 画面遷移: unmount 時は pending debounce timer を破棄する（React cleanup）。sequence token 比較により in-flight fetch が resolve しても採用されない（rally round 1 P3-2 是正）

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| IME composing guard（既存は Enter keydown のみ。suggest 層は keyboard branch 全域へ拡張 — Codex P2-2） | SearchBar（2 mode）/ 取引 4 画面検索欄 / 棚卸し 2 欄（実査 2026-08-04 全数） | suggest 層 D5（Enter / ↓ / ↑ / Esc 全域 guard） | onChange 側 guard は置かない（PR #61 P1-2 裁定 a の既定意味論） | M-A10 |
| debounce 200ms | SearchBar live 型 3 画面 | suggest 層 D3 | SearchBar 本体は不変更 | M-A8 |
| Enter commit 経路 | 取引 4 画面 handleProductSearch / 棚卸し resolveItem | 変更なし（不干渉が契約） | 全 5 site を明示不変 | M-C1 + 実装 PR 既存 suite |
| 複数件候補テーブル | 5 画面（キーボード操作なし） | 変更なし | プレビューとの統合は非目的 | Non-scope 節 |
| focus 管理（useRef + setTimeout） | 取引 4 画面復帰 / 棚卸し D11 遷移 | 変更なし（D8 で D11 継承のみ明記） | suggest は focus 非奪取（D6） | M-A11 |
| SearchBar live 型 | 商品一覧 / 在庫照会 / 入出庫履歴 | 適用しない | 一覧 filter 用途と明示的に別 pattern（catalog ⑨ vs ⑮ の境界文） | M-A16 相当の境界記述 |

## Negative Paths

- missing input: 空文字 → fetch 発火なし（D3 min 1 文字）
- invalid input: 変換途中文字列 → fetch 許容（D5、意図された挙動）
- duplicate/ambiguous input: 同一 keyword 連続 → sequence token で直近のみ
- unknown reference: 該当 0 件 → 非表示（D3）
- dependency missing: fetch error → silent close（D1）
- permission/write failure: not applicable（docs-only）
- dry-run side effect: not applicable

## Boundary Checks

- threshold: per_page 5 / footer 表示は total > 5
- null/default: keyword 以外の query field は既存 PRODUCT_SEARCH_QUERY 既定を流用
- empty/non-empty: 0 件 = 非表示、1 件以上 = open
- min/max: 入力 1 文字から。上限は入力欄既存制約に従う
- status/policy enum: なし
- wire type: ProductSearchQuery 不変
- internal type: 表示 3 field のみ
- producer/consumer: searchProducts（既存）→ 新 hook
- round-trip token: なし
- precision/range: D-031 clamp 200 の範囲内
- cross-language parse: なし

## Compatibility Checks

- old schema/input: 既存 7 呼び出し箇所の query 形不変
- new schema/input: なし
- output order: 候補表示順は searchProducts の既存 sort（ProductCode Asc）を流用 — amendment 時に明記
- optional field behavior: department_name null 時は空表示

## Data Safety Checks

- source-derived data: 実店舗データ・実商品名は例示に使わない（synthetic のみ）
- generated outputs: traceability 差分なし（AC4）
- secrets: なし
- local-only files: なし
- synthetic sample boundaries: catalog ⑮ の例示は架空商品名のみ

## Main Wiring / Integration Checks

- helper connected to main path: not applicable（docs-only。実装 PR で 5 画面配線 manifest を Ledger 行に立てる）
- output reaches manifest/report: Plans.md link → PK4（M-W1）
- effective config reaches runtime: not applicable
- CLI arg reaches implementation: not applicable

## Mutation-style Adequacy Questions

- X1: catalog ⑮ D1 の「候補非表示に縮退する」文を削除 → M-A6 red
- X2: D2 の「表示直後の自動 active 化・先頭行自動選択は禁止」を削除 → M-A7 red（スキャナ race 防御の喪失を検出）
- X3: 「debounce 200ms」→「100ms」に改変 → M-A8 red
- X4: D4 の「sequence token で直近要求のみ採用」削除 → M-A9 red
- X5: D5 を「onChange にも guard」へ反転 → M-A10 red
- X6: D6 の「focus は常に input が保持する（リストへ focus 移動しない）」を削除または focus 移動型へ反転 → M-A11 red（aria-activedescendant 削除では D2 側 hit が残り survivor になるため anchor と mutation を D6 固有 focus 文言で対にする — Codex round 2 P2-2 是正）
- X7: D9 の「新規 npm 依存は追加しない」削除 → M-A14 red
- X8: 61 の UI-02-D14 追記だけ落とす（片側 drift）→ M-A1 red、他画面 green のまま = 画面別弁別性あり
- X9: D2 の「直前の active 候補は必ず解除し持ち越さない」削除 → M-A18 red
- X10: D6 の「マウス hover（mouseenter 等）は active 候補を生成しない」削除 → M-A19 red
- X11: D6 の footer 非選択契約（「`role="option"` を持たない非選択の装飾行」）削除 → M-A20 red
- X12: D4 の lock 3 分類のいずれか 1 literal を落とす（3 変種: disposal / 取引 3 画面 / 棚卸し）→ M-A21 の該当 literal red
- X13: D2 の「入力値が変化した onChange event の時点で active 候補を同期的に解除する」削除 → M-A22 red
- X14: (a) 「検索語が現在入力値」一致条件を token 単独一致へ弱体化 / (b) 「debounce 開始前」の generation 更新時点句を削除 → M-A23 の該当 literal red
- X15: (a) timer cancel / in-flight 不採用文を削除 / (b) close event 集合から Esc・blur / Tab を削除 → M-A24 の該当 literal red
- X16: (a) `isLocked()` / `invalidateAndClose()` API 契約を削除 / (b) disposal の同一 event 内呼出し句を削除 → M-A25 の該当 literal red
- X17: (a) D2 の「旧リストの表示維持・click 操作は行わない」を削除または「旧リストを表示維持し click を許可する」へ反転 / (b) 「新しいリストは現在入力値に対する最新結果の採用後にのみ open する」句を削除 → M-A26 の該当 literal red
- 実行方式: clean tree で mutation を実注入 → M 系 anchor 検査を実行 → red 確認 → checkout 復元（memory: mutation-test-on-clean-tree-only。commit 後の clean tree でのみ実施）

## Residual Test Gaps

- anchor 検査は文言存在のみを固定し、契約の意味的整合（例: D2 と D6 の矛盾）は検出しない → Plan Review rally + Codex プラン全体レビューの人的検査が所掌
- スキャナ実機挙動は docs では検証不能。安全性保証の scope は supported sequence「バーコード文字列 + Enter」に限定し（方向キーを挿入する sequence は入力契約の対象外 — software では人間とスキャナの方向キーを識別できない）、L3 は機器の supported sequence 適合の互換性確認として Ledger 前積み済み
