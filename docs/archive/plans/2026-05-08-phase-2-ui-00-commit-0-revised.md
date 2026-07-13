# Phase 2 8-1 UI-00 着手前 雑務片付けプラン（commit-0 改訂版）

## 本プラン file の位置付け

- **正ソース**: 本 file (`docs/plans/2026-05-08-phase-2-ui-00-commit-0-revised.md`)
- Plan mode 自動指定パス `/home/kosei/.claude/plans/phase-2-8-1-ui-00-ui-concurrent-quilt.md` は **無効**（memory `feedback-active-plan-in-docs.md` / CLAUDE.md「やってはいけないこと」違反）。Step 3 で削除する
- 旧 commit-0 プラン `docs/plans/phase-2-ui-00-commit-0.md` は PR #53 PR-A に内容が吸収済みのため obsolete、Step 1 で archive する
- 本 file は UI-00 PR commit 0 マージ時に `docs/archive/plans/` 配下へ archive（相対パス変換、memory `feedback-archive-relative-path-conversion.md`）

---

## Context

PR #52 マージ後（2026-04-22）に Phase 2 着手前 書類整備 3 PR（PR-A #53 / PR-B #54 / post-PR-B sync #55）が全てマージ完了（2026-05-08）。バックエンド全層（v0.6.0）+ Phase 1 UI 基盤（Task 7-1 / 7-2 / 7-2.5 / 7-3 / 7-4 / 7-5a / 7-5b / 7-5c / 7-9 / 7-10 + UI-12 共通レイアウト）が揃い、Phase 2 着手条件を満たした。

実装プラン `docs/plans/phase-2-ui-00.md` は Q-1〜Q-3 ユーザー判断確定 + D-1〜D-10 設計判断 fix 済で合意成立済。次は実装着手。ただし PR-A/B/post-PR-B sync が absorb した内容と現状の docs/plans 構成にズレがあり、UI-00 PR の commit 0 として整理する必要がある。

旧 `phase-2-ui-00-commit-0.md` は PR-A 起票前に書かれたプランで、PR-A が以下を全部吸収して obsolete 化した:
- Plans.md Active Tasks 同期 + Next Session Entry Point 書き換え
- `squishy-sniffing-waterfall.md` → `2026-04-22-phase-1-seed-env.md` への archive 移動
- `pr-comment-adaptive-pearl.md` → `2026-04-22-pr52-codex-round1.md` への archive 移動
- CLAUDE.md「プロジェクト外保存禁止」追加
- `phase-2-ui-00.md` 正式化

旧 plan の Step 0「`~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md` を rm」だけが未実施で残っている。

本プランは UI-00 PR の **新しい commit 0** として、obsolete 化した旧 commit-0 の archive + Tooltip 追加 + `~/.claude/plans/` 掃除を 1 commit で片付ける。

## ユーザー判断確定済（2026-05-08）

| # | 項目 | 採用 | 不採用と理由 |
|---|------|------|-----|
| Q-A | USDM（仕様化する技術）再読の前倒し | **やらない** | phase-2-ui-00.md §関数設計書の章立て 10 章で USDM 3 視点を既にカバー。NotebookLM コストに対して 53-ui-home.md に落ちる差分は限定的。**書いてから本に当てる**逆方向検証が実証的に強い。Phase 9 UI-01a リファクタまで時間があるので、ドラフト後に memory 更新で間に合う。commit 2 着手時に再判定の余地は残す |
| Q-B | 雑務の PR 構成 | **UI-00 PR の commit 0 に吸収** | 雑務だけ別 PR は overhead。memory `feedback-plans-sync-commit-milestone-only.md` L22-26 既定運用（Plans.md 同期は次の機能 PR の commit 0 で吸収）の継承 |
| Q-C | Windows native ビルド移行 | **本セッションでは行わない** | commit 0 雑務 + commit 1 specta 化（次セッション）は IME 不要。日本語入力検証が要るのは commit 4-5（React 本体実装の動作確認）以降。それまでに移行する。Plans.md Backlog 「Phase 2 以降 Windows native 開発移行」項目で追跡継続 |
| Q-D | `~/.claude/plans/` 掃除のスコープ | **UI-00 関連 auto-generated 3 件のみ削除** | 他プロジェクト残骸は本プランのスコープ外。別セッションで判断 |

---

## やること（4 件）

### 1. 旧 commit-0 プランの archive 化

`docs/plans/phase-2-ui-00-commit-0.md` は PR #53 PR-A が repo 整理 + Plans.md 同期 + archive 2 件を全部吸収済みで obsolete。`docs/archive/plans/2026-05-08-phase-2-ui-00-commit-0-superseded.md` へ移動。

- `git mv` でファイル履歴を保持
- 移動後 file 内の `../` 参照を `../../` に変換（memory `feedback-archive-relative-path-conversion.md` 準拠、PR #49 で同種事故あり）
- file 冒頭に「PR #53 PR-A 吸収済み、obsolete」追記（archive 理由を明示）

