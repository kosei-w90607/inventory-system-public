# Phase 2 8-4 UI-06a 在庫照会 — 初 Windows native L3 デモ起因の修正（PR #67 内）

> **plan 配置**: docs/plans/2026-05-21-phase-2-ui-06a-demo-fixes.md（active plan SSOT、memory `feedback-active-plan-in-docs.md` 規律）
> **親 PR**: #67（feat/ui-06a-stock-inquiry、HEAD `dd41610`、Codex Round 1-3 全 close 済）
> **入力**: docs/function-design/58-ui-stock-inquiry.md、docs/SCREEN_DESIGN.md（在庫照会節 L120-132 / L167-176）
> **起源**: 2026-05-21 初の Windows native L3 デモ（`C:\Users\Owner\projects\inventory-system`）。merge gate 未通過、デモが実バグ + UX 問題を炙り出した

> **Round 履歴**
> - Round 0 = デモ feedback 全件コード裏取り済（B1/F1/F2 root cause 確定）+ user 2 決定（行インライン展開 / 選択状態即修正）+ PR 分割合意（推奨分割）
> - Round 1 = Plan rally 反映（P1×1 + P2×4 + P3×2）。P1-1 展開行 data-state × 色分け契約 H 重畳 / P2-1 ProductListTable 責務拡大の §58.7/§58.2 改訂 / P2-2 detail 失敗 2 系統描画 / P2-3 クリック展開 test 構成 / P2-4 D1 依存 decouple / P3-1 collapsible dead code / P3-2 抽出 commit 2 段化
> - Round 2 = Plan rally 2 周目反映（New-1 P1 + New-2 P2 + New-3 P3）。New-1 展開行背景を `has-aria-expanded:bg-muted/50` 含め className 明示固定 / New-2 PR #67 merge gate 合格条件 = F1/F2 目視のみ明示（色分け H/T-FLOW は full 8-0 gate）/ New-3 §3 行番号 drift 修正（L121→L119）+ collapsible 唯一利用元確定
> - Round 3（本版、Codex CLI 外部レビュー）= P2×3 + P3 反映（P1 ストッパー無し）。C-P2-1 list success + selected 不在（stale/手打ち URL、CSV invalidation 後の該当外化）で展開先消失 = selected clear 追加（§2.2/§58.8、§58.4 L184-185 既存方針で裏取り済、現行独立カードからの回帰防止）/ C-P2-2 drift grep を `collapsible|StockDetailCard` に拡張 + 旧 2026-05-20 本体 plan archive + FUNCTION_DESIGN.md 索引 L45/L116 更新（§3/§5 commit 6）/ C-P2-3 stateful harness で click 経路 + ProductListTable nextElementSibling colSpan 検証（§4）/ C-P3 §6 L2 に cd src-tauri 補完

---

## 0. スコープ（PR #67 = UI-06a 固有のみ）

pr-workflow-hygiene scope 規律（memory `feedback-pr-merge-gate-scope-discipline`）。PR #67 は UI-06a 専用。マージ済 09a/09b の問題は別 PR。

**PR #67 内（本 plan）**:
- **F1**: 商品詳細を最下部固定カード → 行インライン展開（+ list 失敗フォールバックで §58.8 部分障害許容契約を両立）
- **F2**: 状態チップ（すべて/在庫切れ/在庫少）の選択状態コントラスト強化
- **設計書**: function-design/58 §58.7 / §58.8 改訂
- **テスト**: StockInquiryPage.test.tsx + ProductListTable RTL 改訂

**PR #67 外（別 PR、§7 backlog に記録）**:
- B1（ナビ active 消失）/ U1t（売上タブ選択薄い）/ U4（日次月次 h1 分離）→ 別 PR「sales/nav polish」
- B2/B3（月次レイアウト）→ 同上、調査後
- U3（export 保存ダイアログ）→ 別 PR
- D1（seed に在庫切れ/少を仕込む）→ 別 PR（**full 8-0 gate / v0.8.0 タグの前提**。PR #67 単独 merge gate は block しない、§6-7 New-2 参照）
- D2（Z004 実売上 CSV）→ Backlog（Phase 4 持ち越し、既知）

---

## 1. 確定した root cause（全件コード裏取り済、2026-05-21）

