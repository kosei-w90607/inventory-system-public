# 7-3 UI-12 共通レイアウト 設計合意書（2026-04-21 Step A 確定）

> **本ファイルの位置付け**: 2026-04-21 セッションで実施した UI-12 共通レイアウトの設計合意記録。`docs/plans/` 配下のアクティブプランとして保持（Step B〜E 進行中）。元 plan file は `~/.claude/plans/7-3-ui-12-breezy-torvalds.md`（repo 外）。設計判断の **意思決定ログ + コンフリクト解消の経緯** を恒久記録するのが主目的。正式設計書は Step B で新規作成する `docs/function-design/52-ui-shared-layout.md`（合意結果のみ仕様化、判断根拠は本ファイルを参照）。Step E 実装完了時点で `docs/archive/plans/` へ移動予定。
>
> **Step 進捗**: Step A（設計合意）完了 / Step B-E 未着手。進捗は `Plans.md` §Current Phase 参照。

---

**目的**: 実装はしない。全画面の URL パス・コンポーネント対応・サイドバー構成・レイアウト分割を先に設計して合意を取る。**本セッションで §7 の 7 論点全てユーザー確定済**。

**大前提: デスクトップアプリ（Tauri 2 + WebView）であり Web アプリではない**

この前提が以下の設計判断に効く:

- **URL の意味合い**: アプリ内ナビゲーションの内部識別子 + コンポーネントツリー再マウント時の状態保持手段。SEO / ブックマーク / 外部からの deep link / SNS シェア / 検索インデックスは全て無関係
- **「戻る/進む」**: OS ウィンドウ枠に戻る/進むボタンは無い。WebView 内部 history は動くが利用者は認識しない。routing の主目的はここではない
- **F5 リロード**: 利用者は意識的には使わない（業務中断リスク）。ただし開発時・Tauri 内部再読込み時に URL が state を保持していることで画面復元が効く
- **マルチタブ / 複数ウィンドウ**: 単一店舗・単一ウィンドウ前提。非想定
- **ウィンドウサイズ**: 固定幅（`tauri.conf.json` の width/height に従う）、レスポンシブ不要
- **入力デバイス**: マウス + キーボード + バーコードスキャナ（HID キーボード扱い）。タッチ非対応。**タッチターゲット 44×44px は a11y 配慮として維持するが、`hover` 状態は主要導線にあって良い**
- **パフォーマンス**: 単一店舗・数百〜数千商品・SQLite ローカル。SSR 不要、コードスプリッティング不要（起動時に全画面 bundle 可）

**関連ドキュメント**:

- [docs/SCREEN_DESIGN.md §1 画面一覧 / §2 4エリア分類](../../SCREEN_DESIGN.md)
- [docs/ARCHITECTURE.md §2 UI層タスク一覧](../../ARCHITECTURE.md)
- [docs/architecture/ui-task-specs.md §UI-12](../../architecture/ui-task-specs.md)
- [docs/UI_TECH_STACK.md §4.5 グループ色分け方針](../../UI_TECH_STACK.md)

---

## 1. 既存設計書間のコンフリクト（本セッションで解消済、設計書反映タスクのみ残る）

### 1.1 グループ分類: 4 エリア vs 7 グループ → **確定: 4 エリア採用**

**確定理由（ユーザー判断）**: 利用者は「毎日使うもの」が一番上にあってほしい。7 グループだと 19 項目を 7 分割で細かく割りすぎて、非 IT 系の利用者が迷う。

**設計書反映タスク（別セッション）**:
- `docs/architecture/ui-task-specs.md` §UI-12 の「7 グループ」記述を「4 エリア（毎日の業務 / 商品管理 / 入出庫 / システム管理）」に書き換え


| 出典 | 分類 | 内訳 |
|---|---|---|
| SCREEN_DESIGN.md §2（2026-03-21） | **4 エリア** | 毎日の業務 / 商品管理 / 入出庫 / システム管理 |
| ui-task-specs.md §UI-12（2026-04-14） | **7 グループ** | 商品管理 / 入出庫 / 在庫照会 / POS連携 / レポート / 棚卸し / 設定 |

