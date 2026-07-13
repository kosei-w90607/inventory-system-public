# UI技術スタック選定書

> **親文書**: [ARCHITECTURE.md](ARCHITECTURE.md)
> **入力ドキュメント**: ARCHITECTURE.md（タスク仕様）、SCREEN_DESIGN.md（画面設計）、FUNCTION_DESIGN.md（関数設計）
> **最終更新**: 2026-07-01 / UI-08 PLU書出し native save / confirm 方針更新
> **位置付け**: 第7段階以降のUI実装で守るべき技術選定・デザイン哲学・運用原則を定める唯一の参照源

---

## 1. 決定サマリ

本書はUI層実装の**決定書**であり、根拠と不採用理由を含めて記録する。以下が一覧:

### 技術スタック

| 層 | 採用 | バージョン | 1行理由 | 参照章 |
|----|------|-----------|---------|-------|
| Framework | React | 19.1.0 | 既存scaffold維持、`useTransition`/`useDeferredValue`で在庫大量表示の体感確保 | §2.1 |
| 言語 | TypeScript | 5.8 | 型安全。CMD層（Rust）からの戻り値型を厳格に扱う | §2.1 |
| デスクトップ基盤 | Tauri | 2 | 既存。WebView2（Win）/WebKit（Mac/Linux）軽量ネイティブ | §2.1 |
| ビルド | Vite | 既存 | Tauri標準統合、HMR高速 | §2.1 |
| スタイリング | Tailwind CSS | 4 | `stone`ベースウォーム系、CSS変数で shadcn/ui と整合 | §2.2, [00-foundations.md](design-system/00-foundations.md) |
| コンポーネント | shadcn/ui | latest | Radix UIベース、copy-paste方式、A11y堅牢 | §2.3 |
| アイコン | lucide-react | latest | shadcn/ui標準、MIT、軽量 | §2.3, [00-foundations.md](design-system/00-foundations.md) |
| データテーブル | TanStack Table | 8 | ヘッドレス、大量行に強い、shadcn/ui DataTable適合 | §2.4 |
| データフェッチ | TanStack Query | 5 | CMD層invoke結果のキャッシュ・invalidate制御 | §2.5 |
| 状態管理 | Zustand | 5 | 軽量、選択的レンダリング、業務アプリに十分 | §2.6 |
| フォーム | React Hook Form + Zod | latest + 4 | 型安全、スキーマ駆動、再レンダ最小 | §2.7 |
| テスト（単体） | Vitest | latest | Vite整合、高速 | §2.7補, §6 |
| テスト（A11y） | @axe-core/react | latest | WCAG 2.1 AA 監査 | §5 |
| 通知 | Sonner | latest | shadcn/ui公式トースト、A11y済み | §6 |
| 日付 | date-fns | latest | 軽量、関数型、i18n不要で十分 | §6 |

### デザインシステム

| 項目 | 決定 | 参照章 |
|------|------|-------|
| カラーパレット | Tailwind `stone` ベース + セマンティックトークン（primary/success/warning/danger） | [00-foundations.md カラーパレット](design-system/00-foundations.md) |
| タイポ | 本文16px、ボタン・ラベル14px、見出しh1:24px/h2:20px/h3:18px | [00-foundations.md タイポグラフィ](design-system/00-foundations.md) |
| スペーシング | Tailwindスケール 4/8/12/16/24/32px 固定 | [00-foundations.md スペーシング](design-system/00-foundations.md) |
| アイコンサイズ | 16/20/24px 3段階 | [00-foundations.md アイコンサイズ](design-system/00-foundations.md) |
| 4色エリアモデル | SCREEN_DESIGN.md §2 遷移図に限定。実UIには持ち込まない | [00-foundations.md 4色エリアモデルの扱い](design-system/00-foundations.md) |
| 業務ステータス | 色は補助。日本語ラベル + 非色シグナル + 既存 Badge/Icon で意味を伝える | [00-foundations.md 業務ステータスの視認性](design-system/00-foundations.md) |
| ダークモード | 見送り（手芸店の日中業務想定） | §6.6 |
| 国際化 | なし（日本語UI固定） | §3.5 |

### 哲学のスタック（核心4本柱 + 補助3原則 + 観点借用1件）

- **核心4本柱**: refactoring-ui（視覚設計）/ ux-principles（利用者心理）/ GOV.UK Design Principles（作らない勇気）/ IBM Carbon Foundations（A11y基盤・密集情報）
- **補助3原則**: Shopify Polaris（業務語彙）/ Atlassian（装飾強度の文脈依存）/ Microsoft Fluent 2（Effortless/Coherent/Relevant）
- **観点借用**: japanese-webdesign（Anshin哲学＝情報密度＝信頼）

詳細は [design-system/03-philosophy.md](design-system/03-philosophy.md)（参照哲学の正典）。

<!-- reviewed: 2026-04-16 -->

---

## 2. 採用スタック詳細（7パート）

### 2.1 Framework — React 19.1.0 + TypeScript 5.8 + Tauri 2

**選定理由**:
- 既存scaffoldの維持（create-tauri-app で `react-ts` テンプレート生成済み）
- React 19 の `useTransition` / `useDeferredValue` により、在庫一覧・売上テーブル等の大量行描画時に入力ブロックなしで段階的レンダリング可能
- TypeScript 5.8 の `satisfies` 演算子と const type parameters で、CMD層（Rust）からの戻り値を `CmdError` と業務型に厳格に分解

**比較した他候補**:
| 候補 | 理由で見送り |
|------|------------|
| Vue 3 + Pinia | エコシステム（shadcn/ui・TanStack系）がReact前提で充実、導入コスト差で優位性なし |
| Svelte 5 | 依存を減らせるが shadcn/ui 相当のコンポーネント体系を自作する工数が増す |
| Solid | 性能は魅力だが TanStack Query/Table のSolid対応が成熟度で劣る |

**React Server Components の扱い**: 採用しない。Tauri はローカルバンドル、RSCサーバー不要。RSC機能の一部である Suspense と `use()` Hook のみ採用。

**trade-off**: React 19 は破壊的変更あり（`ReactDOM.render` 廃止等）。新規プロジェクトでは影響ゼロ。

### 2.2 Styling — Tailwind CSS 4 + @tailwindcss/vite + カスタム `stone` パレット

**選定理由**:
- CSS変数ベースの新アーキテクチャが shadcn/ui のデザイントークン（`--background` / `--foreground` / `--primary`等）に直接マッピング
- `@tailwindcss/vite` プラグインで JIT コンパイルが Vite HMR と統合、開発体験◎
- `stone` パレット（#fafaf9 〜 #0c0a09）はTailwind公式のウォームニュートラルで、商材（毛糸・布・木製道具）との色温度整合

**比較した他候補**:
| 候補 | 理由で見送り |
|------|------------|
| CSS Modules | コンポーネント単位の型安全はあるが、デザイントークンの一元管理が困難 |
| styled-components / Emotion | ランタイムCSS-in-JSの性能オーバーヘッド、RSC時代に逆行 |
| Panda CSS / Vanilla Extract | 型安全CSSは魅力だが、shadcn/ui エコシステムから外れる |
| Tailwind CSS 3 | 4 で解決された PostCSS 依存・config 肥大化が残る |

