# Phase 2-C: hooks 汎用化 draft (3 本)

> **親 plan**: [2026-05-17-knowledge-transfer-to-gkmas-ocr.md](2026-05-17-knowledge-transfer-to-gkmas-ocr.md) §2.3
> **mapping file**: [2026-05-17-phase1-layer-a-mapping.md](2026-05-17-phase1-layer-a-mapping.md) §6 hooks 振り分け
> **作成日**: 2026-05-17
> **ステータス**: user 手作業配置待ち (Claude Code auto-mode HARD BLOCK のため Claude では `~/.claude/hooks/` に Write 不可)

---

## 1. 配置手順 (user 向け)

```bash
# 1. ~/.claude/hooks/ ディレクトリ作成 (未存在の場合)
mkdir -p ~/.claude/hooks

# 2. 本ファイルの §3 §4 §5 から script を抜き出して保存
#    (例: VSCode で本ファイルを開き、code block 全選択→新規ファイルにコピペ)
# ~/.claude/hooks/check-plan-on-exit.sh
# ~/.claude/hooks/memory-capture-feedback.sh
# ~/.claude/hooks/suggest-subagent-for-plan.sh

# 3. 実行権限付与
chmod +x ~/.claude/hooks/*.sh

# 4. 各 project の .claude/settings.json で hook 登録を「global 参照」に切替 (オプション)
#    現状: "command": "bash .claude/hooks/check-plan-on-exit.sh"
#    変更: "command": "bash ~/.claude/hooks/check-plan-on-exit.sh"
#    project local hook も残すなら、global を先に走らせて project 固有を後で追加するパターンも可
```

global 配置のメリット: 全 project (gkmas-ocr-pipeline 含む) に同じ hook が効く。
project local 配置のメリット: project 固有の hook ロジックを残せる、global と project の組み合わせも可能。

---

## 2. 汎用化の方針 (3 本共通)

inventory-system 固有を排除する 3 つの変更点:

1. **sanitized cwd 動的計算**: `printf '%s' "$CWD" | tr / -` で sanitize 文字列を生成 (例: `-home-kosei-Projects-inventory-system`)
2. **`/tmp/claude-1000/` の UID 部分**: `id -u` で動的取得 (`/tmp/claude-${USER_UID}${SANITIZED_CWD}`)
3. **memory dir 直書き path**: `${CLAUDE_MEMORY_DIR:-$HOME/.claude/projects${SANITIZED_CWD}/memory}` で env 経由 override 可能化

各 hook の固有 path 改修箇所は §3 §4 §5 で個別解説。

---

## 3. check-plan-on-exit.sh 汎用化 draft

**元 file**: `.claude/hooks/check-plan-on-exit.sh` (225 行)
**主な変更**: L181 `AGENT_LOG_DIR="/tmp/claude-1000/-home-kosei-Projects-inventory-system"` 直書き → `id -u` + sanitized cwd で動的計算

