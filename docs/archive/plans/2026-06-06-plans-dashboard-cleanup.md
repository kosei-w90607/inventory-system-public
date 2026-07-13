# Archived Plans Dashboard Snapshot

This file preserves the pre-cleanup `Plans.md` content verbatim. Links inside the snapshot keep their original `docs/Plans.md` relative paths and are intentionally fenced so markdown link checks do not reinterpret them from `docs/archive/plans/`.

```md
# Plans.md

> SSOT: プロジェクトの現在地、タスク、進捗を一元管理するファイル

## Current Phase

- Phase: **Phase 2 8-5 UI-09b 月次売上レポート画面 + 8-7 useExportFile 共通化 = PR #66 (private archive) マージ完了 (2026-05-19、squash merge `caf7d57`)**。Codex Round 1-5 全 close (R1 P2x2 / R2 P2x2 / R3 P2x1+P3x1 / R4 P3x1 / R5 P3x1、全て drift fix 系で P1 ゼロ、Round 5 で test 件数 PR description 表記のみ `gh pr edit` 対応)。直前マージ済 PR chain: PR #56 (private archive) UI-00 ホーム画面 (`e6da3d8`) → PR #57 (private archive) Self-Review hook 機械強制 (`84741b5`) → PR #58 (private archive) UI-shortcuts ダイアログ (`452fe0a`) → PR #59 (private archive) Codex reviewer 安全 wrapper (`77fcdeb`) → PR #60 (private archive) WSL repo path 統一 β-1 (`37c3eca`) → PR #61 (private archive) ClaudeDesktop 統合 + 実機 CSV 検証環境整備 β-2 (`5edc7d5`) → PR #62 (private archive) UI-07 γ (`b8db619`) → PR #64 (private archive) Vitest 初期化 (`2b30f43`) → PR #65 (private archive) UI-09a 日次売上 (`8c2be51`) → PR #66 (private archive) UI-09b 月次売上 + 8-7 useExportFile 共通化 (`caf7d57`)。Phase 1 残は 7-6 Storybook / 7-7b hooks+axe / 7-8a Error Boundary (§6.10) / 7-8b 横断UI / 7-8c unsaved changes / 7-11 workflow 文書化。Phase 2 残は 8-0 利用者デモ gate / 8-9 完了時判定 (E2E + 視覚回帰) + 別 PR (選択状態トーン統一 + 全画面 nav fix)
- Branch: `main` (PR #66 squash merge `caf7d57` 後、`feat/ui-09b-monthly-sales` リモート / ローカル削除済)。main HEAD = `caf7d57` (PR #66 UI-09b)
- Tags: `v0.1.0-db-layer`（第1段階）、`v0.2.0-product-crud`（第2段階）、`v0.3.0-inventory-backend`（第3段階）、`v0.4.0-pos-integration`（第4段階）、`v0.5.0`（第5段階）、`v0.6.0`（第6段階 + CMD補完）

## Active Tasks

- [ ] **第7段階 Phase 1 継続**（UI基盤構築）— ハイブリッド C 案の 5 Task 全完了、プラン archive 済（[docs/archive/plans/2026-04-20-phase1-p0-hybrid-c-plan.md](archive/plans/2026-04-20-phase1-p0-hybrid-c-plan.md)）
- [x] **完了済 PR #53〜#64（10 本、archive 済）** — 詳細な Codex round 履歴・memory 反映は Progress Tracker 第8段階 + 各 archive plan に保存。Phase 2 着手前整備 #53 (private archive) PR-A docs sync / #54 (private archive) PR-B DEV_SETUP 書き直し + 横断整備 #57 (private archive) Self-Review hook 機械強制 / #59 (private archive) Codex reviewer 安全 wrapper + auto-memory sandbox 文書化 / #60 (private archive) β-1 WSL repo path 統一 / #61 (private archive) β-2 ClaudeDesktop 統合 + 実機 CSV 検証 / #64 (private archive) Vitest 7-7a 初期化 + UI 画面 #56 (private archive) UI-00 ホーム / #58 (private archive) UI-shortcuts / #62 (private archive) UI-07 CSV 取込み（UI-09a #65 / UI-09b #66 / UI-06a #67 は Current Phase L7 + Progress Tracker 第8段階に記載）
- [ ] **機械強制 3 施策プラン (施策 3 完了 / 施策 1-2 後続) + PR #56 Test Count 561 → 563 bump 残** — PR #56 罠 7 個 (A〜G) を Claude 公式 docs ベース hook で機械強制で潰す施策。施策 3 は PR #57 (private archive) merge 完了 ✅ (`84741b5`、L17 専用 entry 参照)。残: 施策 1 (drift keyword grep / Stop event hook 新規、warn-only から 1 週間運用観察後に着手) + 施策 2 (doc-impl drift / `doc-consistency-check.sh --target plan-impl-drift` 拡張、施策 1 が落ち着いてから別 PR)。プラン: [docs/archive/plans/2026-05-09-pr56-mechanical-enforcement.md](archive/plans/2026-05-09-pr56-mechanical-enforcement.md)。ai-core 構想は調査メモのみ (Claude Code に外部 repo 共有 memory の公式パターン無し、別セッションで詳細化)
- [ ] **PR #68 (private archive) chore 完了済プラン 2 本 archive 移送（open）** — `docs/plans/` の PR #58 (8-6 UI-shortcuts) / PR #66 (8-5 UI-09b) 完了プランを `docs/archive/plans/` へ移送 + 相対リンク深さ +1 変換（archive/plans 自己参照は同ディレクトリ短縮）+ 外部参照 4 ファイル整合（Plans.md / DEV_SETUP_CHECKLIST / ui-task-specs / 54-ui-shortcuts）。本筋 PR「選択状態トーン統一 + 全画面 nav fix」着手前の cleanup（独立 chore PR）。doc-consistency 設計書 19 ERROR 0 / plan 9 項目 x2 全通過 / R3 290 件実在。`docs/archive/plans/2026-05-20-phase-2-ui-06a.md` L371 の「積み残し 2 件」回収
- [ ] **3 PR progression「選択状態トーン統一 + 全画面 nav fix」**（Backlog umbrella を 3 PR に分割、プラン [docs/plans/2026-05-22-tone-and-nav-fix.md](plans/2026-05-22-tone-and-nav-fix.md)。PR #67 UI-06a 初 Windows native L3 デモ起因）。依存: PR-1→PR-2 は `SidebarLink.tsx`/`TabsHeader.tsx` 共有で直列、PR-3 独立。実務最適順 PR-1→PR-3→PR-2
  - [x] **PR #69 (private archive) PR-1 nav active + sales h1**（squash merge `6fd26b3`、Codex P1/P2/P3 全 0 + CI green）— `SidebarLink.tsx` + `TabsHeader.tsx` 3 箇所 `activeOptions.includeSearch:false` で search 付き URL の active 維持（B1）+ DailySalesPage/MonthlySalesPage h1「売上レポート」→「日次売上」「月次売上」分離（U4）。RTL 2 本（`SidebarLink.test.tsx` + `TabsHeader.test.tsx`）で active 維持を CI 証明（Codex P2-1）。L3 任意
  - [ ] **PR-2 選択状態トーン中庸統一**（PR-1 後 rebase 直列）— チップ / 売上タブ / サイドバー active を中庸 stone 系で統一 + `selection-tone.ts` SSOT 定数。L3 必須（A/B/C 実機比較で user 決定）
  - [ ] **PR #70 (private archive) PR-3 demo seed stockout/low + 月次カード truncate**（`fix/seed-stockout-and-monthly-card`、open）— `seed_demo.rs` index bucket で stockout(i==1→0)/low(i==2→cm300/pcs2) 決定的注入（rng 消費順序保持で `seed_uses_deterministic_rng` 無変更 pass、色分け契約 H 検証）+ seed_test 3 本（stockout / low は `>0` 条件 Codex P2-2 / 部門分散）+ monthly/daily SummaryCardsBar `truncate`+`min-w-0`。L3 必須

## Next Session Entry Point

バックエンド全層（v0.6.0）+ UI 基盤 Phase 1 の Task 7-1〜7-5c + 7-9/7-10 + UI-12 共通レイアウト + **Phase 2 8-1 UI-00 (PR #56)** + **8-6 UI-shortcuts (PR #58)** + **8-2 UI-07 CSV 取込み (PR #62)** + **8-3 UI-09a 日次売上 (PR #65)** + **8-5 UI-09b 月次売上 + 8-7 useExportFile 共通化 (PR #66)** + **8-4 UI-06a 在庫照会 (PR #67、`cf89082`、初 Windows native L3 デモ起因の F1/F2/余白/detail guard 修正、Codex CLI Round 1-4 全 close)** までマージ済 = **Phase 2 毎日使う 5 画面すべて実装完了**。残 Phase 2: 8-0 利用者デモ gate / 8-9 完了時判定 + 別 PR「選択状態トーン統一 + 全画面 nav fix」（Backlog 参照）。

### Phase 2 残着手順序
1. **別 PR「選択状態トーン統一 + 全画面 nav fix」** — B1 全画面 active 消失バグ（確定、優先度中〜高）+ F2 マイルド統一 + U1t/U4 等（Backlog 参照）
2. **8-0 利用者デモ (必須 gate)** — 5 画面 (UI-00/07/09a/09b/06a、全マージ済) の操作フロー合意
3. **8-9 Phase 2 完了時判定** — E2E テスト範囲 (Vitest + RTL カバレッジ実測後決定) / 視覚回帰テスト採否 / typedInvoke 段階撤去 (FallbackCommand 空化、`v0.8.0-ui-daily` タグ gate)
4. **Phase 1 残タスク優先順判断** — 7-6 Storybook / 7-7b hooks+axe / 7-8a Error Boundary (§6.10) / 7-8b 横断UI標準化 / 7-8c unsaved changes ガード / 7-11 UI 開発 workflow 文書化 (タグ目標 `v0.7.0-ui-foundation`)
7. **Phase B-3 先送り候補**: Playwright smoke + `size-limit` — Phase 2 完了時に再評価

### UI層実装（第7段階 Phase 1 継続）の前提（2026-04-16 確定）

- [docs/UI_TECH_STACK.md](UI_TECH_STACK.md) — 技術スタック決定書（React 19 + Tauri 2 + shadcn/ui + TanStack + Tailwind stone系）+ デザイン哲学4本柱
- [docs/SCREEN_DESIGN.md](SCREEN_DESIGN.md) — 19画面の設計、毎日使う5画面のモックアップ完成済み
- ARCHITECTURE.md UI層タスク一覧（UI-00〜UI-13）は2026-04-16 追記済み: **UI-00 ホーム画面 + UI-13 整合性検証画面を新規追加**（§9 UI-task-specs.md と §2 タスク一覧を更新済み）

### Phase 1 着手時の判定事項（UI_TECH_STACK.md §7.1 + 2026-04-19 gap 分析）

#### 初日に確定必須（ブロッカー級 P0）
- **ルーティング選定**: TanStack Router vs React Router v7（2h 以内、UI_TECH_STACK.md §7.1 保留解消）
- **invoke 型定義方式**: tauri-specta 自動生成 vs 手動（2h 以内、UI_TECH_STACK.md §2.5 に追記）
- **TanStack Query キャッシュ戦略表**: queryKey 命名規約 + 画面別 staleTime/gcTime（1h 以内、UI_TECH_STACK.md §2.5 に追記）

#### Week 1-2 で確定（補強 P1）
- **Error Boundary 戦略**: ページ / アプリ / Suspense 統合（UI_TECH_STACK.md §6.9 新設）
- **コンポーネント共通テンプレ実装**: Toast / Dialog / EmptyState / ErrorState（方針→実装形）
- **デモデータ seed**: `scripts/seed-demo-data.rs`（UI 開発で手動入力なしで全フロー再現）
- **環境変数・.env 構成**: VITE_DEBUG / VITE_MOCK_MODE の命名規約
- **unsaved changes ガード**: `useUnsavedChangesWarning` hook + `isDirty` 連動
- **UI 開発 workflow 文書化**: 3層駆動開発（Layer 1 自動 / Layer 2 設計書照合 / Layer 3 利用者デモ）
- **Storybook 導入判断**: UI-12 共通レイアウト完成後

### 後続フェーズの判定事項（リマインダ）
- **UI-07 着手時**（第8段階 8-2a/b）: CSV取込みフロー状態管理（Zustand vs XState）、IPC channel 採否
- **Phase 2 完了時**（第8段階 8-9）: E2Eテスト範囲（A/B/C）、視覚回帰テスト採否
- **UI-10 着手時**（第10段階 10-4a）: IPC channel 採否（棚卸し長時間処理）
- 各判定の詳細は [UI_TECH_STACK.md §7.2](UI_TECH_STACK.md) 参照

## Blocked

- （なし — E-4仕様確定によりブロッカー解消）

---

## Progress Tracker

### 第1〜第6段階 + 補完 + 横断整備（完了）

> v0.6.0 までの全 progress は [docs/archive/v0_tag_history.md](archive/v0_tag_history.md) に集約（2026-04-19 アーカイブ）

### 第7段階: UI基盤構築（Phase 1、次着手）

**🎯 実行アジェンダ**（ハイブリッド C 案、合計 6-8h、プラン: `/home/kosei/.claude/plans/7-phase-1-ui-fluttering-hamming.md`）:
- Task 0: Preflight 4項目（30min、完了）→ Task 1: Router 本格 prototype（4-5h）→ Task 2: invoke spike（1-2h）→ Task 3: キャッシュ戦略レビュー（30min）→ Task 4: main 反映（30min-1h）

- [x] 7-1. Tailwind CSS 4 導入（`@tailwindcss/vite` プラグイン方式、`src/styles/globals.css` に @theme 定義、stone + セマンティック HEX は UI_TECH_STACK.md §4.1 準拠。2026-04-20 完了 / commit 9747545）
- [x] 7-2. shadcn/ui 初期化（`components.json` 作成、`src/lib/utils.ts`、18 コンポーネント導入: Button / Input / Label / Dialog / AlertDialog / DropdownMenu / Select / Checkbox / RadioGroup / Tabs / Card / Table / Sonner（Toast）/ Form / Badge / Skeleton / Separator / ScrollArea。2026-04-20 完了 / commit abf587c）
- [x] 7-2.5. Task 0 Preflight（P0 検証着手前チェック: WSL2 + Tauri GUI 動作 / pre-push hook 挙動 / React 19 + TanStack Router peer dep / doc-consistency-check.sh の docs/research/ 許容、4/4 項目 OK。2026-04-20 完了 / commit f0cab79、詳細: `docs/research/preflight-2026-04-20.md`）
- [x] 7-3. UI-12 共通レイアウト（サイドバー + メイン2カラム、ナビ、通知バー）— **PR #50 (private archive) マージ完了 2026-04-21、merge commit `d512d01` (squash)**。関数設計 + 実装を 1 PR 統合（UI 関数設計テンプレ 2 段階化を初導入）、Codex Round 1 P2 1 件対応 + Round 2 全 0「マージ可能」判定。設計合意書: `docs/archive/plans/2026-04-21-ui-12-design-agreement.md` (本 Plans.md 同期 PR で archive 移動予定)
- [x] 7-4. **【P0】ルーティング導入** — TanStack Router v1.168.23 採用（ADR-001 / 2bd4876）、main install + routes/ 最小スキャフォールド完了（Task 4）。比較 spike: spike/router-tanstack 5f66acd / spike/router-react-router 3324891（remote 保持）
- [x] 7-5a. **【P0】invoke 型定義方式選定** — tauri-specta v2.0.0-rc.24 採用（ADR-002 / 6e892e2）、search_products + get_product 2 コマンドに specta 適用完了（Task 4）。残 43 commands は Phase 2 以降で段階的。spike: spike/invoke-specta 02f578e（remote 保持）
- [x] 7-5b. **【P0】TanStack Query キャッシュ戦略表** — Phase 1 確定値採用（ADR-003 / 8d54c3c）、UI_TECH_STACK.md §2.5 に補強 6 項目追記完了（Task 4）。Phase 2 完了時に実測で再調整予定
- [ ] 7-5c. `invoke` ラッパ C 案（`src/lib/invoke.ts` 薄ラッパ + `src/lib/invoke-fallback.ts` 期限付き `typedInvoke`）+ TanStack Query 初期化 + devtools + CmdError マッピング + `FallbackCommand` literal union（撤去リスト兼用、初期値 `never`）+ `scripts/check-typedinvoke-count.sh` 件数監視（増減両方で fail）+ eslint 境界ルール（barrel 経由抜け道対策込み）+ Phase 1 toy command `greet` 削除 + index route を search_products デモに差し替え。**【2026-04-21 実装完了、PR 作成前】** `feat/ui-7-5c-invoke-query` ブランチに 7 実装コミット + 1 docs コミット積み上げ、最終検証全通過（probe exit 0 / typedinvoke-count exit 0 / doc-consistency exit 0 / cargo fmt/clippy/test / npm typecheck/lint/format/build）。invoke.ts では `InvokeError` Error 派生クラスを導入して eslint `only-throw-error` を満たし、呼び出し元が `isInvokeError` / `toCmdError` で CmdError を取り出せるように設計。bindings.ts Result 型対応の `unwrapResult` helper を追加（プラン実装時に typedError wrapper の実シグネチャに合わせて拡張）。GUI 疎通は user 側で `cargo tauri dev` 確認後に PR 作成 → Codex レビュー。**撤去期限**: `v0.8.0-ui-daily` タグ gate（`FallbackCommand` union 空化 + `invoke-fallback.ts` 削除 + 件数 CI + eslint ルール撤去）。設計根拠: [ADR-004](research/2026-04-20-invoke-wrapper-adr.md) / 実装プラン: `/home/kosei/.claude/plans/7-5c-dynamic-walrus.md`
- [ ] 7-6. Storybook 導入判断（UI-12 完成後、コンポーネント 10 超でトリガー）
- [x] 7-7a. Vitest 初期化 + option A 純関数 75 ケース (PR #64 (private archive) squash merge `2b30f43`、2026-05-17) / **7-7b 後続**: `@axe-core/react` 組込み + hooks/components test 拡張
- [ ] 7-8a. **【P1】Error Boundary 戦略文書化**（UI_TECH_STACK.md §6.10 に繰り下げ: env 設計が §6.9 に先行実装されたため番号調整。ページ / アプリ / Suspense 統合）
- [ ] 7-8b. 横断UI要素標準化（Toast/Dialog/EmptyState/ErrorState のテンプレート実装）
- [ ] 7-8c. **【P1】unsaved changes ガード**（`useUnsavedChangesWarning` hook + `isDirty` 連動）
- [x] 7-9. **【P1】デモデータ seed**（PR #52 commit 1 `814dc86` 実装完了、`src-tauri/src/bin/seed_demo_data.rs` + `src/seed_demo.rs` で 6 部門 × uniform 100 商品 / suppliers 5 / sale_records 300 / inventory_movements 400、rand seed 固定 `StdRng::seed_from_u64(42)` で決定的、冪等 `ON CONFLICT DO NOTHING` + `--reset` flag、integration test 5 本）
- [x] 7-10. **【P1】環境変数・.env 構成**（PR #52 commit 3-5 で `docs/UI_TECH_STACK.md §6.9` 設計原則新設 + env ファイル 4 本 (.env.example / .env.{development,test,production}) + `src/vite-env.d.ts` 拡張 + `src/lib/env.ts` 新規 + `scripts/check-env-safety.sh` 新規 + CI frontend job step + pre-push ④ section、第三者レビュー P1 3 件反映 (bypass 経路狭め / subfolder + 大文字対応 / 静的検査限界明示 + keyring 導線)）
- [ ] 7-11. **【P1】UI 開発 workflow 文書化**（3層駆動開発: Layer 1 自動テスト / Layer 2 設計書照合 / Layer 3 利用者デモ — 新規 `docs/UI_DEV_WORKFLOW.md` 作成）
- [ ] タグ: `v0.7.0-ui-foundation`

### 第8段階: 毎日使う5画面（Phase 2 — モックアップ完成済み）
- [x] 8-1. UI-00 ホーム画面（REQ-301/302, SP-102-07）— PR #56 (private archive) **マージ完了 2026-05-09、squash merge commit `e6da3d8`**。Codex Round 1-3 全 close + CI Run #220 全 green、archive 4 本完了 (Step 11)
- [x] 8-2. UI-07 CSV取込み（REQ-401）— **PR #62 (private archive) マージ完了 2026-05-16、squash merge `b8db619`**。Codex Round 1-6 全 close (R5+R6 Approve 相当受領、R4 P1-1 反論は `/git/blobs/` raw blob 経路で受容、CI fix `acc0045` で `.npmrc ignore-scripts` 起因の pretypecheck block を workflow `Generate route tree` step 化で対応)。Verification 9 軸全 pass (PowerShell 実走は Windows native Step 1 直接 + Step 2 WSL2 `/mnt/c/...` クロスマウント 55 商品確認)。検証戦略: 合成 Z004 fixture (要求仕様書 SP-401-02 + R122 構造逆算) で正常系 6 項目 + 実 `Z004_260311PLU(商品).CSV` で R128 異形式 + R119 未登録枠除外 1 項目 + UI 単独 useBlocker 1 項目 = 8/10。残 2/10 は drag&drop で再現済。本物 Z004 売上日報での最終検証は Phase 4 UI-08 完成後に持ち越し。実装プラン archive: [docs/archive/plans/2026-05-13-phase-2-ui-07.md](archive/plans/2026-05-13-phase-2-ui-07.md)、Round 5 plan archive: [docs/archive/plans/2026-05-15-pr62-round5.md](archive/plans/2026-05-15-pr62-round5.md)、関数設計: [docs/function-design/55-ui-csv-import.md](function-design/55-ui-csv-import.md)
  - [x] 8-2a. **着手時判定 完了**: CSV取込みフローの状態管理 — **採用: useReducer + discriminated union**（Zustand store 不採用、Phase 5 stocktake で再判定）
  - [x] 8-2b. **着手時判定 完了**: IPCストリーミング（Tauri channel）採否 — **不採用 (indeterminate spinner + 状態文言で代替)**、Tauri channel 導入は Phase 4 UI-10 棚卸し / UI-09b 月次集計の長時間処理で再判定
- [x] 8-3. UI-09a 日次売上レポート（REQ-501）— **PR #65 (private archive) マージ完了 (2026-05-17、squash merge `8c2be51`、`feat/ui-09a-daily-sales` リモート / ローカル branch 削除済)**。Codex Round 1-3 全 close (Round 1 P1+P3+P4 / Round 2 P3+P4 / Round 3 Approve 相当、P4 PR description trace のみ `gh pr edit` で対応)。実装 19 file 新規 + 11 file 更新、Vitest 32 ケース全 pass、14 verify 全 pass。Round 1: ResultStep CTA settlementDate URL state (P1、settlementDate ≠ today で取込み済データ表示成立) + 56-ui-daily-sales.md §56.2/§56.6 を bindings 実装 (snake_case + source:string 防御 if-else) 同期 (P3) + bindings.ts trailing whitespace trim (P4)。Round 2: 旧 CTA contract drift 3 箇所 (ui-task-specs.md L230 + plan §1.2/§8) 一括書換 (P3 再発防止) + plan 内 Manual 件数表記「12→13 項目」統一 (P4)。設計: [docs/function-design/56-ui-daily-sales.md](function-design/56-ui-daily-sales.md)、実装プラン archive: [docs/archive/plans/2026-05-17-phase-2-ui-09a.md](archive/plans/2026-05-17-phase-2-ui-09a.md)。**Sonner id 注記**: 本 PR 当時の `export-daily-csv-success`/`export-daily-csv-error` は history reference、PR #66 UI-09b で `export-${reportType}-success/error` 形式に rename (`-csv-` セグメント削除、reportType ごと dedup)
- [x] 8-4. UI-06a 在庫照会（REQ-301/302/303統合）— **PR #67 (private archive) マージ完了 (2026-05-21、squash merge `cf89082`、ブランチ削除済)**。初 Windows native L3 デモ起因の F1（詳細を最下部固定→選択行直下 colSpan インライン展開 + selected clear + list失敗フォールバック）+ F2（チップ選択 solid stone-700 コントラスト強化）+ 余白（p-6 売上統一）+ detail guard（isAllEmpty 空振り防止）。Codex CLI Round 1-4 全 close（R1 P2x2 実装 / R2-R3 P3 doc / R4 clean、P1 ゼロ）。L3 デモ gate 通過（F1/F2/余白 user 目視）。Vitest 41 ケース。修正 plan archive: [docs/archive/plans/2026-05-21-phase-2-ui-06a-demo-fixes.md](archive/plans/2026-05-21-phase-2-ui-06a-demo-fixes.md)、関数設計: [docs/function-design/58-ui-stock-inquiry.md](function-design/58-ui-stock-inquiry.md)
- [x] 8-5. UI-09b 月次売上レポート（REQ-502）— **PR #66 (private archive) マージ完了 (2026-05-19、squash merge `caf7d57`、`feat/ui-09b-monthly-sales` リモート / ローカル branch 削除済)**。Codex Round 1-5 全 close (R1 P2x2 = 5 列 drift fix + sort URL state 接続 7 箇所 / R2 P2x2 = CMD docs SalesReportType + UI docs prev_month_comparison contract + 空配列 test / R3 P2x1+P3x1 = 実装コメント drift 2 箇所 + PR description / R4 P3x1 = Plans.md:155 Backlog 分離明示 / R5 P3x1 = PR description test 件数 `gh pr edit`、全て drift fix 系で P1 ゼロ)。1 useQuery + 派生 6 純関数 + prev_month_comparison field 派生（UI-09a 2 useQuery 機械的横展開でなく BIZ 設計前提に従う、Q-5）+ 8-7 useExportFile 共通化 + TabsHeader 共通化 + Progress wrapper + SalesReportType specta 化、Vitest 74 ケース pass。修正 plan archive: [docs/archive/plans/2026-05-19-pr-66-codex-r1-p2-fixes.md](archive/plans/2026-05-19-pr-66-codex-r1-p2-fixes.md)、関数設計: [docs/function-design/57-ui-monthly-sales.md](function-design/57-ui-monthly-sales.md)
- [x] 8-6. ショートカット一覧ダイアログ（Ctrl+/ 対応、グローバル + 画面固有）— **PR #58 (private archive) マージ完了**（2026-05-12、squash merge commit `452fe0a`、`feat/ui-shortcuts-dialog` ブランチ削除済）。Windows native 手動検証 10 項目 pass、Codex Round 1-4 全 close。実装プラン: [docs/archive/plans/2026-05-12-phase-2-ui-shortcuts.md](archive/plans/2026-05-12-phase-2-ui-shortcuts.md)、関数設計: [docs/function-design/54-ui-shortcuts.md](function-design/54-ui-shortcuts.md)、Q-3 合意経緯: [docs/archive/plans/2026-05-09-phase-2-ui-00.md](archive/plans/2026-05-09-phase-2-ui-00.md)
- [x] 8-7. ファイルエクスポート後 UX 共通化（成功通知 + エラー処理）— **PR #66 (private archive) で同時実装、squash merge `caf7d57`** (`useExportFile` 抽出 + UI-09a `useExportDailySalesCsv` を wrapper 化 + Sonner id `export-${reportType}-success/error` reportType ごと dedup、SalesReportType bindings import で drift 耐性)
- [ ] 8-0. **利用者デモ（必須 gate）**: 5画面を実機で触ってもらい操作フロー合意
- [ ] 8-9. **Phase 2 完了時判定事項**:
  - [ ] E2Eテスト範囲（選択肢A: 毎日5画面のみ / B: 全画面 / C: 見送り）— Vitest+RTL カバレッジ実測後に決定（UI_TECH_STACK.md §7.2）
  - [ ] 視覚回帰テスト採否（現方針は見送り、Playwrightスクショ導入のトリガー発動有無）
- [ ] タグ: `v0.8.0-ui-daily`

### 第9段階: 商品管理 + 入出庫画面（Phase 3）
- [ ] 9-1. UI-01a 商品検索・一覧（REQ-103）
- [ ] 9-2. UI-01b 商品登録・編集（REQ-101, 102）
- [ ] 9-3. UI-01c 商品一括インポート（REQ-104）
- [ ] 9-4. UI-02 入庫記録（REQ-201）
- [ ] 9-5. UI-03 返品・交換（REQ-202）
- [ ] 9-6. UI-04 手動販売出庫（REQ-203）
- [ ] 9-7. UI-05 廃棄・破損（REQ-204）
- [ ] タグ: `v0.9.0-ui-product-inventory`

### 第10段階: 在庫特殊 + システム管理（Phase 4）
- [ ] 10-1. UI-06b 在庫少一覧（REQ-302 個別）
- [ ] 10-2. UI-06c 在庫変動履歴（REQ-303）
- [ ] 10-3. UI-08 PLU書出し（REQ-402）
  - [ ] 10-3a. 実機動作確認（TSVインポート→SDカード→レジ読込み）
- [ ] 10-4. UI-10 棚卸し（REQ-205、中断再開UIが特殊）
  - [ ] 10-4a. **着手時判定**: IPCストリーミング（Tauri channel）採否 — 長時間処理の進捗通知方式（UI_TECH_STACK.md §7.2）
- [ ] 10-5a. UI-11a 閾値設定画面
- [ ] 10-5b. UI-11b バックアップ画面
- [ ] 10-5c. UI-11c 操作ログ画面
- [ ] 10-6. UI-13 整合性検証画面（REQ-403、BIZ-07 との連携）
- [ ] タグ: `v1.0.0`

### Backlog
- [ ] **UI デザイン哲学探索（継続）** — 各 Phase 末で STEP 5 再訪。japanese-webdesign 等の追加採用、新規 Skill 台頭の監視。再検討トリガーは [UI_TECH_STACK.md §7.3](UI_TECH_STACK.md) 参照
- [ ] Q40 障害時対応の具体化（UI-13 実装時にエラーバウンダリ方針と合わせて）
- [ ] **UI-11c 監査ログ表示設計の具体化**（Phase 10 着手前）— architecture/ui-task-specs.md §UI-11c に「表示項目・JSON payload 整形・MNT-04 ログファイル導線」を追記
- [ ] **Claude Design 導入判断**（Phase 8 着手時）— screen_mockups.html → Claude Design → Claude Code handoff の 3 段パイプラインを pilot 運用。stone パレット + refactoring-ui 哲学尊重度で本採用判定（https://claude.ai/design）
- [ ] **`collect_commands!` vs `generate_handler!` 差分検知 CI**（Phase 2 着手前）— tauri-specta の `collect_commands!` と tauri の `generate_handler!` の command 列挙が乖離した場合に CI でブロックする仕組み。Phase 2 で commands 追加する前に導入必須。出典: PR #42 Codex レビュー申し送り事項
- [ ] **TanStack Router 生成設定の一本化**（PR C マージ後 follow-up）— 現状 `@tanstack/router-cli` の `tsr generate` と `@tanstack/router-plugin/vite` の `tanstackRouter(...)` で route 生成が二経路。冪等だが設定ドリフトリスクあり。`tsr.config.*` に寄せて CLI と Vite plugin が同一設定を読む構成を検討する。出典: PR #45 Codex 再レビュー P3 指摘（2026-04-20、マージ可能判定と同時の任意改善項目）
- [ ] **npm audit 3 vulnerabilities 修正**（PR C マージ後 follow-up）— moderate x2 (smol-toml via markdownlint-cli2)、high x1 (vite 7.0.0 – 7.3.1 / 3 CVE: GHSA-4w7w-66w2-5vf9 / GHSA-v2wj-q39q-566r / GHSA-p9ff-h696-f583)。PR C では CI 可視化のみ（`continue-on-error: true` warn-only、Codex PR #46 P4 対応）。実修正は vite 7.3.2+ 更新 + markdownlint-cli2 更新で breaking 検証要。出典: PR C プラン `/home/kosei/.claude/plans/2026-04-20-phase-b-1-goofy-quilt.md`
- [ ] **CI frontend job 名と branch protection rule の整合性確認**（GitHub Pro / Team 移行時）— PR C で frontend job 名を `Frontend build` → `Frontend (typecheck + lint + format + build)` に変更済。現状 private repo + 個人プランで branch protection rule 取得不可（HTTP 403）のため rule 側が旧名固定かは未確認。Pro / Team 移行時に `gh api /repos/.../branches/main/protection` で required status checks 名を現行 job 名に揃える。出典: Codex PR #46 Round 1 P3 指摘（2026-04-20）
- [ ] **CI ビルド対象 Node を 20 → 22 LTS に更新検討**（緊急度低）— Actions 側 runtime は PR #46 で Node 24 対応のメジャー更新済（`actions/checkout@v6` / `actions/setup-node@v6` / `actions/cache@v5`）。残るは `node-version: 20` のビルド対象更新。Node 20 は 2026-04-30 から Maintenance LTS、Node 22 は 2024-10 から 2027-04 まで Active LTS。vite 7 / TypeScript 5.8 / ESLint 9 / TanStack は Node 22 対応確認済。ローカル dev 環境（WSL2 nvm 管理）との整合を取って別 PR で更新。出典: Codex PR #46 Round 2 P3 任意改善（2026-04-20）→ action メジャー更新は PR #46 内で対応、node-version のみ follow-up に残す
- [ ] **typedInvoke 段階撤去**（撤去期限: `v0.8.0-ui-daily` タグ gate）— `src/lib/invoke-fallback.ts` の `FallbackCommand` literal union を空にし、ファイル削除 + `scripts/check-typedinvoke-count.sh` / `scripts/typedinvoke-baseline.txt` 削除 + eslint `no-restricted-imports` / `no-restricted-syntax` ルール撤去まで完了させる。条件: Phase 2 で specta 化した command は必ず `commands.*`（bindings.ts）経由に移行、撤去達成前に `v0.8.0-ui-daily` タグ打ち禁止。設計根拠: [ADR-004 invoke ラッパ設計](research/2026-04-20-invoke-wrapper-adr.md)
- [ ] **specta 化対象 commands 段階化リスト**（Phase 2 着手時に逐次展開）— Phase 2 UI-00 着手前に specta 化必須な commands を実測で確定。**UI-00 PR #56 で specta 化済 (commit `2c1ac37`)**: `get_daily_sales` ✓ / `list_low_stock` ✓ (D-1 採用、`get_low_stock_count` ではない) / `list_plu_dirty` ✓ / `list_csv_imports` ✓ (前日未取込み警告 D-8 用) / `search_products` ✓ (Phase 1 既済)。以降 UI-07 (CSV 取込み) → UI-09a (日次売上) → UI-06a (在庫照会) → UI-09b (月次売上) の各着手時に必要 commands を Rust 側で `#[specta::specta]` + `collect_commands!` 登録 + bindings 再生成 → `FallbackCommand` union から削除 + 件数 baseline bump down。Backlog 項目「`collect_commands!` vs `generate_handler!` 差分検知 CI」と組で Phase 2 着手前に導入。設計根拠: [ADR-004 invoke ラッパ設計 §2.3 / §3](research/2026-04-20-invoke-wrapper-adr.md)
- [ ] **Plan レビューラリー仕組み化 第 2 段階 (案 C 自動 loop)** — `plan-critic` subagent (read-only) + ExitPlanMode hook で JSON parse → 指摘件数 > 0 で deny → 収束まで loop。`.claude/agents/plan-critic.md` + `.claude/hooks/validate-plan-on-exit.sh` 新規。`maxTurns: 3` (timeout) / 指摘 5 件上限 (token) / `max-plan-review-rounds: 3` config (収束無限化対策) / 7 観点 JSON schema 型注入 (critic agent 自身の bias 排除) / "reject only if fundamentally flawed" + warn-only mode (false positive)。本 PR `feat/ui-00-home` では第 1 段階 (commit `e0c5365` `chore(hooks): enforce Self-Review content depth + Plan rally requirement before ExitPlanMode` = check-plan-on-exit.sh への A 内容深さ検証 + D-1 直近 agent log check 追加) のみ実装、第 2 段階の案 C は Phase 2 完了後の別 PR で実装。設計根拠: claude-code-guide subagent 公式 docs 評価（[Anthropic Engineering Agent Teams](https://code.claude.com/docs/en/agent-teams) / [Hooks](https://code.claude.com/docs/en/hooks) / [Slash Commands](https://code.claude.com/docs/en/agent-sdk/slash-commands)）。出典: 本セッション Plan agent ラリー第 1〜4 段（`aa1f2cd32bb596613` / `aee470711f0415c29` / `aca578f0f9e1ce167` / `a35f4c603a47ee799`）で B-1〜B-10 + Self-Review 7 観点反映漏れ + D 拡張 12 ペア + 二次 drift 6 ペアを順次発見した実証実験
- [ ] **`invalid language tag` RangeError 調査**（PR #56 UI-00 由来既存 issue、優先度低）— `Unhandled Promise Rejection: RangeError: invalid language tag` が起動時 / ホーム画面初期表示時に 1 回発火 (2026-05-12 Phase 2 8-6 検証中のユーザ報告、stack: `handlerError-Q7GRFEEB.js:755/580/158/153`)。発生箇所候補 4 件: `src/features/home/hooks/useYesterdayDate.ts:12` `toLocaleDateString("sv-SE")` / `src/features/home/HomePage.tsx:16` `new Intl.DateTimeFormat("ja-JP", ...)` / `src/features/home/HomePage.tsx:25` `todayFormatter.format(...)` / `src/features/home/components/SummaryCards.tsx:10` `new Intl.NumberFormat("ja-JP", ...)`。本 PR 8-6 (Shortcuts) のキー処理経路とは無関係 (連続トグル中に追加発火なし、Shortcuts コード内に Intl/toLocale 使用 0 件)、UI 動作崩壊もなし。WebView2 が特定の BCP-47 tag の locale data を解決できないと RangeError を投げる既知挙動の疑い。別 PR で各 Intl/toLocale 呼び出しに try/catch fallback or `"sv-SE"` → `undefined` (ISO 8601 デフォルト) 化を検討
- [ ] **specta bindings.ts 出力後の trailing whitespace 自動 trim 仕組み化**（PR #65 + #66 で 2 度発生、Rule-of-three 適用候補、緊急度低）— specta-typescript の `/** ... \n * \n */` 出力で doc comment 中間行に trailing whitespace が混入（`git diff --check` でノイズ検出）。**PR ごとの扱い分離**: PR #65 では `sd '[ \t]+$' '' src/lib/bindings.ts` 手動 trim で対応 (Codex PR #65 Round 1 P4)、PR #66 では commit `4e72955` の specta 再生成後は出力をそのまま残し PR description で「specta 出力に従う」と明示する B 案を採用 (再 trim は commit 0.5 で解消した CI bindings drift fail を再発生させるリスクで却下、Codex R3 P3-1 → R4 修正 + R4 P3-1 → R5 修正で本 Backlog 行の記述を分離明示に書き換え)。再生成毎に再発するため恒久対応案: `cargo run --bin generate_bindings` 後段で `sd` + `prettier --write` を自動実行する shell script (`scripts/post-generate-bindings.sh` 新規) + DEV_SETUP_CHECKLIST §12.2 で `cargo run --bin generate_bindings && ./scripts/post-generate-bindings.sh` セット運用を明示。出典: Codex PR #65 Round 1 P4 + PR #66 Round 3-4 P3-1
- [ ] **UI-09a/b 設計判断の将来精査 6 項目**（Phase 2 8-3 PR #65 + 8-5 PR #66 由来）— (1) **REQ-501 取引件数の集計単位詳細仕様**: 現行 UI-09a は `sale_records / DailySalesReport.items` 行数を「売上明細数」として表示、レシート単位の「取引件数」は `receipt_id` / POS 取引キー / CSV 行グルーピング仕様確認後に BIZ-05 拡張として別 PR / (2) **税率別合計の必要性確認**: モックアップ + SP-501 明示なしで UI-09a 非表示の設計判断、表示要求があれば BIZ-05 `DailySalesReport` に `tax_rate_subtotals: Vec<TaxRateSubtotal>` 拡張 + CMD/UI 連鎖を別 PR / (3) **REQ-501 単価列の意味精査**: UI-09a Phase 2 では `abs(amount) / abs(quantity)` 派生値を「実績単価」として表示、商品マスタ販売単価 / 値引前単価 / レシート単価などの厳密区別が必要になったら BIZ-05 DTO 拡張または `sale_records.unit_price` 系カラム追加を別 PR で検討 / (4) **UI-09b Q-1 営業日数 / 日平均算出 (BIZ-05 拡張)**: 現行 UI-09b は「期間: YYYY/MM/DD-MM/DD」固定文言表示、営業日数 + 日平均が必要になったら BIZ-05 `MonthlySalesReport` に `business_days: u32` + `daily_average_amount: i64` 拡張 + 祝日マスタ導入別 PR / (5) **UI-09b Q-4 部門情報の MonthlySaleItem 拡張 + 商品ランキング部門列 + 部門フィルタ Select**: 現行 BIZ-05 `MonthlySaleItem` に部門情報なし、表示要求があれば DTO に `department_id` + `department_name` 拡張 + UI 部門フィルタ Select 別 PR / (6) **UI-09b BIZ-05 `MonthlySaleItem` に `product_count` field 拡張 + DepartmentTable 5 列復活** (PR #66 Codex R1 P2-1 drift 由来): 現行 BIZ-05 `MonthlySaleItem` に商品数情報なし、PR #66 では DepartmentTable を 4 列実装で確定 (商品数列非対応)。表示要求があれば BIZ-05 DTO に `product_count: u32` 追加 + DepartmentTable に 5 列目復活 (4 → 5 列、設計書 `ui-task-specs.md` + `function-design/57-ui-monthly-sales.md` 同 stage 更新)、別 PR (BIZ 側 trigger)
- [ ] **SortableHeader 共通化 (frontend refactor)**（PR #66 Codex R1 P2-2 修正の inline 三重定義を解消）— PR #66 commit 3 で `src/features/monthly-sales/components/DepartmentTable.tsx` + `src/features/monthly-sales/components/ProductRankingTable.tsx` に inline `SortableHeader` を追加した結果、既存 `src/features/daily-sales/components/ProductTable.tsx` 含めて計 3 箇所で同型コードが重複。`src/components/sales/SortableHeader.tsx` に `<T extends string>` generic で昇格して 3 箇所統合。**着手 trigger**: (a) Phase 2 終了前の preparatory refactor PR or (b) 次の frontend 共通化 PR 着手時。BIZ-05 `product_count` field 拡張 (BIZ 側 trigger、(6) 参照) とは独立軸 (frontend refactor 軸)
- [x] **inventory-system 知見の gkmas-ocr-pipeline 移植**（外部プロジェクト、2026-05-17 で一旦終わり）— Phase 0/1/2/3 完了で gkmas-ocr-pipeline がほぼ独り立ち。inventory-system 側から持ち出すべきものが新たに見つかった時点で再開する trigger 型運用に切替 (user 判断、2026-05-17)。残 Phase 4 (empirical validation 1 タスク Claude→Codex review ループ実証) + Phase 5 (ocr_pipeline_spec.md 1280 行 docs/style-guide.md §2 2 層分割) + Phase 2-D 遺残 (`/plan-rally` slash command global 化 + `check-plan-on-exit.sh` L181 hard-code 修正 2 件) は gkmas-ocr-pipeline 側 or 再持ち出し時に対応。関連 plan 5 本 archive 済 (`docs/archive/plans/2026-05-17-knowledge-transfer-to-gkmas-ocr.md` + `phase1-{layer-a-mapping,skill-drafts,hooks-draft}.md` + `plan-rally-globalization.md`)
- [ ] **SCREEN_DESIGN.md 一覧表 status カラム全体の意味論整理（他行 drift 一括点検）**（PR #67 UI-06a Q-6 由来）— SCREEN_DESIGN.md「毎日使う 5 画面」一覧表の status カラムが PR #56 (UI-00) 時の全行「完了」一括化の名残で、Plans.md のチェックボックス状態と不整合の可能性（UI-06a は PR #67 で局所修正済だが、UI-00/07/09a/09b 他行も「完了」表記が実態と合っているか未点検）。status カラムの意味論（実装完了 / 設計完了 / PR open 中など）を定義し、全行を一括点検して整合させる。別 PR or post-merge sync で着手
- [ ] **別 PR「選択状態トーン統一 + 全画面 nav fix」**（PR #67 L3 デモ起因。PR #67 で F1/F2/余白/detail guard は対応済、以下は別 PR）— (a) **B1 全画面共通 nav active 消失バグ（確定、優先度中〜高）**: URL search を持つ全画面（在庫照会・売上日次月次等）で検索/フィルタ/タブ変更時にサイドバー active ハイライト（amber）が消える。root cause = `SidebarLink.tsx:38`（UI-12 共通）/ `TabsHeader.tsx:24,33`（売上共通）の `activeOptions` に `includeSearch: false` 欠如（TanStack デフォルト includeSearch:true で search 完全一致要求）。L3 デモで在庫照会再現確認済、1 箇所修正で全画面治る / (b) **選択状態トーン全体統一**: F2（在庫照会チップ solid stone-700）が「やりすぎ」感 → アプリ全体の選択状態（チップ / 売上タブ U1t / サイドバー active）を「マイルドだが一目で分かる」中庸基準で統一（refactoring-ui / ui-skills で複数案を実機比較、memory `feedback-non-it-user-readability-over-aesthetics`）+ U4 日次・月次 h1 分離 / (c) **export dialog**: U3 `useExportFile` の Tauri save dialog plugin 化は npm install 凍結中（Mini Shai-Hulud worm、CLAUDE.md 最重要セキュリティ）のため本 PR 群から除外、Phase 3 の plugin-dialog まとめ移行で対応。暫定代替の Web File System Access API（`showSaveFilePicker`）は experimental + user activation 制約があり本 PR 群に含めない（Windows native spike 候補）/ (d) **demo seed**: D1 `src-tauri/src/seed_demo.rs` に stockout/low 投入（色分け契約 H 検証可能化、full 8-0 gate 前提）/ (e) **B2/B3 月次レイアウト**（文言はみ出し・合計ずれ、CSS 調査要）/ (f) **D2**: Z004 実売上 CSV は Phase 4 UI-08 後（既知、memory `feedback-z004-vs-plu-master-confusion`）

---

## Tag Guarantees

> v0.1.0 〜 v0.5.0 の詳細は [docs/archive/v0_tag_history.md](archive/v0_tag_history.md) にアーカイブ（2026-04-16）。
> 以降は v0.6.0 と今後のタグのみ記載。

### v0.6.0
- MNT層: backup（MNT-01）, log_manager（MNT-02）, diagnostic_log（MNT-04）
- IO層: report_csv_exporter（IO-05）, image_manager（IO-06）, system_repo拡張
- CMD層: settings_cmd（CMD-11: 8コマンド）, receiving_cmd/return_cmd/manual_sale_cmd/disposal_cmd（CMD-02〜05: 7コマンド）, inventory_cmd（CMD-06: 3コマンド）
- テスト546本全パス、clippy警告ゼロ、fmt準拠
- 第6段階（保守+仕上げ）+ CMD-02〜06補完 完了。バックエンド全層（IO/BIZ/CMD/MNT）実装完了

---

## Test Count

> v0.5.0 時点（448本累計）までの内訳は [docs/archive/v0_tag_history.md](archive/v0_tag_history.md) にアーカイブ（2026-04-16）。
> 以降は v0.5.0 → v0.6.0 の差分と今後の追加分のみ記載。

| PR | 新規テスト | 累計 |
|----|-----------|------|
| v0.5.0 タグ時点 | — | **448** |
| MNT-04 診断ログ基盤 | 9 | 457 |
| MNT-04 レビュー対応（DB移行テスト） | 4 | 461 |
| Phase 6 PR-1 (設計書) | 0 | 461 |
| Phase 6 PR-2 (IO-05/06 + system_repo) | 23 | 484 |
| Phase 6 PR-2 レビュー対応 | 1 | 485 |
| Phase 6 PR-3 (MNT-02 ログ管理) | 6 | 491 |
| Phase 6 PR-4 (MNT-01 バックアップ) | 15 | 506 |
| Phase 6 PR-4 レビュー対応 | 1 | 507 |
| Phase 6 PR-5 (CMD-11 コマンド群) | 8 | 515 |
| Phase 6 PR-5 レビュー対応 | 3 | 518 |
| Phase 6 PR-5 CMD層変換テスト追加 | 3 | 521 |
| CMD-02〜05 (7コマンド + BIZ list) | 6 | 527 |
| CMD-02〜05 レビュー対応 (CMD層テスト) | 7 | 534 |
| CMD-06 (在庫照会 3コマンド) | 4 | 538 |
| CMD-06 レビュー対応 (バリデーション+テスト) | 8 | 546 |
| CMD-09 export_sales_csv (日次・月次CSV) | 8 | 554 |
| CMD-09 レビュー対応 (返却契約+lock失敗テスト) | 2 | 556 |
| PR #52 commit 1 (7-9 seed demo data + seed_test 5 本) | 5 | 561 |
```
