#!/usr/bin/env bash
# scripts/doc-consistency-check.sh の PK3 (test_token_exists)、PK4
# (check_plan_packet_workflow_state) と PK1 拡張
# (Owner Effort Budget / Contract Probe 必須化) を synthetic fixture で検証する。
# fixture はすべて本 test 自身が tmpdir に生成し、tracked fixture file は増やさない。
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

assert_contains() {
    local file="$1"
    local pattern="$2"
    grep -Fq -- "$pattern" "$file" || fail "$file does not contain: $pattern"
}

assert_not_contains() {
    local file="$1"
    local pattern="$2"
    if grep -Fq -- "$pattern" "$file"; then
        fail "$file unexpectedly contains: $pattern"
    fi
}

assert_helper_calls_have_no_negative_globs() {
    local file="$1"
    local line arg cluster option pattern
    local helper_calls=0
    local i
    local -a call_args=()

    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            CALL)
                call_args=()
                ;;
            ARG$'\t'*)
                call_args+=("${line#*$'\t'}")
                ;;
            END)
                helper_calls=$((helper_calls + 1))
                i=0
                while [ "$i" -lt "${#call_args[@]}" ]; do
                    arg="${call_args[$i]}"
                    pattern=""
                    case "$arg" in
                        --glob)
                            i=$((i + 1))
                            [ "$i" -lt "${#call_args[@]}" ] ||
                                fail "captured helper call has --glob without a pattern"
                            pattern="${call_args[$i]}"
                            ;;
                        --glob=*)
                            pattern="${arg#--glob=}"
                            ;;
                        -[^-]*)
                            cluster="${arg#-}"
                            while [ -n "$cluster" ]; do
                                option="${cluster%"${cluster#?}"}"
                                cluster="${cluster#?}"
                                case "$option" in
                                    g)
                                        pattern="$cluster"
                                        if [ -z "$pattern" ]; then
                                            i=$((i + 1))
                                            [ "$i" -lt "${#call_args[@]}" ] ||
                                                fail "captured helper call has -g without a pattern"
                                            pattern="${call_args[$i]}"
                                        fi
                                        cluster=""
                                        ;;
                                    e|f|E|m|j|d|t|T|A|B|C|M|r)
                                        if [ -z "$cluster" ]; then
                                            i=$((i + 1))
                                            [ "$i" -lt "${#call_args[@]}" ] ||
                                                fail "captured helper call has -$option without a value"
                                        fi
                                        cluster=""
                                        ;;
                                esac
                            done
                            ;;
                    esac
                    if [[ "$pattern" == !* ]]; then
                        fail "captured helper call contains a negative glob: $arg $pattern"
                    fi
                    i=$((i + 1))
                done
                ;;
        esac
    done < "$file"

    [ "$helper_calls" -gt 0 ] ||
        fail "rg shim did not capture a tests/src/src-tauri helper call"
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"
mkdir -p "$repo/docs/plans" "$repo/docs/function-design"
git init -q "$repo"
cp "$SOURCE_ROOT/scripts/doc-consistency-check.sh" "$repo/doc-consistency-check.sh"

write_rg_call_log() {
    local file="$1"
    shift
    {
        echo "CALL"
        for arg in "$@" tests src src-tauri; do
            printf 'ARG\t%s\n' "$arg"
        done
        echo "END"
    } > "$file"
}

assert_glob_guard_accepts() {
    local label="$1"
    shift
    local file="$tmp/rg-argv-accept.log"
    write_rg_call_log "$file" "$@"
    assert_helper_calls_have_no_negative_globs "$file" ||
        fail "glob argv guard rejected legal short-option grammar: $label"
}

assert_glob_guard_rejects() {
    local label="$1"
    shift
    local file="$tmp/rg-argv-reject.log"
    write_rg_call_log "$file" "$@"
    if (assert_helper_calls_have_no_negative_globs "$file" >/dev/null 2>&1); then
        fail "glob argv guard accepted a negative glob: $label"
    fi
}

# A value-taking short option consumes the remainder of its cluster (or the
# following argv), so a later "g" is data rather than another option.
assert_glob_guard_accepts "-qeg!x" "-qeg!x"
assert_glob_guard_accepts "-qe g!x" "-qe" "g!x"
assert_glob_guard_accepts "-qAg!1" "-qAg!1"
assert_glob_guard_accepts "-qA g!1" "-qA" "g!1"
assert_glob_guard_accepts "-gq!x" "-gq!x"
assert_glob_guard_rejects "-uvqg !x" "-uvqg" "!x"
assert_glob_guard_rejects "-uvqg!x" "-uvqg!x"

real_rg="$(command -v rg)"
rg_shim_dir="$tmp/bin"
rg_argv_log="$tmp/rg-argv.log"
mkdir -p "$rg_shim_dir"
cat > "$rg_shim_dir/rg" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail

args=("$@")
argc=${#args[@]}
if [ -n "${RG_ARGV_LOG:-}" ] && [ "$argc" -ge 3 ] \
    && [ "${args[$((argc - 3))]}" = "tests" ] \
    && [ "${args[$((argc - 2))]}" = "src" ] \
    && [ "${args[$((argc - 1))]}" = "src-tauri" ]; then
    {
        echo "CALL"
        for arg in "$@"; do
            printf 'ARG\t%s\n' "$arg"
        done
        echo "END"
    } >> "$RG_ARGV_LOG"
fi

exec "$REAL_RG" "$@"
SHIM
chmod +x "$rg_shim_dir/rg"

# check_signature_cross_reference (既存 C2、本 test の対象外) は
# docs/function-design/*.md に '^fn ' 行が1件も無いと rg が no-match で
# 非0終了し、後続処理を伴わずに `set -e` で落ちる（下流の | sort -u に
# pipefail 未フォールバックのため）。実リポジトリでは常に一致がある前提の
# 既存挙動であり本 test の対象ではないため、fixture 側でダミー関数定義を
# 1件用意して既存挙動を壊さず回避する。
printf 'fn dummy_fixture_fn(x: i32) -> i32\n' > "$repo/docs/function-design/00-dummy.md"

out="$tmp/out.log"

setup_repo_dirs() {
    rm -rf "$repo/docs/plans" "$repo/docs/archive"
    mkdir -p "$repo/docs/plans"
}

write_plans_md_linking() {
    {
        echo "# Plans"
        echo ""
        echo "## 次の行動"
        echo ""
        local basename
        for basename in "$@"; do
            echo "1. fixture entry: [plans/${basename}](plans/${basename})"
        done
    } > "$repo/docs/Plans.md"
}

write_plans_md_no_link() {
    {
        echo "# Plans"
        echo ""
        echo "## 次の行動"
        echo ""
        echo "1. fixture entry: (リンクなし)"
    } > "$repo/docs/Plans.md"
}

write_plans_md_text_only() {
    local basename="$1"
    {
        echo "# Plans"
        echo ""
        echo "## 次の行動"
        echo ""
        echo "1. fixture entry mentions ${basename} without a Markdown link"
    } > "$repo/docs/Plans.md"
}

write_plans_md_hidden_links() {
    local fenced_basename="$1"
    local comment_basename="$2"
    {
        echo "# Plans"
        echo ""
        echo "## 次の行動"
        echo ""
        echo '```markdown'
        echo "1. fixture entry: [plans/${fenced_basename}](plans/${fenced_basename})"
        echo '```'
        echo ""
        echo "<!--"
        echo "1. fixture entry: [plans/${comment_basename}](plans/${comment_basename})"
        echo "-->"
    } > "$repo/docs/Plans.md"
}

write_plans_md_mixed_fence_and_inline_code() {
    local fenced_basename="$1"
    local inline_basename="$2"
    {
        echo "# Plans"
        echo ""
        echo "## 次の行動"
        echo ""
        echo '```markdown'
        echo "~~~"
        echo "1. fixture entry: [plans/${fenced_basename}](plans/${fenced_basename})"
        echo '```'
        echo ""
        echo "1. inline code only: \`[plans/${inline_basename}](plans/${inline_basename})\`"
    } > "$repo/docs/Plans.md"
}

write_plans_md_escaped_link() {
    local basename="$1"
    {
        echo "# Plans"
        echo ""
        echo "## 次の行動"
        echo ""
        echo "1. escaped syntax only: \\[plans/${basename}](plans/${basename})"
    } > "$repo/docs/Plans.md"
}

write_plans_md_double_inline_code() {
    local basename="$1"
    {
        echo "# Plans"
        echo ""
        echo "## 次の行動"
        echo ""
        printf '1. double-code: `` `[plans/%s](plans/%s)` ``\n' "$basename" "$basename"
    } > "$repo/docs/Plans.md"
}

write_plans_md_multiline_inline_code() {
    local basename="$1"
    {
        echo "# Plans"
        echo ""
        echo "## 次の行動"
        echo ""
        echo '1. multiline code only: `'
        echo "[plans/${basename}](plans/${basename})"
        echo '`'
    } > "$repo/docs/Plans.md"
}

reset_packet_defaults() {
    PKT_INCLUDE_WS=1
    PKT_PHASE="implementing"
    PKT_WS_RISK="R3"
    PKT_EXEC_MODE="fable-window"
    PKT_PLAN_COMMIT="abc1234"
    PKT_RISK_SECTION="R3"
    PKT_INCLUDE_OWNER_BUDGET=1
    PKT_INCLUDE_R3_SECTIONS=1
    PKT_INCLUDE_CONTRACT_PROBE=1
    PKT_INCLUDE_FINDINGS_FREEZE=1
    PKT_INCLUDE_GOAL_INVARIANT=1
    PKT_TRACE_TEST_CELL='`bash` fixture test'
    PKT_CONTRACT_PROBE_LINE="- fixture premise: verified via fixture experiment -> result ok"
    PKT_REVIEW_RESPONSE_EXTRA=""
}

write_packet() {
    local path="$1"
    {
        echo "# Fixture Plan Packet"
        echo ""
        if [ "$PKT_INCLUDE_WS" = "1" ]; then
            echo "## Workflow State"
            echo ""
            echo "- Phase: ${PKT_PHASE}"
            echo "- Risk: ${PKT_WS_RISK}"
            echo "- Execution Mode: ${PKT_EXEC_MODE}"
            echo "- Plan Commit: ${PKT_PLAN_COMMIT}"
            echo "- Amendments: none"
            echo ""
        fi
        if [ "$PKT_INCLUDE_OWNER_BUDGET" = "1" ]; then
            echo "## Owner Effort Budget"
            echo ""
            echo "- 介入回数上限: 3"
            echo ""
        fi
        echo "## Risk"
        echo ""
        echo "Risk: ${PKT_RISK_SECTION}"
        echo ""
        echo "Reason: fixture packet for automated PK4/PK1EXT tests."
        echo ""
        echo "## Goal"
        echo ""
        if [ "$PKT_INCLUDE_GOAL_INVARIANT" = "1" ]; then
            echo "Goal Invariant:"
            echo ""
            echo "### 最小完了条件"
            echo ""
            echo "- fixture outcome"
            echo ""
            echo "### 失敗定義"
            echo ""
            echo "- fixture failure"
            echo ""
            echo "### 非目的"
            echo ""
            echo "- fixture non-goal"
        else
            echo "fixture goal line"
        fi
        echo ""
        echo "## Scope"
        echo ""
        echo "1. fixture scope item"
        echo ""
        echo "## Non-scope"
        echo ""
        echo "- fixture non-scope item"
        echo ""
        echo "## Acceptance Criteria"
        echo ""
        echo '- `bash scripts/doc-consistency-check.sh` returns exit 0 for this fixture'
        echo ""
        echo "## Test Plan"
        echo ""
        echo 'Test Design Matrix: `docs/plans/test-matrices/fixture.md`'
        echo ""
        echo "- targeted tests: fixture only"
        echo ""
        echo "## Review Focus"
        echo ""
        echo "- fixture review focus item"
        echo ""
        if [ "$PKT_INCLUDE_R3_SECTIONS" = "1" ]; then
            echo "## Spec Contract"
            echo ""
            echo "Contract ID: SPEC-FIXTURE"
            echo ""
            echo "- SPEC-FIXTURE: fixture contract line"
            echo ""
            echo "## Trace Matrix"
            echo ""
            echo "| Spec ID | Plan Step | Test | Review Focus | Evidence |"
            echo "|---|---|---|---|---|"
            echo "| SPEC-FIXTURE | Scope 1 | ${PKT_TRACE_TEST_CELL} | Review Focus | fixture evidence |"
            echo ""
            echo "## Data Safety"
            echo ""
            echo "- fixture data safety line"
            echo ""
        fi
        if [ "$PKT_INCLUDE_CONTRACT_PROBE" = "1" ]; then
            echo "## Contract Probe"
            echo ""
            echo "$PKT_CONTRACT_PROBE_LINE"
            echo ""
        fi
        echo "## Review Response"
        echo ""
        if [ "$PKT_INCLUDE_FINDINGS_FREEZE" = "1" ]; then
            echo "- Findings Freeze: frozen after fixture Broad Audit"
        fi
        if [ -n "${PKT_REVIEW_RESPONSE_EXTRA:-}" ]; then
            echo ""
            echo "$PKT_REVIEW_RESPONSE_EXTRA"
        fi
    } > "$path"
}

run_check() {
    local target="${1:-}"
    (
        cd "$repo"
        if [ -n "$target" ]; then
            PATH="$rg_shim_dir:$PATH" REAL_RG="$real_rg" RG_ARGV_LOG="$rg_argv_log" \
                bash doc-consistency-check.sh --target plan "$target"
        else
            PATH="$rg_shim_dir:$PATH" REAL_RG="$real_rg" RG_ARGV_LOG="$rg_argv_log" \
                bash doc-consistency-check.sh --target plan
        fi
    ) > "$out" 2>&1
}

# --- 1. 正例: 現行 packet と同形式の synthetic fixture は ERROR 0 ---
setup_repo_dirs
reset_packet_defaults
write_packet "$repo/docs/plans/2026-01-01-fixture.md"
write_plans_md_linking "2026-01-01-fixture.md"
if ! run_check "docs/plans/2026-01-01-fixture.md"; then
    cat "$out" >&2
    fail "valid fixture packet was unexpectedly rejected"
fi
assert_contains "$out" "PK4: Workflow State machine 整合 OK"
assert_not_contains "$out" "Goal Invariant 構造に"

# --- 1b. SPEC-WF-PK3-TOKEN: 3 root canary / ignore / WARN exit / argv guard ---
setup_repo_dirs
reset_packet_defaults
PKT_TRACE_TEST_CELL="test_pk3_tests_root / test_pk3_src_root / test_pk3_src_tauri_root / test_pk3_ignored_only"
write_packet "$repo/docs/plans/2026-01-01-pk3-fixture.md"
write_plans_md_linking "2026-01-01-pk3-fixture.md"
mkdir -p \
    "$repo/tests" \
    "$repo/src/target" \
    "$repo/src/node_modules" \
    "$repo/src/dist" \
    "$repo/src-tauri"
printf 'test test_pk3_tests_root\n' > "$repo/tests/pk3_canary.sh"
printf 'it("test_pk3_src_root")\n' > "$repo/src/pk3_canary.ts"
printf 'fn test_pk3_src_tauri_root() {}\n' > "$repo/src-tauri/pk3_canary.rs"
printf 'fn test_pk3_ignored_only() {}\n' > "$repo/src/target/pk3_ignored.rs"
printf 'fn test_pk3_ignored_only() {}\n' > "$repo/src/node_modules/pk3_ignored.ts"
printf 'fn test_pk3_ignored_only() {}\n' > "$repo/src/dist/pk3_ignored.ts"
printf 'target/\nnode_modules/\ndist/\n' > "$repo/.gitignore"
: > "$rg_argv_log"
if ! run_check "docs/plans/2026-01-01-pk3-fixture.md"; then
    cat "$out" >&2
    fail "PK3 token fixture unexpectedly exited nonzero"
fi
assert_not_contains "$out" 'test token `test_pk3_tests_root` が tests/src/src-tauri に見つかりません'
assert_not_contains "$out" 'test token `test_pk3_src_root` が tests/src/src-tauri に見つかりません'
assert_not_contains "$out" 'test token `test_pk3_src_tauri_root` が tests/src/src-tauri に見つかりません'
assert_contains "$out" 'PK3: docs/plans/2026-01-01-pk3-fixture.md (R3) の Trace Matrix test token `test_pk3_ignored_only` が tests/src/src-tauri に見つかりません'
assert_helper_calls_have_no_negative_globs "$rg_argv_log"

# --- 2. '## Workflow State' セクション自体が欠落 ---
setup_repo_dirs
reset_packet_defaults
PKT_INCLUDE_WS=0
write_packet "$repo/docs/plans/2026-01-02-fixture.md"
write_plans_md_linking "2026-01-02-fixture.md"
if run_check "docs/plans/2026-01-02-fixture.md"; then
    fail "missing '## Workflow State' section was not rejected"
fi
assert_contains "$out" "必須セクション '## Workflow State' を欠いています"

# --- 3. Phase が 13 phase enum 外 ---
setup_repo_dirs
reset_packet_defaults
PKT_PHASE="review"
write_packet "$repo/docs/plans/2026-01-03-fixture.md"
write_plans_md_linking "2026-01-03-fixture.md"
if run_check "docs/plans/2026-01-03-fixture.md"; then
    fail "Phase enum outside 13 values was not rejected"
fi
assert_contains "$out" "13 phase enum に含まれません"

# --- 4. Workflow State '- Risk:' と '## Risk' セクションの不一致 ---
setup_repo_dirs
reset_packet_defaults
PKT_WS_RISK="R2"
write_packet "$repo/docs/plans/2026-01-04-fixture.md"
write_plans_md_linking "2026-01-04-fixture.md"
if run_check "docs/plans/2026-01-04-fixture.md"; then
    fail "Risk mismatch between Workflow State and Risk section was not rejected"
fi
assert_contains "$out" "と不一致です"

# --- 5. Execution Mode が既定3値外 ---
setup_repo_dirs
reset_packet_defaults
PKT_EXEC_MODE="waterfall"
write_packet "$repo/docs/plans/2026-01-05-fixture.md"
write_plans_md_linking "2026-01-05-fixture.md"
if run_check "docs/plans/2026-01-05-fixture.md"; then
    fail "Execution Mode outside 3 enum values was not rejected"
fi
assert_contains "$out" "既定の3値"

# --- 6. R3 packet で Findings Freeze 行欠落 ---
setup_repo_dirs
reset_packet_defaults
PKT_INCLUDE_FINDINGS_FREEZE=0
write_packet "$repo/docs/plans/2026-01-06-fixture.md"
write_plans_md_linking "2026-01-06-fixture.md"
if run_check "docs/plans/2026-01-06-fixture.md"; then
    fail "missing Findings Freeze line at R3 was not rejected"
fi
assert_contains "$out" "Findings Freeze:' 行がありません"

# --- 7. Phase が plan-approved 以降なのに Plan Commit が pending ---
setup_repo_dirs
reset_packet_defaults
PKT_PHASE="implementing"
PKT_PLAN_COMMIT="pending"
write_packet "$repo/docs/plans/2026-01-07-fixture.md"
write_plans_md_linking "2026-01-07-fixture.md"
if run_check "docs/plans/2026-01-07-fixture.md"; then
    fail "Phase implementing with Plan Commit pending was not rejected"
fi
assert_contains "$out" "Plan Commit:' が pending のままです"

# --- 8. Owner Effort Budget 欠落（PK1 拡張、R2+ 必須） ---
setup_repo_dirs
reset_packet_defaults
PKT_INCLUDE_OWNER_BUDGET=0
write_packet "$repo/docs/plans/2026-01-08-fixture.md"
write_plans_md_linking "2026-01-08-fixture.md"
if run_check "docs/plans/2026-01-08-fixture.md"; then
    fail "missing Owner Effort Budget section was not rejected"
fi
assert_contains "$out" "必須セクション '## Owner Effort Budget' を欠いています"

# --- 9. Contract Probe 欠落（PK1 拡張、R3+ 必須） ---
setup_repo_dirs
reset_packet_defaults
PKT_INCLUDE_CONTRACT_PROBE=0
write_packet "$repo/docs/plans/2026-01-09-fixture.md"
write_plans_md_linking "2026-01-09-fixture.md"
if run_check "docs/plans/2026-01-09-fixture.md"; then
    fail "missing Contract Probe section at R3 was not rejected"
fi
assert_contains "$out" "必須セクション '## Contract Probe' を欠いています"

# --- 10. R2 では Contract Probe は非必須（regression: 過剰検出しないこと） ---
setup_repo_dirs
reset_packet_defaults
PKT_PHASE="plan-draft"
PKT_WS_RISK="R2"
PKT_PLAN_COMMIT="pending"
PKT_RISK_SECTION="R2"
PKT_INCLUDE_R3_SECTIONS=0
PKT_INCLUDE_CONTRACT_PROBE=0
PKT_INCLUDE_FINDINGS_FREEZE=0
write_packet "$repo/docs/plans/2026-01-10-fixture.md"
write_plans_md_linking "2026-01-10-fixture.md"
if ! run_check "docs/plans/2026-01-10-fixture.md"; then
    cat "$out" >&2
    fail "R2 packet without Contract Probe was incorrectly rejected"
fi
assert_not_contains "$out" "Contract Probe"

# --- 11. D-055 T-PK4a/b: 複数 active packet は全 packet の「次の行動」link を必須化 ---
setup_repo_dirs
reset_packet_defaults
write_packet "$repo/docs/plans/2026-01-11-fixture-a.md"
write_packet "$repo/docs/plans/2026-01-11-fixture-b.md"
write_plans_md_linking "2026-01-11-fixture-a.md" "2026-01-11-fixture-b.md"
if ! run_check ""; then
    cat "$out" >&2
    fail "multiple active packets with complete Plans.md links were unexpectedly rejected"
fi
assert_contains "$out" "PK4: Workflow State machine 整合 OK"

write_plans_md_linking "2026-01-11-fixture-a.md"
if run_check ""; then
    fail "an active packet missing from Plans.md was not rejected"
fi
assert_contains "$out" "active packet '2026-01-11-fixture-b.md' へのリンクが見つかりません"

write_plans_md_text_only "2026-01-11-fixture-a.md"
if run_check ""; then
    fail "a plain-text packet basename was incorrectly accepted as a Plans.md link"
fi
assert_contains "$out" "active packet '2026-01-11-fixture-a.md' へのリンクが見つかりません"

# --- 11c. D-055 T-PK4c: code fence / HTML comment 内の見かけ上の link は無効 ---
write_plans_md_hidden_links "2026-01-11-fixture-a.md" "2026-01-11-fixture-b.md"
if run_check ""; then
    fail "links visible only inside a code fence or HTML comment were incorrectly accepted"
fi
assert_contains "$out" "active packet '2026-01-11-fixture-a.md' へのリンクが見つかりません"
assert_contains "$out" "active packet '2026-01-11-fixture-b.md' へのリンクが見つかりません"

write_plans_md_mixed_fence_and_inline_code \
    "2026-01-11-fixture-a.md" "2026-01-11-fixture-b.md"
if run_check ""; then
    fail "mixed fence delimiters or inline code exposed a non-rendered link"
fi
assert_contains "$out" "active packet '2026-01-11-fixture-a.md' へのリンクが見つかりません"
assert_contains "$out" "active packet '2026-01-11-fixture-b.md' へのリンクが見つかりません"

write_plans_md_double_inline_code "2026-01-11-fixture-a.md"
if run_check ""; then
    fail "a double-backtick code span exposed a non-rendered link"
fi
assert_contains "$out" "active packet '2026-01-11-fixture-a.md' へのリンクが見つかりません"

write_plans_md_multiline_inline_code "2026-01-11-fixture-a.md"
if run_check ""; then
    fail "a multiline code span exposed a non-rendered link"
fi
assert_contains "$out" "active packet '2026-01-11-fixture-a.md' へのリンクが見つかりません"

write_plans_md_escaped_link "2026-01-11-fixture-a.md"
if run_check ""; then
    fail "escaped Markdown syntax was incorrectly accepted as a rendered link"
fi
assert_contains "$out" "active packet '2026-01-11-fixture-a.md' へのリンクが見つかりません"

# --- 12. active packet と docs/Plans.md「次の行動」リンクの不一致 ---
setup_repo_dirs
reset_packet_defaults
write_packet "$repo/docs/plans/2026-01-12-fixture.md"
write_plans_md_no_link
if run_check "docs/plans/2026-01-12-fixture.md"; then
    fail "missing Plans.md link to the active packet was not rejected"
fi
assert_contains "$out" "へのリンクが見つかりません"

# --- 13. compatibility: docs/archive/ 配下へ明示パスで渡した場合は PK4 の新チェックを skip ---
# 実在の archive packet と同じ状態（Workflow State / Owner Effort Budget / Contract Probe が
# いずれも無い、D-039 導入前の R3 packet）を再構成する（Double Audit pass1 P1 反映）
setup_repo_dirs
reset_packet_defaults
PKT_INCLUDE_WS=0
PKT_INCLUDE_OWNER_BUDGET=0
PKT_INCLUDE_CONTRACT_PROBE=0
PKT_INCLUDE_FINDINGS_FREEZE=0
mkdir -p "$repo/docs/archive/plans"
write_packet "$repo/docs/archive/plans/2020-01-01-archived-fixture.md"
if ! run_check "docs/archive/plans/2020-01-01-archived-fixture.md"; then
    cat "$out" >&2
    fail "archived packet path unexpectedly triggered a new PK1/PK4 error"
fi
assert_not_contains "$out" "docs/archive/plans/2020-01-01-archived-fixture.md (R3) は必須セクション '## Workflow State' を欠いています"
assert_not_contains "$out" "必須セクション '## Owner Effort Budget' を欠いています"
assert_not_contains "$out" "必須セクション '## Contract Probe' を欠いています"

# --- 14. enum 全値の positive 網羅: 13 phase / 3 exec mode がすべて enum 判定を通る ---
# （Double Audit pass1 P3-1 反映: enum 文字列からの token 欠落を検出できる網）
for phase in kickoff spec-check design plan-draft plan-gate plan-approved implementing \
    local-verified independent-review human-confirm ready-hosted-final merge archive; do
    setup_repo_dirs
    reset_packet_defaults
    PKT_PHASE="$phase"
    # plan-approved 以降の phase では Plan Commit: pending が field 関係 ERROR になるため実値を置く
    case "$phase" in
        plan-approved|implementing|local-verified|independent-review|human-confirm|ready-hosted-final|merge|archive)
            PKT_PLAN_COMMIT="ffffff1" ;;
    esac
    write_packet "$repo/docs/plans/2026-01-14-fixture.md"
    write_plans_md_linking "2026-01-14-fixture.md"
    if ! run_check "docs/plans/2026-01-14-fixture.md"; then
        cat "$out" >&2
        fail "valid phase enum value '$phase' was rejected"
    fi
