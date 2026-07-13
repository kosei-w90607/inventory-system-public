> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: ARCHITECTURE.md（タスク仕様）、[ui-task-specs.md §UI-shortcuts](../architecture/ui-task-specs.md)（タスク要求）、[UI_TECH_STACK.md §5.2](../UI_TECH_STACK.md)（ショートカット仕様 SSOT）、[2026-05-12-phase-2-ui-shortcuts.md](../archive/plans/2026-05-12-phase-2-ui-shortcuts.md)（実装プラン、本書の判断根拠）

## 54. UI-shortcuts: ショートカット一覧ダイアログ

### 本書のテンプレ判定（業務ロジックあり版、共通 6 項目）

UI 層関数設計書の 2 段階テンプレ（業務ロジック有無で使い分け、`memory/frontend-function-design-granularity.md`）に従い、UI-shortcuts は**業務ロジックあり版**と判定する。

**判定根拠**:

- CMD 呼び出し: 0 件（純フロントエンド、IO / CMD / BIZ 層触らない、Tauri ネイティブ API も使わない）
- 入力バリデーション: なし（キー入力検知のみ、フォーム無し）
- 画面内部 state 駆動のフロー分岐: あり（open state トグル + Ctrl+/ keydown 判定 + input/textarea/contenteditable focus 除外 + IME composition 除外 + Esc 閉じる Radix 委譲）

→ **業務ロジックあり版**（state 駆動分岐が判定要因）。共通 6 項目（コンポーネント構成 / React State / 外部依存 / 利用者操作フロー / エラー表示 / ローディング表示）+ キーボード処理仕様 / 備考 / 非目的 + 更新履歴の 10 章構成。

| 種別 | 該当 UI |
|---|---|
| 業務ロジックあり版 | UI-00 / UI-shortcuts（本書）/ UI-01a/b/c / UI-02〜10 / UI-13 |
| 業務ロジックなし版 | UI-12（[52-ui-shared-layout.md](52-ui-shared-layout.md)） |

UI-00 ([53-ui-home.md](53-ui-home.md)) が「業務ロジックあり版 + CMD 呼び出しあり (4 useQuery)」の初適用例だったのに対し、本書は「業務ロジックあり版 + CMD 呼び出し 0 件 (state 駆動分岐のみ)」のパターン初適用例。§54.3 を 1 行で済ませる代わりに §54.7 キーボード処理仕様で純フロントエンドの細部を詰める。

---

### 54.1 コンポーネント構成

| ファイル | 責務 |
|---|---|
| `src/features/shortcuts/types.ts` | `Shortcut` / `ShortcutCategory` 型定義 |
| `src/features/shortcuts/data.ts` | `SHORTCUTS` 定数（1 件、`as const`）。SSOT。各画面 PR でこの配列に追記して拡張 |
| `src/features/shortcuts/hooks/useShortcutsDialog.ts` | `useState<boolean>` + `useEffect` で global keydown listen + IME 除外 + input 除外 + `preventDefault` + cleanup |
| `src/features/shortcuts/components/ShortcutKeys.tsx` | `keys: readonly string[]` → `<kbd>Ctrl</kbd>+<kbd>/</kbd>` 描画。`+` は `aria-hidden` |
| `src/features/shortcuts/components/ShortcutsTable.tsx` | 1 section 分の `<table>`（shadcn `<Table>` 流用）。tr × N、td (kbd) + td (description)。空配列時は `<p>` で「現在のページに固有のショートカットはありません」表示 |
| `src/features/shortcuts/ShortcutsDialog.tsx` | Dialog + DialogContent + DialogHeader (Title + Description) + ScrollArea + 「グローバル」/「このページ」2 section + Footer。`useShortcutsDialog` を直接呼ばず、props で `open` / `onOpenChange` を受け取る純表示コンポーネント |
| `src/features/shortcuts/index.ts` | barrel export (`ShortcutsDialog`, `useShortcutsDialog`) |

**接続点**:

- `src/components/layout/RootLayout.tsx` 内で `useShortcutsDialog()` を呼び、戻り値の `open` / `setOpen` を `<ShortcutsDialog open={open} onOpenChange={setOpen} />` に渡す
- マウント位置は `<TooltipProvider>` 直下、`<Toaster />` と並列（Provider 層に共在）
- Provider 層に置く理由: global keydown listener が React.StrictMode の double mount でも 1 度だけ cleanup 動作することを確認できる + Radix Dialog は Portal で DOM 末尾に注入されるため Sidebar / Main の grid layout に影響しない
- hook と Dialog コンポーネントの呼び分け分離: hook は state + listener、Dialog は純表示。テスト容易性のため (Phase 1 7-7 Vitest 着手後、Dialog 単独の rendering test と hook 単独の state transition test を分離可能)