**trade-off**: Tailwind 4 は 2024 末リリースで、エコシステムプラグイン（typography / forms）の4対応が一部未成熟。本プロジェクトでは forms は未使用、typography は文書表示しないので影響なし。

### 2.3 Components — shadcn/ui（Radix UI ベース）+ lucide-react

**選定理由**:
- **Copy-paste方式**: `npx shadcn@latest add button` でソースを`components/ui/`に展開。依存グラフに入らない、バージョン固定リスクなし
- **Radix UI基盤**: ダイアログ・ドロップダウン・ポップオーバー等の A11y（フォーカストラップ・ARIA属性・キーボード操作）が Radix の堅牢実装
- **所有感**: コードが手元にあるためプロジェクト固有のカスタマイズが直接編集で可能

**比較した他候補**:
| 候補 | 理由で見送り |
|------|------------|
| Material-UI (MUI) | Material Design の世界観が業務アプリに過剰、バンドルサイズ大 |
| Chakra UI | v3でスタイルシステム変更、エコシステム分断、Tailwind との相性悪い |
| Mantine | 充実だが Emotion ベース、Tailwind+shadcn/ui の純度を下げる |
| Headless UI (Tailwind Labs) | シンプルだが Radix に比べて部品が少ない、shadcn/ui が事実上の後継 |
| Radix UI 直接使用 | スタイル自作の工数が嵩む、shadcn/ui のレシピを自作することになる |

**導入コンポーネント（Phase 1 当初）**:
`Button` `Input` `Label` `Dialog` `AlertDialog` `DropdownMenu` `Select` `Checkbox` `RadioGroup` `Tabs` `Card` `Table`（TanStack Table ラップ）`Toast`（Sonner）`Form`（RHF ラップ）`Badge` `Skeleton` `Separator` `ScrollArea`

**アイコン — lucide-react**:
- shadcn/ui 公式採用で整合
- MIT、1400+アイコン、tree-shakingで必要分のみバンドル
- 他候補（React Icons, Heroicons, Phosphor Icons）より shadcn/ui エコシステムとの統合度で優位

### 2.4 Data Tables — TanStack Table v8

**選定理由**:
- **ヘッドレス**: UI は shadcn/ui の `Table` プリミティブを使い、TanStack Table はロジック（ソート・フィルタ・ページング・選択・仮想化）のみ
- **大量行性能**: 在庫マスタ数千件、売上明細数万件の描画で React Table v7 から v8 で体感向上
- **shadcn/ui DataTable レシピ**: 公式ドキュメントに `DataTable` パターンがあり、導入コストが低い

**比較した他候補**:
| 候補 | 理由で見送り |
|------|------------|
| AG Grid Community | 機能豊富だが UI が自前スタイリングで、shadcn/ui と分離される。Enterprise版は有料 |
| MUI DataGrid | MUI 前提、shadcn/ui と二重管理 |
| Material React Table | MUI 依存で同上 |
| 自作テーブル | 在庫一覧のソート・フィルタ・選択を自作する工数が大きい |

**trade-off**: ヘッドレスのため「TanStack Table + shadcn/ui の接続コード」がアプリ側に残る。プロジェクトで3〜4画面で使うため、1度 `DataTable.tsx` を書けばよい。

### 2.5 Data Fetching — TanStack Query v5 + @tauri-apps/api invoke ラッパ

**選定理由**:
- **CMD層（Rust）との通信**: `invoke("get_products", { ... })` を `useQuery({ queryFn: () => invoke(...) })` でラップ
- **キャッシュ**: 同一クエリの重複リクエスト抑制、`staleTime` / `gcTime` で業務特性に応じた再取得制御
- **invalidate**: 商品更新後に `queryClient.invalidateQueries({ queryKey: ['products'] })` で一覧自動再取得
- **Optimistic Update**: 在庫変動記録のUIレスポンスを即時反映→失敗時ロールバック

**比較した他候補**:
| 候補 | 理由で見送り |
|------|------------|
| Redux Toolkit Query | Redux 前提、状態管理を Zustand にした以上冗長 |
| SWR | 機能的に TanStack Query の下位集合、Query の方がエコシステム厚い |
| 自作 fetch + useEffect | キャッシュ・invalidate・再取得を自作する工数が本末転倒 |

**invoke ラッパ設計**（`src/lib/invoke.ts`、Phase 2 closeout 後の現行形）:
```ts
// commands.* は tauri-specta 生成の typedError Result を返す。
// unwrapResult で ok/data を取り出し、error は InvokeError(CmdError) として投げる。
const products = await unwrapResult(commands.searchProducts(args), {
  source: "commands",
  cmd: "search_products",
});
```

CMD層のエラー契約は FUNCTION_DESIGN.md 系の `CmdError` と対応（§6.4 エラー変換表 参照）。

#### invoke 型定義方式の選定（Plans.md 7-5a）

**比較表**（2026-04-20 追記、実機試行は別セッション）:

| 評価軸 | tauri-specta 自動生成 | 手動型定義 |
|--------|----------------------|-----------|
| CMD 追加時の保守 | 自動（`build.rs` で TS 型生成） | Rust / TS 両側に書く（2 重管理） |
| 型の真実性 | Rust 構造体から生成、乖離ゼロ | 人為的乖離リスクあり |
| ビルド時間 | `specta` proc-macro で微増 | 影響なし |
| エコシステム成熟度 | 活発、Tauri 2 対応 | 言うまでもなし |
| CMD 13 本規模での費用対効果 | 初期導入コスト回収可能 | 全 CMD に重複宣言、更新漏れリスク増大 |
| 本プロジェクト適合性 | ★★★（CMD 13 本 + 今後拡張） | ★ |

**判定プロセス（別セッションで実施）**:
1. `specta` / `tauri-specta` を `Cargo.toml` に追加
2. 1 コマンドだけ `#[tauri::command]` + `#[specta::specta]` で注釈 → `collect_commands!` で TS 生成
3. 生成された型が Rust 側と一致するか確認（2h タイムボックス）
4. 詰まったら手動方式にフォールバック、決定結果を本節に追記

**暫定傾斜**: CMD 13 本すでに実装済み + 今後 UI 層 invocation が全画面で増える見込みのため、自動生成が有利。ただし specta 3.x が Tauri 2 で安定か要検証。

**決定: tauri-specta v2.0.0-rc.24 + specta v2.0.0-rc.24 + specta-typescript v0.0.11 採用**（2026-04-20）

根拠（優先度順）:
1. Rust 中心の型設計との整合（単一ソース、SSOT 原則）
2. 45 commands 規模の 2 重管理リスク回避（spike で 7 types / 1 command の実装コスト実測、全展開で 2-4h と見積もり）
3. docstring 連携で業務仕様が UI 層のエディタ補完に到達
4. 生成された型の品質が実用レベル（serde(flatten) intersection / generic / enum / Option<T> / JSDoc すべて正確に変換）
5. 既存 556 tests への影響ゼロ

Phase 1 時点での specta 適用コマンド: `search_products`, `get_product`（2 本）。
残 43 commands は Phase 2 以降で段階的に展開。