done
for mode in fable-window dual-vendor-no-fable codex-only; do
    setup_repo_dirs
    reset_packet_defaults
    PKT_EXEC_MODE="$mode"
    write_packet "$repo/docs/plans/2026-01-14-fixture.md"
    write_plans_md_linking "2026-01-14-fixture.md"
    if ! run_check "docs/plans/2026-01-14-fixture.md"; then
        cat "$out" >&2
        fail "valid execution mode enum value '$mode' was rejected"
    fi
done

# --- 15. D-046 T1: active packet の Goal Invariant 構造欠落は WARN、archive は遡及対象外 ---
setup_repo_dirs
reset_packet_defaults
PKT_INCLUDE_GOAL_INVARIANT=0
write_packet "$repo/docs/plans/2026-07-15-goal-invariant-missing.md"
write_plans_md_linking "2026-07-15-goal-invariant-missing.md"
if ! run_check "docs/plans/2026-07-15-goal-invariant-missing.md"; then
    cat "$out" >&2
    fail "Goal Invariant 欠落 WARN fixture が ERROR になった"
fi
assert_contains "$out" "D-046: docs/plans/2026-07-15-goal-invariant-missing.md の Goal Invariant 構造に"

setup_repo_dirs
reset_packet_defaults
PKT_INCLUDE_GOAL_INVARIANT=0
mkdir -p "$repo/docs/archive/plans"
write_plans_md_no_link
write_packet "$repo/docs/archive/plans/2026-07-15-archived-goal-invariant-missing.md"
if ! run_check "docs/archive/plans/2026-07-15-archived-goal-invariant-missing.md"; then
    cat "$out" >&2
    fail "archived Goal Invariant compatibility fixture が ERROR になった"
