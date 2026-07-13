# Phase 2 8-6 ショートカット一覧ダイアログ 実装プラン

> 起票: 2026-05-12 / 親プラン参照: [Plans.md](../../../Plans.md) L19 / L107
> 着手 PR: PR #58 (private archive) open 済（2026-05-12、`feat/ui-shortcuts-dialog` ブランチ、最新機能修正 commit = `febc4b5`（Round 3 P1 CI fix = 54-ui-shortcuts.md を design_compliance_test の SKIP_DOCS に登録）、機能 commit 1-7 chain、docs sync commit は self-trace のため本欄では trace せず PR description 側で確認 — Plans.md sync ループ回避方針）
> 配布 archive 予定: `docs/archive/plans/2026-05-12-phase-2-ui-shortcuts.md`

---

## Context

**なぜ着手するか**: PR #56 (Phase 2 8-1 UI-00 ホーム画面、`e6da3d8`) のマージで Q-3 採用結果「ショートカット一覧ダイアログは UI-00 マージ後の別 PR で単独実装」の条件が解禁された ([docs/archive/plans/2026-05-09-phase-2-ui-00.md](2026-05-09-phase-2-ui-00.md) Q-3)。Plans.md L19 / L107 で「次着手候補 (Active 直近)」として明示済み。8-2 UI-07 CSV 取込みは 8-2a/b の状態管理 / IPC ストリーミング判定が先行で重い、8-6 は単独 PR で 4 commit クラスの軽量タスクなので、Phase 2 のリズム維持に最適。

**何を作るか**: グローバル Ctrl+/ 押下でショートカット一覧ダイアログを開閉できる純フロントエンド機能。Esc で閉じる、Tab で focus 移動、Ctrl+/ 再押下でトグル。本 PR では Ctrl+/ 自体のショートカット 1 件のみを `SHORTCUTS` 定数に載せ、画面固有ショートカット枠は「現在のページに固有のショートカットはありません」表示の状態で出す。

