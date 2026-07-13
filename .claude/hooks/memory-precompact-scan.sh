#!/bin/bash
# PreCompact hook: 圧縮前の強制スキャン
# コンテキスト圧縮でfeedback/判断軸が失われる前に救出を促す。

HOOK_INPUT=$(cat)

jq -n '{
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "additionalContext": "CRITICAL: コンテキスト圧縮前。このセッションで memory/ に未保存の feedback / 判断軸 / 採用決定があれば、圧縮前に今すぐ Write せよ。圧縮後は詳細が消える。保存先: /home/kosei/.claude/projects/-home-kosei-Projects-inventory-system/memory/ 配下に feedback_*.md / project_*.md / user_*.md。MEMORY.md 索引も更新必須。"
  }
}' 2>/dev/null || exit 0

exit 0