**差異の本質**:
- 4 エリアは「**使用頻度**」基準（毎日／たまに）
- 7 グループは「**機能ドメイン**」基準（POS／レポート／棚卸し を独立）
- SCREEN_DESIGN は 4 画面（CSV/日次/月次/在庫照会）を「毎日」に束ねる。7 グループはドメイン別にばらける

**2 案の代表的ズレ**:

| 画面 | 4 エリア | 7 グループ |
|---|---|---|
| 在庫照会 (UI-06a) | 毎日の業務 | 在庫照会 |
| CSV取込み (UI-07) | 毎日の業務 | POS連携 |
| 日次売上 (UI-09a) | 毎日の業務 | レポート |
| PLU書出し (UI-08) | 商品管理 | POS連携 |
| 棚卸し (UI-10) | 入出庫 | 棚卸し（独立） |

### 1.2 グループ色分け → **確定: 廃止（アイコン + 区切り線で代替）**

**確定理由（ユーザー判断）**: UI_TECH_STACK.md が後発 + ドクトリン文書。アイコン + 区切り線で十分。SCREEN_DESIGN.md の緑/青/オレンジ/黄は初期モックアップ時の名残として SCREEN_DESIGN 側を更新する。

**設計書反映タスク（別セッション）**:
- `docs/SCREEN_DESIGN.md` §2 の「緑/青/オレンジ/黄」記述に「**UI_TECH_STACK §4.5 で色分け廃止が確定したため、実装ではエリアラベルの識別はアイコン + 区切り線で行う（色は使わない）**」の注記追加。初期モックアップ色はアーカイブとして残す

### 1.3 UI 層関数設計書テンプレート: pages/products/ vs routes/ (file-based)

- `docs/function-design/50-ui-product-list.md` は `src/pages/products/ProductListPage.tsx` 前提で書かれている
- Phase 1 で確立された実装構成は TanStack Router file-based routing = `src/routes/products/` 配下
- **UI 層関数設計書テンプレートを現実構成に合わせて更新する別タスクが必要**（本プランの非目的、Phase 9 UI-01 着手時に 50/51 を更新 or §8 Step B で `docs/function-design/52-ui-shared-layout.md` 作成時に新テンプレート確立）

---

## 2. URL パス ↔ 画面コンポーネント ↔ サイドバーグループ 対応表

**前提判断（確定済）**:
- **グループ分類は 4 エリア**（§1.1 確定）
- 色分けは廃止、アイコン + 区切り線でグループ表現（§1.2 確定）
- ルーティングは TanStack Router file-based
- 動的セグメント（`$code` 等）は `<ファイル名>.$code.tsx` 形式で表現
- タブ切替の画面（日次/月次）は **同一 route 内タブ** ではなく **別 route** を採用（§7.3 確定）

### 2.1 全画面対応表

