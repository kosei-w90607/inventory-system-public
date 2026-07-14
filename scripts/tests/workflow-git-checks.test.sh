#!/usr/bin/env bash
# scripts/tests/workflow-git-checks.test.sh
# scripts/check-workflow-git.sh（PK5 / STATECAP）の synthetic git fixture repo テスト。
# 各シナリオは tmpdir に git init した使い捨て repo を構築し、正例/負例を判定する。
# 実 SHA（PR #165 等）は dangling で automated fixture には使えないため（Plan Gate R1）、
# ここでは全て test 自身が構築する commit 列のみを使う。
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECK_SCRIPT="$SOURCE_ROOT/scripts/check-workflow-git.sh"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local msg="$3"
    if ! printf '%s' "$haystack" | grep -Fq -- "$needle"; then
        fail "$msg (期待した文字列が出力に含まれない: $needle)"
    fi
}

assert_not_contains() {
    local haystack="$1"
    local needle="$2"
    local msg="$3"
    if printf '%s' "$haystack" | grep -Fq -- "$needle"; then
        fail "$msg (含まれてはいけない文字列が出力に含まれる: $needle)"
    fi
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

init_repo() {
    local repo="$1"
    mkdir -p "$repo"
    git -C "$repo" init -q -b main
    git -C "$repo" config user.name test
    git -C "$repo" config user.email test@example.invalid
}

commit_all() {
    local repo="$1"
    local subject="$2"
    git -C "$repo" add -A
    git -C "$repo" commit -q -m "$subject"
    git -C "$repo" rev-parse HEAD
}

write_packet() {
    local repo="$1"
    local packet_name="$2"
    local plan_commit="$3"
    local amendments="$4"
    mkdir -p "$repo/docs/plans"
    cat > "$repo/docs/plans/$packet_name" <<EOF
# Test Packet

## Workflow State

- Plan Commit: ${plan_commit}
- Amendments: ${amendments}
EOF
}

run_check() {
    local repo="$1"
    (cd "$repo" && bash "$CHECK_SCRIPT" 2>&1)
}

# state-only 遷移 commit を作る際、コミット対象の差分がないと `git commit` が
# 失敗するため、ダミーのログファイルへの追記を伴わせる（内容は STATECAP の判定に
# 影響しない。state-only prefix 一致時はファイル一覧チェックを行わないため）。
state_only_commit() {
    local repo="$1"
    local subject="$2"
    printf '%s\n' "$subject" >> "$repo/.state-log"
    commit_all "$repo" "$subject" > /dev/null
}

# set -e 環境下で non-zero 終了を安全に捕捉するためのラッパー。
# 呼び出し後、変数 CHECK_STATUS に終了コードが入る。
CHECK_STATUS=0
capture_check() {
    local repo="$1"
    local -n __out_ref="$2"
    set +e
    __out_ref="$(run_check "$repo")"
    CHECK_STATUS=$?
    set -e
}

# ============================================================================
# PK5: ancestry 正例（plan-first が実装 commit の祖先）
# ============================================================================
repo="$tmp/pk5-ancestry-ok"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null

write_packet "$repo" "packet.md" "pending" "none"
a_sha="$(commit_all "$repo" "docs(plans): plan-first")"

write_packet "$repo" "packet.md" "$a_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null

printf 'impl\n' > "$repo/impl.txt"
commit_all "$repo" "feat: implement" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "ancestry 正例が ERROR 判定された:\n$output"
assert_not_contains "$output" "PK5:" "ancestry 正例で PK5 出力が発生した"

# ============================================================================
# PK5: squash 相当の負例（squash merge 後は ancestor でない）
# ============================================================================
repo="$tmp/pk5-squash-negative"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null
git -C "$repo" branch feature

git -C "$repo" switch -q feature
write_packet "$repo" "packet.md" "pending" "none"
a_sha="$(commit_all "$repo" "docs(plans): plan-first")"
write_packet "$repo" "packet.md" "$a_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null
printf 'impl\n' > "$repo/impl.txt"
commit_all "$repo" "feat: implement" > /dev/null

git -C "$repo" switch -q main
git -C "$repo" merge -q --squash feature > /dev/null
commit_all "$repo" "feat: implement (squashed)" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "squash 後の非 ancestor が ERROR 判定されなかった"
assert_contains "$output" "は現在の HEAD の祖先ではありません" "squash 負例で ancestry ERROR が出力されない"

# ============================================================================
# PK5: Plan Commit 書き換え検出（ancestry は成立するが原本改変）
# ============================================================================
repo="$tmp/pk5-rewrite"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null

write_packet "$repo" "packet.md" "pending" "none"
a_sha="$(commit_all "$repo" "docs(plans): plan-first")"

write_packet "$repo" "packet.md" "$a_sha" "none"
b_sha="$(commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved")"

