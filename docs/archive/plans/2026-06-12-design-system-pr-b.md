# デザインシステム構築 PR-B: 共通 component 抽出（Plan Packet）

> **親 packet**: `docs/archive/plans/2026-06-12-design-system-codification.md`（PR-B 詳細 / Non-scope 例外 / props 契約の初期案）
> **branch**: `feat/design-system-pr-b` / commit prefix: `feat(ui-patterns):`（設計書 commit は `docs(design-system):`）
> **test matrix**: [test-matrices/2026-06-12-design-system-pr-b.md](test-matrices/2026-06-12-design-system-pr-b.md)

## Risk

Risk: R3

Reason: src 複数ファイル変更（patterns/ 新設 + 8 画面内部置換）。generated command / DTO / route / search params / DB schema は不変で wire 契約に触れない。

## Context

PR-A（merge 済み `24c7f6e`）で規約は `docs/design-system/` に単一参照面化されたが、実装側は同型 UI が画面ごとにローカル再実装されたまま（DepartmentFilter 3 重複、SearchBar 2 実装で IME 対応有無の挙動差、空状態 6 箇所が catalog ⑥ 標準UI 未達）。PR-B はこれらを `src/components/patterns/` へ抽出して実装ブレを解消し、catalog の canonical を共通 component に張り替える。3 段 PR（A: docs / B: component 抽出 / C: 機械強制）の第 2 段。

## Goal

- 6 共通 component（PageHeader / FormSection / DepartmentFilter / SummaryCard / SearchBar / EmptyState）を `src/components/patterns/` へ抽出・整備し、対象画面を内部置換する
- DOM 出力不変を原則とし、意図的差分 3 クラス（D-B3 IME / D-B4 文言 / D-B5 空状態）のみ明記 + L3 確認で取り込む
- catalog ①②④⑥⑨ の canonical 参照を patterns/ へ更新し（② は規約本文の書換を含む、D-B1）、関数設計書 `docs/function-design/59-ui-shared-patterns.md` を新設する（R2 P3-2: 52 は「業務ロジックなし・純構造」責務のため拡張先として不適。`5x`=UI 層の DOC_STYLE_GUIDE §0 命名規約に準拠、親 packet「52 拡張」からの判断変更として PR body に明記）

## Scope

| component | 抽出元（削除対象） | 置換対象 |
|---|---|---|
| PageHeader | 各ページのインライン `<header>` | 8 画面 = 7 Page ファイル。`ProductFormPage.tsx` は通常分岐（L203 付近）+ edit error 分岐（L181 付近）の **2 header site** を両方置換 |
| FormSection | `src/features/products/components/ProductForm.tsx` L53-72 | ProductForm 4 セクション |
| DepartmentFilter | `src/features/{daily-sales,products,stock-inquiry}/components/DepartmentFilter.tsx`（3 ファイル削除） | 3 画面 |
| SummaryCard | `src/features/home/components/SummaryCard.tsx`（patterns/ へ**移動のみ**） | HomePage（canonical）。daily/monthly `SummaryCardsBar` は**対象外**（D-B1） |
| SearchBar | `src/features/products/components/ProductSearchBar.tsx` + `src/features/stock-inquiry/components/SearchBar.tsx`（2 ファイル削除） | 2 画面 |
| EmptyState | なし（新規） | 空結果 6 箇所（products 一覧 / stock 結果 0 件 / daily 明細 / monthly 月度・ランキング・部門別） |

付随: `docs/design-system/02-component-catalog.md` canonical 更新（⑥ 既知逸脱注記の解消 + **② 節全体の per-card retry 規約書換**、D-B1）、`docs/design-system/01-decision-rules.md` L66 整合書換、`docs/function-design/59-ui-shared-patterns.md` 新設 + `docs/FUNCTION_DESIGN.md` 索引追記、`docs/Plans.md` 同期。

## Non-scope

- PR-C の機械強制（eslint ルール / doc-consistency DS チェック）
- P3 パターン（Dialog 共有化・日付ナビ utility）の component 化
- hook（useStockInquiry / useDailySalesReport 等）と URL state 設計の改造
- **daily/monthly `SummaryCardsBar` の共通 SummaryCard 化**（D-B1: タイトル skeleton 構造 / truncate / sub 行 / valueClassName / Tooltip が home canonical と非互換。統合は prop 肥大化を招くため見送り、catalog ② に variant として規約化）
- `EmptySearchPlaceholder`（検索前の操作指示 = 空結果でない）と shortcuts `emptyMessage`（1 component / 2 呼び出し site、navigation config 駆動でアクション不能）の EmptyState 化 — semantic が catalog ⑥「取得結果 0 件」と異なるため除外、理由を catalog ⑥ に追記
- 新規 npm 依存の追加（Mini Shai-Hulud 凍結継続）

