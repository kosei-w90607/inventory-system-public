#!/bin/bash
# ExitPlanMode 時にプランファイルの整合性 + Self-Review を検証
# どちらかに違反があれば ExitPlanMode をブロック（permissionDecision: deny）
# 整合: scripts/doc-consistency-check.sh --target plan
# Self-Review: 直近更新 plan に「## Self-Review」or「## セルフレビュー」or「Self-Review: 適用除外」が必要
# 参考: memory plan-self-review-before-implementation.md（7 観点）

HOOK_INPUT=$(cat)
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd')
cd "$CWD" || exit 2

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

# active plan が無い場合は full check に fallback（DEV_WORKFLOW.md Plan Packet Rules 準拠）
if [ "$EXIT_CODE" -ne 0 ] && echo "$OUTPUT" | grep -q "チェック対象のプランファイルが見つかりません"; then
  OUTPUT=$(bash scripts/doc-consistency-check.sh 2>&1)
  EXIT_CODE=$?
fi

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
    # `|| true` で grep no-match 時の exit 1 を抑え、`${X:-0}` で空文字列を 0 に default 化
    # (Codex PR #56 P2-2 反映: 旧 `|| echo 0` だと bash 一部で `0\n0` の二重出力で integer error、
    # `|| true` 単独だと空文字列で integer error、両者を `${X:-0}` で安全に正規化)
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

    # === A-2: placeholder + 語彙多様性検証 (具体性逆検査) ===
    # memory feedback-self-review-mechanical-addition-anti-pattern.md
    # 100 字突破 + 形式条件 OK でも boilerplate / placeholder 連発を弾く
    # 閾値根拠: 2026-05-09 fixture 計測 (active plan で distinct_tokens 58-72 / placeholder 0)
    # grep -oE | wc -l で「1 行に複数 placeholder 散らした case」も検出
    # `|| true` + `${X:-0}` は L123-125 同様の pipefail 防御 (将来 set -e + pipefail 追加耐性、Codex PR #57 P1 反映)
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

# === D-1: Plan レビューラリー要件 (直近 30 分以内に Plan/general-purpose subagent の plan critique log) ===
# memory feedback-plan-rally-required-before-exit.md / feedback-claude-self-bias-blind-spot.md
# Claude 自主判断は信頼しない設計 → 独立 context の subagent log を機械的に強制
if [ "$HAS_EXEMPTION" -eq 0 ]; then
  AGENT_LOG_DIR="/tmp/claude-1000/-home-kosei-Projects-inventory-system-public"
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

# 全通過 (整合 + Self-Review 見出し + 内容深さ + ラリー要件)
echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","additionalContext":"プラン整合チェック通過 / Self-Review 検証通過 / 内容深さ通過 / ラリー要件通過"}}'
exit 0
