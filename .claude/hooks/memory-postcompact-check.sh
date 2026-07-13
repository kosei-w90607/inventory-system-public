#!/bin/bash
# SessionStart(compact) hook: 圧縮後の回復リマインダ

HOOK_INPUT=$(cat)

jq -n '{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "圧縮後セッション開始。MEMORY.md の内容と現セッション目的が整合するか確認せよ。不整合ならメモリ読み直しまたは更新を検討。圧縮前に未保存の feedback があった可能性があれば、会話冒頭の要約を参照しつつ補完する。"
  }
}' 2>/dev/null || exit 0

exit 0
