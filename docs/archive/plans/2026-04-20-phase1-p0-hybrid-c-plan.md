# [ARCHIVED 2026-04-20] 第7段階 Phase 1 P0 検証 — ハイブリッド C 案

> **完了日**: 2026-04-20
> **結果**: Task 0-4 全完了
> **Task 4 見直し TODO**: セッション 300k+ コンテキストで実施されたため、次セッションで入念な再レビュー推奨
> **関連コミット**: f0cab79 / 2bd4876 / 6e892e2 / 8d54c3c / 5f80baf
> **関連 ADR**: [ADR-001 Router](../../research/2026-04-20-router-adr.md) / [ADR-002 invoke-type](../../research/2026-04-20-invoke-type-adr.md) / [ADR-003 query-cache](../../research/2026-04-20-query-cache-adr.md)
> **関連 Preflight**: [preflight-2026-04-20.md](../../research/preflight-2026-04-20.md)
> **関連 branch**: main + spike/router-tanstack + spike/router-react-router + spike/invoke-specta (すべて remote 保持済み)

---

## Context（なぜこの変更が必要か）

在庫管理システムの第7段階 Phase 1（UI基盤構築）で、UI-12（共通レイアウト）着手前に確定が必要な P0 3項目が残っている:

- **7-4 ルーティング選定**: TanStack Router vs React Router v7
- **7-5a invoke 型定義方式**: tauri-specta 自動生成 vs 手動
- **7-5b TanStack Query キャッシュ戦略**: queryKey 命名 + staleTime/gcTime 初期値

現状、3項目とも比較表は docs/UI_TECH_STACK.md に追記済み（commit 1960f63）だが、**実装での実測・実触が未実施**。比較表だけで決めると、Phase 2 以降で「暫定傾斜を覆す材料」に出くわした時に既存実装の書き直しコストが発生する。

**本プランの目的**は 2 つ:

1. **P0 3項目を実装レベルで確定**し、UI-12 着手時に枝分かれを残さない
2. **AI時代のエンジニアに求められる「技術選定の物差し」を構築する学習投資**として、選定過程と根拠を `docs/research/` に ADR 形式で残す（ポートフォリオ資産）

検証時間の重み付けは重要度に応じて傾斜させる:

| 項目 | 方式 | 時間 | 重み付けの理由 |
|------|------|------|----------------|
| 7-4 ルーティング | **A: 本格 prototype（2 branch 並列）** | 4-5h | アーキテクチャ影響最大、学びが深い、バンドルサイズ実測可能 |
| 7-5a invoke 型定義 | **B: スパイク（specta 1 発試行）** | 1-2h | 自動 vs 手動は選好問題、深掘り効果薄い |
| 7-5b キャッシュ戦略 | **C: 表レビュー + 初期値確定**（Phase 2 で再調整） | 0.5h | staleTime は実画面で叩くまで妥当値が出ない |

**合計予算**: 6-8h（初日 + 翌セッションに跨ぐ可能性あり）

## 完了した Task 構成

### Task 0: 前提確認（Pre-check、30min） — 完了 (commit f0cab79)

4 項目すべて OK、docs/research/preflight-2026-04-20.md に詳細記録。

### Task 1: 7-4 ルーティング — 本格 prototype（A 方式） — 完了 (commit 2bd4876, ADR-001)

TanStack Router v1.168.23 採用。spike/router-tanstack (5f66acd) + spike/router-react-router (3324891) の 2 branch で実装比較。

Bundle 実測: TanStack 114.78 kB gzip / React Router 115.39 kB gzip（差 0.6 kB）
決定根拠: 型安全 params、TanStack Query 統合、ファイルベース routing、code-splitting、バンドル差無視可能

### Task 2: 7-5a invoke 型定義 — スパイク（B 方式） — 完了 (commit 6e892e2, ADR-002)

tauri-specta v2.0.0-rc.24 採用。spike/invoke-specta (02f578e) で 1 command + 7 types の最小検証。

生成された TS 型: serde(flatten) intersection / generic / enum / Option / JSDoc docstring すべて正確変換
品質: 556 tests 全パス、clippy ゼロ警告、既存コード影響なし

### Task 3: 7-5b キャッシュ戦略 — 表レビュー + 初期値確定（C 方式） — 完了 (commit 8d54c3c, ADR-003)

