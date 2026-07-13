#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL_CI="$SOURCE_ROOT/scripts/local-ci.sh"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

[[ -x "$LOCAL_CI" ]] || fail "local-ci.sh is missing or not executable"
grep -Fq 'run_required frontend-install "$REPO_ROOT" npm ci' "$LOCAL_CI" || fail "full mode does not run npm ci"
if grep -Fq 'bash -n "${shell_files[@]}"' "$LOCAL_CI"; then
    fail "shell syntax gate passes multiple files as bash positional arguments"
fi
grep -Fq 'for shell_file in "${shell_files[@]}"' "$LOCAL_CI" || fail "shell syntax gate does not inspect each file"

if "$LOCAL_CI" invalid > /tmp/local-ci-invalid.out 2>&1; then
    fail "invalid mode exited zero"
fi
grep -Fq "usage:" /tmp/local-ci-invalid.out || fail "invalid mode did not print usage"
rm -f /tmp/local-ci-invalid.out

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"
mkdir -p "$repo/scripts/ci" "$repo/scripts/tests" "$repo/docs"
cp "$SOURCE_ROOT/scripts/local-ci.sh" "$repo/scripts/local-ci.sh"
cp "$SOURCE_ROOT/scripts/ci/classify-changes.sh" "$repo/scripts/ci/classify-changes.sh"
cat > "$repo/scripts/doc-consistency-check.sh" <<'EOF'
#!/bin/bash
echo "doc-check"
if [[ "${DOC_CHECK_MUTATE:-0}" == "1" ]]; then
    echo "gate mutation" >> README.md
fi
exit "${DOC_CHECK_EXIT:-0}"
EOF
printf '#!/bin/bash\necho "workflow-git-check"\nexit "${WORKFLOW_GIT_CHECK_EXIT:-0}"\n' > "$repo/scripts/check-workflow-git.sh"
printf '.local/\n' > "$repo/.gitignore"
chmod +x "$repo/scripts/local-ci.sh" "$repo/scripts/ci/classify-changes.sh" "$repo/scripts/doc-consistency-check.sh" "$repo/scripts/check-workflow-git.sh"

git -C "$repo" init -q
git -C "$repo" config user.name test
git -C "$repo" config user.email test@example.invalid
printf 'base\n' > "$repo/README.md"
git -C "$repo" add README.md .gitignore scripts
git -C "$repo" commit -qm base
git -C "$repo" branch -M main
base_sha="$(git -C "$repo" rev-parse HEAD)"
git -C "$repo" update-ref refs/remotes/origin/main "$base_sha"
git -C "$repo" switch -qc feature
printf 'docs\n' > "$repo/docs/example.md"
git -C "$repo" add docs/example.md
git -C "$repo" commit -qm docs
head_sha="$(git -C "$repo" rev-parse HEAD)"

(
    cd "$repo"
    bash scripts/local-ci.sh changed
)

clean_log="$(find "$repo/.local/ci-evidence" -type f -name "*${head_sha}*" | head -1)"
[[ -n "$clean_log" ]] || fail "CLEAN evidence file with HEAD SHA not found"
grep -Fq "HEAD_SHA=$head_sha" "$clean_log" || fail "HEAD SHA missing from evidence body"
grep -Fq "MODE=changed" "$clean_log" || fail "mode missing from evidence"
grep -Fq "TREE_STATE=CLEAN" "$clean_log" || fail "CLEAN marker missing"
grep -Fq "GATE=docs" "$clean_log" || fail "docs gate missing"
grep -Fq "GATE=workflow-git" "$clean_log" || fail "workflow-git gate missing (must run unconditionally like docs)"
grep -Fq "RESULT=PASS" "$clean_log" || fail "PASS result missing"

printf 'dirty\n' > "$repo/untracked.txt"
(
    cd "$repo"
    bash scripts/local-ci.sh changed
)
dirty_log="$(find "$repo/.local/ci-evidence" -type f -name "*${head_sha}*" | sort | tail -1)"
grep -Fq "TREE_STATE=DIRTY" "$dirty_log" || fail "DIRTY marker missing"
rm "$repo/untracked.txt"

if (
    cd "$repo"
    DOC_CHECK_MUTATE=1 bash scripts/local-ci.sh changed
); then
    fail "gate-created dirty state was accepted"
fi
mutated_log="$(find "$repo/.local/ci-evidence" -type f -name "*${head_sha}*" | sort | tail -1)"
grep -Eq '^END_TREE_STATE=DIRTY$' "$mutated_log" || fail "end DIRTY state missing"
grep -Eq '^RESULT=FAIL$' "$mutated_log" || fail "dirty mutation was not failed"
git -C "$repo" restore README.md

if (
    cd "$repo"
    DOC_CHECK_EXIT=9 bash scripts/local-ci.sh changed
); then
    fail "failed gate exited zero"
fi
failed_log="$(find "$repo/.local/ci-evidence" -type f -name "*${head_sha}*" | sort | tail -1)"
grep -Fq "RESULT=FAIL" "$failed_log" || fail "FAIL result missing"
grep -Eq '^EXIT_CODE=9$' "$failed_log" || fail "final gate exit code was not preserved"

if (
    cd "$repo"
    WORKFLOW_GIT_CHECK_EXIT=7 bash scripts/local-ci.sh changed
); then
    fail "workflow-git (PK5/STATECAP) gate failure was swallowed"
fi
workflow_git_failed_log="$(find "$repo/.local/ci-evidence" -type f -name "*${head_sha}*" | sort | tail -1)"
grep -Fq "GATE=workflow-git" "$workflow_git_failed_log" || fail "workflow-git gate missing from failure evidence"
grep -Fq "RESULT=FAIL" "$workflow_git_failed_log" || fail "workflow-git failure did not fail the run"
grep -Eq '^EXIT_CODE=7$' "$workflow_git_failed_log" || fail "workflow-git gate exit code was not preserved"

echo "PASS: local-ci"
