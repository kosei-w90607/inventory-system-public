# PR #42 Codex P3 対応プラン（完了アーカイブ）

> **完了日**: 2026-04-20
> **元プラン**: `/home/kosei/.claude/plans/archived-memo-md-pr-commit-pr-ci-joyful-pancake.md`（Claude 個人作業ファイル）
> **関連 PR**: #42 Task 4 再レビュー (private archive)（マージ済 merge commit `6d0dfed`）

---

## 完了サマリ

PR #42（Task 4 再レビュー: greet 登録 + bindings パス修正）の Codex レビューで検出された **P3 軽微 2 件 + 非ブロッカー任意改善 1 件** に対応し、マージまで完了。

| 指摘 | 対応 commit | 内容 |
|---|---|---|
| P3-1 ADR 文言 | `a996b34 fix(docs)` | `docs/research/2026-04-20-invoke-type-adr.md:204` の「invoke_handler は変更なし」→「Phase 1 疎通確認用 greet の 1 件追加のみ、既存 45 command の列挙は変更なし・呼び出し互換維持」に事実訂正 |
| P3-2 削除漏れ防止 | `a486764 chore(scripts)` | `scripts/check-phase1-probe-removed.sh` 新規追加（rg ベースの軽量検知、Phase 2 UI-00 着手前の手動チェック用） |
| 進捗反映 | `99d725e docs(plans)` | Plans.md に 7-5c 着手前チェック明記 + Backlog 差分検知 CI 追加 + Task 4 進捗更新 |
| 進捗反映 | `e426062 chore(plans)` | Plans.md に Codex P3 3 commit の hash 列挙 |
| P4 任意改善 | `7a46100 fix(scripts)` | scripts に `rg`/`git` 前提チェック追加（exit 2 で前提不備を明示区別） |
| 進捗反映 | `d628e4c chore(plans)` | Plans.md に P4 対応 + Codex 2 回通過記録 |

**Codex 再レビュー 2 回通過、重大 findings なし、CI 3/3 緑確認後マージ実行**。

### 申し送り事項（Phase 2 着手前に対応）

Codex が指摘した Phase 1 P0 残存リスク: **`collect_commands!`（tauri-specta）と `generate_handler!`（tauri）の command 列挙乖離**。CI で差分検知する仕組みを Phase 2 で commands 追加する前に導入必須。Plans.md Backlog に登録済み。

---

## Phase A: PR #42 Codex P3 対応（実施内容）

### Step A-1: ADR 文言修正 (P3-1) — a996b34

対象: `docs/research/2026-04-20-invoke-type-adr.md:204`

事実訂正 1 行のみ。line 205 の既存訂正履歴記述と整合。影響範囲: ADR への外部 link は `docs/UI_TECH_STACK.md:198` のみで line 204 非依存、修正影響なし。

### Step A-2: grep スクリプト作成 (P3-2) — a486764

新規ファイル: `scripts/check-phase1-probe-removed.sh`

- `rg` で `greet` 参照を検知（CLAUDE.md 準拠、`grep` 非使用）
- 検知対象: `src-tauri/src/lib.rs` + `src/`（`docs/` は対象外、`routeTree.gen.ts` / `lib/bindings.ts` 除外）
- exit code 設計: 0 = 削除完了、1 = 残留あり
- 実行タイミング: Phase 2 UI-00 着手前の手動チェック（CI 常時実行にせず）

### Step A-3/A-4: Plans.md 反映 — 99d725e / e426062

- 7-5c に着手前チェック明記（`bash scripts/check-phase1-probe-removed.sh`）
- Backlog に `collect_commands!` vs `generate_handler!` 差分検知 CI 項目追加
- Task 4 再レビュー行を 14 commit 実績 + Codex P3 3 commit hash 列挙で更新

### Step A-5: P4 任意改善対応 — 7a46100

Codex 第 2 回レビューの非ブロッカー任意改善「`rg` 未導入環境 / git 管理外実行の前提チェック」に対応。

scripts に 2 つの前提チェック追加:

