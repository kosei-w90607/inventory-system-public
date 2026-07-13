#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

assert_contains() {
    local file="$1"
    local pattern="$2"
    grep -Fq -- "$pattern" "$file" || fail "$file does not contain: $pattern"
}

assert_not_contains() {
    local file="$1"
    local pattern="$2"
    if grep -Fq -- "$pattern" "$file"; then
        fail "$file unexpectedly contains: $pattern"
    fi
}

assert_last_contains() {
    local file="$1"
    local pattern="$2"
    tail -n 1 "$file" | grep -Fq -- "$pattern" ||
        fail "last line of $file does not contain: $pattern"
}

assert_before() {
    local file="$1"
    local first="$2"
    local second="$3"
    local first_line
    local second_line

    first_line="$(grep -nF -- "$first" "$file" | head -n 1 | cut -d: -f1)"
    second_line="$(grep -nF -- "$second" "$file" | head -n 1 | cut -d: -f1)"
    [[ -n "$first_line" && -n "$second_line" && "$first_line" -lt "$second_line" ]] ||
        fail "$file does not run '$first' before '$second'"
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"
bin="$tmp/bin"
mkdir -p "$repo/scripts/ci" "$repo/scripts/tests" "$repo/src-tauri/src" "$bin"
cp "$SOURCE_ROOT/scripts/pre-push.sh" "$repo/scripts/pre-push.sh"
cp "$SOURCE_ROOT/scripts/ci/classify-changes.sh" "$repo/scripts/ci/classify-changes.sh"
printf '#!/bin/bash\nexit 0\n' > "$repo/scripts/doc-consistency-check.sh"
printf '#!/bin/bash\nexit 0\n' > "$repo/scripts/check-env-safety.sh"
printf '#!/bin/bash\nexit "${FAKE_WORKFLOW_GIT_EXIT:-0}"\n' > "$repo/scripts/check-workflow-git.sh"

cat > "$bin/gh" <<'EOF'
#!/bin/bash
if [[ "${FAKE_GH_EXIT:-0}" != "0" ]]; then
    exit "$FAKE_GH_EXIT"
fi
head_branch=""
while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--head" && $# -ge 2 ]]; then
        head_branch="$2"
        shift 2
    else
        shift
    fi
done
if [[ -n "${FAKE_READY_HEAD:-}" && "$head_branch" == "$FAKE_READY_HEAD" ]]; then
    echo false
else
    printf '%s\n' "${FAKE_GH_DRAFT:-}"
fi
EOF

cat > "$bin/npm" <<'EOF'
#!/bin/bash
printf 'npm %s\n' "$*" >> "$CALL_LOG"
if [[ "${FAKE_NPM_FAIL_ON:-}" == "$*" ]]; then
    exit 23
fi
EOF

cat > "$bin/cargo" <<'EOF'
#!/bin/bash
printf 'cargo %s\n' "$*" >> "$CALL_LOG"
if [[ "${FAKE_CARGO_FAIL_ON:-}" == "$*" ]]; then
    exit 24
fi
EOF

chmod +x "$bin/gh" "$bin/npm" "$bin/cargo"
chmod +x "$repo/scripts/pre-push.sh" "$repo/scripts/ci/classify-changes.sh"
chmod +x "$repo/scripts/doc-consistency-check.sh" "$repo/scripts/check-env-safety.sh" "$repo/scripts/check-workflow-git.sh"

git -C "$repo" init -q
git -C "$repo" config user.name test
git -C "$repo" config user.email test@example.invalid
printf 'base\n' > "$repo/README.md"
git -C "$repo" add README.md
git -C "$repo" commit -qm base
git -C "$repo" branch -M main
base_sha="$(git -C "$repo" rev-parse HEAD)"
git -C "$repo" switch -qc feature
mkdir -p "$repo/src"
printf 'export {};\n' > "$repo/src/example.ts"
git -C "$repo" add src/example.ts
git -C "$repo" commit -qm frontend
head_sha="$(git -C "$repo" rev-parse HEAD)"

run_hook() {
    local draft="$1"
    local bypass="${2:-}"
    local remote_branch="${3:-feature}"
    local ready_head="${4:-}"
    local command_path="${5:-$bin:$PATH}"
    local log="$tmp/calls.log"
    : > "$log"
    (
        cd "$repo"
        printf 'refs/heads/feature %s refs/heads/%s %s\n' "$head_sha" "$remote_branch" "$base_sha" |
            PATH="$command_path" CALL_LOG="$log" FAKE_GH_DRAFT="$draft" \
            FAKE_GH_EXIT="${FAKE_GH_EXIT:-0}" \
            FAKE_NPM_FAIL_ON="${FAKE_NPM_FAIL_ON:-}" \
            FAKE_CARGO_FAIL_ON="${FAKE_CARGO_FAIL_ON:-}" \
            FAKE_WORKFLOW_GIT_EXIT="${FAKE_WORKFLOW_GIT_EXIT:-0}" \
            FAKE_READY_HEAD="$ready_head" \
            INVENTORY_PRE_PUSH_BYPASS_REASON="$bypass" \
            /bin/bash scripts/pre-push.sh origin https://github.com/example/repo.git
    )
}

run_hook true
assert_contains "$repo/.local/quality-check.log" "PASS "
grep -Fq "workflow-git" "$repo/.local/quality-check.log" || fail "workflow-git check did not run unconditionally"

FAKE_WORKFLOW_GIT_EXIT=9
if run_hook true; then
    fail "workflow-git (PK5/STATECAP) failure was swallowed"
fi
assert_last_contains "$repo/.local/quality-check.log" "FAIL workflow-git"
unset FAKE_WORKFLOW_GIT_EXIT

run_hook true
assert_contains "$tmp/calls.log" "npm run generate:routes"
assert_contains "$tmp/calls.log" "npm run typecheck"
assert_contains "$tmp/calls.log" "npm run lint"
assert_before "$tmp/calls.log" "npm run generate:routes" "npm run typecheck"
assert_before "$tmp/calls.log" "npm run generate:routes" "npm run lint"
if grep -Fq "npm test" "$tmp/calls.log"; then
    fail "pre-push must not run the frontend full suite"
fi

for failed_command in "run generate:routes" "run typecheck" "run lint"; do
    FAKE_NPM_FAIL_ON="$failed_command"
    if run_hook true; then
        fail "frontend command failure was swallowed: npm $failed_command"
    fi
    assert_last_contains "$repo/.local/quality-check.log" "FAIL frontend"
    case "$failed_command" in
        "run generate:routes")
            assert_not_contains "$tmp/calls.log" "npm run typecheck"
            assert_not_contains "$tmp/calls.log" "npm run lint"
            ;;
        "run typecheck")
            assert_not_contains "$tmp/calls.log" "npm run lint"
            ;;
    esac