```bash
#!/bin/bash
# ExitPlanMode 時にプランファイルの整合性 + Self-Review を検証
# どちらかに違反があれば ExitPlanMode をブロック（permissionDecision: deny）
# 整合: scripts/doc-consistency-check.sh --target plan
# Self-Review: 直近更新 plan に「## Self-Review」or「## セルフレビュー」or「Self-Review: 適用除外」が必要
# 参考: memory plan-self-review-before-implementation.md（7 観点）

HOOK_INPUT=$(cat)
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd')
cd "$CWD" || exit 2

# === 汎用化: sanitized cwd 動的計算 + UID 動的取得 ===
SANITIZED_CWD=$(printf '%s' "$CWD" | tr / -)
USER_UID=$(id -u)

# スクリプトが存在しなければスキップ（別プロジェクトの可能性）
if [ ! -f "scripts/doc-consistency-check.sh" ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi

# プランファイルの存在確認
PLAN_COUNT=$(find .claude/plans docs/plans "$HOME/.claude/plans" -name "*.md" -type f 2>/dev/null | wc -l)
if [ "$PLAN_COUNT" -eq 0 ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi

# === 整合チェック ===
OUTPUT=$(bash scripts/doc-consistency-check.sh --target plan 2>&1)
EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 0 ]; then
  # ERROR あり → ブロック
  SUMMARY=$(echo "$OUTPUT" | tail -5 | jq -Rs .)
  jq -n --argjson summary "$SUMMARY" '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "プラン整合チェックに ERROR があります。修正してから再度 ExitPlanMode を呼んでください。",
      "additionalContext": $summary
    }
  }'
  exit 0
fi

# === Self-Review 検証 ===
# 直近更新 plan ファイルを取得（suggest-subagent-for-plan.sh と同じロジック）
PLAN_FILE=$(find .claude/plans docs/plans "$HOME/.claude/plans" \
    -maxdepth 2 -name "*.md" -type f 2>/dev/null \
  | while IFS= read -r f; do
      mtime=$(stat -c '%Y' "$f" 2>/dev/null) || continue
      printf '%s %s\n' "$mtime" "$f"
    done \
  | sort -rn | head -1 | cut -d' ' -f2-)

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  # plan ファイル取れない場合は通過（整合チェックは通過済）
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","additionalContext":"プラン整合チェック通過 (Self-Review 検証スキップ: plan ファイル未取得)"}}'
  exit 0
fi

# Self-Review セクション or 適用除外マーカー の存在確認
HAS_SELF_REVIEW=$(grep -cE '^##[[:space:]]+(Self-Review|セルフレビュー)' "$PLAN_FILE" 2>/dev/null)
HAS_EXEMPTION=$(grep -cE 'Self-Review:[[:space:]]*適用除外' "$PLAN_FILE" 2>/dev/null)
: "${HAS_SELF_REVIEW:=0}"
: "${HAS_EXEMPTION:=0}"

if [ "$HAS_SELF_REVIEW" -eq 0 ] && [ "$HAS_EXEMPTION" -eq 0 ]; then
  CHECKLIST=$(cat <<EOF
プラン本文に「## Self-Review」セクション (or「## セルフレビュー」) が見つかりません。
memory plan-self-review-before-implementation.md の 7 観点で抜け漏れを潰してから ExitPlanMode を再呼び出してください。

7 観点:
1. 技術的前提 (LSP/Skills Policy / rebase / commit prefix)
2. スクリプト詳細 (set -e 副作用 / パス指定 / 既存 scripts 整合)
3. ドキュメント修正 (line 重複 / link 影響範囲)
4. 検証計画 (ローカル / CI / pre-push hook)
5. 後処理 (memory 監査 / sentinel / archive)
6. 実行制約 (Claude が勝手に merge / force push しない)
7. コミット分割 (各 commit のスコープ / hook 対応順序)

軽微タスク (1-3 ファイル / 10 分以内) なら本文に「Self-Review: 適用除外 (理由)」を記載で通過可。

対象 plan: ${PLAN_FILE}
EOF
)
  ESCAPED=$(printf '%s' "$CHECKLIST" | jq -Rs .)
  jq -n --argjson msg "$ESCAPED" '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "プランにセルフレビューセクションがありません。",
      "additionalContext": $msg
    }
  }'
  exit 0
fi

# === A: Self-Review 内容深さ検証 (機械的見出し追加アンチパターン防止) ===
# memory feedback-self-review-mechanical-addition-anti-pattern.md
# 各観点 (1-7) に >blockquote / 行番号参照 (LNNN/§N) / memory 参照 のいずれか + 100 字以上を必須化
if [ "$HAS_SELF_REVIEW" -gt 0 ] && [ "$HAS_EXEMPTION" -eq 0 ]; then
  REVIEW_BODY=$(awk '
    /^##[[:space:]]+(Self-Review|セルフレビュー)/ { in_section=1; next }
    /^## / { in_section=0 }
    in_section { print }
  ' "$PLAN_FILE")

  FAILED_OBSERVATIONS=()
  for i in 1 2 3 4 5 6 7; do
    OBSERVATION=$(echo "$REVIEW_BODY" | awk -v i="$i" '
      $0 ~ "^### " i "\\." { in_obs=1; next }
      $0 ~ "^### [0-9]+\\." { in_obs=0 }
      in_obs { print }
    ')

    if [ -z "$OBSERVATION" ]; then
      FAILED_OBSERVATIONS+=("観点 $i: セクションが空 or 欠落")
      continue
    fi

    CHAR_COUNT=$(echo "$OBSERVATION" | wc -m)
    HAS_QUOTE=$(echo "$OBSERVATION" | grep -cE '^>' 2>/dev/null || true); HAS_QUOTE=${HAS_QUOTE:-0}
    HAS_LINE_REF=$(echo "$OBSERVATION" | grep -cE 'L[0-9]+|:[0-9]+|§[0-9]' 2>/dev/null || true); HAS_LINE_REF=${HAS_LINE_REF:-0}
    HAS_MEMORY_REF=$(echo "$OBSERVATION" | grep -cE 'memory `[^`]*\.md`' 2>/dev/null || true); HAS_MEMORY_REF=${HAS_MEMORY_REF:-0}

    if [ "$CHAR_COUNT" -lt 100 ]; then
      FAILED_OBSERVATIONS+=("観点 $i: 本文が 100 字未満 ($CHAR_COUNT 字)")
      continue
    fi

    if [ "$HAS_QUOTE" -eq 0 ] && [ "$HAS_LINE_REF" -eq 0 ] && [ "$HAS_MEMORY_REF" -eq 0 ]; then
      FAILED_OBSERVATIONS+=("観点 $i: 具体引用 (>) / 行番号参照 (LNNN/§N) / memory 参照 (memory \`...md\`) のいずれも無し")
    fi

    PLACEHOLDER_HITS=$(echo "$OBSERVATION" | grep -oE '一般的(な|に)|通常通り|特に問題|問題な[くし]|N/?A|TBD' 2>/dev/null | wc -l || true); PLACEHOLDER_HITS=${PLACEHOLDER_HITS:-0}
    DISTINCT_TOKENS=$(echo "$OBSERVATION" | tr -s '[:space:][:punct:]' '\n' | grep -v '^$' 2>/dev/null | sort -u | wc -l || true); DISTINCT_TOKENS=${DISTINCT_TOKENS:-0}
    if [ "$PLACEHOLDER_HITS" -ge 2 ]; then
      FAILED_OBSERVATIONS+=("観点 $i: placeholder 文 ($PLACEHOLDER_HITS 箇所) — 「一般的」「通常通り」「特に問題ない」等を具体記述に置換")
      continue
    fi
    if [ "$DISTINCT_TOKENS" -lt 25 ]; then
      FAILED_OBSERVATIONS+=("観点 $i: 語彙多様性不足 ($DISTINCT_TOKENS unique tokens) — boilerplate 疑い")
    fi
  done

  if [ ${#FAILED_OBSERVATIONS[@]} -gt 0 ]; then
    DEPTH_MSG="Self-Review 内容深さ検証 fail (機械的見出し追加の疑い):"$'\n'
    for obs in "${FAILED_OBSERVATIONS[@]}"; do
      DEPTH_MSG+="  - $obs"$'\n'
    done
    DEPTH_MSG+=$'\n'"各観点に以下のいずれか + 最低 100 字以上の本文を記載してください:"$'\n'
    DEPTH_MSG+="  - \`>\` blockquote (本文引用)"$'\n'
    DEPTH_MSG+="  - 行番号参照 (LNNN / :NN-NN / §NN.N)"$'\n'
    DEPTH_MSG+="  - memory ファイル参照 (memory \`....md\`)"$'\n'
    DEPTH_MSG+=$'\n'"対象 plan: $PLAN_FILE"

    ESCAPED=$(printf '%s' "$DEPTH_MSG" | jq -Rs .)
    jq -n --argjson msg "$ESCAPED" '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "Self-Review の内容深さ不足 (機械的見出し追加の疑い)。",
        "additionalContext": $msg
      }
    }'
    exit 0
  fi
fi

# === D-1: Plan レビューラリー要件 ===
# memory feedback-plan-rally-required-before-exit.md / feedback-claude-self-bias-blind-spot.md
# === 汎用化: AGENT_LOG_DIR を sanitized cwd + UID から動的計算、env 経由 override 可能化 ===
if [ "$HAS_EXEMPTION" -eq 0 ]; then
  AGENT_LOG_DIR="${CLAUDE_AGENT_LOG_DIR:-/tmp/claude-${USER_UID}${SANITIZED_CWD}}"
  RECENT_LOGS=""
  if [ -d "$AGENT_LOG_DIR" ]; then
    RECENT_LOGS=$(find -L "$AGENT_LOG_DIR" -path '*/tasks/*.output' -mmin -30 -type f 2>/dev/null)
  fi

  RALLY_PASS=0
  if [ -n "$RECENT_LOGS" ]; then
    while IFS= read -r log; do
      [ -z "$log" ] && continue
      AGENT_TYPE_MATCH=$(grep -cE '"(subagent_type|attributionAgent)":"(Plan|general-purpose)"' "$log" 2>/dev/null || true); AGENT_TYPE_MATCH=${AGENT_TYPE_MATCH:-0}
      KEYWORD_MATCH=$(grep -cE 'plan critique|plan review|再点検|整合性|連動更新|drift' "$log" 2>/dev/null || true); KEYWORD_MATCH=${KEYWORD_MATCH:-0}
      if [ "$AGENT_TYPE_MATCH" -gt 0 ] && [ "$KEYWORD_MATCH" -gt 0 ]; then
        RALLY_PASS=1
        break
      fi
    done <<< "$RECENT_LOGS"
  fi

  if [ "$RALLY_PASS" -eq 0 ]; then
    RALLY_MSG="Plan レビューラリー未実施 (D-1 check):"$'\n'
    RALLY_MSG+="  直近 30 分以内に Plan/general-purpose subagent による plan critique log が見つかりません。"$'\n'
    RALLY_MSG+="  log 探索先: $AGENT_LOG_DIR"$'\n'
    RALLY_MSG+=$'\n'"以下のいずれかを実施してから ExitPlanMode を再呼出:"$'\n'
    RALLY_MSG+="  1. \`/plan-rally\` skill を実行 (recommended)"$'\n'
    RALLY_MSG+="  2. Plan/general-purpose agent で plan 本体を critique させる (prompt に \"plan critique\" / \"plan review\" / \"再点検\" / \"整合性\" のいずれか含む)"$'\n'
    RALLY_MSG+=$'\n'"理由: Claude 自主判断は信頼しない設計 (memory \`feedback-claude-self-bias-blind-spot.md\` / \`feedback-plan-rally-required-before-exit.md\`)、独立 context の subagent でしか自己 bias に気付けない。"$'\n'
    RALLY_MSG+=$'\n'"対象 plan: $PLAN_FILE"

    ESCAPED=$(printf '%s' "$RALLY_MSG" | jq -Rs .)
    jq -n --argjson msg "$ESCAPED" '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "Plan レビューラリー未実施 (D-1 check)。",
        "additionalContext": $msg
      }
    }'
    exit 0
  fi
