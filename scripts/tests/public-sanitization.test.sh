#!/usr/bin/env bash
# TDS-PUB-A-04: candidate commit privacy scanner regression tests.
# All fixtures are synthetic and are created outside the repository tree.
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECKER="$SOURCE_ROOT/scripts/check-public-candidate.sh"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"
manifest="$tmp/local-manifest"
out="$tmp/check.out"
err="$tmp/check.err"

mkdir -p "$repo"
git -C "$repo" init -q
git -C "$repo" config user.name fixture
git -C "$repo" config user.email fixture@example.invalid

printf 'public baseline\n' > "$repo/public.txt"
git -C "$repo" add public.txt
git -C "$repo" commit -qm baseline
clean_sha="$(git -C "$repo" rev-parse HEAD)"

printf 'DUMMY-CANARY-ALPHA\tDUMMY-CANARY-BETA\n' > "$manifest"

run_check() {
    (
        cd "$repo"
        bash "$CHECKER" --candidate "$1" --manifest "$2"
    ) > "$out" 2> "$err"
}

assert_private_output() {
    if grep -Fq 'DUMMY-CANARY-' "$out" || grep -Fq 'DUMMY-CANARY-' "$err"; then
        fail "checker echoed a manifest literal"
    fi
    if grep -Fq "$manifest" "$out" || grep -Fq "$manifest" "$err"; then
        fail "checker echoed the manifest path"
    fi
    if grep -Fq "$repo/candidate-link" "$out" || grep -Fq "$repo/candidate-link" "$err"; then
        fail "checker echoed the candidate symlink path"
    fi
    if grep -Fq "$tmp" "$out" || grep -Fq "$tmp" "$err"; then
        fail "checker echoed a local fixture path"
    fi
}

if run_check "$clean_sha" "$tmp/missing-manifest"; then
    fail "missing manifest was accepted"
fi
assert_private_output

: > "$tmp/empty-manifest"
if run_check "$clean_sha" "$tmp/empty-manifest"; then
    fail "empty manifest was accepted"
fi
assert_private_output

if run_check not-a-commit "$manifest"; then
    fail "invalid candidate SHA was accepted"
fi
assert_private_output

printf 'DUMMY-CANARY-ALPHA\tDUMMY-CANARY-BETA\r\n' > "$tmp/crlf-manifest"
run_check "$clean_sha" "$tmp/crlf-manifest" || fail "clean CRLF manifest was rejected"
grep -Fq '0 findings' "$out" || fail "clean CRLF manifest did not report status-only success"
assert_private_output

printf 'DUMMY-CANARY-ALPHA\rEMBEDDED\tDUMMY-CANARY-BETA\r\n' > "$tmp/embedded-cr-manifest"
if run_check "$clean_sha" "$tmp/embedded-cr-manifest"; then
    fail "embedded CR manifest was accepted"
fi
assert_private_output

printf 'DUMMY-CANARY-ALPHA\tDUMMY-CANARY-BETA\r\r\n' > "$tmp/residual-cr-manifest"
if run_check "$clean_sha" "$tmp/residual-cr-manifest"; then
    fail "residual CR manifest was accepted"
fi
assert_private_output

printf '\r\n' > "$tmp/crlf-empty-record-manifest"
if run_check "$clean_sha" "$tmp/crlf-empty-record-manifest"; then
    fail "CRLF empty record was accepted"
fi
assert_private_output

printf 'DUMMY-CANARY-ALPHA\t\r\n' > "$tmp/crlf-malformed-manifest"
if run_check "$clean_sha" "$tmp/crlf-malformed-manifest"; then
    fail "CRLF malformed record was accepted"
fi
assert_private_output

printf 'DUMMY-CANARY-ALPHA\tDUMMY-CANARY-BETA\n' > "$repo/repo-local-manifest"
if run_check "$clean_sha" "$repo/repo-local-manifest"; then
    fail "repository-local manifest was accepted"
fi
assert_private_output
rm "$repo/repo-local-manifest"