| ID | 症状 | root cause（file:line） | 修正方針 |
|---|---|---|---|
| F1 | 詳細が一覧最下部、スクロール地獄 | `src/features/stock-inquiry/StockInquiryPage.tsx:131` で list 分岐の外に最下部描画 | 選択行直下に colSpan 展開行（§2.1）+ list 失敗時フォールバックカード（§2.2） |
| F2 | チップ選択状態が薄くて判別不能 | `StatusChips.tsx` → `src/components/ui/toggle.tsx:8` `data-[state=on]:bg-accent`（薄い） | `StatusChips` の `ToggleGroupItem` に強コントラスト active class（§2.3、primitive は触らず usage 上書き） |

---

## 2. 設計詳細

### 2.1 F1: 行インライン展開（list 成功時）

- `ProductListTable.tsx`: 選択行（`isSelected`）の**直後**に展開行を差し込む。`<TableRow>` + `<TableCell colSpan={5}>` に詳細内容を描画
- 現 `StockDetailCard.tsx` の内側描画ロジック（在庫数/売価/原価/最終入庫日/最終販売日 + 遷移 CTA × 3）を `StockDetailContent.tsx` として抽出し、インライン展開行とフォールバックカード（§2.2）で**共用**
- props: `ProductListTable` に `detailQuery: UseQueryResult<StockDetail>` を追加渡し
- **アニメーションなし**（ui-skills「NEVER animate layout properties（height 含む）/ NEVER add animation unless explicitly requested」）。Collapsible の height アニメは使わず条件描画のみ。現 `StockDetailCard` の `Collapsible` 依存はインライン版で不要化（collapsible.tsx primitive 自体は残置、§3 P3-1 で dead code 確認）
- **P1-1: 展開行の `data-state` と色分け契約 H の重畳対策**（Plan rally Round 1）:
  - 選択行（`ProductListTable.tsx:59` `data-state="selected"`）の shadcn `data-[state=selected]:bg-muted` 帯と、差し込む展開行 `<TableRow>` の背景を明示。展開行は**選択行と視覚的に一体**に見せる
  - **New-1（Plan rally Round 2）**: `table.tsx:48` の `TableRow` は `data-[state=selected]:bg-muted`（不透明）に加え `has-aria-expanded:bg-muted/50`（半透明）も持つ。展開行の背景を primitive トリガ任せにすると不透明 vs 半透明で分断しうる → 展開行 `<TableRow>` は `className="bg-muted hover:bg-muted"` 等で**明示固定**し primitive の `data-state`/`has-aria-expanded` トリガに依存しない（`data-state="selected"` 付与だけで足りると誤読しないこと）
  - 色分け契約 H の文字色（`STOCK_CLASS` の `text-rose-700`（stockout）/ `text-amber-700`（low）、`ProductListTable.tsx:31-32`）は**在庫数セルの文字色**で、行 selected 背景（`bg-muted`）と重畳しても可読性が落ちないか実装時に目視確認（refactoring-ui コントラスト比）。F2 のチップ選択色とは別系統で干渉しない

### 2.2 F1: list 失敗フォールバック + selected 不在時の clear（§58.8 部分障害許容の両立）

- **構造的緊張**（skills-decision.json 記録済）: 行インライン展開は list 成功 **かつ selected が現 list に含まれる**前提。一方 Codex Round 1 P2-1 で確立した §58.8 契約「list 失敗時も detail 独立描画」と衝突
- **解**: ハイブリッド（`listQuery` × `selected` の状態で 3 分岐）
  - `listQuery.isSuccess` かつ selected が items に**含まれる** → `ProductListTable` 内で選択行直下にインライン展開（§2.1）
  - `listQuery.isSuccess` かつ selected が items に**含まれない**（stale/手打ち URL、または CSV 取込み invalidation 後の該当外化）→ `selected` を URL から **clear**（**C-P2-1、Codex CLI Round 3**）。§58.4 L184-185 の既存方針「選択は『現 list 条件に対する状態』として扱う」に沿う。展開行も detail query（`enabled: selected != null`）も自然消滅し、現行の独立カード（`StockInquiryPage.tsx:353-354` で list と無関係に detail 描画）からの**回帰を防ぐ**。なお clear 後の次 render で現 list が 1 件なら既存の「結果 1 件で自動展開」が後続発火し現 list の唯一商品へ自動展開される（"selected 不在 = 詳細が必ず消える" ではなく、現 list 条件に対する選択へ収束する。C-P3 Codex CLI Round 4）
  - `listQuery.isError && selectedValue !== null` → エラー Alert の下に**フォールバック `StockDetailCard`**（`StockDetailContent` を Card で包む、独立描画）
