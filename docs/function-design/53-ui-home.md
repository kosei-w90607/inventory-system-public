> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: ARCHITECTURE.md（タスク仕様）、[ui-task-specs.md §UI-00](../architecture/ui-task-specs.md)（タスク要求）、[SCREEN_DESIGN.md §ホーム画面](../SCREEN_DESIGN.md)（レイアウト判断）、[2026-05-09-phase-2-ui-00.md](../archive/plans/2026-05-09-phase-2-ui-00.md)（実装プラン、本書の判断根拠）

## 53. UI-00: ホーム画面

### 本書のテンプレ判定（業務ロジックあり版、共通 6 項目）

UI 層関数設計書の 2 段階テンプレ（業務ロジック有無で使い分け、`memory/frontend-function-design-granularity.md`）に従い、UI-00 は**業務ロジックあり版**と判定する。

**判定根拠**:

- CMD 呼び出し: `commands.getDailySales` / `commands.listLowStock` / `commands.listPluDirty` / `commands.listCsvImports` の 4 件（4 useQuery 並列）
- 入力バリデーション: なし（純表示画面、入力フォーム無し）
- 画面内部 state 駆動のフロー分岐: PLU 通知バー条件表示 + 前日未取込み警告 + 部分障害許容時のカード単位 fallback

→ **業務ロジックあり版**。共通 6 項目（コンポーネント構成 / React State / CMD 呼び出し / 利用者操作フロー / エラー表示 / ローディング表示）+ ショートカット / 備考 / 非目的 + 更新履歴の 10 章構成。

| 種別 | 該当 UI |
|---|---|
| 業務ロジックあり版 | UI-00（本書）/ UI-01a/b/c / UI-02〜10 / UI-13 |
| 業務ロジックなし版 | UI-12（[52-ui-shared-layout.md](52-ui-shared-layout.md)） |

---

### 53.1 コンポーネント構成

| ファイル | 責務 |
|---|---|
| `src/routes/index.tsx` | 既存 search_products demo を撤去、`<HomePage />` mount のみに痩せる |
| `src/features/home/HomePage.tsx` | 最上位レイアウト。ヘッダ（タイトル + 今日の日付）+ PLU 通知バー + サマリ + 大ボタン群 |
| `src/features/home/components/PluNotificationBar.tsx` | 黄色バー。`pluDirtyCount >= 1` で表示、UI-08 へ遷移ボタン（pending: aria-disabled + cursor-not-allowed + onClick preventDefault、D-2） |
| `src/features/home/components/SummaryCards.tsx` | 3 カード束ね（昨日売上 / 在庫切れ / 在庫少） |
| `src/components/patterns/SummaryCard.tsx` | 単一カード。loading / error / data 3 状態（PR-B で `features/home/components/` から patterns/ へ移動、[59-ui-shared-patterns.md](59-ui-shared-patterns.md)） |
| `src/features/home/components/QuickActionGrid.tsx` | 「毎日の作業」2×2: CSV取込み / 売上レポート（日次）/ 在庫照会 / 商品管理（Q-1 採用、モックアップ準拠） |
| `src/features/home/components/InventoryActionGrid.tsx` | 「入庫・出庫」2×2: 入庫記録 / 返品・交換 / 手動販売出庫 / 廃棄・破損 |
| `src/features/home/components/MiscActionRow.tsx` | 「その他」3 ボタン: 棚卸し / バックアップ / 設定 |
| `src/features/home/components/ActionButton.tsx` | 大/中/小共通。引数: `navItemId: NavItem["id"]` のみ。内部で `navigation.ts` を参照して `status / to / label` を取得。pending 時 Tooltip + `aria-disabled` + `onClick preventDefault` + `cursor-not-allowed`（D-2 採用、HTML disabled は pointer-events ブロックで Tooltip hover が起動しないため不採用、prop drilling 回避で navigation が SSOT） |
| `src/features/home/hooks/useHomeSummary.ts` | 4 useQuery 束ね、`{ sales, lowStock, pluDirty, csvImports }` を返す（D-3） |
| `src/features/home/hooks/useYesterdayDate.ts` | JST 昨日の `YYYY-MM-DD` + Visibility API listener（24:00 またぎで再計算 → setState → queryKey 変化で再 fetch、D-9 / P2-A 反映） |
| `src/features/home/lib/count-stock-status.ts` | `ProductWithRelations[]` → `{ outOfStock, lowStock }` 純関数（D-1） |
| `src/features/home/types.ts` | `HomeSummaryState` 等の画面ローカル型 |
| `src/lib/query-keys.ts` | queryKeys helper（D-4、本 PR commit 3 で新設） |

