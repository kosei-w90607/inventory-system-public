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
    if [[ -s "$out" ]]; then
        echo "stdout:" >&2
        sed -n '1,20p' "$out" >&2
        fail "$label emitted output before rejecting the input"
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
    "$fixture_repo/.github" \
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
printf 'fixture-marker\n' > "$fixture_repo/.codex/bin/fixture-marker.txt"
printf 'fixture-marker\n' > "$fixture_repo/.agents/skills/sample/SKILL.md"
printf 'fixture-marker\n' > "$fixture_repo/.claude/skills/sample/SKILL.md"
printf 'fixture-marker\n' > "$fixture_repo/src/sample.ts"
printf 'fixture-marker\n' > "$fixture_repo/src-tauri/src/sample.rs"
printf 'fixture-marker\n' > "$fixture_repo/src-tauri/tests/sample.rs"
printf 'fixture-marker\n' > "$fixture_repo/scripts/sample.sh"
printf 'fixture-marker\n' > "$fixture_repo/.github/workflows/sample.yml"
printf 'not-allowlisted-marker\n' > "$fixture_repo/.github/not-allowlisted.md"
printf 'directory-scan-marker\n' > "$fixture_repo/docs/visible.md"
printf 'directory-scan-marker\n' > "$fixture_repo/docs/hidden_secret.md"
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
default_files=(
    docs/guide.md
    src/sample.ts
    src-tauri/src/sample.rs
    src-tauri/tests/sample.rs
    scripts/sample.sh
    .github/workflows/sample.yml
    .codex/README.md
    .codex/execpolicy.rules
    .codex/rules/default.rules
    .codex/bin/fixture-marker.txt
    .agents/skills/sample/SKILL.md
    .claude/skills/sample/SKILL.md
    AGENTS.md
    Plans.md
)
for expected_file in "${default_files[@]}"; do
    grep -Fq -- "$expected_file:" "$out" ||
        fail "T4 default search omitted $expected_file"
done
assert_success "T4 default list inputs" "$list_wrapper"
for expected_file in "${default_files[@]}"; do
    grep -Fxq -- "$expected_file" "$out" ||
        fail "T4 default list omitted $expected_file"
done

# T4/C2: canonical root containment is not enough; the final allowlist must
# reject root-contained paths outside the approved path families.
assert_rejected "T4 read root-contained non-allowlisted path" "safe-read allowlist" \
    "$read_wrapper" .github/not-allowlisted.md
assert_rejected "T4 search root-contained non-allowlisted path" "safe-search allowlist" \
    "$search_wrapper" not-allowlisted-marker .github/not-allowlisted.md
assert_rejected "T4 list root-contained non-allowlisted path" "safe-list allowlist" \
    "$list_wrapper" .github/not-allowlisted.md

# T4/C6: directory and default traversal must filter sensitive descendants,
# not only reject a sensitive path when it is passed directly.
assert_success "T4 search directory with sensitive descendant" \
    "$search_wrapper" directory-scan-marker docs
grep -Fq 'docs/visible.md:' "$out" || fail "T4 search omitted visible descendant"
if grep -Fq 'docs/hidden_secret.md:' "$out"; then
    fail "T4 search exposed a sensitive descendant"
fi
assert_success "T4 list directory with sensitive descendant" "$list_wrapper" docs
if grep -Fxq 'docs/hidden_secret.md' "$out"; then
    fail "T4 list exposed a sensitive descendant"
fi
assert_success "T4 default search filters sensitive descendants" \
    "$search_wrapper" directory-scan-marker
if grep -Fq 'docs/hidden_secret.md:' "$out"; then
    fail "T4 default search exposed a sensitive descendant"
fi
assert_success "T4 default list filters sensitive descendants" "$list_wrapper"
if grep -Fxq 'docs/hidden_secret.md' "$out"; then
    fail "T4 default list exposed a sensitive descendant"
fi

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

# C2 audit regression: CR/LF in a path argument must be rejected before
# canonicalization so diagnostics and path output cannot be split across lines.
lf_path=$'docs/line\nbreak.md'
cr_path=$'docs/carriage\rreturn.md'
printf 'control-character-marker\n' > "$fixture_repo/$lf_path"
printf 'control-character-marker\n' > "$fixture_repo/$cr_path"
for control_path in "$lf_path" "$cr_path"; do
    assert_rejected "C2 read CR/LF path" "refusing path containing CR or LF" \
        "$read_wrapper" "$control_path"
    assert_rejected "C2 search CR/LF path" "refusing path containing CR or LF" \
        "$search_wrapper" control-character-marker "$control_path"
    assert_rejected "C2 list CR/LF path" "refusing path containing CR or LF" \
        "$list_wrapper" "$control_path"
done

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
    docs/archive/plans/2026-07-18-codex-clone-routing-and-safe-read-boundary.md
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
old_namespace_pattern='-home-kosei-Projects-inventory-system($|[^-])'
if rg -n -- "$old_namespace_pattern" "${live_files[@]}"; then
    fail "T12 live B-group file still contains the history-view encoded namespace"
fi
namespace_files=(
    "$SOURCE_ROOT/.claude/hooks/check-plan-on-exit.sh"
    "$SOURCE_ROOT/.claude/hooks/memory-capture-feedback.sh"
    "$SOURCE_ROOT/.claude/hooks/memory-precompact-scan.sh"
    "$SOURCE_ROOT/.claude/hooks/audit-trigger-phase.sh"
    "$SOURCE_ROOT/.claude/hooks/audit-trigger-plan.sh"
    "$SOURCE_ROOT/.claude/hooks/audit-safety-net.sh"
    "$SOURCE_ROOT/CLAUDE.md"
)
for namespace_file in "${namespace_files[@]}"; do
    grep -Fq -- "$public_namespace" "$namespace_file" ||
        fail "T13 public namespace missing from $namespace_file"
done
live_setup_sections="$(sed -n '130,160p;236,244p' "$SOURCE_ROOT/docs/DEV_SETUP_CHECKLIST.md")"
if printf '%s\n' "$live_setup_sections" | rg -n -- "$old_namespace_pattern"; then
    fail "T12 live DEV_SETUP sections contain the history-view encoded namespace"
fi
printf '%s\n' "$live_setup_sections" | grep -Fq -- "$public_namespace" ||
    fail "T13 live DEV_SETUP sections do not use the public namespace"

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
