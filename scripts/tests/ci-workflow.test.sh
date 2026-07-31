#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$REPO_ROOT/.github/workflows/ci.yml"
NPM_SECURITY_WORKFLOW="$REPO_ROOT/.github/workflows/npm-security-monitor.yml"
NODE_VERSION_FILE="$REPO_ROOT/.node-version"
PACKAGE_JSON="$REPO_ROOT/package.json"
PR_TEMPLATE="$REPO_ROOT/.github/pull_request_template.md"
CI_DOC="$REPO_ROOT/docs/ci.md"
DEV_WORKFLOW_DOC="$REPO_ROOT/docs/DEV_WORKFLOW.md"
DECISION_LOG="$REPO_ROOT/docs/decision-log.md"
PLANS_DOC="$REPO_ROOT/docs/Plans.md"
PROJECT_HANDOFF_DOC="$REPO_ROOT/docs/PROJECT_HANDOFF.md"

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

validate_public_actions_doc_contract() {
    local ci_doc="${1:-$CI_DOC}"
    local dev_workflow_doc="${2:-$DEV_WORKFLOW_DOC}"
    local decision_log="${3:-$DECISION_LOG}"
    local plans_doc="${4:-$PLANS_DOC}"
    local project_handoff_doc="${5:-$PROJECT_HANDOFF_DOC}"

    [ -f "$ci_doc" ] && [ -f "$dev_workflow_doc" ] && [ -f "$decision_log" ] &&
        [ -f "$plans_doc" ] && [ -f "$project_handoff_doc" ] || return 1

    if grep -Eq '75%|90%|月間 billed minutes|枠 reset|^## Budget Pressure$' \
        "$ci_doc" "$dev_workflow_doc" "$plans_doc" "$project_handoff_doc"; then
        return 1
    fi

    grep -Fq 'CI-PUBLIC-D1:' "$ci_doc" || return 1
    grep -Fq 'CI-TRIGGER-D1:' "$ci_doc" || return 1
    grep -Fq '| non-doc を含む event-eligible change | owner が Draft から Ready にする。Ready のまま更新された例外経路は `synchronize` | dispatch しない |' "$ci_doc" || return 1
    grep -Fq '| `paths-ignore` 対象だが hosted-required の workflow / release contract docs-only change | owner が Ready にした後、自動 run が作られていないことを確認して `workflow_dispatch` | 同一 HEAD の run が 0 件であること |' "$ci_doc" || return 1
    grep -Fq '| required final の自動 run または explicit dispatch が作成されない、失敗、または cancel | 原因を確認・是正した後の recovery として `workflow_dispatch` | 同一 HEAD に successful / in-progress run がないこと |' "$ci_doc" || return 1
    grep -Fq '| 同一 HEAD に successful final が既にある | 既存 run を evidence に使う | Ready の再操作も dispatch も行わない |' "$ci_doc" || return 1
    grep -Fq '**non-release R2/R3 Actions unavailable**' "$ci_doc" || return 1
    grep -Fq '**public repository Phase B bootstrap R4**' "$ci_doc" || return 1
    grep -Fq '`not-required` でも観測済み product/test/gate failure は blocker' "$ci_doc" || return 1
    grep -Fq 'CI-TRIGGER-D1' "$dev_workflow_doc" || return 1
    grep -Fxq '## D-063' "$decision_log"
}

validate_job_graph "$WORKFLOW"
validate_workflow_contract "$WORKFLOW"
validate_node_contract
# D-059 / SPEC-HOOK-01 / CH8: hosted workflow owns the inventory audit step.
validate_claude_hook_audit ||
    fail "CH8 hosted Claude hook audit step is missing"
# D-063 / SPEC-WF-CI-PUBLIC-D1: live CI docs own the public-runner contract.
validate_public_actions_doc_contract "$CI_DOC" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" ||
    fail "public Actions docs contract drifted"

mutation_dir="$(mktemp -d)"
trap 'rm -rf "$mutation_dir"' EXIT

ci_doc_quota_mutation="$mutation_dir/ci-private-quota.md"
cp "$CI_DOC" "$ci_doc_quota_mutation"
printf '%s\n' 'At 75% monthly usage, stop normal hosted CI.' >> "$ci_doc_quota_mutation"
if validate_public_actions_doc_contract "$ci_doc_quota_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "M1 public Actions docs validator accepted private quota wording"
fi

ci_doc_event_dispatch_mutation="$mutation_dir/ci-event-dispatch.md"
sed 's/| dispatch しない |/| workflow_dispatch してよい |/' "$CI_DOC" > "$ci_doc_event_dispatch_mutation"
if validate_public_actions_doc_contract "$ci_doc_event_dispatch_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "M2a public Actions docs validator accepted preventive dispatch for an event-eligible change"
fi

ci_doc_zero_run_mutation="$mutation_dir/ci-zero-run-removed.md"
sed 's/同一 HEAD の run が 0 件であること/同一 HEAD の run 確認は不要/' "$CI_DOC" > "$ci_doc_zero_run_mutation"
if validate_public_actions_doc_contract "$ci_doc_zero_run_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "M2b public Actions docs validator accepted dispatch without the zero-run prerequisite"
fi

ci_doc_recovery_scope_mutation="$mutation_dir/ci-recovery-auto-only.md"
sed 's/required final の自動 run または explicit dispatch/event-eligible だが自動 run/' "$CI_DOC" > "$ci_doc_recovery_scope_mutation"
if validate_public_actions_doc_contract "$ci_doc_recovery_scope_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "M2c public Actions docs validator accepted recovery narrowed to automatic events"
fi