### 2. Tooltip コンポーネント追加（19 個目）

`npx shadcn@latest add tooltip` で導入。UI-00 の pending route ボタン（商品管理 / 入出庫 4 / 棚卸し / バックアップ / 設定）の disabled 表示に必須。

副作用:
- `src/components/ui/tooltip.tsx` 新規生成
- `components.json` 更新（registry 追加）
- `package.json` に `@radix-ui/react-tooltip` 追加

### 3. `~/.claude/plans/` 掃除（UI-00 関連のみ）

repo 外の Plan mode auto-generated plan を 3 件削除:
- `~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md`（旧 commit-0 残骸）
- `~/.claude/plans/phase-2-ui-00-plans-phase2-jaunty-bengio.md`（phase-2-ui-00.md 起動時生成）
- `~/.claude/plans/phase-2-8-1-ui-00-ui-concurrent-quilt.md`（本セッション生成）

他プロジェクトの過去 plan（`bubbly-strolling-canyon.md` 等多数）は本プランのスコープ外。別セッションで判断。

### 4. 本 plan file（自身）の運用記録

UI-00 PR の commit 0 で本 file を新規追加（git add）。マージ後に archive。

---

## やらないこと（今セッション）

- **USDM（仕様化する技術）再読** — Q-A 不採用、commit 2（53-ui-home.md ドラフト）着手時に再判定の余地は残す
- **Windows native ビルド移行** — Q-C 不採用、Plans.md Backlog で追跡継続。commit 4-5（React 本体実装の動作確認）着手前までに移行
- **`~/.claude/plans/` 全件掃除** — Q-D 不採用、UI-00 関連 3 件のみ
- **specta 化 / 53-ui-home.md / features/home 実装** — UI-00 PR の commit 1 以降、本プランのスコープ外
- **`feat/ui-00-home` ブランチ作成** — Step 1 で実施。本 commit 0 を含めて UI-00 PR の最初の commit となる

---

## 実施手順

### Step 0: ExitPlanMode 直後

```bash
rm ~/.claude/plans/phase-2-8-1-ui-00-ui-concurrent-quilt.md
```

本 plan file の auto-generated 版を削除。本 plan の正ソースは `docs/plans/2026-05-08-phase-2-ui-00-commit-0-revised.md`。

### Step 1: UI-00 ブランチ作成

```bash
git checkout -b feat/ui-00-home
```

### Step 2: 旧 commit-0 plan を archive

```bash
git mv docs/plans/phase-2-ui-00-commit-0.md docs/archive/plans/2026-05-08-phase-2-ui-00-commit-0-superseded.md
```

移動後 file の編集:
- 冒頭セクション「本プラン file の位置付け」に「**[2026-05-08 archive]** PR #53 PR-A が repo 整理 + Plans.md 同期 + archive 2 件を全部吸収済みで obsolete。本プランの未実施項目は `~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md` の rm のみで、それは [2026-05-08-phase-2-ui-00-commit-0-revised.md](2026-05-08-phase-2-ui-00-commit-0-revised.md) Step 4 に統合した。」を追記
- 内部 markdown link の相対パス変換: 旧 commit-0 plan 内に存在する `phase-2-ui-00.md` への参照は、archive 配下から見ると相対パス起点が `../../plans/` になるため `../../plans/phase-2-ui-00.md` に書き換える（archive 配下 `docs/archive/plans/` から `docs/plans/` 参照は 2 段上がってから `plans/` に降りる）。memory `feedback-diff-example-inline-code.md` 準拠で本プラン内では link 形式の差分例示そのものを書かない（doc-consistency R3 が inline code 内の link パターンも検出するため）
- repo ルート参照（CLAUDE.md / Plans.md 等）が `../` で書かれていれば `../../` に変換

### Step 3: ~/.claude/plans/ 掃除（UI-00 関連 3 件）

```bash
rm ~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md
rm ~/.claude/plans/phase-2-ui-00-plans-phase2-jaunty-bengio.md
# concurrent-quilt は Step 0 で削除済み
```

### Step 4: Tooltip コンポーネント追加

```bash
npx shadcn@latest add tooltip
```

確認:
- `src/components/ui/tooltip.tsx` 生成
- `components.json` 更新
- `package.json` + `package-lock.json` 差分

### Step 5: 検証（commit 前）

```bash
./scripts/doc-consistency-check.sh                    # R3 リンク全通過（archive 内 ../ → ../../ 変換忘れ検出）
git status                                            # 期待差分: A 本 plan / D phase-2-ui-00-commit-0.md / A archive 配下 / A tooltip.tsx / M components.json / M package.json / M package-lock.json
git log --follow --oneline docs/archive/plans/2026-05-08-phase-2-ui-00-commit-0-superseded.md | head -3   # rename 履歴保持
npm run typecheck                                     # tooltip 追加で型壊れない確認
npm run lint                                          # 同上
```

### Step 6: commit 0 を作成

