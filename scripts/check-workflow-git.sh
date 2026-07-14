#!/usr/bin/env bash
# scripts/check-workflow-git.sh
# ============================================================================
# PK5（Plan Commit ancestry）と state-only commit 上限（STATECAP）の git 検査
# docs/DEV_WORKFLOW.md 「Plan Commit ancestry (D-039, PK5)」/ D-039 参照
# docs/plans/2026-07-12-mechanical-workflow-slice2.md Scope 3-4 参照
#
# 呼び出し元: scripts/pre-push.sh（push 前 gate）/ scripts/local-ci.sh（L1 gate）
# CI `docs` job には追加しない（shallow clone のため、packet Contract Probe P1 参照）
#
# 検査内容:
#   PK5: docs/plans/ 直下の各 active packet について
#     (a) `Plan Commit` の SHA が現 HEAD の ancestor であること
#     (b) `Amendments` 行の各 SHA が `Plan Commit` の descendant かつ HEAD の ancestor であること
#     (c) `Plan Commit` の値が過去に書き換えられていないこと（初回 non-pending 値と現在値の比較）
#   STATECAP: `$(git merge-base origin/main HEAD)..HEAD` の範囲で
#     - forward `docs(plans): state-only遷移` prefix の commit が 3 件超で ERROR
#     - そのうち post-implementation 相当（subject に local-verified / independent-review /
#       human-confirm / ready-hosted-final / merge のいずれかの token を含む）が 2 件超で ERROR
#     - `docs(plans): state-backtrack <from>-><to>` は単一 backward 遷移だけを許容し、
#       forward cap の対象外。forward / chain / unknown / zero / same-phase は ERROR
#     - docs/plans/ 配下のみを変更していながら prefix を持たない commit は WARN（ラベル逃れ捕捉網）
#
# 「active plan なし」自体は本スクリプトの対象外（doc-consistency-check.sh PK1 が担当、
# 本スクリプトは docs/plans/ 直下が空でも WARN/ERROR を出さず黙って skip する）
# ============================================================================

set -u  # 各 check を独立 FAIL=1 集約方式のため set -e は使わない

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

FAIL=0
PLAN_DIR="docs/plans"
WORKFLOW_STATE_PHASES="kickoff spec-check design plan-draft plan-gate plan-approved implementing local-verified independent-review human-confirm ready-hosted-final merge archive"

workflow_phase_index() {
    local needle="$1" phase index=0
    for phase in $WORKFLOW_STATE_PHASES; do
        if [[ "$phase" == "$needle" ]]; then
            printf '%s' "$index"
            return 0
        fi
        index=$((index + 1))
    done
    return 1
}

# ----------------------------------------------------------------------------
# PK5: 単一 packet ファイルの Plan Commit ancestry 検査
# ----------------------------------------------------------------------------
check_plan_commit_ancestry() {
    local file="$1"
    local plan_commit amendments amendment first_value

    plan_commit="$(grep -m1 -E '^- Plan Commit:[[:space:]]*' "$file" 2>/dev/null \
        | sed -E 's/^- Plan Commit:[[:space:]]*//; s/[[:space:]]+$//')"

    # Plan Commit が pending（未確定）の packet は PK5 の対象外（plan-draft/plan-gate フェーズ）
    if [[ -z "$plan_commit" || "$plan_commit" == "pending" ]]; then
        return 0
    fi

    if ! git rev-parse --verify "${plan_commit}^{commit}" >/dev/null 2>&1; then
        echo "❌ [workflow-git] PK5: $file の Plan Commit '$plan_commit' は解決できない SHA です"
        FAIL=1
        return 0
    fi

    if ! git merge-base --is-ancestor "$plan_commit" HEAD 2>/dev/null; then
        echo "❌ [workflow-git] PK5: $file の Plan Commit '$plan_commit' は現在の HEAD の祖先ではありません"
        FAIL=1
    fi

    # Amendments: SHA らしきトークン（16進 7〜40 文字）を区切り文字非依存で抽出する。
    # "none" や未確定の記述にはこの形の文字列は現れないため、抽出結果が空なら検査対象なし。
    amendments="$(grep -m1 -E '^- Amendments:[[:space:]]*' "$file" 2>/dev/null \
        | sed -E 's/^- Amendments:[[:space:]]*//; s/[[:space:]]+$//')"

    if [[ -n "$amendments" ]]; then
        while IFS= read -r amendment; do
            [[ -z "$amendment" ]] && continue
            if ! git rev-parse --verify "${amendment}^{commit}" >/dev/null 2>&1; then
                echo "❌ [workflow-git] PK5: $file の Amendments SHA '$amendment' は解決できません"
                FAIL=1
                continue
            fi
            if ! git merge-base --is-ancestor "$plan_commit" "$amendment" 2>/dev/null; then
                echo "❌ [workflow-git] PK5: $file の Amendments SHA '$amendment' は Plan Commit '$plan_commit' の descendant ではありません"
                FAIL=1
            fi
            if ! git merge-base --is-ancestor "$amendment" HEAD 2>/dev/null; then
                echo "❌ [workflow-git] PK5: $file の Amendments SHA '$amendment' は現在の HEAD の祖先ではありません"
                FAIL=1
            fi
        done < <(printf '%s' "$amendments" | grep -oE '[0-9a-f]{7,40}')
    fi

    # Plan Commit 書き換え検出: ファイル履歴の全 diff から追加された
    # "- Plan Commit: <value>" 行を新しい commit 順に集め、pending を除外した上で
    # 最後（= 最も古い non-pending 値 = 初回確定値）を現在値と比較する。
    first_value="$(git log --follow -p -- "$file" 2>/dev/null \
        | grep -E '^[+]- Plan Commit:[[:space:]]*' \
        | sed -E 's/^[+]- Plan Commit:[[:space:]]*//; s/[[:space:]]+$//' \
        | grep -v -E '^pending$' \
        | tail -1)"

    if [[ -n "$first_value" && "$first_value" != "$plan_commit" ]]; then
        echo "❌ [workflow-git] PK5: $file の Plan Commit が書き換えられています（初回確定値 '$first_value' -> 現在値 '$plan_commit'）"
        FAIL=1
    fi
}

