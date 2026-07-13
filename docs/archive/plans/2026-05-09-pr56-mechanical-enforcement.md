# PR #56 難航原因 × Claude 公式 docs ベース機械強制プラン

> **作成日**: 2026-05-09
> **対象 repo**: inventory-system
> **典拠**: Claude Code 公式 docs（hooks / memory / permissions / settings / skills / sub-agents）
> **関連 memory**: PR #56 起点の feedback 群（Critical セクション + 罠 A〜G）

---

## Context

### この plan を書く理由

PR #56（UI-00 ホーム画面、squash merge `e6da3d8`、2026-05-09）が複数 round 難航した。原因を memory feedback と git log で棚卸しすると、Claude が踏んだ罠は 7 個に分類される（A: Tooltip on disabled aria-disabled パターン未適用、B: Codex 指摘 keyword の全箇所 grep 漏れ、C: Self-Review 機械的見出し追加で本文空虚、D: `/plan-rally` の `xargs -r` 無入力 fallback、E: 関数設計書 §53.6 と実装の drift、F: aria-disabled パターンを 3 commit に分散、G: ExitPlanMode 前の Plan ラリー仕組み欠如）。

罠 C と G は既存 `.claude/hooks/check-plan-on-exit.sh` の L96-159 内容深さ検証 + L161-204 D-1 ラリー要件で**ほぼカバー済**。罠 D は Codex Round 2 で `xargs -r` 修正済。残る A・B・E・F が「機械強制ギャップ」として未解決。これらを Claude Code 公式 docs ベースの機構（hooks / permissions / scripts 拡張）で潰すのが本 plan のゴール。

### 公式調査の主要結論

> Claude Code 公式 docs（`hooks.md` / `memory.md` / `permissions.md` / `settings.md` / `skills.md` / `sub-agents.md` / `plugins.md`）を当たった結果、罠 A〜D は hook + permissions で 80% 構造的に対応可能。一方で **複数 AI 間知見共有（ai-core 構想、罠 7 個とは独立軸）は公式パターン無し**（CLAUDE.md import の外部 repo 共有 / symlink / submodule / MCP 経由 md 読込はいずれも仕様外）。罠 E（doc–impl drift）は L14 / L30 / L86 / L206 で定義した通り「関数設計書 §53.6 と実装の drift」を指す。

### scope

- **In scope**: PR #56 罠を機械強制で潰す施策 3 個（drift keyword grep / doc-impl drift / Self-Review placeholder 検出）
- **Out of scope**: ai-core 構想の実装（公式 docs 調査結果のサマリは Section 3 に保管、別セッションで詳細プラン化）、施策 4（plan-rally test）/ 施策 5（commit 分散リマインダ）の本実装（必要になったら追加）

### 採用しなかった選択肢

- **5 施策フル実装**: false positive チューニング負荷が大きく、観察期間も長くなる。施策 5 は施策 1 が機能し始めたら撤去候補（Plan agent Section 3 の指摘）なので初期から実装しない。
- **2 施策最小実装**: 罠 E（doc–impl drift）が PR #56 で実害あり、施策 2 を落とすと将来の関数設計書連動が手作業に戻る。

---

## Section 1: 機械強制施策（3 個、優先順位付き）

### 施策 1（優先度 1, 罠 A+B）: drift keyword の repo 全体 grep 強制

**問題の再現**: PR #56 で `aria-disabled` パターン適用漏れが 5 箇所、Codex Round 1 で 1 箇所サンプル指摘 → ピンポイント修正で済ませて Round 2 で同種残存検出 → さらに別経路で再発。memory `feedback-codex-drift-fix-grep-all-locations.md` / `feedback-status-sync-pr-keyword-grep-comprehensive.md` で feedback 化済だが**機械強制されていない**。

