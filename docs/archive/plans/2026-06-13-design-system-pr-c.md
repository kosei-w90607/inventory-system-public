# デザインシステム構築 PR-C: 機械強制（eslint + DS-doc 検査 + 既存違反先行解消）

> **親プラン**: docs/archive/plans/2026-06-12-design-system-codification.md「PR-C 詳細」節（rally 5 round 収束済み骨子）
> **test matrix**: [test-matrices/2026-06-13-design-system-pr-c.md](test-matrices/2026-06-13-design-system-pr-c.md)

## Risk

Risk: R3

CI merge gate 変更（eslint ルール追加 + doc-consistency 既定スイート拡張）+ 11 ファイルの UI 色 class 変更（意図的色補正 = L3 対象）+ script 拡張。runtime contract（generated command / DTO / route / search params）と DB schema は変更しない。

## Context

3 段 PR の最終段。PR-A（docs 正典化、`24c7f6e`）で規約を `docs/design-system/` に単一参照面化し、PR-B（patterns/ 6 component 抽出、`202e128`）で実装ブレを解消した。残るのは「規約を破る変更が機械的に止まらない」こと — palette 外色の直書き・生 primitive・barrel 迂回は現状レビュー（人間/Codex）でしか検出できない。PR-C は既存違反を先行解消した上で eslint + doc-consistency による機械強制を導入し、`01-decision-rules.md` L152 / `02-component-catalog.md` L738 の「既知の逸脱（PR-C で是正予定）」を閉じる。

実測 drift（親プランからの差分、Explore 3 系統 + orchestrator 一次ソース裏取り + rally R1 で全数照合済み）:
- palette 外色は「emerald/rose 6 ファイル」ではなく **14 箇所 / 10 ファイル**（features 9 ファイル 13 箇所 + `src/components/ui/progress.tsx` の `bg-amber-600`。amber / rose / emerald の 3 系統）
- raw `<button>` 3 件は全部同名 local `SortableHeader` の 3 重複（user 決定: patterns/ 抽出はせず最小置換のみ、共通化は Backlog 維持）
- raw `<input>/<select>` は親プランどおり **6 ファイル**（DateNavigator / MonthNavigator / PreviewStep / FileDropzone / StockUnitField / ProductForm。棚卸し記録のみ、lint 対象外。rally R2 P2-2: 初回 Explore の 8 はファイル内重複の誤カウント）
- `00-foundations.md` L27 が `--danger` と記載、globals.css の実 token は `--destructive`（doc drift、C1 で同期）

## Goal

1. palette 外色 14 箇所を semantic token へ移行（amber 系 = hue 不変、rose→red / emerald→green = 意図的色補正で L3 承認）
2. raw `<button>` 3 箇所を shadcn Button へ最小置換（見た目維持）
3. eslint `no-restricted-syntax` で palette 外色 ban / 生 `<button>` ban / barrel 迂回封じを新規 devDep なしで導入（生 button selector は Codex R1 P2 で追加 — 親 packet C-lint-2 の lint 契約を packet 化時に「3 箇所置換のみ」へ縮めた contract drift の復元）
4. doc-consistency-check.sh 既定スイートに DS1〜DS4 を統合（`--target` 新設はしない）
5. design-system docs の「既知の逸脱」記述と README 将来項目を是正後の状態へ同期

## Scope

- `src/styles/globals.css`: 新 shade token 12 個（`:root` + `@theme inline`）
- `src/features/` 9 ファイル（実体は各 feature の `components/` 配下、Spec Contract の実体パス参照）+ `src/components/ui/progress.tsx`: 色 class 移行
- `src/features/` 3 ファイル（daily-sales/monthly-sales の `components/` 配下、Spec Contract #15）: SortableHeader 内 `<button>` → `Button` 置換
- `src/features/monthly-sales/components/ProductRankingTable.test.tsx`: L92 の `[class*='bg-amber']` assert 更新（C1 同梱必須）
- `eslint.config.js`: 2 block 追加（prettier の直前）
- `scripts/doc-consistency-check.sh`: DS1〜DS4 関数 + 設計書モードのメインループ呼び出し追加
- `docs/design-system/00-foundations.md`: パレット表同期（`--danger`→`--destructive` + 新 token 行）
- `docs/design-system/01-decision-rules.md` L152 / `02-component-catalog.md` L738: 既知逸脱 block を是正済みへ書換
- `docs/design-system/README.md` L42-49: 将来項目注記更新
- `docs/FUNCTION_DESIGN.md` / `Plans.md`: status 同期

## Non-scope

