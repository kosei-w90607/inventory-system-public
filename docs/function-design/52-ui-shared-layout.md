> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: ARCHITECTURE.md（タスク仕様）、[ui-12-design-agreement.md](../archive/plans/2026-04-21-ui-12-design-agreement.md)（設計合意書、本書の判断根拠）

## 52. UI-12: 共通レイアウト

### 本書のテンプレ判定（UI 層関数設計書の 2 段階）

UI 層の関数設計書は業務ロジック有無で 2 段階のテンプレを使い分ける:

| 種別 | 判定基準 | 該当 UI | テンプレ |
|---|---|---|---|
| 業務ロジックあり | CMD 呼び出し / 入力バリデーション / 画面内部 state 駆動のフロー分岐 のいずれかを持つ | UI-00, UI-01a/b/c, UI-02〜10, UI-13 | 共通 6 項目（コンポーネント構成 / React State / CMD 呼び出し / 利用者操作フロー / エラー表示 / ローディング表示）+ 必要時バリデーション・処理ステップ |
| 業務ロジックなし（純構造） | 上記いずれも持たない（**ルーター主導の副作用は除外**） | UI-12 共通レイアウト | 主要 3 項目（コンポーネント構成 / React State / 備考）+ 特殊振る舞いだけ業務ロジックあり形式で独立節を切る |

**UI-12 の判定根拠**:

- CMD 呼び出し: なし
- 入力バリデーション: なし（入力受付なし）
- 画面内部 state 駆動のフロー分岐: なし（例外: 2026-06-07 follow-up で追加した表示サイズ state は UI 表示設定であり、業務データや CMD 呼び出しとは結合しない）
- ウィンドウタイトル動的更新機構（§52.5）はルーター主導の副作用 = 業務ロジック判定外。表示サイズ機構は WebView 表示設定の副作用として §52.6 備考に記録する

→ **業務ロジックなし** と判定。主要 3 項目で記述し、ウィンドウタイトル機構だけ §52.5 で業務ロジックあり形式の独立節として詳細化する。

---

### 52.1 コンポーネント構成

| ファイル | 責務 |
|---|---|
| `src/config/navigation.ts` | NavStatus / NavItem / NavArea 型定義 + navigation 定数（4 エリア × 19 項目）。アイコンは lucide-react を import |
| `src/components/layout/RootLayout.tsx` | 2 カラム grid + Outlet + Toaster + Devtools + ウィンドウタイトル更新 useEffect（§52.5） |
| `src/components/layout/Sidebar.tsx` | aside + SidebarHeader + min-h-0 ScrollArea + 4 エリアの map（SidebarArea を呼ぶ） + DisplayScaleControl |
| `src/components/layout/SidebarArea.tsx` | 1 エリア描画。h2 + アイコン + SidebarLink × N + Separator |
| `src/components/layout/SidebarLink.tsx` | active/pending status 分岐。active=`<Link>` + `activeOptions={{ exact: true, includeSearch: false }}`（search params 付き URL でも path 一致のみで active 判定、TanStack デフォルト `includeSearch:true` は search 完全一致を要求し active が外れる）+ shared stone selection tone、pending=`<span role="link" aria-disabled="true" tabIndex={-1}>` + sr-only "（未実装）"、cursor-not-allowed + opacity-60 |
| `src/components/layout/SidebarHeader.tsx` | 店名ロゴ + `<Link to="/">` + 末尾 Separator |
| `src/components/layout/DisplayScaleControl.tsx` | Sidebar footer の表示サイズ Select（標準 / 大きめ / 特大） |
| `src/components/layout/useDisplayScale.ts` | `localStorage` token 読み書き + Tauri WebView zoom 適用 |
| `src/lib/display-scale.ts` | `DisplayScaleValue` / storage key / zoom factor の SSOT |

**接続点**:

- `src/routes/__root.tsx` で `<RootLayout>` を mount。既存の暫定レイアウトを差し替え
- `notFoundComponent` から `min-h-screen` を削除（RootLayout の `h-screen` 枠内で 404 描画、サイドバーから戻れる 404 = Nielsen #3 整合）

---

### 52.2 React State

UI-12 は業務データの内部 state を持たない（純構造コンポーネント）。