詳細根拠・実測データ・バージョン互換性は [ADR-002](research/2026-04-20-invoke-type-adr.md) 参照。
spike branch: `spike/invoke-specta`。

#### TanStack Query キャッシュ戦略（Plans.md 7-5b）

**queryKey 命名規約**（2026-04-20 追記、実機運用で要検証）:

```ts
['entity', operation, ...params]

// 例:
['product', 'list', { page, keyword }]
['product', 'detail', productCode]
['sales', 'daily', saleDate]
['sales', 'monthly', yearMonth]
['inventory', 'low']
['inventory', 'movements', productCode]
['plu', 'dirty']
['stocktake', 'active']
['settings']
```

**画面別 staleTime / gcTime 初期案**（業務特性で調整、v0.7.0 完了後に実測）:

| 画面 / クエリ | staleTime | gcTime | 理由 |
|---------------|-----------|--------|------|
| 商品一覧 / 検索（UI-01a） | 30s | 5min | CRUD 頻度中、数秒のキャッシュで十分 |
| 商品詳細（UI-01b） | 0 | 5min | 編集画面から戻った時は即時再取得 |
| 在庫照会（UI-00 ホーム / UI-06a） | 10s | 5min | CSV 取込み直後に即時反映したい |
| 在庫少一覧（UI-06b） | 30s | 5min | 閾値表示、頻繁には変わらない |
| 変動履歴（UI-06c） | 1min | 10min | 過去データ中心、鮮度低優先 |
| 日次売上（UI-09a） | 5min | 30min | 集計結果、頻繁には変わらない |
| 月次売上（UI-09b） | 5min | 30min | 同上 |
| PLU 未反映件数（UI-00 / UI-08） | 30s | 5min | `confirm_plu_export_saved` 後の反映重要。PLUファイル生成だけではdirty状態を変えない |
| 棚卸し進行中（UI-10） | 0 | 5min | カウント入力は常に最新を参照 |
| 設定（UI-11a） | Infinity | Infinity | 明示 `invalidate` 時のみ再取得 |

**invalidation pattern**:
- CMD 成功後、該当 entity の全 query を invalidate（例: 商品登録成功 → `queryClient.invalidateQueries({ queryKey: ['product'] })` で配下全無効化）
- 大量 invalidate は mutation の `onSuccess` に集約、UI コンポーネント側にはばらまかない
- 棚卸し確定 / CSV 取込み完了は複数 entity を同時 invalidate（`['inventory']` + `['product']` + `['sales']`）

**判定**: 本表は初期案。v0.7.0 完了後の実運用で `refetchOnWindowFocus` / `refetchOnMount` 動作込みで再調整する。

**Phase 1 時点の確定値: 本表そのまま採用 + 補強 6 項目**（2026-04-20）

補強事項:
1. queryKey 第 3 要素はオブジェクト形式（`['product', 'list', { page, keyword }]`）で統一、tauri-specta の `commands.searchProducts(query)` と同形状
2. TanStack Router `loader` との統合は `queryOptions` ヘルパーで key + fn を 1 箇所に集約
3. `typedError<T, E>` wrapper の `res.status === 'ok'` 分岐を mutation `onSuccess` で必須
4. グローバル `defaultOptions`: `refetchOnWindowFocus: false`（デスクトップアプリ）, `retry: 1`（CmdError は業務ロジック由来）
5. invalidation は mutation の onSuccess に集約、UI コンポーネント側にばらまかない
6. 複数 entity の同時 invalidate は明示リスト化（例: CSV 取込み完了 → `['inventory']` + `['product']` + `['sales']`）

再調整トリガー 6 項目と Phase 2 完了時の実測再評価ポリシーは [ADR-003](research/2026-04-20-query-cache-adr.md) 参照。

### 2.6 State — Zustand 5

**選定理由**:
- **軽量**: ライブラリ本体 ~3KB、学習コスト低
- **選択的レンダリング**: `useStore(s => s.field)` で購読フィールド単位の再レンダ
- **TypeScript 優秀**: `create<T>()(set => ...)` パターンで型推論強い
- **Middleware**: `persist`（LocalStorage）/`immer`/`devtools` がオプションで必要時のみ

**本プロジェクトでの使用範囲（最小限）**:
- アプリ設定キャッシュ（低在庫閾値、バックアップ設定）
- 全画面共通の UIステート（サイドバー開閉、通知バー表示状態）
- **業務データそのものは持たない** — TanStack Query のキャッシュが Source of Truth

**比較した他候補**:
| 候補 | 理由で見送り |
|------|------------|
| Redux Toolkit | ボイラープレート過多、業務アプリに必要な規模でない |
| Jotai | アトム設計の学習コスト、Zustand で十分 |
| Recoil | 開発停滞、採用非推奨 |
| React Context + useReducer | 大規模になると再レンダ最適化が困難 |
| XState | 状態マシンは魅力だが CSV取込み等のフロー以外で過剰 |

**trade-off**: CSV取込みの「Parse → Validate → Preview → Commit」フローは状態マシンに相当。Phase 2 着手時に「Zustand + switch-case」で足りるか XState 導入か再検討（§7 保留事項）。

### 2.7 Forms — React Hook Form + Zod 4

**選定理由**:
- **React Hook Form**: Uncontrolled方式で再レンダ最小、パフォーマンスで controlled form 系を圧倒
- **Zod 4**: TypeScript 型推論と双方向の `z.infer<typeof schema>`、スキーマ駆動で同一バリデーションを Rust 側 BIZ層と概念整合
- **shadcn/ui Form**: 公式 `Form` コンポーネントが RHF+Zod 前提、エラー表示・ラベル紐付けまでレシピ化

**比較した他候補**:
| 候補 | 理由で見送り |
|------|------------|
| Formik | 再レンダ性能で RHF に劣る、メンテ停滞気味 |
| TanStack Form | 注目株だが shadcn/ui エコシステムがまだ RHF 前提 |
| Yup | Zod の方が TypeScript 型推論で優位 |
| Valibot | 軽量だが Zod 4 で軽量化済み、エコシステム差で Zod |
| 自作バリデーション | 商品登録・棚卸しカウント・売価変更で数十のバリデーションルール、自作は非現実的 |

**導入対象画面**:
- UI-01b 商品登録・編集（REQ-101, 102）
- UI-01c 一括インポート（REQ-104）のマッピング確認
- UI-02 入庫記録（REQ-201）
- UI-10 棚卸しカウント入力（REQ-205）
- UI-11 設定（閾値・バックアップパス）

**Zod スキーマ配置**: `src/schemas/` 配下にモジュール別（product.ts / inventory.ts / stocktake.ts）。CMD層の DTO と 1:1 対応させ、スキーマ変更時に型エラーで検知。

### 2補. Testing — Vitest + React Testing Library + @axe-core/react