## Design Decisions

### D-B1 SummaryCard: per-card retry の基準は「query を共有しないカード」。daily/monthly は対象外（Rally R1 P1-1/P1-2 で再設計）

実測（R1 fact-check 済み）: HomePage は **3 カード / 2 query** で、在庫切れ・在庫少の 2 カードは同一 `lowStock` query と同一 `onRetry` を共有（`SummaryCards.tsx` L49-52/L59-62）。daily は **2 query**（today = page-level Alert `DailySalesPage.tsx` L84-100、yesterday = 前日比カード内「比較データなし」の in-card 部分障害許容 `SummaryCardsBar.tsx` L131）。monthly は **1 query**（page-level Alert L81-97）。

- **規約（R3 P3-A で 3 パターン明示）**: ① 独立 query のカード = per-card retry 必須。② 同一 query 共有カード群でも per-card retry を採用してよい（**home canonical = 共有 lowStock query × per-card retry の許容例**、`SummaryCards.tsx` L47-65）。③ カードが束ねられ個別回復導線が冗長な場合は page-level Alert + 再試行を許容（daily/monthly が該当）。daily の yesterday in-card「比較データなし」表示は現状維持
- **DOM 互換性**: home `SummaryCard` は loading 中もタイトル常時表示、daily/monthly はタイトルごと skeleton 化 + truncate/text-2xl/sub/valueClassName/min-w-0/Tooltip を持ち**構造非互換**（R1 P1-2）。統合は contract 肥大化（slot 5 個超）に見合わないため、**daily/monthly の SummaryCardsBar は現状維持 = Non-scope**
- **実装**: `SummaryCard` を `src/features/home/components/` → `src/components/patterns/` へ移動 + import 張替のみ（DOM 不変）。props 契約は現実装どおり `SummaryCard{title, isLoading, isError, onRetry, loadingSkeleton?, children}`（onRetry 必須を維持 — 採用画面が error 状態を持つ前提のため）
- **catalog ② + DSR 書換（B7、R2 P2-2 → R3 P2-A で範囲指定方式へ変更）**: per-card retry を「標準」と断定する記述は catalog ② 内に点在（L64 使いどころ / L95 状態 / L99 既知逸脱注記 / L101 アクセシビリティ / L104-105 Do / L107-108 Don't — 行番号列挙は drift しやすいため、**② 節全体（L62-109）を上記 3 パターン規約に整合させる**と範囲で指定）+ `01-decision-rules.md` L66「サマリカードの取得失敗は Alert + 再試行」の整合書換。親 packet「retry 必須化 = 意図的差分」はこの規約化で解消し、強制リファクタは行わない（PR body に親 packet からの判断変更として明記）

### D-B2 PageHeader: `subtitle?` 追加で 8 画面統合（親 packet 二択の B 案）

実証（R1 確認済み）: 8 画面の構造は (a) h1 のみ × 5、(b) h1 + action × 1（products 一覧）、(c) h1 + 副題 × 2（home / csv-import、副題は `text-sm text-muted-foreground` 同型）。`PageHeader{title, subtitle?, actions?}` で全 8 画面が DOM 不変のまま統合できる。`ProductFormPage` の edit error 分岐 header も置換対象（Scope 表注記）。

products 一覧の actions 実体は文言「**商品登録**」の link button（`ProductListPage.tsx` L75、`/products/new` 導線）— PageHeader へは `actions` slot にそのまま渡し DOM 同値。既存 assert は `getByRole("heading")` / `getByRole("link", { name: "商品登録" })` の独立取得のため破壊されない（R2 P3-3 / 検証点 5 確認済み）。

### D-B3 SearchBar: 単一 component + 挙動 props、IME ガード常時適用（意図的差分①）

2 実装の差分（R1 P2-1 で拡充）: 「commit 型（products: draft + Enter/ボタン確定、**trim あり**、Label + id + 検索ボタン + wrapper div `min-w-[18rem] flex-1`）」vs「live 型（stock: 200ms debounce + Enter flush、**trim なし**、Label なし・wrapper なし・`type="search"`・`max-w-md`）」+ IME isComposing ガード有無。

