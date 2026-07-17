#!/bin/bash
# UserPromptSubmit hook: feedback パターン検出
# ユーザー発話から feedback-worthy なパターンを検出し、
# Claude に memory/ 保存判断を additionalContext で促す。
# エラー時は黙って通過（会話をブロックしない）。

HOOK_INPUT=$(cat)

# prompt フィールド取得（jq 失敗時も安全）
USER_MSG=$(echo "$HOOK_INPUT" | jq -r '.prompt // empty' 2>/dev/null)

if [ -z "$USER_MSG" ]; then
  exit 0
fi

# feedback パターン（明示保存 / 訂正 / 好み / 採用・承認）
PATTERN='覚えておいて|記憶して|残しておいて|feedback残す|save this|remember this|違う|そうじゃない|やめて|no, better|stop doing|の方がいい|は避けて|prefer|better to|採用|その方針|いいね|dale|go with|sounds good'

if echo "$USER_MSG" | grep -qE "$PATTERN"; then
  MATCH=$(echo "$USER_MSG" | grep -oE "$PATTERN" | head -1)

  jq -n --arg match "$MATCH" '{
    "hookSpecificOutput": {
      "hookEventName": "UserPromptSubmit",
      "additionalContext": ("feedback-worthy 発言検出: 『" + $match + "』。この turn の終了前に memory/ への保存可否を判断し、該当するなら /home/kosei/.claude/projects/-home-kosei-Projects-inventory-system-public/memory/ 配下に Write せよ。feedback型なら『Why:』と『How to apply:』を含める。MEMORY.md の索引も更新すること。")
    }
  }' 2>/dev/null || exit 0

  exit 0
fi

exit 0