done
unset FAKE_NPM_FAIL_ON

FAKE_GH_DRAFT=false
if run_hook false; then
    fail "Ready PR push was not blocked"
fi

if run_hook true "" ready-target ready-target; then
    fail "Ready target ref was not blocked when current branch was Draft"
fi

FAKE_GH_EXIT=4
if run_hook true; then
    fail "gh lookup failure did not block the push"
fi
unset FAKE_GH_EXIT
assert_last_contains "$repo/.local/quality-check.log" "FAIL ready-state-lookup"

bin_without_gh="$tmp/bin-without-gh"
mkdir -p "$bin_without_gh"
for command_name in git date mkdir; do
    ln -s "$(command -v "$command_name")" "$bin_without_gh/$command_name"
done
if run_hook true "" feature "" "$bin_without_gh"; then
    fail "missing gh did not block the push"
fi
assert_last_contains "$repo/.local/quality-check.log" "FAIL ready-state-lookup"

run_hook false owner-approved
assert_contains "$repo/.local/quality-check.log" "BYPASS owner-approved"
assert_contains "$repo/.local/quality-check.log" "$head_sha BYPASS owner-approved"

if run_hook false "free form"; then
    fail "free-form bypass reason was accepted"
fi
if grep -Fq "free form" "$repo/.local/quality-check.log"; then
    fail "free-form bypass text leaked into evidence"
fi

printf '#!/bin/bash\nexit 7\n' > "$repo/scripts/ci/classify-changes.sh"
if run_hook true; then
    fail "classifier failure was swallowed"
fi
assert_contains "$repo/.local/quality-check.log" "FAIL classifier"
cp "$SOURCE_ROOT/scripts/ci/classify-changes.sh" "$repo/scripts/ci/classify-changes.sh"
chmod +x "$repo/scripts/ci/classify-changes.sh"

git -C "$repo" switch -q main
git -C "$repo" switch -qc rust-only
printf 'pub fn example() {}\n' > "$repo/src-tauri/src/example.rs"
git -C "$repo" add src-tauri/src/example.rs
git -C "$repo" commit -qm rust
head_sha="$(git -C "$repo" rev-parse HEAD)"
for failed_command in "fmt --check" "clippy --all-targets --all-features -- -D warnings" "test"; do
    FAKE_CARGO_FAIL_ON="$failed_command"
    if run_hook true "" rust-only; then
        fail "Rust command failure was swallowed: cargo $failed_command"
    fi
    assert_last_contains "$repo/.local/quality-check.log" "FAIL rust"
    case "$failed_command" in
        "fmt --check")
            assert_not_contains "$tmp/calls.log" "cargo clippy"
            assert_not_contains "$tmp/calls.log" "cargo test"
            ;;
        "clippy --all-targets --all-features -- -D warnings")
            assert_not_contains "$tmp/calls.log" "cargo test"
            ;;
    esac
done
unset FAKE_CARGO_FAIL_ON

git -C "$repo" switch -q main
git -C "$repo" switch -qc docs-only
mkdir -p "$repo/docs"
printf 'docs\n' > "$repo/docs/example.md"
git -C "$repo" add docs/example.md
git -C "$repo" commit -qm docs
head_sha="$(git -C "$repo" rev-parse HEAD)"
: > "$tmp/calls.log"
run_hook true "" docs-only
if grep -Fq "npm " "$tmp/calls.log"; then
    fail "docs-only push ran frontend checks"
fi

grep -Fq 'classify-changes.sh' "$SOURCE_ROOT/scripts/pre-push.sh" || fail "pre-push does not call the shared classifier"

echo "PASS: pre-push"
