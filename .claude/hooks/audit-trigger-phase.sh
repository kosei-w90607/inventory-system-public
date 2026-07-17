#!/bin/bash
# PostToolUse(Bash) hook: git tag 作成を検知して監査トリガー
# 段階完了（v*.*.* 等のタグ）を段階完了のマーカーとして扱い、
# memory/ 監査の必要性をソフトに通知する。

HOOK_INPUT=$(cat)

CMD=$(echo "$HOOK_INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$CMD" ]; then
  exit 0
fi

# tool 実行が失敗していたら監査トリガーを発火しない（誤発火防止）
# 公式 hooks.md: PostToolUse の tool_response.exit_code で成否判別
EXIT_CODE=$(echo "$HOOK_INPUT" | jq -r '.tool_response.exit_code // 0' 2>/dev/null)
if [ "$EXIT_CODE" != "0" ]; then
  exit 0
fi

# git tag v* パターン（バージョンタグ作成のみ検知。list や delete は除外）
if echo "$CMD" | grep -qE 'git[[:space:]]+tag[[:space:]]+(-a[[:space:]]+)?v[0-9]'; then
  jq -n '{
    "hookSpecificOutput": {
      "hookEventName": "PostToolUse",
      "additionalContext": "段階完了検出（git tag v*）。次の自然な区切りで memory/ 監査を実施せよ。実施完了時は必ず `touch /home/kosei/.claude/projects/-home-kosei-Projects-inventory-system-public/memory/.last_audit` で sentinel 更新（Phase 4.6 safety-net リセット）。監査チェックリスト: MEMORY.md 180行超の分割判断 / 90日超ファイルのレビュー / docs 昇格候補抽出 / hook パターン漏れ確認。"
    }
  }' 2>/dev/null || exit 0

  exit 0
fi

exit 0