# A dirty working tree can contain a canary while the selected commit remains clean.
printf 'DUMMY-CANARY-ALPHA and DUMMY-CANARY-BETA\n' > "$repo/working-tree-only.txt"
run_check "$clean_sha" "$manifest" || fail "clean candidate was confused with the working tree"
grep -Fq '0 findings' "$out" || fail "clean candidate did not report status-only success"
assert_private_output

# A tracked symlink stores its link target as a Git blob; that blob is candidate content.
ln -s 'DUMMY-CANARY-ALPHA/DUMMY-CANARY-BETA' "$repo/candidate-link"
git -C "$repo" add candidate-link
git -C "$repo" commit -qm synthetic-symlink-hit
symlink_sha="$(git -C "$repo" rev-parse HEAD)"

if run_check "$symlink_sha" "$manifest"; then
    fail "candidate symlink target record hit was accepted"
fi
assert_private_output

mkdir -p "$tmp/failing-readlink-bin"
printf '#!/usr/bin/env bash\nexit 2\n' > "$tmp/failing-readlink-bin/readlink"
chmod +x "$tmp/failing-readlink-bin/readlink"
if (
    cd "$repo"
    PATH="$tmp/failing-readlink-bin:$PATH" bash "$CHECKER" --candidate "$symlink_sha" --manifest "$manifest"
) > "$out" 2> "$err"; then
    fail "readlink failure was accepted as zero findings"
fi
assert_private_output

rm "$repo/candidate-link"
git -C "$repo" add -u candidate-link
git -C "$repo" commit -qm remove-synthetic-symlink
post_symlink_clean_sha="$(git -C "$repo" rev-parse HEAD)"
run_check "$post_symlink_clean_sha" "$manifest" || fail "removed symlink remained in candidate scan"
assert_private_output

# The selected candidate contains the conjunction while the working tree no longer does.
git -C "$repo" add working-tree-only.txt
git -C "$repo" commit -qm synthetic-hit
hit_sha="$(git -C "$repo" rev-parse HEAD)"
rm "$repo/working-tree-only.txt"

if run_check "$hit_sha" "$manifest"; then
    fail "candidate record hit was accepted"
fi
assert_private_output

if run_check "$hit_sha" "$tmp/crlf-manifest"; then
    fail "candidate record hit with CRLF manifest was accepted"
fi
assert_private_output

mkdir -p "$tmp/failing-bin"
printf '#!/usr/bin/env bash\nexit 2\n' > "$tmp/failing-bin/grep"
chmod +x "$tmp/failing-bin/grep"
if (
    cd "$repo"
    PATH="$tmp/failing-bin:$PATH" bash "$CHECKER" --candidate "$clean_sha" --manifest "$manifest"
) > "$out" 2> "$err"; then
    fail "search command failure was accepted as zero findings"
fi
assert_private_output

# Supplying the older clean SHA must remain green even when HEAD contains a hit.
run_check "$clean_sha" "$manifest" || fail "checker ignored the supplied candidate SHA"
grep -Fq '0 findings' "$out" || fail "wrong-SHA guard did not report success"
assert_private_output

# A malformed record with an empty field must fail closed without echoing it.
printf 'DUMMY-CANARY-ALPHA\t\n' > "$tmp/malformed-manifest"
if run_check "$clean_sha" "$tmp/malformed-manifest"; then
    fail "malformed manifest record was accepted"
fi
assert_private_output

printf 'DUMMY-CANARY-ALPHA\tDUMMY-CANARY-BETA\nDUMMY-CANARY-ALPHA\tDUMMY-CANARY-BETA\n' > "$tmp/duplicate-manifest"
if run_check "$clean_sha" "$tmp/duplicate-manifest"; then
    fail "duplicate manifest record was accepted"
fi
assert_private_output

printf 'DUMMY-CANARY-ALPHA\tDUMMY-CANARY-BETA\r\nDUMMY-CANARY-ALPHA\tDUMMY-CANARY-BETA\n' > "$tmp/mixed-newline-duplicate-manifest"
if run_check "$clean_sha" "$tmp/mixed-newline-duplicate-manifest"; then
    fail "duplicate manifest record after CR normalization was accepted"
fi
assert_private_output

echo "PASS: public-sanitization"
