# ADR-004: invoke ラッパ設計 — C 案（薄ラッパ + 期限付き fallback）採用

> **Status**: Accepted; fallback retired during Phase 2 closeout on 2026-06-07
> **Date**: 2026-04-20
> **決定 context**: 第7段階 Phase 1 Task 7-5c（invoke ラッパ + QueryClient セットアップ）着手直前
> **関連 ADR**: ADR-001 (TanStack Router) / ADR-002 (tauri-specta) / ADR-003 (TanStack Query キャッシュ戦略表)

---

## 1. Context

Task 7-5c でフロントエンド ↔ Tauri バックエンド間の invoke 呼び出しラッパを実装するにあたり、以下の現状制約を前提に設計案を選定した。

### 現状

- tauri-specta v2.0.0-rc.24 を ADR-002 で採用済、`src/lib/bindings.ts` を自動生成
- specta 対応済 commands: `search_products` / `get_product` の **2 commands のみ**
- specta 未対応 commands: **残 43 commands**（CMD-02〜CMD-11 全般）
- Phase 2 (UI-00/07/09a/06a/09b) 着手時、specta 未対応 commands（例: `get_daily_sales` / `list_plu_dirty` / `get_low_stock_count` 等）を呼び出す必要がある
- `CmdError` struct は Rust 側で `specta::Type` derive 済、bindings.ts に型定義あり

### 問題

Phase 2 着手前に invoke ラッパを整える必要があるが、以下 3 案のどれを採るかで納期・品質トレードオフが変わる:

- **A 案（純度優先）**: tauri-specta `commands.*` のみ使い、未対応は Phase 2 で全件 specta 化してから着手
- **B 案（厚ラッパ）**: `typedInvoke<T>(cmd: string, args)` で `@tauri-apps/api/core` の invoke を wrap
- **C 案（両立）**: 薄ラッパ（エラー helper）+ 期限付き fallback（typedInvoke）

---

## 2. Decision

**C 案 + 期限付き運用を採用する**。以下 2 ファイル構成で実装する。

### 2.1 `src/lib/invoke.ts`（公式経路、薄ラッパ）

- `toCmdError(err, ctx)` — 任意の throw を `CmdError` 型に正規化。`ctx.source: "commands" | "fallback"` で経路タグを付与
- `isCmdError(err)` — type guard
- `CMD_ERROR_KIND` — Rust 側バリアントを定数化
- 呼び出し側は `commands.*`（tauri-specta 自動生成）を直接使い、try/catch で toCmdError を通す

### 2.2 `src/lib/invoke-fallback.ts`（期限付き、`v0.8.0-ui-daily` タグ gate で削除）

- `FallbackCommand` literal union — specta 未対応 commands の列挙。**初期値 `never`**（7-5c 時点で呼び出し不能）
- `typedInvoke<T>(cmd: FallbackCommand, args): Promise<T>` — cmd 引数が `FallbackCommand` 制約で typo 検知可能
- ファイル冒頭に judgement フローチャートをコメントで固定（新 command 呼び出し時の判断指針）

### 2.3 4 ガード（C 案の移行負債自己増殖を防ぐ仕組み）

1. **ファイル隔離**: fallback を単独ファイルに集約
2. **件数監視 CI**: `scripts/check-typedinvoke-count.sh` + `scripts/typedinvoke-baseline.txt`。increase も decrease も fail（silent 乖離防止）
3. **型による使用範囲限定**: `FallbackCommand` literal union が**撤去リスト兼用**。未対応 command を追加するときは必ず union を拡張 → 撤去進捗が型で可視化される。union が空 `never` に戻った時点でファイル削除
4. **eslint 境界ルール**:
   - `no-restricted-imports` で `src/components/**` から `invoke-fallback.ts` の import 禁止
   - `no-restricted-syntax` で barrel (`src/lib/index.ts`) 経由の再 export 禁止（抜け道対策）

