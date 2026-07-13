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
  # プランファイルが取れない場合: メイン Claude に判断を委ねるリマインダ
  emit_context "**Subagent 判定リマインダ**: プラン本文を参照して、実装作業なら Agent (general-purpose, run_in_background: true) で subagent 起動を検討せよ。対話判断が必要なら手動実行。公式推奨パターン: https://claude.com/blog/using-claude-code-session-management-and-1m-context"
  exit 0
fi

PLAN_BODY=$(cat "$PLAN_FILE" 2>/dev/null) || exit 0

RECOMMEND_SIG="実装|作成|Write|Edit|cargo|npm|build|並列発火|fmt|clippy"
EXCLUDE_SIG="ユーザーに確認|意見を求める|途中で判断|対話的|AskUserQuestion"

# grep -c は 0 マッチ時 exit 1 → `|| echo 0` 付けると "0\n0" になる罠。
# grep -c は常に数字を出力するので fallback 不要。exit code は無視する。
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