**意図される成果**: (1) UI_TECH_STACK §5.2 のグローバルショートカット仕様の最初の実装、(2) Phase 2 8-2 以降の画面が `SHORTCUTS` 配列に追記するだけでショートカット一覧に出る拡張点の確立、(3) 関数設計 + 実装 1 PR 統合 (memory `ui-design-impl-bundled-pr.md`) のパターン継続 (UI-12 PR #50 / UI-00 PR #56 に続く 3 例目)。

---

## Scope 確定 (全 YAGNI 整合案、2026-05-12 user 確認済)

| 項目 | 採否 | 根拠 |
|---|---|---|
| Ctrl+/ keydown 検出 + Dialog 開閉 | ✅ 本 PR | 本タスクの核 |
| ショートカット一覧表示 (グローバル + 画面固有の 2 セクション) | ✅ 本 PR | UI_TECH_STACK §5.2 / Q-3 |
| グローバル shortcut 1 件 (Ctrl+/ 自体) | ✅ 本 PR | 自己言及で動作確認可能 |
| 画面固有 shortcut の中身 | ❌ 各画面 PR で追記 | 現状 UI-00 で確定済みは特になし、Tab/Enter/Esc は Radix 標準 |
| `useIsMac` / Cmd+/ 描画分岐 | ❌ 削除 | Windows 専用配布方針 ([CLAUDE.md](../../../CLAUDE.md) / [DEV_SETUP_CHECKLIST §1.4](../../DEV_SETUP_CHECKLIST.md))、本 PR で作っても死にコードに |
| Shortcut 型に `screenScope?: readonly string[]` 追加 | ❌ 未導入 | 最初の screen shortcut 追加時に 1 行拡張で済む、本 PR では category のみ |
| UI_TECH_STACK §5.2 表に Ctrl+K / Alt± 予告フラグ | ❌ 不要 | 進捗管理 SSOT は Plans.md、UI_TECH_STACK は仕様の SSOT、責務分離維持 |
| Ctrl+K コマンドパレット | ❌ 別 PR (Backlog 8-6b) | 検索遷移先未整備、Phase 3 商品検索 UI-01a で再判定 |
| Alt+←/→ ブラウザ的戻る/進む | ❌ 別 PR (Backlog 8-6c) | router.history.back/forward 1 commit、本 PR と分離 |
| Vitest unit test | ❌ 別 PR | Plans.md 7-7 Vitest 初期化が未着手、本 PR で test 追加は scope creep |

---

## Critical Files (実装着手前に読むべきファイル、優先順)

1. **[src/components/layout/RootLayout.tsx](../../../src/components/layout/RootLayout.tsx)** — Provider 配線位置 (L56-67)。`<TooltipProvider>` 直下に `<ShortcutsDialog />` を追加、`<Toaster />` と並列配置。export function 構造維持。
2. **[docs/function-design/53-ui-home.md](../../function-design/53-ui-home.md)** — 業務ロジックあり版テンプレ初適用例。本 PR §54 の参照基準 (10 章構成、`§53.7 ショートカット` で「8-6 で実装予定」と明記済)。
3. **[docs/function-design/52-ui-shared-layout.md](../../function-design/52-ui-shared-layout.md)** — 業務ロジックなし版テンプレ + ウィンドウタイトル機構。state 駆動分岐ありパターンの先例として `§52.5` 参照。
4. **[src/components/ui/dialog.tsx](../../../src/components/ui/dialog.tsx)** — Dialog プリミティブの export 10 種 (Dialog/Trigger/Portal/Close/Overlay/Content/Header/Footer/Title/Description)。`<DialogContent>` の `showCloseButton` prop は default true で右上 × 自動描画。Radix `radix-ui` package 経由。
5. **[docs/UI_TECH_STACK.md §5.2](../../UI_TECH_STACK.md)** L540-562 — ショートカット仕様の SSOT。本 PR で Ctrl+/ 行に「実装: §54」リンク追記。
6. **[docs/DOC_STYLE_GUIDE.md](../../DOC_STYLE_GUIDE.md)** §2 関数設計書テンプレ + §5 禁止事項 + §6 自動チェック 19 項目 — `54-ui-shortcuts.md` 作成の準拠先。
7. **[src/features/home/hooks/useYesterdayDate.ts](../../../src/features/home/hooks/useYesterdayDate.ts)** — `useEffect` + `addEventListener` + cleanup の既存規範。`useShortcutsDialog` の参考実装。
8. **[scripts/doc-consistency-check.sh](../../../scripts/doc-consistency-check.sh)** — commit 1 で pass させる 19 項目チェックの実装。R0/R1/R3/M1/M2/M3 の失敗パターンを事前理解。

---

## 設計判断 (A-G、A 案確定後の確定値)

### A. スコープ
**確定**: Ctrl+/ のみ (Ctrl+K / Alt± は Backlog)。1 ショートカットなので依存追加コスト > メリット、自前 `useEffect` 10-15 行で済む。

### B. ダイアログ表示形態
**確定**: 普通の Dialog + Table 風一覧 (CommandDialog / cmdk は採用しない)。20-30 件規模のショートカット列挙には `<Table>` セマンティクスが a11y で勝る、Command palette は Ctrl+K 着手時の cmdk 導入で再判定。

```
Dialog (max-w-2xl)
  DialogHeader: DialogTitle "ショートカット一覧" + DialogDescription "押せるキー組合せの一覧"
  ScrollArea (max-h-[60vh])
    Section [グローバル]
      Table > tbody > tr > td (kbd) + td (説明)
    Section [このページ] ← 空時は「現在のページに固有のショートカットはありません」表示
  DialogFooter: 閉じるボタン (DialogClose asChild Button)
```

### C. state 管理
**確定**: custom hook `useShortcutsDialog` 内に `useState<boolean>(false)` を閉じ込める。Zustand 未導入維持 (UI_TECH_STACK §2.6)。グローバル keydown listener と open state を同じ hook 内で管理することで RootLayout 側の責務を「Provider mount」1 行に留める。

```ts
function useShortcutsDialog(): { open: boolean; setOpen: (v: boolean) => void }
```

### D. 配置規約
**確定**: `src/features/shortcuts/` 新設。`src/features/home/` パターン踏襲、barrel export `index.ts` で `ShortcutsDialog` / `useShortcutsDialog` を公開。

### E. a11y 考慮 (Radix 標準 + 6 点追加)
**Radix 標準で済む** (実装不要):
- Focus trap (Tab/Shift+Tab で Dialog 外に出ない)
- Esc キー閉じる
- `role="dialog"` + `aria-modal="true"`
- Open 時に最初の focusable に focus 移動
- オーバーレイクリックで閉じる

**追加実装** (6 点):
1. `<DialogTitle>` 必ず描画 (Radix が aria-labelledby 必須、未設定で console warning)
2. `<DialogDescription>` 必ず描画 (aria-describedby 必須)
3. `<kbd>` 要素のスタイル: `bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-xs`。スクリーンリーダ読み上げは行全体の説明テキスト (description) で意味が伝わる構造を確保
4. **input/textarea/contenteditable focus 中の Ctrl+/ 抑制**: `event.target` を判定して無視。Phase 3 検索画面以降で問題化、本 PR で先回り対応
5. **IME composition 中の keydown 除外**: `event.isComposing === true` または `event.keyCode === 229` で除外。日本語入力中の Ctrl+/ 誤発火を防ぐ。本プロジェクトは日本語業務アプリ + memory `tauri2-linux-ime-limitation.md` の IME 制約教訓と整合、Phase 3 検索画面で確実に被弾するパターンなので本 PR で先回り対応
6. `event.preventDefault()` のみ呼ぶ (`event.stopPropagation()` は呼ばない): ブラウザ既定キーバインド (Firefox の Quick Find 等) との衝突抑止。Phase 3 で UI-02 バーコードスキャナが keypress listen する予定なので propagation は止めない方針 (§54.7 と整合、`function-design/54-ui-shortcuts.md` L167-170 参照)

### F. ショートカット定義のデータ構造
**確定**: `src/features/shortcuts/data.ts` の const 定数 (型は `types.ts`)。1 件のみ。

```ts
// types.ts
export type ShortcutCategory = "global" | "screen";

export type Shortcut = {
  id: string;
  keys: readonly string[];
  description: string;
  category: ShortcutCategory;
};

// data.ts
export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: "global.show-shortcuts",
    keys: ["Ctrl", "/"],
    description: "ショートカット一覧を表示 / 閉じる",
    category: "global",
  },
] as const;
```

### G. テスト方針
**確定**: 手動検証のみ + Codex review 依存。Vitest 未初期化 (Plans.md 7-7) なので本 PR で test ファイル追加すると scope creep。`useShortcutsDialog` / 純関数化部分の test は 7-7 完了後に retroactive で追加。

---

## 実装ファイル一覧

### 新規 (7 ファイル + 設計書 1)

| パス | 行数目安 | 主責務 |
|---|---|---|
| `src/features/shortcuts/ShortcutsDialog.tsx` | 50-70 | Dialog/DialogContent + Header + ScrollArea + Footer。`useShortcutsDialog` 受け取り、SHORTCUTS を category でグルーピングし `<ShortcutsTable>` 渡し |
| `src/features/shortcuts/components/ShortcutsTable.tsx` | 30-50 | 1 section 分の `<table>` (shadcn `<Table>` 流用)。tr × N、td (kbd) + td (description)。空配列時は `<p>` で「該当なし」表示 |
| `src/features/shortcuts/components/ShortcutKeys.tsx` | 20-30 | `keys: string[]` → `<kbd>Ctrl</kbd>+<kbd>/</kbd>` 描画。`+` は `aria-hidden` |
| `src/features/shortcuts/hooks/useShortcutsDialog.ts` | 40-60 | `useState<boolean>` + `useEffect` で global keydown listen + input 除外 + `preventDefault` + cleanup |
| `src/features/shortcuts/data.ts` | 15-30 | `SHORTCUTS` 配列 (1 件) + `as const` |
| `src/features/shortcuts/types.ts` | 15-25 | `Shortcut` / `ShortcutCategory` 型 |
| `src/features/shortcuts/index.ts` | 5-10 | barrel export (`ShortcutsDialog`, `useShortcutsDialog`) |
| `docs/function-design/54-ui-shortcuts.md` | 200-300 | 10 章構成 (業務ロジックあり版テンプレ) |

### 既存変更 (5 ファイル + 1 post-merge)

| パス | 変更内容 |
|---|---|
| `src/components/layout/RootLayout.tsx` | `<TooltipProvider>` 直下に `<ShortcutsDialog />` mount + `useShortcutsDialog()` 呼び出し |
| `docs/FUNCTION_DESIGN.md` | 目次 §UI層 に 54 リンク追加、§現時点の対象モジュール に UI-shortcuts 行追加 |
| `docs/architecture/ui-task-specs.md` | `### UI-shortcuts: ショートカット一覧ダイアログ` セクション新規追加 (UI-00 と UI-12 の間に挿入) |
| `docs/function-design/53-ui-home.md` §53.7 + §53.9 | 「8-6 で実装予定」→「8-6 で実装済 (§54 参照)」更新、§53.9 非目的の該当行から削除 or §54 リンク化 |
| `docs/UI_TECH_STACK.md` §5.2 (L558) | Ctrl+/ 行に「実装: §54 (`function-design/54-ui-shortcuts.md` 参照)」記述追加。本 PR の commit 1 で関数設計書実体作成済の前提でリンク化、または inline code 形式維持 (DOC_STYLE_GUIDE §6 R3 整合) |
| `docs/DEV_SETUP_CHECKLIST.md` §13.3 (L407 周辺、8-6 entry) | **PR open 時**: `[ ]` のまま、entry 末尾の「UI-00 マージ後の別 PR で単独実装」記述を「PR #XX で実装中 → 完了」のような状態に書き換え。**merge 後別 commit**: `[ ]` → `[x]` 更新 (Plans.md 慣例と同期) |

---

## 関数設計書 54-ui-shortcuts.md の章立て案

| 節 | タイトル | 主内容 |
|---|---|---|
| 判定 | 本書のテンプレ判定 | 業務ロジックあり版判定根拠 (CMD 呼び出し 0 件 + state 駆動分岐あり、53 との対比) |
| 54.1 | コンポーネント構成 | `features/shortcuts/` 7 ファイル × 責務対応表 + RootLayout 接続点 + `data.ts` SSOT 化方針 |
| 54.2 | React State | `useShortcutsDialog` 内部 `useState<boolean>(false)` + `SHORTCUTS` 定数の派生 (`filter(category)`) |
| 54.3 | 外部依存 (CMD / Tauri API) | 「該当なし。純フロントエンド、IO/CMD/BIZ 層触らない」を 1 行で記述 |
| 54.4 | 利用者操作フロー | 1) Ctrl+/ 押下 → toggle / 2) Esc → close / 3) Tab → focus 移動 (Radix 標準) / 4) input focus 中の Ctrl+/ → 無視 |
| 54.5 | エラー表示 | 「該当なし。`SHORTCUTS.length === 0` 時は『定義されたショートカットはありません』」 |
| 54.6 | ローディング表示 | 「該当なし。静的データのため Skeleton 不要」 |
| 54.7 | キーボード処理仕様 | global keydown listener 登録/解除、Modifier キー検出 (`ctrlKey` / `metaKey`)、input/textarea/contenteditable 除外、**IME composition 除外** (`event.isComposing === true` または `keyCode === 229` で日本語入力中の誤発火回避、`tauri2-linux-ime-limitation.md` 関連)、`preventDefault` + `stopPropagation` 採否根拠、Mac Cmd+/ は非対応 (本 PR 範囲外) |
| 54.8 | 備考 | Ctrl+K / Alt+←/→ は 8-6b / 8-6c で別 PR、画面固有 shortcut は各画面着手時に SHORTCUTS 追記、UI_TECH_STACK §5.2 との整合性 |
| 54.9 | 非目的 | Ctrl+K (Phase 3+) / Alt± (別 PR) / 画面固有 shortcut 中身 / Mac Cmd+/ (Windows 専用方針) / Vitest unit test (7-7 完了後) |
| 更新履歴 | - | 本 PR で新規作成 |