printf 'impl\n' > "$repo/impl.txt"
commit_all "$repo" "feat: implement" > /dev/null

# 不正な書き換え: original を b_sha に差し替える（b_sha 自体は HEAD の祖先なので
# ancestry 検査だけでは検出できず、rewrite 検出が唯一の網であることを確認する）
write_packet "$repo" "packet.md" "$b_sha" "none"
commit_all "$repo" "docs(plans): Plan Commit を修正" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "Plan Commit 書き換えが ERROR 判定されなかった"
assert_contains "$output" "書き換えられています" "書き換え検出 ERROR が出力されない"
assert_not_contains "$output" "は現在の HEAD の祖先ではありません" "書き換えテストで無関係な ancestry ERROR も発生した（テスト設計の分離が崩れている）"

# ============================================================================
# PK5: Amendments 追記型の正例（original 不変 + Amendments 追記）
# ============================================================================
repo="$tmp/pk5-amendments-ok"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null

write_packet "$repo" "packet.md" "pending" "none"
a_sha="$(commit_all "$repo" "docs(plans): plan-first")"

write_packet "$repo" "packet.md" "$a_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null

printf 'impl\n' > "$repo/impl.txt"
c_sha="$(commit_all "$repo" "feat: implement")"

write_packet "$repo" "packet.md" "$a_sha" "$c_sha"
commit_all "$repo" "docs(plans): gated amendment を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "Amendments 追記正例が ERROR 判定された:\n$output"
assert_not_contains "$output" "PK5:" "Amendments 正例で PK5 出力が発生した"

# ============================================================================
# PK5: Amendments 非 descendant の負例（並行ブランチの SHA を記録）
# ============================================================================
repo="$tmp/pk5-amendments-non-descendant"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null

git -C "$repo" branch plan-branch
git -C "$repo" branch unrelated-branch

git -C "$repo" switch -q plan-branch
write_packet "$repo" "packet.md" "pending" "none"
a_sha="$(commit_all "$repo" "docs(plans): plan-first")"
write_packet "$repo" "packet.md" "$a_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null

git -C "$repo" switch -q unrelated-branch
printf 'unrelated\n' > "$repo/unrelated.txt"
u_sha="$(commit_all "$repo" "chore: unrelated parallel work")"

git -C "$repo" switch -q main
git -C "$repo" merge -q --no-edit plan-branch > /dev/null
git -C "$repo" merge -q --no-edit unrelated-branch > /dev/null

# unrelated-branch の U は main の祖先だが、plan-branch の A の子孫ではない
write_packet "$repo" "packet.md" "$a_sha" "$u_sha"
commit_all "$repo" "docs(plans): gated amendment を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "非 descendant の Amendments が ERROR 判定されなかった"
assert_contains "$output" "の descendant ではありません" "非 descendant ERROR が出力されない"
assert_not_contains "$output" "は現在の HEAD の祖先ではありません" "非 descendant テストで無関係な ancestor-of-HEAD ERROR も発生した"

