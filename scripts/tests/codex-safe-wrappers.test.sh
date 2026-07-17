#!/usr/bin/env bash
# SPEC-CODEX-SAFE-BOUNDARY-2026-07-18 C1-C7: clone routing and safe-read
# boundary regression tests (Test Design Matrix T1-T15).
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OLD_ROOT_PATTERN='Projects/inventory-system($|[^-])'

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

assert_success() {
    local label="$1"
    shift
    if ! "$@" >"$out" 2>"$err"; then
        echo "stdout:" >&2
        sed -n '1,20p' "$out" >&2
        echo "stderr:" >&2
        sed -n '1,20p' "$err" >&2
        fail "$label failed"
    fi
}

assert_rejected() {
    local label="$1"
    local expected="$2"
    shift 2
    if "$@" >"$out" 2>"$err"; then
        fail "$label was accepted"
    fi
    if [[ -n "$expected" ]] && ! grep -Fq -- "$expected" "$err"; then
        echo "stderr:" >&2
        sed -n '1,20p' "$err" >&2
        fail "$label did not report the expected rejection"
    fi
}

wrapper_sources=(
    "$SOURCE_ROOT/.codex/bin/read-safe-file.sh"
    "$SOURCE_ROOT/.codex/bin/search-safe-files.sh"
    "$SOURCE_ROOT/.codex/bin/list-safe-files.sh"
    "$SOURCE_ROOT/.codex/bin/codex-inventory"
    "$SOURCE_ROOT/.codex/bin/codex-inventory-bar"
)

# T9/C1 fail-fast guard: do not execute the pre-fix wrappers because their fixed
# root would read the history-view clone. This is also the RED assertion for the
# dynamic-root behavior.
if rg -n "$OLD_ROOT_PATTERN" "${wrapper_sources[@]}"; then
    fail "wrapper family still hard-codes the history-view clone"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fixture_repo="$tmp/fixture-repo"
outside_dir="$tmp/outside"
non_git_dir="$tmp/non-git"
out="$tmp/stdout"
err="$tmp/stderr"

mkdir -p \
    "$fixture_repo/.codex/bin" \
    "$fixture_repo/.codex/rules" \
    "$fixture_repo/.agents/skills/sample" \
    "$fixture_repo/.claude/skills/sample" \
    "$fixture_repo/.github/workflows" \
    "$fixture_repo/docs" \
    "$fixture_repo/src" \
    "$fixture_repo/src-tauri/src" \
    "$fixture_repo/src-tauri/tests" \
    "$fixture_repo/scripts" \
    "$outside_dir" \
    "$non_git_dir/.codex/bin"
git -C "$fixture_repo" init -q

cp "${wrapper_sources[@]}" "$fixture_repo/.codex/bin/"
chmod +x "$fixture_repo/.codex/bin/"*

printf 'fixture-marker\n' > "$fixture_repo/docs/guide.md"
printf 'fixture-marker\n' > "$fixture_repo/AGENTS.md"
printf 'fixture-marker\n' > "$fixture_repo/Plans.md"
printf 'fixture-marker\n' > "$fixture_repo/.codex/README.md"
printf 'fixture-marker\n' > "$fixture_repo/.codex/execpolicy.rules"
printf 'fixture-marker\n' > "$fixture_repo/.codex/rules/default.rules"
printf 'fixture-marker\n' > "$fixture_repo/.agents/skills/sample/SKILL.md"
printf 'fixture-marker\n' > "$fixture_repo/.claude/skills/sample/SKILL.md"
printf 'fixture-marker\n' > "$fixture_repo/src/sample.ts"
printf 'fixture-marker\n' > "$fixture_repo/src-tauri/src/sample.rs"
printf 'fixture-marker\n' > "$fixture_repo/src-tauri/tests/sample.rs"
printf 'fixture-marker\n' > "$fixture_repo/scripts/sample.sh"
printf 'fixture-marker\n' > "$fixture_repo/.github/workflows/sample.yml"
printf 'outside-marker\n' > "$outside_dir/outside.md"
ln -s "$outside_dir/outside.md" "$fixture_repo/docs/outside.md"

read_wrapper="$fixture_repo/.codex/bin/read-safe-file.sh"
search_wrapper="$fixture_repo/.codex/bin/search-safe-files.sh"
list_wrapper="$fixture_repo/.codex/bin/list-safe-files.sh"
launcher="$fixture_repo/.codex/bin/codex-inventory"
bar="$fixture_repo/.codex/bin/codex-inventory-bar"

# T1-T3: traversal is rejected by all three wrappers.
assert_rejected "T1 search traversal" "refusing path outside repository" \
    "$search_wrapper" '^name:' 'docs/../../../.claude/skills'
assert_rejected "T2 list traversal" "refusing path outside repository" \
    "$list_wrapper" 'docs/../../../'
assert_rejected "T3 read traversal" "refusing path outside repository" \
    "$read_wrapper" 'docs/../../../.claude/skills/sample/SKILL.md'