- 契約: `SearchBar{value, onSearchChange, label?, id?, placeholder?, ariaLabel?, debounceMs?, showSubmitButton?, type?, wrapperClassName?, inputClassName?}`。`debounceMs` 未指定 = commit 型（Enter/ボタン確定 + trim）、指定 = live 型（debounce + Enter flush + no-trim）。trim 挙動はモードに紐付けて契約注記（既存 test は空白なし入力のため trim 差の net がない点も注記）
- **DOM 不変条件**: stock 側は label なし / wrapper なし / `type="search"` / `max-w-md` を props で維持。products 側は Label + ボタン + wrapper を維持
- **IME ガード（`event.isComposing` 除外）は両モード常時適用**。products 現実装（L47-51）は Enter 確定に isComposing 除外がなく、Windows native の日本語変換確定 Enter が検索を誤発火する潜在バグ（memory `feedback-ime-composition-keydown-exclusion`）。stock 既存実装（L58-67）の isComposing + flush 構造を commit 型へ適用（R1 P3-1: 前例ありで安全）。修正は意図的差分①として PR body に明記
- 既存 test 2 本（focus / Enter 確定 assert）は semantic 維持で patterns/SearchBar.test.tsx へ移管 + **IME 中 Enter 不発火の red→green test を commit 型 / live 型で各 1 本**追加

### D-B4 DepartmentFilter: allLabel 既定「すべての部門」へ統一（意図的差分②）

3 実装の実測差分（R1 P2-2 で訂正）: width = `w-[10rem]` × 2（daily / stock）・`w-[11rem]` × 1（products）/ allLabel = daily のみ「すべて」/ disabled = products のみ / id prefix 3 種（`dept-filter` / `product-dept-filter` / `stock-dept-filter`）。SelectContent 構造は 3 本とも同型（`__all__` SelectItem + options.map — 旧記載の「SelectItem 重複配置」は実在せず削除）。

- 契約: 親 packet どおり `DepartmentFilter{options, selected, onChange, disabled?, allLabel?, widthClass?, idPrefix?}`。allLabel 既定 = 「すべての部門」（3 実装中 2 で多数派 + 非IT利用者に対象が明確）
- daily の placeholder「すべて」→「すべての部門」は文言の意図的差分②（L3 で確認）
- width / id prefix は props で現値維持（DOM 不変）

### D-B5 EmptyState: 6 つ目の component、空結果 6 箇所へ適用（意図的差分③）

catalog ⑥ 既知逸脱（PR-A Codex R1 P2-2 起源）の解消。`EmptyState{icon?, title, description?, action?}`（icon 既定 24px `stone-400` / title h3 `stone-700` / description `stone-500`）。

- action は products 一覧のみ「商品を登録する」（`/products/new` 導線）。売上系は日付/月ナビが直上にあるため**ボタンは作らず** description で次の一手を文言提示（GOV.UK 作らない勇気 + 重複導線回避）
- **monthly 月度は既存文言が既に 2 文「当月データなし。月を変更してお試しください。」（R1 P2-4）**: これは EmptyState の title + description へ**正規移植（文言維持）**。他 5 箇所（bare 単一文言）は description 追加が意図的差分。B0 characterization はこの 2 群を分けて assert する
- 6 箇所の視覚変更 = 意図的差分③。Windows native L3 で「読める・次に何をするか分かる」を確認（memory `feedback-non-it-user-readability-over-aesthetics`）
- **pure テーブル 3 箇所の埋め込み方（R4 P3-1）**: `rows.length===0` 内部分岐の中身（bare div → `<EmptyState>`）を差し替えるのみ。props 契約も「props 駆動で内部分岐を描く」責務も不変 — EmptyState は子要素として埋め込まれ、pure presentational（useQuery 非内蔵）を維持
- **空状態の 2 系統切り分け（R4 P3-2、B7 で catalog ⑥ / 59 に明記）**: ① 0 件成功 = テーブル内 EmptyState（pure component 内）、② 取得失敗 = ページ側 Alert（catalog ③ L161「テーブルごと差し替え」の射程）。daily/monthly の取得失敗は page-level Alert が既に担っており本 PR で変更しない
- catalog ⑥ の既知逸脱注記を削除し、canonical を patterns/EmptyState + 適用後 ProductListPage に更新

### D-B6 FormSection: description を optional 化

現実装（`ProductForm.tsx` L53-72）は `description: string` 必須。親 packet 契約 `FormSection{title, description?, children}` に合わせ optional 化（未指定時は `<p>` を描画しない）。ProductForm の 4 セクションは 3 箇所が文字列リテラル、4 つ目（在庫）は `mode` 依存の三項式だが**両分岐とも non-empty string**（L293-299）のため、optional 化後も全セクションで `<p>` が描画され DOM 不変（R1 P2-3 で精密化）。

## Spec Contract

