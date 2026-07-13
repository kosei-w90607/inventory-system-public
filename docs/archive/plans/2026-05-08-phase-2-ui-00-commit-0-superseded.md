# UI-00 PR commit 0（repo 整理）— 手順プラン

> **[2026-05-08 archive]** 本プランは PR #53 PR-A（`b9b54a7`）が repo 整理 + Plans.md 同期 + archive 2 件（squishy-sniffing-waterfall / pr-comment-adaptive-pearl）+ CLAUDE.md「プロジェクト外保存禁止」追加 + phase-2-ui-00.md 正式化を**全部吸収済み**のため obsolete 化。本プランの未実施項目は `~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md` の rm のみで、それは改訂版プラン `docs/plans/2026-05-08-phase-2-ui-00-commit-0-revised.md` Step 3 に統合した。本 file は当時の判断記録としてのみ残す。

## 本プラン file の位置付け

- **正ソース**: 本 file (`docs/plans/phase-2-ui-00-commit-0.md`)
- Plan mode 起動時に自動指定された `/home/kosei/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md` は**無効**（memory `feedback-active-plan-in-docs.md` / CLAUDE.md「やってはいけないこと」違反）。ExitPlanMode 直後に `rm` する
- 本 file は commit 0 実行後も active プランとして残り、UI-00 PR マージ時に `docs/archive/plans/2026-04-XX-ui-00-commit-0.md` へ archive（`feedback-archive-relative-path-conversion.md` で相対パス変換）

## Context

PR #52 マージ完了（2026-04-22、merge commit `0ed76ca`）。Phase 2 8-1 UI-00 の実装プランは [docs/plans/phase-2-ui-00.md](2026-05-09-phase-2-ui-00.md) に critic レビュー + ユーザー判断 3 件確定済で合意成立。

運用方針は memory `feedback-plans-sync-commit-milestone-only.md` L22-26 に既に明記（2026-04-22 user 合意）: **Plans.md 同期専用 PR は独立起票せず、次の機能 PR の第 1 commit で吸収**（例示として `chore(plans): post-PR #52 sync + archive` まで具体化済）。

しかし現状 Plans.md `Next Session Entry Point` L29-34 は古い「同期 PR（repo 整理）」step 1 を残しており memory 方針と矛盾。本プランは既定運用を UI-00 着手時に実地適用するための手順書。UI-00 本体実装は [phase-2-ui-00.md](2026-05-09-phase-2-ui-00.md) に委譲。

## 現状の未処理項目

| 種別 | 対象 | 処理 |
|------|------|------|
| M | `CLAUDE.md` | L51 追加行（プロジェクト外保存禁止）をそのまま採用 |
| M | `Plans.md` | 既存差分採用 + Next Session Entry Point step 1 書換 + PR #52 entry 内リンク修正 |
| ?? | `docs/plans/phase-2-ui-00.md` | 新規追加 + commit 分割表と Post-processing を「同期 PR 廃止」方針に修正 |
| ?? | `docs/plans/phase-2-ui-00-commit-0.md` | 本 file、新規追加 |
| D→A | `docs/plans/squishy-sniffing-waterfall.md` → `docs/archive/plans/2026-04-22-phase-1-seed-env.md` | `git mv` + 相対パス深度調整 (`../` → `../../`) |
| 外→A | `~/.claude/plans/pr-comment-adaptive-pearl.md` → `docs/archive/plans/2026-04-22-pr52-codex-round1.md` | repo 外からの取込み（履歴不連続）+ 絶対パス→相対パス変換 |
| 外→rm | `~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md` | Plan mode 自動生成の旧 plan file、ExitPlanMode 直後に削除（archive しない、本 file が正ソース） |

## 実施手順（UI-00 PR の commit 0）

### ステップ 0: ExitPlanMode 直後の後片付け（Plan mode 制約で保留分）

```
rm ~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md
touch /home/kosei/.claude/projects/-home-kosei-inventory-system/memory/.last_audit
```

### ステップ 1: UI-00 ブランチ作成

```
git checkout -b feat/ui-00-home
```

### ステップ 2: Plans.md の追加編集（既存差分に追記）

`Next Session Entry Point` L29-34 の次セッション着手順序 step 1 を削除し以下で置換:

