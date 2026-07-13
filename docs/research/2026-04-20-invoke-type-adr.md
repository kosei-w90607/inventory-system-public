# ADR-002: invoke 型定義方式選定 — tauri-specta 自動生成 採用

- 日付: 2026-04-20
- ステータス: 決定
- 関連: Plans.md 7-5a, [UI_TECH_STACK.md §2.5](../UI_TECH_STACK.md), プランファイル `/home/kosei/.claude/plans/7-phase-1-ui-fluttering-hamming.md` Task 2

## Context

Tauri 2.0 + React 19 + TypeScript で `invoke('search_products', filter)` のような呼び出しを行う際、フロントエンド側で引数・戻り値の型を定義する方式を決定する。

現状の課題:
- CMD 層に 45 コマンドが既実装済み（search_products, get_product, preview_import, create_receiving 等）
- Rust 側の型（ProductSearchQuery, PaginatedResult, CmdError 等）を TypeScript 側にも書くと 2 重管理
- Phase 2〜4 で UI 全画面実装時、各画面が複数 invoke を叩くため型定義の追加頻度が高い

選択肢:
- **Option A**: tauri-specta で Rust 型から TS 型を自動生成
- **Option B**: 手動で TypeScript 型を書く（`src/lib/invoke.ts` のラッパでシグネチャ定義）

## Options

### Option A: tauri-specta 自動生成（v2.0.0-rc.24）

- branch: `spike/invoke-specta`（commit 02f578e）
- 実装内容: `search_products` コマンドに `#[specta::specta]` 適用、7 types に `#[derive(specta::Type)]` 追加、`tauri_specta::Builder` で TS エクスポート

**実装コスト（実測）**:

```
# 1 コマンド適用時の diff
- src-tauri/Cargo.toml: +3 行（specta / specta-typescript / tauri-specta 依存）
- src-tauri/src/cmd/product_cmd.rs: +1 行（#[specta::specta] attribute）
- src-tauri/src/db/product_repo.rs: +4 derive 追加（Product / ProductWithRelations / ProductSearchQuery / SortKey / SortOrder）
- src-tauri/src/db/mod.rs: +1 derive 追加（PaginatedResult<T>）
- src-tauri/src/cmd/mod.rs: +1 derive 追加（CmdError）
- src-tauri/src/lib.rs: +13 行（export_specta_bindings 関数）
- src-tauri/src/bin/export_bindings.rs: +9 行（生成専用バイナリ）

合計: 7 types に derive + 1 command に attribute + 約 22 行の配線コード
```

**生成された TS bindings の品質**（src/lib/bindings.ts、108 行）:

| 検証項目 | 結果 |
|---------|------|
| `#[serde(flatten)]` 対応 | ✅ `ProductWithRelations` → `{ ... } & (Product)` intersection 型 |
| Generic 型 | ✅ `PaginatedResult<T>` → そのまま TS generic |
| enum | ✅ `SortKey` → `"Name" \| "ProductCode" \| ...` union literal |
| Option<T> | ✅ `T \| null` に変換 |
| docstring | ✅ JSDoc `/** */` として保持（日本語含む） |
| command wrapper | ✅ `typedError<T, E>` で `{ status: "ok" \| "error" }` Result-like 型 |
| 引数名 | ✅ Rust の `query:` パラメータ名が `{ query }` オブジェクトキーとして保持 |

**生成例**（抜粋）:
```typescript
export const commands = {
  // 商品を検索する（ページング対応）
  searchProducts: (query: ProductSearchQuery) =>
    typedError<PaginatedResult<ProductWithRelations>, CmdError>(
      __TAURI_INVOKE("search_products", { query })
    ),
};

export type ProductWithRelations = {
  department_name: string,
  supplier_name: string | null,
} & (Product);

export type SortKey = "Name" | "ProductCode" | "StockQuantity" | "SellingPrice";
```

**長所**:
- **型の真実性**: Rust 構造体を単一ソースに Rust ↔ TS 完全同期、乖離ゼロ
- **保守コスト**: CMD 追加時に Rust 側に derive + attribute を書くだけ、TS は自動
- **docstring 連携**: Rust の `///` が JSDoc として UI 側に渡る、エディタ補完に業務仕様が出る
- **Result-like wrapper**: `typedError<T, E>` で CmdError の型付き取得が可能、`if (res.status === "ok") res.data` パターン
- **既存テスト影響ゼロ**: 556 tests 全パス、clippy 警告ゼロ
- **Tauri 2 完全対応**: v2.0.0-rc.24 で動作確認

