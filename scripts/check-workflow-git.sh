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
#     (a) `Plan Commit` の実効 SHA が現 HEAD の ancestor であること
#     (b) `Amendments` 行の各実効 SHA が `Plan Commit` の実効 SHA の descendant かつ
#         HEAD の ancestor であること
#     (c) `Rebase Map` の各 pair が単一 commit patch-id 同値であり、Plan Commit または
#         Amendments SHA を root とする chain として整合すること
#     (d) `Plan Commit` の値が過去に書き換えられていないこと（初回 non-pending 値と現在値の比較）
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
# PK5: Rebase Map chain の実効 SHA 解決
# ----------------------------------------------------------------------------
resolve_rebase_chain() {
    local root_sha="$1"
    local root_label="$2"
    local file="$3"
    local output_name="$4"
    local next_name="$5"
    local used_name="$6"
    local -n output_ref="$output_name"
    local -n next_ref="$next_name"
    local -n used_ref="$used_name"
    local current="$root_sha"
    declare -A seen=()

    while [[ -n "${next_ref[$current]+x}" ]]; do
        if [[ -n "${seen[$current]+x}" ]]; then
            echo "❌ [workflow-git] PK5: $file の Rebase Map chain に循環があります（root: $root_label）"
            FAIL=1
            output_ref="$current"
            return 0
        fi
        seen["$current"]=1
        used_ref["$current"]=1
        current="${next_ref[$current]}"
    done

    output_ref="$current"
}