---

## Commit 分割 (4 commit)

各 commit 単独でビルド可能 + lint pass を保つ (boundary milestone 1 commit 原則)。

### Commit 1: 関数設計書のみ (docs only)

```
docs(function-design): add 54-ui-shortcuts.md for Phase 2 8-6

- New: docs/function-design/54-ui-shortcuts.md (業務ロジックあり版テンプレ、CMD 呼び出し 0 件)
- Update: docs/FUNCTION_DESIGN.md 目次 + 対象モジュール
- Update: docs/architecture/ui-task-specs.md UI-shortcuts セクション追加
- Update: docs/function-design/53-ui-home.md §53.7 / §53.9 to reference §54
- Update: docs/UI_TECH_STACK.md §5.2 Ctrl+/ に §54 リンク
- Update: docs/DEV_SETUP_CHECKLIST.md §13.3 L407 周辺 8-6 entry 記述
```

**Gate**: `./scripts/doc-consistency-check.sh` 19 項目 pass (R3 リンク健全性 / M1 曖昧表現 0 / M2 テンプレ準拠 / M3 マーカー残存 0)

### Commit 2: core hook + data + types

```
feat(shortcuts): add useShortcutsDialog hook + SHORTCUTS const

- New: src/features/shortcuts/types.ts (Shortcut, ShortcutCategory)
- New: src/features/shortcuts/data.ts (SHORTCUTS 1 件: global.show-shortcuts)
- New: src/features/shortcuts/hooks/useShortcutsDialog.ts (open state + Ctrl+/ keydown listener + input 除外 + preventDefault)

Refs: docs/function-design/54-ui-shortcuts.md §54.2 / §54.7
```

