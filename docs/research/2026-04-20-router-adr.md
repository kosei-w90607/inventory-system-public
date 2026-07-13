# ADR-001: ルーティングライブラリ選定 — TanStack Router 採用

- 日付: 2026-04-20
- ステータス: 決定
- 関連: Plans.md 7-4, [UI_TECH_STACK.md §7.1](../UI_TECH_STACK.md), プランファイル `/home/kosei/.claude/plans/7-phase-1-ui-fluttering-hamming.md` Task 1

## Context

第7段階 Phase 1（UI 基盤構築）で、Tauri 2.0 + React 19 + TypeScript の SPA デスクトップアプリに採用するルーティングライブラリを選定する。在庫管理システムは全 19 画面（UI-00〜UI-13）で構成され、Phase 1 で共通レイアウト（UI-12）を組み上げる直前に確定する必要がある。

選定済み技術スタック（UI_TECH_STACK.md §2 参照）:
- React 19.1.0
- TanStack Query v5.99（採用済み、§2.5）
- Vite 7.3 + Tailwind 4 + shadcn/ui
- Tauri 2.0（WebView2）

比較表は UI_TECH_STACK.md §7.1 に 2026-04-20 追記済みだが、実装レベルで検証せずに決定すると、Phase 2 以降の書き直しコストが発生するため、spike branch で両方プロトタイプを作って数字 + 手触りで判定する。

## Options

### Option A: TanStack Router v1.168.23

- branch: `spike/router-tanstack`（commit 5f66acd）
- 実装内容: ファイルベース routing（`src/routes/`）+ `TanStackRouterVite` プラグイン + `autoCodeSplitting: true`
- 最小 3 route + 1 動的 route + 404 を実装

**長所**:
- **型安全なパラメータ**: `<Link to="/products/$productCode" params={{ productCode: "P001" }} />` がコンパイル時に URL パス整合性検証
- **ファイルベース routing**: `src/routes/products.$productCode.tsx` → `/products/:productCode` に自動マップ、`routeTree.gen.ts` が Vite プラグインで自動生成（`.gitignore` 対象）
- **自動 code-splitting**: route 単位で別 chunk、`/products` と `/products/$productCode` が 0.6 kB / 0.52 kB の独立 chunk として出力
- **TanStack Query 統合**: `createRouter({ context: { queryClient } })` で loader から QueryClient を参照、同一作者のため API 整合性高
- **devtools 組込み**: `<TanStackRouterDevtools />` で route tree を視覚化（`import.meta.env.DEV` ガード）
- **JSX 不要の route 定義**: `createFileRoute("/products/")({ component })` の config-based API

**短所**:
- **バンドルサイズやや大**: main chunk 333.52 kB raw / 105.21 kB gzip
- **Modules transformed 多**: 185（route tree 自動生成 + devtools 含む、auto code-splitting のため）
- **学習コスト**: 新しめの API、既存 React Router 知識の一部しか流用できない
- **情報量**: React Router より少ない（ただし公式ドキュメント・コミュニティは活発）

**実測値**:
```
dist/assets/index-iRSZ0PpT.css                  47.50 kB │ gzip:   8.55 kB
dist/assets/index-DEVRH8pQ.js                    0.34 kB │ gzip:   0.29 kB (root)
dist/assets/products._productCode-DSxmXBcD.js    0.52 kB │ gzip:   0.34 kB (code-split)
dist/assets/products.index-CVXaOXvG.js           0.60 kB │ gzip:   0.39 kB (code-split)
dist/assets/index-jQwp3b50.js                  333.52 kB │ gzip: 105.21 kB (main)
合計 gzip: 114.78 kB / build time: 1.27s
```

### Option B: React Router v7.14.1

- branch: `spike/router-react-router`（commit 3324891）
- 実装内容: declarative mode（`createBrowserRouter`）+ 手動 route config
- 最小 3 route + 1 動的 route + 404 を実装

