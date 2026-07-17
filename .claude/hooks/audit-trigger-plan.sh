#!/bin/bash
# PostToolUse(Write|Edit|MultiEdit) hook: プランファイル作成・更新を検知して監査トリガー
# 数日〜週1の中間チェックポイント。ソフトリマインダとして機能。

HOOK_INPUT=$(cat)

FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# tool 実行が失敗していたら監査トリガーを発火しない（誤発火防止）
# 公式 hooks.md: PostToolUse の tool_response.exit_code で成否判別
EXIT_CODE=$(echo "$HOOK_INPUT" | jq -r '.tool_response.exit_code // 0' 2>/dev/null)
if [ "$EXIT_CODE" != "0" ]; then
  exit 0
fi

# .claude/plans/*.md または docs/plans/*.md にマッチ
if echo "$FILE_PATH" | grep -qE '(\.claude/plans|docs/plans)/[^/]+\.md$'; then
  jq -n '{
    "hookSpecificOutput": {
      "hookEventName": "PostToolUse",
      "additionalContext": "プランファイル作成・更新検出。次の自然な区切りで memory/ 軽量監査を検討。実施時は `touch /home/kosei/.claude/projects/-home-kosei-Projects-inventory-system-public/memory/.last_audit` で sentinel 更新。軽量監査: 直近セッションの feedback / 判断軸が memory/ に反映されているかの確認で十分。"
    }
  }' 2>/dev/null || exit 0

  exit 0
fi

exit 0
