#!/usr/bin/env bash
# D-059 / SPEC-HOOK-01 / CH1-CH11: Claude project hook inventory audit.
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HARNESS_KEY="claude-code-harness@claude-code-harness-marketplace"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

validate_inventory() {
    local root="$1"
    local settings="$root/.claude/settings.json"
    local hook_dir="$root/.claude/hooks"

    jq -e '(.hooks // {}) == {}' "$settings" >/dev/null ||
        return 1
    jq -e --arg key "$HARNESS_KEY" '.enabledPlugins[$key] == false' "$settings" >/dev/null ||
        return 1

    if [[ -d "$hook_dir" ]] && find "$hook_dir" -type f -print -quit | grep -q .; then
        return 1
    fi
}

validate_live_docs() {
    local root="$1"
    local live_files=(
        "$root/CLAUDE.md"
        "$root/docs/AGENT_OPERATING_MANUAL.md"
        "$root/docs/DEV_SETUP_CHECKLIST.md"
        "$root/docs/TOOLING_SKILL_COMMANDS.md"
        "$root/docs/Plans.md"
        "$root/.claude/commands/plan-rally.md"
    )
    local forbidden_patterns=(
        'Claude 固有の `ExitPlanMode` hook'
        'Claude 側 hook（ExitPlanMode チェック等）の機械強制'
        'project 側 `.claude/settings.json` に `SessionStart` hook がある'
        '設定上は有効のまま残っている'
        'hook pass'
        'hook deny'
        'D-1 check'
        'ExitPlanMode 前'
    )
    local pattern

    for pattern in "${forbidden_patterns[@]}"; do
        if rg -Fq -- "$pattern" "${live_files[@]}"; then
            return 1
        fi
    done
}

validate_canonical_gates() {
    local root="$1"

    grep -Fq 'bash "$REPO_ROOT/scripts/doc-consistency-check.sh"' \
        "$root/scripts/pre-push.sh" || return 1
    grep -Fq 'run_required docs "$REPO_ROOT" bash scripts/doc-consistency-check.sh' \
        "$root/scripts/local-ci.sh" || return 1
    grep -Fq 'run: bash scripts/doc-consistency-check.sh' \
        "$root/.github/workflows/ci.yml" || return 1
}

validate_audit_wiring() {
    local root="$1"

    grep -Fq 'run_required claude-hook-audit "$REPO_ROOT" bash scripts/tests/claude-hooks.test.sh' \
        "$root/scripts/local-ci.sh" || return 1
    grep -Fq 'run: bash scripts/tests/claude-hooks.test.sh' \
        "$root/.github/workflows/ci.yml" || return 1
    grep -Fq '.claude/settings.json|.claude/hooks/*|.claude/commands/*)' \
        "$root/scripts/ci/classify-changes.sh" || return 1
}

validate_repo_ignore() {
    local root="$1"
    local ignored_by

    ignored_by="$(git -C "$root" check-ignore -v .claude/settings.local.json 2>/dev/null)" ||
        return 1
    [[ "$ignored_by" == .gitignore:* ]]
}

validate_contract() {
    local root="$1"

    validate_inventory "$root" &&
        validate_live_docs "$root" &&
        validate_canonical_gates "$root" &&
        validate_audit_wiring "$root" &&
        validate_repo_ignore "$root"
}

validate_source_binding() {
    local script="$1"
    local source_prefix='$SOURCE'
    local source_suffix='_ROOT'
    local invocation

    invocation="validate_contract \"${source_prefix}${source_suffix}\""
    [[ "$(grep -Fc -- "$invocation" "$script")" == "1" ]]
}

expect_rejected() {
    local label="$1"
    local root="$2"

    if validate_contract "$root"; then
        fail "$label mutant was accepted"
    fi
}

validate_source_binding "$SOURCE_ROOT/scripts/tests/claude-hooks.test.sh" ||
    fail "CH10 source-direct validation binding is missing or ambiguous"
validate_contract "$SOURCE_ROOT" ||
    fail "live Claude hook contract is not the D-059 zero-hook inventory"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