- `<input>/<select>` の lint 強制（6 ファイル棚卸しを packet に記録するのみ。DateNavigator/MonthNavigator native picker は catalog ⑪ canonical、ProductForm / StockUnitField の select、FileDropzone / PreviewStep の file input は設計済みの現行形）
- SortableHeader の patterns/ 抽出（user 決定 2026-06-13: 最小置換のみ。Backlog「SortableHeader 共通化」維持）
- arbitrary value（`bg-[#xxx]`）の ban（現状 0 件、将来 ast-grep 検討項目として README に注記）
- ast-grep / stylelint / eslint-plugin-tailwindcss（npm 凍結中、新規 devDep 不可）
- dark mode 体系整備（dark 未運用判断は D-C4。stone 系 `dark:` 残置 2 箇所は scope 外）
- OKLCH 統一（globals.css L5 既存注記どおり別検討）
- `src/components/ui/**` への lint 適用（shadcn vendor 領域。progress.tsx の修正自体は C1 で実施）

## Design Decisions

### D-C1 token taxonomy: 値重複より意味分離、ただし既存 token と同値の別名は作らない

新設 12 token（`:root` HEX + `@theme inline` の `--color-*` 対）:

| token | HEX | Tailwind 相当 | 用途 |
|---|---|---|---|
| `--warning-soft` | #fffbeb | amber-50 | 在庫少 Badge / 警告バー / 手動 Badge の soft 背景 |
| `--warning-border` | #fde68a | amber-200 | 在庫少 Badge outline |
| `--warning-strong` | #78350f | amber-900 | warning 系 Badge / バーの強調テキスト |
| `--warning-emphasis` | #b45309 | amber-700 | 在庫少セルの強調テキスト（`--primary` と同値だが意味分離 — brand と警告強調は将来独立して動かせる） |
| `--destructive-soft` | #fef2f2 | red-50 | 在庫切れ Badge / 前月比マイナスの soft 背景 |
| `--destructive-border` | #fecaca | red-200 | 在庫切れ Badge outline |
| `--destructive-strong` | #7f1d1d | red-900 | 在庫切れ Badge の強調テキスト |
| `--success-soft` | #f0fdf4 | green-50 | 前月比プラスの soft 背景 |
| `--success-emphasis` | #16a34a | green-600 | 前日比/前月比プラスの数値テキスト |
| `--rank-top-bg` | #fffbeb | amber-50 | 1位行背景（`/40` alpha は class 側で維持） |
| `--rank-top-badge-bg` | #fef3c7 | amber-100 | 1位 Badge 背景 |
| `--rank-top-badge-text` | #92400e | amber-800 | 1位 Badge テキスト |

- **既存 token と同値の text 用途は既存を流用**: rose-700/600 のセル/エラー/減少テキストは新名を作らず `text-destructive`（#b91c1c、既に ProductListPage.tsx L104 等で稼働実績あり）。emerald-700 の比較テキストは `text-success`（#15803d）。token 増殖の最小化と「使う shade のみ定義」の両立
- **1位ハイライトは `rank-top` 系で独立**（memory `feedback-naming-must-match-reality`）: 値は amber 共有だが「警告」ではないため `warning` を流用しない。将来 warning だけ色変更しても 1位表示が巻き込まれない
- **known nuance**: Tailwind 4 既定 palette は oklch、新 token は v3 系 HEX 近似（globals.css 既存 token の前例に揃える）。`bg-amber-50`（oklch）→ `bg-warning-soft`（#fffbeb）の微差は L3 の視覚確認範囲内

### D-C2 手動 Badge の bg は amber-100 → warning-soft（amber-50）へ寄せる

daily ProductTable の「手動」Badge（bg-amber-100）専用に token を増やさず `bg-warning-soft` を使う。背景がわずかに明るくなるが text は `text-warning-strong`（amber-900）でコントラスト維持。軽微な視覚差分として L3 確認対象に含める。

### D-C3 rose→red / emerald→green の hue 補正は意図的色補正（L3 の核心）

`00-foundations.md` パレットの正は red-700（destructive）/ green-700（success）。rose / emerald は palette 外のまま実装されていた逸脱で、補正後は「在庫切れ・マイナスが赤く、プラスが緑に見える」を L3 で実機確認（実利用者は高齢・赤黄色覚配慮 → 全箇所アイコン/テキスト併記済みで色のみ符号化なし、DSR-08 準拠は不変）。

### D-C4 dark: の扱い — amber 系 2 クラスのみ削除、dark mode は light 固定運用と判断

globals.css に `.dark` の token 上書き block が存在せず（`@custom-variant dark` 宣言のみ）、dark mode は未運用。PluNotificationBar の `dark:bg-amber-950/40 dark:text-amber-100` は未稼働の死にクラスとして C1 で削除（light 表示完全不変）。**なお dark: 痕跡は唯一ではない** — daily ProductTable L98/L118 に `dark:bg-stone-800/900` があるが stone は palette 内で lint 対象外のため残置（scope 外）。