```markdown
### 次セッション着手順序
1. **Phase 2 8-1 UI-00 ホーム画面 PR 着手** — `docs/plans/phase-2-ui-00.md` 準拠。repo 整理（archive 移動 + 本 Plans.md 更新 + CLAUDE.md 追加行 + phase-2-ui-00.md 正式化）は UI-00 PR の commit 0 として統合（Plans.md 同期専用 PR は廃止、memory `feedback-plans-sync-commit-milestone-only.md` L22-26 既定運用）。事前に `npx shadcn@latest add tooltip`。specta 化対象は `get_daily_sales` / `list_low_stock` / `list_plu_dirty` / `list_csv_imports` 4 コマンド
2. **Phase 1 残タスク優先順判断** — 7-6 Storybook / 7-7 Vitest / 7-8a Error Boundary (§6.10) / 7-8b 横断UI標準化 / 7-8c unsaved changes ガード / 7-11 UI 開発 workflow 文書化
3. **Phase B-2 先送り候補**: Vitest + vitest-axe + Testing Library + pre-push フロント分岐
4. **Phase B-3 先送り候補**: Playwright smoke + `size-limit`
```

Active Tasks PR #52 entry L23 内リンク修正:
- 現行: `~/.claude/plans/pr-comment-adaptive-pearl.md` (repo 外、Round 2 マージ後に…archive 予定)
- 修正後: `docs/archive/plans/2026-04-22-pr52-codex-round1.md` (本 PR commit 0 で archive)

### ステップ 3: phase-2-ui-00.md の修正（新規なので原文を編集してから add）

- 本文内 **「コミット 5-7 本目安」→「コミット 6-8 本目安（commit 0 repo 整理含む）」**
- §コミット分割 表冒頭に以下を挿入:
  ```
  | 0 | `chore(plans): PR #52 後の repo 整理 + UI-00 プラン正式化` | CLAUDE.md 1 行追加 / Plans.md 同期 / phase-2-ui-00.md 新規 / squishy-sniffing-waterfall.md + pr-comment-adaptive-pearl.md を archive（相対パス変換）。詳細手順は `docs/plans/phase-2-ui-00-commit-0.md` |
  ```
- §Post-processing L189 「Plans.md 同期 PR を別立て」→「本 PR commit 0 で Plans.md 同期 + archive 済。マージ後は本 plan file を `docs/archive/plans/2026-04-XX-phase-2-ui-00.md` に archive するだけ（相対パス `../` → `../../` 変換、同期専用 PR は作らない）」

### ステップ 4: archive 移動 2 件

```
git mv docs/plans/squishy-sniffing-waterfall.md docs/archive/plans/2026-04-22-phase-1-seed-env.md
```
→ 移動後ファイル内の相対パスリンクで repo ルート参照になっているものを `../` → `../../` に置換（例: `../SCREEN_DESIGN.md` → `../../SCREEN_DESIGN.md`、ただし同一 `docs/archive/plans/` 内参照は変換不要）。memory `feedback-archive-relative-path-conversion.md` 準拠。

```
cp ~/.claude/plans/pr-comment-adaptive-pearl.md docs/archive/plans/2026-04-22-pr52-codex-round1.md
rm ~/.claude/plans/pr-comment-adaptive-pearl.md
```
→ 移動後ファイル内の絶対パス（`/home/kosei/inventory-system/docs/...`、`/home/kosei/inventory-system/src-tauri/...`）を `../../` 起点の相対パスに変換。履歴不連続なので本 commit では add のみ。

### ステップ 5: 検証（commit 前）

```
./scripts/doc-consistency-check.sh              # R3 リンク全通過
git status                                       # 期待: M CLAUDE.md Plans.md / A phase-2-ui-00.md phase-2-ui-00-commit-0.md 2archive / D squishy-sniffing-waterfall.md
git log --follow --oneline docs/archive/plans/2026-04-22-phase-1-seed-env.md | head -3
                                                 # rename 履歴が保持されていること
```

### ステップ 6: commit 0 を作成

```
git add -A
git commit -m "chore(plans): PR #52 後の repo 整理 + UI-00 プラン正式化