# ============================================================================
# PK5: pending は skip（ERROR/WARN いずれも出さない）
# ============================================================================
repo="$tmp/pk5-pending-skip"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null
write_packet "$repo" "packet.md" "pending" "none"
commit_all "$repo" "docs(plans): plan-draft" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "pending packet で誤って ERROR になった:\n$output"
assert_not_contains "$output" "PK5:" "pending packet で PK5 出力が発生した（skip されていない）"

# ============================================================================
# STATECAP: state-only 3 件（post-impl 2 件）は pass、4 件目で ERROR
# ============================================================================
repo="$tmp/statecap-total-cap"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
base_sha="$(commit_all "$repo" "base")"
git -C "$repo" update-ref refs/remotes/origin/main "$base_sha"

state_only_commit "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved"
state_only_commit "$repo" "docs(plans): state-only遷移 local-verified->independent-review->human-confirm"
state_only_commit "$repo" "docs(plans): state-only遷移 human-confirm->ready-hosted-final"

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "state-only 3件（post-impl 2件）が誤って ERROR になった:\n$output"
assert_not_contains "$output" "STATECAP:" "3件時点で STATECAP 出力が発生した"

state_only_commit "$repo" "docs(plans): state-only遷移 plan-draft->plan-gate"
capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "state-only 4件目が ERROR 判定されなかった"
assert_contains "$output" "上限 3 件を超えています" "4件目の上限超過 ERROR が出力されない"
assert_not_contains "$output" "上限 2 件を超えています" "4件目テストで post-impl 上限 ERROR も誤って発生した（分離できていない）"

# ============================================================================
# STATECAP: post-implementation 相当が 3 件目で ERROR（total は 3 件のまま）
# ============================================================================
repo="$tmp/statecap-post-impl-cap"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
base_sha="$(commit_all "$repo" "base")"
git -C "$repo" update-ref refs/remotes/origin/main "$base_sha"

state_only_commit "$repo" "docs(plans): state-only遷移 local-verified->independent-review"
state_only_commit "$repo" "docs(plans): state-only遷移 independent-review->human-confirm"
state_only_commit "$repo" "docs(plans): state-only遷移 human-confirm->ready-hosted-final"

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "post-implementation 相当 3件目が ERROR 判定されなかった"
assert_contains "$output" "post-implementation 相当" "post-impl 上限超過 ERROR が出力されない"
assert_not_contains "$output" "上限 3 件を超えています" "post-impl テストで total 上限 ERROR も誤って発生した（分離できていない、total=3 は超過していない想定）"

# ============================================================================
# STATECAP: prefix なし plans-only commit は WARN、docs/Plans.md + docs/archive/plans/
# に跨る commit は plans-only 扱いされない（境界）
# ============================================================================
repo="$tmp/statecap-warn-and-boundary"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
mkdir -p "$repo/docs/plans" "$repo/docs/archive/plans"
printf 'base\n' > "$repo/docs/Plans.md"
base_sha="$(commit_all "$repo" "base")"
git -C "$repo" update-ref refs/remotes/origin/main "$base_sha"

# prefix なしの plans-only commit（ラベル逃れ）-> WARN
printf 'update\n' > "$repo/docs/plans/other-packet.md"
commit_all "$repo" "docs(plans): 提案を更新" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "prefix なし plans-only commit が誤って ERROR になった:\n$output"
assert_contains "$output" "prefix がありません" "prefix なし plans-only commit で WARN が出力されない"

# 境界: docs/Plans.md（docs/plans/ 配下ではない）+ docs/archive/plans/ に跨る commit は
# 「docs/plans/ 配下のみ」の条件を満たさないため WARN 対象外であること
warn_count_before="$(printf '%s' "$output" | grep -Fc "prefix がありません" || true)"
printf 'archived\n' > "$repo/docs/archive/plans/old.md"
printf 'sync\n' >> "$repo/docs/Plans.md"
commit_all "$repo" "docs(plans): archive 同期" > /dev/null