# ----------------------------------------------------------------------------
# PK5: 単一 packet ファイルの Plan Commit / Amendments ancestry 検査
# ----------------------------------------------------------------------------
check_plan_commit_ancestry() {
    local file="$1"
    local plan_commit plan_commit_full amendments amendment amendment_full first_value
    local effective_plan_commit effective_amendment rebase_line map_old map_new
    local map_old_full map_new_full mapped_old
    local old_patch_id new_patch_id
    local -a amendment_shas=()
    local -a amendment_full_shas=()
    local -a rebase_map_olds=()
    declare -A rebase_next=()
    declare -A rebase_previous=()
    declare -A rebase_roots=()
    declare -A rebase_used=()

    plan_commit="$(grep -m1 -E '^- Plan Commit:[[:space:]]*' "$file" 2>/dev/null \
        | sed -E 's/^- Plan Commit:[[:space:]]*//; s/[[:space:]]+$//')"

    # Plan Commit が pending（未確定）の packet は PK5 の対象外（plan-draft/plan-gate フェーズ）
    if [[ -z "$plan_commit" || "$plan_commit" == "pending" ]]; then
        return 0
    fi

    if ! plan_commit_full="$(git rev-parse --verify "${plan_commit}^{commit}" 2>/dev/null)"; then
        echo "❌ [workflow-git] PK5: $file の Plan Commit '$plan_commit' は解決できない SHA です"
        FAIL=1
        return 0
    fi
    rebase_roots["$plan_commit_full"]="Plan Commit '$plan_commit'"

    # Amendments の原 SHA は Plan Commit と同様に不変。各 SHA を Rebase Map の
    # 独立 root として扱うため、Map の検査前に解決しておく。
    amendments="$(grep -m1 -E '^- Amendments:[[:space:]]*' "$file" 2>/dev/null \
        | sed -E 's/^- Amendments:[[:space:]]*//; s/[[:space:]]+$//')"
    if [[ -n "$amendments" ]]; then
        while IFS= read -r amendment; do
            [[ -z "$amendment" ]] && continue
            amendment_shas+=("$amendment")
            if ! amendment_full="$(git rev-parse --verify "${amendment}^{commit}" 2>/dev/null)"; then
                echo "❌ [workflow-git] PK5: $file の Amendments SHA '$amendment' は解決できません"
                FAIL=1
                amendment_full_shas+=("")
                continue
            fi
            amendment_full_shas+=("$amendment_full")
            rebase_roots["$amendment_full"]="Amendments SHA '$amendment'"
            if ! git merge-base --is-ancestor "$plan_commit_full" "$amendment_full" 2>/dev/null; then
                echo "❌ [workflow-git] PK5: $file の Amendments SHA '$amendment' は Plan Commit '$plan_commit' の descendant ではありません"
                FAIL=1
            fi
        done < <(printf '%s' "$amendments" | grep -oE '[0-9a-f]{7,40}' || true)
    fi

    # D-055 Rebase Map: conflict-free rebase で書き換わった plan-first commit と
    # 各 gated Amendment commit を append-only に対応付ける。全 pair の単一 commit
    # patch-id 同値を検証し、root ごとの chain を後段で解決する。
    while IFS= read -r rebase_line; do
        [[ -n "$rebase_line" ]] || continue
        if [[ ! "$rebase_line" =~ ^Rebase[[:space:]]Map:[[:space:]]([0-9a-f]{7,40})[[:space:]]-\>[[:space:]]([0-9a-f]{7,40})[[:space:]]*$ ]]; then
            echo "❌ [workflow-git] PK5: $file の Rebase Map 形式が不正です -> $rebase_line"
            FAIL=1
            continue
        fi
        map_old="${BASH_REMATCH[1]}"
        map_new="${BASH_REMATCH[2]}"

        if ! map_old_full="$(git rev-parse --verify "${map_old}^{commit}" 2>/dev/null)" ||
            ! map_new_full="$(git rev-parse --verify "${map_new}^{commit}" 2>/dev/null)"; then
            echo "❌ [workflow-git] PK5: $file の Rebase Map SHA を解決できません -> $rebase_line"
            FAIL=1
            continue
        fi

        if [[ "$map_old_full" == "$map_new_full" ]]; then
            echo "❌ [workflow-git] PK5: $file の Rebase Map chain が自己循環しています -> $rebase_line"
            FAIL=1
            continue
        fi

        if [[ -n "${rebase_roots[$map_new_full]+x}" ]]; then
            echo "❌ [workflow-git] PK5: $file の Rebase Map chain が別 root '${rebase_roots[$map_new_full]}' へ接続しています -> $rebase_line"
            FAIL=1
            continue
        fi

        old_patch_id="$(git show --pretty=format: --binary "$map_old_full" 2>/dev/null | git patch-id --stable | awk '{print $1}')"
        new_patch_id="$(git show --pretty=format: --binary "$map_new_full" 2>/dev/null | git patch-id --stable | awk '{print $1}')"
        if [[ -z "$old_patch_id" || "$old_patch_id" != "$new_patch_id" ]]; then
            echo "❌ [workflow-git] PK5: $file の Rebase Map は patch-id が同値ではありません -> $rebase_line"
            FAIL=1
            continue
        fi

        if [[ -n "${rebase_next[$map_old_full]+x}" ]]; then
            echo "❌ [workflow-git] PK5: $file の Rebase Map chain で old SHA '$map_old' が重複しています -> $rebase_line"
            FAIL=1
            continue
        fi
        if [[ -n "${rebase_previous[$map_new_full]+x}" ]]; then
            echo "❌ [workflow-git] PK5: $file の Rebase Map chain で new SHA '$map_new' に複数の old SHA が接続しています -> $rebase_line"
            FAIL=1
            continue
        fi

        rebase_next["$map_old_full"]="$map_new_full"
        rebase_previous["$map_new_full"]="$map_old_full"
        rebase_map_olds+=("$map_old_full")
    done < <(grep -E '^Rebase[[:space:]]Map:' "$file" 2>/dev/null || true)

    effective_plan_commit="$plan_commit_full"
    resolve_rebase_chain "$plan_commit_full" "Plan Commit '$plan_commit'" "$file" \
        effective_plan_commit rebase_next rebase_used

    if ! git merge-base --is-ancestor "$effective_plan_commit" HEAD 2>/dev/null; then
        echo "❌ [workflow-git] PK5: $file の Plan Commit 実効 SHA '$effective_plan_commit' は現在の HEAD の祖先ではありません"
        FAIL=1
    fi

    local index
    for ((index = 0; index < ${#amendment_shas[@]}; index++)); do
        amendment="${amendment_shas[$index]}"
        amendment_full="${amendment_full_shas[$index]}"
        [[ -n "$amendment_full" ]] || continue

        effective_amendment="$amendment_full"
        resolve_rebase_chain "$amendment_full" "Amendments SHA '$amendment'" "$file" \
            effective_amendment rebase_next rebase_used

        if ! git merge-base --is-ancestor "$effective_plan_commit" "$effective_amendment" 2>/dev/null; then
            echo "❌ [workflow-git] PK5: $file の Amendments 実効 SHA '$effective_amendment' は Plan Commit 実効 SHA '$effective_plan_commit' の descendant ではありません"
            FAIL=1
        fi
        if ! git merge-base --is-ancestor "$effective_amendment" HEAD 2>/dev/null; then
            echo "❌ [workflow-git] PK5: $file の Amendments SHA '$amendment'（実効 SHA '$effective_amendment'）は現在の HEAD の祖先ではありません"
            FAIL=1
        fi
    done

    # Map は Plan Commit または Amendments のいずれかを root とする chain に
    # 全 edge が接続していなければならない。孤立 pair を escape hatch にしない。
    for mapped_old in "${rebase_map_olds[@]}"; do
        if [[ -z "${rebase_used[$mapped_old]+x}" ]]; then
            echo "❌ [workflow-git] PK5: $file の Rebase Map chain が Plan Commit / Amendments の root に接続していません（old SHA '$mapped_old'）"
            FAIL=1
        fi
    done

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
