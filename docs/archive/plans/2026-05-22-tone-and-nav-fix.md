# 実装プラン: 選択状態トーン統一 + 全画面 nav fix（3 PR progression）

> 起票: 2026-05-22 / 親 SSOT: `Plans.md` Backlog「別 PR『選択状態トーン統一 + 全画面 nav fix』」(a)-(f)
> 配置: `docs/archive/plans/2026-05-22-tone-and-nav-fix.md`（2026-06-08 archive 移送）

## Risk

Risk: R3

Reason:
UI route/search active-state behavior, operator-facing selection tone, demo seed data, and report card layout affect daily operator workflows and review gates.

## Goal

Search-param screens keep active navigation, daily/monthly headings are distinct, selection state tone is consistent, demo seed data exposes stockout/low-stock states, and sales summary cards stop overflowing.

## Current Status

2026-06-07 時点で、この plan は縮小された active follow-up として残す。

- PR-1 scope（nav active / daily-monthly headings）は PR #69 で merge 済み。
- PR-3 scope（demo seed stockout/low / SummaryCards overflow）は PR #70 で merge 済み。
- 在庫照会の chip tone と色だけに依存しない status visibility は、別 R3 follow-up の PR #74 で merge 済み。
- 残 active scope は Sidebar / sales tabs / monthly mode tabs の横断 selection-tone 統一のみ。これは Phase 2 completion / merge gate ではなく follow-up。
- 2026-06-08 follow-up branch では、Sidebar / sales tabs / monthly mode tabs を shared stone selection tone に寄せ、`StatusChips` は既存 stone tone を同じ定数参照へ移す。Windows native L3 は PR evidence で確認する。

## Scope

- Sidebar and sales tab active-state behavior for search-param URLs.
- Daily/monthly sales page headings.
- Selection-state tone for sidebar, sales tabs, and stock inquiry chips.
- Demo seed stockout/low-stock samples.
- Daily/monthly sales summary card truncation behavior.
- Matching source-doc and `Plans.md` updates for those changes.

## Non-scope

- New npm packages or Tauri dialog plugin migration.
- DB schema, Tauri command DTO, generated bindings, or POS CSV/PLU contracts.
- Reworking sales aggregation semantics.
- Broad UI redesign outside the listed selection-state and card overflow fixes.

## Acceptance Criteria

