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
- 数値契約（debounce 200ms / per_page 5）の無断改変
- 既存 commit 型契約文言の意図しない書き換え
- SCREEN_DESIGN 再掲の同期漏れ

## Test Matrix

anchor 検査はすべて `rg -c "<literal>" <file>` の完全一致 count で行う。anchor literal は定義文そのものに特定化し、amendment commit 時に `rg -c` で repo 内 uniqueness（想定 file 以外で 0 hit）を検証してから固定する（memory: matrix-anchor-uniqueness）。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-02-D14 | 61 doc に契約なし | CLI (rg) | M-A1: `rg -c "UI-02-D14" docs/function-design/61-ui-receiving.md` >= 2 | 設計判断表 or §61.5 追記の欠落 |
| UI-04-D16 | 62 doc に契約なし | CLI | M-A2: 同型（62 / UI-04-D16） | 同上 |
| UI-03-D21 | 63 doc に契約なし | CLI | M-A3: 同型（63 / UI-03-D21） | 同上 |
| UI-05-D16 | 64 doc に契約なし / D15 整合文なし | CLI | M-A4: `rg -c "UI-05-D16"` >= 2 かつ D16 本文内に `UI-05-D15` 参照 1 hit | D15 整合の明文化漏れ |
| UI-10-D12 | 73 doc に契約なし / D2・D11 接続なし | CLI | M-A5: `rg -c "UI-10-D12"` >= 2 かつ D12 本文内に `UI-10-D2` / `UI-10-D11` 参照各 1 hit | 棚卸し接続契約の欠落 |
| SPEC-SUGGEST-D1 | 不干渉契約の欠落 | CLI | M-A6: catalog ⑮ 内 literal「候補非表示に縮退する」 | commit 経路への波及を許す設計へ改変 |
| SPEC-SUGGEST-D2 | 自動 active 化の抜け道 | CLI | M-A7: literal「表示直後の自動 active 化・先頭行自動選択は禁止」 | スキャナ race 防御の核が落ちる |
| SPEC-SUGGEST-D3 | 数値改変 | CLI | M-A8: literal「debounce 200ms」+「per_page 5」（catalog ⑮ 内） | 発火条件の無断変更 |
| SPEC-SUGGEST-D4 | 破棄条件欠落 | CLI | M-A9: literal「sequence token で直近要求のみ採用」 | stale 採用を許す |
| SPEC-SUGGEST-D5 | IME 意味論 drift | CLI | M-A10: literal「onChange / debounce 経路に composing guard は置かず」 | SearchBar 既定と矛盾する二重 guard 化 |
| SPEC-SUGGEST-D6 | a11y 構造欠落 | CLI | M-A11: literal「aria-activedescendant」（catalog ⑮ 内 >= 1） | focus 移動型（focus 奪取）実装を許す |
| SPEC-SUGGEST-D7 | 確定 semantics 分裂 | CLI | M-A12: literal「複数件候補テーブルからの選択と同一 handler」 | 画面別の独自確定経路を許す |
| SPEC-SUGGEST-D8 | 棚卸し経路 drift | CLI | M-A13: literal「find_stocktake_item」（catalog ⑮ D8 内） | searchProducts 直確定への短絡 |
| SPEC-SUGGEST-D9 | 依存追加 | CLI | M-A14: literal「新規 npm 依存は追加しない」 | cmdk 等の追加を許す |
| SPEC-SUGGEST-D10 | lock 連動欠落 | CLI | M-A15: literal「suggest fetch を発火せず、表示中リストは close」 | 保存中の候補操作を許す |
| UI_TECH_STACK 追記 | 横断規定欠落 | CLI | M-A16: §5.3 内 literal「候補プレビュー」>= 1 + §5.4 内「aria-activedescendant」>= 1 | 横断正本の同期漏れ |
| SCREEN_DESIGN 同期 | 再掲 drift | CLI | M-A17: 商品追加欄再掲節に「候補プレビュー」>= 1 | 写しの取り残し |
| 既存契約不変 | 意図しない書き換え | CLI | M-C1: `git diff main -- docs/function-design/` で既存 D-ID（UI-02-D4 等 12 契約）の定義行に変更 hunk なし | 拡張のはずが置換になっている |
| PK4 | packet link 欠落 | script | M-W1: `scripts/doc-consistency-check.sh` PK 系 WARN 0 | Plans.md link 漏れ |

## State Lifecycle Matrix

docs-only のため実 runtime state はないが、設計対象の suggest 層 lifecycle を契約行として固定する（実装 PR の Matrix が本表を継承する）。

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| suggest リスト | closed | debounce 200ms 待ち + fetch 中（表示は前回内容維持 or closed） | open（<=5 行 + footer） | Enter commit / clear / 確定 / lock で破棄 + close | 入力変化ごとに sequence token 更新 | 画面再訪で closed | — | silent close | 次入力で自然再試行 | SPEC-SUGGEST-D3/D4 |
| active 候補 | なし | — | ↓/↑ でのみ生成 | close 時解除 | リスト内容更新時は解除（index 持ち越し禁止） | — | — | — | — | SPEC-SUGGEST-D2/D6 |

（リスト内容更新時の active 解除は catalog ⑮ D6 の細目として amendment 時に明文化する — 持ち越すと更新直後の Enter が意図しない行を確定する）

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| IME composing guard（Enter keydown のみ） | SearchBar（2 mode）/ 取引 4 画面検索欄 / 棚卸し 2 欄（実査 2026-08-04 全数） | suggest 層 D5 | onChange 側 guard は置かない（PR #61 P1-2 裁定 a の既定意味論） | M-A10 |
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
- X6: D6 の aria-activedescendant 文言削除 → M-A11 red
- X7: D9 の「新規 npm 依存は追加しない」削除 → M-A14 red
- X8: 61 の UI-02-D14 追記だけ落とす（片側 drift）→ M-A1 red、他画面 green のまま = 画面別弁別性あり
- 実行方式: clean tree で mutation を実注入 → M 系 anchor 検査を実行 → red 確認 → checkout 復元（memory: mutation-test-on-clean-tree-only。commit 後の clean tree でのみ実施）

## Residual Test Gaps

- anchor 検査は文言存在のみを固定し、契約の意味的整合（例: D2 と D6 の矛盾）は検出しない → Plan Review rally + Codex プラン全体レビューの人的検査が所掌
- スキャナ実機挙動（keystroke 間隔 < 200ms、方向キー非送出）は docs では検証不能 → 実装 PR L3 必須行として Ledger 前積み済み