fi

# 全通過
echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","additionalContext":"プラン整合チェック通過 / Self-Review 検証通過 / 内容深さ通過 / ラリー要件通過"}}'
exit 0
```

**変更差分の要点**:
- L11-13 (新規): `SANITIZED_CWD` + `USER_UID` の動的計算
- L181 → L185 付近: `AGENT_LOG_DIR="${CLAUDE_AGENT_LOG_DIR:-/tmp/claude-${USER_UID}${SANITIZED_CWD}}"` (env 経由 override 可能化)
- D-1 deny メッセージに `log 探索先: $AGENT_LOG_DIR` を追加 (debug 性向上)

---

## 4. memory-capture-feedback.sh 汎用化 draft

**元 file**: `.claude/hooks/memory-capture-feedback.sh` (32 行)
**主な変更**: L25 完全絶対パス `/home/kosei/.claude/projects/-home-kosei-Projects-inventory-system/memory/` → `$MEMORY_DIR` 動的計算 + env 経由 override

```bash
#!/bin/bash
# UserPromptSubmit hook: feedback パターン検出
# ユーザー発話から feedback-worthy なパターンを検出し、
# Claude に memory/ 保存判断を additionalContext で促す。
# エラー時は黙って通過（会話をブロックしない）。

HOOK_INPUT=$(cat)