fi
assert_not_contains "$out" "D-046: docs/archive/plans/2026-07-15-archived-goal-invariant-missing.md"

# --- 16. D-046 T5: 2026-07-15 以降の WER は Retired 節必須（WARN）、既存日付は遡及対象外 ---
setup_repo_dirs
reset_packet_defaults
write_packet "$repo/docs/plans/2026-07-15-wer-retired-fixture.md"
write_plans_md_linking "2026-07-15-wer-retired-fixture.md"
mkdir -p "$repo/docs/archive/plans"
printf '# Workflow Effectiveness Review\n' > "$repo/docs/archive/plans/2026-07-15-fixture-workflow-effectiveness-review.md"
if ! run_check "docs/plans/2026-07-15-wer-retired-fixture.md"; then
    cat "$out" >&2
    fail "Retired 節欠落 WARN fixture が ERROR になった"
fi
assert_contains "$out" "D-046: docs/archive/plans/2026-07-15-fixture-workflow-effectiveness-review.md は '## Retired / Consolidated Rules' を欠いています"

printf '# Workflow Effectiveness Review\n\n## Retired / Consolidated Rules\n' > "$repo/docs/archive/plans/2026-07-15-fixture-workflow-effectiveness-review.md"
if ! run_check "docs/plans/2026-07-15-wer-retired-fixture.md"; then
    cat "$out" >&2
    fail "空 Retired 節 WARN fixture が ERROR になった"