唯一の例外として、ウィンドウタイトル機構（§52.5）が `useRouterState({ select: (s) => s.location.pathname })` で取得する pathname を派生値として読むが、これは TanStack Router 由来の参照値であり UI-12 内部 state ではない（Phase 2 で route `head()` 機能を導入する際は `useMatches()` 経由の最深 `match.head?.title` 参照に切り替える、詳細は §52.5）。

SidebarLink の active 判定も TanStack Router の `<Link activeProps>` で表現する（router 内部 state を読むのみ、UI-12 で state 管理しない）。

2026-06-07 follow-up で追加した表示サイズ機構だけは UI 表示設定として `DisplayScaleValue = "standard" | "large" | "extra_large"` を React state で保持する。初期値は `localStorage["inventory.displayScale.v1"]` から読み、未知値は `"standard"` に fallback する。state 変更時に同 key へ保存し、`getCurrentWebview().setZoom(1 | 1.15 | 1.3)` で WebView zoom に反映する。Tauri 呼び出し失敗は `console.warn` のみで握り、画面描画は継続する。

---

### 52.3 ルーティング定義

全画面対応表（19 ナビ表示 + 2 ナビ非表示 = 21 route）。設計合意書 §2.1 を転記。

| UI-ID | 画面名 | URL パス | route ファイル | サイドバー4エリア | ナビ表示 | 備考 |
|---|---|---|---|---|---|---|
| UI-00 | ホーム | `/` | `src/routes/index.tsx` | 毎日の業務 | ○ | 現 demo (search_products)、Phase 2 (8-1) で置換 |
| UI-07 | CSV取込み | `/pos/csv-import` | `src/routes/pos/csv-import.tsx` | 毎日の業務 | ○ | URL ドメインは POS、サイドバー配置は心理モデル優先 |
| UI-09a | 日次売上 | `/reports/daily` | `src/routes/reports/daily.tsx` | 毎日の業務 | ○ | 日次/月次は別 route（合意書 §7.3） |
| UI-06a | 在庫照会 | `/stock` | `src/routes/stock/index.tsx` | 毎日の業務 | ○ | REQ-301/302/303 統合画面 |
| UI-09b | 月次売上 | `/reports/monthly` | `src/routes/reports/monthly.tsx` | 毎日の業務 | ○ | |
| UI-01a | 商品検索・一覧 | `/products` | `src/routes/products/index.tsx` | 商品管理 | ○ | 商品管理の起点 |
| UI-01b (新規) | 商品登録 | `/products/new` | `src/routes/products/new.tsx` | 商品管理 | ○ | |
| UI-01b (編集) | 商品修正 | `/products/$code/edit` | `src/routes/products/$code.edit.tsx` | （ナビ非表示） | — | 一覧 or 在庫照会詳細から遷移 |
| UI-01c | 一括インポート | `/products/import` | `src/routes/products/import.tsx` | 商品管理 | ○ | |
| UI-08 | PLU書出し | `/pos/plu-export` | `src/routes/pos/plu-export.tsx` | 商品管理 | ○ | URL は POS、サイドバーは商品管理（合意書 §7.7） |
| UI-02 | 入庫記録 | `/inventory/receiving` | `src/routes/inventory/receiving.tsx` | 入出庫 | ○ | |
| UI-03 | 返品・交換 | `/inventory/return` | `src/routes/inventory/return.tsx` | 入出庫 | ○ | |
| UI-04 | 手動販売出庫 | `/inventory/manual-sale` | `src/routes/inventory/manual-sale.tsx` | 入出庫 | ○ | |
| UI-05 | 廃棄・破損 | `/inventory/disposal` | `src/routes/inventory/disposal.tsx` | 入出庫 | ○ | |
| UI-02b〜05b | 入出庫履歴 | `/inventory/records` | `src/routes/inventory/records.tsx` | 入出庫 | ○ | 入庫/返品・交換/手動販売/廃棄・破損/CSV取込み/棚卸しの追跡入口 |
| UI-06b | 在庫少一覧 | `/stock/low` | `src/routes/stock/low.tsx` | 入出庫 | ○ | 在庫照会フィルタチップからも到達可（合意書 §7.6） |
| UI-10 | 棚卸し | `/stocktake` | `src/routes/stocktake/index.tsx` | 入出庫 | ○ | 入出庫エリア末尾配置（年次作業、合意書 §7.4） |
| UI-06c | 在庫変動履歴 | `/stock/$code/movements` | `src/routes/stock/$code.movements.tsx` | （ナビ非表示） | — | $code 必須、商品詳細カードから遷移 |
| UI-11b | バックアップ・復元 | `/settings/backup` | `src/routes/settings/backup.tsx` | システム管理 | ○ | |
| UI-11c | 操作ログ | `/settings/logs` | `src/routes/settings/logs.tsx` | システム管理 | ○ | |
| UI-11a | 閾値設定 | `/settings/thresholds` | `src/routes/settings/thresholds.tsx` | システム管理 | ○ | |
| UI-13 | 整合性検証 | `/settings/integrity` | `src/routes/settings/integrity.tsx` | システム管理 | ○ | BIZ-07 連携、システム管理側に配置（合意書 §7.5） |

