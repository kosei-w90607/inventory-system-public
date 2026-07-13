#!/usr/bin/env bash
# Scan an immutable Git commit without exposing manifest records or file paths.
#
# Each non-empty manifest line is one opaque record. Tab-separated fields in a
# record are fixed-string conjunctions: all fields must occur in the same
# tracked blob for the record to be a finding. Regular-file contents and
# symlink-target blobs are both scanned. The manifest must remain
# outside the repository and must never be copied into logs or evidence.
set -uo pipefail

fail_closed() {
    echo "public-candidate: FAIL" >&2
    exit 1
}

for required_command in git tar grep find readlink realpath mktemp; do
    command -v "$required_command" >/dev/null 2>&1 || fail_closed
done

candidate=""
manifest=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --candidate)
            [[ $# -ge 2 ]] || fail_closed
            candidate="$2"
            shift 2
            ;;
        --manifest)
            [[ $# -ge 2 ]] || fail_closed
            manifest="$2"
            shift 2
            ;;
        *)
            fail_closed
            ;;
    esac
done

[[ -n "$candidate" && -n "$manifest" ]] || fail_closed
[[ -r "$manifest" && -s "$manifest" ]] || fail_closed

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail_closed
repo_root="$(realpath "$repo_root" 2>/dev/null)" || fail_closed
manifest_path="$(realpath "$manifest" 2>/dev/null)" || fail_closed
case "$manifest_path" in
    "$repo_root"|"$repo_root"/*)
        fail_closed
        ;;
esac
commit="$(git -C "$repo_root" rev-parse --verify "$candidate^{commit}" 2>/dev/null)" || fail_closed

tmp="$(mktemp -d)" || fail_closed
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/tree" || fail_closed

if ! git -C "$repo_root" archive --format=tar "$commit" 2>/dev/null | tar -xf - -C "$tmp/tree" 2>/dev/null; then
    fail_closed
fi
if ! find "$tmp/tree" \( -type f -o -type l \) -print0 > "$tmp/blobs" 2>/dev/null; then
    fail_closed
fi

declare -A seen=()
record_count=0
finding_count=0

while IFS= read -r record || [[ -n "$record" ]]; do
    if [[ "$record" == *$'\r' ]]; then
        record="${record%$'\r'}"
    fi
    [[ "$record" != *$'\r'* ]] || fail_closed
    [[ -n "$record" ]] || fail_closed
    [[ "$record" != $'\t'* && "$record" != *$'\t' && "$record" != *$'\t\t'* ]] || fail_closed
    [[ -z "${seen["$record"]+present}" ]] || fail_closed
    seen["$record"]=1
    record_count=$((record_count + 1))

    IFS=$'\t' read -r -a fields <<< "$record"
    record_found=0
    while IFS= read -r -d '' file; do
        blob="$file"
        if [[ -L "$file" ]]; then
            if ! readlink -- "$file" > "$tmp/link-blob" 2>/dev/null; then
                fail_closed
            fi
            blob="$tmp/link-blob"
        fi
        all_fields_found=1
        for field in "${fields[@]}"; do
            grep -aFq -- "$field" "$blob" 2>/dev/null
            grep_status=$?
            case "$grep_status" in
                0) ;;
                1)
                    all_fields_found=0
                    break
                    ;;
                *)
                    fail_closed
                    ;;
            esac
        done
        if [[ "$all_fields_found" -eq 1 ]]; then
            record_found=1
            break
        fi
    done < "$tmp/blobs"

    if [[ "$record_found" -eq 1 ]]; then
        finding_count=$((finding_count + 1))
    fi
done < "$manifest_path"

[[ "$record_count" -gt 0 ]] || fail_closed
if [[ "$finding_count" -ne 0 ]]; then
    fail_closed
fi

echo "public-candidate: PASS (0 findings)"
