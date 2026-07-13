# ADR-003: TanStack Query キャッシュ戦略 — Phase 1 時点の確定値

- 日付: 2026-04-20
- ステータス: 決定（Phase 1 時点、Phase 2 完了時に再調整）
- 関連: Plans.md 7-5b, [UI_TECH_STACK.md §2.5](../UI_TECH_STACK.md), プランファイル `/home/kosei/.claude/plans/7-phase-1-ui-fluttering-hamming.md` Task 3

## Context

第7段階 Phase 1（UI 基盤構築）着手前に、TanStack Query のキャッシュ戦略を確定する必要がある。Task 1（Router 選定: TanStack Router 採用）、Task 2（invoke 型: tauri-specta 採用）の結果を受けて、既存の UI_TECH_STACK.md §2.5 L186-225 に追記された初期案を Phase 1 時点の確定値として採用するか、調整するかを判定する。

本 ADR の性質: Task 1/2 と異なり、実装 spike では検証できない（staleTime の妥当性は実画面で叩かないと判断不可）。そのため初期値のロジック検証 + 再調整トリガーの明記に重きを置く。

## Options

### Option A: UI_TECH_STACK.md §2.5 の初期案をそのまま採用（Phase 2 で再調整）

- 10 画面分の staleTime / gcTime 表を初期値として採用
- queryKey 命名規約（`['entity', operation, ...params]`）を確定
- Phase 2 完了時（v0.8.0 リリース）に実データでの挙動を実測して調整

### Option B: Task 1/2 の学びを反映して事前調整

Task 1/2 で判明した事項との整合性確認:

- **TanStack Router `loader` 統合**: queryKey は router loader から `queryClient.ensureQueryData(queryOptions({ queryKey: [...] }))` で参照される形式が推奨。現行の `['product', 'list', { page, keyword }]` 形式はこれと自然に合致
- **tauri-specta 生成の `commands` オブジェクト**: `commands.searchProducts(query)` 形式で呼び出す際、queryKey には `query` オブジェクト全体を含める or 展開するかの選択が必要
- **typedError<T, E> wrapper の Result-like 型**: mutation の `onSuccess` で `invalidateQueries` する際、`res.status === "ok"` 分岐を挟む必要がある

## Decision

**採用: Option A（UI_TECH_STACK.md §2.5 初期案そのまま採用 + Phase 2 再調整）**

ただし以下の **Phase 1 時点の補強事項** を本 ADR に明記する（UI_TECH_STACK.md への反映は Task 4 で実施）:

### 1. queryKey の第 3 要素（params）の書き方統一

```typescript
// ✅ 推奨: オブジェクト全体を第 3 要素に
['product', 'list', { page: 1, keyword: 'test', departmentId: null }]

// ❌ 非推奨: フラットに展開
['product', 'list', 1, 'test', null]  // params 追加時に後方互換性が壊れる
```

**理由**: tauri-specta の `commands.searchProducts(query)` は `ProductSearchQuery` オブジェクト全体を受け取る。queryKey もこれと同形状にすることで、`queryKey: ['product', 'list', query]` の直接渡しが可能になり、シリアライゼーション整合性が保たれる。

### 2. TanStack Router loader との統合パターン

```typescript
// ✅ 推奨: queryOptions ヘルパーで key + fn を 1 箇所に集約
const productListQueryOptions = (query: ProductSearchQuery) => queryOptions({
  queryKey: ['product', 'list', query],
  queryFn: async () => {
    const res = await commands.searchProducts(query);
    if (res.status === 'error') throw res.error;
    return res.data;
  },
  staleTime: 30_000,
});

// Router loader で prefetch
export const Route = createFileRoute('/products/')({
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(productListQueryOptions(deps.query)),
  component: ProductListPage,
});
```

この集約パターンは 7-5c（invoke ラッパ + QueryClient セットアップ）で実装する。

### 3. `typedError` wrapper との整合

mutation onSuccess での invalidate:
```typescript
const createProductMutation = useMutation({
  mutationFn: commands.createProduct,
  onSuccess: (res) => {
    if (res.status === 'ok') {
      queryClient.invalidateQueries({ queryKey: ['product'] });
    }
    // error 時は invalidate しない（CmdError は throw 済み）
  },
});
```

typedError wrapper の設計により、`res.status === 'ok'` 分岐は必須。これを mutation helper で抽象化するかは 7-5c で判断。

### 4. 初期値採用の staleTime / gcTime 表（10 画面分、Phase 1 確定値）

| 画面 / クエリ | staleTime | gcTime | 変更なし理由 |
|---------------|-----------|--------|-------------|
| 商品一覧 / 検索（UI-01a） | 30s | 5min | CRUD 頻度中、数秒キャッシュで十分 |
| 商品詳細（UI-01b） | 0 | 5min | 編集後の即時再取得重要 |
| 在庫照会（UI-00 / UI-06a） | 10s | 5min | CSV 取込み直後の反映重要 |
| 在庫少一覧（UI-06b） | 30s | 5min | 閾値表示、頻繁更新なし |
| 変動履歴（UI-06c） | 1min | 10min | 過去データ中心 |
| 日次売上（UI-09a） | 5min | 30min | 集計結果、日次精算フロー |
| 月次売上（UI-09b） | 5min | 30min | 同上 |
| PLU 未反映件数（UI-00 / UI-08） | 30s | 5min | 書出し直後の反映重要 |
| 棚卸し進行中（UI-10） | 0 | 5min | カウント入力は常に最新 |
| 設定（UI-11a） | Infinity | Infinity | 明示 invalidate 時のみ |