**短所**:
- **バージョン pinning 問題**: `specta 2.0.0-rc.24` / `specta-typescript 0.0.11` / `tauri-specta 2.0.0-rc.24` の 3 点セット互換性管理が必要（最初 specta-typescript 0.0.9 でバージョン衝突発生）
- **rc（release candidate）段階**: 2.0 安定版リリース前、API 微変更の可能性
- **初回ビルド時間増**: 新規依存コンパイルで +20 秒（rc.24 含む 5 crate 追加）。増分ビルドは影響なし（3〜4 秒）
- **reachable 型グラフ全体に derive 必要**: 1 command で 7 types。全 45 commands 展開時は推定 50-100 types（2〜4h 作業）
- **生成されたバイナリサイズの増加**: 未測定（Phase 4 リリース時の実測課題）

### Option B: 手動型定義

**実装イメージ**:
```typescript
// src/lib/invoke.ts
import { invoke } from "@tauri-apps/api/core";

export type CmdError = {
  kind: "validation" | "duplicate" | "not_found" | "internal" | /* ... */;
  message: string;
  field: string | null;
};

export type ProductSearchQuery = {
  keyword: string | null;
  department_id: number | null;
  // ... Rust 側 ProductSearchQuery と同じ構造を手動で書く
};

export async function searchProducts(query: ProductSearchQuery): Promise<PaginatedResult<ProductWithRelations>> {
  return invoke("search_products", { query });
}
```

**長所**:
- **依存追加なし**: Rust 側に specta 系 crate を入れない、ビルド時間影響ゼロ
- **バージョン管理単純**: TypeScript 型は手書き、外部 crate の rc/安定版監視不要
- **柔軟性**: UI 側の都合で型を調整可能（例: `string | null` を optional にする等）

**短所**:
- **2 重管理の工数**: 45 commands × 平均 3-5 types = 150〜200 types を手書き・同期
- **乖離リスク**: Rust 側変更時に TS 側修正漏れ、Phase 4 完了時の修正で爆発的に発生する可能性
- **docstring 連携なし**: 業務仕様が TS 側に来ない、UI 実装時の参照コスト増
- **serde(flatten) の手動展開**: intersection 型を毎回書く必要

### 比較サマリ

| 指標 | Option A: specta 自動生成 | Option B: 手動型定義 |
|------|---------------------------|---------------------|
| 初期セットアップ | 依存追加 + 配線 22 行 | ラッパ関数 1 ファイル |
| CMD 追加時のコスト | Rust 側に derive + attribute | Rust + TS 両方に書く |
| 型の乖離リスク | ゼロ（compile-time 検証） | 人為依存、中程度 |
| docstring 連携 | ✅ JSDoc 自動 | ❌ 手動で書く必要 |
| 外部 crate 依存 | specta / tauri-specta（rc.24） | なし |
| バージョン管理コスト | 3 crate の互換性維持 | なし |
| Rust ビルド時間 | 初回 +20s、増分 +0s | 影響なし |
| スケーリング（45 commands） | 初回 2〜4h、以降は個別追加 | 継続的な 2 重管理負債 |

## Decision

**採用: Option A（tauri-specta v2.0.0-rc.24 自動生成）**

### 根拠（優先度順）

1. **Rust 中心の型設計との整合**: 本プロジェクトは docs/FUNCTION_DESIGN.md + DB_DESIGN.md で Rust 型から業務仕様を定義している。Rust が単一ソースで TS はその投影、という構造が自然。Option B は仕様と TS を別管理することになり SSOT 原則に反する
2. **45 commands 規模の 2 重管理リスク**: 手動だと修正漏れが累積し、Phase 4 リリース直前に大規模修正が発生する。spike で 7 types / 1 command の適用コストを実測、全展開で 2-4h と見積もり可能で投資対効果が高い
3. **docstring 連携の DX**: Rust 側 `/// REQ-101-01: JANコード入力で商品登録` が JSDoc に自動変換 → UI 実装時にエディタで仕様参照可能。これは Option B では実現困難
4. **生成された型の品質が実用レベル**: serde(flatten) intersection、generic、enum、Option<T> すべて正確に変換。手動で書くより高品質
5. **既存コード・テストへの影響ゼロ**: 556 tests 全パス、既存 invoke 呼び出しは影響なし

### 棄却理由（Option B）

- rc 段階の外部 crate を避ける安全志向は理解できるが、specta は 2022 年から開発が続く枯れたライブラリで、rc.24 まで 2 年以上の実績あり
- Rust ビルド時間 +20s は Phase 2〜4 で継続的に発生する工数より遥かに小さい
- 柔軟性メリット（UI 都合で型調整）は、多層アーキテクチャの CMD 境界を歪める動機になりかねず、むしろ Option A の型同期制約が設計規律として働く

## Consequences

### 正の影響

- Phase 2〜4 の UI 画面実装で、invoke 呼び出しの型補完が自動で効く
- Rust 側での型変更が TS 側に即座に反映、リファクタリング耐性が高い
- `typedError<T, E>` wrapper で `CmdError` の kind 分岐が型付きで書ける（例: `if (res.error.kind === "validation") { ... }`）
- 業務 docstring が UI 層まで到達、仕様参照コスト減