| UI-ID | 画面名 | URL パス | route ファイル | サイドバー4エリア | ナビ表示 | 備考 |
|---|---|---|---|---|---|---|
| UI-00 | ホーム | `/` | `src/routes/index.tsx` | 毎日の業務 | ○ | 現在は search_products demo、Phase 2 (8-1) で置換 |
| UI-07 | CSV取込み | `/pos/csv-import` | `src/routes/pos/csv-import.tsx` | 毎日の業務 | ○ | SCREEN_DESIGN で「毎日」、ドメインは POS |
| UI-09a | 日次売上 | `/reports/daily` | `src/routes/reports/daily.tsx` | 毎日の業務 | ○ | 日次/月次はタブではなく別 route |
| UI-06a | 在庫照会 | `/stock` | `src/routes/stock/index.tsx` | 毎日の業務 | ○ | REQ-301/302/303 統合画面 |
| UI-09b | 月次売上 | `/reports/monthly` | `src/routes/reports/monthly.tsx` | 毎日の業務 | ○ | |
| UI-01a | 商品検索・一覧 | `/products` | `src/routes/products/index.tsx` | 商品管理 | ○ | 商品管理の起点 |
| UI-01b (新規) | 商品登録 | `/products/new` | `src/routes/products/new.tsx` | 商品管理 | ○ | SCREEN_DESIGN 画面一覧の「商品登録」 |
| UI-01b (編集) | 商品修正 | `/products/$code/edit` | `src/routes/products/$code.edit.tsx` | （ナビ非表示） | — | 一覧 or 在庫照会詳細から遷移。サイドバーに置かない |
| UI-01c | 一括インポート | `/products/import` | `src/routes/products/import.tsx` | 商品管理 | ○ | |
| UI-08 | PLU書出し | `/pos/plu-export` | `src/routes/pos/plu-export.tsx` | 商品管理 | ○ | SCREEN_DESIGN で「商品管理」、ドメインは POS |
| UI-02 | 入庫記録 | `/inventory/receiving` | `src/routes/inventory/receiving.tsx` | 入出庫 | ○ | |
| UI-03 | 返品・交換 | `/inventory/return` | `src/routes/inventory/return.tsx` | 入出庫 | ○ | |
| UI-04 | 手動販売出庫 | `/inventory/manual-sale` | `src/routes/inventory/manual-sale.tsx` | 入出庫 | ○ | |
| UI-05 | 廃棄・破損 | `/inventory/disposal` | `src/routes/inventory/disposal.tsx` | 入出庫 | ○ | |
| UI-10 | 棚卸し | `/stocktake` | `src/routes/stocktake/index.tsx` | 入出庫 | ○ | SCREEN_DESIGN で「入出庫」に含まれる |
| UI-06b | 在庫少一覧 | `/stock/low` | `src/routes/stock/low.tsx` | 入出庫 | ○ | 在庫照会から切替可能だが独立 route でも持つ |
| UI-06c | 在庫変動履歴 | `/stock/$code/movements` | `src/routes/stock/$code.movements.tsx` | （ナビ非表示） | — | $code 必須、商品詳細カードから遷移 |
| UI-11b | バックアップ・復元 | `/settings/backup` | `src/routes/settings/backup.tsx` | システム管理 | ○ | |
| UI-11c | 操作ログ | `/settings/logs` | `src/routes/settings/logs.tsx` | システム管理 | ○ | |
| UI-11a | 閾値設定 | `/settings/thresholds` | `src/routes/settings/thresholds.tsx` | システム管理 | ○ | SCREEN_DESIGN の「設定」 |
| UI-13 | 整合性検証 | `/settings/integrity` | `src/routes/settings/integrity.tsx` | システム管理 | ○ | BIZ-07 連携、システム管理側に配置 |

### 2.2 ナビに出さない route（動線は親画面から）

- `/products/$code/edit` ← `/products`（一覧）or `/stock`（詳細カード）から
- `/stock/$code/movements` ← `/stock` 詳細カードから（SCREEN_DESIGN §2）

### 2.3 URL 設計の決定根拠（デスクトップアプリ前提）

1. **ドメインベースの階層**（`/pos/*`、`/inventory/*`、`/reports/*`、`/stock/*`、`/settings/*`）
   - 4 エリア分類（使用頻度）と機能ドメインが 1:1 に一致しない（UI-07 CSV取込みは「毎日の業務」エリアだが URL は `/pos/*`）
   - **URL は機能ドメイン**（コードベースの構造と 1:1）、**サイドバーは使用頻度 4 エリア**（利用者の心理モデルと 1:1）で分離するのが柔軟
   - バックエンドの CMD 命名（`csv_import_cmd`, `plu_export_cmd`）とも整合
   - デスクトップアプリでは URL が外部公開されないため、命名の揺れによるリスクは低い（Web アプリのような「404 リンク」「SEO」概念なし）