- `npm test` includes active-state regressions for search-param routes.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` pass for frontend changes.
- `cd src-tauri && cargo test` passes after seed changes.
- `bash scripts/doc-consistency-check.sh` and `bash scripts/doc-consistency-check.sh --target plan` finish with no ERROR.
- Windows native L3 notes record PR-2/PR-3 visual verification in `Plans.md` or PR evidence for selection tone, stockout/low-stock visibility, and card overflow.

## Test Plan

For R3/R4, include or link a Test Design Matrix.

Test Design Matrix: [test-matrices/2026-05-22-tone-and-nav-fix.md](test-matrices/2026-05-22-tone-and-nav-fix.md)

- targeted tests: active-state RTL tests, stockout/low-stock seed tests.
- negative tests: search params must not clear active state; stockout must not be counted as positive low-stock sample.
- compatibility checks: no route/search schema, DB schema, Tauri DTO, or bindings changes.
- data safety checks: synthetic seed data only; no real POS/store artifacts.
- main wiring/integration checks: shared `SidebarLink` / `TabsHeader` paths and seed binary tests.

## Boundary / Wire Contract

- producer: TanStack Router links, seed demo generator, sales summary card components.
- consumer: React UI, Windows native operator demo, Rust seed tests.
- wire type: URL path/search state and SQLite demo seed rows.
- internal type: router active state, React class state, Rust seed product rows.
- precision/range: stockout `stock_quantity <= 0`; low stock `stock_quantity > 0` and under unit threshold.
- round-trip path: browser route/search state -> active UI; seed generator -> SQLite rows -> stock inquiry UI.
- invalid input: unsupported route/search fields remain handled by route validators.
- compatibility: no DB migration, command DTO, generated binding, POS CSV, PLU TSV, or report CSV schema change.

## Review Focus

- Search-param active-state regression coverage.
- Selection tone consistency without breaking semantic stockout/low-stock colors.
- Seed determinism and stockout/low-stock separation.
- Card overflow fix without hiding critical report meaning.
- Source-doc and dashboard consistency.

## Spec Contract

Contract ID: UI-WF-2026-05-22

- URL search params must not clear active navigation for the current screen.
- Selection state must stay visually consistent across sidebar, sales tabs, and stock inquiry chips.
- Demo seed data must include distinct stockout and positive low-stock examples.
- Summary card values must not overflow their card containers.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-WF-2026-05-22 | PR-1 active state | `SidebarLink.test.tsx`, `TabsHeader.test.tsx` | search params preserve active UI | `npm test` |
| UI-WF-2026-05-22 | PR-2 selection tone | L3 visual review | tone consistency and readability | Windows native L3 note |
| UI-WF-2026-05-22 | PR-3 seed states | `seed_test.rs` | stockout and positive low-stock separation | `cargo test` |
| UI-WF-2026-05-22 | PR-3 card overflow | L3 visual review | summary cards no longer overflow | Windows native L3 note |

## Data Safety

- Do not commit real POS CSV, PLU exports, SQLite DB files, backups, logs, receipt images, or store sales/cost data.
- Keep Windows native demo output and app data local-only.
- Use synthetic seed data and existing synthetic tests only.

## Context

PR #67 UI-06a（`cf89082` マージ済）の**初 Windows native L3 デモ**で UI-06a 以外の問題群が判明した。PR #67 内では F1/F2/余白/detail guard のみ対応し、横断的な問題は別 PR に切り出すと Backlog に記録済み。本プランはその回収。

判明した問題は性質が異なる: (a) 全画面 nav active 消失は機械的バグ修正、(b) 選択状態トーンは実機比較が要る目視判断、(c)/(e)/(f) は polish。1 PR にまとめると review が「バグ修正」「好み判断」「polish」で濁るため **3 PR に分割**する。(d) export の Tauri save dialog 化は `@tauri-apps/plugin-dialog` の npm install が必要で **Mini Shai-Hulud worm 凍結ルール（CLAUDE.md 最重要セキュリティ）に抵触**するため本 PR 群から除外し Phase 3 へ送る（`FileDropzone.tsx` の既存「Phase 3 で別 PR」コメントと整合、公式 docs https://v2.tauri.app/plugin/dialog/ + supply-chain 報告で裏取り済）。

intended outcome: search params を持つ全画面でサイドバー active が維持され、選択状態トーンが「マイルドだが一目で分かる」中庸基準で全画面統一され、demo seed で色分け契約 H が検証可能になり、月次カードの溢れが解消される。

## 3 PR overview + 依存順序

| PR | 内容 | 性質 | L3 demo |
|----|------|------|---------|
| **PR-1** | (a) includeSearch:false 3 箇所 + (c) h1 分離 | 機械的・低リスク | 任意 |
| **PR-2** | (b) 選択状態トーン中庸統一（チップ/売上タブ/月次 mode tab/サイドバー） | 目視判断 | **必須** |
| **PR-3** | (e) seed stockout/low + (f) 月次 SummaryCardsBar truncate | polish | **必須** |

**依存制約**: PR-1 と PR-2 は同一ファイル（`SidebarLink.tsx` / `TabsHeader.tsx`）を触るため **PR-1 → PR-2 は直列必須**（conflict 回避）。PR-3 は seed + 月次で独立、任意タイミング。**実務最適順**: PR-1 → PR-3 → PR-2（PR-3 の seed stockout/low が PR-2 の L3 トーン比較で在庫切れ/在庫少チップに実データを供給する）。本セッションは **PR-1 から着手**（user 当初「B1 nav fix 先行」志向）。

新規 npm package・crate は **3 PR とも不要**（PR-1: TanStack Router 既存 prop / PR-2: Tailwind 標準 stone palette + 新規 TS 定数 1 個 / PR-3: 既存 rand/rusqlite + Tailwind truncate）。npm 凍結遵守。

---

## PR-1: fix navigation active state and sales headings

### 実装
- `src/components/layout/SidebarLink.tsx:38` — `activeOptions={{ exact: true }}` → `{ exact: true, includeSearch: false }`
- `src/components/sales/TabsHeader.tsx:24`（日次 Link）+ `:33`（月次 Link）— 同様に `includeSearch: false` 追加
- `src/features/daily-sales/DailySalesPage.tsx:70` — `<h1>売上レポート</h1>` → `日次売上`
- `src/features/monthly-sales/MonthlySalesPage.tsx:71` — 同 → `月次売上`

root cause: TanStack Router `activeOptions.includeSearch` デフォルト `true`（context7 `/tanstack/router` navigation docs で確認。ActiveOptions interface コメント "If true, the link will only be active if the current URL search params inclusively match the `search` prop" + 別段落 "includeSearch (boolean, defaults to true)"）。search params 付き URL で search なし `to` の Link が active から外れる。`exact: true` 併記のまま `includeSearch: false` で path 完全一致のみ active に。TabsHeader は `to` が `/reports/daily` と `/reports/monthly` で異なるため両タブ同時 active の危険なし（`TabsHeader.tsx:22-39` で確証済）。h1 は `src/config/navigation.ts`（label/title とも「日次売上」「月次売上」で一致確認済、Round 1 rally 実証）の文言と揃える。**h1 はリテラルハードコードで許容**（h1 = 画面見出し / navigation.title = nav・window title 用途で役割分離、navigation.title からの導出は依存追加 + scope 拡大のため見送り）。

### テスト
TanStack Router の active は DOM 実装非依存の `data-status="active"` 属性で検証（クラス文字列 hardcode は脆い。docs 確認: Link は active 時に `data-status` 属性を付与、値は `active` or undefined）。**回帰検出力のため初期 entry に search params を必ず載せる**（search なし URL では includeSearch true/false どちらでも日次 Link が active になり、修正前コードでも pass して回帰を検出できない = R2-1）。`createMemoryHistory({ initialEntries: ["/reports/daily?<有効な search>"] })` で router 構築 → search 付き状態で日次 Link が active を保ち月次が非 active を assert（`TabsHeader` 1 本、テスト名に REQ-501/502）。**実装時に `src/routes/reports/daily.tsx` の `validateSearch` と `SortColumn` enum 値を Read で確認**し、search params を実 schema が許容する非 undefined 値に合わせる（daily.tsx searchSchema は全フィールド `.catch(undefined)`、`?date=...&sortBy=<有効値>` 等）。**SidebarLink も `SidebarLink.test.tsx`（新規）で 1 ケース必須検証（= Codex P2-1）**: B1 の主症状は「全画面サイドバー active 消失」で SidebarLink が核心バグのため、TabsHeader だけでは共有 nav の退行を CI で取り逃がす（`includeSearch` を戻しても緑のまま通る）。19 項目全部は不要、単一 NavItem で十分 — `createMemoryHistory({ initialEntries: ["/stock?q=abc"] })`（or `/reports/daily?date=2026-03-22`）で search 付き初期 URL を構築し、対象リンクが `data-status="active"` を維持することを assert（テスト名に対応 REQ）。**実装時に `src/config/navigation.ts` の対象 NavItem path と `SidebarLink` の props 構造を Read で確認**して initialEntries を実在 path に合わせる。

### commit 分割
1. `fix(nav): includeSearch:false で search 付き URL の active 維持`（SidebarLink + TabsHeader 3 箇所 + RTL test 2 本: `SidebarLink.test.tsx` + `TabsHeader` test）
2. `fix(sales): h1 を 日次売上/月次売上 に分離`（2 ページ + docs 同期）

### 設計書更新
`docs/function-design/52-ui-shared-layout.md`（SidebarLink activeOptions、§52.1/§52.6 + `SidebarLink.tsx:14` コメント）/ `docs/function-design/56-ui-daily-sales.md` + `57-ui-monthly-sales.md`（h1 文言記載あれば）/ `docs/architecture/ui-task-specs.md` UI-12（includeSearch 言及は任意）。

---

## PR-2: unify active selection tone（最重要・目視判断）

### 現状の 3 トーン（PR-2 着手時）
- チップ `src/features/stock-inquiry/components/StatusChips.tsx` — PR #74 で中庸 stone tone へ調整済み
- 売上タブ `src/components/sales/TabsHeader.tsx` — `bg-background text-foreground shadow-sm`（白背景+影）
- サイドバー `src/components/layout/SidebarLink.tsx` — `bg-amber-100/60 text-amber-900 [&_svg]:text-amber-700`（amber 系）

### 中庸トーン候補（推奨初期値 C）
- **案 A（ソフト stone）**: `bg-stone-200 text-stone-900 font-medium border-stone-300` — 最もマイルド
- **案 B（stone + 影）**: `bg-background text-foreground font-medium shadow-sm border-stone-300` — タブ既存に寄せて統一
- **案 C（中庸 stone-300）**: `bg-stone-300 text-stone-950 font-semibold border-stone-400` — A と F2 の中間、視認性最優先（推奨）。二択切替の segmented control は押しボタン状の濃い外枠を避けるため、同じ背景/文字/太字を保ったまま active border だけ `border-stone-300` に落とす

refactoring-ui 原則（選択は背景トーン段差 + 適度コントラスト、solid 一色は強すぎ、grayscale-first）+ memory `feedback-non-it-user-readability-over-aesthetics`（薄すぎも濃すぎも NG = マイルドな中庸）。

### 切替容易化（共通定数 / 二択切替 primitive SSOT）
更新 `src/components/ui/selection-tone.ts`（定数のみ、Tailwind JIT が literal 全文を静的検出するため動的結合は使わない）:
- `SELECTION_TONE_ACTIVE`（prefix なし版 = SidebarLink/TabsHeader 用、`cn()` で結合）— **`hover:bg-...` を内包**（SidebarLink:42 の `hover:bg-amber-200/60` 相当。hover override を落とすと選択中リンク hover で基底 `hover:bg-stone-200/60` に戻る退行 = R2-2）
- `SELECTION_TONE_ACTIVE_ICON`（SidebarLink 用）— active icon を `stone-700` へ揃え、amber を navigation selection から外す
- `SELECTION_TONE_CHIP_ON`（`data-[state=on]:` prefix 版 = StatusChips の Radix data-state 駆動用、JIT 安全のため prefix 別定数として持つ）— **`data-[state=on]:hover:bg-... data-[state=on]:hover:text-...` を内包**（StatusChips は variant=outline（StatusChips.tsx:28）で、基底 toggleVariants outline の `hover:bg-accent hover:text-accent-foreground`（toggle.tsx:14）漏れを抑える override。落とすと選択中チップ hover で accent に戻る退行 = R3-1）。L3 案 A/B/C 色変更時は hover 値も同期

新規 `src/components/ui/segmented-control.tsx`:
- `segmentedControlListClass` / `segmentedControlItemClass` / `segmentedControlActiveClass` / `segmentedControlInactiveClass` を二択切替の visual primitive とする。日次/月次 TabsHeader は router-driven `<Link>` にこの class 群を適用し、monthly ModeTabs は `SegmentedControl` button group を使う
- `SegmentedControl` は local view mode 用。`aria-pressed` と `data-state=active|inactive` を出し、色だけでなく状態属性でも選択中を表す。Radix TabsTrigger の既定 shadow / specificity に依存しない。active border は `border-stone-300`、focus-visible は `border-stone-300` + soft ring とし、mouse click 後に濃い outline だけが残らないようにする

適用: StatusChips の `data-[state=on]:` 群を定数に / TabsHeader を segmented control class 群に / ModeTabs を `SegmentedControl` に / SidebarLink を `cn(SELECTION_TONE_ACTIVE, SELECTION_TONE_ACTIVE_ICON)` に（amber → stone 転換）。L3 で案切替は selection-tone.ts と segmented-control.tsx の active/inactive class を同期確認する（Tailwind JIT が動的結合を検出しないため、prefix 違いが必要な Radix 系は literal で持つ）。

### 副次効果（意味色衝突の解消）
サイドバー amber → stone 転換で、amber が「在庫少（low_stock、契約 H の `text-amber-700`）」専用に純化する。選択状態トーン（チップ/売上タブ/月次 mode tab/サイドバーの**背景**）と契約 H（行内**テキスト色** rose/amber）は適用 DOM が異なり干渉しない。

### テスト
`StatusChips.test.tsx`（新規）: `value="stockout"` で対応 ToggleGroupItem が `data-state="on"`、onChange 発火、deselect（空文字）無視（`StatusChips.tsx:31-34`）を検証。**トーンのクラス文字列は assert しない**（L3 比較で都度修正になるため）。視認性最終判断は L3 目視。

### commit 分割
1. `feat(ui): 選択状態統一トーン定数 selection-tone.ts 追加`（定数のみ）
2. `refactor(ui): StatusChips/TabsHeader/ModeTabs/SidebarLink を統一トーンに`（4 コンポーネント + `SegmentedControl` primitive + StatusChips.test + ModeTabs.test + SegmentedControl.test）

### 設計書更新
`docs/function-design/58-ui-stock-inquiry.md` §58.7 + 変更履歴（solid stone-700 → 統一中庸）+ `StatusChips.tsx:5-7` コメント / `docs/function-design/52-ui-shared-layout.md` §52.6（amber → stone）+ `SidebarLink.tsx:12-16` コメント / `docs/UI_TECH_STACK.md` §4.1 に選択状態統一基準を 1 行 SSOT 化。

---

## PR-3: improve demo data and monthly layout（polish）

### (e) seed stockout/low（rng 消費順序保護）
`src-tauri/src/seed_demo.rs:223-227` の stock_quantity 生成を index `i` bucket に。**rng 消費順序を完全保持**するため、従来の `gen_range`（cm `500..=5000` / pcs `10..=200` の range・回数のまま）を `drawn_stock` 変数に draw し、`match i` で `1`→0（stockout）/ `2`→low 値 / `_`→`drawn_stock`（従来ランダム normal をそのまま使用）と分岐。`let _ =`（`.claude/rules/implementation-quality.md` の Result 握り潰し禁止規約と紛らわしい）を避け、normal 件は draw 値を実際に使うことで rng カーソルを自然保持。これで product_code/jan_code/selling_price の rng 列が不変 → `seed_uses_deterministic_rng`（`seed_test.rs:150`、stock_quantity 非検証だが上記 3 列は一致維持）は無変更で pass。

bucket 配分（部門内 index `i`、pcs 83 件 = KE17/SY17/BT17/FS16/NR16・cm 17 件 = NU17）:
- `i==1`→0（stockout、cm/pcs 共通）/ `i==2`→low（pcs 2 ≤閾値3 / cm 300 ≤閾値500）/ `_`→`drawn_stock`（従来ランダム normal、pcs 10-200 / cm 500-5000）
- 結果: stockout 6 件（cm1+pcs5）・low 6 件（cm1+pcs5）・6 部門分散・normal 88 件（ランダム値維持）
- **前提: 各部門 count>=2**（i==2 が必ず存在、現状最小 count=16 で成立）。将来 count=1 の部門追加で i==2 が出ず low 件数がズレる脆さがあるため seed_demo.rs モジュールコメントに 1 行明記（R2-4）

**receiving 波及の判断**: stockout で stock_quantity=0 にすると `seed_demo.rs:288-289` の receiving movement が quantity=0/stock_after=0 になる。本 PR は色分け H 検証可能化が目的なので **入庫 0 を許容**（「入庫はあったが売り切れた」表現の receiving 別管理は scope 拡大のため見送り）。負在庫 warning 件数は変わるが `seed_test.rs` に warning 件数 assert はないため回帰なし。

seed test 追加（`src-tauri/tests/seed_test.rs`、`test_` prefix 不使用ルール厳守）: `seed_produces_stockout_products`（`stock_quantity<=0` >=1）/ `seed_produces_low_stock_products`（**`stock_quantity > 0` かつ pcs `<=3` / cm `<=500` が存在** = Codex P2-2: 単に `<=3`/`<=500` だと stockout（`=0`）を low と誤検出しても pass する。色分け契約 H は在庫切れ / 在庫少を別表示する前提なので low の陽性サンプルには `>0` 条件が必須）/ `seed_stockout_low_distributed_across_departments`（複数 department_id に跨る）。**より堅くするなら `list_low_stock` 結果を `<=0` と `>0` に分け両方存在を assert**（在庫切れと在庫少が共に陽性サンプルとして seed されることを証明）。

### (f) 月次 SummaryCardsBar truncate
`src/features/monthly-sales/components/SummaryCardsBar.tsx` — 期間ラベル「2026/05/01-05/31」(17 文字) + 大金額が `lg:grid-cols-4` でカード溢れ（B2/B3、論理バグでなく CSS）。grid item はデフォルト `min-width:auto` で縮まないため**祖先に `min-w-0`** + value div に `truncate`:
- Card（`:70`）: `className="min-w-0"`
- value div（`:75`）: `cn("truncate text-2xl font-semibold", valueClassName)`（現状テンプレートリテラルを `cn()` に、規約準拠）
- **`src/components/ui/card.tsx` の Card は `flex flex-col`（確認済）**のため CardContent は flex child = `min-w-0` が確定で必須。**Card + CardContent 両方に min-w-0** + value div に truncate（CardContent を block と誤認して min-w-0 を省くと truncate が効かない = R2-3）
- 日次版 `src/features/daily-sales/components/SummaryCardsBar.tsx` は SimpleCard（value div `:84` + Card）に加え **CardWithTooltip（Card `:100` / value div `:105`、valueClassName 引数なしハードコード）も同様に Card + CardContent min-w-0 + truncate 適用**（CardWithTooltip の Card は TooltipTrigger asChild の子のため min-w-0 は Card 自身に付与、value div は直接編集）
- 期間カードは省略すると日付が切れて意味不明になるため可読性を **L3 で確認**（最小対応は truncate で溢れ停止、必要なら font 縮小 or 折返し）

CSS のみで jsdom はレイアウト未計算のため **月次レイアウトの RTL テスト不要**、L3 目視が唯一の gate。

### PR-3 L3 result（2026-06-06）

Windows native L3 for PR #70 / PR-3 scope passed:

- Stock inquiry renders deterministic stockout and positive low-stock samples after app-data DB reset with the PR #70 seed.
- Monthly and daily SummaryCards stay inside their card bounds at tested desktop widths and truncate instead of overflowing.

Follow-up found during actual operator review:

- The actual operator could not reliably distinguish stockout red from low-stock amber.
- Text and table density may be too small for an older non-IT operator with presbyopia.
- This is not a PR #70 regression because PR #70 exposes existing stock status UI with seed data; the color-only status encoding predates this PR.

Disposition:

- Do not add accessibility/visibility code to PR #70.
- Track a separate R3 follow-up for stock inquiry high visibility: promote operator visibility rules to design/review docs, then add color-independent status indicators such as `Badge + icon + text` for "在庫切れ" / "在庫少".
- Treat display-size or webview zoom as a later separate change because it affects cross-screen layout and Tauri capability/persistence design.

### commit 分割
1. `fix(seed): stockout/low 在庫を index bucket で決定的注入`（seed_demo.rs + seed_test.rs、cargo 3 点セット pass）
2. `fix(monthly): SummaryCard を truncate+min-w-0 でカード溢れ修正`（月次 + 日次）

### 設計書更新
`docs/function-design/57-ui-monthly-sales.md` §57.7（truncate 堅牢化 1 行）/ `seed_demo.rs` モジュールコメント（bucket 仕様）。

---

## Backlog の export dialog 項 書き換え

> **注意（R3-2）**: 本 plan の英字 (a)-(f) は user プロンプト準拠だが、実 `Plans.md` Backlog 行の英字割当は異なる（実 Plans.md ではトーン統一 + U4 h1 が同一 sub 項目に同居し、export dialog は別英字、demo seed も別英字）。実装時は**英字でなく「export dialog」の文言で grep 特定**して書き換える（英字 (d) をそのまま編集すると実 Plans.md の別項目 = demo seed 行を潰す事故になる）。

`Plans.md` Backlog の **export dialog 項**（文言特定）を以下に書き換え（実装 commit で反映）:
> **export dialog**: npm install 凍結中のため本 PR 群から除外、Phase 3 の plugin-dialog まとめ移行で対応。暫定代替の Web File System Access API（`showSaveFilePicker`）は experimental + user activation 制約があり本 PR 群に含めない（Windows native spike 候補）。

---

## 検証計画

各 PR 共通（`.claude/rules/review-workflow.md`）:
- frontend: `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm test`（Vitest）/ `npm run build`
- Rust（PR-3）: `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` / `cargo test`（新規 seed test 含む）+ L1 `architecture_test` + L2 `design_compliance_test`
- `./scripts/doc-consistency-check.sh`（19 項目）+ pre-push hook 4 段
- merge gate: **L3 実機目視（PR-2/PR-3 必須・PR-1 任意）+ Codex 全 close（P1→P2→P3）+ CI green**
- L3 は Windows native（`DEV_SETUP_CHECKLIST §4.6` runbook、memory `windows-native-demo-sync-runbook`）

---

## Self-Review（7 観点）

### 1. 技術的前提
UI コード（.tsx）編集は LSP/Skills hook 対象 = baseline diagnostics → Write → URI 指定 diagnostics の 3 ステップ（memory `feedback-lsp-skills-policy-hook.md`、docs/.md は適用外）。`includeSearch` デフォルト true は context7 公式 docs で裏取り済（rule 9 前倒し）。PR-1→PR-2 は `SidebarLink.tsx`/`TabsHeader.tsx` 共有のため PR-1 マージ後に PR-2 を main から rebase。commit prefix は fix（nav/seed/monthly）/ feat（selection-tone 定数）/ refactor（トーン適用）を内容で選択。

### 2. スクリプト詳細
既存 `./scripts/doc-consistency-check.sh`（設計書 19 / `--target plan` 9）+ `scripts/pre-push.sh` ① cargo 3 点 ② doc-consistency ③ check-env-safety を流用、新規スクリプトなし。PR-1/PR-2 は Rust 無変更で ① は差分ゼロ確認のみ、③ env 無変更。PR-3 のみ cargo 3 点が実走（`seed_demo.rs:223-227` + `seed_test.rs:150`）。`typedInvoke` fallback と件数 baseline gate は Phase 2 closeout で撤去済み。npm install は 3 PR とも不要（凍結遵守、新規 package 0）。機械チェックで潰せる問題は PR レビュー前に全部潰す（memory `review-convergence-pattern.md`）。

### 3. ドキュメント修正
編集対象は `52-ui-shared-layout.md`（§52.1/§52.6 + コメント、PR-1+PR-2 両方が触るため重複編集回避を PR ごとに分担）/ `56`・`57`（h1 + §57.7 truncate）/ `58-ui-stock-inquiry.md`（§58.7 + 変更履歴）/ `ui-task-specs.md` UI-12 / `UI_TECH_STACK.md` §4.1 / `Plans.md` Backlog export dialog 項書換。archive 影響なし。**同一設計書の複数 PR 編集に注意**: `52` は PR-1（includeSearch）+ PR-2（amber→stone §52.6）、`57` は PR-1（h1）+ PR-3（§57.7 truncate）が触る。編集 § が異なる（52: §52.1 vs §52.6 / 57: h1 節 vs §57.7）ことを確認し、PR-2/PR-3 を PR-1 後 rebase 時に conflict 注意。プラン内 diff 例示は inline code で記述済（memory `feedback-diff-example-inline-code.md`、R3 fail 回避）。

### 4. 検証計画
Vitest RTL は `data-status="active"`（nav）と `data-state="on"`（StatusChips）で検証しクラス文字列は assert しない（トーン変更で脆くなるため）。**PR-1 は RTL 2 本（`SidebarLink.test.tsx` + `TabsHeader` test）で search 付き URL の active 維持を CI 証明する（= Codex P2-1、核心バグ SidebarLink を L3 目視頼みにせず自動化）。PR-3 の low-stock seed test は `stock_quantity > 0` 条件付きで stockout 誤検出を排除（= Codex P2-2）。** 月次レイアウトは jsdom がレイアウト未計算で RTL 不可 → L3 目視のみ。PR-2/PR-3 は L3 必須（トーン選択・seed chip 件数・カード溢れ）、PR-1 は機械的だが SidebarLink/TabsHeader の active 維持を実機でも併せ目視（自動 + 目視の二重 gate）。CI 予測: frontend job（typecheck/lint/format/build/vitest）+ Rust job（PR-3 のみ実質変化）。pre-push 4 段 + doc-consistency 19 項目を PR open 前に通す。

### 5. 後処理
各 PR open 時に `Plans.md` **Active Tasks ブロック**に 3 PR の `[ ]` 行を追加（現状この PR 群は Backlog sub 項目 a-f に内包され Active 行未登録、追加位置を PR-1 commit 前に確定 = R3-3）→ merge 時 `[x]`（rule: review-workflow Plans.md チェックボックス運用）。Backlog export dialog 項書き換えは PR-1 commit に同梱。完了プランは `docs/archive/plans/` へ即移送（memory `plan-archive-discipline.md`、相対パス変換 `feedback-archive-relative-path-conversion.md`）。トーン最終選択・seed 件数調整など L3 由来の判断は memory 化を検討。

### 6. 実行制約
npm install / npm i / npx は user 明示承認なしに実行しない（CLAUDE.md 最重要セキュリティ、3 PR とも新規 package 不要を確認済）。**PR-2 のトーン最終選択は user が L3 実機で A/B/C を見て決定**（Claude が勝手に確定しない、推奨初期値 C は叩き台）。seed receiving 波及は入庫 0 許容で scope 最小（別管理に膨らませない、memory `feedback-pr-merge-gate-scope-discipline.md`）。各 PR は branch first（main 直 commit 禁止）。

### 7. コミット分割
PR-1 = 2 commit（nav fix / h1+docs）、PR-2 = 2 commit（定数追加 / トーン適用+test）、PR-3 = 2 commit（seed / 月次 CSS）。各 commit 単独ビルド可 + lint pass。PR-1→PR-2 は同ファイル直列、PR-3 独立。Plans.md 反映は PR open/merge の節目のみ commit（memory `feedback-plans-sync-commit-milestone-only.md`）。

## 参照
- memory: `feedback-non-it-user-readability-over-aesthetics` / `feedback-desktop-app-url-design` / `windows-native-demo-sync-runbook` / `feedback-pr-merge-gate-scope-discipline` / `feedback-lsp-skills-policy-hook` / `codex-review-workflow` / `feedback-archive-relative-path-conversion`
- skills: plan-mode-discipline / refactoring-ui / ui-skills / web-design-guidelines / react-19 / typescript / tailwind-4 / inventory-code-review / pr-workflow-hygiene / test-driven-development / claude-codex-review-loop / respond-to-codex-review
- 設計書: `docs/architecture/ui-task-specs.md` UI-12 / `docs/function-design/52,56,57,58` / `docs/UI_TECH_STACK.md` §4.1
- 公式 docs: TanStack Router navigation（activeOptions.includeSearch デフォルト true、context7 確認済）/ Tauri dialog plugin https://v2.tauri.app/plugin/dialog/（(d) 除外根拠）