---

### 54.2 React State

UI-shortcuts は `useShortcutsDialog` 内部の `useState<boolean>(false)` のみ。Zustand 等のグローバル state は使わない（UI_TECH_STACK §2.6 維持）。

#### `useShortcutsDialog` の戻り値

```ts
function useShortcutsDialog(): { open: boolean; setOpen: (v: boolean) => void }
```

| キー | 型 | 用途 |
|---|---|---|
| `open` | `boolean` | Dialog の表示状態 |
| `setOpen` | `(v: boolean) => void` | Dialog 外部からの開閉制御。Radix Dialog の `onOpenChange` 引数として渡し、Esc / オーバーレイクリック / × ボタンからの閉じる動作を吸収する |

#### 派生値（`ShortcutsDialog` 内で計算）

| 派生値 | 計算 | 計算箇所 |
|---|---|---|
| `globalShortcuts` | `SHORTCUTS.filter(s => s.category === "global")` | `ShortcutsDialog.tsx` 内、render 時に直接計算（純配列フィルタ、`useMemo` 不要） |
| `screenShortcuts` | `SHORTCUTS.filter(s => s.category === "screen")` | 同上 |

`SHORTCUTS` は本 PR では 1 件のみ、各画面 PR で追記しても 20-30 件規模に収束する想定。`useMemo` のオーバーヘッドが派生コストを上回るため、`filter` 直書きで足りる。

#### state を `useShortcutsDialog` 内に閉じ込める根拠

global keydown listener と open state を同じ hook 内で管理することで、RootLayout 側の責務を「Provider mount + hook 呼び出し + Dialog mount」の 3 行に留めることができる。Dialog の `open` / `onOpenChange` props 経路は Radix 標準パターンを踏襲する。

---

### 54.3 外部依存（CMD / Tauri API）

該当なし。本機能は純フロントエンドで、IO / CMD / BIZ 層に触らない。Tauri ネイティブ API も使わない（`getCurrentWindow().setTitle()` 等の併用は不要、Dialog の DOM 操作のみで完結する）。

本書の §54.5 / §54.6 が「該当なし」で済む根拠もここに帰着する。CMD 呼び出しがないため CMD エラー経路は存在せず、非同期ロードがないため Skeleton も不要。

---

### 54.4 利用者操作フロー

[ui-task-specs.md §UI-shortcuts](../architecture/ui-task-specs.md) の業務的概要は本書で重複させず、実装詳細寄りに限定する（`memory/frontend-function-design-granularity.md` 規定）。

**起動 / ホーム復帰時**:

1. `<RootLayout />` mount → `useShortcutsDialog()` で `open=false` 初期 state + global keydown listener 登録
2. Dialog は `open=false` で DOM 上は Portal 内に未挿入

**Ctrl+/ 押下（Dialog 閉時）**:

3. listener が keydown を受け取る → IME 除外 → input 除外 → Modifier 判定（`ctrlKey && key === "/"`）が true なら `event.preventDefault()` + `setOpen(true)`
4. Radix Dialog が Portal に DialogOverlay + DialogContent をマウント、最初の focusable 要素（× ボタン or DialogTitle 自身、Radix の自動判定）に focus 移動
5. `<DialogTitle>` "ショートカット一覧" + `<DialogDescription>` "押せるキー組合せの一覧" 表示
6. 「グローバル」section に Ctrl+/ 行 1 件 + 「このページ」section に「現在のページに固有のショートカットはありません」メッセージ表示

**Dialog 開時の追加操作**:

7. **Ctrl+/ 再押下** → listener が同じ判定経路を通り `setOpen(false)` → Radix Dialog が Portal から unmount（トグル動作）
8. **Esc 押下** → Radix Dialog 標準で `onOpenChange(false)` → `setOpen(false)` → 閉じる
9. **オーバーレイクリック** → 同上経路で閉じる
10. **右上 × ボタンクリック** → `<DialogContent showCloseButton={true}>` 既定で挿入される閉じるボタン（`src/components/ui/dialog.tsx` L62-69）→ 閉じる
11. **Tab / Shift+Tab** → Radix focus trap で Dialog 内を順次 / 逆順移動、Dialog 外には脱出しない

**除外パターン（§54.7 詳細）**:

12. input / textarea / contenteditable focus 中の Ctrl+/ → handler 内で `event.target` 判定して無視（フォーム入力中の誤発火防止、Phase 3 検索画面で被弾予防）
13. IME composition 中の Ctrl+/ → `event.isComposing === true || event.keyCode === 229` で除外（日本語入力中の誤発火防止）

---