2. **日次/月次は別 route**（`/reports/daily` / `/reports/monthly`）確定（§7.3）
   - デスクトップ前提で「戻る/進むが効く・ブックマーク可」は本質的理由ではない（OS ウィンドウに戻るボタン無し）
   - **実質的な根拠**:
     - タブ active 状態が URL に紐付く = コンポーネント props 化されてテスト容易
     - F5 / Tauri WebView 再マウント時に直前のタブを復元できる
     - ルート別に TanStack Query の queryKey を独立させやすい（日次データ / 月次データをキャッシュ分離）
     - コード分割上、各 route が独立モジュールになりメンテ容易
   - タブ UI そのものは `<Link>` で `/reports/daily` ⇄ `/reports/monthly` を切り替える視覚表現として実装

3. **動的セグメントは `$` プレフィックス**
   - TanStack Router の公式記法
   - ファイル名ドット記法（`$code.edit.tsx` → `/$code/edit`）

---

## 3. TanStack Router file-based ディレクトリ構造（Phase 2 で順次追加）

```
src/routes/
  __root.tsx                        [UI-12 差し替え対象、RootLayout 適用]
  index.tsx                         → /                           (UI-00 ホーム、現 demo)
  products/
    index.tsx                       → /products                   (UI-01a)
    new.tsx                         → /products/new               (UI-01b 新規)
    $code.edit.tsx                  → /products/$code/edit        (UI-01b 編集)
    import.tsx                      → /products/import            (UI-01c)
  inventory/
    receiving.tsx                   → /inventory/receiving        (UI-02)
    return.tsx                      → /inventory/return           (UI-03)
    manual-sale.tsx                 → /inventory/manual-sale      (UI-04)
    disposal.tsx                    → /inventory/disposal         (UI-05)
  stock/
    index.tsx                       → /stock                      (UI-06a)
    low.tsx                         → /stock/low                  (UI-06b)
    $code.movements.tsx             → /stock/$code/movements      (UI-06c)
  pos/
    csv-import.tsx                  → /pos/csv-import             (UI-07)
    plu-export.tsx                  → /pos/plu-export             (UI-08)
  reports/
    daily.tsx                       → /reports/daily              (UI-09a)
    monthly.tsx                     → /reports/monthly            (UI-09b)
  stocktake/
    index.tsx                       → /stocktake                  (UI-10)
  settings/
    thresholds.tsx                  → /settings/thresholds        (UI-11a)
    backup.tsx                      → /settings/backup            (UI-11b)
    logs.tsx                        → /settings/logs              (UI-11c)
    integrity.tsx                   → /settings/integrity         (UI-13)
```

**Phase 1 (UI-12) で作るのは `__root.tsx` の差し替えのみ**。上記 route ファイルはすべて Phase 2 以降で各画面着手時に追加する。

---

## 4. サイドバーのグループ構成とアイコン案

### 4.1 4 エリア分類 × アイコン + 区切り線（色分け廃止、UI_TECH_STACK §4.5 準拠）

| エリア | アイコン (lucide-react ^1.8.0) | ナビ項目数 | 項目（**順序もこの並び**） |
|---|---|---|---|
| 毎日の業務 | `Sun` | 5 | ホーム / CSV取込み / 日次売上 / 在庫照会 / 月次売上 |
| 商品管理 | `Package` | 4 | 商品検索・一覧 / 商品登録 / 一括インポート / PLU書出し |
| 入出庫 | `ArrowLeftRight` | 6 | 入庫記録 / 返品・交換 / 手動販売出庫 / 廃棄・破損 / 在庫少一覧 / **棚卸し** |
| システム管理 | `Wrench` | 4 | バックアップ / 操作ログ / 閾値設定 / 整合性検証 |

**入出庫エリア内の順序根拠**: 棚卸し (UI-10) は年に数回しか使わないため末尾配置（§7.4 確定）。日常的な入出庫操作（入庫→返品→手動販売→廃棄）の後、在庫少一覧（判断用）、棚卸し（年次作業）の順。

**合計**: サイドバーに表示する項目 = 19（ナビ非表示 2 を除外）。

### 4.2 各項目のアイコン案（項目単位、1 色 stone-500 固定）

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

