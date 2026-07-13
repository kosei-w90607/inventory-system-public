# PR #66 Codex Round 1 P2 × 2 件 修正実装プラン

> **対象 PR**: #66 (`feat/ui-09b-monthly-sales`) — Phase 2 8-5 UI-09b 月次売上レポート + 8-7 useExportFile 共通化
> **Codex 結果**: P1=0 / P2=2 (drift 系)
> **方針**: (A) sortBy/sortDir URL state を実装に接続 (UI-09a 完全実装済との対称性確保) + P2-1 設計書 4 列訂正 + memory 教訓保存
> **Plan rally 状態**: Round 1 converged、Round 2 を ExitPlanMode 直前に実施予定

---

## Context

PR #66 は Phase 2 「毎日使う 5 画面」最後の 1 枚として UI-09b 月次売上レポートを実装。本セッションでは plan §10 で代替案 26 個列挙 + 6 round 累積 53 件発見の Plan rally converged 状態で PR open まで到達。Codex Round 1 review で P2 × 2 件 (drift 系) のみ検出 — いずれも実装そのものの動作不能ではなく、設計書 / URL state と実装の接続 drift。

User 当初は P2-2 について「(B) scope 外で設計書から落として Backlog 行き」推奨方向を提示したが、私 (Claude) は前 turn で「UI-09a 側の実装どうなってる？」と保留したまま (B) 推奨に倒すという bias を出した。User 指摘後に grep 実証したところ、**UI-09a は sortBy/sortDir URL state を 8 接続箇所で完全実装済**で、(B) を選ぶと UI-09a と非対称になることが判明。結論を **(A) 接続** に訂正し、本プランを設計。

教訓: 修正方向の 2 択を user に提示する前に対称機能 (sibling feature) の既存実装を grep して実証先行する判断軸を memory に保存して将来再発を防ぐ。

---

## §1. Commit 分割案

| # | prefix | scope | 主要 file |
|---|---|---|---|
| 0 | `docs:` | plan 移送 (`docs/plans/2026-05-19-pr-66-codex-r1-p2-fixes.md`) + 絶対パス→相対パス変換 | 1 新規 |
| 1 | `docs:` | **P2-1 一括 drift fix**「5 列 + 商品数」→「4 列」3 file 横断 + Plans.md Backlog 2 行 (商品数 DTO 拡張 + SortableHeader 共通化) | `docs/architecture/ui-task-specs.md:235`, `docs/function-design/57-ui-monthly-sales.md:82,351,352`, `docs/Plans.md` |
| 2 | `test:` | **P2-2 Red** Page/hook/DepartmentTable/ProductRankingTable に sort 結線テスト 9+ ケース | 4 新規 test file |
| 3 | `feat:` | **P2-2 Green** 7 接続箇所を UI-09a パターン横展開 + sort 適用 ranking + composition 両方 + §57.5 hook sample code 整合 update + `DepartmentTable.tsx:3-4` コメント 4 列統一 drift fix 同 stage | 4 file (Page/hook/2 table、`DepartmentTable.tsx:3-4` 含む) + `docs/function-design/57-ui-monthly-sales.md` (§57.3/§57.5/§57.7 update) |

**依存順**: 0 → 1 (drift 独立) → 2 → 3 (TDD Red → Green)

**本 PR scope 外 (別 PR 化、user 判断 Round 2 後)**:
- `SortableHeader` 共通化 refactor — `feedback-pr-merge-gate-scope-discipline.md` 準拠で本 PR は drift fix scope に限定。commit 3 後は **inline 三重定義** (ProductTable / DepartmentTable / ProductRankingTable) で stage closure し、Plans.md Backlog に追記。
  - **Backlog 行文言 (Round 3 I-R3-3 解消)**: 「SortableHeader 共通化 (frontend refactor): ProductTable / DepartmentTable / ProductRankingTable 3 箇所統合 → `src/components/sales/SortableHeader.tsx` 昇格 (`<T extends string>` generic 化)。**着手 trigger**: (a) Phase 2 終了前の preparatory refactor PR or (b) 次の frontend 共通化 PR 着手時。BIZ-05 `product_count` field 拡張 (BIZ 側 trigger) とは独立軸」
  - 同階層に並ぶ `product_count` field 拡張 Backlog 行とは trigger が異なる (BIZ 拡張 vs frontend refactor) 点を明示することで、「Backlog 化したまま忘却」リスクを下げる
- Memory 教訓保存 — `~/.claude/projects/` 配下は inventory-system repo の **git 管理外** (Round 2 M-1 発見)、commit ではなく Write 操作のみ。本 PR scope と完全独立、§6 詳述

`feedback-codex-drift-fix-grep-all-locations.md` 準拠で commit 1 は drift 一括修正、ピンポイント NG。

---

## §2. 各 commit 詳細

### commit 1 (docs P2-1 一括 drift fix)

修正 3 file 6 line:

1. `docs/architecture/ui-task-specs.md:235` —「5 列（部門/売上/構成比/前月比/商品数）」→「**4 列（部門/売上/構成比 + Progress バー/前月比 + 色分け）**、商品数列は `MonthlySaleItem` DTO 不在のため非対応（Q-4、Plans.md Backlog 参照）」
2. `docs/function-design/57-ui-monthly-sales.md:82` —「Table 5 列 + Progress」→「**Table 4 列 + Progress**」
3. 同 `:351` 見出し「（5 列 + Progress バー）」→「**（4 列 + Progress バー、Q-4 商品数非対応）**」
4. 同 `:352` 列リスト末尾「/ 商品数」削除
5. `docs/Plans.md` Backlog 1 行追加「BIZ-05 `MonthlySaleItem` に `product_count` field 追加 → DepartmentTable 5 列復活」

**仕上げ**: `rg -n "5 列|5列|商品数" docs/architecture/ docs/function-design/57-` で 0 件確認。`ui-task-specs.md:226` (daily の sort 5 列対応) は別意味で不変。

### commit 2 (P2-2 Red、test 4 file、9+ ケース)

test 名 prefix `REQ-502:`、mock: `vi.mock("@/lib/bindings")` で `commands.getMonthlySales` を `Ok(...)` 固定、QueryClient `gcTime: Infinity, retry: false` (memory `feedback-vitest-react19-setup-pattern.md`)。

