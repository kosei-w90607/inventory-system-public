#!/usr/bin/env bash
set -uo pipefail

usage() {
    echo "usage: $0 changed|full" >&2
}

MODE="${1:-}"
case "$MODE" in
    changed|full)
        ;;
    *)
        usage
        exit 2
        ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "local-ci: not inside a git repository" >&2
    exit 2
}
CLASSIFIER="$REPO_ROOT/scripts/ci/classify-changes.sh"
HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
TIMESTAMP="$(date '+%Y%m%dT%H%M%S%N%z')"
EVIDENCE_DIR="$REPO_ROOT/.local/ci-evidence"
EVIDENCE_FILE="$EVIDENCE_DIR/local-ci-${MODE}-${HEAD_SHA}-${TIMESTAMP}.log"

mkdir -p "$EVIDENCE_DIR" || {
    echo "local-ci: cannot create evidence directory" >&2
    exit 1
}
: > "$EVIDENCE_FILE" || {
    echo "local-ci: cannot write evidence file" >&2
    exit 1
}

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=normal)" ]]; then
    TREE_STATE="DIRTY"
else
    TREE_STATE="CLEAN"
fi

log() {
    printf '%s\n' "$*" | tee -a "$EVIDENCE_FILE"
    local statuses=("${PIPESTATUS[@]}")
    if [[ "${statuses[0]}" -ne 0 || "${statuses[1]}" -ne 0 ]]; then
        echo "local-ci: evidence write failed" >&2
        exit 1
    fi
}

command_text() {
    local arg
    local rendered=""
    for arg in "$@"; do
        printf -v rendered '%s%q ' "$rendered" "$arg"
    done
    printf '%s' "${rendered% }"
}

finish() {
    local result="$1"
    local code="$2"
    local end_head_sha="UNAVAILABLE"
    local end_tree_state="UNKNOWN"
    local merge_evidence_valid=false

    end_head_sha="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || printf 'UNAVAILABLE')"
    if git -C "$REPO_ROOT" status --porcelain --untracked-files=normal >/dev/null 2>&1; then
        if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=normal)" ]]; then
            end_tree_state="DIRTY"
        else
            end_tree_state="CLEAN"
        fi
    fi

    log "END_HEAD_SHA=$end_head_sha"
    log "END_TREE_STATE=$end_tree_state"

    if [[ "$result" == "PASS" && "$end_head_sha" != "$HEAD_SHA" ]]; then
        log "ERROR=HEAD changed while local CI was running"
        result="FAIL"
        code=1
    fi
    if [[ "$result" == "PASS" && "$TREE_STATE" == "CLEAN" && "$end_tree_state" != "CLEAN" ]]; then
        log "ERROR=working tree changed while local CI was running"
        result="FAIL"
        code=1
    fi
    if [[ "$result" == "PASS" && "$MODE" == "full" && "$TREE_STATE" == "CLEAN" && "$end_tree_state" == "CLEAN" && "$end_head_sha" == "$HEAD_SHA" ]]; then
        merge_evidence_valid=true
    fi
    log "MERGE_EVIDENCE_VALID=$merge_evidence_valid"
    log "RESULT=$result"
    log "EXIT_CODE=$code"
    log "EVIDENCE_FILE=$EVIDENCE_FILE"
    exit "$code"
}

run_gate() {
    local name="$1"
    local workdir="$2"
    shift 2
    local rendered
    rendered="$(command_text "$@")"

    log "GATE=$name"
    log "COMMAND=(cd $(printf '%q' "$workdir") && $rendered)"
    (
        cd "$workdir" && "$@"
    ) 2>&1 | tee -a "$EVIDENCE_FILE"
    local statuses=("${PIPESTATUS[@]}")
    local command_status="${statuses[0]}"
    local tee_status="${statuses[1]}"
    if [[ "$tee_status" -ne 0 ]]; then
        log "GATE_EXIT_CODE=1"
        return 1
    fi
    log "GATE_EXIT_CODE=$command_status"
    return "$command_status"
}

run_warn_gate() {
    local name="$1"
    local workdir="$2"
    shift 2
    run_gate "$name" "$workdir" "$@"
    local status="$?"
    if [[ "$status" -eq 0 ]]; then
        return 0
    fi
    log "WARN_ONLY_GATE=$name"
    log "WARN_ONLY_EXIT_CODE=$status"
    return 0
}

classification_value() {
    local key="$1"
    printf '%s\n' "$CLASSIFICATION" | awk -F= -v key="$key" '$1 == key { print $2 }'
}

run_required() {
    local name="$1"
    local workdir="$2"
    shift 2
    run_gate "$name" "$workdir" "$@"
    local status="$?"
    if [[ "$status" -ne 0 ]]; then
        finish FAIL "$status"
    fi
}

