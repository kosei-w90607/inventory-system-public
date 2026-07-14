#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$REPO_ROOT/.github/workflows/ci.yml"
PR_TEMPLATE="$REPO_ROOT/.github/pull_request_template.md"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

require_fixed() {
    local text="$1"
    grep -Fq -- "$text" "$WORKFLOW" || fail "workflow missing: $text"
}

reject_fixed() {
    local text="$1"
    if grep -Fq -- "$text" "$WORKFLOW"; then
        fail "workflow still contains: $text"
    fi
}

ruby -e "require 'yaml'; YAML.parse_file(ARGV.fetch(0))" "$WORKFLOW"

validate_job_graph() {
    ruby - "$1" <<'RUBY'
require "yaml"
workflow = YAML.safe_load(File.read(ARGV.fetch(0)), aliases: true)
jobs = workflow.fetch("jobs")
jobs.each do |name, job|
  next if name == "changes"
  needs = Array(job["needs"])
  abort "job #{name} does not depend on changes" unless needs.include?("changes")
  condition = job["if"].to_s
  if condition.include?("always()") && !condition.include?("needs.changes.result == 'success'")
    abort "always job #{name} can run after changes is skipped"
  end
end
RUBY
}

validate_pr_event_types() {
    ruby - "$1" <<'RUBY'
require "yaml"
workflow = YAML.safe_load(File.read(ARGV.fetch(0)), aliases: true)
triggers = workflow["on"] || workflow[true]
abort "workflow trigger map is missing" unless triggers.is_a?(Hash)
pull_request = triggers.fetch("pull_request")
types = pull_request.fetch("types")
abort "pull_request.types is not an array" unless types.is_a?(Array)

# D-043: Final-only CI must react to every non-Draft PR head update.
expected = %w[opened ready_for_review synchronize]
actual = types.map(&:to_s)
unless actual.length == expected.length && actual.uniq.length == actual.length && actual.sort == expected.sort
  abort "pull_request.types must be exactly #{expected.inspect}; got #{actual.inspect}"
end
RUBY
}

validate_job_graph "$WORKFLOW"
validate_pr_event_types "$WORKFLOW"

mutation_dir="$(mktemp -d)"
trap 'rm -rf "$mutation_dir"' EXIT

job_graph_mutation="$mutation_dir/unguarded-job.yml"
cp "$WORKFLOW" "$job_graph_mutation"
cat >> "$job_graph_mutation" <<'YAML'
  unguarded_probe:
    runs-on: ubuntu-latest
    steps:
      - run: echo unsafe
YAML
if validate_job_graph "$job_graph_mutation" >/dev/null 2>&1; then
    fail "job graph validator accepted an unguarded runner job"
fi

missing_event_mutation="$mutation_dir/missing-synchronize.yml"
sed 's/, synchronize//' "$WORKFLOW" > "$missing_event_mutation"
if validate_pr_event_types "$missing_event_mutation" >/dev/null 2>&1; then
    fail "pull_request event validator accepted missing synchronize"
fi

extra_event_mutation="$mutation_dir/extra-event.yml"
sed 's/synchronize/synchronize, reopened/' "$WORKFLOW" > "$extra_event_mutation"
if validate_pr_event_types "$extra_event_mutation" >/dev/null 2>&1; then
    fail "pull_request event validator accepted an extra event"
fi

reject_fixed "  push:"
reject_fixed '      - "**/*.md"'
require_fixed "  workflow_dispatch:"
require_fixed "paths-ignore:"
require_fixed '      - "*.md"'
require_fixed "github.event.pull_request.draft == false"
require_fixed "Hosted CI: skip"
require_fixed "github.actor == github.repository_owner"
require_fixed "Risk: R0"
require_fixed "Risk: R1"
require_fixed "github.event_name == 'workflow_dispatch'"
require_fixed "scripts/ci/classify-changes.sh --all"
require_fixed "scripts/ci/classify-changes.sh"
require_fixed '--base "${{ github.event.pull_request.base.sha }}"'
require_fixed '--head "${{ github.event.pull_request.head.sha }}"'
require_fixed "concurrency:"
require_fixed "cancel-in-progress: true"
require_fixed "if: always() && needs.changes.result == 'success'"
require_fixed "name: Rust (fmt + clippy + test)"
require_fixed "cache: npm"

if grep -Fq 'Hosted CI: skip' "$PR_TEMPLATE"; then
    fail "PR template contains the opt-in skip token by default"
fi

always_count="$(grep -cE '^ {4}if: always\(\)' "$WORKFLOW")"
guarded_count="$(grep -cE "^ {4}if: always\\(\\) && needs\\.changes\\.result == 'success'" "$WORKFLOW")"
[[ "$always_count" == "$guarded_count" ]] || fail "an always() job can run after changes is skipped"

cache_blocks="$(awk '
    /uses: actions\/cache@v5/ { in_cache=1; block=$0 ORS; next }
    in_cache && /^      - / { print block "---"; in_cache=0 }
    in_cache { block=block $0 ORS }
    END { if (in_cache) print block "---" }
' "$WORKFLOW")"

[[ -n "$cache_blocks" ]] || fail "Cargo cache blocks not found"
for path in '~/.cargo/registry/index/' '~/.cargo/registry/cache/' '~/.cargo/git/db/'; do
    grep -Fq "$path" <<< "$cache_blocks" || fail "cache missing $path"
done
if grep -Fq 'src-tauri/target/' <<< "$cache_blocks"; then
    fail "target remains in actions/cache"
fi
if grep -Fq '~/.cargo/bin/' <<< "$cache_blocks"; then
    fail "cargo bin remains in actions/cache"
fi

key_count="$(grep -cF 'key: ${{ runner.os }}-cargo-${{ hashFiles(' "$WORKFLOW")"
[[ "$key_count" == "3" ]] || fail "expected one shared key expression in each Rust cache job"

echo "PASS: ci-workflow"
