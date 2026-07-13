#!/bin/bash
# SessionStart hook: age-based safety net
# 30日以上 memory/ 監査が未実施なら警告を注入。
# A/B トリガーが不発でも忘却を構造的に防ぐ保険。

HOOK_INPUT=$(cat)

SENTINEL="/home/kosei/.claude/projects/-home-kosei-Projects-inventory-system/memory/.last_audit"

# 初回（sentinel 不存在）はサイレント通過
# 初回 sentinel は手動で touch するか、最初の監査実施時に作られる
if [ ! -f "$SENTINEL" ]; then
  exit 0
fi

NOW=$(date +%s)
MTIME=$(stat -c %Y "$SENTINEL" 2>/dev/null)

if [ -z "$MTIME" ]; then
  exit 0
fi

DAYS=$(( (NOW - MTIME) / 86400 ))

if [ "$DAYS" -gt 30 ]; then
  jq -n --arg days "$DAYS" '{
    "hookSpecificOutput": {
      "hookEventName": "SessionStart",
      "additionalContext": ("memory/ 監査が " + $days + " 日間未実施（30日閾値超過）。Phase 6.1 監査手順を今セッション中に実行せよ。完了時は必ず `touch /home/kosei/.claude/projects/-home-kosei-Projects-inventory-system/memory/.last_audit` でリセット。")
    }
  }' 2>/dev/null || exit 0
fi

exit 0