**ナビに出さない route（動線は親画面から）**:

- `/products/$code/edit` ← `/products`（一覧）or `/stock`（詳細カード）から
- `/stock/$code/movements` ← `/stock` 詳細カードから

**URL 設計の根拠**: 機能ドメインベース階層（`/pos/*`、`/inventory/*`、`/reports/*`、`/stock/*`、`/settings/*`）。4 エリア分類（使用頻度）と機能ドメインが 1:1 でないため、**URL = 機能ドメイン** + **サイドバー = 使用頻度 4 エリア** で分離している。詳細は設計合意書 §2.3。

**Phase 1 (UI-12) で作るのは `__root.tsx` の差し替えのみ**。上記 route ファイルはすべて Phase 2 以降で各画面着手時に追加する。

---

### 52.4 navigation 定数と型定義

#### 型定義

```ts
import type { LucideIcon } from "lucide-react";

export type NavStatus = "active" | "pending";

export type NavItem = {
  id: string;            // "ui-01a" 等
  label: string;         // サイドバー表示用
  title: string;         // ウィンドウタイトル用（§52.5）。通常 label と同一、将来分離可
  to: string | null;     // Phase 1 は `/` のみ実 path、他 18 項目は null
  icon: LucideIcon;
  status: NavStatus;
};

export type NavArea = {
  id: "daily" | "products" | "inventory" | "system";
  label: string;
  icon: LucideIcon;
  items: readonly NavItem[];
};

export const navigation: readonly NavArea[] = [...] as const;
```

#### 4 エリア × 19 項目

| エリア | エリアアイコン | 項目数 | 項目（順序固定） |
|---|---|---|---|
| 毎日の業務 | `Sun` | 5 | ホーム / CSV取込み / 日次売上 / 在庫照会 / 月次売上 |
| 商品管理 | `Package` | 4 | 商品検索・一覧 / 商品登録 / 一括インポート / PLU書出し |
| 入出庫 | `ArrowLeftRight` | 7 | 入庫記録 / 返品・交換 / 手動販売出庫 / 廃棄・破損 / 入出庫履歴 / 在庫少一覧 / **棚卸し**（末尾、年次作業） |
| システム管理 | `Wrench` | 4 | バックアップ / 操作ログ / 閾値設定 / 整合性検証 |

#### 各項目アイコン（lucide-react ^1.8.0）

| 項目 | アイコン | 項目 | アイコン |
|---|---|---|---|
| ホーム | `Home` | 入庫記録 | `PackagePlus` |
| CSV取込み | `FileUp` | 返品・交換 | `RotateCcw` |
| 日次売上 | `BarChart3` | 手動販売出庫 | `Hand` |
| 在庫照会 | `Search` | 廃棄・破損 | `Trash2` |
| 月次売上 | `BarChartBig` | 棚卸し | `ClipboardList` |
| 商品検索・一覧 | `PackageSearch` | 在庫少一覧 | `AlertTriangle` |
| 商品登録 | `PackagePlus` | バックアップ | `DatabaseBackup` |
| 一括インポート | `FileSpreadsheet` | 操作ログ | `ScrollText` |
| PLU書出し | `FileDown` | 閾値設定 | `SlidersHorizontal` |
| | | 整合性検証 | `ShieldCheck` |

**アイコンスタイル**: `className="size-4 stroke-[1.5]"`（16px、線細め）。active 時は stone-700、inactive 時は stone-500（[../design-system/00-foundations.md](../design-system/00-foundations.md)「4色エリアモデルの扱い」準拠）。

**Phase 1 の status 配分**:

- `to: "/"` + `status: "active"` = ホームのみ 1 項目
- `to: null` + `status: "pending"` = 残り 18 項目（route 未実装、Phase 2 以降で順次 active 化）

---