# ----------------------------------------------------------------------------
# STATECAP: state-only遷移 commit の上限検査
# ----------------------------------------------------------------------------
resolve_main_merge_base() {
    local base=""
    if git rev-parse --verify 'origin/main^{commit}' >/dev/null 2>&1; then
        base="$(git merge-base origin/main HEAD 2>/dev/null || true)"
    fi
    if [[ -z "$base" ]] && git rev-parse --verify 'main^{commit}' >/dev/null 2>&1; then
        base="$(git merge-base main HEAD 2>/dev/null || true)"
    fi
    printf '%s' "$base"
}

check_state_only_commit_cap() {
    local base commits sha subject files from_phase to_phase from_index to_index
    local state_only_count=0
    local post_impl_count=0
    local prev_was_backtrack=0
    local post_impl_regex='local-verified|independent-review|human-confirm|ready-hosted-final|merge'
    local backtrack_regex='^docs\(plans\):[[:space:]]state-backtrack[[:space:]]([a-z0-9-]+)->([a-z0-9-]+)$'

    base="$(resolve_main_merge_base)"
    if [[ -z "$base" ]]; then
        echo "⚠️  [workflow-git] STATECAP: origin/main も main も見つからないため計数をスキップします" >&2
        return 0
    fi

    commits="$(git rev-list "${base}..HEAD" 2>/dev/null || true)"
    [[ -z "$commits" ]] && return 0

    while IFS= read -r sha; do
        [[ -z "$sha" ]] && continue
        subject="$(git log -1 --format=%s "$sha")"

        if [[ "$subject" =~ ^docs\(plans\):[[:space:]]state-backtrack ]]; then
            # 隣接する state-backtrack はチェーン分割による多段 backtrack（cap 回避）と
            # みなして ERROR。正当な複数回補正は間に実作業 commit を挟む。
            if [[ "$prev_was_backtrack" -eq 1 ]]; then
                echo "❌ [workflow-git] STATECAP: state-backtrack を連続で記録できません。補正は最早影響 phase へ単一遷移で戻してください（subject: $subject）"
                FAIL=1
            fi
            prev_was_backtrack=1
            if [[ ! "$subject" =~ $backtrack_regex ]]; then
                echo "❌ [workflow-git] STATECAP: state-backtrack は単一の '<from>-><to>' 遷移で記録してください（subject: $subject）"
                FAIL=1
                continue
            fi

            from_phase="${BASH_REMATCH[1]}"
            to_phase="${BASH_REMATCH[2]}"
            if ! from_index="$(workflow_phase_index "$from_phase")" ||
                ! to_index="$(workflow_phase_index "$to_phase")"; then
                echo "❌ [workflow-git] STATECAP: state-backtrack に未知の phase があります（subject: $subject）"
                FAIL=1
                continue
            fi
            if [[ "$from_index" -le "$to_index" ]]; then
                echo "❌ [workflow-git] STATECAP: state-backtrack は backward 遷移のみ許容します（subject: $subject）"
                FAIL=1
            fi
            continue
        fi
        prev_was_backtrack=0

        if [[ "$subject" =~ ^docs\(plans\):[[:space:]]state-only遷移 ]]; then
            state_only_count=$((state_only_count + 1))
            if [[ "$subject" =~ $post_impl_regex ]]; then
                post_impl_count=$((post_impl_count + 1))
            fi
            continue
        fi

        # prefix なしの plans-only commit（ラベル逃れ）を WARN で捕捉する。
        # 前方一致 'docs/plans/' のみを対象とし、docs/Plans.md や docs/archive/plans/ の
        # ような紛らわしい隣接パスは意図的に対象外（境界 fixture で検証）。
        files="$(git diff-tree --no-commit-id --name-only -r "$sha" 2>/dev/null || true)"
        if [[ -n "$files" ]] && ! printf '%s\n' "$files" | grep -qvE '^docs/plans/'; then
            echo "⚠️  [workflow-git] STATECAP: commit ${sha:0:7} は docs/plans/ 配下のみを変更していますが 'docs(plans): state-only遷移' prefix がありません（subject: $subject）"
        fi
    done <<< "$commits"

    if [[ "$state_only_count" -gt 3 ]]; then
        echo "❌ [workflow-git] STATECAP: state-only遷移 commit が ${state_only_count} 件あり、上限 3 件を超えています"
        FAIL=1
    fi
    if [[ "$post_impl_count" -gt 2 ]]; then
        echo "❌ [workflow-git] STATECAP: post-implementation 相当の state-only遷移 commit が ${post_impl_count} 件あり、上限 2 件を超えています"
        FAIL=1
    fi
}

main() {
    local file

    while IFS= read -r file; do
        [[ -n "$file" ]] || continue
        check_plan_commit_ancestry "$file"
    done < <(find "$REPO_ROOT/$PLAN_DIR" -maxdepth 1 -name '*.md' -type f 2>/dev/null | sort)

    check_state_only_commit_cap

    if [[ "$FAIL" -eq 0 ]]; then
        echo "✅ [workflow-git] PK5/STATECAP 検査 OK"
    fi

    exit "$FAIL"
}

main