### D-C5 C2 最小置換仕様（見た目維持の具体 class）

現行 `<button type="button" className="inline-flex items-center gap-1 font-medium hover:text-foreground">` →

```tsx
<Button type="button" variant="ghost" size="sm"
  className="-mx-3 h-auto gap-1 px-3 py-0 font-medium hover:bg-transparent hover:text-foreground"
  onClick={() => { onClick(column); }}>
  {label} <span aria-hidden="true">{indicator}</span>
</Button>
```

- ghost の `hover:bg-accent` を `hover:bg-transparent` で打ち消し、`size="sm"` の `h-8` を `h-auto py-0` で打ち消し（TableHead 内の高さ崩れ防止）、既定 `gap-2` を `gap-1` 上書き、`px-3` インデントを `-mx-3` で相殺（列頭位置維持）
- **buttonVariants 由来の focus-visible ring（3px）は新規付与のまま残す**（rally R1 P3-1: 打ち消すと a11y 後退。「見た目維持」の例外として keyboard focus 時のみ差分、L3 確認対象に含める）
- 既存 test は `getByRole("button", { name })` ベースで shadcn Button も real `<button>` を描画するため不変 green（実測で button 名指し assert は monthly 2 test のみ、accessible name 不変）

### D-C6 eslint rule 設計（esquery 公式裏取り済み + prior art c5f3786 流用）

esquery README 一次確認済み: attribute regex `[attr=/foo.*/]` は公式サポート。repo 内 prior art `c5f3786`（PR #48、撤去済み）に `no-restricted-syntax` + `ExportNamedDeclaration[source.value=/.../]` の稼働実績。

**(i) palette 外色 ban**:
```js
{
  files: ["src/features/**/*.{ts,tsx}", "src/components/patterns/**/*.{ts,tsx}"],
  ignores: ["src/features/**/*.test.{ts,tsx}", "src/components/patterns/**/*.test.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": ["error", {
      selector: "Literal[value=/\\b(amber|rose|emerald|red|green|orange|yellow|lime|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|slate|gray|zinc|neutral)-(50|100|200|300|400|500|600|700|800|900|950)\\b/]",
      message: "palette 外の生 Tailwind 色 class は禁止。docs/design-system/00-foundations.md の semantic token（bg-warning-soft / text-success-emphasis / text-destructive 等）を使うこと（DSR-08 / PR-C）。",
    }],
  },
},
```
- **stone は ban list に含めない**（palette 内、直書き許可が規約）
- token utility（`bg-warning-soft` 等）は `<family>-<数値shade>` パターン非該当で誤検出ゼロ
- `cn()` 内文字列も AST 上 Literal なので両形態捕捉。コメントは AST 外で無関係
- **limitation（rally R1 P3-4）**: 動的 shade 補間（`` `bg-${c}-${n}` `` 型）は AST Literal にならず検出外。現状 0 件を実測確認済み、構造 lint は ast-grep 将来項目（README L46 既記載）でカバー
- test 除外は必須（ProductRankingTable.test.tsx の `"[class*='bg-amber']"` 類の assert 文字列が Literal で引っかかるため。C1 で assert 自体も更新するが、将来の class assert を妨げない設計）
- files に `src/components/patterns/**` を含める（design-system の canonical home は常時 clean を機械保証）。`src/components/ui/**` は scope 外（shadcn vendor）

**(ii) barrel 迂回封じ**:
```js
{
  files: ["src/components/patterns/index.ts", "src/components/ui/index.ts"],
  rules: {
    "no-restricted-syntax": ["error",
      { selector: "ExportNamedDeclaration[source.value=/.*/]", message: "patterns/ ui/ に barrel index.ts を作らない。直接 path import すること（PR-C）。" },
      { selector: "ExportAllDeclaration[source.value=/.*/]", message: "patterns/ ui/ に barrel index.ts を作らない（PR-C）。" },
    ],
  },
},
```
- 両 index.ts は現在不在 → 作成された瞬間に lint error になる予防 gate（prior art の invoke-fallback 限定形を任意 source 形へ一般化）

**(iii) 生 `<button>` ban（Codex R1 P2 で追加、親 packet C-lint-2 の復元）**: (i) と同一 files/ignores scope に selector `JSXOpeningElement[name.name='button']` を追加。test 除外は (i) と同根（`patterns/PageHeader.test.tsx` 等のダミー button が引っかかるため）。初期 scope は `<button>` 限定で `<input>/<select>` は段階拡大判断（親 packet C-lint-2 のまま）。`src/components/ui/**` は scope 外（segmented-control 内部の raw button は primitive 実装として正当）

### D-C7 DS-doc 検査 DS1〜DS4（既定スイート統合、DS5 = STYLE 準拠は M1/M3 で既カバーのため作らない）

