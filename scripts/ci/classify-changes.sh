#!/usr/bin/env bash
set -euo pipefail

rust=false
rust_drift=false
frontend=false
docs=false
env=false
generated=false
traceability=false
workflow=false
unknown=false

set_full_areas() {
    rust=true
    rust_drift=true
    frontend=true
    docs=true
    env=true
    generated=true
    traceability=true
    workflow=true
}

set_unknown_fallback() {
    unknown=true
    set_full_areas
}

print_result() {
    if [[ "$generated" == "true" || "$traceability" == "true" ]]; then
        rust_drift=true
    fi

    printf 'rust=%s\n' "$rust"
    printf 'rust_drift=%s\n' "$rust_drift"
    printf 'frontend=%s\n' "$frontend"
    printf 'docs=%s\n' "$docs"
    printf 'env=%s\n' "$env"
    printf 'generated=%s\n' "$generated"
    printf 'traceability=%s\n' "$traceability"
    printf 'workflow=%s\n' "$workflow"
    printf 'unknown=%s\n' "$unknown"
}

classify_files() {
    local files="$1"
    local file

    while IFS= read -r file; do
        [[ -z "$file" ]] && continue
        local matched=false

        case "$file" in
            .github/workflows/*|.github/actions/*|.github/pull_request_template.md|scripts/ci/*|scripts/tests/*|scripts/local-ci.sh|scripts/pre-push.sh|scripts/doc-consistency-check.sh|scripts/check-env-safety.sh|scripts/check-workflow-git.sh)
                workflow=true
                matched=true
                ;;
        esac

        case "$file" in
            docs/*|Plans.md|AGENTS.md|README.md|*.md|.agents/*|.claude/skills/*|.github/*.md)
                docs=true
                matched=true
                ;;
        esac

        case "$file" in
            src-tauri/*)
                rust=true
                generated=true
                traceability=true
                matched=true
                ;;
        esac

        case "$file" in
            src/lib/bindings.ts|src/routeTree.gen.ts|docs/function-design/90-traceability.md)
                generated=true
                matched=true
                ;;
        esac

        case "$file" in
            docs/function-design/*|docs/FUNCTION_DESIGN.md|docs/spec/requirements.md|src/*.test.ts|src/*.test.tsx)
                traceability=true
                matched=true
                ;;
        esac

        case "$file" in
            src/*|public/*|index.html|package.json|package-lock.json|.npmrc|tsconfig*.json|vite.config.*|vitest.config.*|eslint.config.*|prettier.config.*|.prettierrc|.prettierrc.*|.prettierignore|components.json|tailwind.config.*|postcss.config.*|.gitignore|.env|.env.*|*/.env|*/.env.*)
                frontend=true
                matched=true
                ;;
        esac

        case "$file" in
            .gitignore|.env|.env.*|*/.env|*/.env.*|src/lib/env.ts|src/vite-env.d.ts)
                env=true
                matched=true
                ;;
        esac

        if [[ "$matched" == "false" ]]; then
            printf 'classify-changes: unknown path, using full fallback: %s\n' "$file" >&2
            unknown=true
        fi
    done <<< "$files"

    if [[ "$workflow" == "true" || "$unknown" == "true" ]]; then
        set_full_areas
    fi
}

resolve_default_diff() {
    local head="HEAD"
    local base=""

    if ! git rev-parse --verify "$head^{commit}" >/dev/null 2>&1; then
        printf 'classify-changes: HEAD is unavailable, using full fallback\n' >&2
        return 1
    fi

    if git rev-parse --verify 'origin/main^{commit}' >/dev/null 2>&1; then
        base="$(git merge-base origin/main "$head" 2>/dev/null || true)"
    fi

    if [[ -z "$base" ]] && git rev-parse --verify 'main^{commit}' >/dev/null 2>&1; then
        base="$(git merge-base main "$head" 2>/dev/null || true)"
    fi

    if [[ -z "$base" ]]; then
        printf 'classify-changes: no trustworthy main merge-base, using full fallback\n' >&2
        return 1
    fi

    diff_paths "$base" "$head"
}

diff_paths() {
    local base="$1"
    local head="$2"
    local diff_file
    local status
    local first_path
    local second_path

    diff_file="$(mktemp)" || return 1
    if ! git diff --name-status -z --find-renames --find-copies --find-copies-harder "$base" "$head" > "$diff_file"; then
        rm -f "$diff_file"
        return 1
    fi

    while IFS= read -r -d '' status; do
        if ! IFS= read -r -d '' first_path; then
            rm -f "$diff_file"
            return 1
        fi
        case "$status" in
            R*|C*)
                if ! IFS= read -r -d '' second_path; then
                    rm -f "$diff_file"
                    return 1
                fi
                printf '%s\n%s\n' "$first_path" "$second_path"
                ;;
            *)
                printf '%s\n' "$first_path"
                ;;
        esac
    done < "$diff_file"

    rm -f "$diff_file"
}

mode="default"
base=""
head=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --all)
            mode="all"
            shift
            ;;
        --files-from-stdin)
            mode="stdin"
            shift
            ;;
        --base)
            [[ $# -ge 2 ]] || { echo "usage: $0 [--all|--files-from-stdin|--base REF --head REF]" >&2; exit 2; }
            mode="refs"
            base="$2"
            shift 2
            ;;
        --head)
            [[ $# -ge 2 ]] || { echo "usage: $0 [--all|--files-from-stdin|--base REF --head REF]" >&2; exit 2; }
            mode="refs"
            head="$2"
            shift 2
            ;;
        *)
            echo "usage: $0 [--all|--files-from-stdin|--base REF --head REF]" >&2
            exit 2
            ;;
    esac
done

case "$mode" in
    all)
        set_full_areas
        ;;
    stdin)
        files="$(cat)"
        classify_files "$files"
        ;;
    refs)
        if [[ -z "$base" || -z "$head" ]] ||
            ! git rev-parse --verify "$base^{commit}" >/dev/null 2>&1 ||
            ! git rev-parse --verify "$head^{commit}" >/dev/null 2>&1; then
            printf 'classify-changes: invalid base/head, using full fallback\n' >&2
            set_unknown_fallback
        elif ! files="$(diff_paths "$base" "$head")"; then
            printf 'classify-changes: diff failed, using full fallback\n' >&2
            set_unknown_fallback
        else
            classify_files "$files"
        fi
        ;;
    default)
        if files="$(resolve_default_diff)"; then
            classify_files "$files"
        else
            set_unknown_fallback
        fi
        ;;
esac

print_result