- CLAUDE.md: プロジェクト外保存禁止ルール追加
- Plans.md: PR #52 マージ完了反映 + Next Session Entry Point を UI-00 PR 着手に単純化
- docs/plans/phase-2-ui-00.md: UI-00 実装プラン正式化（critic レビュー + ユーザー判断 3 件反映済）
- docs/plans/phase-2-ui-00-commit-0.md: 本 commit 0 の手順プラン
- archive: squishy-sniffing-waterfall.md → 2026-04-22-phase-1-seed-env.md
- archive: pr-comment-adaptive-pearl.md → 2026-04-22-pr52-codex-round1.md
- Plans.md 同期専用 PR は廃止、以降は本体 PR の commit 0 に統合する運用"
```

この時点では push しない（UI-00 本体実装を積み上げてから PR 作成時に一括 push、memory `feedback-ci-polling-use-gh-watch.md` 系）。

## commit 0 後の次ステップ

UI-00 本体は [phase-2-ui-00.md](2026-05-09-phase-2-ui-00.md) 準拠:
1. 事前: `npx shadcn@latest add tooltip`
2. commit 1: specta 化 4 コマンド + bindings.ts 再生成
3. commit 2: `docs/function-design/53-ui-home.md` 新規 + `ui-task-specs.md §UI-00` 更新 + `tooltip.tsx`
4. commit 3: `src/lib/query-keys.ts` 新設
5. commit 4: `src/features/home/` (hooks + lib + components 7 ファイル統合)
6. commit 5: `HomePage.tsx` + `routes/index.tsx` 差し替え
7. commit 6-7: Codex Round 1 対応（発生時のみ）

## 検証チェックリスト（commit 0 単独）

- [ ] `./scripts/doc-consistency-check.sh` 通過（特に R3: phase-2-ui-00.md 内のリンク、archive 2 件内の相対パス）
- [ ] `git diff --check` で末尾空白なし
- [ ] `cargo fmt --check` / `cargo clippy` / `cargo test` は commit 0 スコープでは変更ゼロだが、UI-00 本体着手前に一度走らせて ground truth 確認
- [ ] `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm run build` も同様に ground truth 確認

## Critical Files

### commit 0 で変更
- `CLAUDE.md` (既存差分のまま)
- `Plans.md` (既存差分 + Next Session Entry Point 書換 + PR #52 entry 内リンク修正)
- `docs/plans/phase-2-ui-00.md` (新規 + commit 分割表と Post-processing 修正)
- `docs/plans/phase-2-ui-00-commit-0.md` (本 file、新規)
- `docs/plans/squishy-sniffing-waterfall.md` → `docs/archive/plans/2026-04-22-phase-1-seed-env.md`
- `~/.claude/plans/pr-comment-adaptive-pearl.md` → `docs/archive/plans/2026-04-22-pr52-codex-round1.md`
- `~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md` (ExitPlanMode 直後に rm、archive しない)

### UI-00 本体で変更
- [phase-2-ui-00.md](2026-05-09-phase-2-ui-00.md) §Critical Files 参照

## 再発防止: 読み込みミス制御

今セッションで 2 件のミス発生。以降のルーチンとして固定:

1. **Critical memory 本体必読**: MEMORY.md の 🔴 Critical セクションに載っているファイルはセッション開始時 + 関連キーワード出現時に**本体を Read**する。description / index 要約だけで判断しない（今回 `feedback-plans-sync-commit-milestone-only.md` / `feedback-active-plan-in-docs.md` 共に Critical 掲載だったが未読で推測）
2. **既存 memory 検索を feedback 受信時の最初のアクション化**: ユーザーから feedback / 判断軸 / 運用ルール話が出たら「書いてない？」と言われる前に Grep で同一 keyword の memory を全文検索、類似 memory があれば拡張方針、なければ新規
3. **Plan mode 自動生成パスは常に越権**: `/home/kosei/.claude/plans/<slug>.md` 指定は system 側のデフォルトで、プロジェクト配置ルール（`feedback-active-plan-in-docs.md` L17 + CLAUDE.md「やってはいけないこと」）より弱い。最初から `docs/plans/<slug>.md` に書く or plan mode 抜けた直後にコピー

## ExitPlanMode 直後のタスク

1. `rm ~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md`
2. memory 新規作成: `feedback-critical-memory-must-read-body.md`（上記「再発防止: 読み込みミス制御」3 項目を type=feedback で保存、Why=今セッションでの連続ミス 2 件、How to apply=Critical memory 本体必読 / feedback 受信時 Grep / Plan mode 自動パス無視）
3. `touch /home/kosei/.claude/projects/-home-kosei-inventory-system/memory/.last_audit`
4. MEMORY.md 索引にも新規 feedback エントリ追加
5. 本プラン §実施手順 ステップ 1 から着手