**Gate**: `npm run typecheck` / `npm run lint` / `npm run format:check` pass

### Commit 3: Dialog component + barrel export

```
feat(shortcuts): add ShortcutsDialog UI component

- New: src/features/shortcuts/components/ShortcutKeys.tsx (<kbd> 描画 + aria-hidden + separator)
- New: src/features/shortcuts/components/ShortcutsTable.tsx (1 section 分の Table、空配列分岐)
- New: src/features/shortcuts/ShortcutsDialog.tsx (Dialog + Header + ScrollArea + 画面固有空メッセージ)
- New: src/features/shortcuts/index.ts (barrel export)

Refs: docs/function-design/54-ui-shortcuts.md §54.1 / §54.4
```

**Gate**: 同上 + 単独ビルド可能 (RootLayout 配線前なので画面に出ないことを許容)

### Commit 4: RootLayout 接続 + 手動検証

```
feat(layout): mount ShortcutsDialog in RootLayout

- Update: src/components/layout/RootLayout.tsx
  - Add useShortcutsDialog() + <ShortcutsDialog /> mount inside <TooltipProvider>
  - Placement: <Toaster /> と並列、TooltipProvider 直下

Manual verification (Windows native cargo tauri dev):
- Ctrl+/ で Dialog 開く / 再押下で閉じる ✓
- Esc / Overlay クリックで閉じる ✓
- Tab / Shift+Tab で focus 移動 ✓
- 「グローバル」セクションに Ctrl+/ 行 1 件 ✓
- 「このページ」セクションは空メッセージ ✓
- React.StrictMode double mount で listener 重複なし ✓

Refs: docs/function-design/54-ui-shortcuts.md §54.1 / §54.7
```