fi
assert_contains "$out" "Retired / Consolidated Rules' が空です"

printf '# Workflow Effectiveness Review\n\n## Retired / Consolidated Rules\n\nTemplate guidance.\n\n- ...\n' > "$repo/docs/archive/plans/2026-07-15-fixture-workflow-effectiveness-review.md"
if ! run_check "docs/plans/2026-07-15-wer-retired-fixture.md"; then
    cat "$out" >&2
    fail "Retired placeholder WARN fixture が ERROR になった"
fi
assert_contains "$out" "具体的な item または理由付き none がありません"

printf '# Workflow Effectiveness Review\n\n## Retired / Consolidated Rules\n\n- none\n' > "$repo/docs/archive/plans/2026-07-15-fixture-workflow-effectiveness-review.md"
if ! run_check "docs/plans/2026-07-15-wer-retired-fixture.md"; then
    cat "$out" >&2
    fail "理由なし none WARN fixture が ERROR になった"
fi
assert_contains "$out" "具体的な item または理由付き none がありません"

printf '# Workflow Effectiveness Review\n\n## Retired / Consolidated Rules\n\n- none: fixture では net rule growth なし\n' > "$repo/docs/archive/plans/2026-07-15-fixture-workflow-effectiveness-review.md"
if ! run_check "docs/plans/2026-07-15-wer-retired-fixture.md"; then
    cat "$out" >&2
    fail "有効な Retired 節 fixture が ERROR になった"