### 負の影響

- 新規依存 3 crate の互換性監視（specta / specta-typescript / tauri-specta）
- rc 段階のため、2.0 安定版リリース時に API 微変更の可能性（監視トリガー）
- Rust 初回ビルド +20s（CI 時間に影響、許容範囲）
- 全 45 commands に derive 追加する 2-4h の一括作業を Task 4 以降で予定
- reachable 型グラフに追従して derive を追加する作業が継続発生（CMD 追加時）

### 再評価トリガー

以下のいずれかが発生したら再検討する:

- tauri-specta v2.0 安定版が 2026-07 末までにリリースされない（rc 滞留リスク）
- specta / tauri-specta の破壊的変更で CMD 数本以上の書き換えが必要
- Tauri 2.x メジャーアップデートで tauri-specta の対応が大幅遅延（1ヶ月以上）
- `typedError` wrapper の挙動が実運用で問題（既存の `try/catch` 互換性崩れ等）

## Verification Evidence

### 実測データ（2026-04-20 時点）

- **specta spike**: branch `spike/invoke-specta`, commit `02f578e`
- **バージョン構成**:
  - `specta = "2.0.0-rc.24"`, features: `["derive"]`
  - `specta-typescript = "0.0.11"`（specta-typescript 0.0.9 だと specta rc.22 と衝突するため 0.0.11 採用必須）
  - `tauri-specta = "2.0.0-rc.24"`, features: `["derive", "typescript"]`
- **初回ビルド時間**: 20.57 秒（specta 関連 5 crate の新規コンパイル含む）
- **増分ビルド時間**: 3.90 秒（通常速度、specta の影響なし）
- **全テスト**: 556 passed, 0 failed（specta 追加前と同じ）
- **clippy**: ゼロ警告（`cargo clippy -- -D warnings` 通過）
- **生成 TS 行数**: 108 行（search_products 1 コマンド + 7 types + typedError wrapper）
- **CMD 拡張予想工数**: 1 コマンドあたり 2〜5 分、全 45 展開で 2〜4h

### spike 実装の注意点（後続 PR で解消）

- `src-tauri/src/bin/export_bindings.rs`: spike 専用バイナリ、本採用時は削除（debug build 時に `run()` 経由で自動実行）
- `export_specta_bindings()` 関数: spike で pub 公開、本採用時は `#[cfg(debug_assertions)]` + private 化
- `src/lib/bindings.ts`: 自動生成ファイル、`.gitignore` 対象にする（Task 4 で対応）
- 全 45 commands への展開: Task 4 の範囲外（本プラン Task 4 では search_products 1-2 本のみ）、Phase 2 以降で段階的拡張

### 既存実装への影響（検証済み）

- `invoke_handler(tauri::generate_handler![...])` は Phase 1 疎通確認用 `greet` の 1 件追加のみ、既存 45 command の列挙は変更なし・呼び出し互換維持
- Phase 1 疎通確認用 `greet` command は backend に登録済み（fix PR で対応）、specta 化はしないが手書き invoke で併存（Phase 2 UI-00 実装時に削除予定）。当初 ADR ではこの行が「既存の手動型定義箇所は併存可能」と書かれていたが、greet が generate_handler! に未登録だった事実を認識していなかったため訂正
- specta 由来の `commands.searchProducts(query)` と従来の `invoke("search_products", { query })` は同じランタイムを叩くため互換

## 次アクション

- Task 3（7-5b キャッシュ戦略レビュー）へ進む
- Task 4（main 反映）で search_products + 1〜2 コマンドのみ specta 化、全 45 展開は後続 PR
- `docs/UI_TECH_STACK.md §2.5` に「決定: tauri-specta 自動生成 / 根拠: 本 ADR」を追記
- spike 専用コード（`src-tauri/src/bin/export_bindings.rs` 等）は Task 4 で整理し、本採用時の debug_assertions + private 化を反映

## 更新履歴

- 2026-04-20: 初版作成。Task 2 完了に伴う決定記録
- 2026-04-21: bindings.ts の運用方針を「gitignore」→「**vendor-in + CI drift check**」に更新。Task 7-5c PR #48 の CI frontend job が Rust 依存なしで typecheck を実行した結果、生成物未存在で `Cannot find module '@/lib/bindings'` エラーが発生したため。対応: (a) `.gitignore` から `src/lib/bindings.ts` を除外、(b) 現行生成物を repo に commit、(c) CI rust job に `cargo run --bin generate_bindings && git diff --exit-code src/lib/bindings.ts` を追加して Rust 型変更後の commit 忘れを検知。Options 再評価ではなく運用更新（選定結果は Option A のまま）。spike 段階で想定していた「frontend job でも Rust toolchain を立ち上げる」前提が現行 CI 構成（frontend/rust ジョブ分離で frontend は Node のみ）と不整合だった、という事後認識。