**Gate**: §検証ステップ 全 pass

---

## 検証ステップ

### Scripts (機械チェック、各 commit 時点)

```bash
npm run typecheck                     # 0 errors
npm run lint                          # 0 errors / 0 warnings
npm run format:check                  # 全 pass
cargo fmt --check                     # 差分なし (Rust 触らないので自明)
cargo clippy --all-targets --all-features -- -D warnings
cargo test                            # PR #56 時点 563 件と同数を維持
./scripts/doc-consistency-check.sh    # 19 項目全 pass
./scripts/doc-consistency-check.sh --target plan docs/plans/2026-05-12-phase-2-ui-shortcuts.md  # プラン 9 項目
```

### Verification (手動検証、Windows native `cargo tauri dev`)

- [ ] Ctrl+/ 押下でダイアログ開く、`<DialogTitle>` "ショートカット一覧" 表示
- [ ] 再度 Ctrl+/ でダイアログ閉じる (トグル動作)
- [ ] Esc キーで閉じる (Radix 標準)
- [ ] オーバーレイクリックで閉じる (Radix 標準)
- [ ] Tab で focus 順次移動、Shift+Tab で逆順 (Radix focus trap、Dialog 外に出ない)
- [ ] 「グローバル」セクションに Ctrl+/ 行 1 件表示
- [ ] 「このページに固有のショートカットはありません」メッセージ表示
- [ ] `<kbd>` 要素のスタイル: shadcn デフォルト風 (背景 muted / 枠線 / モノスペース)、可読性確認
- [ ] React.StrictMode 環境で double mount → keydown listener 重複登録なし
- [ ] DevTools console: aria-labelledby / aria-describedby の Radix warning ゼロ

---

## PR 想定 + Backlog 化