- **clear の実装**（既存「結果 1 件で自動展開」useEffect と同型、§58 L259-265 パターン）: `listQuery.isSuccess && selected != null && !items.some((i) => i.product_code === selected)` で `navigate({ selected: undefined })`。loading 中は items 未取得のため `isSuccess` ガード必須。自動展開 useEffect（`selected == null` で 1 度）と発火条件が排他なので競合しない
- これで detail は list 成功（含有）/ list 失敗の両分岐で描画され、selected 不在時は clear で整合。契約を守りつつスクロール地獄を解消（memory `feedback-onscreen-demo-overrides-desk-ux-decision`）

### 2.3 F2: 選択状態コントラスト

- `StatusChips.tsx` の `ToggleGroupItem` に `className` で active 上書き（toggle.tsx primitive は全画面共有のため触らない = scope 規律）
- 方針（refactoring-ui「選択状態は size/weight/color で明確化」+ memory `feedback-non-it-user-readability-over-aesthetics`）: 選択中 = solid 背景 + 太字 + 十分なコントラスト。既存 warm token 流用（候補: `data-[state=on]:bg-stone-700 data-[state=on]:text-white data-[state=on]:font-semibold`、確定値は実装時に WCAG 4.5:1 で裏取り）
- accent 1 view 1 色（ui-skills）。色分け契約 H（行の在庫切れ赤/在庫少黄）とは別系統なので干渉しない

---

## 3. 設計書改訂（function-design/58）

- **§58.7**: ページ構造図を「最下部固定カード」→「選択行直下インライン展開 + list 失敗時フォールバックカード」に改訂。`StockDetailContent` 抽出を反映。**P2-1: ProductListTable 節（doc L376-380）も改訂** — `detailQuery` props 追加 + 「選択行直下に展開行を描画」を反映（presentational から「一覧 + 詳細展開描画」へ責務拡大）
- **§58.2 責務表（doc L112 ProductListTable 行 / L119 collapsible 行、行番号は実装時 rg 再特定）**: **P2-1** ProductListTable の責務記述を「一覧表示 + 行展開で詳細描画」に更新。**P3-1** collapsible.tsx「StockDetailCard 用」記述（doc L119）は確認済 = StockDetailCard が唯一の利用元（csv-import の `ErrorRowsTable.tsx:35` は Accordion の `collapsible` prop で別物）、F1 で StockDetailCard の Collapsible 撤去 → collapsible.tsx は dead code 化するため責務記述更新 or primitive 撤去判断
- **§58.8**: 部分障害許容契約を改訂。**P2-2**: detail の**成功**描画（list 成功=インライン展開行内 / list 失敗+selected=フォールバックカード内）に加え、detail **失敗**描画（#3）も 2 系統に分岐することを明記 — list 成功時はインライン展開行内の inline エラー、list 失敗時はフォールバックカード内の inline エラー。両系統とも抽出した `StockDetailContent`（isLoading/isError/data 全状態を内包）が担う（Codex Round 1 P2-1 の契約を構造変更後も維持）。**+ C-P2-1（Codex CLI Round 3）**: 「list success かつ selected が items に不在」の状態を **selected clear** として §58.8/§58.4 に明記する（detail の描画場所消失 = 現行独立カードからの回帰を防止、§2.2）
- **§58.10**: 色分け契約 H / 検索駆動 I は**変更なし**
- **§58 本文の旧記述一括書き換え（C-P2-2、Codex CLI Round 3）**: 「最下部固定 / テーブル下部固定 / collapsible 展開」の旧表現は §58.7 本文（`58.md:353-354` コメント / `:380` / `:387-389` StockDetailCard 節）+ モジュール表（`:14` / `:115` / `:121` / `:152`）+ 障害許容表（`:402`）に分散。grep を `rg "最下部|テーブル下部固定|collapsible|StockDetailCard" docs/` まで**拡張**して全箇所一括書き換え（memory `feedback-codex-drift-fix-grep-all-locations`、旧 `最下部|テーブル下部固定` だけでは collapsible 系を取りこぼす）
- **FUNCTION_DESIGN.md 索引更新（C-P2-2）**: 親索引 `docs/FUNCTION_DESIGN.md:45`（UI-06a 対象モジュール行）/ `:116`（目次リンク行）の「collapsible/toggle/toggle-group 新規 add」記述を F1 反映で正確化（collapsible は当初 add したが F1 インライン展開化で**未使用**、primitive 残置 = 実利用は toggle/toggle-group のみ）
- **旧本体 plan の archive（C-P2-2）**: `docs/plans/2026-05-20-phase-2-ui-06a.md` は §設計判断 B（`:126`）で「テーブル下部固定の詳細カード」を採用方針として保持（本体実装は完了済 = `c723afb`/`1f87472`）。active な docs/plans に旧方針が並ぶ drift を解消するため archive へ移送（§5 commit 6、相対パス変換は memory `feedback-archive-relative-path-conversion`。当時の採用判断は point-in-time 記録として本文保持し書き換えない）
- doc-consistency R0/R1/R3 + L2 design_compliance（`58-ui-stock-inquiry.md` は既登録済）通過確認