ci_doc_in_progress_mutation="$mutation_dir/ci-in-progress-wait-removed.md"
sed 's/successful \/ in-progress run/successful run/' "$CI_DOC" > "$ci_doc_in_progress_mutation"
if validate_public_actions_doc_contract "$ci_doc_in_progress_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "M2c public Actions docs validator accepted recovery without the in-progress wait"
fi

ci_doc_successful_row_mutation="$mutation_dir/ci-successful-row-removed.md"
sed '/同一 HEAD に successful final が既にある/d' "$CI_DOC" > "$ci_doc_successful_row_mutation"
if validate_public_actions_doc_contract "$ci_doc_successful_row_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "M2d public Actions docs validator accepted a missing already-successful no-op row"
fi

ci_doc_availability_mutation="$mutation_dir/ci-actions-unavailable-route-removed.md"
sed 's/non-release R2\/R3 Actions unavailable/non-release R2\/R3 route removed/' "$CI_DOC" > "$ci_doc_availability_mutation"
if validate_public_actions_doc_contract "$ci_doc_availability_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "M3 public Actions docs validator accepted a missing Actions-unavailable route"
fi

ci_doc_bootstrap_route_mutation="$mutation_dir/ci-bootstrap-route-removed.md"
sed 's/public repository Phase B bootstrap R4/public repository bootstrap route removed/' "$CI_DOC" > "$ci_doc_bootstrap_route_mutation"
if validate_public_actions_doc_contract "$ci_doc_bootstrap_route_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "M3 public Actions docs validator accepted a missing Phase B bootstrap route"
fi

ci_doc_failure_blocker_mutation="$mutation_dir/ci-product-failure-not-blocking.md"
sed 's/not-required` でも観測済み product\/test\/gate failure は blocker/not-required` でも観測済み product\/test\/gate failure は owner disposition 可/' "$CI_DOC" > "$ci_doc_failure_blocker_mutation"
if validate_public_actions_doc_contract "$ci_doc_failure_blocker_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "M3 public Actions docs validator accepted a non-blocking product or gate failure"
fi

ci_doc_public_anchor_mutation="$mutation_dir/ci-public-anchor-removed.md"
sed 's/CI-PUBLIC-D1/CI-PUBLIC-REMOVED/g' "$CI_DOC" > "$ci_doc_public_anchor_mutation"
if validate_public_actions_doc_contract "$ci_doc_public_anchor_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "public Actions docs validator accepted a missing CI-PUBLIC-D1 anchor"
fi

ci_doc_trigger_anchor_mutation="$mutation_dir/ci-trigger-anchor-removed.md"
sed 's/CI-TRIGGER-D1/CI-TRIGGER-REMOVED/g' "$CI_DOC" > "$ci_doc_trigger_anchor_mutation"
if validate_public_actions_doc_contract "$ci_doc_trigger_anchor_mutation" "$DEV_WORKFLOW_DOC" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "public Actions docs validator accepted a missing CI-TRIGGER-D1 anchor"
fi

dev_workflow_trigger_mutation="$mutation_dir/dev-workflow-trigger-reference-removed.md"
sed 's/CI-TRIGGER-D1/CI-TRIGGER-REMOVED/g' "$DEV_WORKFLOW_DOC" > "$dev_workflow_trigger_mutation"
if validate_public_actions_doc_contract "$CI_DOC" "$dev_workflow_trigger_mutation" "$DECISION_LOG" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "public Actions docs validator accepted a missing DEV_WORKFLOW CI-TRIGGER-D1 reference"
fi

decision_log_d063_mutation="$mutation_dir/decision-log-d063-removed.md"
sed 's/^## D-063$/## D-063-REMOVED/' "$DECISION_LOG" > "$decision_log_d063_mutation"
if validate_public_actions_doc_contract "$CI_DOC" "$DEV_WORKFLOW_DOC" "$decision_log_d063_mutation" "$PLANS_DOC" "$PROJECT_HANDOFF_DOC" >/dev/null 2>&1; then
    fail "public Actions docs validator accepted a missing D-063 decision"
fi

m4_root="$mutation_dir/m4-root"
mkdir -p "$m4_root/docs/archive"
cp "$CI_DOC" "$m4_root/docs/ci.md"
cp "$DEV_WORKFLOW_DOC" "$m4_root/docs/DEV_WORKFLOW.md"
cp "$DECISION_LOG" "$m4_root/docs/decision-log.md"
cp "$PLANS_DOC" "$m4_root/docs/Plans.md"
cp "$PROJECT_HANDOFF_DOC" "$m4_root/docs/PROJECT_HANDOFF.md"
printf '%s\n' 'Historical policy: 75% and 90% private quota thresholds.' > "$m4_root/docs/archive/private-ci-history.md"
grep -Fq '75%' "$m4_root/docs/archive/private-ci-history.md" ||
    fail "M4 archive fixture is missing its historical private quota wording"
validate_public_actions_doc_contract \
    "$m4_root/docs/ci.md" \
    "$m4_root/docs/DEV_WORKFLOW.md" \
    "$m4_root/docs/decision-log.md" \
    "$m4_root/docs/Plans.md" \
    "$m4_root/docs/PROJECT_HANDOFF.md" ||
    fail "M4 public Actions docs validator scanned archive history as current policy"

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