1. `command -v rg >/dev/null` で rg 存在確認 → 未導入なら exit 2
2. `git rev-parse --show-toplevel` 失敗時 → exit 2

exit code を 3 値化（0 = 削除完了 / 1 = 残留あり / 2 = 前提不備）。動作確認済み（`/tmp` から実行 → exit 2 返却）。

### 技術的前提（判明事項）

- **LSP/Skills Policy**: 編集対象は Markdown + Shell のみ → LSP tool 呼び出し不要
- **Rebase 判断**: 追加 push で対応（rebase せず）
- **コミット prefix**: `fix(docs)` / `chore(scripts)` / `docs(plans)` / `fix(scripts)` / `chore(plans)` の既存 style 踏襲
- **pre-push hook**: 非 Rust / 非 `docs/function-design/` 変更は SKIP 通過（実測確認済）

---

## Phase B: フロント開発体制整備ロードマップ（次プラン）

PR #42 マージ後、別プランファイルで段階実装。**本アーカイブは Phase B の骨子のみ記録**し、詳細は次プラン作成時に別途プランファイルを起こす。

### プラン 1（Phase B-1、直後着手）: CI 品質基盤

- **スコープ**: Prettier + ESLint flat config + `eslint-plugin-jsx-a11y` + typecheck 独立ジョブ + `npm audit` (warn-only) + lefthook (pre-commit)
- **PR 分割**:
  - PR A: Prettier + `.editorconfig` + 初回整形
  - PR B: ESLint flat config + jsx-a11y + `typecheck` script
  - PR C: lefthook + `ci.yml` frontend ジョブ拡張 + npm audit
- **見積**: 3-5h

### プラン 2（Phase B-2、Phase 2 着手直前）: ユニットテスト基盤

- **スコープ**: Vitest + `vitest-axe` + `@testing-library/react` + `@testing-library/user-event` + pre-push フロント分岐
- **着手タイミング**: 7-5c invoke ラッパ実装と同時

### プラン 3（Phase B-3、Phase 2 中盤）: E2E + バンドル監視

- **スコープ**: Playwright smoke + `size-limit`
- **着手タイミング**: UI-00 + UI-07 が動いた時点

### バックログ（Phase 4 以降で再評価）

- Dependabot or Renovate（依存更新自動化）
- path filtering（CI 時間問題化時）
- Lighthouse CI 相当（Tauri WebView 向けに要再設計）
- **Phase 2 前の `collect_commands!` vs `generate_handler!` 差分検知 CI**（Plans.md Backlog 反映済み、Phase 2 着手前に独立プラン化）

### 採用ツールのベストプラクティス調査方針

**各採用ツールは実装時に公式 docs / context7 / WebSearch で 2026-04 時点のベストプラクティスを確認してから適用**。プラン段階では方針のみ確定、細部は実装時に確定。

---

## 派生 memory

本プラン実行中にユーザー feedback から新規保存:

- `memory/plan-self-review-before-implementation.md` — 複数 step を含むプランは ExitPlanMode 前にセルフレビューで抜け漏れ潰す（7 観点チェックリスト）
- `memory/codex-non-blocker-incorporation.md` — Codex 非ブロッカー/任意改善指摘は軽量 + PR スコープ内 + レビュー 3 回以内なら同 PR で潰す

> ※ 上記 memory ファイルは Claude Code 個人領域 (`~/.claude/projects/-home-kosei-inventory-system/memory/`) に保存されているため repo 外。リンク不可。

---

## 関連

- 前プラン: `/home/kosei/.claude/plans/plan-gentle-porcupine.md`（Task 4 再レビューの P1/P2 対応計画、アーカイブ対象外）
- 前アーカイブ: [`docs/archive/plans/2026-04-20-phase1-p0-hybrid-c-plan.md`](2026-04-20-phase1-p0-hybrid-c-plan.md)（第 7 段階 Phase 1 ハイブリッド C 案プラン）
- Plans.md 現状: Phase A 完了マーク（`[x]` 化）は Phase B-1 初回 commit でまとめて反映予定