- **wire contract**: 変更なし。`src/lib/bindings.ts`（generated）/ route / search params / DB schema / Tauri command に差分が出ないことを `git diff --name-only` で機械確認
- **internal props 契約**: 上記 D-B1〜D-B6 の 6 contract。UI 層内部契約で wire 非該当（親 packet 判定踏襲）
- **compatibility**: 旧ローカル実装 5 ファイル削除（DepartmentFilter 3 + SearchBar 系 2）+ SummaryCard 1 移動 + import 全数張替。`fd -g "DepartmentFilter.tsx" src/features` / `fd -g "ProductSearchBar.tsx" src` / `fd -g "SearchBar.tsx" src/features` / `rg -n "function FormSection" src/features` / `rg -n 'home/components/SummaryCard"' src` がすべて 0 件（末尾 `"` anchoring で import 文に限定 — ファイル先頭の自己パスコメント行 `// src/features/home/components/SummaryCards.tsx` の前方一致誤マッチを除外、R2 P2-1）+ 正方向確認 `rg -n 'patterns/SummaryCard' src/features/home` が 1 件以上
- **親 packet からの契約変更 2 点**（PR body に明記）: ① SummaryCard の適用範囲を home canonical のみへ縮小 + catalog ② 規約書換（D-B1）、② FormSection description optional 化（D-B6）

## 実装手順 / Commit 分割

- **B0 `test:`**: characterization test 先行作成（安全網二分の「既存 test なし」側）:
  - **home SummaryCards 3 カード**の loading / error+retry / data DOM（R1 P1-3: 既存 test ゼロのためここが唯一の net）
  - daily/monthly SummaryCardsBar の skeleton / data DOM（Non-scope 化の不変証明）
  - DepartmentFilter 3 種の現 DOM（allLabel / width / id / disabled）
  - 空結果 6 箇所の現文言（monthly 月度の既存 2 文と bare 5 箇所を分けて assert）
  - **render 方式の二分（R2 P3-1 → R3 P2-B で分類訂正）**: pure presentational（props 駆動・useQuery 非内蔵）= DepartmentFilter 3 種 / SummaryCards / SummaryCardsBar(daily・monthly) / **daily ProductTable 空（L36）/ monthly ProductRankingTable 空（L35）/ monthly DepartmentTable 空（L34）** → mock props（`rows=[]` 等）で直接 render。page-level（query hook 内蔵 page）= **products 一覧 / stock 結果 0 件（`StockInquiryPage.tsx` L120-122、`useStockInquiry` 内蔵 — R3 agent 報告の「2 つだけ」から orchestrator 裏取りで訂正）/ monthly 月度** → 既存 `renderWithClient`（QueryClientProvider wrapper）+ query empty mock で render
  - **reachability 注記（R3 P2-B）**: monthly ランキング/部門別テーブルの空分岐は、page の query empty mock では `MonthlySalesPage` が先に月度メッセージを出すため**到達不能**。必ず `rows=[]` の直接 render で characterization する
  - **置き場所と責務分離（R4 P3-3a）**: pure 3 の空状態 characterization は各 feature の既存 component test（例: `daily-sales/components/ProductTable.test.tsx`）に追記。B6 後も patterns/EmptyState.test.tsx（EmptyState 単体の DOM 規約）と feature 側 characterization（テーブルが空時に EmptyState を正しく差し込む結線）は責務が異なるため両立 = 重複でない（PR-C 以降の誤削除予防として 59 設計書にも記載）
- **B1 PageHeader** → **B2 FormSection** → **B3 DepartmentFilter** → **B4 SummaryCard（patterns/ へ移動 + import 張替のみ）** → **B5 SearchBar** → **B6 EmptyState**: 各 commit で「patterns/ に component + unit test → 対象画面置換 → 旧実装削除 → 全 test green」を完結（fmt/lint/typecheck/test 通過単位）
- **B7 `docs(design-system):`**: catalog ①④⑥⑨ canonical 更新 + ⑥ 既知逸脱注記解消 + **② 節全体（L62-109）+ DSR L66 の規約書換（D-B1、R3 P2-A 範囲指定方式）** + `59-ui-shared-patterns.md` 新設 + `FUNCTION_DESIGN.md` 索引追記 + Plans.md 同期
  - 59 は 52 が確立した UI 関数設計テンプレ二段判定に従い**「業務ロジックなし（純構造）版」**で記述（CMD 呼び出し 0 件・props 駆動のため。R3 P3-B）。索引追記は FUNCTION_DESIGN.md 既存 UI 索引の一行責務フォーマットに揃える。M2 テンプレチェック（`5x-ui-*` は処理ステップ or コンポーネント構造 or 画面）は「コンポーネント構造」節で充足