**アイコンのスタイル**: `className="size-4 stroke-[1.5]"`（16px、線細め）。active 時は amber-700、inactive 時は stone-500（UI_TECH_STACK §4.5 準拠）。

### 4.3 サイドバー描画構造

```
[サイドバー全体 240px 幅]
  [ヘッダ (48px)]
    店名ロゴ + <Link to="/"> + アプリ名
    └ 下部 Separator
  [ScrollArea (h-full)]
    [エリア: 毎日の業務]
      <h2 icon + ラベル + muted-foreground>
      <SidebarLink> × 5
      <Separator />
    [エリア: 商品管理]
      <h2 icon + ラベル>
      <SidebarLink> × 4
      <Separator />
    [エリア: 入出庫]
      <h2 icon + ラベル>
      <SidebarLink> × 6
      <Separator />
    [エリア: システム管理]
      <h2 icon + ラベル>
      <SidebarLink> × 4
```

---

## 5. 共通レイアウトのコンポーネント分割案

### 5.1 ファイル構成（新規）

```
src/
  config/
    navigation.ts                    [ナビ全定義: エリア × 項目 × URL × アイコン]
  components/
    layout/
      RootLayout.tsx                 [2 カラム grid + Outlet + Toaster + Devtools]
      Sidebar.tsx                    [aside + ヘッダ + ScrollArea + エリア map]
      SidebarArea.tsx                [1 エリア描画: h2 + アイコン + SidebarLink × N + Separator]
      SidebarLink.tsx                [status 分岐: active → <Link>、pending → <span aria-disabled>]
      SidebarHeader.tsx              [店名ロゴ + <Link to="/">]
```

### 5.2 型定義（`src/config/navigation.ts`）

```ts
import type { LucideIcon } from "lucide-react";

export type NavStatus = "active" | "pending";

export type NavItem = {
  id: string;                   // "ui-01a" 等
  label: string;                // サイドバー表示用
  title: string;                // ウィンドウタイトル用（§5.6）。通常は label と同一、将来分離可
  to: string | null;            // Phase 1 は全 null、Phase 2 で route path を埋める
  icon: LucideIcon;
  status: NavStatus;
};

export type NavArea = {
  id: "daily" | "products" | "inventory" | "system";
  label: string;                // "毎日の業務" 等
  icon: LucideIcon;
  items: readonly NavItem[];
};

export const navigation: readonly NavArea[] = [...] as const;
```

### 5.3 RootLayout JSX 構造

```tsx
<div className="grid h-screen grid-cols-[240px_1fr] bg-background text-foreground">
  <aside className="overflow-hidden border-r border-border bg-muted">
    <Sidebar />
  </aside>
  <main className="overflow-auto">
    <Outlet />
  </main>
</div>
<Toaster position="bottom-right" richColors closeButton duration={3000} />
{import.meta.env.DEV && <TanStackRouterDevtools position="bottom-left" />}
```

### 5.4 SidebarLink の status 分岐仕様

| status | 描画 | a11y | 見た目 |
|---|---|---|---|
| `"active"` | `<Link to={to} activeProps={...} inactiveProps={...} activeOptions={{exact: true}}>` + icon + label | 通常リンク | stone-foreground / active 時 amber-700 背景 10% |
| `"pending"` | `<span role="link" aria-disabled="true" tabIndex={-1}>` + icon + label + `<span className="sr-only">（未実装）</span>` | SR・Tab 巡回から除外 | opacity-60 cursor-not-allowed |

### 5.5 notFoundComponent の扱い

現在 `__root.tsx` の `notFoundComponent` は `<div className="min-h-screen">`。RootLayout の `h-screen` と二重になるので **`min-h-screen` を削って RootLayout の枠内で 404 を描画**。サイドバーから戻れる 404 になる（Nielsen #3）。

### 5.6 ウィンドウタイトル動的更新機構（デスクトップ UX 強化、ユーザー提案採用）

**方針**: ルート遷移に応じて WebView + OS ウィンドウタイトルを `在庫管理システム - <画面名>` 形式で更新する。タスクバー / Alt+Tab / 複数アプリ併用時の画面把握性を高める。