capture_check "$repo" output2
[[ "$CHECK_STATUS" -eq 0 ]] || fail "境界 commit のテストで誤って ERROR になった:\n$output2"
warn_count_after="$(printf '%s' "$output2" | grep -Fc "prefix がありません" || true)"
[[ "$warn_count_after" -eq "$warn_count_before" ]] ||
    fail "docs/Plans.md + docs/archive/plans/ に跨る commit が誤って plans-only WARN 対象になった（境界 regex が甘い）"

# ============================================================================
# D-046 T3: forward 3件 + 正当な単一 backward は STATECAP 対象外で PASS
# ============================================================================
repo="$tmp/statecap-backtrack-exempt"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
base_sha="$(commit_all "$repo" "base")"
git -C "$repo" update-ref refs/remotes/origin/main "$base_sha"

state_only_commit "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved"
state_only_commit "$repo" "docs(plans): state-only遷移 local-verified->independent-review->human-confirm"
state_only_commit "$repo" "docs(plans): state-only遷移 human-confirm->ready-hosted-final"
state_only_commit "$repo" "docs(plans): state-backtrack ready-hosted-final->implementing"

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "正当な state-backtrack が ERROR 判定された:\n$output"
assert_not_contains "$output" "上限 3 件を超えています" "backtrack が forward STATECAP に算入された"

# ============================================================================
# D-046 Double Audit A-P2: 連続 state-backtrack はチェーン分割回避として ERROR、
# 実作業 commit を挟んだ複数回補正は PASS
# ============================================================================
repo="$tmp/statecap-backtrack-consecutive"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
base_sha="$(commit_all "$repo" "base")"
git -C "$repo" update-ref refs/remotes/origin/main "$base_sha"

state_only_commit "$repo" "docs(plans): state-backtrack merge->ready-hosted-final"
state_only_commit "$repo" "docs(plans): state-backtrack ready-hosted-final->implementing"

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "連続 state-backtrack が ERROR にならなかった（チェーン分割による cap 回避が素通り）:\n$output"
assert_contains "$output" "連続で記録できません" "連続 backtrack の ERROR が識別できない"

repo="$tmp/statecap-backtrack-separated"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
base_sha="$(commit_all "$repo" "base")"
git -C "$repo" update-ref refs/remotes/origin/main "$base_sha"

state_only_commit "$repo" "docs(plans): state-backtrack merge->ready-hosted-final"
printf 'work\n' > "$repo/README.md"
commit_all "$repo" "fix: 補正間の実作業" > /dev/null
state_only_commit "$repo" "docs(plans): state-backtrack ready-hosted-final->implementing"

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "実作業 commit を挟んだ複数回 state-backtrack が誤って ERROR になった:\n$output"

# ============================================================================
# D-046 T4: state-backtrack は単一 backward 遷移だけを許容
# ============================================================================
assert_invalid_backtrack() {
    local name="$1"
    local subject="$2"
    local repo="$tmp/state-backtrack-${name}"
    local output

    init_repo "$repo"
    printf 'base\n' > "$repo/README.md"
    local base_sha
    base_sha="$(commit_all "$repo" "base")"
    git -C "$repo" update-ref refs/remotes/origin/main "$base_sha"
    state_only_commit "$repo" "$subject"

    capture_check "$repo" output
    [[ "$CHECK_STATUS" -ne 0 ]] || fail "不正な state-backtrack '$subject' が ERROR 判定されなかった"
    assert_contains "$output" "state-backtrack" "不正 backtrack の ERROR が識別できない"
}

assert_invalid_backtrack "forward" "docs(plans): state-backtrack design->plan-draft"
assert_invalid_backtrack "chain" "docs(plans): state-backtrack ready-hosted-final->implementing->design"
assert_invalid_backtrack "unknown" "docs(plans): state-backtrack ready-hosted-final->unknown-phase"
assert_invalid_backtrack "zero" "docs(plans): state-backtrack"
assert_invalid_backtrack "same" "docs(plans): state-backtrack implementing->implementing"

echo "PASS: workflow-git-checks"
