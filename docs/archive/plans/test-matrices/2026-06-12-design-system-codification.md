# Test Design Matrix: デザインシステム構築

Self-Review: 適用除外（本ファイルは plan packet `2026-06-12-design-system-codification.md` の付属 Test Design Matrix。Self-Review 7 観点は packet 本体の `## Self-Review` セクションに記載済み）

## Risk

Risk: R3

## Contracts Under Test

- SPEC-DS-C1: design-system 2 層構造 + catalog 13 + DSR-01〜13 収録
- SPEC-DS-C2: 移設規約の正典 1 箇所化（移設元はスタブ + リンク）
- SPEC-DS-C3: doc-consistency M1/M3 が `docs/design-system/*.md` を走査
- SPEC-DS-C4: 5 共通 component 抽出 + 重複実装ゼロ
- SPEC-DS-C5: palette 外色 / 生 button ゼロの恒久 lint 強制

## Failure Modes

- 移設時の本文欠落（§4.6.4 末尾等の範囲切り誤り）
- 移設元と新 docs の二重ソース化（片方更新で drift）
- 旧 §4 / §6 参照の張替漏れ（plain text 参照は R3 で検出不能）
- M1/M3 glob 拡張漏れ（新 docs に曖昧語が入っても green）
- component 置換での DOM 構造・文言の意図しない変化
- DepartmentFilter 統合時の画面別差分（placeholder / 幅 / disabled）の喪失
- lint 誤検出（コメント内の色名言及、shadcn 生成物）
- lint 抜け道（barrel re-export 迂回）

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-DS-C1 | catalog の canonical 参照が架空パス | schema / docs | doc-consistency R1/R3 + DS-doc 検査（PR-C で ID 化） | catalog が実在しない file を参照したまま merge される |
| SPEC-DS-C2 | 二重ソース化 | docs / review | A5 両系統 grep（`UI_TECH_STACK\|SCREEN_DESIGN`、root 導線含む）後の旧参照 0 件確認 | 移設後も旧 §4 本文が残り 2 箇所が並立する |
| SPEC-DS-C3 | glob 拡張漏れ | CLI / negative | M1 違反語仮置き → ERROR 確認 → 除去 → exit 0 | 拡張を忘れても green になり品質 gate が空洞化する |
| SPEC-DS-C4 | 置換で DOM 変化 | unit / regression | 既存 page/component test 不変 green + characterization test（SummaryCard 系・PageHeader 一部画面で新規作成） | 共通化が文言・構造・属性を変えたとき検出されない |
| SPEC-DS-C4 | DepartmentFilter 差分喪失 | unit | DepartmentFilter props default の 3 画面差再現 test | 統合で products の disabled / daily の「すべて」placeholder が消える |
| SPEC-DS-C5 | lint 誤検出 / 抜け道 | CLI / negative | 違反サンプル fail 確認 + `ui/**` ignore 確認 + barrel 迂回サンプル fail 確認 | コメント内色名で誤 fail、または re-export 経由で素通りする |

## Negative Paths

- missing input: catalog パターンに canonical 参照が無い → DS-doc 検査で ERROR
- invalid input: Risk 行のインライン連結 packet → PK1 ERROR（本 packet は bare 形式で回避済み）
- duplicate/ambiguous input: 同一規約の二重記載 → A5 grep + review focus で検出
- unknown reference: 移設後の旧 anchor 参照 → R3 + 両系統 grep
- dependency missing: PR-B が PR-A の catalog 未 merge で着手 → packet 依存順（A→B→C）で防止
- permission/write failure: 該当なし（docs + src のみ）
- dry-run side effect: 該当なし

## Boundary Checks

- threshold: 該当なし（数値閾値の変更なし）
- null/default: DepartmentFilter `allLabel` / `widthClass` の default 値が現行 3 画面の表示を再現すること
- empty/non-empty: catalog ⑥ 空状態パターンが空 options / 空 results の文言を規定すること
- min/max: 該当なし
- status/policy enum: StockStatusBadge の状態 enum 表示が token 移行後も全状態で文言不変
- wire type: 変更なし
- internal type: component props は TS strict で型検査
- producer/consumer: 該当なし
- round-trip token: 該当なし
- precision/range: 該当なし
- cross-language parse: 該当なし

## Compatibility Checks

- old schema/input: 旧 §4 / §6 への外部参照（archive 含む）はスタブ残置で R3 green を維持
- new schema/input: 新 docs は DOC_STYLE_GUIDE §0 登録 + 親文書リンクで既存規約に適合
- output order: 該当なし
- optional field behavior: PageHeader `actions?` / `subtitle?`（採用時）が未指定でも現行表示を再現

## Data Safety Checks

- source-derived data: 実 POS CSV / 実 DB 由来データを catalog 例示に使わない（合成のみ）
- generated outputs: `90-traceability.md` は再生成で同期（drift check が CI に存在）
- secrets: 非接触
- local-only files: `.local/` 非接触
- synthetic sample boundaries: catalog の例示は架空の商品名・コードのみ

## Main Wiring / Integration Checks

- helper connected to main path: patterns/ component が実画面から import されること（置換完了 = ローカル実装削除で担保）
- output reaches manifest/report: 該当なし
- effective config reaches runtime: eslint ルールが `npm lint`（CI frontend job 内包）で実行されること
- CLI arg reaches implementation: doc-consistency の DS チェックが既定スイートで実行されること（`--target` 不要を確認）

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? — DepartmentFilter の disabled 分岐反転は props default 再現 test が fail
- If a threshold comparison changes, which test fails? — 該当なし（閾値変更なし）
- If a guard is removed, which test fails? — lint ルール削除は違反サンプル fail 確認手順（C3 commit の negative test）で検出
- If an output field is omitted, which test fails? — PageHeader が title を描画しなければ既存 page test の heading assert が fail
- If output order changes, which test fails? — 該当なし
- If dry-run performs a side effect, which test fails? — 該当なし
- If a JSON number crosses JavaScript safe integer range, which test fails? — 該当なし
- If a state token is round-tripped through browser/client code, which test fails? — 該当なし（URL state 変更なし）

## Residual Test Gaps

- 視覚（色・余白・フォーカスリング）の回帰は自動検出されない — Windows native L3 の 4 状態比較で人間確認（PR-B / PR-C の C1 色補正）
- esquery `Literal[value]` regex の成立性は PR-C packet の公式 docs 検証まで未確定（不成立時は bash grep gate に切替）