---

## 4. テスト改訂（TDD: Red → Green）

- `StockInquiryPage.test.tsx`:
  - 既存「list 失敗 + detail 成功 → 独立描画」（Codex P2-1 test、`StockInquiryPage.test.tsx:88-96`）→ assert（在庫数 / P-001）は維持可能だが、描画先が**フォールバックカード**である前提に改訂
  - 新規: list 成功 + 選択行直下インライン展開。**P2-3: 現行 test は props 駆動（`onSearchChange` は `vi.fn()` スタブ、`StockInquiryPage.test.tsx:50,79`）で URL state が実更新されないため、user-event クリック単独では展開検証できない**。`selected` を初期 search props に与えた render（または rerender）で「選択行直下に展開行が描画される」を assert する構成にする
  - **C-P2-3 stateful harness（Codex CLI Round 3）**: 上記 props 駆動 render に加え、`onSearchChange` / `onSelect` updater を `useState` に適用する小 harness を置き、`user.click(row)` → `selected` 更新 → 選択行直下にインライン展開行が出る**統合経路**を検証する（props render 単独では「クリックで選択更新され展開する」経路を弱くしか証明できない）
  - **C-P2-1 新規 test（Codex CLI Round 3）**: list success だが `selected` が items に不在（stale URL 相当）→ `navigate({ selected: undefined })` 相当の clear が発火し、展開行も詳細も描画されないことを assert（§2.2 の回帰防止）
- `ProductListTable.test.tsx`（新規 or 既存拡張）: 選択行直下の colSpan 展開行描画 / 非選択時は展開なし / detail 失敗時のインライン inline エラー（P2-2）。**C-P2-3 regression guard**: 選択行の `nextElementSibling` が `td[colspan="5"]`（detail/error を内包）を持つことまで assert し、旧 bottom card 実装の混入を落とせるようにする
- F2 コントラストは視覚要素で unit 検証不可（L3 デモで目視）

---

## 5. コミット分割

| # | commit | 内容 | 種別 |
|---|---|---|---|
| 1 | `refactor(stock-inquiry): StockDetailContent 抽出` | StockDetailCard 内側（isLoading/isError/data 全状態 + CTA）を StockDetailContent に分離。**P3-2: この commit では Collapsible を残したまま内側だけ抽出（機能完全不変、git diff 明快）**、Collapsible 撤去は commit 2 で行う | frontend |
| 2 | `feat(stock-inquiry): 詳細を行インライン展開 + list失敗フォールバック` | ProductListTable colSpan 展開（Collapsible 不使用、条件描画）+ StockInquiryPage 分岐改訂 + フォールバックカード（F1）+ collapsible dead code 判断（P3-1） | frontend |
| 3 | `style(stock-inquiry): 状態チップ選択状態コントラスト強化` | StatusChips active class（F2） | frontend |
| 4 | `test(stock-inquiry): インライン展開 + フォールバック RTL` | テスト改訂（§4） | test |
| 5 | `docs(stock-inquiry): §58.7/§58.8 インライン展開 + フォールバック契約改訂` | function-design/58（§3、collapsible/StockDetailCard 旧記述一括書き換え + selected clear 明記）+ FUNCTION_DESIGN.md 索引 L45/L116 更新（C-P2-2） | docs |
| 6 | `docs: 旧 UI-06a 本体 plan を archive` | `docs/plans/2026-05-20-phase-2-ui-06a.md` → `docs/archive/plans/` へ git mv（相対パス変換、drift 源除去、C-P2-2） | docs |