**公式機構**: `Stop` event hook（hooks.md §「Stop」、turn 完了直前のチェックポイント、`decision: "block"` で turn 継続強制可）。`PreToolUse:Bash(git commit *)` matcher で commit 直前に発火する案も検討したが、Stop event のほうが「修正要約 → 一括 grep 後の self-correction」フローに自然。

**実装場所**: 新規 `.claude/hooks/check-drift-keyword-grep.sh` + `.claude/settings.json` に Stop event 追加（現状 settings.json L29-81 に Stop event 未登録）。

**疑似コード**:

```bash
#!/bin/bash
HOOK_INPUT=$(cat)
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty')
[ -z "$TRANSCRIPT" ] && exit 0

RECENT=$(tail -300 "$TRANSCRIPT" 2>/dev/null)
KEYWORDS=$(echo "$RECENT" \
  | rg -oE '`[A-Za-z_][A-Za-z0-9_-]{4,}`' \
  | sort -u | head -10 | tr -d '`')

MISSED=()
while IFS= read -r kw; do
  [ -z "$kw" ] && continue
  REPO_HITS=$(rg -l "$kw" src-tauri/src src docs 2>/dev/null | wc -l)
  EDITED=$(echo "$HOOK_INPUT" | jq -r '.edited_files // [] | .[]' 2>/dev/null)
  EDITED_HITS=$(echo "$EDITED" | xargs -r rg -l "$kw" 2>/dev/null | wc -l)
  [ "$REPO_HITS" -ge 2 ] && [ "$EDITED_HITS" -lt "$REPO_HITS" ] \
    && MISSED+=("$kw: repo $REPO_HITS hits / edited $EDITED_HITS files")
done <<< "$KEYWORDS"