# prompt + cwd フィールド取得（jq 失敗時も安全）
USER_MSG=$(echo "$HOOK_INPUT" | jq -r '.prompt // empty' 2>/dev/null)
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null)

if [ -z "$USER_MSG" ]; then
  exit 0
fi

# === 汎用化: memory dir を sanitized cwd から動的計算、env 経由 override 可能化 ===
if [ -z "$CWD" ]; then
  CWD=$(pwd)
fi
SANITIZED_CWD=$(printf '%s' "$CWD" | tr / -)
MEMORY_DIR="${CLAUDE_MEMORY_DIR:-$HOME/.claude/projects${SANITIZED_CWD}/memory}"

# feedback パターン（明示保存 / 訂正 / 好み / 採用・承認）
PATTERN='覚えておいて|記憶して|残しておいて|feedback残す|save this|remember this|違う|そうじゃない|やめて|no, better|stop doing|の方がいい|は避けて|prefer|better to|採用|その方針|いいね|dale|go with|sounds good'

if echo "$USER_MSG" | grep -qE "$PATTERN"; then
  MATCH=$(echo "$USER_MSG" | grep -oE "$PATTERN" | head -1)

  jq -n --arg match "$MATCH" --arg memdir "$MEMORY_DIR" '{
    "hookSpecificOutput": {
      "hookEventName": "UserPromptSubmit",
      "additionalContext": ("feedback-worthy 発言検出: 『" + $match + "』。この turn の終了前に memory/ への保存可否を判断し、該当するなら " + $memdir + " 配下に Write せよ。feedback型なら『Why:』と『How to apply:』を含める。MEMORY.md の索引も更新すること。")
    }
  }' 2>/dev/null || exit 0

  exit 0