### 52.5 ウィンドウタイトル動的更新機構（特殊振る舞い、業務ロジックあり形式の独立節）

UI-12 内で唯一「処理 + エラーハンドリング + 書式規約」を持つ機構。業務ロジックあり形式で詳細化する。

**関数要求**: ルート遷移に応じて `document.title` を `在庫管理システム - <画面名>` 形式で更新し、OS タスクバー / Alt+Tab で画面把握性を高める

**React State**:

- `useRouterState({ select: (s) => s.location.pathname })` の戻り値（TanStack Router 提供、現在 pathname 文字列）
- 派生値: navigation 配列から `to === pathname` の項目を引いた `title`、該当なし or ホーム (`/`) は空文字

**処理ステップ**:

1. RootLayout 内で `const pathname = useRouterState({ select: (s) => s.location.pathname })` で現在 pathname を取得（`useMatches()` を直接使うと TanStack Router の generic 推論が壊れて型 unsafe になるため、`select` プロジェクションで pathname だけ取り出す）
2. `deriveTitle(pathname)` で navigation 配列から title 抽出（純関数、別途 export して unit test 可能に）
3. `useEffect(() => { document.title = formatted }, [formatted])` で副作用反映
4. ホーム (`pathname === "/"`) は "在庫管理システム" 単独表記、それ以外は "在庫管理システム - <title>"
5. 動的 title（`$code` 等）は Phase 2 以降の各 route `head()` で loader data 由来として実装。その段階で `useRouterState` から `useMatches()` + 最深 `match.head?.title` 参照に切り替える

**エラーハンドリング**:

- `useRouterState({ select })` が初期 mount 前に呼ばれるケース: TanStack Router 側で初期 location が `/` を返すため null safety 不要
- Tauri ネイティブ API 併用 (2026-04-21 実機確認で確定):
  - **WSL2 (Ubuntu) WebKitGTK では `document.title` が OS ウィンドウタイトルに rebind されない**ことを実機確認 (Phase 1 GUI 疎通時、タスクバーに `inventory-system-tauri-scaffold` の Tauri 既定タイトルが残っていた)
  - 対応: `@tauri-apps/api/window` の `getCurrentWindow().setTitle(formatted)` を useEffect 内で `document.title` 更新と併用する
  - **Tauri 2 capability 必須**: `src-tauri/capabilities/default.json` の `permissions` に `core:window:allow-set-title` を明示追加する。`core:default` には含まれず、未追加の場合 `setTitle()` 呼び出しは permission denied で失敗する
  - Tauri API 呼び出し失敗時: `.catch((e: unknown) => console.warn(...))` で握って `document.title` のみ更新を保証 (ブラウザ tab 表示には影響なし)
  - Phase 2 Windows native 移行後: Windows は `document.title` の OS ウィンドウタイトル反映が確実だが、Tauri `setTitle()` 併用は害がないため維持

**バリデーション**:

- title 文字列は trim 後の長さチェック（空文字なら "在庫管理システム" にフォールバック）
- 区切り文字: 半角ハイフン + 前後半角スペースで統一

**書式規約**:

- ホーム: `在庫管理システム`
- 通常画面: `在庫管理システム - <画面名>`
- 動的 title: `在庫管理システム - <画面名>: <パラメータ>`（例: `在庫管理システム - 商品修正: HZ-0047`）

**Phase 1 (UI-12) と Phase 2 の責務分担**:

- UI-12: タイトル反映機構の配線、`NavItem.title` フィールド追加、ホーム route フォールバック
- Phase 2 以降: 各 route の `head()` 宣言、loader data を使う動的 title 実装

---

### 52.6 備考

