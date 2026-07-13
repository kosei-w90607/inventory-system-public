#!/usr/bin/env bash
# L0 pre-push gate for the push increment. Final merge evidence is local-ci full.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOG_DIR="$REPO_ROOT/.local"
LOG_FILE="$LOG_DIR/quality-check.log"
CLASSIFIER="$REPO_ROOT/scripts/ci/classify-changes.sh"
COMMIT_HASH="$(git rev-parse HEAD)"
TIMESTAMP="$(date '+%Y-%m-%dT%H:%M:%S%z')"
REMOTE="${1:-origin}"
REMOTE_URL="${2:-}"

mkdir -p "$LOG_DIR"

append_check() {
    local name="$1"
    CHECKS_RUN="${CHECKS_RUN:+$CHECKS_RUN+}$name"
}

record_outcome() {
    local outcome="$1"
    local detail="$2"
    local recorded=false
    local index

    for index in "${!PUSH_LOCAL_OIDS[@]}"; do
        if [[ "${PUSH_LOCAL_OIDS[$index]}" == "$zero_sha" ]]; then
            continue
        fi
        printf '%s %s %s %s %s\n' \
            "$TIMESTAMP" "${PUSH_LOCAL_OIDS[$index]}" "$outcome" "$detail" "${PUSH_REMOTE_REFS[$index]}" >> "$LOG_FILE"
        recorded=true
    done

    if [[ "$recorded" == "false" ]]; then
        printf '%s %s %s %s no-push-ref\n' "$TIMESTAMP" "$COMMIT_HASH" "$outcome" "$detail" >> "$LOG_FILE"
    fi
}

fail_gate() {
    local name="$1"
    record_outcome FAIL "$name"
    exit 1
}

classification_value() {
    local key="$1"
    printf '%s\n' "$CLASSIFICATION" | awk -F= -v key="$key" '$1 == key { print $2 }'
}

zero_sha="0000000000000000000000000000000000000000"
declare -a PUSH_LOCAL_REFS=()
declare -a PUSH_LOCAL_OIDS=()
declare -a PUSH_REMOTE_REFS=()
declare -a PUSH_REMOTE_OIDS=()

while read -r local_ref local_oid remote_ref remote_oid; do
    [[ -z "${local_ref:-}" ]] && continue
    PUSH_LOCAL_REFS+=("$local_ref")
    PUSH_LOCAL_OIDS+=("$local_oid")
    PUSH_REMOTE_REFS+=("$remote_ref")
    PUSH_REMOTE_OIDS+=("$remote_oid")
done

bypass_reason="${INVENTORY_PRE_PUSH_BYPASS_REASON:-}"
if [[ -n "$bypass_reason" ]]; then
    case "$bypass_reason" in
        owner-approved|tooling-unavailable|incident-response)
            record_outcome BYPASS "$bypass_reason"
            echo "[pre-push] Emergency bypass recorded: $bypass_reason"
            exit 0
            ;;
        *)
            echo "[pre-push] Invalid bypass token." >&2
            echo "Allowed: owner-approved, tooling-unavailable, incident-response" >&2
            exit 2
            ;;
    esac
fi

if [[ -z "$REMOTE_URL" ]]; then
    REMOTE_URL="$(git remote get-url "$REMOTE" 2>/dev/null || true)"
fi

