#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$REPO_ROOT/.github/workflows/ci.yml"
NPM_SECURITY_WORKFLOW="$REPO_ROOT/.github/workflows/npm-security-monitor.yml"
NODE_VERSION_FILE="$REPO_ROOT/.node-version"
PACKAGE_JSON="$REPO_ROOT/package.json"
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

validate_node_contract() {
    local node_version_file="${1:-$NODE_VERSION_FILE}"
    local package_json="${2:-$PACKAGE_JSON}"
    local ci_workflow="${3:-$WORKFLOW}"
    local npm_security_workflow="${4:-$NPM_SECURITY_WORKFLOW}"

    ruby - "$node_version_file" "$package_json" "$ci_workflow" "$npm_security_workflow" <<'RUBY'
require "json"
require "yaml"

node_version_file, package_json, *workflow_paths = ARGV
pin_lines = File.readlines(node_version_file, chomp: true)
abort ".node-version must contain exactly 24.18.0" unless pin_lines == ["24.18.0"]

manifest = JSON.parse(File.read(package_json))
expected_range = ">=24 <25"
abort "engines.node drifted" unless manifest.dig("engines", "node") == expected_range

runtime = manifest.dig("devEngines", "runtime")
expected_runtime = {
  "name" => "node",
  "version" => expected_range,
  "onFail" => "error",
}
abort "devEngines.runtime drifted" unless runtime == expected_runtime

types_node = manifest.dig("devDependencies", "@types/node")
abort "@types/node must stay on major 24" unless types_node&.match?(/\A\^24\.\d+\.\d+\z/)

workflow_paths.each do |path|
  workflow = YAML.safe_load(File.read(path), aliases: true)
  setup_steps = workflow.fetch("jobs").values.flat_map { |job| job.fetch("steps", []) }
    .select { |step| step["uses"] == "actions/setup-node@v6" }
  abort "#{path}: setup-node@v6 step is missing" if setup_steps.empty?

  setup_steps.each do |step|
    setup_with = step.fetch("with")
    unless setup_with["node-version-file"] == ".node-version" && !setup_with.key?("node-version")
      abort "#{path}: setup-node must use only node-version-file: .node-version"
    end
  end
end
RUBY
}

validate_claude_hook_audit() {
    local workflow="${1:-$WORKFLOW}"
    grep -Fq 'run: bash scripts/tests/claude-hooks.test.sh' "$workflow"
}

validate_job_graph "$WORKFLOW"
validate_workflow_contract "$WORKFLOW"
validate_node_contract
# D-059 / SPEC-HOOK-01 / CH8: hosted workflow owns the inventory audit step.
validate_claude_hook_audit ||
    fail "CH8 hosted Claude hook audit step is missing"

mutation_dir="$(mktemp -d)"
trap 'rm -rf "$mutation_dir"' EXIT

pin_mutation="$mutation_dir/.node-version"
printf '%s\n' "25.8.2" > "$pin_mutation"
if validate_node_contract "$pin_mutation" >/dev/null 2>&1; then
    fail "Node contract validator accepted a drifted exact pin"
fi

ci_node_mutation="$mutation_dir/ci-node20.yml"
sed 's/node-version-file: .node-version/node-version: 20/' "$WORKFLOW" > "$ci_node_mutation"
if validate_node_contract "$NODE_VERSION_FILE" "$PACKAGE_JSON" "$ci_node_mutation" "$NPM_SECURITY_WORKFLOW" >/dev/null 2>&1; then
    fail "Node contract validator accepted literal Node 20 in ci.yml"
fi

npm_security_node_mutation="$mutation_dir/npm-security-node20.yml"
sed 's/node-version-file: .node-version/node-version: 20/' "$NPM_SECURITY_WORKFLOW" > "$npm_security_node_mutation"
if validate_node_contract "$NODE_VERSION_FILE" "$PACKAGE_JSON" "$WORKFLOW" "$npm_security_node_mutation" >/dev/null 2>&1; then
    fail "Node contract validator accepted literal Node 20 in npm-security-monitor.yml"
fi

engines_mutation="$mutation_dir/engines-node25.json"
sed '0,/"node": ">=24 <25"/s//"node": ">=25 <26"/' "$PACKAGE_JSON" > "$engines_mutation"
if validate_node_contract "$NODE_VERSION_FILE" "$engines_mutation" >/dev/null 2>&1; then
    fail "Node contract validator accepted a drifted engines.node major"
fi

dev_engines_mutation="$mutation_dir/dev-engines-node25.json"
sed '0,/"version": ">=24 <25"/s//"version": ">=25 <26"/' "$PACKAGE_JSON" > "$dev_engines_mutation"
if validate_node_contract "$NODE_VERSION_FILE" "$dev_engines_mutation" >/dev/null 2>&1; then
    fail "Node contract validator accepted a drifted devEngines.runtime major"
fi

types_node_mutation="$mutation_dir/types-node25.json"
sed 's/"@types\/node": "\^24\.[0-9][0-9.]*"/"@types\/node": "^25.0.0"/' "$PACKAGE_JSON" > "$types_node_mutation"
if validate_node_contract "$NODE_VERSION_FILE" "$types_node_mutation" >/dev/null 2>&1; then
    fail "Node contract validator accepted a drifted @types/node major"
fi

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

claude_hook_step_mutation="$mutation_dir/missing-claude-hook-audit.yml"
sed '\|run: bash scripts/tests/claude-hooks.test.sh|d' "$WORKFLOW" > "$claude_hook_step_mutation"
if validate_claude_hook_audit "$claude_hook_step_mutation" >/dev/null 2>&1; then
    fail "CH9 workflow validator accepted a missing Claude hook audit step"
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
require_fixed "bash scripts/tests/codex-safe-wrappers.test.sh"
require_fixed "bash scripts/tests/claude-hooks.test.sh"

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
