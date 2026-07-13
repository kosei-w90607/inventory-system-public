#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLASSIFIER="$REPO_ROOT/scripts/ci/classify-changes.sh"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

value_for() {
    local output="$1"
    local key="$2"
    printf '%s\n' "$output" | awk -F= -v key="$key" '$1 == key { print $2 }'
}

assert_value() {
    local output="$1"
    local key="$2"
    local expected="$3"
    local actual
    actual="$(value_for "$output" "$key")"
    [[ "$actual" == "$expected" ]] || fail "$key expected $expected, got ${actual:-missing}"
}

assert_contract() {
    local output="$1"
    local count
    count="$(printf '%s\n' "$output" | awk 'NF { count++ } END { print count + 0 }')"
    [[ "$count" == "9" ]] || fail "expected 9 output lines, got $count"
    for key in rust rust_drift frontend docs env generated traceability workflow unknown; do
        local value
        value="$(value_for "$output" "$key")"
        [[ "$value" == "true" || "$value" == "false" ]] || fail "$key is not boolean"
    done
}

classify_paths() {
    printf '%s\n' "$@" | "$CLASSIFIER" --files-from-stdin
}

[[ -x "$CLASSIFIER" ]] || fail "shared classifier is missing or not executable"

output="$(classify_paths docs/ci.md)"
assert_contract "$output"
assert_value "$output" docs true
assert_value "$output" rust false
assert_value "$output" frontend false
assert_value "$output" unknown false

for path in src/features/example/view.tsx public/favicon.ico index.html package.json package-lock.json .npmrc tsconfig.json vite.config.ts vitest.config.ts eslint.config.js prettier.config.js .prettierrc.json .prettierignore components.json tailwind.config.ts; do
    output="$(classify_paths "$path")"
    assert_contract "$output"
    assert_value "$output" frontend true
    assert_value "$output" unknown false
done

output="$(classify_paths src-tauri/src/lib.rs)"
assert_contract "$output"
assert_value "$output" rust true
assert_value "$output" generated true
assert_value "$output" traceability true
assert_value "$output" rust_drift true

output="$(classify_paths src/features/example/view.test.tsx)"
assert_contract "$output"
assert_value "$output" frontend true
assert_value "$output" traceability true
assert_value "$output" rust_drift true

output="$(classify_paths config/.env.local)"
assert_contract "$output"
assert_value "$output" frontend true
assert_value "$output" env true

output="$(classify_paths src/lib/bindings.ts)"
assert_contract "$output"
assert_value "$output" generated true
assert_value "$output" rust_drift true

output="$(classify_paths scripts/local-ci.sh)"
assert_contract "$output"
for key in rust rust_drift frontend docs env generated traceability workflow; do
    assert_value "$output" "$key" true
done
assert_value "$output" unknown false

output="$(classify_paths .github/pull_request_template.md)"
assert_contract "$output"
assert_value "$output" workflow true
assert_value "$output" unknown false

for path in mystery.xyz unknown/deep/file.bin; do
    output="$(classify_paths "$path")"
    assert_contract "$output"
    for key in rust rust_drift frontend docs env generated traceability workflow unknown; do
        assert_value "$output" "$key" true
    done
done

output="$(cd "$REPO_ROOT" && "$CLASSIFIER" --base does-not-exist --head HEAD 2>/dev/null)"
assert_contract "$output"
for key in rust rust_drift frontend docs env generated traceability workflow unknown; do
    assert_value "$output" "$key" true
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
git -C "$tmp" config user.name test
git -C "$tmp" config user.email test@example.invalid
printf 'base\n' > "$tmp/README.md"
mkdir -p "$tmp/src"
printf 'export const removed = true;\n' > "$tmp/src/removed.ts"
git -C "$tmp" add README.md src/removed.ts
git -C "$tmp" commit -qm base
git -C "$tmp" branch -M main
base_sha="$(git -C "$tmp" rev-parse HEAD)"
git -C "$tmp" update-ref refs/remotes/origin/main "$base_sha"
git -C "$tmp" switch -qc feature
mkdir -p "$tmp/docs"
printf 'docs\n' > "$tmp/docs/example.md"
git -C "$tmp" add docs/example.md
git -C "$tmp" commit -qm docs
mkdir -p "$tmp/src"
printf 'export {};\n' > "$tmp/src/example.ts"
git -C "$tmp" add src/example.ts
git -C "$tmp" commit -qm frontend

output="$(cd "$tmp" && "$CLASSIFIER")"
assert_contract "$output"
assert_value "$output" docs true
assert_value "$output" frontend true
assert_value "$output" unknown false

git -C "$tmp" update-ref -d refs/remotes/origin/main
output="$(cd "$tmp" && "$CLASSIFIER")"
assert_contract "$output"
assert_value "$output" docs true
assert_value "$output" frontend true
assert_value "$output" unknown false

git -C "$tmp" switch -q main
git -C "$tmp" update-ref refs/remotes/origin/main "$base_sha"
git -C "$tmp" switch -qc delete-only
git -C "$tmp" rm -q src/removed.ts
git -C "$tmp" commit -qm delete-frontend
output="$(cd "$tmp" && "$CLASSIFIER")"
assert_contract "$output"
assert_value "$output" frontend true
assert_value "$output" unknown false

git -C "$tmp" switch -q main
git -C "$tmp" switch -qc rename-only
mkdir -p "$tmp/docs"
git -C "$tmp" mv src/removed.ts docs/renamed.md
git -C "$tmp" commit -qm rename-frontend-to-docs
output="$(cd "$tmp" && "$CLASSIFIER")"
assert_contract "$output"
assert_value "$output" docs true
assert_value "$output" frontend true
assert_value "$output" unknown false

git -C "$tmp" switch -q main
git -C "$tmp" switch -qc copy-only
mkdir -p "$tmp/docs"
cp "$tmp/src/removed.ts" "$tmp/docs/copied.md"
git -C "$tmp" add docs/copied.md
git -C "$tmp" commit -qm copy-frontend-to-docs
output="$(cd "$tmp" && "$CLASSIFIER")"
assert_contract "$output"
assert_value "$output" docs true
assert_value "$output" frontend true
assert_value "$output" unknown false

echo "PASS: classify-changes"