UI_TECH_STACK.md §2.5 の 10 画面分 staleTime/gcTime 表を Phase 1 時点の確定値として採用。
Task 1/2 の学びを反映した補強 6 項目を ADR-003 に記録（queryKey オブジェクト形式、queryOptions ヘルパー、typedError wrapper、defaultOptions、invalidation 集約）。

### Task 4: 採用決定の main 反映（最終コミット） — 完了 (commit 5f80baf)

**⚠️ 見直し TODO（次セッションで実施）**:

本タスクは 300k+ のコンテキストで実施されたため、AI 出力品質の低下リスクがある。次セッションで以下の観点で入念な再レビューを推奨:

- **TanStack Router 導入の完全性**: vite.config.ts プラグイン設定、routes/__root.tsx、routes/index.tsx、main.tsx の RouterProvider
- **既存 App.tsx → routes/index.tsx 移行の検証**: greet invoke 疎通確認コードが routes 側で正しく動作するか
- **specta 統合の最小セット**: search_products + get_product に #[specta::specta]、7 types に derive(specta::Type)、export_specta_bindings() 関数
- **bin/generate_bindings.rs の設計**: 開発ツールとしての位置付けが適切か、本番に影響しないか
- **自動生成ファイルの .gitignore**: src/routeTree.gen.ts と src/lib/bindings.ts
- **UI_TECH_STACK.md の決定記録**: §7.1 (Router) / §2.5 (invoke type, cache strategy) に適切に ADR リンク追記
- **品質チェック結果の再実行**: cargo test 556 passed, clippy warnings 0, npm run build 成功（今回の計測と乖離ないか）
- **npm run tauri dev で GUI 起動確認**: 新しい TanStack Router + specta 配線が実際に動くか目視検証（user 協力必須）

見直し手順は `inventory-code-review` skill か code-reviewer subagent で実施推奨。

## 完了成果物

### main ブランチに反映
- @tanstack/react-router v1.168 + @tanstack/react-query v5.99 + router-plugin + router-devtools
- specta v2.0.0-rc.24 + specta-typescript v0.0.11 + tauri-specta v2.0.0-rc.24
- src/routes/__root.tsx + src/routes/index.tsx（最小スキャフォールド）
- src-tauri/src/bin/generate_bindings.rs（開発ツール）
- UI_TECH_STACK.md §7.1 / §2.5 に決定記録
- Plans.md の 7-4/7-5a/7-5b を [x] 完了表記

### docs/research/ に永久保存
- preflight-2026-04-20.md — Task 0 結果
- 2026-04-20-router-adr.md — ADR-001 Router 選定
- 2026-04-20-invoke-type-adr.md — ADR-002 invoke 型定義選定
- 2026-04-20-query-cache-adr.md — ADR-003 キャッシュ戦略 Phase 1 確定

### remote 保持 spike branch（比較資産）
- spike/router-tanstack（採用版）
- spike/router-react-router（棄却、比較証拠として保持）
- spike/invoke-specta（採用実装元）

## 次セッションへの引き継ぎ

1. **Task 4 見直し**（最優先）— 上記 ⚠️ TODO 参照
2. **7-5c** — `src/lib/invoke.ts`（invoke ラッパ + CmdError マッピング）+ `src/lib/queryClient.ts`（QueryClient インスタンス + QueryClientProvider セットアップ）— 別プラン作成推奨
3. **7-3 UI-12 共通レイアウト** — サイドバー + メイン 2 カラム、ナビ 7 グループ実装（UI-00〜UI-13 の全 route 追加）

## 学び（AI時代の物差し作り）

本プラン完遂で確立した **3 段フロー**は次回以降の技術選定でも再利用可能:

1. **比較表**（UI_TECH_STACK.md に論理比較を書く）
2. **spike 実装**（比較表では判定できない実装コスト・DX を数字と手触りで検証）
3. **ADR**（Context / Options / Decision / Consequences / Verification Evidence を定型フォーマットで記録、branch 保持で再現性担保）

ADR 3 本 + 3 spike branch が **ポートフォリオ資産** として残った。

## 更新履歴

- 2026-04-20: 初版作成。ユーザーと A/B 案の比較議論 → ハイブリッド C 案で合意。学習投資 + ADR 資産化を明文化
- 2026-04-20: 見直しレビューで 7 つの見落としを発見 → 高優先度 4 件をプラン反映
- 2026-04-20: Task 0-4 完遂 → docs/archive/plans/ へアーカイブ化