base_sha="FULL"
if [[ "$MODE" == "changed" ]]; then
    if git -C "$REPO_ROOT" rev-parse --verify 'origin/main^{commit}' >/dev/null 2>&1; then
        base_sha="$(git -C "$REPO_ROOT" merge-base origin/main HEAD 2>/dev/null || true)"
    fi
    if [[ -z "$base_sha" || "$base_sha" == "FULL" ]] &&
        git -C "$REPO_ROOT" rev-parse --verify 'main^{commit}' >/dev/null 2>&1; then
        base_sha="$(git -C "$REPO_ROOT" merge-base main HEAD 2>/dev/null || true)"
    fi
    [[ -n "$base_sha" && "$base_sha" != "FULL" ]] || base_sha="FULL_FALLBACK"
fi

log "LOCAL_CI_VERSION=1"
log "MODE=$MODE"
log "HEAD_SHA=$HEAD_SHA"
log "BASE_SHA=$base_sha"
log "TREE_STATE=$TREE_STATE"
log "STARTED_AT=$TIMESTAMP"

if [[ ! -x "$CLASSIFIER" ]]; then
    log "ERROR=shared classifier is missing or not executable"
    finish FAIL 1
fi

if [[ "$MODE" == "full" ]]; then
    if ! CLASSIFICATION="$($CLASSIFIER --all)"; then
        finish FAIL 1
    fi
else
    if ! CLASSIFICATION="$(cd "$REPO_ROOT" && "$CLASSIFIER")"; then
        finish FAIL 1
    fi
fi

log "CLASSIFICATION_BEGIN"
while IFS= read -r line; do
    log "CLASSIFICATION_$line"
done <<< "$CLASSIFICATION"
log "CLASSIFICATION_END"

run_required docs "$REPO_ROOT" bash scripts/doc-consistency-check.sh

# PK5/STATECAP は変更ファイルの classification に関係なく毎回実行する（docs gate と同様、
# ブランチ全体の git 履歴状態そのものに対する検査のため）。
run_required workflow-git "$REPO_ROOT" bash scripts/check-workflow-git.sh

if [[ "$(classification_value workflow)" == "true" ]]; then
    mapfile -t shell_files < <(find "$REPO_ROOT/scripts" -type f -name '*.sh' -print | sort)
    for shell_file in "${shell_files[@]}"; do
        shell_file_relative="${shell_file#"$REPO_ROOT"/}"
        run_required "shell-syntax:$shell_file_relative" "$REPO_ROOT" bash -n "$shell_file"
    done
    run_required classifier-tests "$REPO_ROOT" bash scripts/tests/classify-changes.test.sh
    run_required pre-push-tests "$REPO_ROOT" bash scripts/tests/pre-push.test.sh
    run_required local-ci-tests "$REPO_ROOT" bash scripts/tests/local-ci.test.sh
    run_required public-sanitization-tests "$REPO_ROOT" bash scripts/tests/public-sanitization.test.sh
    run_required doc-consistency-plan-packet-tests "$REPO_ROOT" bash scripts/tests/doc-consistency-plan-packet.test.sh
    run_required workflow-git-checks-tests "$REPO_ROOT" bash scripts/tests/workflow-git-checks.test.sh
    run_required reading-order-drift-tests "$REPO_ROOT" bash scripts/tests/reading-order-drift.test.sh
    run_required workflow-tests "$REPO_ROOT" bash scripts/tests/ci-workflow.test.sh
    run_required workflow-yaml "$REPO_ROOT" ruby -e "require 'yaml'; ARGV.each { |path| YAML.parse_file(path) }" .github/workflows/ci.yml .github/workflows/npm-security-monitor.yml
fi

if [[ "$(classification_value env)" == "true" ]]; then
    run_required env-safety "$REPO_ROOT" bash scripts/check-env-safety.sh
fi

if [[ "$(classification_value rust)" == "true" ]]; then
    run_required rust-fmt "$REPO_ROOT/src-tauri" cargo fmt --check
    run_required rust-clippy "$REPO_ROOT/src-tauri" cargo clippy --all-targets --all-features -- -D warnings
    run_required rust-tests "$REPO_ROOT/src-tauri" cargo test
fi

if [[ "$(classification_value generated)" == "true" ]]; then
    run_required generated-bindings "$REPO_ROOT/src-tauri" cargo run --bin generate_bindings
    run_required generated-bindings-diff "$REPO_ROOT" git diff --exit-code -- src/lib/bindings.ts
fi

if [[ "$(classification_value traceability)" == "true" ]]; then
    run_required traceability "$REPO_ROOT/src-tauri" cargo run --bin generate_traceability -- --check
fi

if [[ "$(classification_value frontend)" == "true" ]]; then
    if [[ "$MODE" == "full" ]]; then
        run_required frontend-install "$REPO_ROOT" npm ci
    fi
    run_required frontend-routes "$REPO_ROOT" npm run generate:routes
    run_required frontend-typecheck "$REPO_ROOT" npm run typecheck
    run_required frontend-lint "$REPO_ROOT" npm run lint
    run_required frontend-format "$REPO_ROOT" npm run format:check
    run_required frontend-tests "$REPO_ROOT" npm test
    run_required frontend-build "$REPO_ROOT" npm run build
fi

if [[ "$MODE" == "full" ]]; then
    run_warn_gate npm-audit "$REPO_ROOT" npm audit --audit-level=high
fi

finish PASS 0