### 5. invalidation pattern（UI_TECH_STACK.md §2.5 そのまま採用）

- CMD 成功後、該当 entity の全 query を invalidate
- mutation の `onSuccess` に集約、UI コンポーネント側にばらまかない
- 複数 entity の同時 invalidate は明示的にリスト化（例: CSV 取込み完了 → `['inventory']` + `['product']` + `['sales']`）

### 6. グローバル defaultOptions（7-5c で実装）

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,  // 安全側のデフォルト
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,  // デスクトップアプリでは不要
      refetchOnMount: 'always',     // ページ遷移時の再取得
      retry: 1,                     // CmdError は業務ロジック由来のため retry 1 回だけ
    },
    mutations: {
      retry: 0,  // mutation の自動 retry は副作用危険
    },
  },
});
```

### 棄却理由（Option B）

Task 1/2 の学びは queryKey 整合性（オブジェクト形状）と loader 統合パターンで既に反映済み。staleTime の数値調整は実画面を動かさないと意味のある判断ができないため、Phase 2 まで保留が合理的。事前に推測で調整すると、実データとの乖離で再調整コストが二重に発生する。

## Consequences

### 正の影響

- Phase 2（毎日使う 5 画面）着手時に queryKey 命名 + staleTime を迷わず書ける
- 7-5c（QueryClient セットアップ）で defaultOptions を 1 箇所に集約、全画面一貫した挙動
- invalidation pattern を mutation 集約で統一、Zustand との責務分離が明確
- tauri-specta と TanStack Router との統合パターンを事前確定、Phase 2 実装時の判断迷いを減らす

### 負の影響

- staleTime 初期値は推論ベース、実測値との乖離が Phase 2 で発生する可能性あり（再調整コスト 1-2h 想定）
- 画面ごとに個別 staleTime を指定する書き方が散在する可能性 → queryOptions ヘルパーで抽象化すれば解消

### 再調整トリガー

以下のいずれかが Phase 2 以降で発生したら数値を見直す:

1. **staleTime が短すぎる兆候**: CSV 取込み直後にキャッシュが効いて古いデータが表示される、ユーザーから「更新されない」という指摘
2. **staleTime が長すぎる兆候**: 画面遷移ごとに毎回ロードが走り重い、体感速度の低下
3. **gcTime が短すぎる兆候**: ブラウザバックで毎回再取得、画面間のデータ引き継ぎが効かない
4. **refetchOnMount: 'always' の副作用**: ページ遷移コストの増加、特に詳細画面からリスト画面に戻った際
5. **retry: 1 の CmdError 誤判定**: validation エラーで retry が走って二重 insert のような異常系
6. **Phase 2 完了時の実測**: 毎日 5 画面で実データ叩いて、体感と実測値の乖離を記録・再調整

再調整の際は、本 ADR をステータス「決定（Phase 1 時点）」から「更新」に変更し、新しい表を ADR-003 追記として記録する。UI_TECH_STACK.md §2.5 も同時更新。

## Verification Evidence

### 実測データなし（spike 非対象）

本 ADR はコードベース spike なし、既存ドキュメントのレビュー + Task 1/2 との整合性確認のみで作成。実測値は Phase 2 完了時に本 ADR に追記する。

### 整合性確認（2026-04-20 時点）

- **Task 1（TanStack Router）との整合**: queryKey オブジェクト形状は `loader` 関数からの `ensureQueryData` 呼び出しに適合 ✅
- **Task 2（tauri-specta）との整合**: `commands.searchProducts(query)` の引数形状と queryKey 第 3 要素が同形、`typedError` wrapper の `res.status === 'ok'` 分岐が mutation onSuccess に必須と確認 ✅
- **docs/FUNCTION_DESIGN.md との整合**: CMD 層 45 コマンドのエラー分類（CmdError.kind）が 8 種類、retry: 1 で許容可能な範囲 ✅
- **docs/ARCHITECTURE.md との整合**: UI → CMD → BIZ → IO の一方向原則に違反しない、QueryClient はあくまで UI 層内のキャッシュ ✅

### 未検証事項（Phase 2 で対応）

- 実データでの staleTime 体感と数値の妥当性（推論ベースの初期値）
- `refetchOnWindowFocus: false` のデスクトップアプリでの UX 影響
- CSV 取込み完了時の複数 entity invalidate のパフォーマンス影響
- 棚卸し画面（UI-10）の `staleTime: 0` での書き込み負荷
- 長時間開きっぱなしセッションでの gcTime 発火タイミング

## 次アクション

- Task 4（main 反映）で本 ADR の要点を `docs/UI_TECH_STACK.md §2.5` に追記（「Phase 1 確定 / 根拠: ADR-003」の形）
- 7-5c（invoke ラッパ + QueryClient セットアップ）で本 ADR の defaultOptions + queryOptions ヘルパーパターンを実装
- Phase 2 完了時に実測値で再評価、本 ADR を更新

## 更新履歴

- 2026-04-20: 初版作成。Task 3 完了に伴う決定記録（Phase 1 時点の確定値）