**実装方式**: TanStack Router の route-level メタ + RootLayout 一元反映。

#### 5.6.1 NavItem と route head の二面定義

| 対象 | 定義場所 | 例 |
|---|---|---|
| ナビ表示 route (19 項目) | `src/config/navigation.ts` の `NavItem.title` | `title: "CSV取込み"` |
| ナビ非表示 route (商品修正 / 在庫変動履歴) | 各 route の `createFileRoute(...).head()` | `head: ({ loaderData }) => ({ title: \`商品修正: ${loaderData.productCode}\` })` |

**ナビ表示 route も `navigation.ts` の `title` を route `head()` から参照**する設計にすると、ラベルの単一ソース化が保てる:

```ts
// NavItem 型拡張
export type NavItem = {
  id: string;
  label: string;          // サイドバー表示用
  title: string;          // ウィンドウタイトル用（通常 label と同一だが区別可能）
  to: string | null;
  icon: LucideIcon;
  status: NavStatus;
};
```

通常は `title === label` だが、将来「サイドバーは『日次売上』、タイトルは『日次売上レポート』」のように分ける余地を残す。Phase 1 時点では同一で良い。

#### 5.6.2 RootLayout での一元反映

```tsx
// 擬似コード
function RootLayout() {
  const matches = useMatches();
  const title = deriveTitle(matches); // 最深 match の head().title を拾う。なければ "在庫管理システム"

  useEffect(() => {
    const formatted = title === "在庫管理システム" ? title : `在庫管理システム - ${title}`;
    document.title = formatted;
    // Tauri ネイティブ API 併用判断は §5.6.3 参照
  }, [title]);

  return (/* grid レイアウト */);
}
```

- `useMatches()` は route tree の全 match を返す。最深 match が持つ `head()` の `title` を採用
- マッチなし or `/` = ホーム時は `在庫管理システム` 単独表記
- `document.title` は React の副作用として安全（Suspense / StrictMode 二重実行でも冪等）

#### 5.6.3 Tauri ネイティブ API 併用の判定（実装時スパイク）

- **期待動作**: Tauri 2 の WebView は通常 `document.title` の変更を OS ウィンドウタイトルに rebind する（Chromium / WebKit の標準挙動）
- **環境依存リスク**: Linux (GTK/WebKitGTK) で反映されない可能性あり。ユーザーの現在開発環境は WSL2 (Ubuntu) なので要確認
- **スパイク手順**:
  1. UI-12 実装時に `document.title` のみで実装
  2. `cargo tauri dev` 起動 → route 遷移で OS タスクバーに反映されるか目視
  3. 反映されない場合 → `@tauri-apps/api/window` の `getCurrentWindow().setTitle()` を `useEffect` 内で追加併用
- **Phase 2 Windows native 移行後**: Windows は `document.title` の window title 反映が確実なので問題なし

#### 5.6.4 書式規約（`docs/function-design/52-ui-shared-layout.md` Step B で明文化）

- ホーム: `在庫管理システム`
- 通常画面: `在庫管理システム - <画面名>`
- 動的 title（$code 等を含む）: `在庫管理システム - <画面名>: <パラメータ>`（例: `在庫管理システム - 商品修正: HZ-0047`）
- 区切り文字はハイフン全角/半角混在を避け、半角ハイフン + 前後半角スペースで統一

#### 5.6.5 Phase 1 (UI-12) と Phase 2 の責務分担

- **UI-12 (本 plan Step E)**: タイトル反映機構（`useMatches()` + `document.title` 更新）を RootLayout に配線、`NavItem.title` フィールド追加（全 pending 項目に title 暫定値を埋める）、ホーム route (`/`) の head 未定義時フォールバック（`在庫管理システム`）
- **Phase 2 以降の各画面 PR**: 該当 route の `head()` 宣言、動的 title（loader data 使用）の実装

---

## 6. 既存実装との接続

### 6.1 `src/main.tsx` は触らない