fi
assert_not_contains "$out" "Retired / Consolidated Rules' が空です"
assert_not_contains "$out" "具体的な item または理由付き none がありません"

rm "$repo/docs/archive/plans/2026-07-15-fixture-workflow-effectiveness-review.md"
printf '# Workflow Effectiveness Review\n' > "$repo/docs/archive/plans/2026-07-14-fixture-workflow-effectiveness-review.md"
if ! run_check "docs/plans/2026-07-15-wer-retired-fixture.md"; then
    cat "$out" >&2
    fail "既存日付 WER compatibility fixture が ERROR になった"
fi
assert_not_contains "$out" "D-046: docs/archive/plans/2026-07-14-fixture-workflow-effectiveness-review.md"

# --- 17. D-046 T2/T6: template と source docs の規範 token drift ---
assert_contains "$SOURCE_ROOT/docs/templates/plan-packet.md" "介入 N"
assert_contains "$SOURCE_ROOT/docs/templates/plan-packet.md" "予算 M"
draft_pr_section="$(awk '
    /^## Draft PR Checkpoint$/ { in_section=1 }
    in_section && /^## / && $0 != "## Draft PR Checkpoint" { exit }
    in_section { print }
' "$SOURCE_ROOT/docs/DEV_WORKFLOW.md")"
printf '%s\n' "$draft_pr_section" | grep -Fq "Human Gate" || fail "Draft PR Checkpoint に Human Gate 欄がない"
printf '%s\n' "$draft_pr_section" | grep -Fq "この change での介入 N 回目 / 予算 M 回" ||
    fail "Draft PR Checkpoint に承認依頼カウンタがない"