**test 構造原則 (C-2 解消、Round 2)**: test は **container component (MonthlySalesPage / DepartmentTable / ProductRankingTable) を import 経由**でレンダーして UI 検証する。SortableHeader を直 import するテストは書かない (commit 3 inline 三重定義状態 → 将来 commit (別 PR) で `src/components/sales/SortableHeader.tsx` 共通化される際に test import path 切替不要)。`sortMonthlyItems` 純関数の null 引数 pass-through (= 入力順保持) 挙動は既存 `sort-items.test.ts:12-18` の `it("returns identity-like copy when sortBy is null")` block で証明済を前提とする (M-4 + Round 3 M-R3-1 解消、行範囲を assertion line 単独 L17 から it block 全体 L12-18 に訂正)。

**Router context 提供方式 (Round 5 P1 解消)**: `MonthlySalesPage` は L64 で `<TabsHeader />` 描画し、`src/components/sales/TabsHeader.tsx:22-23` の `<Link to="/reports/daily">` (TanStack Router) が内部で `useRouter()` を呼ぶ。QueryClient wrapper のみだと RouterProvider 不在で `Invariant: useRouter must be used within a RouterProvider` エラーで落ち、sort 結線テストではなく router context 不足で fail する偽陽性発生。対応は (推奨 A) `vi.mock("@/components/sales/TabsHeader", () => ({ TabsHeader: () => null }))` で test 用に置換、または (代替 B) `createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/reports/monthly"] }) }) + <RouterProvider router={router}>` で wrapping。Page test は sort 結線が責務なので **A 推奨** (test scope を狭く保つ、TabsHeader 単体テストは scope 外)。hook test (useMonthlySalesReport.test.tsx) は Page を介さず hook 直呼びで Router 不要。

**vi.mock 適用範囲 (Round 6 I-R6-2 解消)**: vi.mock は **MonthlySalesPage.test.tsx のみ** 必要。DepartmentTable.test.tsx / ProductRankingTable.test.tsx は table component を直 import + render で TabsHeader を描画せず Router 不要、useMonthlySalesReport.test.tsx は hook 単体テストで Page 非経由のため不要。4 test file 全てに機械的追加すると test scope 汚染 + vi.mock hoisting の副作用 (他 test の TabsHeader 動作確認が不能に) リスクあり。

**vi.mock hoisting 方針 (Round 6 I-R6-5 解消、memory `feedback-vitest-react19-setup-pattern.md` 整合)**: Vitest の vi.mock は static hoisting 仕様で file top に hoist される (factory 関数経由)。MonthlySalesPage.test.tsx の import 文より上下どこに書いても hoist されるが、可読性のため **import 群の直前 (top-level)** に書く。`setupFiles` での global mock や `__mocks__` ディレクトリ抽出は本 PR scope 外 (test scope 汚染回避 + 単一 test file 内で完結)、per-file inline factory 推奨。

| test file | 主要 case |
|---|---|
| `MonthlySalesPage.test.tsx` | (a) `search.sortBy/sortDir` を hook に渡す (b) handleSortChange 同列再 click → desc toggle / 別列 click → asc |
| `hooks/useMonthlySalesReport.test.tsx` | (a) `sortBy='amount' desc` で `derived.ranking` が金額降順 (b) `sortBy=null` で BIZ row_number 順保持 (`sortMonthlyItems` null pass-through 経由) (c) sort が `composition` (部門別) にも適用 |
| `components/DepartmentTable.test.tsx` | (a) SortableHeader 3 列 (部門名=name/売上=amount/前月比=prev_month_diff) click で `onSortChange` call (b) `aria-sort` 属性が active 列のみ ascending/descending、構成比列はソート対象外 (c) **defensive (I-1 解消)**: `sortBy="quantity"` 注入時 (URL paste で `?sortBy=quantity&mode=department`)、`DeptCompositionRow` に `quantity` field 不在のため `sortMonthlyItems extractValue` null fallback → 全行 null → 入力順保持で table 破綻なし |
| `components/ProductRankingTable.test.tsx` | (a) SortableHeader 4 列 (商品名/数量/金額/前月比) click で call、順位列 plain (b) **G-3 ranking バッジ追従** (sort 後も `ranking===1` 行に Badge 残存、既存 `sort-items.test` L77-88 を統合 level でガード) |

**ケース総数 9 件** (Page 2 + hook 3 + DepartmentTable 3 + ProductRankingTable 2)、M-3 解消。

### commit 3 (P2-2 Green、7 接続箇所 + UI-09a 機械的横展開 + §57.X docs 整合)

UI-09a パターン (`DailySalesPage.tsx:24-25,39-40,46-51,62-65` + `useDailySalesReport.ts:29-30,77` + `ProductTable.tsx:22-24,49-87,157-195`) を横展開:

| # | file:line | 修正 |
|---|---|---|
| 1 | `MonthlySalesPage.tsx:25-28` | `MonthlySalesSearch` に `sortBy?: SortColumn; sortDir?: SortDirection;` 追加、`./types` import |
| 2 | 同 `:38-40` | `sortBy = search.sortBy ?? null` + `sortDir = search.sortDir ?? "asc"` |
| 3 | 同 `:41` | `useMonthlySalesReport({ month, mode, sortBy, sortDir })` |
| 4 | 同 `:50` 直後 | `handleSortChange(column)`: 同列 asc→desc / 別列→asc、`onSearchChange((prev) => ({ ...prev, sortBy: column, sortDir: nextDir }))` ← **functional updater signature は UI-09a `DailySalesPage.tsx:30-31` で `(updater: (prev) => prev) => void` 採用済を実証 (Round 2 I-5 解消)**、TanStack Router `navigate({ search: (prev) => ... })` ラッパ |
| 5 | 同 `<DepartmentTable>`/`<ProductRankingTable>` JSX | props `sortBy/sortDir/onSortChange` 注入 |
| 6 | `useMonthlySalesReport.ts:24-27` | `UseMonthlySalesReportArgs` に sort field 追加 |
| 7 | 同 `:59-70` | `derived.ranking = sortMonthlyItems(pickTopRanking(...), args.sortBy, args.sortDir)` + 同 `composition` |
| 8 | `DepartmentTable.tsx:3-4, 24-42` | **L3-4 コメント drift fix (Round 5 P2 解消)**: 「(5 列: 部門 / 売上 / 構成比 (数値 + Progress バー) / 前月比 / 商品数なし)」「(部門 / 売上 / 構成比 / 前月比 = 4 列実装)」と混乱記述 → 「(4 列: 部門 / 売上 / 構成比 (数値 + Progress バー) / 前月比、Q-4 BIZ-05 DTO に商品数 field 不在のため非対応、Plans.md Backlog 参照)」に統一。同 24-42 で sort 対象 3 列を `SortableHeader` 化、構成比列 plain TableHead、props 追加 |
| 9 | `ProductRankingTable.tsx:36-43` | sort 対象 4 列を `SortableHeader` 化、順位列 plain、props 追加 |
| 10 | `routes/reports/monthly.tsx` | 型拡張で自動伝播、別途修正なし |
| 11 | `docs/function-design/57-ui-monthly-sales.md` (§57.3/§57.5/§57.7) | §3 参照、commit 3 同 stage (I-4 解消、`feat:` prefix に docs 微量同梱は既存慣行、prefix 妥協で independence 担保) |