**接続点**:

- `src/routes/index.tsx` の現行 search_products demo は本 PR commit 5 で `<HomePage />` mount に差し替え
- TanStack Query は既に `<App />` 直下で QueryClientProvider 接続済（PR #48 commit `c5f3786`）。新規プロバイダ追加なし

---

### 53.2 React State

UI-00 は 4 useQuery（D-3「独立 useQuery × 4」採用）+ 派生値で構成。`useState` ベースの内部 state は持たない。

#### 4 useQuery のデータ

| キー | 型 | 取得元 |
|---|---|---|
| `sales` | `DailySalesReport` | `commands.getDailySales(yesterday)` |
| `lowStock` | `ProductWithRelations[]` | `commands.listLowStock(false)` |
| `pluDirty` | `ProductResponse[]` | `commands.listPluDirty()`（D-028: `plu_target=1` かつ `plu_dirty=1` のみ。JANなし等の PLU 対象外商品は通知件数に入らない） |
| `csvImports` | `PaginatedResult<CsvImport>` | `commands.listCsvImports(1, 1)` |

#### 派生値（`useHomeSummary` 内で計算）

| 派生値 | 計算 | 計算箇所 |
|---|---|---|
| `outOfStockCount` | `countStockStatus(lowStock).outOfStock` | `lib/count-stock-status.ts` 純関数を `useHomeSummary` から呼び出し（D-1）|
| `lowStockCount` | `countStockStatus(lowStock).lowStock` | 同上 |
| `pluDirtyCount` | `pluDirty.length` | `useHomeSummary` 内で直接計算 |
| `lastImportSettlementDate` | `csvImports.items[0]?.settlement_date ?? null` | `useHomeSummary` 内で直接計算 |
| `needsImportWarning` | `lastImportSettlementDate !== null && lastImportSettlementDate < yesterday`（D-8）| `useHomeSummary` 内で直接計算 |
| `yesterdayLabel` | `useYesterdayDate()` で生成、`YYYY-MM-DD` | hook 直接 |

#### `count-stock-status.ts` 純関数

```ts
export type StockStatusCounts = { outOfStock: number; lowStock: number };

export function countStockStatus(items: ProductWithRelations[]): StockStatusCounts {
  return {
    outOfStock: items.filter(p => p.stock_quantity <= 0).length,
    lowStock: items.filter(p => p.stock_quantity > 0).length,
  };
}
```

純関数化の根拠: テスト容易性（Phase 1 7-7 Vitest 着手後に unit test 追加可能）+ `useHomeSummary` の業務ロジック濃度を下げる（P2-B 反映、レビュー指摘 11 件中の責務整理）。

#### bindings.ts の field 命名と直接アクセス方針

specta 自動生成の `src/lib/bindings.ts` では **struct field は snake_case のまま** で出力される（commit 1 `2c1ac37` で確認済、tauri-specta は serde rename を見て決める仕様）。`commands.*` 経由で取得した値を hook 内で派生計算する際、`product.stock_quantity` / `report.department_subtotals` / `csvImport.settlement_date` の **snake_case 直接アクセスを採用**する。変換層は噛まさない（オーバーヘッドゼロ + bindings.ts と TypeScript 型が完全一致 + 命名 1 箇所で済む）。

camelCase 変換は **command 引数のみ** に適用される（D-7: `commands.listLowStock(false)` で `includeDiscontinued: boolean` 引数として展開、tauri-specta の自動 rename）。

---

### 53.3 CMD 呼び出しパターン