assert_contains "$SOURCE_ROOT/docs/DEV_WORKFLOW.md" "candidate safety"
assert_contains "$SOURCE_ROOT/docs/DEV_WORKFLOW.md" "mutation authority"
assert_contains "$SOURCE_ROOT/docs/DEV_WORKFLOW.md" "evidence quality"
assert_contains "$SOURCE_ROOT/docs/DEV_WORKFLOW.md" "actual harm path"
assert_contains "$SOURCE_ROOT/docs/DEV_WORKFLOW.md" "affected candidate or mutation"
assert_contains "$SOURCE_ROOT/docs/DEV_WORKFLOW.md" "non-destructive revalidation"
assert_contains "$SOURCE_ROOT/docs/DEV_WORKFLOW.md" "blocker reason"
assert_contains "$SOURCE_ROOT/docs/DEV_WORKFLOW.md" "goal-drift signal"
assert_contains "$SOURCE_ROOT/docs/DEV_WORKFLOW.md" "one-shot irreversible"
assert_contains "$SOURCE_ROOT/docs/AGENT_OPERATING_MANUAL.md" "one-shot irreversible"
assert_contains "$SOURCE_ROOT/docs/AGENT_OPERATING_MANUAL.md" "task-shape"
assert_contains "$SOURCE_ROOT/docs/decision-log.md" "## D-046"