fi

exit 0
```

**変更差分の要点**:
- L11 (新規): `CWD` フィールド取得 (元 file は取ってなかった)
- L18-22 (新規): `SANITIZED_CWD` + `MEMORY_DIR` 動的計算 + env override
- additionalContext 文字列内: `/home/kosei/.claude/projects/...` 直書き → `$memdir` 変数置換 (jq の --arg で渡す)

---

## 5. suggest-subagent-for-plan.sh 汎用化 draft

**元 file**: `.claude/hooks/suggest-subagent-for-plan.sh` (53 行)
**主な変更**: ほぼ汎用、PLAN_FILE 探索 path は元から `$CWD/.claude/plans` 等の相対計算で問題なし。微修正のみ

```bash
#!/bin/bash
# PreToolUse(ExitPlanMode) hook: subagent 適用の検討をリマインダで注入
# 既存 check-plan-on-exit.sh（整合性チェック）とは職責分離。判定自体はメイン Claude に委ねる。
# エラー時はサイレントに通過（ExitPlanMode をブロックしない）。

HOOK_INPUT=$(cat)
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null)
[ -z "$CWD" ] && exit 0

emit_context() {
  local msg="$1"
  local escaped
  escaped=$(printf '%s' "$msg" | jq -Rs . 2>/dev/null) || exit 0
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":%s}}\n' "$escaped"
}

# プランファイル探索（ベストエフォート）
# awk '{print $2}' ではなく cut -d' ' -f2- にしてスペース入りパスを保護
PLAN_FILE=$(find "$CWD/.claude/plans" "$CWD/docs/plans" "$HOME/.claude/plans" \
    -maxdepth 2 -name "*.md" -type f 2>/dev/null \
  | while IFS= read -r f; do
      mtime=$(stat -c '%Y' "$f" 2>/dev/null) || continue
      printf '%s %s\n' "$mtime" "$f"
    done \
  | sort -rn | head -1 | cut -d' ' -f2-)

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  emit_context "**Subagent 判定リマインダ**: プラン本文を参照して、実装作業なら Agent (general-purpose, run_in_background: true) で subagent 起動を検討せよ。対話判断が必要なら手動実行。公式推奨パターン: https://claude.com/blog/using-claude-code-session-management-and-1m-context"
  exit 0
fi