```bash
git add -A
git commit -m "chore(plans): UI-00 着手前の雑務片付け + tooltip 追加

- 旧 phase-2-ui-00-commit-0.md は PR-A (#53) 吸収済みで obsolete、archive 移動
- 2026-05-08-phase-2-ui-00-commit-0-revised.md として改訂版プラン正式化
- shadcn/ui tooltip 追加（19 個目、UI-00 pending route ボタン用）
- ~/.claude/plans/ 掃除（UI-00 関連 auto-generated 3 件削除、repo 外）"
```

push しない（UI-00 本体実装の commit 1 以降を積み上げてから PR 作成時に一括 push、memory `feedback-ci-polling-use-gh-watch.md` 系運用継承）。

---

## 検証チェックリスト（commit 0 単独）

- [ ] `./scripts/doc-consistency-check.sh` 通過（R3 リンク特に注意）
- [ ] `git diff --check` で末尾空白なし
- [ ] `npm run typecheck` 通過（tooltip 追加で型壊れない）
- [ ] `npm run lint` 通過
- [ ] `git status` で想定外の差分なし（特に `~/.claude/plans/` の他プロジェクトファイルに触れていないこと）
- [ ] `git log --follow` で rename 履歴保持

---

## commit 0 後の次セッション着手手順

UI-00 本体は [2026-05-09-phase-2-ui-00.md](2026-05-09-phase-2-ui-00.md) §コミット分割 commit 1 以降:

1. **commit 1**: specta 化 4 コマンド（`get_daily_sales` / `list_low_stock` / `list_plu_dirty` / `list_csv_imports`）+ bindings.ts 再生成
2. **commit 2**: `docs/function-design/53-ui-home.md` 新規（業務ロジックあり版テンプレ初適用）+ `ui-task-specs.md §UI-00` 大ボタン記述更新
3. **commit 3**: `src/lib/query-keys.ts` 新設（D-4 オブジェクト形式）
4. **commit 4**: `src/features/home/` 一括（hooks / lib / components 7 ファイル統合、P2-A 対応）
5. **commit 5**: `HomePage.tsx` + `routes/index.tsx` 差し替え（search_products デモ撤去）
6. **commit 6-7**: Codex Round 1 対応（発生時のみ）

Windows native ビルド移行は commit 4 着手前までに完了。commit 1〜3 は WSL2 で進められる（バックエンド specta 化 + ドキュメント + frontend lib のみ、IME 不要）。

USDM 再読の判定は commit 2 着手時に再判定（53-ui-home.md ドラフト初稿後に「6 共通項目で足りるか / USDM 視点で漏れがないか」を逆方向検証、Q-A の方針）。

---

## Critical Files

### 新規追加（commit 0）
- `docs/plans/2026-05-08-phase-2-ui-00-commit-0-revised.md`（本 file）
- `docs/archive/plans/2026-05-08-phase-2-ui-00-commit-0-superseded.md`（旧 commit-0 archive）
- `src/components/ui/tooltip.tsx`（shadcn 自動生成）

### 削除（commit 0）
- `docs/plans/phase-2-ui-00-commit-0.md`（archive 移動による削除、git mv で履歴保持）

### 変更（commit 0）
- `components.json`（shadcn registry）
- `package.json` / `package-lock.json`（@radix-ui/react-tooltip 追加）

### repo 外（git 管理外、Step 0 / Step 3）
- `~/.claude/plans/plans-plans-pr-ui-00-floating-narwhal.md` → 削除
- `~/.claude/plans/phase-2-ui-00-plans-phase2-jaunty-bengio.md` → 削除
- `~/.claude/plans/phase-2-8-1-ui-00-ui-concurrent-quilt.md` → 削除（Step 0）

### UI-00 本体で変更（次セッション、本 PR commit 1 以降）

参照: [2026-05-09-phase-2-ui-00.md §Critical Files](2026-05-09-phase-2-ui-00.md#critical-files)

---

## Post-processing（UI-00 PR マージ後）

1. 本 plan file (`docs/plans/2026-05-08-phase-2-ui-00-commit-0-revised.md`) を `docs/archive/plans/` へ移動（深さ変化なし、相対パス変換不要）
2. `phase-2-ui-00.md` も同様に archive 移動（相対パス `../` → `../../` 変換、memory `feedback-archive-relative-path-conversion.md` 準拠）
3. Plans.md §Progress Tracker §第8段階 8-1 を `[x]` 済 + Active Tasks の PR entry 完了記録（UI-00 PR の境界 milestone commit に同梱、`feedback-plans-sync-commit-milestone-only.md` 規定）
4. UI-00 マージ後の次タスク: 8-6 ショートカット一覧ダイアログ単独 PR（Q-3 採用、phase-2-ui-00.md §ユーザー判断結果）

---

## Self-Review

Self-Review: 適用除外 (本 plan は `.claude/hooks/check-plan-on-exit.sh` の Self-Review 強制機構整備以前 = 2026-05-08 作成の旧フォーマット plan。Step 0 以降の新規 plan からは memory `plan-self-review-before-implementation.md` の 7 観点 Self-Review 必須)
