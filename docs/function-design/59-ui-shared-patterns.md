> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: [02-component-catalog.md](../design-system/02-component-catalog.md)（パターン契約の正典）、[2026-06-12-design-system-pr-b.md](../archive/plans/2026-06-12-design-system-pr-b.md)（Plan Packet、D-B1〜D-B6 の判断根拠）

## 59. UI-patterns: 共通 UI パターン部品（src/components/patterns/）

### 本書のテンプレ判定（UI 層関数設計書の 2 段階）

[52-ui-shared-layout.md](52-ui-shared-layout.md) が確立した二段判定に従う:

- CMD 呼び出し: なし（全 component が props 駆動の pure presentational、useQuery / invoke 非内蔵）
- 入力バリデーション: なし（SearchBar は文字列をそのまま `onSearchChange` へ渡し、検証は呼び出し側の責務）
- 画面内部 state 駆動のフロー分岐: なし（SearchBar の draft / debounce は入力 UI の内部機構であり、業務データや CMD 呼び出しとは結合しない）

→ **業務ロジックなし（純構造）** と判定。主要 3 項目（コンポーネント構成 / React State / 備考）で記述する。

### 59.1 コンポーネント構成

| ファイル | 契約（props） | 採用画面 | catalog |
|---|---|---|---|
| `src/components/patterns/PageHeader.tsx` | `{title, subtitle?, actions?}` | 8 画面（ProductFormPage は通常 + edit error の 2 site） | ① |
| `src/components/patterns/SummaryCard.tsx` | `{title, isLoading, isError, onRetry, loadingSkeleton?, children}` | HomePage 3 カード（独立/共有 query × per-card retry） | ② |
| `src/components/patterns/FormSection.tsx` | `{title, description?, children}`（description 未指定時 `<p>` 非描画） | ProductForm 4 セクション | ④ |
| `src/components/patterns/EmptyState.tsx` | `{icon?, title, description?, action?}` | 空結果 6 箇所（products 一覧 / stock 結果 / daily 明細 / monthly 月度・ランキング・部門別） | ⑥ |
| `src/components/patterns/SearchBar.tsx` | `{value, onSearchChange, label?, id?, placeholder?, ariaLabel?, debounceMs?, showSubmitButton?, type?, wrapperClassName?, inputClassName?}` | 商品一覧（commit 型）/ 在庫照会（live 型 debounceMs=200） | ⑨ |
| `src/components/patterns/DepartmentFilter.tsx` | `{options, selected, onChange, disabled?, allLabel?, widthClass?, idPrefix?}`（allLabel 既定「すべての部門」） | daily / products / stock の 3 画面 | ⑨ |

各 component の DOM 構造・トークン・Do/Don't の正典は [02-component-catalog.md](../design-system/02-component-catalog.md) の該当パターン。本書は props 契約と採用箇所の対応表を担い、二重記述しない。

### 59.2 React State

- **PageHeader / SummaryCard / FormSection / EmptyState / DepartmentFilter**: 内部 state なし（完全 props 駆動）
- **SearchBar**: `draft`（入力中文字列のローカル保持）+ debounce timer（live 型のみ）。`value` prop 変更で `draft` を同期。Enter keydown は両モードとも `event.isComposing` を最優先除外（IME 変換確定 Enter の誤発火防止）。commit 型は Enter / 検索ボタンで `onSearchChange(draft.trim())`、live 型は onChange を `debounceMs` で遅延 + Enter で即 flush（trim なし）

### 59.3 備考

- **SummaryCard の 3 パターン規約**: 回復導線の置き方（per-card retry / page-level Alert）は catalog ② の 3 パターン規約に従う。daily/monthly `SummaryCardsBar` はパターン 3 の canonical variant として patterns/ 統合の対象外（構造非互換、PR-B D-B1）
- **空状態の 2 系統**: 0 件成功 = `EmptyState`（pure テーブル内 or ページ分岐内）/ 取得失敗 = ページ側 Alert 差し替え。`EmptySearchPlaceholder` と shortcuts `emptyMessage` は semantic 相違（空結果でない）のため適用除外（catalog ⑥）
- **test の責務分離**: `src/components/patterns/*.test.tsx` は各 component 単体の DOM 規約を、feature 側の characterization test（B0 系）は「画面が component を正しく差し込む結線」を担う。両者は責務が異なるため重複ではなく、片方を理由なく削除しない
- **型の共有**: `DepartmentOption` は `patterns/DepartmentFilter.tsx` が定義を持つ。feature 側ローカル定義（useProductList / stock types）は構造的サブタイプで互換のまま残置しており、patterns/ からの re-export への統一は将来 PR の対象

### 59.4 非目的

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| CMD 呼び出し・データ取得 | patterns/ は純表示部品。query 管理は画面側 | 各 feature の hooks |
| 入力値の業務バリデーション | SearchBar は文字列を素通しする | 呼び出し側ページ / BIZ 層 |
| daily/monthly 集計バーの統合 | タイトル Skeleton / sub 行 / Tooltip の構造非互換、prop 肥大化回避 | `SummaryCardsBar`（各 feature 内） |

### 更新履歴

| 日付 | PR | 内容 |
|------|-----|------|
| 2026-06-13 | PR-B | 新設（B7）。6 component の契約と採用箇所、3 パターン規約・空状態 2 系統・test 責務分離を記録 |