### PR 設計
- ブランチ名: `feat/ui-shortcuts-dialog`
- ベース: `main` (PR #56 + #57 マージ後)
- スコープ: 純フロントエンド、依存追加ゼロ、Tauri 設定変更ゼロ
- PR description に **設計↔実装対応表** 必須 (memory `ui-design-impl-bundled-pr.md`)

### Backlog 化 (Plans.md 第8段階 後続項目)

| ID 提案 | 内容 | 着手フェーズ |
|---|---|---|
| 8-6b | Ctrl+K コマンドパレット | Phase 3 商品検索 UI-01a と同時、cmdk 採用判定 |
| 8-6c | Alt+←/→ ブラウザ的戻る/進む | Phase 2 末 or Phase 3 任意 (`router.history.back/forward` 1 commit) |
| 8-6d | Mac Cmd+/ 対応 | Mac 配布要件確定後 (Phase 5+) — 現状方針では着手なし |
| 各画面 PR 内 | 各画面固有ショートカット定義 | UI-07 / UI-01a / UI-02 等の着手時に SHORTCUTS 追記 |
| 7-7 完了後 retroactive | Vitest unit test (`useShortcutsDialog`、純関数化部分) | Phase 1 残 7-7 Vitest 初期化後 |

---

## Codex レビュー想定リスク

### P1 想定 (ブロッカー)
- **Radix `<DialogTitle>` / `<DialogDescription>` 未設定で console warning**: PR #56 で同種 Tooltip wrapping 問題 (`56852f5`) を踏んだ前科あり。**予防**: commit 3 手動検証で browser DevTools console を必ず確認

### P2 想定 (要対応)
- **React.StrictMode で keydown listener double mount → トグル動作壊れる**: `useEffect` cleanup の不備で発生。**予防**: commit 2 で `useShortcutsDialog.ts` の `useEffect` cleanup 必須実装、React 18+ StrictMode 仕様意識
- **Ctrl+/ が他コンポーネントの keydown handler と衝突**: 現状 listener なし、Phase 3 で UI-02 (バーコードスキャナ) が keypress listen 予定。**予防**: `useShortcutsDialog.ts` 内コメントで「listener は window level / capture phase 不使用 / stopPropagation はしない」衝突回避方針明記
- **`<kbd>` の a11y 不備**: スクリーンリーダがキー組合せを読み上げない問題。**予防**: 行全体の description テキストで意味が伝わる構造を確保 (kbd 要素は visual only と割り切り)
- **IME composition 中の Ctrl+/ 誤発火**: 日本語入力中 (商品名 / 取引先名 / 検索ボックス) で composition イベント発火中の keydown を除外しないと意図せず開閉トグルが走る。本プロジェクトは日本語業務アプリで Phase 3 検索画面で確実に被弾。**予防**: `useShortcutsDialog.ts` の keydown handler 内で `event.isComposing === true || event.keyCode === 229` を最優先で除外、commit 4 手動検証で日本語 IME ON 状態の Ctrl+/ 無効化を確認
- **手動検証環境の取り違え (WSL2 WebKitGTK で済ます誤り)**: Phase 2 から Windows native 移行中 (Plans.md L144) で、本 PR の手動検証は **Windows native WebView2 (Edge Chromium 系)** で必須。WSL2 WebKitGTK では (a) IME インライン入力が未対応 (memory `tauri2-linux-ime-limitation.md`、tauri#11412 OPEN)、(b) document.title が OS タイトルに rebind されない (RootLayout L44 既知)、等の動作差分があり、検証環境の取り違えは Codex で「動作検証不十分」P2 指摘の根拠になる。**予防**: §検証ステップ Verification 冒頭で「Windows native cargo tauri dev で実施」と明示、WSL2 で済ませない

### P3 想定 (drift 系、memory `feedback-codex-drift-fix-grep-all-locations.md` / `feedback-status-sync-pr-keyword-grep-comprehensive.md` 教訓)
- **UI_TECH_STACK §5.2 ショートカット表に「実装済」リンクが反映されていない**: PR #56 で「pending disabled → aria-disabled + Tooltip」一括置換漏れ 5 箇所の被弾あり。**予防**: commit 1 で **拡張 grep** `rg "Ctrl\+/|ショートカット一覧|8-6|shortcut" docs/ Plans.md CLAUDE.md AGENTS.md README.md 2>/dev/null` で全箇所機械検出 (存在しないファイルは no match で安全) → 全件更新済確認
- **`docs/function-design/53-ui-home.md §53.7 / §53.9` の「8-6 で実装予定」記述が残る**: 同種 drift。**予防**: 同上拡張 grep + 更新
- **`docs/DEV_SETUP_CHECKLIST.md §13.3 L407 周辺` の 8-6 entry 記述が古いまま** (Round 1 critique 観点 5 で実検索ヒット): 「UI-00 マージ後の別 PR で単独実装」記述が「PR #XX で実装完了」状態に書き換わっていない drift。**予防**: 既存変更表で明示的に追加済、commit 1 で同時更新
- **Plans.md L19 / L107 の `[ ]` を PR open 時に `[x]` に更新してしまう**: PR #56 では merge 後に更新する慣例。**予防**: PR open 時は `[ ]` のまま、merge 後別 commit で更新

### P4 想定 (過剰スコープ指摘)
- なし: 全 YAGNI 整合案で `useIsMac` / `screenScope` / 予告フラグを撤去済

---

## Self-Review (7 観点、memory `plan-self-review-before-implementation.md` / hook `check-plan-on-exit.sh` 準拠)

### 1. Prerequisites (前提条件)
本 PR は PR #56 (UI-00 ホーム画面) のマージ完了が前提条件で、Plans.md L17 に squash merge commit `e6da3d8` (2026-05-09) が記録済 → 着手条件は満たされている。加えて Q-3 採用結果 ([docs/archive/plans/2026-05-09-phase-2-ui-00.md](2026-05-09-phase-2-ui-00.md) 該当節) で「UI-00 後の別 PR で単独実装」が確定済み、設計レベルでの blocker なし。Tauri 環境は Phase 2 から Windows native 移行中 (Plans.md L144 Backlog)、本 PR の手動検証は **Windows native** で実施する (Linux IME 制約 memory `tauri2-linux-ime-limitation.md` は本 PR ではキー入力のみで日本語入力なしのため影響薄いが、Phase 2 慣例維持)。ブランチは `main` HEAD `84741b5` 起点で `feat/ui-shortcuts-dialog` を切る。実装着手前に Critical Files §の 8 ファイルを読了する想定。

### 2. Scripts (機械チェック)
pre-push hook (`scripts/pre-push.sh`) が ① `cargo fmt --check` + `cargo clippy -- -D warnings` + `cargo test` ② `./scripts/doc-consistency-check.sh` 19 項目 ③ `./scripts/check-typedinvoke-count.sh` baseline ④ `./scripts/check-env-safety.sh` を順次実行 ([DEV_SETUP_CHECKLIST §3.2](../../DEV_SETUP_CHECKLIST.md))。本 PR は Rust 触らないので ① の cargo 系は差分ゼロ確認のみ、③ は specta 化なしなので baseline 維持、④ は env ファイル変更なしで pass 想定。フロント側は lefthook pre-commit で eslint --fix + prettier --write が staged ファイルに自動適用される。CI frontend ジョブで `npm run typecheck / lint / format:check / build` が走る。プラン整合は `./scripts/doc-consistency-check.sh --target plan docs/plans/2026-05-12-phase-2-ui-shortcuts.md` で 9 項目を別途確認、ExitPlanMode hook (`check-plan-on-exit.sh`) で Self-Review 内容深さ + Plan rally 痕跡が検証される。

### 3. Verification (検証)
機械チェックで担保できない部分を Windows native `cargo tauri dev` での手動検証で潰す。検証項目は §検証ステップ Verification の 10 項目で、特に **(a) React.StrictMode double mount での listener 重複なし**、**(b) DevTools console での Radix aria-* warning ゼロ**、**(c) Tab focus trap の Dialog 外脱出なし** の 3 点を最重点で確認する。これらは Codex P1 / P2 で頻発するパターン (PR #56 で Tooltip wrapping 問題 `56852f5` を踏んだ前科)、commit 3-4 の境界で必ず手動検証する。memory `feedback-radix-tooltip-aria-disabled.md` の learning (HTML 標準と Radix の相互作用の罠) を意識、Dialog 自体は disabled 属性とは無関係なので直接的な再発リスクは低いが、`<DialogContent>` の showCloseButton で生成される右上 × ボタンの focus 順序は確認しておく。

### 4. Post-processing (PR open 後)
PR description に **設計↔実装対応表** (memory `ui-design-impl-bundled-pr.md`) を必須記載: 例えば `§54.7 キーボード処理仕様 ↔ src/features/shortcuts/hooks/useShortcutsDialog.ts L20-40`。`gh pr create` 後に Codex 用レビュー依頼テキストを生成しユーザに渡す。Codex Round 1-3 まで P1/P2 = 0 を確認、Round 内 close 達成 (memory `codex-non-blocker-incorporation.md` 適用: P3/P4 は same-PR 軽量対応で同 round 内潰す)。squash merge 後に **(a)** Plans.md L19 / L107 の `[ ]` → `[x]` 更新 + 8-7 を直近候補に繰り上げ、**(b)** `docs/archive/plans/2026-05-12-phase-2-ui-shortcuts.md` へ git mv で archive (memory `feedback-archive-relative-path-conversion.md` で archive 内相対パス変換漏れに注意、`docs/plans/...` → `docs/archive/plans/...` の階層変化で `../` の数が変わる)、**(c)** 本プラン archive 内の link 全件 R3 pass 確認、**(d)** リモート + ローカル ブランチ削除。

### 5. Constraints (制約遵守)
本 PR は純フロントエンド + 純 docs 同期で、(1) バックエンド `src-tauri/**` 変更ゼロ、(2) Tauri 設定 (`tauri.conf.json` / capabilities) 変更ゼロ、(3) `package.json` 依存追加ゼロ (react-hotkeys-hook / cmdk / @radix-ui/react-command など一切不採用)、(4) `src/lib/bindings.ts` 再生成ゼロ (specta 化対象 command なし)、(5) `eslint.config.js` 規約変更ゼロ、(6) Zustand 導入ゼロ (UI_TECH_STACK §2.6 維持) の 6 つを全て守る。レイヤー原則 ([CLAUDE.md](../../../CLAUDE.md) コード設計・レイヤー原則 / [ARCHITECTURE.md](../../ARCHITECTURE.md) §1) は UI 層内で閉じるので影響なし。ドキュメント禁止事項 ([DOC_STYLE_GUIDE.md](../../DOC_STYLE_GUIDE.md) §5 列挙参照) の曖昧表現群と未確定マーカー群を `54-ui-shortcuts.md` 本文に残さない、コードブロック / テーブル内除外規則は適用可。doc-consistency-check.sh の M1 / M3 がコードブロック外の文字列マッチで本文に検出すれば fail なので、列挙そのものを本プラン本文に inline 展開せず外部参照に倒す。

### 6. Commit Split (commit 分割の妥当性)
4 commit (1 docs / 2 core / 3 component / 4 wiring) は全て **単独でビルド可能 + lint pass** を保つ設計。commit 1 は実装ゼロでも `54-ui-shortcuts.md` 内の参照ファイルパス (`src/features/shortcuts/...`) が **実装着手前**だと R1 (`scripts/doc-consistency-check.sh` の docs/ パス参照実在チェック) を fail する懸念があるが、本プロジェクトの R1 は **コード内の docs/ パス参照**を対象とするため逆方向 (docs → src) は対象外で pass する想定 ([DOC_STYLE_GUIDE.md §6 R0/R1/R3 定義](../../DOC_STYLE_GUIDE.md) 確認済)。commit 2-3 でコンポーネントが孤立 (RootLayout 未配線) するのは「ビルド可能だが画面に出ない」状態で許容、commit 4 で接続。Codex review は squash merge 前提なので、PR description で 4 commit の意図を section 別に説明する。

### 7. Other (その他)
**memory 反映予定**: 本 PR で新規 learning が出たら `.claude/memory/` (project-specific) または auto-memory に追記。想定する追加観測: (1) 「グローバル keydown listener は RootLayout (Provider 層) に置くと React.StrictMode の double mount で cleanup 動作確認できる」、(2) 「YAGNI 観点で `useIsMac` を撤去した結果、Mac Cmd+/ 描画分岐は Mac 配布要件確定後の別 PR で `data.ts` に `macKeys?` 追加 + ShortcutKeys 描画分岐の 2 箇所だけで導入できる、本 PR の設計は将来拡張に対して open / 現在に対して minimal」。**Plan rally**: ExitPlanMode 前に `/plan-rally` skill (memory `feedback-plan-rally-required-before-exit.md`) で Plan agent ラリーを 1 round 回す予定。本プランで懸念される drift (PR #56 で 7 段ラリーで E-1+E-2 hook bug 発見した前例) を予防、新規指摘 0 で converge したらユーザに ExitPlanMode を提示する。

---

## 関連参照

- 親 SSOT: [Plans.md](../../../Plans.md) L19 / L107 / L150 (typedInvoke 撤去期限) / L151 (specta 化対象リスト)
- Q-3 採用: [docs/archive/plans/2026-05-09-phase-2-ui-00.md](2026-05-09-phase-2-ui-00.md)
- 設計 SSOT: [docs/UI_TECH_STACK.md §5.2](../../UI_TECH_STACK.md) / [docs/architecture/ui-task-specs.md](../../architecture/ui-task-specs.md)
- テンプレ準拠: [docs/DOC_STYLE_GUIDE.md §2 / §5 / §6](../../DOC_STYLE_GUIDE.md)
- 先例 PR: PR #50 (private archive) UI-12 共通レイアウト / PR #56 (private archive) UI-00 ホーム画面
- 適用 memory: `ui-design-impl-bundled-pr.md` / `frontend-function-design-granularity.md` / `feedback-codex-drift-fix-grep-all-locations.md` / `feedback-active-plan-in-docs.md` / `plan-self-review-before-implementation.md` / `feedback-plan-rally-required-before-exit.md` / `codex-non-blocker-incorporation.md`