**sort 適用先非対称の根拠 (I-2 解消、Round 2)**: UI-09a (daily) は `useDailySalesReport.ts:77` で **raw filtered list に直接 sort** → grouped 派生 (フラットリスト → 部門グルーピング構造)。UI-09b (monthly) は **派生後の `ranking` (top N pick 結果) + `composition` (部門別集計) 双方に sort 適用**、raw `items` には非適用。理由は (a) `ranking` 順位列の意味維持 (sort で順位列 1-based field は保持され badge 追従、既存 G-3 test L77-88 で検証済) (b) `composition` 部門別 sort 軸は ranking と独立 (利用者は順位 sort と部門集計 sort を別操作)。この非対称は構造由来であり、UI-09a (フラット → グルーピング) と UI-09b (multi-derived) の派生木の差異に対応する。

`SortableHeader` は commit 3 中 inline 三重定義 (ProductTable.tsx:166-195 から機械的コピー、計 3 file: 既存 ProductTable + 新規 DepartmentTable + 新規 ProductRankingTable)。共通化 refactor は本 PR scope 外で Plans.md Backlog 行き (commit 1 で Backlog 1 行追加、§1 表参照)。

---

## §3. 設計書修正 (§57.X 派生 6 純関数 orchestration 整合)

commit 1 (P2-1) に加え、commit 3 同 stage で (commit prefix `feat:` だが docs 微量同梱、I-4 解消で independence vs integrity tradeoff の整合性側を優先):