# T4: allowlisted relative paths and default search/list inputs remain usable.
assert_success "T4 read allowlisted file" "$read_wrapper" docs/guide.md
grep -Fq 'fixture-marker' "$out" || fail "T4 read output missing fixture marker"
assert_success "T4 search allowlisted file" "$search_wrapper" fixture-marker docs
grep -Fq 'docs/guide.md' "$out" || fail "T4 search output missing allowlisted file"
assert_success "T4 list allowlisted directory" "$list_wrapper" docs
grep -Fq 'docs/guide.md' "$out" || fail "T4 list output missing allowlisted file"
assert_success "T4 default search inputs" "$search_wrapper" fixture-marker
grep -Fq 'docs/guide.md' "$out" || fail "T4 default search omitted docs"
assert_success "T4 default list inputs" "$list_wrapper"
grep -Fq 'docs/guide.md' "$out" || fail "T4 default list omitted docs"

# T5: absolute paths are never accepted as allowlist spellings.
for wrapper in "$read_wrapper" "$list_wrapper"; do
    assert_rejected "T5 root-in absolute path ($wrapper)" "refusing absolute path" \
        "$wrapper" "$fixture_repo/docs/guide.md"
    assert_rejected "T5 root-out absolute path ($wrapper)" "refusing absolute path" \
        "$wrapper" "$outside_dir/outside.md"
done
assert_rejected "T5 search root-in absolute path" "refusing absolute path" \
    "$search_wrapper" fixture-marker "$fixture_repo/docs/guide.md"
assert_rejected "T5 search root-out absolute path" "refusing absolute path" \
    "$search_wrapper" outside-marker "$outside_dir/outside.md"

# T6: an allowlisted symlink cannot escape the repository.
assert_rejected "T6 read symlink escape" "refusing path outside repository" \
    "$read_wrapper" docs/outside.md
assert_rejected "T6 search symlink escape" "refusing path outside repository" \
    "$search_wrapper" outside-marker docs/outside.md
assert_rejected "T6 list symlink escape" "refusing path outside repository" \
    "$list_wrapper" docs/outside.md

# T7: representative env/auth/secret/token canonical paths remain rejected.
sensitive_paths=(docs/.env docs/auth.json docs/client_secret.txt docs/api_token.md)
for sensitive_path in "${sensitive_paths[@]}"; do
    printf 'synthetic-sensitive-marker\n' > "$fixture_repo/$sensitive_path"
    assert_rejected "T7 read sensitive ($sensitive_path)" "refusing sensitive path" \
        "$read_wrapper" "$sensitive_path"
    assert_rejected "T7 search sensitive ($sensitive_path)" "refusing sensitive path" \
        "$search_wrapper" synthetic-sensitive-marker "$sensitive_path"
    assert_rejected "T7 list sensitive ($sensitive_path)" "refusing sensitive path" \
        "$list_wrapper" "$sensitive_path"
done

# T8: option-like path arguments remain rejected.
assert_rejected "T8 read option-like" "refusing option-like path" "$read_wrapper" -x
assert_rejected "T8 search option-like" "refusing option-like path" \
    "$search_wrapper" fixture-marker --foo
assert_rejected "T8 list option-like" "refusing option-like path" "$list_wrapper" --foo

# T9-T10: all fixture copies resolve their owning repo; launchers expose the
# result through dry-run/debug exits and preserve the explicit override.
assert_success "T9 fixture read root" "$read_wrapper" docs/guide.md
assert_success "T9 fixture search root" "$search_wrapper" fixture-marker docs/guide.md
assert_success "T9 fixture list root" "$list_wrapper" docs/guide.md
assert_success "T10 launcher default root" env -u CODEX_INVENTORY_REPO "$launcher" --debug
grep -Fq "repo: $fixture_repo" "$out" || fail "T10 launcher did not resolve fixture root"
assert_success "T10 bar default root" env -u CODEX_INVENTORY_REPO "$bar" --debug
grep -Fq "repo: $fixture_repo" "$out" || fail "T10 bar did not resolve fixture root"
assert_success "T10 launcher override" env CODEX_INVENTORY_REPO="$outside_dir" "$launcher" --debug
grep -Fq "repo: $outside_dir" "$out" || fail "T10 launcher ignored override"
assert_success "T10 bar override" env CODEX_INVENTORY_REPO="$outside_dir" "$bar" --debug
grep -Fq "repo: $outside_dir" "$out" || fail "T10 bar ignored override"

assert_success "T9 public read root" \
    "$SOURCE_ROOT/.codex/bin/read-safe-file.sh" \
    docs/plans/2026-07-18-codex-clone-routing-and-safe-read-boundary.md
grep -Fq 'Plan Packet' "$out" || fail "T9 public read wrapper did not use public repo"
assert_success "T9 public launcher root" env -u CODEX_INVENTORY_REPO \
    "$SOURCE_ROOT/.codex/bin/codex-inventory" --debug