### 54.5 エラー表示

該当なし。本機能はネットワーク / DB アクセスを行わないため、CMD エラー経由のエラー表示は発生しない。Sonner Toast の発火経路もない。

`SHORTCUTS.length === 0` のエッジケースは本 PR では発生しない（global.show-shortcuts の 1 件常時存在）が、`ShortcutsTable` の空配列分岐で「現在のページに固有のショートカットはありません」を返す設計を入れて将来の各画面追加時に備える（§54.1 / §54.4 ステップ 6）。

---

### 54.6 ローディング表示

該当なし。`SHORTCUTS` は静的 const 配列で、非同期ロードを伴わない。shadcn `<Skeleton>` も `<Spinner>` も使わない。

---

### 54.7 キーボード処理仕様

`useShortcutsDialog` の `useEffect` 内で `window.addEventListener("keydown", handler)` を登録し、cleanup で `removeEventListener` する。React.StrictMode の double mount でも cleanup が機能する標準パターン（`src/features/home/hooks/useYesterdayDate.ts` の Visibility listener 規範に沿う）。

```ts
useEffect(() => {
  const handler = (event: KeyboardEvent) => {
    // §54.7 除外条件（優先順位）に従う
    // 1. IME composition 中 → 除外
    if (event.isComposing || event.keyCode === 229) return;
    // 2. input / textarea / contenteditable focus 中 → 除外
    if (isEditableTarget(event.target)) return;
    // 3. Ctrl+/ 以外 → スキップ
    if (!event.ctrlKey || event.key !== "/") return;

    event.preventDefault();
    // 4. 長押し連続発火 → preventDefault は毎回呼ぶが toggle は 1 keypress 1 回に限定
    if (event.repeat) return;
    setOpen((prev) => !prev);
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

#### Modifier キー検出

- `event.ctrlKey === true && event.key === "/"` で Ctrl+/ を検知
- Mac の Cmd+/（`event.metaKey`）は本 PR では非対応（Windows 専用配布方針、CLAUDE.md / [DEV_SETUP_CHECKLIST §1.4](../DEV_SETUP_CHECKLIST.md)）。将来 Mac 配布要件確定時に `data.ts` に `macKeys?: readonly string[]` 追加 + `ShortcutKeys` 描画分岐の 2 箇所拡張で導入可能

#### 除外条件（優先順位）

handler 内で以下を順に評価し、いずれかが true の場合は何もせず return する:

1. **IME composition 中** — `event.isComposing === true || event.keyCode === 229`。日本語入力中（商品名 / 取引先名 / 検索ボックス等）の Ctrl+/ 誤発火を防止。`memory/feedback-ime-composition-keydown-exclusion.md` で「日本語業務アプリの global keydown は本条件を最優先除外」と規定されており、Phase 3 検索画面（UI-01a / UI-06a）以降で確実に被弾するため本 PR で先回り対応。`memory/tauri2-linux-ime-limitation.md` の IME 制約教訓と整合
2. **input / textarea / contenteditable focus 中** — `event.target instanceof HTMLInputElement` / `HTMLTextAreaElement` / `[contenteditable="true"]` のいずれかなら除外。Phase 3 以降の検索フォーム / 数量入力フォームで問題化する想定、本 PR で先回り。判定は純関数 `isEditableTarget(target: EventTarget | null): boolean` に切り出し可（Phase 1 7-7 Vitest 着手後に unit test 追加可能）
3. **Ctrl+/ 以外** — `event.ctrlKey !== true || event.key !== "/"` ならスキップ

#### preventDefault / stopPropagation の方針

- `event.preventDefault()` を呼ぶ — ブラウザ既定キーバインド（Firefox の Quick Find 等）との衝突抑止
- `event.stopPropagation()` は呼ばない — Phase 3 で UI-02 入庫記録画面のバーコードスキャナが keypress listen する予定で、他 listener との衝突を起こさない方針（バーコードは数字 + Enter 入力で Ctrl+/ と衝突しないため実害なし、念のため propagation は止めない）

#### 長押し連続発火の抑止（`event.repeat`）

- `event.preventDefault()` を呼んだ**後**に `event.repeat === true` なら早期 return する。順序は `preventDefault()` → `if (event.repeat) return;` → `setOpen(...)` で固定
- 根拠: `Ctrl+/` を長押しすると OS の key repeat により listener が秒間数十回発火し、`setOpen((prev) => !prev)` の連続呼び出しでダイアログ開閉が暴れて最終状態が不定になる。`preventDefault()` は毎回呼ぶことで既定キーバインド抑止を長押し中も継続させつつ、toggle 自体は 1 keypress 1 回に限定する
- 除外条件 3 (Ctrl+/ 以外) の判定を通り抜けた後に置く理由: Ctrl+/ 以外のキー repeat には preventDefault を効かせたくないため、Ctrl+/ 判定後の preventDefault と組み合わせる

#### Listener の登録階層

- `window` レベルで listen（document でも capture phase でもない）。bubble phase の default behavior で十分。capture phase を使うと Radix 内部の Dialog 自身の focus trap や Esc handler との順序関係が複雑化するため避ける

---

### 54.8 備考

- **拡張点**: 各画面 PR で `data.ts` の `SHORTCUTS` 配列に追記するだけで一覧に出る。`Shortcut` 型は本 PR では `category: "global" | "screen"` のみ持つが、画面固有 shortcut の絞り込みが必要になった時点で `screenScope?: readonly string[]` 追加（routes のパス一致で出し分け）を 1 行で拡張可能
- **Ctrl+K / Alt+←/→ は本 PR スコープ外** — `data.ts` に追加しない。Backlog として `8-6b`（Ctrl+K コマンドパレット、Phase 3 UI-01a と同時、cmdk 採用判定）/ `8-6c`（Alt+←/→ ブラウザ的戻る / 進む、`router.history.back/forward` 1 commit）に切り出し
- **a11y は Radix 標準で大半カバー** — Focus trap / Esc 閉じる / `aria-modal` / 最初の focusable へ focus / オーバーレイクリック閉じる。追加実装は `<DialogTitle>` `<DialogDescription>` 必須描画（aria-labelledby / aria-describedby 用、未設定で console warning）+ `<kbd>` スタイル + IME 除外 + input 除外 + `preventDefault` の 6 点（プラン §設計判断 E）
- **`<kbd>` 要素の a11y** — スクリーンリーダはキー組合せそのものを読み上げないことが多い。行全体の description テキスト（例: "ショートカット一覧を表示 / 閉じる"）で意味が伝わる構造を確保し、kbd 要素は visual hint と割り切る
- **UI_TECH_STACK §5.2 との整合性** — ショートカット仕様の SSOT は UI_TECH_STACK §5.2、本書はその実装側 SSOT。仕様変更（新規グローバルキー追加等）は §5.2 を先に更新し、本書および `data.ts` で実装に落とす
- **デスクトップ前提** — `memory/desktop-app-ui-constraints.md` 準拠（レスポンシブ非対象、hover 許容、URL 内部識別子）

---

### 54.9 非目的

| やらないこと | 理由 | 責務を持つモジュール |
|---|---|---|
| Ctrl+K コマンドパレット | 検索遷移先未整備 + cmdk 採用判定待ち | Backlog 8-6b（Phase 3 UI-01a 商品検索と同時） |
| Alt+←/→ ブラウザ的戻る / 進む | スコープ分離 | Backlog 8-6c（`router.history.back/forward` 1 commit） |
| 画面固有 shortcut の中身 | 現状 UI-00 で確定済みの画面固有キーなし、Tab / Enter / Esc は Radix 標準 | 各画面 PR（UI-07 / UI-01a / UI-02 等）で `SHORTCUTS` に追記 |
| Mac Cmd+/ 描画分岐 | Windows 専用配布方針（CLAUDE.md / [DEV_SETUP_CHECKLIST §1.4](../DEV_SETUP_CHECKLIST.md)）で死にコードになる | Backlog 8-6d（Mac 配布要件確定後 Phase 5+） |
| `useIsMac` hook | 同上、現状用途なし | 同上 |
| `Shortcut.screenScope` 型追加 | 最初の画面固有 shortcut 追加時に 1 行拡張で済む、本 PR では category 軸のみで足りる | 各画面 PR で必要になった時点で追加 |
| Vitest unit test（`useShortcutsDialog` / `isEditableTarget` 純関数化部分） | Phase 1 7-7 Vitest 初期化が未着手のため、本 PR では無し | Phase 1 7-7 → 後続 PR で retroactive 追加 |
| Ctrl+S 保存ショートカット | UI_TECH_STACK §5.2 で「明示ボタンのため誤爆リスク大」と確定（採用しない） | プロジェクトスコープ外 |

---

### 更新履歴

| 日付 | PR | 内容 |
|---|---|---|
| 2026-05-12 | 8-6 UI-shortcuts（本 PR commit 1） | 新規作成。実装プラン [2026-05-12-phase-2-ui-shortcuts.md](../archive/plans/2026-05-12-phase-2-ui-shortcuts.md) §設計判断 A-G + §関数設計書の章立て案 を関数設計書形式（業務ロジックあり版テンプレ、CMD 呼び出し 0 件 + state 駆動分岐パターンの初適用）で転記 |