**Vitest（単体・統合）**:
- **対象**: カスタムHook、Zod スキーマ、フォームバリデーション、複雑な派生ステート
- **不対象**: 純表示コンポーネント（shadcn/ui のラップのみ）、Storybookで視覚確認すれば十分
- **Setup 実装済 (Phase 1 7-7a、PR #64 squash merge `2b30f43`、2026-05-17)**: vitest 4.1.5 + happy-dom + path alias + setupFiles 構成で TDD 基盤起動。option A 純関数 only 75 ケース (count-stock-status / extractFilename / formatErrorRow / reducer 6 state × 9 action transition + focused payload carry) で開始。Mini Shai-Hulud worm 警戒下の限定 install 適用 (memory [[feedback-npm-install-blocked-mini-shai-hulud-2026-05]] 限定例外条項)、setup pattern 集約は memory [[feedback-vitest-react19-setup-pattern]] 参照。後続 7-7b で `@axe-core/react` + hooks/components test 拡張予定

**React Testing Library + @testing-library/user-event**: ユーザー操作起点のテスト。`getByRole` / `getByLabelText` 優先で A11y も同時検証。**Setup 実装済**: @testing-library/react 16.3.2 + user-event 14.6.1 + jest-dom 6.9.1 を Phase 1 7-7a で導入、7-7b hooks/components test で本格利用。

**FE テスト ID 規約（2026-06-11 追加、WF-TRACE-04）**: 各 `*.test.{ts,tsx}` は describe/it 文字列に `REQ-NNN` または `UI-NN`（`UI-01a` 形式、設計決定 ID `UI-NNx-Dn` 含む）を最低 1 箇所含める。機械 gate（`cd src-tauri && cargo run --bin generate_traceability -- --check` の T4）は**ファイル内 presence 検査**にとどまり、describe/it への配置は規約側の要請という強度差がある（comment のみの参照でも T4 は通過する。既知例: `src/features/csv-import/reducer.test.ts` は comment のみの `UI-07` 参照で、describe/it への移動は backfill follow-up 対象）。既存の未参照 17 ファイルは baseline として固定済みで、増減どちらも CI / pre-push の ERROR になる（意図的に減らした場合は bin の `FE_UNREFERENCED_BASELINE` を更新して再生成）。backfill は per-feature の仕様読みを伴うため、1 ファイルずつ follow-up PR で baseline を下げる。

**Playwright + @tauri-apps/plugin-testing（E2E）**: Phase 2 tag gate には採用しない（§7.2）。Vitest + React Testing Library と Windows native H-6 利用者確認で Phase 2 完了判断を行う。Phase 3 / Phase 4 で画面横断 regressions が増えた場合、または global text-size / display-scale option のような横断 UI 変更を入れる場合に smoke E2E として再検討する。

**@axe-core/react（A11y）**: 各画面のルート Component で自動監査。WCAG 2.1 AA 違反は ERROR、AAは WARN。CI で ERROR をブロック。**7-7b で導入予定** (Phase 1 7-7a では未統合)。

<!-- reviewed: 2026-05-17 (Phase 1 7-7a Vitest setup 実装済コメント追記、PR #64 squash merge `2b30f43`) -->

---

## 3. 不採用とその理由

trade-off の形で記録する。採用候補だが見送った理由を明文化することで、後続のメンバー（将来の自分含む）が再検討時に文脈を失わない。

### 3.1 状態管理系

| 候補 | 不採用理由 |
|------|----------|
| Redux Toolkit | Zustand で十分、ボイラープレート不要、業務アプリの状態規模に対して過剰設計 |
| Redux + Redux Toolkit Query | TanStack Query で同じ機能が得られ、Redux の学習曲線を回避 |
| Jotai | アトム指向の学習コストに見合うメリットがない規模感 |
| Recoil | 開発停滞、公式非推奨化の兆候 |
| XState | CSV取込みフローのみで使いたいが、1箇所のために入れるのは過剰。**必要性が明確になれば再検討** |

### 3.2 UIコンポーネント系

| 候補 | 不採用理由 |
|------|----------|
| Material-UI (MUI) | Material Design の世界観が業務アプリの落ち着きと合わない、バンドルサイズが大きい |
| Chakra UI v3 | スタイルシステム変更でエコシステム分断、Tailwind との相性 |
| Mantine | Emotion ベースで Tailwind の純度を下げる |
| Ant Design | 中華系エンタープライズの装飾が業務アプリの美学と不整合 |
| Headless UI | Radix に比べ部品不足、shadcn/ui が事実上の後継 |

### 3.3 テーブル系

| 候補 | 不採用理由 |
|------|----------|
| AG Grid Community | UI が shadcn/ui と分離、Enterprise機能が有料 |
| MUI DataGrid | MUI 前提、本プロジェクトで MUI 不採用 |
| Material React Table | 同上 |

### 3.4 Skill / デザインシステム

| 候補 | 不採用理由 |
|------|----------|
| theme-factory (anthropic/skills) | スライド・LPのテーマプリセット、業務アプリ向けでない |
| brand-guidelines (anthropic/skills) | Anthropic自社ブランド適用用、個人経営店アプリに Poppins/Lora を使う意味なし |
| ui-ux-pro-max (nextlevelbuilder) | SaaS LP生成寄りの自動化、業務アプリ内部UIと設計思想が逆 |
| frontend-design (anthropic/skills) | 「個性的なボールド美学」志向が業務アプリに過剰。**観点のみ参考**（汎用AI的な見た目を避ける意識） |
| macOS HIG / iPadOS HIG 系 Skill | AppKit/SwiftUI 前提で Tauri+WebView2 と技術不整合 |
| Microsoft Fluent UI React | Fluent 2 **哲学**は参照するが、コンポーネントライブラリは shadcn/ui と二重になるため不採用 |

### 3.5 国際化・Responsive

| 候補 | 不採用理由 |
|------|----------|
| react-i18next / Lingui / FormatJS | 日本語UI固定、国際化要件なし |
| Responsive breakpoints（`sm:` / `md:` / `lg:`） | デスクトップ固定、WebView2 の Windows 最小解像度 1024x768 以上を前提に固定レイアウト |

Tauri 初期ウィンドウは `src-tauri/tauri.conf.json` で 1280x800、最小 1024x720、中央表示にする。800x600 は在庫照会・売上表などの日常業務テーブルで横幅不足になりやすいため採用しない。

**将来の再検討トリガー**: 宅急便部門を含む店舗間展開、モバイル対応要望、海外展開。いずれも現時点では想定外。

<!-- reviewed: 2026-04-16 -->

---

## 4. デザインシステム

デザインシステムの正典は [`design-system/README.md`](design-system/README.md) を参照。本節は索引スタブ。

| サブ docs | 主な内容 |
|---------|--------|
| [design-system/00-foundations.md](design-system/00-foundations.md) | カラーパレット・セマンティックトークン・タイポグラフィ・スペーシング・アイコンサイズ・業務ステータス視認性 |
| [design-system/01-decision-rules.md](design-system/01-decision-rules.md) | DSR-01〜13 実装判断ルール集 |
| [design-system/02-component-catalog.md](design-system/02-component-catalog.md) | 13 パターンカタログ（⑤SegmentedControl / ⑥空状態・ローディング / ⑦Toast / ⑧Dialog / ⑬ステータスバッジ 等） |
| [design-system/03-philosophy.md](design-system/03-philosophy.md) | 核心4本柱・補助3原則・japanese-webdesign 観点借用・参考位置付け |

---

## 5. A11y + キーボード操作要件

### 5.1 基本方針

**WCAG 2.1 AA 準拠**を最低ラインとし、**キーボード操作のみで全業務を完結できる**ことを本プロジェクト固有の要件とする。

**根拠**:
- ux-principles（Nielsen ヒューリスティクス + WCAG）
- IBM Carbon: A11y は装飾でなくインフラ
- 本プロジェクト固有: バーコードスキャナが HID キーボードとして入力するため、**キーボードフォーカスが業務フローの中心**

### 5.2 キーボード操作仕様

#### 標準キーマッピング

| キー | 動作 |
|------|------|
| Tab / Shift+Tab | 次 / 前のフォーカス可能要素 |
| Enter | 確定 / 次のフィールドへ（フォーム連続入力）/ テーブル行選択 |
| Space | ボタン押下 / チェックボックス / ラジオ |
| Esc | ダイアログ閉じる / 検索クリア / キャンセル |
| Arrow Up/Down | リスト・メニュー・テーブル行の移動 |
| Arrow Left/Right | タブ切替、日付ナビ |
| Home / End | リスト先頭 / 末尾 |

#### グローバルショートカット

| キー | 動作 | 実装画面 |
|------|------|---------|
| Ctrl+/ | ショートカット一覧表示 | 全画面（実装: [function-design/54-ui-shortcuts.md](function-design/54-ui-shortcuts.md)） |
| Ctrl+K | コマンドパレット / 検索 | 全画面（Backlog 8-6b、Phase 3 UI-01a と同時、cmdk 採用判定） |
| Alt+←/→ | ブラウザ的戻る/進む | 全画面（Backlog 8-6c、`router.history.back/forward` 1 commit） |

本プロジェクトでは Ctrl+S の保存ショートカットは**採用しない**（フォームは自動保存ではなく明示ボタンのため誤爆リスク大）。

### 5.3 バーコードスキャナー連携

**前提**: 市販のバーコードスキャナは USB 接続時に HID キーボードとして認識され、バーコード文字列を高速タイプし最後に Enter（または Tab）を送信する。

**設計**:
- **入庫記録画面（UI-02）**: 商品コード / JAN / 商品名を受ける商品追加欄にフォーカスを当てる。Enter 確定で検索し、1件なら行追加、追加後は同じ入力欄へフォーカスを戻して連続入力できるようにする。初回実装では global scan detection は置かない
- **返品・交換画面（UI-03）**: UI-02 と同じく商品追加欄にフォーカスを当てる。Enter 確定で検索し、1件なら現在の種別 / 方向ルールに従って行追加、追加後は同じ入力欄へフォーカスを戻す。初回実装では global scan detection は置かない
- **在庫照会画面（UI-06a）**: 検索ボックスに常にフォーカス。Enter で検索実行 + 結果1件なら自動展開
- **商品登録画面（UI-01b）**: JAN欄にフォーカスを当て、スキャン後に「既存商品あり」ダイアログ自動表示

**実装要件**:
- スキャン中は他のキー入力（例: メニュー操作）を**中断しない**（フォーカス奪取しない）
- スキャン検知ロジックを導入する場合は、連続した文字入力の間隔が20ms未満 → バーコードと判定（一般的な閾値）を候補にする。ただし UI-02 初回実装では focused field + Enter で扱い、検知ロジックは実店舗確認後の follow-up とする

### 5.4 フォーカス管理

- **フォーカスリング明示**: shadcn/ui の `ring-2 ring-ring ring-offset-2` を全フォーカス可能要素で維持。ブラウザデフォルトの outline は抑制しない（見た目カスタマイズするが可視性は保持）
- **フォーカストラップ**: Dialog / AlertDialog / Sheet 内では Tab でダイアログ外に出ない。Radix UI の仕様で標準装備
- **初期フォーカス**: 各画面の「一番使う要素」に自動フォーカス（検索画面なら検索ボックス、フォーム画面なら先頭入力）

### 5.5 コントラスト比

| 要素 | 最低比率 | 本プロジェクト目標 |
|------|---------|-----------------|
| 本文 | 4.5:1 (AA) | 7:1 (AAA) |
| 大きな文字 (18px+ or 14px+bold) | 3:1 (AA) | 4.5:1 (AA+) |
| UI コンポーネント境界 | 3:1 | 4.5:1 |
| フォーカスリング | 3:1 | 4.5:1 |

### 5.5.1 色だけに依存しない状態表示

→ 正典は [design-system/02-component-catalog.md](design-system/02-component-catalog.md) §⑥「色だけに依存しない状態表示」を参照。

### 5.6 タッチ領域

デスクトップアプリだが、**ボタン最小サイズ 44x44px**（WCAG 2.1 AAA）を遵守。理由: 高齢店主・疲労時の誤タップ防止、将来のタブレット展開余地。

### 5.7 日本語UI特有の配慮

- **文字長**: 日本語は英語の 1.5 倍程度の文字数になる場合あり（例: "Save" → "保存"=短縮 / "Cancel" → "キャンセル"=延長）。ボタン・ラベル・カラム見出しは**内容に応じた幅伸縮**または**2段組折り返し許可**
- **禁則処理**: 文末の句点（。）・括弧閉じがはみ出さないように `word-break: keep-all` と `overflow-wrap: break-word` を適切に使い分け
- **IME**: 日本語変換確定の Enter で誤送信しないよう、検索ボックス等では `onCompositionEnd` を考慮

<!-- reviewed: 2026-04-16 -->

---

## 6. 横断UI要素と Tauri 特有の決定

### 6.1 通知の使い分け（Toast / Dialog / Banner）

→ 正典は [design-system/02-component-catalog.md](design-system/02-component-catalog.md) §⑦「Toast」・§⑧「Dialog / 確認ダイアログ」を参照。

### 6.2 ローディング状態の標準UI

→ 正典は [design-system/02-component-catalog.md](design-system/02-component-catalog.md) §⑥「空状態・エラー・ローディング」を参照。

### 6.3 空状態（Empty State）の標準UI

→ 正典は [design-system/02-component-catalog.md](design-system/02-component-catalog.md) §⑥「空状態・エラー・ローディング」を参照。

### 6.4 CmdError → ユーザー向け日本語メッセージ変換表

CMD層の `CmdError` は `kind: 'validation' | 'duplicate' | 'not_found' | 'internal'` と `message: string` を持つ。UIでの表示変換:

| kind | UI表示戦略 | 例 |
|------|----------|---|
| `validation` | `message` をそのまま表示（BIZ/CMD層で日本語化済み） | "JANコードは13桁または8桁で入力してください" |
| `duplicate` | `message` + 既存レコードへの導線 | "商品コード HZ-0047 は既に登録されています。[既存商品を開く]" |
| `not_found` | `message` + 戻り先の提示 | "指定された商品が見つかりません。[商品一覧に戻る]" |
| `internal` | 汎用文言 + 詳細は **ログに誘導** + 操作ログID表示 | "処理中にエラーが発生しました（操作ID: log_12345）。操作ログ画面で詳細を確認できます。" |

`internal` の場合の原因詳細はファイルログ（MNT-04）に記録され、ユーザーは UI-11 の操作ログ画面 + ログファイルディレクトリから追跡可能。

### 6.5 Tauri 特有の決定

#### 6.5.1 WebView2（Windows）と WebKit（macOS/Linux）の互換性

- **主ターゲット**: Windows 10 21H2+ / WebView2 Evergreen（自動更新）
- **副ターゲット**: 開発環境（macOS/Linux）の WebKit。CI でも同時ビルド
- **互換性チェック方針**: `Can I Use` で Baseline 対応を確認、Baseline 未対応機能は使わない。React 19 の新機能（`use()` Hook 等）は WebView2 119+ 対応済み
- **実機確認**: Phase 1 完了時と Phase 2 完了時に Windows 実機で全操作確認

#### 6.5.2 CSP (Content Security Policy)

- `tauri.conf.json` の `app.security.csp` に以下を設定予定:
  - `default-src 'self'`
  - `script-src 'self'`（`unsafe-inline` 禁止）
  - `style-src 'self' 'unsafe-inline'`（Tailwindで必要）
  - `img-src 'self' data: asset:`（レシート画像用）
  - `connect-src 'self' tauri:`
- 外部URLへの通信は **禁止**（ローカルアプリ完結）

#### 6.5.3 IPC 性能（invoke 呼出し）

- **原則**: 1 invoke = 1業務操作。チャンク化や頻繁な呼出しは避ける
- **大量データ**: CSV取込みは Rust側で完結しJSON返却は件数サマリのみ、Excel プレビュー等は先頭50行のみ
- **ストリーミング**: 現時点では不要。棚卸し等の長時間処理は `channel()` (@tauri-apps/api 2) で進捗通知予定（§7 保留）

#### 6.5.4 ネイティブダイアログ

- **ファイル選択・保存**: `@tauri-apps/plugin-dialog` のネイティブダイアログを使用（Web UIで完結させない）
- **理由**: OS標準の親しみやすさ、最近使用フォルダ記憶、ショートカット互換
- **適用場面**: CSV取込みファイル選択、CSV/TSV書出し先指定、バックアップ復元ファイル選択、レシート画像選択
- **導入状態**: `@tauri-apps/plugin-dialog` / `tauri-plugin-dialog` は UI-08 PLU 書出し前の foundation PR で導入済み（2026-06-26）。初回の operator-facing 利用は UI-08 とし、`prepare_plu_export` で生成したCV17 1.1.1向けタブ区切り `.txt` を native save dialog で保存してから、利用者が明示した場合だけ `confirm_plu_export_saved` でPLU未反映を外す。

**ファイル取込み画面における暫定例外と移行状況**: UI-07 のZ004商品別CSV取込み、UI-01c 商品一括インポート（2026-06-25 Design Phase）、UI-03 返品・交換のレシート画像（`saveReceiptImage` が base64 bytes を受け取る）は、plain `<input type="file">` + drag&drop の file bytes 方式を暫定例外として維持する。これらは Windows native で HTML5 drag/drop を frontend の `onDrop` へ通すため、`src-tauri/tauri.conf.json` の main window は `dragDropEnabled: false` のままにする。

**日報取込みは path-based input へ移行済み（移行第一号、2026-07-04 PR #125）**: REQ-401 日報取込み（Z001/Z002/Z005）は当初 HTML input の複数ファイル選択で実装したが、Windows native L3 で WebView2 が HTML file input のネイティブダイアログ起動後に DOM 変化まで画面を再描画しない白画面バグ（JS 例外なし・console 無出力、選択後の state 遷移で復帰）を踏んだため、`@tauri-apps/plugin-dialog.open()` + `@tauri-apps/plugin-fs.readFile()`（capability: `dialog:allow-open` + `fs:allow-read-file`）の path-based 方式へ切り替えた。open() のキャンセル（null）は state 据え置きで安全。残りの暫定例外画面の移行は Plans.md backlog「ファイル選択 UI の共通化（FilePicker パターン + plugin-dialog 移行統合）」で扱い、複数ファイル取込み画面を優先する（同バグの再発リスクがあるため）。

### 6.6 ダークモード見送り

**決定**: Phase 1〜4 で**ダークモード対応はしない**。

**理由**:
- 手芸店の**日中業務**が前提（朝開店〜夕方閉店）
- 実装・検証コストが増す（カラートークン全て2セット）
- GOV.UK の Do less 原則

**再検討トリガー**:
- 利用者から明示要望
- 夜間業務が発生（年末商戦の深夜業務等）
- OS全体ダーク強制時の可読性問題が実機で発生

### 6.7 画像アップロードUI（レシート画像）

- **対象画面**: UI-03 返品・交換（REQ-202）
- **UI**: ドロップゾーン + ファイル選択ボタン + プレビューサムネイル
- **保存**: 初回 UI-03 実装は既存 `saveReceiptImage` command に base64 bytes + extension を渡し、IO-06 `image_manager` がアプリデータ配下へ保存した相対パスを `return_records.receipt_image_path` に格納する
- **リサイズ**: 初回 UI-03 実装では圧縮・リサイズを行わない。現行 IO-06 は画像保存と相対パス管理のみを持つため、長辺1200px以下への圧縮は画像処理 crate と品質設定を含む別 Design Phase で扱う
- **プレビュー**: 保存前は `URL.createObjectURL(file)` で選択中ファイルを表示する。保存済み画像の `asset://` 表示は、返品詳細表示 / 画像再表示を実装する時点で Tauri 許可設定と合わせて設計する
- **削除**: 明示的な「画像を削除」ボタン、確認ダイアログ不要（再度アップロード可能）

### 6.8 CSV / TSV ダウンロードUI

- **保存方式**: Tauri ネイティブの保存ダイアログ（§6.5.4）でファイル保存先を利用者選択
- **ブラウザDL方式は不採用**: Tauri アプリでは不自然、保存先指定が効かない
- **適用場面**: 日次・月次売上CSV（REQ-501/502）、PLUタブ区切りテキスト（REQ-402）、変動履歴CSV（REQ-303）
- **PLUファイルの状態更新**: UI-08ではファイル生成・保存と `plu_dirty` 更新を分ける。保存キャンセル、保存失敗、PCツール投入失敗前は未反映を残し、Diff再書出しを可能にする。保存後に利用者が「この書出しを未反映から外す」を押した時だけ、prepare結果の対象商品を app-side exported state に更新する（D-027）。
- **PLUファイル形式**: UI-08 はCV17 1.1.1 `スキャニングPLU(商品)` import dialog に合わせて `.txt` を既定保存拡張子にする。中身はCP932 / CRLF / tab-delimited であり、ブラウザ側で文字列再エンコードしない。
- **外部ツールをまたぐ未完了状態**: UI-08 のようにアプリ外のPCツール / SDカード / レジ操作を挟む場合、画面を開きっぱなしにする前提にしない。保存済みだが確認未完了の状態は、履歴DBではなく軽量な復帰用 `localStorage` に最小メタデータだけを保持し、次回表示時に上部 Alert から継続または破棄できるようにする。PLUファイル本文、JAN、商品名、価格などのファイル内容は browser storage に保存しない。

<!-- reviewed: 2026-04-16 -->

### 6.9 環境変数設計（.env / VITE_ prefix 公開性）

#### セキュリティ前提

- **Vite `VITE_` prefix 変数はクライアントサイド JS バンドルに平文で埋め込まれる**。bundled output を開けば誰でも読める = **公開情報扱い必須**
- **Tauri デスクトップ配布 binary は逆アセンブル可能**。frontend 側に真の秘密は原理的に置けない
- **秘密情報が必要になった場合**（将来のバックアップ暗号化鍵 / クラウド同期等）は Rust 側 OS keychain (keyring crate) 経由が原則。frontend env には絶対に置かない
- 現状 Phase 1-2 では真の秘密は発生しない（ローカル SQLite のみ、外部 API 連携なし）が、設計原則は今確立する

#### ファイル構成

| ファイル | git 管理 | 用途 | 値の性質 |
|---------|---------|------|---------|
| `.env.example` | commit | 変数一覧テンプレート、ヘッダコメントに公開性原則明記 | 値なし |
| `.env.development` | commit | dev 時デフォルト（`VITE_DEBUG=true`） | 公開可能値のみ |
| `.env.test` | commit | テスト時デフォルト（両方 false） | 公開可能値のみ |
| `.env.production` | commit | 本番ビルド時デフォルト（両方 false 強制） | 公開可能値のみ |
| `.env` | **gitignore** | 個人機固有上書き | 何でも書ける |
| `.env.local` / `.env.*.local` | **gitignore** | 環境別個人機上書き | 同上 |

Vite の読み込み順序は `.env` → `.env.{mode}` → `.env.{mode}.local` → `.env.local`（後勝ち）。

#### 命名規約

- `VITE_DEBUG` (boolean, default false): devtools 有効化、TanStack Query devtools、詳細 console ログ
- `VITE_MOCK_MODE` (boolean, default false): backend IPC を mock 実装に差し替え（将来の UI-09a/b 等で実測値なしの開発用）
- `VITE_APP_VERSION`: `package.json` の version を `vite.config.ts` の `define` で注入（env ファイルには書かない、ビルド時固定）

**禁止命名**:

- `VITE_*_SECRET` / `VITE_*_KEY` / `VITE_*_TOKEN` / `VITE_*_PASSWORD` — バンドル公開されるため原理的にアウト

#### 型定義と accessor

- 型定義: `src/vite-env.d.ts` に `ImportMetaEnv` interface を拡張
- boolean 変換 helper: `src/lib/env.ts` に `isDebug` / `isMockMode` const をエクスポート
- **厳格 equality**（`=== 'true'`）で評価し、`'1'` / `'yes'` / 空文字等での意図しない true 判定を防ぐ

#### CI 静的検査

`scripts/check-env-safety.sh` を CI frontend job + pre-push hook に統合:

1. `.env.production` に `VITE_DEBUG=true` / `VITE_MOCK_MODE=true` が無いか（quote / case / trailing comment の bypass 経路に対応。本番で devtools / mock が動く事故防止）
2. `.env.{development,test,production}` の `VITE_*` 変数名に `SECRET` / `TOKEN` / `KEY` / `PASSWORD` が word boundary（underscore 区切り）で含まれないか（誤って VITE_ prefix で秘密を置く事故防止）— `.env.example` はドキュメント目的で除外
3. `.gitignore` に `.env` / `.env.local` / `.env.*.local` が記載されているか
4. `git ls-files` で `.env` / `.env.local` / `.env.*.local` が tracked になっていないか（subfolder 配下 `src-tauri/.env` 等や大文字含む `.env.Development.local` も対象）

失敗時は事故前提で block（CI red、pre-push reject）。pre-push トリガーは env file か `.gitignore` 変更時のみ（CI 側で最終 gate、pre-push は予防層）。

**この検査の限界**:

- typo / うっかり対策であり、変数名を偽装した意図的リーク（例: `VITE_FOO=secret_abc`）は検出できない
- 秘密語の検出範囲は `SECRET` / `TOKEN` / `KEY` / `PASSWORD` のみ。複数形 (`KEYS` / `TOKENS`) や `AUTH` / `CREDENTIAL` / `PRIVATE` / `HASH` 等は現在未対応（必要時に `scripts/check-env-safety.sh` の `CHECK2_PATTERN` に追加）
- 秘密の本格管理は Rust 側 OS keychain (`keyring` crate) 経由が原則

<!-- reviewed: 2026-04-21 -->

---

## 7. リスクと保留事項 / 更新履歴

### 7.1 Phase 1 着手時に決定する事項

#### ルーティング選定: TanStack Router vs React Router v7（Plans.md 7-4）

**比較表**（2026-04-20 追記、実機試行は別セッション）:

| 評価軸 | TanStack Router | React Router v7 |
|--------|-----------------|-----------------|
| 型安全性 | ネイティブ TypeScript、route param が型推論 | `type-safe-routes` 等の補助が別途必要 |
| TanStack Query 統合 | 同一作者、`loader` ↔ Query の親和性高 | 独立。ブリッジコードが必要 |
| 学習コスト | 新しめ、情報量は React Router より少 | 業界標準、情報量豊富 |
| バンドルサイズ | 大きめ | 小さめ |
| エコシステム成熟度 | 活発、devtools 充実 | 業界標準、長期安定 |
| 本プロジェクト適合性 | ★★★（Query と同期しやすい業務UI 向き） | ★★ |

**判定プロセス（別セッションで実施）**:
1. 別 branch に TanStack Router を install → UI-12 のサイドバー遷移を実装（2h）
2. 詰まったら React Router v7 で同じ範囲を実装して両方の感触を記録
3. 決定結果 + 根拠を本節に「決定: ○○ / 根拠: ○○」として追記

**暫定傾斜**: TanStack Query を採用済み（§2.5）のため、同一作者の TanStack Router と `loader` 経由で自然に統合できる利点が大きい。ただし Tauri + WebView2 でのバンドルサイズ影響を実機で確認してから最終判定。

**決定: TanStack Router v1.168.23 採用**（2026-04-20）

根拠（優先度順）:
1. 型安全な URL パラメータ（compile-time 検証）、19 画面規模でリファクタリング耐性優位
2. TanStack Query との同作者による自然な統合（`router context: { queryClient }` + `loader` 経由）
3. ファイルベース routing の DX（`src/routes/products.$productCode.tsx` → `/products/:productCode` 自動マップ）
4. バンドルサイズ差 0.6 kB gzip は Tauri 起動時間支配環境で無視可能（TanStack 114.78 / React Router 115.39 kB gzip）
5. 自動 code-splitting（route 単位で chunk 分離、Phase 4 の 19 画面実装で効果大）

詳細根拠・実測データ・Option B 棄却理由は [ADR-001](research/2026-04-20-router-adr.md) 参照。
両 spike branch は比較資産として remote 保持: `spike/router-tanstack` / `spike/router-react-router`。

#### Storybook 導入判断

- **採用する場合**: shadcn/ui コンポーネントのカタログ化 + デザインシステム視覚確認
- **見送る場合**: プロジェクトが1人運用で、コンポーネントの共有先がないため過剰になる可能性
- **判定タイミング**: Phase 1 の UI-12 共通レイアウト完成後。コンポーネント数が10個を超えたら採用

### 7.2 Phase 2 完了時判定 / 保留事項

#### E2E テスト範囲

- **選択肢A**: 毎日使う5画面のみ E2E で「CSV取込み→在庫確認→売上レポート」の1フロー
- **選択肢B**: 全画面 E2E（Phase 4 終了後）
- **選択肢C**: E2E 完全見送り、Vitest + 実機手動テストで代替

**決定（2026-06-07 / Phase 2 8-9）**: Phase 2 tag gate では **選択肢C** を採用する。日常利用 5 画面は code-complete / route active 済みで、各 PR の Vitest + React Testing Library による role / text / state / structure 検証と、H-6 Windows native 5 画面通し利用者確認で完了判断に必要な証跡を満たした。現時点で Playwright / Tauri E2E を追加すると、依存・環境・CI 運用のコストが Phase 2 completion gate としては過剰になる。

**評価タイミング**:
1. global text-size / display-scale option の実装プラン作成時: 全画面横断の表示崩れを検知する smoke E2E / screenshot diff の要否を確認する（2026-06-07 follow-up では targeted RTL + Windows native L3 を採用し、smoke E2E は Phase 3 の最初の画面横断 workflow で再評価する）
2. Phase 3 の最初の画面横断 workflow 実装プラン作成時: CSV 取込みから商品・在庫・売上へまたがる smoke E2E の要否を確認する
3. Phase 4 完了後、`v1.0.0` 候補を切る前: 全画面 E2E（選択肢B）まで広げる必要があるか再判断する

**臨時再検討トリガ**: 画面横断 regressions が複数 PR で続いた場合は、上記タイミングを待たずに選択肢A相当の smoke E2E を再評価する。

#### 視覚回帰テスト

- **Chromatic**: Storybook 採用時のみ検討、ただし月額コスト
- **Playwright スクショ**: E2E 採用時に追加コスト小で導入可
- **見送り**: Phase 2 デモで「見た目が毎回同じ」が重視されなければ不要

**決定（2026-06-07 / Phase 2 8-9）**: Phase 2 tag gate では見送り。H-6 Windows native 5 画面通し確認では商品コードが小さい点以外の視認性問題はなく、商品コード readability は将来の global text-size / display-scale option と合わせて調整する follow-up として分離した。Phase 2 completion gate では、設計書・テスト・実利用者確認で一貫性を担保する。

**評価タイミング**:
1. global text-size / display-scale option の実装プラン作成時: typography / density / status 表示の横断変更に対して lightweight screenshot diff が必要か確認する（2026-06-07 follow-up では新規 screenshot-diff gate は追加せず、targeted RTL + Windows native L3 で確認する）
2. Storybook 採用判断時: Chromatic の費用対効果を確認する
3. smoke E2E 採用判断時: Playwright screenshot を同時に入れるか確認する

**臨時再検討トリガ**: 視認性・表示崩れ・状態色の regressions が複数 PR で続いた場合は、上記タイミングを待たずに visual regression を再評価する。

#### CSV取込みフローの状態管理

**採用済 (UI-07 PR #60 確定、2026-05-13)**: `useReducer + discriminated union + 画面ローカル hook (useCsvImportFlow)`。Zustand / XState のいずれも採用せず。

**採用根拠**:
- Zustand 未導入を `rg '"zustand"' package.json` = 0 件で実証（Phase 2 8-2 plan verify、本 PR で初導入回避）
- 状態数 6（idle / parsing / preview / importing / result / error）の直線フロー、並行 / cancel / resume なし → useReducer で十分
- discriminated union × reducer 純関数で TypeScript 型安全分岐 + Phase 1 7-7 Vitest 着手後に副作用ゼロで test 可能（54 組合せ）
- React 19 + TypeScript 標準パターンで追加依存ゼロ

**再検討トリガ**:
- 状態管理 Zustand 再検討: 画面横断で共有 UI state が発生（例: 取込み履歴一覧と取込み実行画面の同期）、cancel / retry / resume が複数画面で要求
- 状態管理 XState 再検討: 並行状態（例: parse と progress 通知の並走）が発生、状態図テスト資産化のニーズが顕在化

詳細根拠: [function-design/55-ui-csv-import.md §55.2 React State](function-design/55-ui-csv-import.md) / [docs/archive/plans/2026-05-13-phase-2-ui-07.md §2 確定 1](archive/plans/2026-05-13-phase-2-ui-07.md)。

#### IPC ストリーミング（Tauri channel）

**判定 (UI-07 PR #60 確定、2026-05-13)**: 不採用。`Loader2 + animate-spin` indeterminate spinner + 状態文言（"解析中…" / "取込み中…数百行で約 N 秒"）で代替。

**不採用根拠**:
- commit は単一 SQLite TX で 200ms / 500 行程度に収束（BIZ-03 設計）、partial progress 表示は rollback 時に誤認を招く
- parse-validate も 1-3 秒で完結する想定、channel + 進捗計算のオーバーヘッドが体感メリットを上回らない
- channel API 初導入は Rust 側 + frontend 側 + capabilities の 3 段拡張、UI-07 単独投入は scope 過剰

**再検討トリガ** (5 条件、いずれか該当で channel 採否を再評価):
- CSV 行数が**数万行規模**に伸びる業務変更（現状 1 日 ~500 行）
- parse-validate 実測が**平均 2 秒超**で利用者の体感に支障（Phase 2 完了時の利用者デモで実測判定）
- **cancel / pause / resume** 機能要求が顕在化（現状 commit 単一 TX のため abort 不可能）
- **画面外監視**ニーズ（例: バックグラウンド取込みの進捗通知）
- **UI-10 棚卸し**の長時間カウント処理で channel を採用する設計に決まった時、共通基盤として CSV 取込みにも展開

詳細根拠: [function-design/55-ui-csv-import.md §55.6 ローディング表示](function-design/55-ui-csv-import.md) / [docs/archive/plans/2026-05-13-phase-2-ui-07.md §2 確定 2](archive/plans/2026-05-13-phase-2-ui-07.md)。

### 7.3 japanese-webdesign Skill の正式採用検討

現在は観点借用のみ。正式採用（Skill インストール + プロジェクト設定）への移行条件:

| 条件 | 判定 |
|------|------|
| DL数 1000 超 | 現時点 111 |
| 第三者の技術記事による評価複数 | 現時点不明 |
| 本プロジェクトでの適用事例が章4.6.3 で5件以上蓄積 | Phase 2 完了時点で再計測 |

**再検討タイミング**: Phase 2 完了時点 + 各 Phase 末の STEP 5 再訪タイミング

### 7.4 更新履歴

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-04-16 | 初版作成。v0.6.0 タグ後、UI層実装準備。技術スタック7パート確定、デザインシステム4本柱＋補助3原則＋観点借用1件を定義 | kosei-w90607 + Claude |

<!-- reviewed: 2026-04-16 -->