**長所**:
- **業界標準**: 長期安定、情報量豊富、他プロジェクトからの知識移植容易
- **バンドルサイズやや小**: main chunk 336.83 kB raw / 106.87 kB gzip
- **Modules transformed 少**: 93（シンプル config）
- **Build time 速**: 1.04s（TanStack の 1.27s より 0.23s 速）
- **NavLink isActive 組込み**: `className={({ isActive }) => ...}` で active 状態判定
- **Framework mode（旧 Remix）の選択肢**: SSR 必要時に切替可能（本プロジェクトは不要）
- **Remix v2 統合**: React Router と Remix が v7 で統合済み、将来の選択肢広い

**短所**:
- **型安全性が弱い**: `useParams<{ productCode: string }>()` の型注釈は手動、パスとの整合性はランタイム依存
- **code-splitting 手動**: デフォルトは single bundle、`lazy()` ラップを明示的に書く必要
- **TanStack Query 統合はブリッジコード必要**: `loader` は純 React Router、QueryClient 参照はカスタムコンテキストや外部 hook 経由
- **devtools 組込みなし**: 外部ライブラリ（`@tanstack/react-router-devtools` のような標準品はない）
- **Declarative mode の JSX route config**: 19 画面規模でネストが深くなる懸念

**実測値**:
```
dist/assets/index-BJW2Vm-b.css   47.23 kB │ gzip:   8.52 kB
dist/assets/index-C3TX41lj.js   336.83 kB │ gzip: 106.87 kB (single bundle)
合計 gzip: 115.39 kB / build time: 1.04s
```

### 比較サマリ

| 指標 | TanStack Router | React Router v7 | 差分 |
|------|----------------|------------------|------|
| JS gzip | 106.23 kB | 106.87 kB | +0.64 kB (v7) |
| CSS gzip | 8.55 kB | 8.52 kB | -0.03 kB |
| 合計 gzip | **114.78 kB** | **115.39 kB** | +0.61 kB (v7) |
| Modules transformed | 185 | 93 | -92 (v7) |
| Build time | 1.27s | 1.04s | -0.23s (v7) |
| Code splitting | 自動（route 単位） | デフォルトなし | TanStack 有利 |
| Type-safe params | ✅ compile-time | ⚠️ runtime + 手動注釈 | TanStack 有利 |
| Query 統合 | router context で自然 | 手動ブリッジ | TanStack 有利 |
| devtools | 組込み | 外部 lib | TanStack 有利 |
| 情報量 | 活発だが新しめ | 業界標準、豊富 | React Router 有利 |
| Framework mode（SSR） | なし | あり（本プロジェクト不要） | 判定要因外 |

## Decision

**採用: Option A（TanStack Router v1.168.23）**

### 根拠（優先度順）

1. **型安全な URL パラメータが決定的**: 本プロジェクトは 19 画面で動的 route が多数（`/products/:productCode`, `/sales/:saleDate`, `/stocktake/:stocktakeId` 等）。TanStack Router の `params={{ productCode }}` による compile-time 検証は、リファクタリング時の参照追跡コストを大幅削減。React Router v7 では `/sales/${saleDate}` のような文字列連結で URL を構築するため、URL フォーマット変更時の検出漏れリスクあり
2. **TanStack Query との統合が自然**: `createRouter({ context: { queryClient } })` で QueryClient を全 route の loader から参照可能。同一作者のため API 設計思想が一貫（staleTime, invalidation pattern 等）。React Router v7 は別作者のため独自のブリッジ実装が必要で保守コスト発生
3. **ファイルベース routing の DX**: `src/routes/products.$productCode.tsx` という命名で route が自動認識される。19 画面を含む Phase 4 完了時にも一覧性・検索性が高い。config-based の JSX 定義は画面数増加で可読性が落ちる
4. **バンドルサイズ差が無視できる**: 0.6 kB gzip の差は Tauri WebView2 の起動時間が支配的な本プロジェクトでは実質的意味なし
5. **自動 code-splitting**: Phase 4 の 19 画面実装時、React Router v7 だと手動 `lazy()` 追加コストが累積

### 棄却理由（Option B）