if [[ "$REMOTE_URL" == *github.com* ]]; then
    if ! command -v gh >/dev/null 2>&1; then
        echo "[pre-push] gh is required to verify Draft state for a GitHub push." >&2
        fail_gate ready-state-lookup
    fi

    for index in "${!PUSH_LOCAL_OIDS[@]}"; do
        [[ "${PUSH_LOCAL_OIDS[$index]}" == "$zero_sha" ]] && continue
        [[ "${PUSH_REMOTE_REFS[$index]}" == refs/heads/* ]] || continue
        branch="${PUSH_REMOTE_REFS[$index]#refs/heads/}"

        if ! pr_draft="$(gh pr list --head "$branch" --state open --json isDraft --jq '.[0].isDraft // empty')"; then
            echo "[pre-push] GitHub PR state lookup failed for $branch; blocking safely." >&2
            fail_gate ready-state-lookup
        fi

        case "$pr_draft" in
            false)
                echo "[pre-push] PR for $branch is Ready. Return it to Draft before pushing a new HEAD." >&2
                fail_gate ready-state
                ;;
            true|"")
                ;;
            *)
                echo "[pre-push] Unexpected PR state for $branch; blocking safely." >&2
                fail_gate ready-state-lookup
                ;;
        esac
    done
fi

declare -A CLASSIFIED=(
    [rust]=false
    [rust_drift]=false
    [frontend]=false
    [docs]=false
    [env]=false
    [generated]=false
    [traceability]=false
    [workflow]=false
    [unknown]=false
)

merge_classification() {
    local result="$1"
    local key
    for key in "${!CLASSIFIED[@]}"; do
        if [[ "$(printf '%s\n' "$result" | awk -F= -v key="$key" '$1 == key { print $2 }')" == "true" ]]; then
            CLASSIFIED[$key]=true
        fi
    done
}

classify_and_merge() {
    local result
    if ! result="$("$CLASSIFIER" "$@")"; then
        echo "[pre-push] Changed-file classification failed; blocking safely." >&2
        fail_gate classifier
    fi
    merge_classification "$result"
}

if [[ "${#PUSH_LOCAL_OIDS[@]}" -eq 0 ]]; then
    classify_and_merge --all
fi

for index in "${!PUSH_LOCAL_OIDS[@]}"; do
    local_oid="${PUSH_LOCAL_OIDS[$index]}"
    remote_oid="${PUSH_REMOTE_OIDS[$index]}"
    [[ "$local_oid" == "$zero_sha" ]] && continue

    if [[ "$remote_oid" == "$zero_sha" ]]; then
        base=""
        if git rev-parse --verify 'origin/main^{commit}' >/dev/null 2>&1; then
            base="$(git merge-base origin/main "$local_oid" 2>/dev/null || true)"
        fi
        if [[ -z "$base" ]] && git rev-parse --verify 'main^{commit}' >/dev/null 2>&1; then
            base="$(git merge-base main "$local_oid" 2>/dev/null || true)"
        fi
        if [[ -z "$base" ]]; then
            classify_and_merge --all
        else
            classify_and_merge --base "$base" --head "$local_oid"
        fi
    else
        classify_and_merge --base "$remote_oid" --head "$local_oid"
    fi
done

CLASSIFICATION=""
for key in rust rust_drift frontend docs env generated traceability workflow unknown; do
    CLASSIFICATION+="${key}=${CLASSIFIED[$key]}"$'\n'
done

CHECKS_RUN=""

# PK5 (Plan Commit ancestry) / STATECAP (state-only commit 上限) は変更ファイルの
# classification に関係なく毎回実行する pre-merge gate（Plan Commit ancestry や
# state-only commit の積み上がりは push 増分の変更ファイルではなくブランチ全体の
# git 履歴状態そのものに対する検査のため）。CI docs job には追加しない
# (docs/plans/2026-07-12-mechanical-workflow-slice2.md Contract Probe P1、shallow clone)。
echo "[pre-push] Workflow git checks (PK5/STATECAP)"
append_check workflow-git
bash "$REPO_ROOT/scripts/check-workflow-git.sh" || fail_gate workflow-git

if [[ "$(classification_value rust)" == "true" ]]; then
    echo "[pre-push] Rust fast gate"
    append_check rust
    (
        cd "$REPO_ROOT/src-tauri" || exit "$?"
        echo "  cargo fmt --check"
        cargo fmt --check || exit "$?"
        echo "  cargo clippy --all-targets --all-features -- -D warnings"
        cargo clippy --all-targets --all-features -- -D warnings || exit "$?"
        echo "  cargo test"
        cargo test || exit "$?"
    ) || fail_gate rust

    TEST_FNS="$(rg -n --pcre2 '^\s*fn\s+test_[a-z0-9_]*\s*\(' "$REPO_ROOT/src-tauri/src" "$REPO_ROOT/src-tauri/tests" 2>/dev/null || true)"
    MISSING="$(printf '%s\n' "$TEST_FNS" | rg -v --pcre2 '_req[0-9]{3}([_(\s]|$)' 2>/dev/null || true)"
    if [[ -n "$MISSING" ]]; then
        echo "[pre-push] Tests without REQ IDs:" >&2
        echo "$MISSING" >&2
        fail_gate req-number
    fi
fi

if [[ "$(classification_value docs)" == "true" ]]; then
    echo "[pre-push] Design doc consistency"
    append_check docs
    bash "$REPO_ROOT/scripts/doc-consistency-check.sh" || fail_gate doc-consistency
fi

if [[ "$(classification_value env)" == "true" ]]; then
    echo "[pre-push] Env safety"
    append_check env-safety
    bash "$REPO_ROOT/scripts/check-env-safety.sh" || fail_gate env-safety
fi

if [[ "$(classification_value traceability)" == "true" ]]; then
    echo "[pre-push] Traceability"
    append_check traceability
    (
        cd "$REPO_ROOT/src-tauri" || exit "$?"
        cargo run --bin generate_traceability -- --check || exit "$?"
    ) || fail_gate traceability
fi

if [[ "$(classification_value frontend)" == "true" ]]; then
    echo "[pre-push] Frontend fast gate"
    append_check frontend
    (
        cd "$REPO_ROOT" || exit "$?"
        echo "  npm run generate:routes"
        npm run generate:routes || exit "$?"
        echo "  npm run typecheck"
        npm run typecheck || exit "$?"
        echo "  npm run lint"
        npm run lint || exit "$?"
    ) || fail_gate frontend
fi

if [[ -n "$CHECKS_RUN" ]]; then
    record_outcome PASS "$CHECKS_RUN"
    echo "[pre-push] All selected checks passed"
else
    record_outcome SKIP no-target-changes
    echo "[pre-push] No target changes"
fi