memory `ui-design-impl-bundled-pr`（UI 設計 + 実装 1 PR 統合）/ `feedback-commit-zero-plan-apply-immediately`（commit-0 指示は同 session 適用）。

---

## 6. 検証（実装後）

1. **品質 3 点**: `cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test`（変更なしだが回帰確認）
2. **frontend**: `npm run typecheck && npm run lint && npm run format:check && npm run build`
3. **Vitest**: `npm run test`（インライン展開 + フォールバック新規ケース）
4. **設計書整合**: `./scripts/doc-consistency-check.sh` + `--target plan docs/plans/2026-05-21-phase-2-ui-06a-demo-fixes.md`
5. **L2**: `cd src-tauri && cargo test --test design_compliance_test`（`design_compliance_test.rs` は `src-tauri/tests/` 配下、C-P3 Codex CLI Round 3）
6. **LSP**: 編集 .tsx（StockInquiryPage / ProductListTable / StockDetailContent / StatusChips）baseline → Write → URI 指定 getDiagnostics 0
7. **L3 再デモ（Windows native、merge gate）— P2-4: D1 依存を decouple**:
   - **PR #67 単独で検証可能（D1 不要）**: F1 インライン展開のスクロール解消（任意商品「毛糸」等を検索 → 行クリック → 直下展開）+ F2 選択状態判別（チップ選択は結果有無に関わらずボタン状態で確認可）
   - **D1 着地後に検証（full 8-0 gate 側）**: T-06a-4/5 色分け契約 H（在庫切れ赤 / 在庫少黄）は seed に stockout/low がないと検証不能。これは**既存の色分けロジック検証**であり F1/F2 とは別軸 → D1 PR を full 8-0 gate より前に merge する順序とし、**PR #67 の merge gate は D1 に block されない**
   - **New-2（Plan rally Round 2）— PR #67 merge gate 合格条件の明示**: PR #67 を merge 可にする L3 合格条件は「**F1 インライン展開のスクロール解消 + F2 選択状態判別の目視 OK（user 承認）**」のみ。色分け契約 H（T-06a-4/5）と 5 画面通し（T-FLOW）は **full 8-0 gate（v0.8.0 タグの gate）側**であり PR #67 の merge gate ではない。§0 の「D1=demo 再実施の前提」は full 8-0 gate（タグ）の前提を指し、PR #67 単独 merge の前提ではない
   - memory `windows-native-demo-sync-runbook` 手順で再取り込み

---

## 7. 別 PR backlog（PR #67 外、Plans.md Backlog にも記録）

| PR 候補 | 項目 | root cause / 方針 |
|---|---|---|
| sales/nav polish | B1 ナビ active 消失 | `TabsHeader.tsx:24/33` + `SidebarLink.tsx:38` `activeOptions:{exact:true}` に `includeSearch:false` 追加（**TanStack `includeSearch` デフォルト挙動は実装前に公式 docs 裏取り**） |
| sales/nav polish | U1t 売上タブ選択薄い | TabsHeader active class 強化（F2 と同方針） |
| sales/nav polish | U4 日次/月次 判別 | 両ページ h1「売上レポート」→「日次売上」「月次売上」分離（B1 修正で sidebar 追従は自動解決） |
| sales/nav polish | B2/B3 月次レイアウト | 文言はみ出し / 月間売上合計ずれ（CSS、現物調査要） |
| export dialog | U3 保存ダイアログ | `useExportFile` を Tauri dialog plugin（save dialog）経由に。permission 追加要 |
| demo seed | D1 在庫切れ/少 seed | `src-tauri/src/seed_demo.rs` に stockout（qty<=0）/ low（qty>0 かつ閾値以下）を数件確実に投入。T-00-2/T-06a-4/5 検証可能化。**full 8-0 gate（色分け契約 H 検証）の前提、PR #67 単独 merge gate は block しない**（P2-4 decouple、§6-7） |
| Backlog | D2 Z004 実売上 CSV | Phase 4 UI-08 PLU 書出し完成後に取得（既知、memory `feedback-z004-vs-plu-master-confusion`） |