- B0 の home characterization は **SummaryCards 経由 render のため SummaryCard の内部 import path に非依存**（B4 の import 1 行変更は AC の「import path 変更」類として許容、順序破綻なし。R3 P3-C）
- 意図的差分（D-B3 IME / D-B4 文言 / D-B5 空状態）は該当 commit message と PR body の対応表に明記
- **委譲粒度（R3 P3-C）**: B0-B6 は **commit 単位で Sonnet subagent を個別起動**し、各 commit 後に orchestrator が実 DOM / test 結果を検収（1 subagent への 8 commit 丸投げ禁止 — context 肥大で green 自己申告の信頼性が落ちる、memory `feedback-subagent-green-report-verify-real-wiring`）

## Test Plan

- 新規 unit test: patterns/ 6 component（props 分岐・a11y 属性・IME ガード両モード・debounce/flush・action 有無・FormSection description なし分岐）
- characterization test: B0 で先行作成 → 置換後も green = DOM 不変の機械証明（意図的差分のみ assert 更新、更新は該当 commit 内で diff 明示）
- 既存 test: ProductListPage.test.tsx（header assert L77）/ ProductForm.test.tsx（4 見出し assert L56-59）/ SearchBar 系 2 本（patterns/ へ移管、assert semantic 維持）/ TabsHeader / Sidebar 系は **import path 変更以外無変更で green** を維持。SummaryCard / SummaryCardsBar / HomePage の既存 test は**存在しない**（R1 P1-3）— B0 characterization が唯一の net
- 検証コマンド: `npm test` / `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm run build` / `bash scripts/doc-consistency-check.sh` / `cargo test`（Rust 側無変更の回帰確認、pre-push で自動）
- **L3（human gate）**: Windows native で意図的差分 3 クラス（空状態 6 画面 / daily 部門フィルタ文言 / products 検索の IME 挙動）を実機確認。EmptyState は「読める・次が分かる」を実利用者基準で判定。**順序（R3 P3-C）: CI green → Codex review 対応完了 → L3 owner 承認 → merge**（`windows-native-demo-sync-runbook` 手順で feature ブランチを Windows 側へ同期）
- Test Design Matrix: [test-matrices/2026-06-12-design-system-pr-b.md](test-matrices/2026-06-12-design-system-pr-b.md)

## Acceptance Criteria

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm run build` がすべて exit 0
- `fd -g "DepartmentFilter.tsx" src/features` / `fd -g "ProductSearchBar.tsx" src` / `fd -g "SearchBar.tsx" src/features` / `rg -n "function FormSection" src/features` / `rg -n 'home/components/SummaryCard"' src` がすべて 0 件（末尾 `"` anchoring で import 文に限定 — ファイル先頭の自己パスコメント行 `// src/features/home/components/SummaryCards.tsx` の前方一致誤マッチを除外、R2 P2-1）+ 正方向確認 `rg -n 'patterns/SummaryCard' src/features/home` が 1 件以上
- `src/components/patterns/` に 6 component + 各 unit test が存在（`eza src/components/patterns/` で確認）
- `git diff --name-only main...HEAD -- src/lib/bindings.ts` が 0 件（wire 不変）。`src-tauri` 差分は `src-tauri/src/bin/generate_traceability.rs`（FE baseline 17→22、Known Accepted Risk）と `src-tauri/tests/design_compliance_test.rs`（59 の SKIP_DOCS 登録）の 2 ファイルのみ許容 — runtime 契約に非接触（Codex R2 P3 で実条件へ同期）
- 既存 test の変更が「import path / B0 characterization 追加 / 意図的差分 3 クラスの assert 更新」のみ（`git diff --stat` でレビュー時確認、PR body に対応表）
- `bash scripts/doc-consistency-check.sh` exit 0（catalog canonical 張替 + ② 規約書換後の R3 含む）
- `rg -n "59-ui-shared-patterns" docs/FUNCTION_DESIGN.md` が 1 件以上（59 新設 + 索引追記の機械検証、R4 P3-3b）
- Windows native L3 確認済み（意図的差分 3 クラスを UI 実機で確認、同期手順は `windows-native-demo-sync-runbook`、owner 承認）

## Data Safety

- DB / ファイル / localStorage への書き込み変更なし（`useDisplayScale` の localStorage は触らない）。UI 表示層のみの変更で、失敗時も `git revert` で完全復元可能。バックアップ不要

## Trace Matrix