- `docs/function-design/57-ui-monthly-sales.md` §57.3 (L132-138): sort-items の sort 適用先を「**ranking + composition 双方** (raw `items` 非適用、§2 commit 3 非対称根拠参照)」と明示
- 同 §57.5 hook 設計 sample code (L186-198): `sortMonthlyItems` 呼出を `ranking` + `composition` 両方に巻く形に書き換え (commit 3 #7 と integrity)。**useMemo deps 追加 (Round 3 I-R3-1 解消)**: 現状 deps `[query.data, params.month]` に `args.sortBy, args.sortDir` を追加。URL state 変更時の派生 memo 再計算担保のため、deps 不足だと sort 切替が再 render に伝播しない drift が新規発生する
- §57.4 zod schema コメント追記: 「`sortBy: "quantity"` は ProductRankingTable のみ有効、DepartmentTable では UI 露出しないが URL paste 注入時は `DeptCompositionRow.quantity` 不在で `sortMonthlyItems extractValue` null fallback → 入力順保持で実害なし」(Plan rally Round 1 で発見した zod schema 4 値 vs DepartmentTable 3 列の不整合論点 + Round 2 I-1 defensive case 言及)
- §57.7 末尾 (L351-352 修正の延長、Round 2 I-6 解消): SortableHeader 適用列リスト明示追加:
  - DepartmentTable: 部門名 / 売上 / 前月比 (3 列、構成比列はソート対象外)
  - ProductRankingTable: 商品名 / 数量 / 金額 / 前月比 (4 列、順位列はソート対象外)

`scripts/doc-consistency-check.sh` 19 項目に「5 列」リテラル検査なし。grep self-check 残存 0 件で gate。

**grep ターゲット精密化 (Round 5 P2 解消)**: 当初の `rg -n "5 列|5列|商品数" docs/architecture/ docs/function-design/57-` は (a) `docs/function-design/57-` が実ファイルでなくパス指定誤り (b) `ui-task-specs.md:67` PLU 未反映件数 + `:226` 日次売上 5 列は false positive で意味のないノイズ。月次対象に絞った正しい確認コマンド:

> `rg -n "5 列|5列" docs/function-design/57-ui-monthly-sales.md` → 0 件
> `rg -n "5 列|5列|商品数" docs/architecture/ui-task-specs.md | grep -E ":235|UI-09b|月次"` → L235 4 列訂正反映後 0 件 (L67 / L226 は別文脈 false positive、修正対象外)
> `rg -n "5 列|5列" src/features/monthly-sales/components/DepartmentTable.tsx` → 0 件 (commit 3 で L3-4 コメント修正後)

`ProductRankingTable.tsx:3` 「(5 列: 順位 / 商品名 / 数量 / 金額 / 前月比、Q-4 部門列なし)」は **実装通り 5 列の正確な記述** で false positive、対応不要。

---

## §4. LSP 確認ポイント (LSP/Skills Policy enforced)

| commit | 編集 file | 確認 |
|---|---|---|
| 2 | 4 新規 test file | baseline (project 全体) → Write → URI 指定 4 回、warning/error 0 |
| 3 | Page/hook/DepartmentTable/ProductRankingTable 4 file 連続編集 | baseline 1 回 → 4 連続 Edit → URI 指定 4 回 |

docs (.md) 編集 (commit 0, 1, commit 3 内 §57.X 同 stage) は LSP 適用外 (`feedback-lsp-skills-policy-hook.md`)。

---

## §5. Verification 手順

**最終 verification は AGENTS.md frontend gate (typecheck / lint / format:check / build) + 設計書 / typedinvoke / env 安全性 を主軸に運用、pre-push は補助扱い (Round 5 P2 解消)**。pre-push (`scripts/pre-push.sh:38` 周辺) は変更種別 (Rust/設計書) 条件付き実行で TS 変更時に frontend gate 自動実行しないため、本 plan は明示的に local 全段実行で gate する。

各 commit 完了時 (Rust 不変、cargo 不要):

```bash
npm run typecheck
npm run lint
npm run format:check
npm test -- src/features/monthly-sales
npm run build
bash scripts/doc-consistency-check.sh
bash scripts/check-typedinvoke-count.sh
bash scripts/check-env-safety.sh
```

PR push 前 (pre-push hook、補助 gate):

```bash
# pre-push.sh:38 周辺の条件付き実行で、変更種別に応じて以下を自動実行 (補助扱い):
# - Rust 変更時のみ: cargo fmt --check / cargo clippy / cargo test
# - 設計書変更時のみ: scripts/doc-consistency-check.sh
# - 常時: scripts/check-typedinvoke-count.sh / scripts/check-env-safety.sh
# 本 PR は frontend のみのため pre-push は typedinvoke + env-safety + 設計書 (docs 変更あり) を流す
```

**期待値**: typecheck/lint/format:check 0、build 成功、**test 全 pass + 新規 9+** (Page 2 + hook 3 + DepartmentTable 3 (defensive 含む) + ProductRankingTable 2、M-3 解消)、doc-consistency 19 pass、typedinvoke 件数 baseline 一致 (Rust 不変)、env 安全 pass。

**build / verification fail 時の rollback 戦略 (Round 6 I-R6-6 解消)**: 各 commit 完了時の local 8 cmd 実行で build / test / lint 等が fail した場合、**`--amend` は NG (CLAUDE.md グローバル Git Safety Protocol、commit hook fail 時の amend は previous commit を破壊するリスクあり)**。修正は新 commit として追加 (`fix:` prefix or 同 prefix で「sort 結線実装中の build fix」等明示)、コミット履歴を増やしても安全側に倒す。本 PR は Codex Round 2 review 想定なので squash merge 前提、履歴肥大化は merge 時に解消される。

**実行 timeline (Round 6 M-R6-3 解消)**:

> ExitPlanMode pass (check-plan-on-exit.sh 完了) → memory Write (`feedback-recommend-pause-grep-existing-pattern.md` 新規 + MEMORY.md 索引更新 + 既存 2 file 関連 link 追記) + memory 軽量監査 sentinel touch → commit 0 (plan 移送 + 絶対→相対パス変換) → commit 1 (P2-1 docs drift + Plans.md Backlog 2 行) → commit 2 (Red 9+ ケース、`npm test` fail 期待) → commit 3 (Green 7 接続 + DepartmentTable.tsx:3-4 コメント修正 + §57.X docs 同 stage、`npm test` green + local 8 cmd 全 pass) → push (user 承認後)

---

## §6. Memory 教訓保存 (PR scope 外、独立 Write 操作)

**重要 (Round 2 M-1 発見)**: memory 保存先 `~/.claude/projects/-home-kosei-Projects-inventory-system/memory/` は inventory-system repo の **git 管理外ディレクトリ**であり、ファイル追加・編集は git commit ではなく **Write 操作のみ**で完結する。本 PR commit 履歴には一切現れず、`git status` にも反映されない。本 PR scope と完全独立。

**結論**: 新規 memory `feedback-recommend-pause-grep-existing-pattern.md` を独立 file で Write + MEMORY.md 索引更新 + 既存 2 file「関連」末尾に逆向き link 追記。

**実施タイミング (Round 3 I-R3-2 解消)**: ExitPlanMode tool 呼び出しを `check-plan-on-exit.sh` (PreToolUse hook、plan 整合 + Self-Review 検査) が pass した直後、**commit 0 (plan 移送) を実行する前** に挟む。理由は (a) commit 0 で plan を `docs/plans/` に移送した時点で「本 plan の archive ライフサイクル」が開始するため、教訓 memory も同時点で保存することで「plan + 学び」の対応関係が明確になる (b) commit 0 着手前であれば「memory Write は git 管理外 + commit 不要」が独立操作として完結し、commit 履歴に混入しない (M-1 整合)。同タイミングで PostToolUse hook reminder の memory 軽量監査 (`touch .last_audit` sentinel 更新 + 直近 feedback の memory 反映確認) も合わせて実施。

**理由 (代替案 3 つとの比較)**:

| 案 | 根拠 | 採否 |
|---|---|---|
| `feedback-recommend-with-explicit-basis.md` 追記 | bias 自覚 + 明示根拠の親軸と同じ | ❌ 親軸 file 肥大化、本件は「保留判定で grep 先行」と 1 段詳しい sub-pattern |
| `feedback-codex-drift-fix-grep-all-locations.md` 関連項追記 | grep 軸で類似 | ❌ 修正実装 *時* の grep vs 推奨提示 *時* の grep で **invocation phase が違う**、混ぜると検索性低下 |
| `feedback-claude-self-bias-blind-spot.md` 具体例追記 | self-bias 親軸として参照 | ❌ sub-pattern を独立 file に切る方が memory 索引現運用と整合 |
| **新規独立 file** | invocation trigger が固有 (修正方向 2 択 + 対称機能存在) | ✅ **採用** |

### 新規 file 内容 (要点、本文は commit 時に確定)

パス: `/home/kosei/.claude/projects/-home-kosei-Projects-inventory-system/memory/feedback-recommend-pause-grep-existing-pattern.md`

```
name: 推奨 2 択で保留した時は対称機能の既存実装を grep してから倒す
description: コードレビュー指摘の修正方向 (A 削除 / B 接続 等) を user に問うとき、対称機能 (sibling feature) の既存実装を grep して実証してから推奨する
type: feedback

Why: PR #66 Round 1 P2-2 sortBy/sortDir URL state 接続漏れで実証。
当初「UI-09a 側どうなってる?」と保留したまま「(B) 接続採用」推奨を user に出した。
user 指摘で grep したところ UI-09a (DailySalesPage 等 8 接続箇所 + SortableHeader) 完全実装済が判明、
対称性原則で「(A) 接続」が結果的に正解だったが、保留状態の推奨は bias 任せの幸運 hit に過ぎなかった。
実証先行なら自信を持って推奨できた。

How to apply:
- 修正方向 2 択を user に提示する前のチェック:
  1. 対称機能 (sibling feature / 前 PR の同種 UI) が存在するか
  2. 存在するなら repo 全体で対称機能の該当パターンを Grep
  3. 実証結果を「推奨根拠」として推奨文に明示
- grep 30 秒、保留したまま推奨を出す方が context と user 信頼を浪費
- 適用 trigger: Codex / inventory-code-review 指摘 + 修正方向 2 択以上 + 対称機能が repo に存在しうる場合
  (横展開 PR、共通化 PR、フェーズ後半 PR で頻発)

関連:
- [[feedback-recommend-with-explicit-basis]] (親軸)
- [[feedback-claude-self-bias-blind-spot]] (親軸、sub-pattern 独立化整合)
- [[feedback-codex-drift-fix-grep-all-locations]] (修正実装時の grep。本 memory は推奨提示時の grep で phase 違い)
- [[feedback-design-doc-tech-premise-verify-from-output]] (実証先行軸の親)
```

### MEMORY.md 索引更新

§「判断軸・好み (feedback)」末尾 (`feedback-design-doc-tech-premise-verify-from-output.md` 直後) に 1 行追加:

```markdown
- [feedback-recommend-pause-grep-existing-pattern.md](feedback-recommend-pause-grep-existing-pattern.md) — 推奨 2 択を user に問う前に対称機能 (sibling feature) の既存実装を grep して実証、保留したまま倒すと逆方向 (PR #66 P2-2 で被弾)
```

### 既存 file 関連 link 追記

- `feedback-recommend-with-explicit-basis.md`「関連」末尾に追記
- `feedback-claude-self-bias-blind-spot.md`「関連」末尾に追記

memory 保存は **PR scope と分離して独立 `chore:` commit** で実施 (本 PR の review 範囲ではないため)。

---

## Self-Review (§7、7 観点、memory `plan-self-review-before-implementation.md` + `feedback-self-review-mechanical-addition-anti-pattern.md` 準拠)

### 1. 技術的前提

本 PR は LSP/Skills Policy enforced 下で動く (PreToolUse hook で Write/Edit 前の LSP diagnostics 取得強制)。memory `feedback-lsp-skills-policy-hook.md` に従い code 編集 (.tsx / .ts) は 3 ステップ:

> baseline diagnostics (project 全体) → Write/Edit → URI 指定 diagnostics で warning/error 0 確認

§4 表のとおり commit 2 では新規 test file 4 件で 4 回、commit 3 では Page/hook/2 table の 4 file 連続 Edit を baseline 1 回 + URI 指定 4 回でカバー。docs (.md) は LSP 適用外で軽量。

Rebase 戦略: PR #66 head `feat/ui-09b-monthly-sales` (`20bef626` の上に積み増し、main 取込み rebase なし。base branch は変更前提なし、Codex Round 2 まで draft 状態維持しないため push 後 user 承認のみ)。Commit prefix は drift = `docs:` / Red test = `test:` / 実装 + 設計書整合 = `feat:` (memory `feedback-codex-drift-fix-grep-all-locations.md` に従い drift 一括 + `feat:` への docs 微量同梱は既存慣行で許容)。

### 2. スクリプト詳細

新規 script は **書かない**。既存 3 script は read-only 実行で副作用なし、`set -e` で fail-fast されるが state mutation はゼロ。pre-push hook `scripts/pre-push.sh` (DEV_SETUP_CHECKLIST.md §3.2 参照) が以下 4 段階を順次 gate:

> ① `cargo fmt --check` / `cargo clippy -- -D warnings` / `cargo test`
> ② `./scripts/doc-consistency-check.sh` (設計書整合 19 項目)
> ③ `./scripts/check-typedinvoke-count.sh` (typedInvoke 件数 baseline、ADR-004 準拠)
> ④ `./scripts/check-env-safety.sh` (.env / `src/lib/env.ts` 安全性、UI_TECH_STACK §6.9 準拠)

本 PR は Rust 不変のため ① の clippy/test は既存 pass 維持 (実行に影響なし、再 build 時間のみ)。② は §3 で「5 列」「商品数」grep 残存 0 件確認後に doc-consistency R0/R1/R3 を pass する見込み (memory `feedback-archive-relative-path-conversion.md` の絶対パス→相対パス変換は commit 0 で実施、R3 fail 再発防止)。③ は Rust 不変で typedinvoke 件数 baseline 維持、CI で両方向 (増減) fail (memory `feedback-baseline-monotonic-ci-both-directions.md`)。④ は .env 触らないため変動なし、frontend 4 file + 設計書のみ編集で env-safety pass 自明。

**条件付き実行の詳細整合 (Round 6 M-R6-2 解消)**: 上記 ①〜④ は pre-push 4 段階の列挙だが、実際の `scripts/pre-push.sh:38` 周辺の条件分岐 (Rust 変更時のみ ① / 設計書変更時のみ ② / 常時 ③④) は §5「PR push 前 (pre-push hook、補助 gate)」code block コメント参照。本 PR は frontend + docs 変更のため pre-push では ②③④ が自動実行 (① はスキップ、Rust 不変のため影響なし)。

### 3. ドキュメント修正

§3 で 4 docs file 横断 6 line + §57.7 追記 + Plans.md Backlog 2 行明示。link 影響範囲は memory `feedback-archive-relative-path-conversion.md` の R3 fail 再発防止軸で慎重に評価:

> `docs/function-design/57-ui-monthly-sales.md:351` 見出し「DepartmentTable (5 列 + Progress バー)」→「DepartmentTable (4 列 + Progress バー、Q-4 商品数非対応)」

これにより自動生成 anchor `#departmenttable-...` が変わる可能性あり (見出しテキスト → slugify ロジックで `5-列` → `4-列` slug 変化)。対応として `rg -n "departmenttable-5|#departmenttable-5" docs/` で他 file からの cross-link 0 件確認を commit 1 stage 前に実施。`ui-task-specs.md:235` は内部参照のみで cross-link 影響なし、Plans.md Backlog 2 行は新規追加なので link 影響ゼロ。

### 4. 検証計画

local 8 cmd を主軸 + pre-push は補助扱い (Round 5 P2 解消、AGENTS.md L44 frontend gate 整合)。`feedback-vitest-react19-setup-pattern.md` 準拠の Vitest セットアップ前提で:

> `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm test -- src/features/monthly-sales` / `npm run build` / `bash scripts/doc-consistency-check.sh` / `bash scripts/check-typedinvoke-count.sh` / `bash scripts/check-env-safety.sh` (Round 6 I-R6-4 解消: script 系 3 つすべて `bash` prefix で permission bit 依存差を回避、§5 code block 形式と整合)

各 commit 完了時に local 8 cmd を順次実行 (commit 2 は test のみ red 期待で `npm test` を skip 可、commit 3 で green 確認)。pre-push は `scripts/pre-push.sh:38` 周辺の変更種別条件付き実行で TS 変更時の frontend gate を自動実行しないため、本 plan は明示的に local で `typecheck / lint / format:check / build` を流して安全網を厚くする。CI 予測は §5 期待値 (新規 9+ test、build 成功、doc-consistency 19 pass、typedinvoke baseline 一致、env safety pass) で達成見込み。Plan rally Round 1-4 で 14 + 8 + 3 件解消 + Round 5 user 指摘 P1/P2 × 3 件解消し残論点 0、構造的問題なし (§8 converge 判定)。

### 5. 後処理

memory 教訓保存は §6 で詳細化、ExitPlanMode pass 後 + commit 0 移送前のタイミングで実施 (Round 3 I-R3-2 解消)。memory `claude-code-self-modification-hard-block.md` のとおり global `~/.claude/skills/hooks/CLAUDE.md` 系は HARD BLOCK で触らず、project local `~/.claude/projects/-home-kosei-Projects-inventory-system/memory/` のみ書く:

> 新規: `feedback-recommend-pause-grep-existing-pattern.md` (Why + How to apply 必須、memory `feedback-self-review-mechanical-addition-anti-pattern.md` 準拠で本文 100 字以上)
> 索引: `MEMORY.md` 「判断軸・好み」末尾に 1 行追加
> 既存追記: `feedback-recommend-with-explicit-basis.md` + `feedback-claude-self-bias-blind-spot.md` の「関連」末尾に逆向き link

Plan archive: commit 0 で `docs/plans/2026-05-19-pr-66-codex-r1-p2-fixes.md` 移送 (絶対パス→相対パス変換必須、memory `feedback-archive-relative-path-conversion.md` 参照、R3 fail 防止)、PR merge 後の自然な区切りで `docs/archive/plans/` 配下に再移送 (memory `plan-archive-discipline.md`)。memory 軽量監査は PostToolUse hook reminder の sentinel `touch .last_audit` も同タイミングで実施。

### 6. 実行制約

memory `feedback-pr-merge-gate-scope-discipline.md` 準拠で **本 PR は drift fix (P2-1 + P2-2 接続) scope に限定**、SortableHeader 共通化 refactor + memory 教訓保存は scope 外:

> 「Round 2+ clean PR で『品質改善 (TDD 基盤等) を merge gate に組み込む』誘惑は scope 膨張 anti-pattern、別 PR 分割 + transition design で同等価値、Plan A 一石二鳥志向は user 判断軸で抑止」

本 plan は Round 2 user 判断で commit 4 削除 + Backlog 行き決定済、scope 膨張防止済。push は user 承認後のみ、force push 厳禁 (CLAUDE.md グローバル「Git Safety Protocol」)、Codex Round 2 review trigger は user 側 (Codex app での手動投入)。本セッションで Claude が勝手に merge / push する動作はゼロ。

### 7. コミット分割

§1 で 4 commit 順序 (0 → 1 → 2 → 3) + 本 PR scope 外 2 件 (SortableHeader refactor / memory 教訓) を明示。各 commit のスコープと hook 対応順序:

> commit 0 (`docs:` plan 移送) → commit 1 (`docs:` P2-1 drift + Backlog 2 行) → commit 2 (`test:` Red 9+ ケース) → commit 3 (`feat:` Green + §57.X docs 同 stage)

各 commit は単一意図 (memory `feedback-codex-drift-fix-grep-all-locations.md` の drift 一括修正方針: ピンポイント NG、commit 1 で 4 file 6 line 一括)。PostToolUse hook の Plans.md 自動編集なし (Round 2 C-1 実証で確認: `rg -n "Plans\.md|PostToolUse" .claude/settings.json .claude/hooks/` で `audit-trigger-plan.sh` (Write 検知 audit) + `audit-trigger-phase.sh` (git tag 検知) のみ)、commit 間で Plans.md の重複 stage 競合リスクなし。`feedback-plans-sync-commit-milestone-only.md` 準拠で Plans.md は commit 1 内同 stage、別 commit 不要。

---

## §8. Plan rally 周回 (memory `feedback-plan-rally-required-before-exit.md`)

**Round 1 (本セッション内、内省で潰す) — 解消済 3 件**:

- (i) commit 4 共通化判定の閾値「3 箇所」根拠 → **Round 2 user 判断で本 PR scope 外決定、Plans.md Backlog 行きで解消**
- (ii) memory file 命名「`-pause-`」が日本語 memory 群に英語 trigger 含意で OK か → 現索引も英語 trigger 多数あり整合 → **解消**
- (iii) `sortMonthlyItems` generic 互換性 (DeptCompositionRow に `quantity?` field なし → null 末尾配置対応) → **§3 §57.4 zod schema コメント追記で文書化**

**Round 2 (Plan agent 独立 context で critique 完了) — critical 2 + important 6 + minor 6 → 解消反映済**:

| 指摘 | 解消 |
|---|---|
| C-1 Plans.md PostToolUse hook 競合 | **誤指摘**: `audit-trigger-plan.sh` + `audit-trigger-phase.sh` のみ、Plans.md 自動編集 hook なし (`rg -n "Plans\.md\|PostToolUse" .claude/settings.json .claude/hooks/` 実証)、§7-7 に記録 |
| C-2 commit 4 refactor 後 test re-run dependency | §2 commit 2「test は container component import 経由、SortableHeader 直 import なし」明記 + I-3 採用で commit 4 削除 |
| I-1 zod schema sortBy=quantity URL paste defensive | §2 DepartmentTable.test.tsx (c) defensive case 1 追加 + §3 §57.4 zod schema コメント追記 |
| I-2 raw items 非 sort 適用根拠 | §2 commit 3 「sort 適用先非対称の根拠」段落で UI-09a (フラット → グルーピング) vs UI-09b (multi-derived) の構造差異明示 |
| I-3 commit 4 scope 膨張 | **Round 2 user 判断**: 別 PR 切り出し、§1 表から commit 4 削除、commit 1 で Plans.md Backlog 行追加 |
| I-4 §57.5 commit 1 vs commit 3 prefix 衝突 | §1 commit 3 注記「`feat:` に docs 微量同梱は既存慣行」で independence vs integrity tradeoff の integrity 優先 |
| I-5 onSearchChange functional updater 型整合 | UI-09a `DailySalesPage.tsx:30-31` で `(updater: (prev) => prev) => void` 採用済を実証 (`rg -n "onSearchChange" src/features/daily-sales/DailySalesPage.tsx`)、§2 commit 3 #4 に追記 |
| I-6 §57.7 SortableHeader 適用列 drift | §3 §57.7 末尾 SortableHeader 適用列リスト (DepartmentTable 3 / ProductRankingTable 4) 追記 |
| M-1 memory commit 5 prefix | **重大訂正**: memory は `~/.claude/projects/` 配下 git 管理外、commit 不要 Write 操作のみ、§1 表 commit 5 削除 |
| M-2 自己参照矛盾 | 本セクション (§8) 構造を「Round 1 解消済 + Round 2 critique 受領 + Round 3 反復条件」に再構成 |
| M-3 test 数「5+」具体性 | §5「9+ (Page 2 + hook 3 + DepartmentTable 3 + ProductRankingTable 2)」具体化 |
| M-4 sortMonthlyItems null pass-through 文補強 | §2 commit 2「`sortMonthlyItems` 純関数の null 引数 pass-through (= 入力順保持) 挙動は既存 `sort-items.test.ts` L12-17 で証明済前提」追記 |
| M-5 commit 4 削除に伴う §1 表整合 | §1 表更新済 (commit 0-3 + 別 PR Backlog) |
| M-6 memory file 命名代替案表 | Round 1 解消済、追加対応不要 |

**Round 3 (Plan agent 独立 context で critique 完了) — critical 0 + important 3 + minor 5 → 解消反映済**:

| 指摘 | 解消 |
|---|---|
| I-R3-1 §57.5 sample code useMemo deps 不整合 | §3 §57.5 sample code 書き換え記述に「deps に `args.sortBy, args.sortDir` 追加 (URL state 変更時の派生 memo 再計算担保)」一文補強 |
| I-R3-2 memory Write タイミング前後関係 | §6 「ExitPlanMode pass 後 (check-plan-on-exit.sh 完了後)、commit 0 移送前に挟む」と明確化 + 理由 2 点 (plan archive ライフサイクル同期 / commit 履歴非混入) |
| I-R3-3 SortableHeader Backlog 着手 trigger | §1「本 PR scope 外」段落に Backlog 行文言案 + 着手 trigger 2 候補 (Phase 2 終了前 preparatory refactor PR / 次 frontend 共通化 PR) + BIZ-05 product_count trigger との独立軸明示 |
| M-R3-1 sort-items.test L17 → L12-18 it block range | §2 commit 2 記述を「`sort-items.test.ts:12-18` の `it("returns identity-like copy when sortBy is null")` block」に訂正 |
| M-R3-2 ui-task-specs.md:235 原文引用揺れ | **対応不要**: drift 一括修正の grep 対象「5 列」「商品数」リテラル捕捉で十分、原文 verbatim 引用は plan のスリム性損なう |
| M-R3-3 13 件 vs 14 件 表記揺れ | §8 Round 2 解消表は 14 行 (C-1, C-2, I-1〜I-6, M-1〜M-6) で整合済、再確認 OK |
| M-R3-4 inline 三重定義 3 箇所識別 | 問題なし確認 (ProductTable 既存 + DepartmentTable / ProductRankingTable 新規)、対応不要 |
| M-R3-5 `npm test -- src/features/monthly-sales` glob | 問題なし確認 (vitest CLI が include pattern として解釈、配下 test に matched)、対応不要 |

**Round 4 (Plan agent 独立 context で critique 完了) — critical 0 + important 0 + minor 3**:

prompt 提示 4 important 観点を個別検証で全 0 件判定:
1. memory Write タイミング実行可能性 → Plan mode 解除後の sandbox allow list `/home/kosei/.claude/projects/-home-kosei-Projects-inventory-system/memory/` に含有、§6 記述と整合
2. §1 Backlog 行文言案の粒度 → 主目的「Backlog 化したまま忘却防止」達成、フォーマット微調整は実装時に既存行参照で対応可能
3. §57.5 useMemo deps `args.sortBy/sortDir` primitive 個別追加 → object reference equality trade-off を構造的に回避済
4. Round 2 解消 14 件の plan 表記一致 → §8 表 14 行 (C-1, C-2, I-1〜I-6, M-1〜M-6) で完全一致確認

minor 3 件 (Round 4 自己実現的予言の構造 / §57.5 deps 新規 drift 境界曖昧 / readable 度) はいずれも plan スリム性 vs 厳格性 trade-off 範囲内、**対応不要**。

**Round 4 暫定 converge → Round 5 (user 直接レビューで P1/P2 × 3 件発見、解消反映)**:

| 指摘 | 解消 |
|---|---|
| R5-P1 MonthlySalesPage.test.tsx Router context 不足 (`TabsHeader` の `<Link>` が `useRouter()` 呼び出し) | §2 commit 2 末尾に Router context 提供方式 (vi.mock 推奨 / RouterProvider 代替) を実装方針として明記 |
| R5-P2 AGENTS.md frontend gate 不整合 (typecheck/lint/format:check/build 4 つ要求に対し format:check + build 欠落、pre-push は条件付き実行で自動不発火) | §5 verification を local 8 cmd 主軸 + pre-push 補助扱いに刷新、§Self-Review §4 も同期更新 |
| R5-P2 P2-1 drift grep 不成立 (パス指定誤り + ui-task-specs.md L67/L226 false positive + DepartmentTable.tsx:3-4 実装コメント残存) | §3 grep ターゲット精密化 (月次 file 限定 + grep -E 絞り込み) + §2 commit 3 #8 で DepartmentTable.tsx:3-4 コメント 4 列統一修正追加 |

**Round 6 (Plan agent 独立 context で critique 完了) — critical 0 + important 6 + minor 4 → 解消反映済**:

| 指摘 | 解消 |
|---|---|
| I-R6-1 §1 表に DepartmentTable.tsx:3-4 コメント修正欠落 | §1 表 commit 3 行に「`DepartmentTable.tsx:3-4` コメント 4 列統一 drift fix 同 stage」追記 + §影響範囲一覧で同 file 修正項目に「L3-4 コメント 4 列統一」を併記 |
| I-R6-2 vi.mock 適用範囲明示不足 | §2 commit 2 末尾「vi.mock 適用範囲」段落追加: MonthlySalesPage.test.tsx のみ必要、他 3 test file 不要を明記 |
| I-R6-3 §8 末尾 CONVERGED at Round 5 陳腐化 | 本 update で Round 6 結果記録 + CONVERGED at Round 6 に表記更新 |
| I-R6-4 §Self-Review §4 形式不統一 | inline 列挙に `bash` prefix 統一を明示注記、permission bit 依存差回避 |
| I-R6-5 vi.mock hoisting 方針欠落 | §2 commit 2 末尾「vi.mock hoisting 方針」段落追加: top-level inline factory 推奨、`setupFiles` global mock / `__mocks__` 抽出は scope 外 |
| I-R6-6 build fail rollback 戦略言及なし | §5「build / verification fail 時の rollback 戦略」段落追加: `--amend` NG (Git Safety Protocol)、新 commit 追加で fix、squash merge で履歴解消 |
| M-R6-1 §影響範囲一覧 DepartmentTable.tsx 修正記述網羅性 | I-R6-1 と表裏で解消 (L3-4 コメント網羅明記) |
| M-R6-2 §Self-Review §2 vs §5 pre-push 条件付き記述粒度差 | §Self-Review §2 末尾に「条件付き実行詳細は §5 参照」cross-ref 追加 |
| M-R6-3 timeline 分散 | §5 期待値段落直後に 1 行 timeline (`ExitPlanMode pass → memory Write → commit 0 → 1 → 2 → 3 → push`) 追加 |
| M-R6-4 plan 全体肥大化 (Round 5 累積で約 380 行 / 履歴 3 連続) | scope 外、plan archive 時に検討。本 round では対応不要 |

**Converge 判定**: ✅ **Plan rally CONVERGED at Round 6** (Round 4 暫定 converge → Round 5 user 直接レビュー P1/P2 × 3 件解消 → Round 6 波及 drift important 6 + minor 4 解消、計 5 周回の Plan agent ラリー + 1 周回 user 直接レビューで構造的問題ゼロ達成)。Plan agent ラリーが拾えなかった「実装側 file 残存コメント + AGENTS.md 正本側 frontend gate + pre-push 条件付き実行の挙動」観点は **user の正本確認で補完**された (memory `feedback-claude-self-bias-blind-spot.md` 整合: 機械的強制 hook + user レビューでしか質担保できない、本セッションは 5 round Plan agent + 1 round user の hybrid で実証)。`check-plan-on-exit.sh` D-1 check の直近 30 分 subagent log 確認 (Round 2 + 3 + 4 + 6 = 4 周 Plan agent ラリー実証済) も担保。ExitPlanMode 実行可。

---

## 影響範囲ファイル一覧

### 実装 (commit 3、inline 三重定義状態で stage closure)
- `src/features/monthly-sales/MonthlySalesPage.tsx` (5 箇所)
- `src/features/monthly-sales/hooks/useMonthlySalesReport.ts` (2 箇所)
- `src/features/monthly-sales/components/DepartmentTable.tsx` (SortableHeader inline 追加 + L3-4 コメント 4 列統一 drift fix、Round 5 P2 + Round 6 I-R6-1 解消)
- `src/features/monthly-sales/components/ProductRankingTable.tsx` (SortableHeader inline 追加)

### Test (commit 2、新規 4 file 9+ ケース、container component import 経由)
- `src/features/monthly-sales/MonthlySalesPage.test.tsx`
- `src/features/monthly-sales/hooks/useMonthlySalesReport.test.tsx`
- `src/features/monthly-sales/components/DepartmentTable.test.tsx` (defensive case 含む)
- `src/features/monthly-sales/components/ProductRankingTable.test.tsx`

### 設計書 (commit 1 + commit 3 同 stage)
- `docs/architecture/ui-task-specs.md` (L235、4 列訂正)
- `docs/function-design/57-ui-monthly-sales.md` (L82, L132-138, L186-198, L351-352、5 列訂正 + §57.3 sort 適用先 + §57.4 zod schema コメント + §57.5 hook sample code + §57.7 SortableHeader 適用列)
- `docs/Plans.md` (Backlog 2 行追加: BIZ-05 `product_count` field 拡張 + SortableHeader 共通化次 PR 切り出し)

### Plan (PR 内、commit 0)
- `docs/plans/2026-05-19-pr-66-codex-r1-p2-fixes.md` (新規、本 plan の本配置先、絶対パス→相対パス変換)

### Memory (PR 外、git 管理外 Write 操作、ExitPlanMode 後実施)
- `~/.claude/projects/-home-kosei-Projects-inventory-system/memory/feedback-recommend-pause-grep-existing-pattern.md` (新規)
- 同 `MEMORY.md` (索引更新)
- 同 `feedback-recommend-with-explicit-basis.md` (関連 link 追記)
- 同 `feedback-claude-self-bias-blind-spot.md` (関連 link 追記)

### 別 PR 切り出し (Plans.md Backlog 行き、本 plan scope 外)
- `src/components/sales/SortableHeader.tsx` (SortableHeader 共通化 refactor、preparatory refactor PR で実施、commit 3 後の inline 三重定義 → 共通化)