---

## Self-Review（7 観点、ExitPlanMode 前に Plan rally で精査・補強する。memory `plan-self-review-before-implementation` + `feedback-self-review-mechanical-addition-anti-pattern`）

### 1. 技術的前提
> LSP/Skills Policy hook 下で .tsx 4 ファイル（StockInquiryPage:131 / ProductListTable:40-79 / StockDetailContent 新規 / StatusChips:21-42）編集。baseline → Write → URI 指定 getDiagnostics の 3 ステップ（memory `feedback-lsp-skills-policy-hook`）。.md（58）は LSP 適用外。

skills-decision.json 更新済（plan-mode-discipline / refactoring-ui / ui-skills / tailwind-4 / react-19 / typescript / inventory-code-review / pr-workflow-hygiene / test-driven-development 適用）。commit prefix は refactor/feat/style/test/docs を内容で選択。rebase 不要（HEAD `dd41610` から積み増し）。

### 2. スクリプト詳細
> 新規スクリプトなし。検証は既存 `scripts/doc-consistency-check.sh` / `cargo` / `npm` のみ（§6）。`--target plan` で本 plan を 9 項目チェック。

doc-consistency R3 回避のため plan 内 path 参照は inline code で記述（memory `feedback-diff-example-inline-code`）。

### 3. ドキュメント修正
> function-design/58 §58.7（ページ構造図）/ §58.8（部分障害許容契約 #1/#3）を改訂。§58.10（色分け H / 検索駆動 I）は不変。R0/R1/R3 + L2 design_compliance（既登録）通過確認（§3）。

設計書 drift 防止: 詳細表示方式の記述を「最下部固定」から元文書き換え（補正追記でなく、memory `feedback-codex-drift-fix-grep-all-locations` の設計判断ログ drift 教訓）。grep は本文 §3 と同条件 `rg "最下部|テーブル下部固定|collapsible|StockDetailCard" docs/` で全箇所一括確認（C-P3 Codex CLI Round 4 で本文と一貫化）。**archive 済の旧 plan（`docs/archive/plans/2026-05-20-...`）の hit は point-in-time 記録として許容**（`-g '!archive/**'` 除外 or 目視許容）。

### 4. 検証計画
> 自動: 品質3点 + frontend + Vitest + doc-consistency 19+9 + L2 + LSP diagnostics（§6 の 1-6）。L3 再デモ（§6-7）は P2-4 decouple により F1/F2 を PR #67 単独で検証可能、色分け契約 H 検証のみ D1 着地後（full 8-0 gate）。

Plan rally（本 Self-Review 後に実施、新規指摘 0 まで）+ ExitPlanMode 前 official docs 検証（F1 は Radix Table/JSX で framework spec 依存薄、B1 の includeSearch は別 PR で検証）。

### 5. 後処理
> memory 監査 sentinel: `touch ~/.claude/projects/-home-kosei-Projects-inventory-system/memory/.last_audit` を ExitPlanMode 後に実施。本 plan で feedback 2 件（readability-over-aesthetics / onscreen-demo-overrides）+ runbook 1 件を既に Write 済。

完了時 plan archive: `docs/archive/plans/` へ相対パス変換で移送（memory `feedback-archive-relative-path-conversion`）。別 PR backlog（§7）を Plans.md Backlog に転記。

### 6. 実行制約
> Claude は merge しない（L3 デモ合意 = user gate、§6-7）。別 PR（B1/U3/D1 等）は本 PR で着手しない（scope 規律、memory `feedback-pr-merge-gate-scope-discipline`）。F2 のコントラスト確定値は実装時 WCAG 裏取り後に決める（推測で固定しない）。

### 7. コミット分割
> 6 commit（refactor 抽出 → feat F1 → style F2 → test → docs 改訂 → docs archive）、§5。各単一責務。Plans.md 反映は節目（PR/round 境界）のみ（memory `feedback-plans-sync-commit-milestone-only`）。

依存: commit 1（抽出）→ 2（F1、抽出に依存）。3（F2）は独立。4（test）は 2/3 後。5（docs 改訂）は 2 の構造確定後。6（旧 plan archive、C-P2-2）は独立（本体実装完了済のため任意タイミングだが drift 解消のため本 PR に含める）。