| Spec ID | 出典 | Commit | Test | 検証 |
|---|---|---|---|---|
| SPEC-DSB-C1 | catalog ① / SCREEN_DESIGN ページヘッダー規約 | B1 | PageHeader unit + characterization（test 名は実装時に確定） | characterization green |
| SPEC-DSB-C2 | catalog ④ / ProductForm L53-72 | B2 | 既存 ProductForm.test 4 見出し（L56-59）+ description なし unit | 無変更 green |
| SPEC-DSB-C3 | catalog ⑨ / 親 packet props 契約 | B3 | B0 characterization 3 種 | `fd` 0 件 + green |
| SPEC-DSB-C4 | catalog ② / D-B1 | B4 + B7 | B0 home 3 カード characterization（唯一の net） | 移動前後 green + catalog ② 書換 |
| SPEC-DSB-C5 | catalog ⑨ / D-B3 / memory ime-composition | B5 | 移管 2 本 + IME test × 2（red→green） | green |
| SPEC-DSB-C6 | catalog ⑥ / PR-A R1 P2-2 / D-B5 | B6 | EmptyState unit + B0 文言 characterization + L3 | 標準UI DOM + owner 確認 |
| SPEC-DSB-C7 | DOC_STYLE_GUIDE / catalog canonical | B7 | doc-consistency | exit 0 |

## Review Focus

- D-B1 の再設計（per-card retry 基準 = query 独立性、daily/monthly Non-scope 化、catalog ② 書換）が親 packet の意図変更として PR body で透明に説明されているか
- D-B3 の契約が stock 側 DOM（type="search" / max-w-md / Label なし）と products 側 trim を両立できているか
- D-B5 の monthly 月度「文言移植」と他 5 箇所「description 追加」の区別が characterization に反映されているか
- B0 characterization → 置換の順序が全 commit で守られているか
- 既存 test 無変更原則の遵守（意図的差分の assert 更新が最小か）

## 実行体制

- orchestrator: packet 管理・B0-B7 の commit 単位検収・doc-consistency / CI 確認・Codex review 対応
- 実装: Sonnet subagent（B0-B6 を commit 単位で個別起動）、設計書 B7 は orchestrator 直接または Sonnet
- L3: owner（Windows native、`windows-native-demo-sync-runbook` 手順）

## Self-Review

### 1. 前提条件

main は `dbf2231`（PR-A closeout 済み）。catalog / foundations は PR-A で確定済み、親 packet の PR-B 詳細を引き継ぎ、Explore 3 並列 + Rally R1 fact-check で全実証を裏取りした。抽出元 6 ファイル（ProductForm L53-72 / SummaryCard / DepartmentFilter 3 本 / SearchBar 系 2 本）の実在と props 形状は R1 で確認済み。

> Rally R1 で D-B1 の query 数二重誤認（home 3 カード/2 query、daily 2 query）を検出・訂正済み。「daily/monthly retry 不在」の構造的理由 = 同一 query 共有 + 二層 error 設計（page Alert L84-100 + in-card 比較データなし L131）と確定

### 2. scripts / 機械検証

AC はすべて既存コマンド（npm 5 種 / fd / rg / git diff / doc-consistency）で機械検証可能。新規 script 不要。`rg` のネガティブ glob は使わない（memory `ripgrep-15-negative-glob-broken.md`、リテラル解釈で全マッチ 0 件を返す regression のため canary 検索を検証手順に含める）。SummaryCard import の rg は R2 P2-1 で末尾 `"` anchoring + 正方向確認の二重化に修正済み。

### 3. 検証計画

安全網二分（既存 test あり = 不変条件 / なし = B0 characterization 先行）は親 packet rally R2 P1-3 の決定を踏襲。Rally R1 P1-3 で「既存 SummaryCards test」が架空と判明したため、B0 に home 3 カード characterization を必須として追加し、Trace C4 を「唯一の net」と正直に記載。意図的差分 3 クラスはすべて L3 human gate に接続し、mock green の自己申告だけで完了扱いしない（memory `feedback-subagent-green-report-verify-real-wiring.md`）。

### 4. 後処理

merge 後に packet を `docs/archive/plans/` へ移動（相対リンク変換必須、memory `feedback-archive-relative-path-conversion.md` — PR #49 で R3 fail を被弾した再発防止）、test matrix も `archive/plans/test-matrices/` へ同時移動。Plans.md の現在の基準 / entry（`[x]` + archived plan/matrix/evidence 3 行形式）/ 次の行動を同期し、catalog ②⑥ の書換結果と 59 索引を確認する。

### 5. 制約

npm install 系凍結（memory `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md`、新規依存ゼロで設計済みのため抵触なし）。既存テストの削除・skip なし（SearchBar 2 本は semantic 維持で移管）。`.claude/` 配下への成果物配置なし（Codex 可視性）。LSP policy: code 編集は baseline diagnostics → 編集 → 対象 diagnostics の 3 ステップを subagent prompt に含める（memory `feedback-lsp-skills-policy-hook.md`、docs 編集は適用外）。

### 6. commit 分割