PLAN_BODY=$(cat "$PLAN_FILE" 2>/dev/null) || exit 0

RECOMMEND_SIG="実装|作成|Write|Edit|cargo|npm|build|並列発火|fmt|clippy"
EXCLUDE_SIG="ユーザーに確認|意見を求める|途中で判断|対話的|AskUserQuestion"

HAS_RECOMMEND=$(printf '%s\n' "$PLAN_BODY" | grep -cE "$RECOMMEND_SIG" 2>/dev/null)
HAS_EXCLUDE=$(printf '%s\n' "$PLAN_BODY" | grep -cE "$EXCLUDE_SIG" 2>/dev/null)
: "${HAS_RECOMMEND:=0}"
: "${HAS_EXCLUDE:=0}"

if [ "$HAS_RECOMMEND" -gt 0 ] && [ "$HAS_EXCLUDE" -eq 0 ]; then
  emit_context "**Subagent 推奨**: このプランは general-purpose subagent (run_in_background: true) で実行することを検討せよ。プラン本文を Agent tool に渡して bg 起動すれば、クリーンコンテキストで context rot を回避できる。参照プラン: $PLAN_FILE"
elif [ "$HAS_RECOMMEND" -gt 0 ] && [ "$HAS_EXCLUDE" -gt 0 ]; then
  emit_context "**Subagent 不適合**: このプランは対話判断を含む。subagent はインタラクティブ操作不可なので手動実行を推奨。参照プラン: $PLAN_FILE"
fi

# 推奨シグナルなし or フォーマット外 → サイレント
exit 0
```

**変更差分の要点**:
- なし (元から `$CWD` 相対計算で汎用、`$HOME/.claude/plans` 探索も汎用、URL 直書きも公式 docs で固有性なし)
- 念のため bash strict mode (`set -euo pipefail`) は追加しない (元 file が想定する fallback 動作 `exit 0 ` を維持するため)

---

## 6. 配置後の動作確認

各 project の `.claude/settings.json` で global hook 参照に切り替えた場合、以下で確認:

```bash
# Plan mode 内で適当な plan 作成 → ExitPlanMode で hook が走る
# 期待: check-plan-on-exit.sh が integrity check + Self-Review + D-1 ラリー要件を順に検証

# feedback パターンを user prompt で含めると memory-capture-feedback.sh が additionalContext 注入
# 期待: 「覚えておいて」等のパターン検出時に Claude に memory 保存判断を促す

# Plan mode で実装系 plan を書くと suggest-subagent-for-plan.sh が subagent 推奨を additionalContext 注入
# 期待: 「実装/作成/Write」等を含む plan で subagent 推奨が出る
```

env 経由 override が必要な場合 (例: agent log dir が標準位置にない):

```bash
export CLAUDE_AGENT_LOG_DIR=/path/to/custom/agent-log
export CLAUDE_MEMORY_DIR=/path/to/custom/memory
```

---

## 7. 元 file との差分まとめ

| hook | 元 file 行数 | 汎用化後 行数 | 主な変更 |
|------|-------------|-------------|----------|
| check-plan-on-exit.sh | 225 | 約 230 (+5) | sanitized cwd + UID 動的計算、AGENT_LOG_DIR の env override 化 |
| memory-capture-feedback.sh | 32 | 約 40 (+8) | CWD 取得追加、MEMORY_DIR 動的計算 + env override 化、jq --arg で文字列展開 |
| suggest-subagent-for-plan.sh | 53 | 約 53 (±0) | 変更なし (元から汎用) |

---

## 8. 親 plan §4 Phase 2-C 完了基準の照合

| 完了基準 | 達成状況 |
|---------|---------|
| ~/.claude/hooks/ に汎用化リファクタ後の 3 hook 配置 | 🔜 user 手作業 (本ファイル §1 配置手順) |
| 別 project (例: inventory-system) で Claude Code 起動して各 hook が発動することを確認 | 🔜 user 動作確認 (本ファイル §6) |
| inventory-system 既存 hook (.claude/hooks/) との共存 / 切替判断 | 🔜 user 判断 (本ファイル §1 step 4 参照、global 単独 / project local 単独 / 併用の 3 案) |