QueryClient / RouterProvider / ReactQueryDevtools は配置済。

### 6.2 `src/routes/index.tsx` (search_products demo) は維持

RootLayout のメインエリアに自然に収まる。Phase 2 (8-1 UI-00) で置換予定。

### 6.3 `src/components/ui/sonner.tsx` は触らない

`next-themes` Provider 未マウントでも default `"system"` で動作。`theme` prop を渡さない運用。

### 6.4 eslint 境界ルール

`invoke-fallback.ts` の import 制限は `features/**` と `routes/**` のみ。**`components/layout/**` や `config/**` は invoke 層に触らない**ので抵触しない。

---

## 7. ユーザー確定事項（本セッション回答、全項目確定済）

以下 7 論点は全てユーザー判断で確定。設計書・実装プランに反映する。

### 7.1 【最重要】グループ分類 → **4 エリア確定**

利用者は「毎日使うもの」が一番上にあってほしい。7 グループだと 19 項目を 7 分割で細かく割りすぎて、非 IT 系利用者が迷う。ui-task-specs.md §UI-12 を 4 エリアに更新（§1.1 タスク）。

### 7.2 色分け → **廃止確定**

UI_TECH_STACK.md §4.5 のドクトリンに従い、アイコン + 区切り線でグループ表現。SCREEN_DESIGN.md §2 の色記述に注記追加（§1.2 タスク）。

### 7.3 日次/月次 → **別 route 確定**

URL `/reports/daily` / `/reports/monthly`。デスクトップ前提での本質的根拠は §2.3 参照（「戻る/進む」ではなく状態の URL 化 = テスト容易 + F5 耐性 + queryKey 独立 + コード分割）。タブ UI は `<Link>` で 2 route を切り替える視覚表現として実装。

### 7.4 棚卸し (UI-10) → **「入出庫」エリア確定**

年に数回しか使わないため独立グループにする意味がない。入出庫エリア内の**末尾配置**で「日常操作 → 在庫少チェック → 棚卸し（年次）」の頻度降順（§4.1）。

### 7.5 整合性検証 (UI-13) → **「システム管理」エリア確定**

保守・管理系機能。利用者が日常的に使うものではなく、問題があったときに使う位置付け。ドメイン的には POS 連携だが、利用者の心理モデル（＝「異変の時のシステム管理ツール」）を優先。

### 7.6 在庫少一覧 (UI-06b) → **独立 route + サイドバー項目 確定（両アクセス）**

- `/stock/low` 独立 route
- サイドバー「入出庫」エリアに項目表示（`AlertTriangle` アイコン）
- 同時に `/stock` 在庫照会のフィルタチップからも到達可能（SCREEN_DESIGN §3 記述通り）
- 利用者が「在庫少ないやつだけ見たい」と思った瞬間に、サイドバーから直接飛べる導線を確保

### 7.7 PLU書出し (UI-08) → **「商品管理」エリア確定**

PLU書出しは商品マスタの書き出し。日次運用というより「商品を登録・変更した後にレジに反映する」作業なので商品管理が自然。URL は `/pos/plu-export` のままだが、サイドバー配置は「商品管理」。**URL ドメインとサイドバー配置が不一致なのは §2.3-1 の設計方針通り**（URL = 機能ドメイン / サイドバー = 心理モデル）。

---

## 8. 決定の段取り（本プランの範囲）

```
Step A. ✅ 本 plan をユーザーに提示 → §7 の 7 論点を合意 (完了、本セッション)
Step B. docs/function-design/52-ui-shared-layout.md を新規作成
        - ルーティング定義・対応表・サイドバー構成・コンポーネント分割を関数設計書形式で記載
        - UI 層設計書テンプレートを routes/ file-based 前提に更新（将来 UI-02〜13 の 52〜6N で踏襲）
        - 50-ui-product-list.md / 51-ui-product-form.md の pages/products/ 前提には「旧表記、Phase 9 の UI-01 実装時に更新」コメント追記のみ
Step C. FUNCTION_DESIGN.md 目次に 52 を追加、冒頭「対象範囲」に UI-12 を追記
Step D. ui-task-specs.md §UI-12（7 グループ → 4 エリア）+ SCREEN_DESIGN.md §2（色分け注記）を §7 合意内容に同期
Step E. 実装プランを別 plan file で立て直し、実装着手（Phase 2 UI-00 着手前の必須タスク）
```

