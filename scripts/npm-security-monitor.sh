#!/usr/bin/env bash
# npm dependency-security 常設 monitoring（D-030、Plans.md Backlog 項目の実体）
#
# 2 つの hygiene check を実行し、markdown report を stdout に出す:
#   1. npm audit --audit-level=high — high / critical の有無
#   2. 監視対象 advisory の state 変化（withdrawn / patched 化の検知）
#
# exit code: 0 = 全て clean / 1 = 通知すべき findings あり / 2 = check 自体の失敗
# 通知は情報提供のみで自動対処はしない（対処は user 判断、D-030）。
# ローカル実行可: ./scripts/npm-security-monitor.sh（gh CLI + npm が必要）
set -u

# 監視対象 advisory（本プロジェクト採用 package に関わるもの）
WATCHED_ADVISORIES=(
    "GHSA-g7cv-rxg3-hmpx" # TanStack Mini Shai-Hulud (2026-05)。withdrawn 化は D-030 後も参考情報として通知
)

FINDINGS=0
CHECK_FAILED=0

echo "# npm dependency security report"
echo ""
echo "実行日時: $(date -u +%Y-%m-%dT%H:%M:%SZ) (UTC)"
echo ""

# --- 1. npm audit (high 以上) ------------------------------------------------
echo "## 1. npm audit --audit-level=high"
echo ""

audit_json=$(npm audit --json 2>/dev/null)
audit_parse_exit=$?
if [ -z "$audit_json" ] || [ "$audit_parse_exit" -gt 1 ]; then
    # npm audit は脆弱性ありでも exit 1 で JSON を返す。JSON が取れない時のみ check 失敗
    echo "- ❌ npm audit の実行に失敗しました（registry 到達不可等）。re-run で再確認してください。"
    CHECK_FAILED=1
else
    high_count=$(printf '%s' "$audit_json" | node -e "
        const a = JSON.parse(require('fs').readFileSync(0, 'utf8'));
        const m = a.metadata?.vulnerabilities ?? {};
        console.log((m.high ?? 0) + (m.critical ?? 0));
    " 2>/dev/null || echo "parse_error")
    if [ "$high_count" = "parse_error" ]; then
        echo "- ❌ npm audit JSON の parse に失敗しました。"
        CHECK_FAILED=1
    elif [ "$high_count" -gt 0 ]; then
        FINDINGS=1
        echo "- 🔴 **high / critical が ${high_count} 件あります**:"
        echo ""
        printf '%s' "$audit_json" | node -e "
            const a = JSON.parse(require('fs').readFileSync(0, 'utf8'));
            for (const [name, v] of Object.entries(a.vulnerabilities ?? {})) {
                if (v.severity !== 'high' && v.severity !== 'critical') continue;
                const via = v.via.filter(x => typeof x === 'object');
                const urls = via.map(x => x.url).join(' ');
                console.log('- \`' + name + '\` (' + v.severity + ', range: ' + v.range + ', fixAvailable: ' + JSON.stringify(v.fixAvailable) + ') ' + urls);
            }
        "
        echo ""
        echo "  対処は D-030 逐次投入（名指し package 更新 + audit 確認）で行う。\`npm audit fix --force\` は禁止。"
    else
        moderate_low=$(printf '%s' "$audit_json" | node -e "
            const a = JSON.parse(require('fs').readFileSync(0, 'utf8'));
            const m = a.metadata?.vulnerabilities ?? {};
            console.log('low ' + (m.low ?? 0) + ' / moderate ' + (m.moderate ?? 0));
        " 2>/dev/null || echo "-")
        echo "- ✅ high / critical 0 件（参考: ${moderate_low}）"
    fi
fi
echo ""

# --- 2. 監視対象 advisory の state --------------------------------------------
echo "## 2. 監視対象 advisory の state"
echo ""

for ghsa in "${WATCHED_ADVISORIES[@]}"; do
    adv_json=$(gh api "/advisories/${ghsa}" 2>/dev/null)
    if [ -z "$adv_json" ]; then
        echo "- ❌ \`${ghsa}\`: 取得に失敗しました（GitHub API 到達不可等）。"
        CHECK_FAILED=1
        continue
    fi
    withdrawn=$(printf '%s' "$adv_json" | node -e "
        const a = JSON.parse(require('fs').readFileSync(0, 'utf8'));
        console.log(a.withdrawn_at ?? 'null');
    " 2>/dev/null || echo "parse_error")
    updated=$(printf '%s' "$adv_json" | node -e "
        const a = JSON.parse(require('fs').readFileSync(0, 'utf8'));
        console.log(a.updated_at ?? '-');
    " 2>/dev/null || echo "-")
    if [ "$withdrawn" = "parse_error" ]; then
        echo "- ❌ \`${ghsa}\`: JSON parse に失敗しました。"
        CHECK_FAILED=1
    elif [ "$withdrawn" != "null" ]; then
        FINDINGS=1
        echo "- 📣 \`${ghsa}\`: **withdrawn になりました**（withdrawn_at: ${withdrawn}）。監視リストからの除外を検討してください。"
    else
        echo "- ✅ \`${ghsa}\`: active のまま（updated_at: ${updated}）。変化なし。"
    fi
done
echo ""

# --- 結果 ---------------------------------------------------------------------
if [ "$CHECK_FAILED" -eq 1 ]; then
    echo "> 結果: ⚠️ check の一部が実行失敗（findings 判定は不完全）"
    exit 2
elif [ "$FINDINGS" -eq 1 ]; then
    echo "> 結果: 🔔 通知対象の findings あり（対処は user 判断、自動対処なし = D-030）"
    exit 1
else
    echo "> 結果: ✅ 全て clean"
    exit 0
fi