D-4 採用 → `src/lib/query-keys.ts` に queryKeys helper を新設し、第 3 要素オブジェクト形式で命名（[UI_TECH_STACK.md §2.5](../UI_TECH_STACK.md) 補強 1 準拠）。直書きはタイポで cache miss が起きるため禁止。

#### 4 useQuery の queryKey / queryFn / staleTime / enabled

| useQuery | queryKey | queryFn | staleTime | gcTime | enabled |
|---|---|---|---|---|---|
| sales | `["daily-sales", "detail", { date: yesterday }]` | `() => unwrapResult(commands.getDailySales(yesterday))` | `5 * 60_000`（D-5: 昨日のデータは当日中不変）| `10 * 60_000` | `true` |
| lowStock | `["products", "low-stock", { includeDiscontinued: false }]` | `() => unwrapResult(commands.listLowStock(false))` | `60_000`（default）| `10 * 60_000` | `true` |
| pluDirty | `["plu-dirty"]` | `() => unwrapResult(commands.listPluDirty())` | `30_000`（D-5: PLU は商品編集直後の反映を早める）| `5 * 60_000` | `true` |
| csvImports | `["csv-imports", "list", { page: 1, perPage: 1 }]` | `() => unwrapResult(commands.listCsvImports(1, 1))` | `60_000`（default）| `10 * 60_000` | `true` |

**`per_page` 上限の責務分離**: `listCsvImports` の `per_page` 上限は IO/CMD 層で保証される（既定上限 100、超過時は `BizError::ValidationFailed` で `CmdError { kind: "validation" }` に変換）。本画面では固定値 `1` のみ使用するため frontend で上限チェック不要。他 useQuery（`listLowStock` / `getDailySales` / `listPluDirty`）はページング非対象のため上限の議論なし。

**enabled 一律 true の根拠**（P2-C 反映）: `useYesterdayDate` は常に `string` を返す純関数のため、enabled 条件分岐は実装意図上不要。誤解を防ぐため `enabled: true` を明示。null 経路が必要になる将来拡張（手動日付指定機能等）では enabled 条件を再導入する。

`unwrapResult` は PR #48 の `src/lib/invoke.ts` で導入済 helper。Result 型 `{ status: "ok"; data } | { status: "error"; error }` を解いて、エラー時は `InvokeError` を throw、成功時は data を返す。TanStack Query の通常 error handling に乗る。

#### 日付タイムゾーン subsection（D-9 frontend 責務）

`get_daily_sales` の「昨日」計算は **frontend 責務**。`useYesterdayDate` hook で JST ローカル日付を `YYYY-MM-DD` で生成し、`commands.getDailySales(date)` 引数として渡す。

**根拠**:

- `src-tauri/src/biz/sales_service.rs::get_daily_sales(conn, date: &str)` は日付文字列を受け取り集計するのみ、タイムゾーン変換はしない（commit 1 で確認済）
- frontend で JST ローカル日付を生成することで Tauri ローカル環境のタイムゾーン依存になる。手芸店は単一店舗 + JST 固定運用前提なのでこれで十分
- 24:00 またぎでホーム画面再フォーカスした場合、`useYesterdayDate` の Visibility API listener が `visible` 検知時に `computeYesterday` を再評価 → setState → queryKey 変化で TanStack Query が自動再 fetch される設計

**24:00 またぎの再 fetch メカニズム**（P2-A 反映）:

`useYesterdayDate` の再評価トリガーとして Visibility API listener を採用:

```ts
function useYesterdayDate(): string {
  const [date, setDate] = useState<string>(() => computeYesterday());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setDate(computeYesterday());
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return date;
}

function computeYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv-SE"); // "YYYY-MM-DD" (Swedish ISO)
}
```

**設計判断の根拠**:

- `useMemo` は依存配列が変わらない限り再計算しない → 24:00 またぎ検知不可
- 単純な毎レンダー再評価（`function useYesterdayDate(): string { return computeYesterday(); }`）は React レンダリングの不安定性（StrictMode の double render 等）で意図しない fetch 多発の可能性
- Visibility API は最も軽量。ユーザーがアプリにフォーカスを戻したタイミングで再計算 + queryKey 変化で fetch
- `Intl.DateTimeFormat("ja-JP")` ではなく `toLocaleDateString("sv-SE")` を使う理由: Swedish locale が ISO 8601 互換 `YYYY-MM-DD` を返す。`ja-JP` は `2026/3/21` 形式で `padStart` 必要