- 業界標準の安定性は魅力だが、本プロジェクトの使用範囲（SPA 全画面）では TanStack の優位点を相殺できない
- Modules transformed 数の差（185 vs 93）は devtools + auto route tree 由来で、dev/CI time への影響は 0.23s 程度。無視できる
- Framework mode（SSR）は本プロジェクトで不要（Tauri デスクトップアプリ）

## Consequences

### 正の影響

- Phase 2〜4 の全 UI 画面実装で `<Link to="...">` と `Route.useParams()` が型推論で動作、リファクタリング耐性が高い
- TanStack Query との統合が自然なため、7-5c（invoke ラッパ + QueryClient setup）の実装が単純化
- devtools 組込みで開発時の route 状態確認が容易
- 新技術の学習機会として、ファイルベース routing + type-safe params の設計思想を習得（AI 時代の物差し作り、tech-selection-learning-investment.md 参照）

### 負の影響

- TanStack Router の API 学習コスト（推定 2〜3 画面実装で慣れる）
- `routeTree.gen.ts` の .gitignore 扱い → CI/clone 直後に build を通す必要あり（今回は既に対応済み）
- modules transformed 数の増加で CI build time が微増（0.2s 程度、実質影響なし）

### 再評価トリガー

以下のいずれかが発生したら再検討する:

- TanStack Router のメンテナンス停滞（release 3ヶ月以上なし or 重大な unfixed bug が 30日以上残存）
- React 20 等のメジャーアップグレードで TanStack 側対応が大幅遅延
- Tauri + WebView2 環境で TanStack Router に固有の不具合（hot reload 不安定、route 遷移でメモリリーク等）
- Phase 4 完了時（v1.0.0 タグ）の振り返りで、19 画面実装後の DX 体感に大きな不満

## Verification Evidence

### 実測データ（2026-04-20 時点）

- **TanStack Router spike**: branch `spike/router-tanstack`, commit `5f66acd`, bundle gzip 合計 114.78 kB, build time 1.27s, npm install 時 3 vulnerabilities (2 moderate, 1 high) 警告あり（monitoring 必要）
- **React Router v7 spike**: branch `spike/router-react-router`, commit `3324891`, bundle gzip 合計 115.39 kB, build time 1.04s, 同様の npm audit 警告あり（依存元調査 pending）

### 実装比較コード

#### TanStack Router（型安全）
```tsx
// src/routes/products.index.tsx
<Link to="/products/$productCode" params={{ productCode: p.code }}>
  {p.code} — {p.name}
</Link>

// src/routes/products.$productCode.tsx
const { productCode } = Route.useParams();  // 型推論、注釈不要
```

#### React Router v7（手動注釈）
```tsx
// src/pages/ProductListPage.tsx
<Link to={`/products/${p.code}`}>  // 文字列連結、compile-time 検証なし
  {p.code} — {p.name}
</Link>

// src/pages/ProductDetailPage.tsx
const { productCode } = useParams<{ productCode: string }>();  // 手動型注釈
```

### 保持 branch

両 spike branch は remote に push して保持（後日参照用）:
- `spike/router-tanstack`（採用）
- `spike/router-react-router`（棄却、比較資産として保持）

### 未検証事項（後続タスクで対応）

- `loader` 経由の Query prefetch の実運用: 本 spike では Provider 配線のみ、実際の `loader` 実装は 7-5c で対応
- Tauri build（`npm run tauri build`）での production bundle 挙動: dev build のみ検証、release 版の差は Phase 4 完了時の実機試験で確認
- HMR 挙動の詳細比較: spike では cold start のみ計測

## 次アクション

- Task 2（7-5a invoke 型定義、tauri-specta spike）へ進む
- Task 4（main 反映）で TanStack Router を main にインストール、最小スキャフォールド追加
- `docs/UI_TECH_STACK.md §7.1` に「決定: TanStack Router / 根拠: 本 ADR」を追記

## 更新履歴

- 2026-04-20: 初版作成。Task 1 完了に伴う決定記録