### 2.4 撤去期限

**`v0.8.0-ui-daily` タグ gate** — 以下 4 条件を満たすまでタグ打ち禁止。
2026-06-07 の Phase 2 closeout で全条件を満たした:

- [x] `src/lib/invoke-fallback.ts` 削除済（union 空化 → ファイル毎削除）
- [x] `scripts/check-typedinvoke-count.sh` + baseline ファイル削除済
- [x] eslint `no-restricted-imports` / `no-restricted-syntax` ルール撤去済
- [x] Plans.md の Phase 2 completion / tag gate で `typedInvoke` fallback 撤去済みと記録

---

## 3. Consequences

### 利点

- **Phase 2 着手速度の担保**: specta 未対応 43 commands を呼べる経路があるので UI 実装がブロックされない
- **型安全の漸進的向上**: specta 化した commands は自動で `commands.*` 経由に移行、`FallbackCommand` union から削除して baseline bump down
- **撤去が型システムで可視化**: union の要素数 = 未撤去タスク件数、`never` になれば自動終了
- **ADR-002 (tauri-specta 採用) の意義を維持**: 主経路は specta 自動型推論、fallback は補助扱い

### 欠点

- **移行期にコードベースで 2 経路混在**（7-5c 〜 `v0.8.0-ui-daily` タグまで）
- **運用ルールの習熟コスト**: 新 command 追加時に「commands.* / typedInvoke / specta 対応」の判断が必要
  - 緩和策: `invoke-fallback.ts` 冒頭コメントに判断フローチャート固定

### リスクと緩和策

| リスク | 緩和策 |
|--------|--------|
| 移行負債の自己増殖 | 件数監視 CI + 撤去期限タグ gate |
| エラー契約の不均一化（specta 経由と fallback 経由で shape が揃わない） | `toCmdError(err, ctx)` で一律に `CmdError` 形式に正規化、source タグで将来の原因追跡に備える |
| 観測性の分断 | `ctx.source: "commands" \| "fallback"` タグをログ形式に組み込み（Phase 2 UI-07 で telemetry 着手時に精査） |
| リネーム検知の差 | fallback 側に smoke テスト（Phase B-2 Vitest 導入と同時に追加、場所だけ 7-5c で確保） |
| 教育コスト | `invoke-fallback.ts` 冒頭の判断フローチャートコメント固定 |
| `typedInvoke` 文字列 typo 素通り | `cmd: FallbackCommand` literal union で制約（Round 1 で対策） |
| 件数 CI の誤検知/すり抜け | invoke-fallback.ts 除外 + 減少も fail + baseline file 運用（Round 1 で対策） |
| barrel 経由抜け道 | `no-restricted-syntax` で再 export 禁止（Round 1 で対策） |

---

## 4. Alternatives Considered

### A 案: 純度優先（tauri-specta `commands.*` のみ）

- 採用しなかった理由: Phase 2 着手時に UI-00 で必要な 3-5 commands の specta 化が critical path 化し、UI 実装を遅延させる。納期リスクと品質リスクの合計で C 案に劣る
- 将来的に C 案からここに収束する（撤去期限達成時）

### B 案: 厚ラッパ `typedInvoke<T>(cmd: string, args)`

- 採用しなかった理由: tauri-specta の自動型推論を殺すので ADR-002 の意義を消す。文字列 command 名を使うので rename 検知が実行時まで漏れる

---

## 5. References

- [Plans.md](../../Plans.md) — Phase 2 closeout status / 7-5c 実装履歴
- [ADR-001: TanStack Router](2026-04-20-router-adr.md)
- [ADR-002: tauri-specta](2026-04-20-invoke-type-adr.md)
- [ADR-003: TanStack Query キャッシュ戦略表](2026-04-20-query-cache-adr.md)
- 関連 Backlog: `collect_commands!` vs `generate_handler!` 差分検知 CI（Plans.md L138）— Phase 2 着手前に導入