if [ ${#MISSED[@]} -ge 3 ]; then
  jq -n --arg msg "drift keyword 未走査の疑い:\n$(printf '%s\n' "${MISSED[@]}")" \
    '{hookSpecificOutput:{hookEventName:"Stop", additionalContext:$msg}}'
fi
exit 0
```

**検証**:
- `echo '{"transcript_path":"/tmp/fake.jsonl","edited_files":["src/X.tsx"]}' | bash .claude/hooks/check-drift-keyword-grep.sh` で fixture 駆動
- PR #56 turn 5 付近の transcript（aria-disabled 修正提案 → 1 ファイルのみ edit）を fixture 化して期待出力確認

**難度・工数**: M / 2-3 時間（false positive チューニング 1 時間込み）

**撤去条件**: Codex review で drift 残存指摘が連続 5 PR 0 件、または ast-grep ベース構造的 lint で置換した時。

**初期段階の安全弁**: `additionalContext` 注入のみ（warn-only）、`decision: "block"` は 1 ヶ月観察後判断。

---

### 施策 2（優先度 2, 罠 E）: doc–impl drift を ExitPlanMode 前に検出

**問題の再現**: PR #56 で関数設計書 §53.6（SummaryCards skeleton loading shape）と実装 `src/components/home/SummaryCards.tsx` が乖離。memory `feedback-diff-example-inline-code.md` 周辺で類似事例あり。設計書参照型の plan で頻発する drift。

**公式機構**: 既存 `scripts/doc-consistency-check.sh` の `--target plan` を拡張（新オプション `--target plan-impl-drift`）。`check-plan-on-exit.sh` L26 の `--target plan` 呼出後に追加 1 行で連動。`pre-push.sh` L80-92 の docs trigger でも実行。

**実装場所**:
- `scripts/doc-consistency-check.sh`: `check_plan_impl_drift()` 関数追加（plan 本文中の `path/file.tsx:LNNN` / `§N.N` 参照を抽出 → 実ファイル中の export / fn signature と突合）
- `.claude/hooks/check-plan-on-exit.sh`: L26 直後に `bash scripts/doc-consistency-check.sh --target plan-impl-drift` 追加呼出
- `scripts/pre-push.sh`: L81 trigger 内に同呼出追加

**疑似コード**:

```bash
check_plan_impl_drift() {
  PLAN_FILE=$1
  REFERRED_SIGS=$(rg -oE '(export (const|function|type)|fn |pub fn) [A-Za-z_][A-Za-z0-9_]+' "$PLAN_FILE")
  [ -z "$REFERRED_SIGS" ] && return 0

  REFERRED_FILES=$(rg -oE '(src|src-tauri/src)/[a-zA-Z0-9_/-]+\.(ts|tsx|rs)' "$PLAN_FILE" | sort -u)

  while IFS= read -r sig; do
    NAME=$(echo "$sig" | awk '{print $NF}')
    FOUND=0
    while IFS= read -r f; do
      [ -f "$f" ] && rg -q "$NAME" "$f" && FOUND=1 && break
    done <<< "$REFERRED_FILES"
    [ "$FOUND" -eq 0 ] && echo "DRIFT: plan で参照されている $NAME が referred files に存在しない"
  done <<< "$REFERRED_SIGS"
}
```

**検証**:
- PR #56 当時の plan ファイル（`docs/archive/plans/2026-05-09-phase-2-ui-00.md`）を fixture として `bash scripts/doc-consistency-check.sh --target plan-impl-drift docs/archive/plans/2026-05-09-phase-2-ui-00.md` で dry-run、§53.6 の signature と SummaryCards 実装の差分検出を確認
- 意図的に signature 不一致を仕込んで fail を確認

**難度・工数**: L / 4-5 時間（TypeScript / Rust 両対応の signature 抽出が時間消費）

**撤去条件**: 関数設計書を ast-grep / `tsc --noEmit` 連携で実装と双方向同期可能にした時。

**注意**: 自由記述部の signature 言及は false positive 発生源、`§N.N` ピン参照ブロック内のみを対象とする scope 制約を初期から入れる。

---

### 施策 3（優先度 3, 罠 C 強化）: Self-Review placeholder 検出 + 語彙多様性検証

**問題の再現**: 既存 `check-plan-on-exit.sh` L96-159 で「100 字以上 + blockquote/行番号/memory 参照」が必須化済（commit `e0c5365` で導入、Self-Review 機械的追加 anti-pattern 対応）。だが「特に問題ない」「通常通り」「OK」のような placeholder 文を散りばめれば 100 字突破 + 形式条件 OK で通過し得る。memory `feedback-self-review-mechanical-addition-anti-pattern.md` の趣旨（具体性逆検査）に照らすと検証不足。

**公式機構**: 既存 `check-plan-on-exit.sh` の **拡張**（新規 hook 不要）。L132-134（具体引用 / 行番号 / memory 参照のいずれもなし判定）の直後に placeholder + 語彙多様性 check を追加。

**実装場所**: `.claude/hooks/check-plan-on-exit.sh` L132-134 周辺に 12 行程度追加。

**疑似コード**:

```bash
PLACEHOLDER_HITS=$(echo "$OBSERVATION" | grep -oE '一般的(な|に)|通常通り|特に問題|問題な[くし]|N/?A|TBD' 2>/dev/null | wc -l || true); PLACEHOLDER_HITS=${PLACEHOLDER_HITS:-0}
DISTINCT_TOKENS=$(echo "$OBSERVATION" | tr -s '[:space:][:punct:]' '\n' | grep -v '^$' 2>/dev/null | sort -u | wc -l || true); DISTINCT_TOKENS=${DISTINCT_TOKENS:-0}

if [ "$PLACEHOLDER_HITS" -ge 2 ]; then
  FAILED_OBSERVATIONS+=("観点 $i: placeholder 文 ($PLACEHOLDER_HITS 箇所) — 「一般的」「通常通り」「特に問題ない」等を具体記述に置換")
  continue
fi
if [ "$DISTINCT_TOKENS" -lt 25 ]; then
  FAILED_OBSERVATIONS+=("観点 $i: 語彙多様性不足 ($DISTINCT_TOKENS unique tokens) — boilerplate 疑い")
fi
```

**検証**:
- PR #56 turn 1 の Self-Review（user reject されたもの）を fixture plan に再現、`echo '{"cwd":"/path"}' | bash .claude/hooks/check-plan-on-exit.sh` で deny 出力確認
- 既存通過した plan（archive 配下）で false positive が出ないか確認 → 出るなら DISTINCT_TOKENS 閾値（初期 25）を調整

**難度・工数**: S / 1 時間（既存パターン踏襲）

**撤去条件**: `feedback-self-review-mechanical-addition-anti-pattern.md` 起因の reject が 10 セッション連続 0 件になった時。

**注意**: 語彙多様性閾値の初期値 25 は heuristic、archive 配下の通過 plan 5 件で実測してから本番投入（`empirical-validation-for-prompts.md` 趣旨）。

---

## Section 2: 実装フェーズ分け

| Phase | 施策 | 工数 | trigger 条件 |
|---|---|---|---|
| 1 | 施策 3（Self-Review placeholder 検出） | S / 1h | 即実施。既存 hook 拡張のみ、副作用最小 |
| 2 | 施策 1（drift keyword grep） | M / 2-3h | Phase 1 完了 + 1 週間運用観察後。warn-only から開始 |
| 3 | 施策 2（doc–impl drift） | L / 4-5h | Phase 2 で false positive 落ち着いてから。signature 抽出 scope を狭めて開始 |

**理由**: 施策 3 は既存 hook の単純拡張で副作用が予測可能、即効性も高い。施策 1 は新規 Stop event 登録 + false positive チューニングを含み観察期間が必要。施策 2 は最も実装重く、scope 設計を慎重にやらないと自由記述部で false positive 頻発する。

---

## Section 3: ai-core 構想（Out of scope、調査結果サマリ）

> 本 plan では実装しない。ユーザー判断「今すぐやる感じではない、調査結果は見たい」に従い**調査メモのみ残す**。別セッションで ChatGPT/Codex 連携を含めた詳細プランに落とす。

### 公式の限界（重要）

Claude Code には「外部 repo を共有 memory として読み込む」公式パターンは **無い**:
- CLAUDE.md import (`@path/to/file`) は最大 5 hop 再帰可だが、**外部 git repo 直接 import の仕様は無い**（`memory.md`）
- symlink / submodule / MCP server 経由の md 読込は**いずれも仕様外**
- 結論として「user-level CLAUDE.md (`~/.claude/CLAUDE.md`) からローカルクローン先 repo の md を import」が現実解、ただし「Claude が能動的に検索する」モデルにとどまる

### 現実解の方向性（メモ）

1. `~/ai-core/` に GitHub private repo を clone（`~/.claude/` 配下は sandbox ro 化リスクで避ける）
2. 構造: `~/ai-core/.ai/{index.md, AI_GUIDE.md, context-map.yml, inbox/, memory/, coding/}`
3. `~/.claude/CLAUDE.md` から `@~/ai-core/.ai/coding/codex_policy.md` 等を**静的選択 import**（glob は公式未サポート）
4. **project CLAUDE.md からは ai-core を import しない**（共有 repo 構造を project repo の git history に漏らさない）
5. Codex 同期: ai-core を Codex の対象 repo に追加 / worktree 化
6. ChatGPT 同期: 公式 preamble 機構なし → **ai-core の git pre-commit hook で `inbox/` commit 時に concat 出力** → user が手動で Project Custom Instructions に反映、または GitHub Action で release artifact 化

### PR #56 罠から ai-core に蓄積すべき候補（汎用知見のみ）

- **罠 A (Tooltip on disabled aria-disabled パターン)**: Radix UI 起因の汎用バグ → `coding/ui/radix-tooltip-aria-disabled.md`（memory `feedback-radix-tooltip-aria-disabled.md` の蒸留版）
- **罠 B (Codex drift 全箇所 grep)**: AI 共通の review 戦略 anti-pattern → `coding/review/drift-fix-grep-all-locations.md`
- **罠 D (`xargs -r` 無入力 fallback)**: bash 一般落とし穴 → `coding/bash/xargs-r-no-input-fallback.md`

### 蓄積しないもの（inventory-system 内 memory に残す）

- 罠 C (Self-Review hook 仕様) / 罠 E (関数設計書 §53.6 連動) / 罠 F (commit 分割) は project workflow 固有で外出し意義薄い

### 切り分け判断軸

- **ai-core 行き**: (a) 他 project / 他 AI でも踏みうる、(b) 外部ライブラリ / 言語仕様起因、(c) 一般原則
- **inventory-system 行き**: (a) 関数設計書 §連動、(b) 特定 hook / scripts 仕様、(c) 業務ルール、(d) project workflow

### 公式 docs URL（後続セッションで再参照）

- https://code.claude.com/docs/en/hooks.md
- https://code.claude.com/docs/en/memory.md
- https://code.claude.com/docs/en/permissions.md
- https://code.claude.com/docs/en/settings.md
- https://code.claude.com/docs/en/skills.md
- https://code.claude.com/docs/en/sub-agents.md
- https://code.claude.com/docs/en/plugins.md

---

## Critical files

| ファイル | 編集内容 | 施策 |
|---|---|---|
| `.claude/hooks/check-plan-on-exit.sh` | L132-134 直後に placeholder 検出 + 語彙多様性 check 追加（12 行） | 施策 3 |
| `.claude/hooks/check-drift-keyword-grep.sh` | **新規作成**（30 行程度） | 施策 1 |
| `.claude/settings.json` | L29-81 hooks セクションに `Stop` event 追加（5 行）、L44-52 PreToolUse:ExitPlanMode は変更なし | 施策 1 |
| `scripts/doc-consistency-check.sh` | `--target plan-impl-drift` オプション + `check_plan_impl_drift()` 関数追加（30 行程度） | 施策 2 |
| `scripts/pre-push.sh` | L81 trigger 内に `--target plan-impl-drift` 連動呼出（3 行） | 施策 2 |

---

## 検証方法

### 各施策の単体テスト

- 施策 3: `echo '{"cwd":"'"$(pwd)"'"}' | bash .claude/hooks/check-plan-on-exit.sh` を fixture plan で実行 → placeholder 含む plan で deny、含まない plan で allow を確認
- 施策 1: `echo '{"transcript_path":"/tmp/fake.jsonl","edited_files":["src/X.tsx"]}' | bash .claude/hooks/check-drift-keyword-grep.sh` を fixture transcript で実行 → 未走査 keyword 3 個以上で warn 出力を確認
- 施策 2: PR #56 archive plan を fixture として `bash scripts/doc-consistency-check.sh --target plan-impl-drift docs/archive/plans/2026-05-09-phase-2-ui-00.md` → 既存通過、意図的 drift 混入で fail を確認

### 統合テスト

- 施策 3 完了後: 任意の本物 plan で ExitPlanMode → 通過することを確認（false positive がないか）
- 施策 1 完了後: 1 週間運用観察、warn 出力頻度を `.local/quality-check.log` 相当に記録
- 施策 2 完了後: pre-push.sh が docs 変更時に `--target plan-impl-drift` を実行することを `git push` dry-run で確認

### archive plan で false positive 計測（施策 3 必須前段）

`docs/archive/plans/` 配下から最新 5 plan を取り出し、各々で施策 3 hook 単体実行 → false positive 件数 + DISTINCT_TOKENS 閾値の妥当性を検証。**この計測なしに本番投入しない**。

---

## Self-Review

memory `plan-self-review-before-implementation.md` 7 観点、`feedback-self-review-mechanical-addition-anti-pattern.md` 趣旨に従い具体記述する。

### 1. 技術的前提（LSP / Skills Policy / rebase / commit prefix）

> hook 編集は `.sh` ファイル、本 plan の編集対象 `.claude/hooks/check-plan-on-exit.sh` / `.claude/hooks/check-drift-keyword-grep.sh` / `scripts/doc-consistency-check.sh` / `scripts/pre-push.sh` はいずれも bash script

memory `feedback-lsp-skills-policy-hook.md` で「docs (.md) 編集は適用外」と明記、bash script 編集も同様に LSP diagnostics 不要（hook policy 中の Read → Write フローのみ遵守）。`.claude/settings.json` L29-81 の編集は JSON、`jq` で構文検証可。commit prefix は `feat:` / `chore:` で分け、施策 3 は `feat(hook):`、施策 1 は `feat(hook):` + `chore(settings):`、施策 2 は `feat(scripts):`。rebase は不要（main 直 branch ではなく `feature/hook-mechanical-enforcement` で派生 PR）、必要時のみ `git pull --rebase origin main`。

### 2. スクリプト詳細（set -e 副作用 / パス指定 / 既存 scripts 整合）

> 既存 `check-plan-on-exit.sh` L123-125 で `|| true` + `${X:-0}` パターンが Codex PR #56 P2-2 反映済（コメント L120-122）

施策 3 の追加 12 行は既存 L123-125 の安全パターンを踏襲、`grep -oE ... | wc -l || true` + `${PLACEHOLDER_HITS:-0}` で pipefail 防御 (Codex Round 1 P1 反映で `-cE` → `-oE | wc -l` に変更、同一行内 placeholder 複数も検出可能化)。`DISTINCT_TOKENS` 側も同パターンで揃えた。施策 1 の新規 hook は `set -e` を使わず exit code 制御で十分、jq 出力前に必ず stdout 入力前提を確認（hook event の input JSON フォーマット規約）。施策 2 の `doc-consistency-check.sh` は既存 `--target plan` の構造（exit code + stdout report）を踏襲、新オプションも同パターン。パス指定は全て repo root 相対（`bash scripts/...` 呼出は `cd "$CWD"` 後を前提、`check-plan-on-exit.sh` L10 と同じ）。

### 3. ドキュメント修正（line 重複 / link 影響範囲）

> 本 plan は機械強制施策の実装計画、docs/ 配下の設計書修正は最小限

`docs/DEV_SETUP_CHECKLIST.md` §3.2 pre-push hook 記述に施策 2 連動（doc-impl drift トリガー）の追記が必要。link 影響範囲は `inventory-system/CLAUDE.md`（プロジェクト CLAUDE.md）に hooks 動作規約があれば 1 行追加、なければ skip。`docs/DOC_STYLE_GUIDE.md` §6 自動チェック表に施策 2 の `--target plan-impl-drift` を追記して 19 → 20 項目化（既存 R0/R1/R3 と同列）。memory `feedback-codex-drift-fix-grep-all-locations.md` の趣旨に従い、これらドキュメント修正は施策 2 実装と**同 PR で全箇所一括**反映する。

### 4. 検証計画（ローカル / CI / pre-push hook）

> 各施策の単体テスト + archive plan で false positive 計測 + 1 週間運用観察、上述「検証方法」セクションに集約済

ローカル検証は fixture 駆動で各 hook を bash 単体起動（`echo '{...}' | bash ...`）。CI は pre-push.sh L80-92 既存 docs trigger に施策 2 連動を追加、pre-push.sh 実行ログ（`.local/quality-check.log`）で運用観察。施策 1 は 1 週間 warn-only 運用 → false positive 頻度を log から集計 → deny 化判断。施策 3 は archive plan 5 件で false positive 0 を確認してから本番投入（`empirical-validation-for-prompts.md` 趣旨、L130 周辺で fixture 計測の手順を確立）。

### 5. 後処理（memory 監査 / sentinel / archive）

> 本 plan 完了時、`docs/archive/plans/` への移動 + memory `feedback-archive-relative-path-conversion.md` に従う絶対パス → 相対パス変換必須

実装完了後の plan archive は `docs/archive/plans/2026-05-09-pr56-mechanical-enforcement.md` へリネーム + 内部の絶対パス（`/home/kosei/inventory-system/...`）を相対パス（`.claude/hooks/...`）に置換（memory `feedback-archive-relative-path-conversion.md`、PR #49 で被弾の再発防止）。memory 反映: 各施策の運用結果（false positive 率 / 撤去判断）は project memory として `feedback-mechanical-enforcement-3-rules-runtime.md`（仮）に追記。sentinel: `Plans.md` Backlog に「機械強制 3 施策の運用観察」を追加。`~/.claude/plans/memory-pr56-buzzing-bachman.md` の最初の誤配置 plan は本 plan 確定後に削除（memory `feedback-active-plan-in-docs.md` の `~/.claude/plans/` 不使用ルール再適用）。

### 6. 実行制約（Claude が勝手に merge / force push しない）

> 各施策は別 PR で提出、user merge 待ち。force push 禁止、`--no-verify` 禁止（CLAUDE.md グローバル規約）

PR 構成は施策 1 / 施策 2 / 施策 3 を**別 PR** にする（commit prefix `feat(hook):` / `feat(scripts):`）。理由は (a) false positive 観察期間が施策毎に異なる、(b) Codex review 単位を絞る。merge 順は Phase 順（施策 3 → 1 → 2）。force push は base branch 更新時のみ rebase で対応、`git push -f` は user 明示指示なしで実行しない。pre-push hook bypass (`--no-verify`) は禁止（`~/.claude/CLAUDE.md` Rules セクション「Never skip hooks」、`scripts/pre-push.sh` L5 のコメントも同旨）、施策 1 hook で false positive 頻発時も bypass せず閾値調整で対応。

### 7. コミット分割（各 commit のスコープ / hook 対応順序）

> 施策 3 → 1 → 2 の Phase 順、施策 1 内部は hook ファイル新規 → settings.json 登録の 2 commit 分割

memory `feedback-codex-drift-fix-grep-all-locations.md` / `feedback-status-sync-pr-keyword-grep-comprehensive.md` の趣旨に従い、**各施策内の関連修正は同 PR で全箇所一括**（drift 残存防止）。施策 2 は `doc-consistency-check.sh` 拡張 + `pre-push.sh` 連動 + `docs/DEV_SETUP_CHECKLIST.md` / `docs/DOC_STYLE_GUIDE.md` のドキュメント追記を 1 PR / 複数 commit で構成（commit 1: `doc-consistency-check.sh` 拡張、commit 2: `pre-push.sh` 連動、commit 3: docs 追記）。施策 1 は新規 hook 追加 (commit 1) → settings.json 登録 (commit 2) で hook ロジック先行、登録は最小行差分。施策 3 は単一 commit。

---

## Out of scope

- **ai-core 実装** — 別セッションで詳細プラン化、本 plan には Section 3 に調査メモのみ
- **施策 4（plan-rally test）** — `pre-push.sh` 連動 fixture テスト、必要になったら追加
- **施策 5（commit 分散リマインダ）** — 施策 1 が機能し始めたら撤去候補、初期実装しない
- **ast-grep 構造的 lint への移行** — 施策 1 の長期撤去先として認識、本 plan では実装しない

---

## 実装後の確認項目（追跡用）

- [ ] 施策 3: archive plan 5 件で false positive 0、DISTINCT_TOKENS 閾値の実測値を `feedback-mechanical-enforcement-3-rules-runtime.md` に記録
- [ ] 施策 1: 1 週間 warn-only 運用、`.local/quality-check.log` に warn 頻度集計、false positive ≤ 20% で deny 化判断
- [ ] 施策 2: 既存 archive plan 全件で fail 0 を確認、signature 抽出 scope の実運用妥当性を検証
- [ ] 全施策: 撤去条件のいずれかを満たした時点で feedback memory に記録 + hook / scripts から削除