#### 引数 camelCase 変換（D-7 確認済み）

`commands.listLowStock(false)` 等は specta が自動 camelCase 化（`include_discontinued` → `includeDiscontinued`、`per_page` → `perPage`）。bindings.ts の wrapper は positional 引数受けで、関数名も `list_low_stock` → `listLowStock` に自動変換される（commit 1 git diff で確認済）。

---

### 53.4 利用者操作フロー

ui-task-specs.md §UI-00 の業務的概要は **重複させない**（`memory/frontend-function-design-granularity.md` 規定）。本書は実装詳細寄りに限定する。

**起動 / ホーム復帰時**:

1. `<HomePage />` mount → `useHomeSummary()` で 4 useQuery 同時発火
2. 4 useQuery は **独立**（D-3）。1 件失敗しても他 3 件は継続 fetch
3. 各カードは `isLoading` 中 Skeleton、成功時 data 表示、失敗時「取得失敗」+ 再試行ボタン

**PLU 通知バー条件**:

- `pluDirty.isLoading` 中はバー非表示（誤判定防止）
- `pluDirty.isSuccess && pluDirtyCount >= 1` でバー表示
- `pluDirty.isError` 時はバー非表示 + トーストで失敗通知（§53.5）

**前日未取込み警告**（D-8 / SCREEN_DESIGN.md §ホーム画面の情報量バランス）:

- `csvImports.isSuccess && needsImportWarning === true` で「前日分が未取込みです」警告 UI 表示
- 判定式は `lastImportSettlementDate < yesterday`。`imported_at`（取込み実行時刻）ではなく `settlement_date`（精算日）で判定する点が重要

**大ボタンクリック**:

- active route ボタン: 本 PR スコープ内では該当なし（UI-00 ホームのみ active = navigation.ts SSOT、大ボタン群 = CSV取込み / 日次売上 / 在庫照会 / 月次売上 / 商品管理 / 入出庫 4 / 棚卸し / バックアップ / 閾値設定は全部 pending、Phase 2 後続 PR で順次 active 化予定）
- pending route ボタン: 大ボタン全部 — Tooltip + `aria-disabled` + `onClick preventDefault` + `cursor-not-allowed`（D-2、HTML disabled は不採用、Tooltip 文言 generic「後続フェーズで着手予定」= Phase 2/3/4 の各画面着手 phase に依存しない汎用表現）

---

### 53.5 エラー表示

#### 部分障害許容パターン subsection

D-3「独立 useQuery × 4」の直接の含意。1 クエリの失敗が他 3 クエリの表示・再 fetch に**伝搬しない**設計。

| 障害位置 | 表示 |
|---|---|
| sales クエリ失敗 | 「昨日売上カード: 取得失敗 / 再試行」のみ。他 3 カード + 大ボタン群 + PLU バーは正常 |
| lowStock クエリ失敗 | 在庫切れカード + 在庫少カード両方が「取得失敗」（同一 query 由来）。他は正常 |
| pluDirty クエリ失敗 | PLU バー非表示（誤検知より沈黙を選ぶ）+ Sonner トースト「PLU 通知の取得に失敗しました」 |
| csvImports クエリ失敗 | 前日未取込み警告 UI 非表示（誤検知より沈黙を選ぶ）+ Sonner トースト「取込み履歴の取得に失敗しました」 |

**retry 戦略**:

- TanStack Query の default retry 3 回を `retry: 1` にダウン（PR #48 commit `c5f3786` の Provider 設定）
- カード内「再試行」ボタンは `useQuery({ refetch })` を呼ぶ
- pending route ボタン誤認防止: Tooltip 文言「後続フェーズで着手予定」+ `aria-disabled` でスクリーンリーダーに伝達 (Phase 2/3/4 の各画面着手 phase に依存しない汎用表現、Codex PR #56 P2-1 反映)

**Exit 条件**（本パターン再検討トリガー）: 1 ホームロード当たりの fetch 件数が >500 件に膨れたら（例: lowStock 件数増大）、`get_low_stock_count` 専用集約 CMD 新設を検討。Phase 2 完了時の利用者デモ（Plans.md §第8段階 8-0 ゲート）でフィードバック取って判定。

#### shadcn/ui コンポーネント採用

- カード内エラー: shadcn `<Alert variant="destructive">` でアイコン + テキスト + 「再試行」ボタン
- トースト（pluDirty / csvImports 失敗時）: Sonner（PR #50 で `<Toaster />` mount 済）

横断 UI 規約の正典は [../design-system/02-component-catalog.md](../design-system/02-component-catalog.md) ⑥〜⑧（旧 UI_TECH_STACK §6.1〜6.3 から移設）。共通 component テンプレート実装はタスク 7-8b（Phase 1 残）で、本書は component 化までの暫定として上記 shadcn 採用。

---

### 53.6 ローディング表示

#### Skeleton 戦略（カード単位）

各 useQuery の `isLoading === true` 中、対応 UI 要素を shadcn `<Skeleton>` で置換:

| UI 要素 | Skeleton |
|---|---|
| 昨日売上カード | `<Skeleton className="h-8 w-32" />`（金額）+ `<Skeleton className="h-4 w-16" />`（点数） |
| 在庫切れカード | `<Skeleton className="h-8 w-12" />` |
| 在庫少カード | `<Skeleton className="h-8 w-12" />` |
| PLU 通知バー | **非表示**（`isLoading` 中はバー判定不可） |
| 前日未取込み警告 | **非表示**（`isLoading` 中は判定不可） |

**根拠**:

- カード単位の Skeleton で「何が読み込まれるか」を視覚的に予告
- バー系は条件分岐が判定不可な間は非表示が安全（バーが出てから消えるとちらつきが酷い）
- `pluDirty` / `csvImports` の最初の loading は数百 ms 程度（`limit=1` + 件数集計）。ちらつき問題は実機で判定

#### Tooltip ライブラリ

shadcn `Tooltip` を本 PR commit 0 で導入済（`src/components/ui/tooltip.tsx`、commit `c619c06`）。pending route 大ボタンに `<TooltipTrigger asChild>` + `<TooltipContent>` 「後続フェーズで着手予定」で適用 (Codex PR #56 P2-1 反映、各画面着手 phase に依存しない汎用文言)。

#### 初回起動時の判定タイミング

`useHomeSummary` が 4 useQuery を並列発火 → 各々の `isLoading` は個別。最初に成功したクエリから順に Skeleton → data 遷移。「全部揃ってから一気に出す」は採らない（同時待ちは UX 悪化）。

---

### 53.7 ショートカット

**UI-00 自身は画面固有ショートカットを持たない**（UI-00 は表示専用ダッシュボードで、入力フォームがないため）。

グローバル Ctrl+/ ショートカット一覧ダイアログは Phase 2 8-6 別 PR で実装され、`<RootLayout />` (UI-12) 層にマウントされる。詳細は [54-ui-shortcuts.md](54-ui-shortcuts.md)。UI-00 のページ内で Ctrl+/ を押すと、ダイアログの「このページ」セクションには「現在のページに固有のショートカットはありません」と表示される（[54-ui-shortcuts.md §54.1 / §54.4](54-ui-shortcuts.md)）。

各画面 PR で固有のキー組合せが必要になった場合、`src/features/shortcuts/data.ts` の `SHORTCUTS` 配列に `category: "screen"` 行を追記することで一覧に出る拡張点が確立済み。

---

### 53.8 備考

- **大ボタン 4 つ目 = 商品管理**（Q-1 採用、モックアップ準拠）。月次売上はサイドバー「毎日の業務」エリア経由で遷移（[ui-task-specs.md §UI-12](../architecture/ui-task-specs.md) サイドバー定義既済）。商品管理は Phase 3 UI-01a 実装まで pending disabled
- **pending route UX**: Tooltip + `aria-disabled` + cursor-not-allowed の 3 層で誤クリック防止（D-2）。サイドバー pending と一貫
- **specta 化済み 4 コマンド**: `get_daily_sales` / `list_low_stock` / `list_plu_dirty` / `list_csv_imports`（commit 1 `2c1ac37` 完了）。本書 §53.3 はこれら specta 化前提で記述
- **struct field snake_case**: bindings.ts は struct field を snake_case のまま出力（specta default、commit 1 で確認済）。本書 §53.2 で snake_case 直接アクセス採用と明記
- **デザイン哲学**: stone 系パレット + アイコン + 区切り線。出典 [../design-system/00-foundations.md](../design-system/00-foundations.md)「4色エリアモデルの扱い」
- **デスクトップ前提**: `memory/desktop-app-ui-constraints.md` 準拠（レスポンシブ非対象、hover 許容、URL 内部識別子、ウィンドウタイトル動的更新）

---

### 53.9 非目的

| やらないこと | 理由 | 責務を持つモジュール |
|---|---|---|
| 8-6 Ctrl+/ ショートカット一覧ダイアログ | UI-00 マージ後の別 PR で実装（Q-3） | [UI-shortcuts](54-ui-shortcuts.md) |
| pending route の新設実装 | 大ボタンは aria-disabled + Tooltip のみ (D-2、HTML disabled 不採用) | UI-01a (Phase 3) / UI-02〜10 (Phase 3-4) |
| ダッシュボードの詳細化（チャート / トレンド表示） | サマリは「朝一の状況把握」に限定 | 月次売上 (UI-09b) / 日次売上 (UI-09a) |
| `DailySaleItem.source` 等の enum 化 | D-10、本 PR スコープ外 | Phase 3 UI-09a 着手時に判断（specta 化対象拡張と同タイミング） |
| UI-08 PLU 書出し本体 | 通知バーから遷移ボタンのみ、本体は Phase 4 | UI-08 (Phase 4 10-3) |
| ユーザー認証 / ログイン | 単一店舗 1 利用者前提、認証層なし | プロジェクトスコープ外（CLAUDE.md） |
| Vitest unit test（`count-stock-status.ts` / hooks 等） | Phase 1 7-7 で Vitest 初期化が未着手のため、本 PR では無し。`count-stock-status.ts` 純関数は 7-7 着手後に unit test 追加（P3-F 反映） | Phase 1 7-7 → 後続 PR |

---

### 更新履歴

| 日付 | PR | 内容 |
|---|---|---|
| 2026-05-09 | 8-1 UI-00（本 PR commit 2） | 新規作成。実装プラン [2026-05-09-phase-2-ui-00.md](../archive/plans/2026-05-09-phase-2-ui-00.md) §関数設計書の章立て / §事前確定事項 D-1〜D-10 / Q-1〜Q-3 を関数設計書形式（業務ロジックあり版テンプレ初適用）で転記。commit 1 `2c1ac37` の specta 化を前提に §53.2 / §53.3 を記述 |
| 2026-05-09 | 8-1 UI-00（commit 4-5 plan レビュー反映） | レビュー指摘 11 件反映: §53.2 派生値表に「計算箇所」列追加 + `count-stock-status.ts` 純関数仕様明記（P2-B）/ §53.3 sales クエリ `enabled` を `yesterday !== null` から `true` に変更 + 根拠注釈追記（P2-C）/ §53.3 `useYesterdayDate` 再評価メカニズムを Visibility API listener 版に明確化（P2-A）/ §53.9 非目的に Vitest unit test 行追加（P3-F）|
| 2026-05-09 | 8-1 UI-00（commit 4-5 実装完了） | `41929f5` features/home 11 ファイル新規 (types / lib/count-stock-status / hooks 2 / components 7) + commit 5 (本 commit) HomePage + `src/routes/index.tsx` 差替 (search_products demo 93 行 → `<HomePage />` mount 5 行)。LSP/Skills Policy hook 全 13 ファイル URI diagnostics 空 + npm run typecheck / lint (初回 6 errors → 修正後 0) / format (prettier --write 統一) 全 pass。詳細は Plans.md L23 trace |