B0-B7 の 8 commit、各 commit が独立に green（fmt/lint/typecheck/test）。B0 → B1-B6 → B7 の依存は「characterization 先行 → 抽出置換 → 設計書同期」の直列で、B4 のみ移動 + import 張替に縮小済み（R1 P1-2）。意図的差分は該当 commit に閉じ込め、PR body の設計↔実装対応表で trace する（memory `ui-design-impl-bundled-pr.md`）。

### 7. bias 自覚

D-B1 は Rally R1 の指摘を受けて「統合を諦める」方向へ倒した判断であり、逆方向の bias（手戻り回避優先で共通化価値を過小評価）があり得る（memory `feedback-recommend-with-explicit-basis.md` の自覚対象）。catalog ② 書換により規約と実装の整合は保たれるが、「daily/monthly の集計カードを将来共通化する価値」は PR-C 以降の再評価項目として Plans.md Backlog に記録する。D-B5 の適用 6 / 除外 2 の境界は R1 P3-3 で semantic 妥当と判定済み。

## Rally ログ

- **Round 1**（Plan agent, Opus, fact-check 指定）: P1 × 3 / P2 × 6 / P3 × 3。
  - P1-1 D-B1 の query 数二重誤認（home「4 独立 query」→ 実際 3 カード/2 query、daily「単一 query」→ 実際 2 query + in-card 部分障害）→ D-B1 を query 独立性基準で再設計
  - P1-2 SummaryCard の daily/monthly 適用は loading 時タイトル skeleton 構造が非互換で DOM 不変不成立 → daily/monthly を Non-scope 化、B4 は移動のみに縮小
  - P1-3 「既存 SummaryCards test」が架空（home 系 test ゼロ）→ B0 に home characterization 追加、Trace C4 訂正
  - P2-1〜P2-6（SearchBar の wrapper/type/trim 差、DepartmentFilter 実測差訂正、FormSection L53-72 + 三項式、monthly 月度の文言移植区別、ProductFormPage 2 header site、Trace C4 整合）→ 全反映
  - P3-1〜P3-3（IME test 両モード、catalog ② L99/L104 書換の B7 明示、shortcuts 数え方）→ 全反映
- **Round 2**（Plan agent, Opus, 新規観点 fact-check）: 新規 P1 × 0 / P2 × 2 / P3 × 3。
  - P2-1 AC の SummaryCard import 検証 rg が相対 import（`./SummaryCard`）に届かず、自己パスコメント行の前方一致で永久に 0 件にならない確定バグ → 末尾 `"` anchoring + 正方向確認（`patterns/SummaryCard`）に変更。相対 import 残存は typecheck（module not found）が gate
  - P2-2 catalog ② の per-card retry「標準」断定が L99/L104 以外に L64/L95/L105 + DSR L66 に残存 → B7 書換対象を 5 箇所へ拡張（部分書換の内部 drift 回避）
  - P3-1 B0 の render 方式二分（pure = 直接 render / page-level = renderWithClient + empty mock）を明記
  - P3-2 設計書の追記先を 52 拡張 → `59-ui-shared-patterns.md` 新設へ変更（52 は業務ロジックなし責務、DOC_STYLE_GUIDE §0 `5x` 準拠、親 packet からの判断変更として明記）
  - P3-3 PageHeader actions の実体（「商品登録」link button、既存 role/name assert 非破壊）を D-B2 に明記
  - 確認済み: D-B1 再設計と親 packet の整合（透明な判断変更として成立）/ catalog ③ L161 と不矛盾 / `fd` AC 構文 / ProductListPage assert 非破壊 / PK1-PK3 完備
- **Round 3**（Plan agent, Opus, R2 反映検証 + 新規観点）: 新規 P1 × 0 / P2 × 2 / P3 × 3 = 未収束。
  - P2-A catalog ② の per-card retry 断定が L101 / L107-108 にも残存（R2 修正と同型の漏れ）→ 行番号列挙をやめ「② 節全体（L62-109）整合」の範囲指定方式へ変更
  - P2-B B0 render 二分の分類誤り: daily ProductTable / monthly ランキング・部門別は props 駆動 pure（query mock では空分岐に**到達不能**）→ pure 3 / page-level 3 へ訂正。**agent 報告は stock を page-level から漏らしており orchestrator 裏取りで補正**（`StockInquiryPage.tsx` L120-122 = useStockInquiry 内蔵 page、rally subagent 非全能の実例）
  - P3-A home canonical = 共有 query × per-card retry の第 3 パターンを D-B1 規約に明示（PR-C 機械強制の誤検知予防）
  - P3-B 59 のテンプレ選択（業務ロジックなし版）+ M2 充足方法 + 索引フォーマットを B7 に明記
  - P3-C 委譲粒度（commit 単位 subagent、丸投げ禁止）/ L3 順序（CI → Codex → L3 → merge）/ B0-B4 import 透過性を明記
  - 確認済み: R2 反映 5 件中 3 件は矛盾なし / AC・Trace・Matrix 相互整合 / PK1-PK3 通過見込み（PK は docs/plans/ 保存時に発動の留意含む）