# --- 18. D-046 T8: 両 script の順序付き phase 配列 parity ---
doc_phases="$(sed -n 's/^WORKFLOW_STATE_PHASES="\([^"]*\)"/\1/p' "$SOURCE_ROOT/scripts/doc-consistency-check.sh")"
git_phases="$(sed -n 's/^WORKFLOW_STATE_PHASES="\([^"]*\)"/\1/p' "$SOURCE_ROOT/scripts/check-workflow-git.sh")"
[[ -n "$doc_phases" ]] || fail "doc-consistency-check.sh の WORKFLOW_STATE_PHASES を抽出できない"
[[ -n "$git_phases" ]] || fail "check-workflow-git.sh の WORKFLOW_STATE_PHASES を抽出できない"
[[ "$doc_phases" = "$git_phases" ]] || fail "WORKFLOW_STATE_PHASES が両 script で不一致"

# --- 19. D-046 T7: 実 repository の checker self-pass ---
if ! (cd "$SOURCE_ROOT" && bash scripts/doc-consistency-check.sh > "$tmp/self-pass.log" 2>&1); then
    cat "$tmp/self-pass.log" >&2
    fail "実 repository の doc-consistency-check.sh が ERROR"
fi

# --- 20. D-062 PK6: 数値主張の実測 evidence heuristic（X1 red / X2 green / X3 mutation） ---
# D-059 round1（未実測、commit 4c4284f）/ round2（実測併記、commit 863c25b）の実文言を
# Contract Probe へ注入し、Contract Probe の Test Design Matrix X1/X2/X3 と同一実証を
# スクリプト経由で再現する。

# X1: red fixture（round1 相当、backtick なし）は WARN が発火する
setup_repo_dirs
reset_packet_defaults
PKT_CONTRACT_PROBE_LINE="- P2-1 problem claimをaccept。strict mode + trapによるscript-controlled非0の2正規化と、outer 30秒より短い内部20秒 + kill-after 2秒deadlineを契約・AC・Matrixへ追加した。"
write_packet "$repo/docs/plans/2026-01-20-pk6-red.md"
write_plans_md_linking "2026-01-20-pk6-red.md"
if ! run_check "docs/plans/2026-01-20-pk6-red.md"; then
    cat "$out" >&2
    fail "PK6 red fixture が exit code に影響した（WARN-only のはず）"
fi
assert_contains "$out" "PK6: docs/plans/2026-01-20-pk6-red.md (R3) の Contract Probe/Review Response に実測 evidence のない数値主張があります"

# X2: green fixture（round2 相当、backtick でコマンド参照あり）は WARN が発火しない
setup_repo_dirs
reset_packet_defaults
PKT_CONTRACT_PROBE_LINE='- checker runtime（同一WSL2 warm state）: `scripts/doc-consistency-check.sh` fullは33.53 / 33.70 / 33.64秒、`--target plan`は20.73 / 20.01秒。'
write_packet "$repo/docs/plans/2026-01-20-pk6-green.md"
write_plans_md_linking "2026-01-20-pk6-green.md"
if ! run_check "docs/plans/2026-01-20-pk6-green.md"; then
    cat "$out" >&2
    fail "PK6 green fixture が exit code に影響した"
fi
assert_not_contains "$out" "PK6: docs/plans/2026-01-20-pk6-green.md"
assert_contains "$out" "PK6: 数値主張の実測 evidence 欠落 OK"

# X3: green fixture から backtick span のみを除去した mutant は WARN が発火する（red 化）
setup_repo_dirs
reset_packet_defaults
PKT_CONTRACT_PROBE_LINE="- checker runtime（同一WSL2 warm state）: scripts/doc-consistency-check.sh fullは33.53 / 33.70 / 33.64秒、--target planは20.73 / 20.01秒。"
write_packet "$repo/docs/plans/2026-01-20-pk6-mutant.md"
write_plans_md_linking "2026-01-20-pk6-mutant.md"
if ! run_check "docs/plans/2026-01-20-pk6-mutant.md"; then
    cat "$out" >&2
    fail "PK6 mutant fixture が exit code に影響した"
fi
assert_contains "$out" "PK6: docs/plans/2026-01-20-pk6-mutant.md (R3) の Contract Probe/Review Response に実測 evidence のない数値主張があります"

# Negative path: Contract Probe セクション自体が無い packet（R2、既存 test #10 と同じ構成 —
# Contract Probe は R3+ でのみ必須のため R2 では section 自体が欠落しても PK1 拡張は発火しない）
# は PK6 が skip し、ERROR にも WARN にもならないこと
setup_repo_dirs
reset_packet_defaults
PKT_PHASE="plan-draft"
PKT_WS_RISK="R2"
PKT_PLAN_COMMIT="pending"
PKT_RISK_SECTION="R2"
PKT_INCLUDE_R3_SECTIONS=0
PKT_INCLUDE_CONTRACT_PROBE=0
PKT_INCLUDE_FINDINGS_FREEZE=0
write_packet "$repo/docs/plans/2026-01-20-pk6-no-section.md"
write_plans_md_linking "2026-01-20-pk6-no-section.md"
if ! run_check "docs/plans/2026-01-20-pk6-no-section.md"; then
    cat "$out" >&2
    fail "Contract Probe 欠落 packet が PK6 で誤って ERROR/WARN になった"
fi
assert_not_contains "$out" "PK6: docs/plans/2026-01-20-pk6-no-section.md"
assert_contains "$out" "PK6: 数値主張の実測 evidence 欠落 OK"

echo "PASS: doc-consistency-plan-packet"