| ID | 内容 | severity | 実装方針 |
|---|---|---|---|
| DS1 | design-system docs 内 backtick `src/...` path 実在 | ERROR | `docs/design-system/*.md` から `` `src/[^`]+` `` を抽出し `[ -f ]` 判定。**glob 文字（`*` / `?`）を含む抽出値は path でなく規約表現のため skip**（rally R3 P1-1: `01-decision-rules.md:146` DSR-08 本文の `` `src/features/**` `` が `[ -f ]` で ERROR 誤検出し C4 / CI docs job / pre-push を落とすのを防止）。glob 除外後の現状は catalog 23 path 含め全実在 = 誤検出ゼロから開始（R3 で design-system 全 docs + review-checklist を総当たり確認済み） |
| DS2 | DSR 孤立（双方向） | 孤立=WARN / 壊れ参照=ERROR | `^## DSR-NN` 全列挙 → catalog or review-checklist からの `DSR-NN` 参照有無（孤立は WARN）。逆向き: 参照される DSR-NN が定義に実在しない場合は ERROR |
| DS3 | token HEX 整合 | ERROR | `00-foundations.md` の `` `--<name>` `` を含む表行から **同行の最初の `#[0-9a-fA-F]{6}`** を抽出（rally R2 P2-1: stone scale 表は裸 HEX 独立カラム / semantic 表は `(#hex)` の二書式があるため「同行最初の HEX」で統一吸収。stone + semantic + 新 12 の全表対象）し、globals.css の **`:root` のみ**（`@theme inline` の `--color-*` 別名は突合対象外）の `--<name>: #hex` と突合（大文字小文字正規化）。**双方向**: HEX 不一致に加え「foundations にあって `:root` に無い token」も ERROR（rally R2 P3-2、`--danger` を確実に捕捉）。新 12 token の foundations 追記は semantic 表の `(#hex)` 書式に揃える（C1 で実施） |
| DS4 | review-checklist カテゴリ 9 の DSR 対応 | WARN | category-9 各項目が `DSR-NN` 参照を持つか |

- 対象 path は `docs/design-system/` + `docs/quality/review-checklist.md` 直指定（`docs/archive/` を走査しない = 旧参照の誤検出回避）
- 既存 idiom 踏襲: `header()` / `error()` / `warn()` / `info()`、`rg ... || true`、設計書モードのメインループ（L1399-1429 帯）へ呼び出し追加。exit 1 は ERROR のみ

### D-C8 `--danger` → `--destructive` の foundations 同期は C1 内（C5 へ後送りしない）

DS3（C4）が HEX/名前整合を検証する前提のため、token 表の正規化は C1 commit に同梱。既知逸脱 block の書換（prose）は C5 に集約。

## Spec Contract

色 14 箇所 + C2 + test 更新 = 全 16 行 mapping。path は `src/` 配下の実体パス（`components/` セグメント込み、rally R1 P2-2）。

| # | ファイル:行 | before | after |
|---|---|---|---|
| 1 | features/stock-inquiry/components/StockStatusBadge.tsx:18 | `border-amber-200 bg-amber-50 text-amber-900` | `border-warning-border bg-warning-soft text-warning-strong` |
| 2 | features/stock-inquiry/components/StockStatusBadge.tsx:19 | `border-rose-200 bg-rose-50 text-rose-900` | `border-destructive-border bg-destructive-soft text-destructive-strong` |
| 3 | features/stock-inquiry/components/ProductListTable.tsx:38 | `text-amber-700` | `text-warning-emphasis` |
| 4 | features/stock-inquiry/components/ProductListTable.tsx:39 | `text-rose-700` | `text-destructive` |
| 5 | features/stock-inquiry/components/StockDetailContent.tsx:76 | `text-rose-700` | `text-destructive` |
| 6 | features/home/components/PluNotificationBar.tsx:23 | `border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100` | `border-warning bg-warning-soft text-warning-strong`（dark: 2 クラス削除） |
| 7 | features/daily-sales/components/ProductTable.tsx:144 | `bg-amber-100 text-amber-900` | `bg-warning-soft text-warning-strong` |
| 8 | features/daily-sales/components/SummaryCardsBar.tsx:139 | `text-emerald-600` / `text-rose-600` | `text-success-emphasis` / `text-destructive` |
| 9 | features/monthly-sales/components/SummaryCardsBar.tsx:115 | `text-emerald-600` / `text-rose-600` | `text-success-emphasis` / `text-destructive` |
| 10 | features/monthly-sales/components/comparison-cell.tsx:10 | `bg-emerald-50 text-emerald-700` | `bg-success-soft text-success` |
| 11 | features/monthly-sales/components/comparison-cell.tsx:11 | `bg-rose-50 text-rose-700` | `bg-destructive-soft text-destructive` |
| 12 | features/monthly-sales/components/ProductRankingTable.tsx:90 | `bg-amber-50/40` | `bg-rank-top-bg/40`（alpha class 側維持） |
| 13 | features/monthly-sales/components/ProductRankingTable.tsx:93 | `bg-amber-100 text-amber-800 hover:bg-amber-100` | `bg-rank-top-badge-bg text-rank-top-badge-text hover:bg-rank-top-badge-bg` |
| 14 | components/ui/progress.tsx:24 | `bg-amber-600` | `bg-warning`（#d97706 同値、視覚不変） |
| 15 | C2: features/daily-sales/components/ProductTable.tsx:187 / features/monthly-sales/components/ProductRankingTable.tsx:144 / features/monthly-sales/components/DepartmentTable.tsx:129 の `<button>` | raw button | D-C5 の Button 置換形 |
| 16 | features/monthly-sales/components/ProductRankingTable.test.tsx:92 | `querySelector("[class*='bg-amber']")` | text/role invariant へ寄せる（「1 位」Badge の存在を role/text で assert。色 class selector は撤去。**同 test L87 の「Badge (bg-amber 系)」コメントも追従更新**、rally R4 P3-a） |

## 実装手順 / Commit 分割（直列、各 commit green）

| commit | prefix | 内容 | green 条件 |
|---|---|---|---|
| C1 | `fix(ui):` | token 12 個新設 + mapping #1-14 移行 + #16 test 更新 + foundations 表同期（`--danger`→`--destructive` + 新 token 行） | `npm test` / typecheck / format:check / build 全 pass。`rg -n "amber-|emerald-|rose-" src/features` 0 件 |
| C2 | `fix(ui):` | 3 ファイル Button 置換（D-C5） | `npm test` 不変 green。`rg -n "<button" src/features` 0 件 |
| C3 | `chore(lint):` | eslint 2 block 追加 | `npm run lint` exit 0（**C1/C2 完了が前提。先行させると 16 箇所で赤**） |
| C4 | `chore(scripts):` | DS1〜DS4 + メインループ呼び出し | `bash scripts/doc-consistency-check.sh` exit 0（DS3 は C1 の foundations 同期が前提） |
| C5 | `docs(design-system):` | 既知逸脱 block 2 箇所書換 + README 将来項目注記 + FUNCTION_DESIGN/Plans.md 同期 | doc-consistency exit 0 + `rg -n "PR-C で是正予定" docs/design-system/` 0 件 |

C5 の contract 固定事項（rally R3 P3-1 / P3-3）:
- **既知逸脱 2 block は非対称**: `01-decision-rules.md:152` = 4 ファイル（SummaryCardsBar 含む）+ rose/amber/emerald 3 系統、`02-component-catalog.md:738`（catalog ⑬ 配下）= 3 ファイル + rose/amber 2 系統（SummaryCardsBar の emerald は比較数値用途で ⑬ 管轄外）。各 block を自管轄の是正後文面へ**独立に**書換（コピペ統一しない）
- **README ast-grep 行の reframe**: 「palette 外色・生 primitive を構造的に強制」→「静的 palette 外色 / 生 `<button>` / barrel は PR-C の eslint + DS1〜DS4 で強制済み。ast-grep は動的 shade 補間・`<input>/<select>` 構造強制など残ケースの将来補完（npm 凍結解除後）」へ書換（注: この「強制済み」claim は当初 C3 に生 button selector が無く drift していた — Codex R1 P2 で selector 追加により claim を真にする方向で解消）

実装は commit 単位で Sonnet subagent へ委譲（丸投げ禁止、orchestrator が contract = mapping 表 / rule 仕様 / DS 仕様を prompt に固定して検収）。

## Test Plan

- Test Design Matrix: [test-matrices/2026-06-13-design-system-pr-c.md](test-matrices/2026-06-13-design-system-pr-c.md)
- **影響を受ける既存 test は 1 件のみ**（実測済み）: `ProductRankingTable.test.tsx:92` の `[class*='bg-amber']` → C1 同梱で text/role invariant へ更新
- monthly 2 test の `getByRole("button", { name })` は C2 で不変 green（real button + accessible name 不変）。daily ProductTable.test は button 名指し assert なし
- StockStatusBadge / comparison-cell / StockDetailContent / PluNotificationBar / 両 SummaryCardsBar に色 class assert なし（実測）→ C1 不変 green
- **新規 unit test 不要**（PR-B B0 characterization が DOM 不変条件を既にカバー、C1/C2 は class 置換のみ）
- **lint fail 実証**（commit しない、PR body に evidence 記録）: features 配下へ一時的に `bg-rose-700` を挿入 → `npm run lint` が error → revert。`patterns/index.ts` を一時作成し `export * from "./EmptyState"` → error → 削除
- **DS check fail 実証**: catalog の path を 1 箇所一時改変 → DS1 ERROR / foundations の HEX を 1 文字改変 → DS3 ERROR → revert で exit 0 復帰
- **DS2/DS4 は WARN のため exit code で実証できない**（rally R1 P3-2、exit 1 は ERROR のみ = script L1434-1439）: fail 実証は「一時的に DSR 参照を 1 箇所外す → stdout に `[WARN]` 出力が出ることを grep で確認 → revert」。AC 上も DS2/DS4 は「WARN として可視化される」が合格条件（exit 0 を妨げない）

## Acceptance Criteria

- [ ] `npm run lint` exit 0（新 2 block 込み）
- [ ] `rg -n "amber-|emerald-|rose-" src/features src/components/patterns` 0 件（親プラン AC の emerald/rose を実測 drift に合わせ amber へ拡張。負 glob 不使用）
- [ ] `rg -n "amber-|emerald-|rose-" src/components/ui/progress.tsx` 0 件（mapping #14 は lint scope 外のため AC で名指し担保、rally R3 P3-2）
- [ ] `rg -n "<button" src/features` 0 件
- [ ] `bash scripts/doc-consistency-check.sh` exit 0（DS1〜DS4 含む既定スイート）
- [ ] `npm test` / `npm run typecheck` / `npm run format:check` / `npm run build` 全 exit 0
- [ ] `rg -n "\-\-danger" docs/design-system/` 0 件（`--destructive` へ統一）
- [ ] `rg -n "PR-C で是正予定" docs/design-system/` 0 件
- [ ] lint / DS check の fail 実証 evidence が PR body に記録されている
- [ ] CI 3 jobs green → Codex review 収束 → L3 owner 承認（色補正）→ merge

## Data Safety

DB / localStorage / ファイル書込なし。UI class + lint 設定 + script + docs のみ。失敗時 `git revert` で完全復元可能。バックアップ不要。

## Trace Matrix

| Spec ID | 出典 | Commit | Test / Check | 検証 |
|---|---|---|---|---|
| SPEC-DSC-1 | 親 packet C-lint-1 / DSR-08 / 01-decision-rules L152 | C1 | 既存 test 不変 + #16 更新 + L3 | mapping 表 14 箇所 + `rg` 0 件 |
| SPEC-DSC-2 | 親 packet C-lint-2（button 限定、user 決定 = 最小置換） | C2 | role-based test 不変 | `rg "<button" src/features` 0 件 |
| SPEC-DSC-3 | 親 packet C-lint-1/3 + esquery 公式 + prior art c5f3786 | C3 | lint fail 実証 evidence | `npm run lint` exit 0 |
| SPEC-DSC-4 | 親 packet DS-doc 検査（--target 新設なし） | C4 | DS check fail 実証 evidence | doc-consistency exit 0 |
| SPEC-DSC-5 | 親 packet C5 + 既知逸脱 2 箇所 | C5 | doc-consistency exit 0 | `rg "PR-C で是正予定"` 0 件 |

## Review Focus

- mapping 表の before 値が実コードと一致しているか（drift 検出）
- lint selector の誤検出（token utility / 日本語 Literal / コメント）と検出漏れ（cn() 内 / template literal）
- DS3 の HEX 突合が foundations 表の書式揺れに頑健か
- C2 置換の見た目維持（ghost hover / h-8 / px の打ち消し漏れ）
- L3: rose→red / emerald→green 補正 + 手動 Badge 軽微差分の実機視認性

## 実行体制

- orchestrator: packet 管理・contract 固定・検収・commit/PR 操作
- 実装: commit 単位で Sonnet subagent（C1/C2 は mapping 表を prompt に固定、C3/C4 は rule/check 仕様を固定）
- review: Codex CLI（R1〜収束）→ L3 owner（Windows native、色補正確認）

## Self-Review

### 1. 前提条件

> main は PR #98 merge + docs sync `8acfa38` で clean。esquery attribute regex は公式 README で裏取り済み（`[attr=/foo.*/]`）+ repo 内 prior art `c5f3786` 稼働実績。eslint 9.39.4 / typescript-eslint 8.58.2 既存のみで新規 devDep 不要（npm 凍結制約に適合）。違反 16 箇所 / test 影響 1 件 / catalog 23 path 実在は Explore + orchestrator 一次ソースで実測済み。

### 2. scripts / 機械検証

> 新規 script は書かず `scripts/doc-consistency-check.sh`（1443 行）への DS1〜DS4 追加のみ。既存 idiom（header/error/warn/info、`rg || true`、設計書モード main loop L1399-1429）を踏襲。`--target` 新設はしない（親 packet rally R1 P2-1 / R2 P2-4 確定事項の遵守）。rg ネガティブ glob は使わない（memory `ripgrep-15-negative-glob-broken`、AC の rg も正向き指定のみ）。

### 3. 検証計画

> 各 commit green 条件を表で固定（C3 は C1/C2 完了が前提という順序依存を明記）。lint / DS check の fail 実証は「一時違反 → error 確認 → revert」を PR body evidence 化（memory `feedback-subagent-green-report-verify-real-wiring` — green 報告だけでなく gate が実際に落ちることを実証）。L3 は色補正（rose→red / emerald→green / 手動 Badge 軽微差分）の実機視認性に限定し、CI green → Codex 収束 → L3 → merge の順序を維持。

### 4. 後処理

> merge 後: Plans.md status 同期 + packet を `docs/archive/plans/` へ移送（相対パス変換、memory `feedback-archive-relative-path-conversion`）+ `git mv` 前の未ステージ編集確認（memory `feedback-git-mv-unstaged-edit-survives-at-new-path`、本セッションで被弾済み）。Backlog の「SortableHeader 共通化」「`test_token_exists()` 負 glob 除去」は本 PR 対象外で残置確認。

### 5. 制約

> npm install 系は実行しない（Mini Shai-Hulud 凍結、新規 devDep 不使用設計で適合）。既存 test の削除・skip なし（#16 は assert の同等更新で削除でない）。設計書（00-foundations / 01-decision-rules / 02-catalog）と異なる変更は本 packet で理由明示済み（`--danger` drift 修正・既知逸脱 block 書換は docs 側の同期）。`.claude/` のみへの成果物配置なし（Codex 可視性）。

### 6. commit 分割

> C1〜C5 直列・各 commit 独立 green は親 packet「commit 分割: C1 色 token 移行 → C2 button 対応 → C3 lint ルール → C4 DS 検査統合 → C5 将来項目 README 注記」（archive L169）の踏襲。順序依存は 2 本あり逆転不可: ① C3 の lint gate は C1/C2 の違反ゼロ化が先（先行させると features の生色 13 箇所 + raw button 3 箇所で `npm run lint` が即赤、親 packet「違反ゼロ化先行で CI 赤回避」L182 の遵守）、② C4 の DS3 は C1 の foundations 同期（`--danger`→`--destructive` + 新 12 token 追記、D-C8）が先でないと HEX 突合が ERROR を吐く。`ProductRankingTable.test.tsx:92` の assert 更新を C1 へ同梱するのは「色 class 変更とその characterization 更新は同一 commit で diff 明示」の PR-B 方式（memory `ui-design-impl-bundled-pr` の設計↔実装対応表と同根）。意図的差分（rose→red / emerald→green 色補正）を C1 に閉じ込めることで、L3 で確認すべき視覚 delta が 1 commit の diff に集約され、レビュー面が C2〜C5 へ漏れない。prefix は親 packet 確定値（`fix(ui)` / `chore(lint)` / `chore(scripts)` / `docs(design-system)`）で conventional commits 準拠。

### 7. bias 自覚

> (a) 手動 Badge の bg を amber-100→50 へ寄せる D-C2 は「token 最小化」優先の判断で、視覚忠実度を犠牲にする方向の bias があり得る → L3 で実利用者基準の確認対象に明示。(b) lint scope を features+patterns に限定したのは誤検出回避優先で、ui/ の将来汚染を見逃す方向 → progress.tsx 是正済み + barrel gate で部分緩和、完全カバーは ast-grep 将来項目に明記。(c) `--warning-emphasis` が `--primary` と同値の重複 token になる点は意味分離を優先した判断（rally で圧縮可否を critique 対象に）。

## Rally ログ

- Round 1（Opus、fact-check 指定）: P1×0 / P2×2 / P3×4 → 全採用。P2-1 箇所数 drift（16/11 → 14 箇所/10 ファイル、mapping 表と prose の一致）、P2-2 Spec Contract / Scope の path に `components/` セグメント補完（subagent contract の誤誘導防止）。P3-1 D-C5 に focus-visible ring 新規付与を明記（a11y 改善方向、L3 対象）、P3-2 DS2/DS4 の WARN 実証を stdout grep 方式で追記、P3-3 DS3 突合スコープを「foundations 全表 ↔ globals.css `:root` のみ」と明示、P3-4 動的 shade 補間の検出外 limitation を D-C6 に追記。mapping 表 14 行の before 値・行番号は R1 で全数一致を確認済み
- Round 2（Opus、fresh-eyes fact-check）: P1×0 / P2×2 / P3×2（追認 2 件除く）→ 全採用。P2-1 DS3 抽出仕様が foundations の二書式（stone=裸 HEX カラム / semantic=括弧 `(#hex)`）と内部矛盾 → 「同行最初の HEX」抽出へ統一 + 新 token は semantic 書式で追記。P2-2 input/select「8 ファイル」訂正が逆に誤り → 実数 6 へ戻す（初回 Explore のファイル内重複カウント）。P3-2 DS3 を双方向化（foundations にあって `:root` に無い token も ERROR、`--danger` 捕捉保証）。mapping 14 行 / token HEX 12 個 / eslint 誤検出 / test 影響 1 件 / commit 順序 / AC 判定能力は R2 で全数照合済み・問題なし
- Round 3（Opus、未踏角度指定: DS-doc 検査ロジック / C5 書換 / globals 干渉 / gates / Self-Review 整合）: **P1×1** / P2×0 / P3×3 → 全採用。P1-1 DS1 が `01-decision-rules.md:146` の backtick glob `` `src/features/**` `` を `[ -f ]` で ERROR 誤検出し C4 / CI / pre-push を初手で落とす（「catalog 23 path 確認済み」の検証スコープと「design-system 全 docs から抽出」の実装スコープのズレ）→ glob 文字 skip を DS1 仕様に固定。P3-1 既知逸脱 2 block の非対称性を C5 contract に固定、P3-2 progress.tsx の AC 名指し担保、P3-3 README ast-grep 行の reframe 内容を C5 contract に固定。DS3 双方向設計の `:root` 余剰 12 token 非誤検出 / token alpha 前例 / DS2・DS4 現状 green / CI・hook 整合 / Self-Review 整合は R3 で追認済み
- Round 4（Opus、修正反映整合 + DS1 glob skip 総当たり + 通し読み）: **P1×0 / P2×0** / P3×1 → **収束**。DS1 の backtick `src/` 抽出は target docs 全体で 27 件、glob は `01-decision-rules.md:146` の 1 件のみ = skip 仕様で誤検出ゼロを総当たり実証。eslint selector は esquery 1.7.0 実機実行で違反全捕捉 + token utility 非検出を実証。R1〜R3 修正の本文反映に内部矛盾なし。P3-a（ProductRankingTable.test.tsx L87 の stale コメント追従）を mapping #16 に採用。収束基準: P1/P2 新規 0 の round（memory `feedback-plan-rally-required-before-exit`）。最終 gate = user 承認（ExitPlanMode）

## Review Response

### Codex Round 1（2026-06-13、P1: 0 / P2: 1 / P3: 0）

- **P2（生 `<button>` の機械強制 claim と実装の乖離）= 採用**: 実証 — eslint.config.js の selector は palette 色 Literal + barrel 2 種の計 3 つのみで、raw `<button>` を検出する rule が不在。一方 packet C5 contract と README「機械強制の現状」は「生 `<button>` も eslint で強制済み」と claim していた。根本原因は親 packet `C-lint-2 生 primitive: 初期 scope <button> 限定`（lint 契約）を本 packet 化時に「3 箇所置換のみ」へ縮めた contract drift（rally 4 round も未検出）。修正は docs を弱める方向でなく **selector `JSXOpeningElement[name.name='button']` を C3 (i) と同一 scope に追加**して claim を真にする方向を採用（親契約の復元）。fail 実証: 一時 raw button 挿入で `no-restricted-syntax` error 検出 → revert、`patterns/PageHeader.test.tsx` のダミー button は test 除外で green を確認

### Codex Round 2（2026-06-13、P1: 0 / P2: 0 / P3: 0。R1 P2 = 解消判定、最終収束）

- merge blocker なしの最終収束判定。reviewer が ESLint API で再実証: features/patterns の raw `<button>` は検出、shadcn Button / test / `ui/**` は非検出で scope 設計どおり

### L3 owner 承認 + merge（2026-06-13）

- L3 Windows native 実機確認（HEAD `9040d53`）: 目視判別可能な絶対基準チェックリストで実施。色補正（在庫切れ・前月比マイナスが素直な赤系 / プラスが緑系、ピンクがかりなし）OK / sort header の Tab focus ring 表示 OK / レイアウト崩れなし
- **手動 Badge は実機確認不可で受容**: seed は `source='auto'` のみ生成 + UI-04（手動販売出庫画面）が Phase 3 未実装のため表示経路が構造的に不在。変更は背景 1 shade のみ（text 同一、コントラスト向上方向）で mapping #7 + AC grep の class レベル固定。render する test は無い点を正直に記録し、**UI-04 実装時（Phase 3 9-6）の L3 で可読性をついで確認**する（PR #99 L3 コメント参照）
- PR #99 squash merge: `e9acfc1`（2026-06-13）。3 段 PR（A `24c7f6e` / B `202e128` / C `e9acfc1`）完結