make_fixture() {
    local source="$1"
    local fixture="$2"

    mkdir -p \
        "$fixture/.claude/commands" \
        "$fixture/.claude/hooks" \
        "$fixture/.github/workflows" \
        "$fixture/docs" \
        "$fixture/scripts/ci"
    cp "$source/.claude/settings.json" "$fixture/.claude/settings.json"
    cp "$source/.claude/commands/plan-rally.md" "$fixture/.claude/commands/plan-rally.md"
    cp "$source/.github/workflows/ci.yml" "$fixture/.github/workflows/ci.yml"
    cp "$source/docs/AGENT_OPERATING_MANUAL.md" "$fixture/docs/AGENT_OPERATING_MANUAL.md"
    cp "$source/docs/DEV_SETUP_CHECKLIST.md" "$fixture/docs/DEV_SETUP_CHECKLIST.md"
    cp "$source/docs/TOOLING_SKILL_COMMANDS.md" "$fixture/docs/TOOLING_SKILL_COMMANDS.md"
    cp "$source/docs/Plans.md" "$fixture/docs/Plans.md"
    cp "$source/scripts/ci/classify-changes.sh" "$fixture/scripts/ci/classify-changes.sh"
    cp "$source/scripts/local-ci.sh" "$fixture/scripts/local-ci.sh"
    cp "$source/scripts/pre-push.sh" "$fixture/scripts/pre-push.sh"
    cp "$source/CLAUDE.md" "$fixture/CLAUDE.md"
    cp "$source/.gitignore" "$fixture/.gitignore"
    if [[ -d "$source/.claude/hooks" ]]; then
        cp -a "$source/.claude/hooks/." "$fixture/.claude/hooks/"
    fi
    git -C "$fixture" init -q
}

fixture="$tmp/base"
make_fixture "$SOURCE_ROOT" "$fixture"
validate_contract "$fixture" || fail "unmodified contract fixture is not green"

source_hook_mutant="$tmp/source-hook-mutant"
cp -a "$fixture" "$source_hook_mutant"
printf '%s\n' '#!/usr/bin/env bash' > "$source_hook_mutant/.claude/hooks/stray.sh"
propagated_hook_fixture="$tmp/propagated-hook-fixture"
make_fixture "$source_hook_mutant" "$propagated_hook_fixture"
[[ -f "$propagated_hook_fixture/.claude/settings.json" ]] ||
    fail "CH10 source-derived hook fixture was not constructed"
expect_rejected "CH10 source hook propagation" "$propagated_hook_fixture"

hook_mutant="$tmp/hook-mutant"
cp -a "$fixture" "$hook_mutant"
jq '.hooks = {"PreToolUse":[{"matcher":"ExitPlanMode","hooks":[{"type":"command","command":"false"}]}]}' \
    "$fixture/.claude/settings.json" > "$hook_mutant/.claude/settings.json"
expect_rejected "CH1 extra hook" "$hook_mutant"

plugin_mutant="$tmp/plugin-mutant"
cp -a "$fixture" "$plugin_mutant"
jq --arg key "$HARNESS_KEY" '.enabledPlugins[$key] = true' \
    "$fixture/.claude/settings.json" > "$plugin_mutant/.claude/settings.json"
expect_rejected "CH2 harness true" "$plugin_mutant"

script_mutant="$tmp/script-mutant"
cp -a "$fixture" "$script_mutant"
printf '%s\n' '#!/usr/bin/env bash' > "$script_mutant/.claude/hooks/check-plan-on-exit.sh"
expect_rejected "CH3 retired script" "$script_mutant"

claim_mutant="$tmp/claim-mutant"
cp -a "$fixture" "$claim_mutant"
printf '%s\n' 'Claude 固有の `ExitPlanMode` hook' >> "$claim_mutant/CLAUDE.md"
expect_rejected "CH4 active hook claim" "$claim_mutant"

plans_claim_mutant="$tmp/plans-claim-mutant"
cp -a "$fixture" "$plans_claim_mutant"
printf '%s\n' 'Claude 固有の `ExitPlanMode` hook' >> "$plans_claim_mutant/docs/Plans.md"
expect_rejected "CH4 Plans backlog claim" "$plans_claim_mutant"

gate_mutant="$tmp/gate-mutant"
cp -a "$fixture" "$gate_mutant"
sed -i '\|bash "$REPO_ROOT/scripts/doc-consistency-check.sh"|d' \
    "$gate_mutant/scripts/pre-push.sh"
expect_rejected "CH5 canonical gate wiring" "$gate_mutant"

audit_mutant="$tmp/audit-mutant"
cp -a "$fixture" "$audit_mutant"
sed -i '/run_required claude-hook-audit/d' "$audit_mutant/scripts/local-ci.sh"
expect_rejected "CH7 local audit wiring" "$audit_mutant"

ignore_mutant="$tmp/ignore-mutant"
cp -a "$fixture" "$ignore_mutant"
sed -i '\|^\*\*/\.claude/settings\.local\.json$|d' "$ignore_mutant/.gitignore"
expect_rejected "CH11 repository ignore" "$ignore_mutant"

echo "PASS: Claude hook zero-inventory contract"
