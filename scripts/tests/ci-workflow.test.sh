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
  expected_always_guard = "always() && needs.changes.result == 'success'"
  if condition.include?("always()") && condition != expected_always_guard
    abort "always job #{name} can run after changes is skipped: #{condition.inspect}"
  end
end
RUBY
}

validate_workflow_contract() {
    ruby - "$1" <<'RUBY'
require "yaml"
workflow = YAML.safe_load(File.read(ARGV.fetch(0)), aliases: true)
triggers = workflow["on"] || workflow[true]
abort "workflow trigger map is missing" unless triggers.is_a?(Hash)

expected_trigger_keys = %w[pull_request workflow_dispatch]
actual_trigger_keys = triggers.keys.map(&:to_s)
unless actual_trigger_keys.length == expected_trigger_keys.length && actual_trigger_keys.uniq.length == actual_trigger_keys.length && actual_trigger_keys.sort == expected_trigger_keys.sort
  abort "workflow triggers must be exactly #{expected_trigger_keys.inspect}; got #{actual_trigger_keys.inspect}"
end

pull_request = triggers.fetch("pull_request")
abort "pull_request trigger is not a map" unless pull_request.is_a?(Hash)
types = pull_request.fetch("types")
abort "pull_request.types is not an array" unless types.is_a?(Array)

# D-043: Final-only CI must react to every non-Draft PR head update.
expected = %w[opened ready_for_review synchronize]
actual = types.map(&:to_s)
unless actual.length == expected.length && actual.uniq.length == actual.length && actual.sort == expected.sort
  abort "pull_request.types must be exactly #{expected.inspect}; got #{actual.inspect}"
end

expected_branches = ["main"]
abort "pull_request.branches drifted" unless pull_request.fetch("branches") == expected_branches

expected_paths_ignore = ["docs/**", "*.md", ".agents/**", ".claude/skills/**"]
abort "pull_request.paths-ignore drifted" unless pull_request.fetch("paths-ignore") == expected_paths_ignore

concurrency = workflow.fetch("concurrency")
abort "concurrency is not a map" unless concurrency.is_a?(Hash)
abort "superseded-run cancellation is not enabled" unless concurrency.fetch("cancel-in-progress") == true

jobs = workflow.fetch("jobs")
changes = jobs.fetch("changes")
expected_changes_condition = <<~'CONDITION'.split.join(" ")
  github.event_name == 'workflow_dispatch' ||
  (github.event.pull_request.draft == false &&
  !(contains(github.event.pull_request.body, 'Hosted CI: skip') &&
  github.actor == github.repository_owner &&
  (contains(github.event.pull_request.body, 'Risk: R0') ||
  contains(github.event.pull_request.body, 'Risk: R1'))))
CONDITION
actual_changes_condition = changes.fetch("if").to_s.split.join(" ")
unless actual_changes_condition == expected_changes_condition
  abort "changes job guard drifted: #{actual_changes_condition.inspect}"
end

filter_steps = changes.fetch("steps").select { |step| step["id"] == "filter" }
abort "expected exactly one classifier step" unless filter_steps.length == 1
run_lines = filter_steps.first.fetch("run").lines.map(&:strip).reject(&:empty?)
else_index = run_lines.index("else")
fi_index = else_index && run_lines.each_index.find { |index| index > else_index && run_lines[index] == "fi" }
abort "classifier PR branch is missing" unless else_index && fi_index
actual_pr_branch = run_lines[(else_index + 1)...fi_index]
expected_pr_branch = [
  "scripts/ci/classify-changes.sh \\",
  "--base \"${{ github.event.pull_request.base.sha }}\" \\",
  "--head \"${{ github.event.pull_request.head.sha }}\" > \"$output\"",
]
unless actual_pr_branch == expected_pr_branch
  abort "classifier PR base/head routing drifted: #{actual_pr_branch.inspect}"
end

expected_job_names = {
  "changes" => "Detect changed areas",
  "rust_lint" => "Rust fmt/clippy",
  "rust_test" => "Rust tests",
  "rust_drift" => "Rust generated drift",
  "rust" => "Rust (fmt + clippy + test)",
  "docs" => "Design doc consistency",
  "env_safety" => "Env safety",
  "frontend" => "Frontend (typecheck + lint + format + build)",
}
expected_job_names.each do |job_key, expected_name|
  actual_name = jobs.fetch(job_key).fetch("name")
  abort "job name drifted for #{job_key}: #{actual_name.inspect}" unless actual_name == expected_name
end
RUBY
}

validate_job_graph "$WORKFLOW"
validate_workflow_contract "$WORKFLOW"

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
if validate_workflow_contract "$missing_event_mutation" >/dev/null 2>&1; then
    fail "pull_request event validator accepted missing synchronize"
fi

extra_event_mutation="$mutation_dir/extra-event.yml"
sed 's/synchronize/synchronize, reopened/' "$WORKFLOW" > "$extra_event_mutation"
if validate_workflow_contract "$extra_event_mutation" >/dev/null 2>&1; then
    fail "pull_request event validator accepted an extra event"
fi

draft_guard_mutation="$mutation_dir/weakened-draft-guard.yml"
sed 's/github.event.pull_request.draft == false/github.event.pull_request.draft == false || true/' "$WORKFLOW" > "$draft_guard_mutation"
if validate_workflow_contract "$draft_guard_mutation" >/dev/null 2>&1; then
    fail "workflow contract validator accepted a weakened Draft guard"
fi

owner_guard_mutation="$mutation_dir/weakened-owner-guard.yml"
sed 's/github.actor == github.repository_owner/github.actor == github.repository_owner || true/' "$WORKFLOW" > "$owner_guard_mutation"
if validate_workflow_contract "$owner_guard_mutation" >/dev/null 2>&1; then
    fail "workflow contract validator accepted a weakened owner guard"
fi

concurrency_mutation="$mutation_dir/disabled-cancellation.yml"
sed 's/cancel-in-progress: true/cancel-in-progress: false # cancel-in-progress: true/' "$WORKFLOW" > "$concurrency_mutation"
if validate_workflow_contract "$concurrency_mutation" >/dev/null 2>&1; then
    fail "workflow contract validator accepted disabled cancellation"
fi

head_sha_mutation="$mutation_dir/wrong-head-sha.yml"
sed 's|--head "${{ github.event.pull_request.head.sha }}"|--head "${{ github.sha }}" # --head "${{ github.event.pull_request.head.sha }}"|' "$WORKFLOW" > "$head_sha_mutation"
if validate_workflow_contract "$head_sha_mutation" >/dev/null 2>&1; then
    fail "workflow contract validator accepted wrong head SHA routing"
fi

push_mutation="$mutation_dir/quoted-push-trigger.yml"
sed '/^on:$/a\  "push": { branches: [main] }' "$WORKFLOW" > "$push_mutation"
if validate_workflow_contract "$push_mutation" >/dev/null 2>&1; then
    fail "workflow contract validator accepted a push trigger"
fi

merge_group_mutation="$mutation_dir/merge-group-trigger.yml"
sed '/^on:$/a\  merge_group:' "$WORKFLOW" > "$merge_group_mutation"
if validate_workflow_contract "$merge_group_mutation" >/dev/null 2>&1; then
    fail "workflow contract validator accepted an extra top-level trigger"
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