**本 plan は設計定義書、実装プランではない**。Step B 以降は plan mode を抜けて実行。

### Step B-D の PR 分割案（本 plan 範囲外、Step E 着手前に別セッションで実施）

- **PR (α)**: `docs(ui-12): add shared layout function design and reconcile 7 groups → 4 areas`
  - 新規: `docs/function-design/52-ui-shared-layout.md`
  - 更新: `docs/FUNCTION_DESIGN.md`（目次・対象範囲）
  - 更新: `docs/architecture/ui-task-specs.md` §UI-12（7 グループ → 4 エリア、本 plan の §2 対応表を転記）
  - 更新: `docs/SCREEN_DESIGN.md` §2（色分け注記追加）
  - `./scripts/doc-consistency-check.sh` 通過必須
- **PR (β, Step E 発動後)**: UI-12 実装 PR（Step B-D の確定設計に従う）

---

## 9. 非目的（明確化）

| 項目 | 送り先 |
|---|---|
| UI-12 の実装 | Step E の実装プラン |
| UI-01a/01b の関数設計書更新 | Phase 9 (9-1, 9-2) 着手時 |
| UI-02〜11 の関数設計書作成 | 各 Phase 着手時（8-1 UI-00 から順次） |
| Storybook 導入判断 | 7-6 |
| Vitest + a11y テスト | 7-7 |
| Error Boundary 戦略 | 7-8a |
| 横断 UI テンプレート (Toast/Dialog/EmptyState/ErrorState) | 7-8b |
| ダークモード | 将来判断（現状見送り） |

---

## 10. 次のアクション（本 plan 承認後）

§7 全論点ユーザー確定済。本 plan 承認後は以下フローで進行:

1. **plan mode 終了** → 本 plan file を `docs/plans/ui-12-design-agreement.md` に転写済（本ファイル、Step E 完了時点で `docs/archive/plans/` に移動予定）
2. **別セッションで Step B〜D を PR (α) として実施**
   - `docs/function-design/52-ui-shared-layout.md` 新規作成（本 plan §2〜§5 を関数設計書形式で転記）
   - `docs/FUNCTION_DESIGN.md` 目次更新
   - `docs/architecture/ui-task-specs.md` §UI-12 を 4 エリアに書き換え
   - `docs/SCREEN_DESIGN.md` §2 に色分け廃止注記追加
   - `./scripts/doc-consistency-check.sh` 通過確認 → Codex レビュー → merge
3. **PR (α) マージ後、別セッションで Step E（UI-12 実装プラン + 実装 PR）**
4. **Plans.md 更新**: 7-3 の進捗を「設計書作成中」→「実装中」→「完了」で段階的に反映

---

## 11. 本 plan の位置付けまとめ

- **本 plan = 設計合意書（`docs/plans/` 配下、アクティブプラン）**。URL / サイドバー / レイアウト分割を確定した状態 + 判断根拠・コンフリクト解消の経緯。Step B〜E 進行中のアクティブ位置付け
- **Step B の `docs/function-design/52-ui-shared-layout.md` = 正式設計書**。CLAUDE.md 規範「実装前に該当ドキュメントを読む」を満たす（合意結果のみ仕様化、判断根拠は本 plan を参照）
- **Step E の実装プラン = 実装手順書**。Step B-D が merge された後に立てる
- 本 plan は 52-ui-shared-layout.md からリンクされ、設計判断の「なぜこうなったか」参照元として機能する
- Step E 実装完了（タグ `v0.7.0-ui-foundation` 到達）時点で `docs/archive/plans/2026-04-21-ui-12-design-agreement.md` へ移動