grep -Fq "repo: $SOURCE_ROOT" "$out" || fail "T9 public launcher did not resolve public repo"
assert_success "T9 public bar root" env -u CODEX_INVENTORY_REPO \
    "$SOURCE_ROOT/.codex/bin/codex-inventory-bar" --debug
grep -Fq "repo: $SOURCE_ROOT" "$out" || fail "T9 public bar did not resolve public repo"

# T11: execpolicy mirrors are identical and contain no history-view path token.
cmp "$SOURCE_ROOT/.codex/execpolicy.rules" "$SOURCE_ROOT/.codex/rules/default.rules" ||
    fail "T11 execpolicy mirrors differ"
if rg -n "$OLD_ROOT_PATTERN" \
    "$SOURCE_ROOT/.codex/execpolicy.rules" \
    "$SOURCE_ROOT/.codex/rules/default.rules"; then
    fail "T11 execpolicy still contains history-view path tokens"
fi

# T12-T13: live B-group docs/hooks use the public path/namespace. The setup
# checklist scan is intentionally limited to its live sections so A-group
# historical lines remain untouched.
live_files=(
    "$SOURCE_ROOT/AGENTS.md"
    "$SOURCE_ROOT/.codex/README.md"
    "$SOURCE_ROOT/docs/TOOLING_SKILL_COMMANDS.md"
    "$SOURCE_ROOT/.claude/commands/plan-rally.md"
    "$SOURCE_ROOT/.claude/hooks/check-plan-on-exit.sh"
    "$SOURCE_ROOT/.claude/hooks/memory-capture-feedback.sh"
    "$SOURCE_ROOT/.claude/hooks/memory-precompact-scan.sh"
    "$SOURCE_ROOT/.claude/hooks/audit-trigger-phase.sh"
    "$SOURCE_ROOT/.claude/hooks/audit-trigger-plan.sh"
    "$SOURCE_ROOT/.claude/hooks/audit-safety-net.sh"
    "$SOURCE_ROOT/CLAUDE.md"
)
if rg -n "$OLD_ROOT_PATTERN" "${live_files[@]}"; then
    fail "T12 live B-group file still references the history-view clone"
fi
if sed -n '130,160p;236,244p' "$SOURCE_ROOT/docs/DEV_SETUP_CHECKLIST.md" |
    rg -n "$OLD_ROOT_PATTERN"; then
    fail "T12 live DEV_SETUP sections still reference the history-view clone"
fi
public_namespace='-home-kosei-Projects-inventory-system-public'
grep -Fq -- "$public_namespace" "$SOURCE_ROOT/.claude/hooks/memory-capture-feedback.sh" ||
    fail "T13 memory hook does not use public namespace"
grep -Fq -- "/tmp/claude-1000/$public_namespace" "$SOURCE_ROOT/.claude/hooks/check-plan-on-exit.sh" ||
    fail "T13 plan hook does not use public log namespace"

# T14: canonical relative path, not the symlink alias spelling, controls the
# sensitive-path decision.
ln -s api_token.md "$fixture_repo/docs/README.md"
assert_rejected "T14 read sensitive symlink alias" "refusing sensitive path" \
    "$read_wrapper" docs/README.md
assert_rejected "T14 search sensitive symlink alias" "refusing sensitive path" \
    "$search_wrapper" synthetic-sensitive-marker docs/README.md
assert_rejected "T14 list sensitive symlink alias" "refusing sensitive path" \
    "$list_wrapper" docs/README.md

# T15: canonicalization and git-root failures take explicit fail-closed paths.
ln -s loop-b "$fixture_repo/docs/loop-a"
ln -s loop-a "$fixture_repo/docs/loop-b"
for wrapper in "$read_wrapper" "$list_wrapper"; do
    assert_rejected "T15 canonicalization failure ($wrapper)" "cannot canonicalize path" \
        "$wrapper" docs/loop-a
done
assert_rejected "T15 search canonicalization failure" "cannot canonicalize path" \
    "$search_wrapper" fixture-marker docs/loop-a

for source in "${wrapper_sources[@]}"; do
    cp "$source" "$non_git_dir/.codex/bin/"
done
chmod +x "$non_git_dir/.codex/bin/"*
assert_rejected "T15 read root resolution failure" "cannot resolve repository root" \
    "$non_git_dir/.codex/bin/read-safe-file.sh" docs/guide.md
assert_rejected "T15 search root resolution failure" "cannot resolve repository root" \
    "$non_git_dir/.codex/bin/search-safe-files.sh" fixture-marker docs
assert_rejected "T15 list root resolution failure" "cannot resolve repository root" \
    "$non_git_dir/.codex/bin/list-safe-files.sh" docs
assert_rejected "T15 launcher root resolution failure" "cannot resolve repository root" \
    env -u CODEX_INVENTORY_REPO "$non_git_dir/.codex/bin/codex-inventory" --debug
assert_rejected "T15 bar root resolution failure" "cannot resolve repository root" \
    env -u CODEX_INVENTORY_REPO "$non_git_dir/.codex/bin/codex-inventory-bar" --debug

echo "PASS: codex-safe-wrappers (T1-T15)"