- **notFoundComponent の min-h-screen 削除**: `__root.tsx` の現行 `min-h-screen` を削除し、RootLayout の `h-screen` 枠内で 404 描画する。サイドバーから戻れる 404 になる（Nielsen ヒューリスティック #3）
- **SidebarLink の a11y**: pending リンクは `<span role="link" aria-disabled="true" tabIndex={-1}>` + `<span className="sr-only">（未実装）</span>`。スクリーンリーダ・Tab 巡回から除外。Phase 1 ではコード上で実装、可能なら NVDA / VoiceOver で目視確認
- **SidebarLink active 時の hover**: active 状態は shared stone selection tone (`bg-stone-300` + `border-stone-400` + `font-semibold`) で表現し、hover 時も同 tone を維持する。inactive の hover 上書き (`hover:bg-stone-200/60`) で active 状態が灰色化する事故を防ぐ。active / inactive 双方の寸法が変わらないよう `border border-transparent` を base に持たせる
- **SidebarLink の TanStack Router props 分離**: `<Link>` の `activeProps` は base `className` に**追加**されるだけで上書きしないため、`className` に `hover:bg-stone-200/60` を含めると active 時も stone hover が残って灰色化する。これを防ぐため `className` には共通 `baseClass` のみ、active/inactive それぞれの背景色 + hover は `activeProps.className` / `inactiveProps.className` に完全分離する (2026-04-21 実機確認で確定)
- **デスクトップ前提**: 固定幅 240px サイドバー（レスポンシブ非対象）、hover 状態を主要導線に使って良い（タッチ非対応）、URL は内部識別子（ブックマーク非想定）。詳細は `memory/desktop-app-ui-constraints.md` 参照
- **invoke 境界**: Phase 2 closeout で `invoke-fallback.ts` は撤去済み。`components/layout/**` と `config/**` は引き続き invoke 層に触らず、画面側は `commands.*` + `unwrapResult` を使う
- **Sonner Toaster の theme**: `next-themes` Provider 未マウントでも default `"system"` で動作。`theme` prop を渡さない運用を維持（`src/components/ui/sonner.tsx` 既存定義）
- **デザイン哲学**: stone 系パレット + アイコン + 区切り線でグループ表現（色分け廃止）。出典は [../design-system/00-foundations.md](../design-system/00-foundations.md)「4色エリアモデルの扱い」（ドクトリン文書）
- **表示サイズ option**: H-6 の商品コード readability follow-up として Sidebar footer に `表示サイズ` Select を追加する。選択肢は `標準` / `大きめ` / `特大`、保存は frontend-only `localStorage`、WebView 反映は `@tauri-apps/api/webview` の `setZoom`。Tauri capability は `core:webview:allow-set-webview-zoom`。UI-11a/b/c の設定画面や `app_settings` には本 PR では接続しない
- **表示サイズ control の到達性**: WebView zoom 後に Sidebar 全体が実質大きくなるため、`Sidebar` root と navigation `ScrollArea` は `min-h-0` を持ち、navigation 側を縮小・スクロール可能にする。`DisplayScaleControl` は `shrink-0` として Sidebar footer に残し、`大きめ` / `特大` にした後でも表示サイズを戻せることを L3 で確認する

---

### 52.7 非目的

| やらないこと | 理由 | 責務を持つモジュール |
|---|---|---|
| 各画面コンポーネントの実装 | UI-12 は枠のみ提供 | UI-00〜13 各タスク |
| ダークモード切替 UI | 現状判断で見送り | 将来判断 |
| 表示サイズの DB 永続化 / 設定画面統合 | UI-11a/b/c の既存契約外。本 PR は frontend-only の表示設定に留める | Phase 4 UI-11 系で再判断 |
| Storybook 配線 | 別タスク 7-6 | UI-12 完成後にトリガー判定 |
| Error Boundary 戦略 | 別タスク 7-8a | UI-12 完成後 |
| エラー表示 / ローディング表示の規約化 | UI_TECH_STACK.md で別途規約化 | 7-8b 横断UI標準化 |
| screen_mockups.html の色分け箇所修正 | モックアップアーカイブ扱い | 触らない |

---

### 更新履歴

| 日付 | PR | 内容 |
|---|---|---|
| 2026-04-21 | 7-3 UI-12（本 PR） | 新規作成。設計合意書 [ui-12-design-agreement.md](../archive/plans/2026-04-21-ui-12-design-agreement.md) §2-§5 を関数設計書形式（業務ロジックなし版、主要 3 項目 + ウィンドウタイトル機構の独立節）で転記 + 実装と同 PR で統合 |
| 2026-06-07 | display-scale follow-up | Sidebar footer に表示サイズ Select を追加。`localStorage` token + Tauri WebView zoom (`core:webview:allow-set-webview-zoom`) で全画面表示を 3 段階にする。拡大後も control に戻れるよう Sidebar navigation を `min-h-0` ScrollArea 化。DB/settings 画面統合は Phase 4 UI-11 系へ defer |
| 2026-06-08 | selection-tone follow-up | SidebarLink active tone を amber 系から shared stone selection tone へ統一。amber は在庫少などの業務セマンティック色に残し、navigation selection とは分離 |