- **Round 4**（Plan agent, Opus, R3 反映検証 + 新規観点）: **新規 P1 × 0 / P2 × 0 = 収束**。P3 × 3（明文化推奨）は全反映。
  - R3 反映 5 件 + orchestrator の stock 補正をすべてソース fact-check で検証 OK（stock = page-level は `useStockInquiry.ts` L62-96 の useQuery 内蔵で確定）
  - P3-1 pure テーブル内 EmptyState 埋め込みの責務不変を D-B5 に明文化
  - P3-2 空状態 2 系統（0 件成功 = テーブル内 / 取得失敗 = ページ側 Alert、catalog ③ L161 の射程）の切り分けを D-B5 + B7 に明記
  - P3-3 characterization の置き場所・責務分離を B0 に、59 索引の機械検証 AC を追加
  - PK1/PK2/PK3 通過見込みを最終確認済み
- **収束宣言**: Round 4 で新規 P1/P2 = 0。R1〜R4 の指摘 P1 × 3 / P2 × 10 / P3 × 9 を全反映（収束基準: memory `feedback-plan-rally-required-before-exit`）。最終 gate = user 承認（ExitPlanMode）

## Review Response

### Codex Round 2（2026-06-13、P1: 0 / P2: 1 / P3: 1）

- **P2（SearchBar id の DOM 不変違反）= 採用**: 実証 — `patterns/SearchBar.tsx` L58 の commit 型既定 `id ?? "search-input"` に対し `ProductListPage` が id 未指定で、旧 `product-search-input` から変化していた（B0 characterization は aria-label 経由 assert のため id 変化を検出できず）。live 型（stock）は id を一切描画せず無傷を確認。修正 = reviewer 最小修正案どおり `ProductListPage` から `id="product-search-input"` を明示（DepartmentFilter の idPrefix per-callsite 方式と一貫）+ 結線 assert を ProductListPage.test に追加 + catalog ⑨ の構造 skeleton が旧インライン JSX のまま残っていたため patterns 呼び出し形へ張替（「id は呼び出し側で旧 contract を維持、既存画面の置換では必ず明示」を規約化）
- **P3（AC の src-tauri 0 件と実差分の乖離）= 採用**: AC を実条件（bindings 0 件 + src-tauri は traceability baseline / SKIP_DOCS の 2 ファイルのみ許容）へ同期

### Codex Round 3（2026-06-13、P1: 0 / P2: 1 / P3: 0。R2 P2/P3 = 解消判定）

- **P2（catalog ⑨ の docs contract 内部矛盾）= 採用**: ⑨ の a11y 行が「Label htmlFor + aria-label、ラベルを省略しない」と blanket 規定し、live 型（可視 Label なし）の skeleton・実装と矛盾。裏取りで同 class が節下半分に複数残存と判明（使用トークン = commit 型 wrapper 値のみ / 確定経路 = commit 型のみ / Do = ボタン両経路を全検索に要求）— catalog ② R3 P2-A と同じ「部分書換 drift」構図のため、該当 4 ブロックを mode-aware に一括書換（a11y は「両モード aria-label 必須 + commit 型のみ可視 Label 併置」、Don't に「live 型で aria-label を外さない」を追加）

### Codex Round 4（2026-06-13、P1: 0 / P2: 0 / P3: 0。R3 P2 = 解消判定、最終収束）

- merge blocker なしの最終収束判定。catalog ⑨ の mode-aware 分離（token / focus / 確定経路 / a11y / Do / Don't）が実装・実呼び出しと整合、`59-ui-shared-patterns.md` との矛盾なしを reviewer が確認

### L3 owner 承認 + merge（2026-06-13）

- L3 Windows native 実機確認（HEAD `5f0b28d`）: 意図的差分 3 クラスとも OK — ① products 検索 IME guard（変換中 Enter 誤発火なし + 確定後 Enter / ボタン正常）/ ② daily 部門フィルタ「すべての部門」表示 + 解除動作 / ③ EmptyState 標準 UI（通常到達可能な空状態で文言可読・次の行動が分かる・崩れなし）
- 月次 table-level EmptyState 2 分岐は月度全体の「当月データなし」が先行し通常操作で到達不能のため、RTL characterization test の DOM / 文言固定をもって確認済み扱い（判断根拠は PR #98 L3 コメント）
- PR #98 squash merge: `202e128`（2026-06-13）
