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

append_rebase_map() {
    local repo="$1"
    local packet_name="$2"
    local old_sha="$3"
    local new_sha="$4"
    printf '\nRebase Map: %s -> %s\n' "$old_sha" "$new_sha" >> "$repo/docs/plans/$packet_name"
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
# D-055 T-PK5: conflict-free rebase の Rebase Map 正例
# ============================================================================
repo="$tmp/pk5-rebase-map-ok"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null
git -C "$repo" branch feature

git -C "$repo" switch -q feature
write_packet "$repo" "packet.md" "pending" "none"
old_plan_sha="$(commit_all "$repo" "docs(plans): plan-first")"
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null
printf 'impl\n' > "$repo/impl.txt"
commit_all "$repo" "feat: implement" > /dev/null

git -C "$repo" switch -q main
printf 'main advance\n' > "$repo/main.txt"
commit_all "$repo" "chore: advance main" > /dev/null
git -C "$repo" switch -q feature
git -C "$repo" rebase main > /dev/null
new_plan_sha="$(git -C "$repo" log --format=%H --grep='^docs(plans): plan-first$' -1)"

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "Rebase Map なしの非 ancestor が ERROR 判定されなかった"
assert_contains "$output" "は現在の HEAD の祖先ではありません" "Rebase Map なし負例で ancestry ERROR が出力されない"

append_rebase_map "$repo" "packet.md" "$old_plan_sha" "$new_plan_sha"
commit_all "$repo" "docs(plans): rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "patch-id 同値の Rebase Map 正例が ERROR 判定された:\n$output"
assert_not_contains "$output" "PK5:" "Rebase Map 正例で PK5 出力が発生した"

# ============================================================================
# D-055 T-PK5: patch-id 同値証明のない Rebase Map は escape hatch にしない
# ============================================================================
repo="$tmp/pk5-rebase-map-patch-id-negative"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null
git -C "$repo" branch feature

git -C "$repo" switch -q feature
write_packet "$repo" "packet.md" "pending" "none"
old_plan_sha="$(commit_all "$repo" "docs(plans): plan-first")"
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null

git -C "$repo" switch -q main
printf 'different patch\n' > "$repo/unrelated.txt"
different_sha="$(commit_all "$repo" "chore: unrelated mapped commit")"
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
append_rebase_map "$repo" "packet.md" "$old_plan_sha" "$different_sha"
commit_all "$repo" "docs(plans): invalid rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "patch-id 非同値の Rebase Map が ERROR 判定されなかった"
assert_contains "$output" "patch-id が同値ではありません" "Rebase Map escape hatch 負例で patch-id ERROR が出力されない"

# ============================================================================
# D-055 T-PK5b: 2 回の rebase を表す多段 chain 正例 / stale old SHA の負例
# ============================================================================
repo="$tmp/pk5-rebase-map-multi-hop"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null
git -C "$repo" branch feature

git -C "$repo" switch -q feature
write_packet "$repo" "packet.md" "pending" "none"
old_plan_sha="$(commit_all "$repo" "docs(plans): plan-first")"
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null
printf 'impl\n' > "$repo/impl.txt"
commit_all "$repo" "feat: implement" > /dev/null

git -C "$repo" switch -q main
printf 'main advance 1\n' > "$repo/main-1.txt"
commit_all "$repo" "chore: advance main first" > /dev/null
git -C "$repo" switch -q feature
git -C "$repo" rebase main > /dev/null
middle_plan_sha="$(git -C "$repo" log --format=%H --grep='^docs(plans): plan-first$' -1)"

git -C "$repo" switch -q main
printf 'main advance 2\n' > "$repo/main-2.txt"
commit_all "$repo" "chore: advance main second" > /dev/null
git -C "$repo" switch -q feature
git -C "$repo" rebase main > /dev/null
new_plan_sha="$(git -C "$repo" log --format=%H --grep='^docs(plans): plan-first$' -1)"

append_rebase_map "$repo" "packet.md" "$old_plan_sha" "$middle_plan_sha"
append_rebase_map "$repo" "packet.md" "$middle_plan_sha" "$new_plan_sha"
commit_all "$repo" "docs(plans): multi-hop rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "多段 Rebase Map chain 正例が ERROR 判定された:\n$output"
assert_not_contains "$output" "PK5:" "多段 Rebase Map chain 正例で PK5 出力が発生した"

# chain の末尾まで到達した後に stale old SHA を再利用する Map は、旧 SHA 不一致。
append_rebase_map "$repo" "packet.md" "$old_plan_sha" "$new_plan_sha"
commit_all "$repo" "docs(plans): broken rebase map chain を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "stale old SHA で途切れた Rebase Map chain が ERROR 判定されなかった"
assert_contains "$output" "old SHA '$old_plan_sha' が重複しています" "duplicate-old guard 固有の ERROR が出力されない"

# 同じ patch-id の edge が同じ new SHA へ収束する graph も chain 不整合。
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
append_rebase_map "$repo" "packet.md" "$old_plan_sha" "$middle_plan_sha"
append_rebase_map "$repo" "packet.md" "$new_plan_sha" "$middle_plan_sha"
commit_all "$repo" "docs(plans): duplicate target rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "複数 old SHA が同じ new SHA へ接続する Map が ERROR 判定されなかった"
assert_contains "$output" "複数の old SHA" "duplicate-new の chain ERROR が出力されない"

# 同じ patch-id の commit を循環させても ancestry escape hatch にしない。
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
append_rebase_map "$repo" "packet.md" "$old_plan_sha" "$middle_plan_sha"
append_rebase_map "$repo" "packet.md" "$middle_plan_sha" "$new_plan_sha"
append_rebase_map "$repo" "packet.md" "$new_plan_sha" "$old_plan_sha"
commit_all "$repo" "docs(plans): cyclic rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "循環する Rebase Map chain が ERROR 判定されなかった"
assert_contains "$output" "Rebase Map chain" "循環 Rebase Map chain の ERROR が出力されない"

# 旧 / 新 object の一方でも local に無ければ fail-closed。
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
append_rebase_map "$repo" "packet.md" "$old_plan_sha" "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
commit_all "$repo" "docs(plans): unresolved rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "解決不能 object を持つ Rebase Map が ERROR 判定されなかった"
assert_contains "$output" "Rebase Map SHA を解決できません" "解決不能 object の ERROR が出力されない"

# ============================================================================
# D-055 T-PK5c: Plan Commit と gated Amendment をともに rebase した正例 /
# Amendment 側 Rebase Map 欠落の負例
# ============================================================================
repo="$tmp/pk5-rebase-map-amendment"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
commit_all "$repo" "base" > /dev/null
git -C "$repo" branch feature

git -C "$repo" switch -q feature
write_packet "$repo" "packet.md" "pending" "none"
old_plan_sha="$(commit_all "$repo" "docs(plans): plan-first")"
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null
printf 'impl\n' > "$repo/impl.txt"
commit_all "$repo" "feat: implement" > /dev/null
printf 'amendment one\n' > "$repo/amendment-one.txt"
old_amendment_one_sha="$(commit_all "$repo" "docs(plans): gated amendment content one")"
printf 'amendment two\n' > "$repo/amendment-two.txt"
old_amendment_two_sha="$(commit_all "$repo" "docs(plans): gated amendment content two")"
write_packet "$repo" "packet.md" "$old_plan_sha" "$old_amendment_one_sha, $old_amendment_two_sha"
commit_all "$repo" "docs(plans): gated amendment を記録" > /dev/null

git -C "$repo" switch -q main
printf 'main advance\n' > "$repo/main.txt"
commit_all "$repo" "chore: advance main for amendment rebase" > /dev/null
git -C "$repo" switch -q feature
git -C "$repo" rebase main > /dev/null
new_plan_sha="$(git -C "$repo" log --format=%H --grep='^docs(plans): plan-first$' -1)"
new_amendment_one_sha="$(git -C "$repo" log --format=%H --grep='^docs(plans): gated amendment content one$' -1)"
new_amendment_two_sha="$(git -C "$repo" log --format=%H --grep='^docs(plans): gated amendment content two$' -1)"

append_rebase_map "$repo" "packet.md" "$old_plan_sha" "$new_plan_sha"
commit_all "$repo" "docs(plans): plan rebase map のみ記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "Amendment 側 Rebase Map 欠落が ERROR 判定されなかった"
assert_contains "$output" "Amendments SHA" "Amendment 側 Rebase Map 欠落を識別する ERROR が出力されない"
assert_contains "$output" "は現在の HEAD の祖先ではありません" "Amendment 側 Rebase Map 欠落で ancestry ERROR が出力されない"

append_rebase_map "$repo" "packet.md" "$old_amendment_one_sha" "$new_amendment_one_sha"
commit_all "$repo" "docs(plans): first amendment rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "2 件目の Amendment 側 Rebase Map 欠落が ERROR 判定されなかった"
assert_contains "$output" "$old_amendment_two_sha" "2 件目の Amendment Map 欠落を識別する ERROR が出力されない"

append_rebase_map "$repo" "packet.md" "$old_amendment_two_sha" "$new_amendment_two_sha"
commit_all "$repo" "docs(plans): second amendment rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -eq 0 ]] || fail "Plan Commit と Amendment の Rebase Map 正例が ERROR 判定された:\n$output"
assert_not_contains "$output" "PK5:" "Plan Commit と Amendment の Rebase Map 正例で PK5 出力が発生した"

# ============================================================================
# D-055 T-PK5c: 別 original root への Map 接続は独立 chain を潰すため拒否
# ============================================================================
repo="$tmp/pk5-rebase-map-cross-root"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
write_packet "$repo" "packet.md" "pending" "none"
commit_all "$repo" "base" > /dev/null
git -C "$repo" branch feature

git -C "$repo" switch -q feature
printf 'same patch\n' > "$repo/same.txt"
old_plan_sha="$(commit_all "$repo" "docs(plans): plan-first")"
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null
git -C "$repo" rm -q same.txt
commit_all "$repo" "test: prepare repeated patch" > /dev/null
printf 'same patch\n' > "$repo/same.txt"
old_amendment_sha="$(commit_all "$repo" "docs(plans): gated amendment repeated patch")"
write_packet "$repo" "packet.md" "$old_plan_sha" "$old_amendment_sha"
commit_all "$repo" "docs(plans): gated amendment を記録" > /dev/null

git -C "$repo" switch -q main
printf 'main advance\n' > "$repo/main.txt"
commit_all "$repo" "chore: advance main for cross-root rebase" > /dev/null
git -C "$repo" switch -q feature
git -C "$repo" rebase main > /dev/null
new_amendment_sha="$(git -C "$repo" log --format=%H --grep='^docs(plans): gated amendment repeated patch$' -1)"

append_rebase_map "$repo" "packet.md" "$old_plan_sha" "$old_amendment_sha"
append_rebase_map "$repo" "packet.md" "$old_amendment_sha" "$new_amendment_sha"
commit_all "$repo" "docs(plans): cross-root rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "Plan Commit root を Amendment root へ吸収する Map が ERROR 判定されなかった"
assert_contains "$output" "別 root" "cross-root Rebase Map の ERROR が出力されない"

# ============================================================================
# D-055 T-PK5c: patch-id 同値でも root から孤立した Map edge は拒否
# ============================================================================
repo="$tmp/pk5-rebase-map-orphan"
init_repo "$repo"
printf 'base\n' > "$repo/README.md"
write_packet "$repo" "packet.md" "pending" "none"
commit_all "$repo" "base" > /dev/null
git -C "$repo" branch feature

git -C "$repo" switch -q feature
printf 'plan patch\n' > "$repo/plan.txt"
old_plan_sha="$(commit_all "$repo" "docs(plans): plan-first")"
write_packet "$repo" "packet.md" "$old_plan_sha" "none"
commit_all "$repo" "docs(plans): state-only遷移 plan-gate->plan-approved" > /dev/null

git -C "$repo" switch -q main
printf 'main advance one\n' > "$repo/main-one.txt"
commit_all "$repo" "chore: orphan base one" > /dev/null
git -C "$repo" switch -q -c orphan-old
git -C "$repo" cherry-pick "$old_plan_sha" > /dev/null
orphan_old_sha="$(git -C "$repo" rev-parse HEAD)"

git -C "$repo" switch -q main
printf 'main advance two\n' > "$repo/main-two.txt"
commit_all "$repo" "chore: orphan base two" > /dev/null
git -C "$repo" switch -q -c orphan-new
git -C "$repo" cherry-pick "$old_plan_sha" > /dev/null
orphan_new_sha="$(git -C "$repo" rev-parse HEAD)"

git -C "$repo" switch -q feature
append_rebase_map "$repo" "packet.md" "$orphan_old_sha" "$orphan_new_sha"
commit_all "$repo" "docs(plans): orphan rebase map を記録" > /dev/null

capture_check "$repo" output
[[ "$CHECK_STATUS" -ne 0 ]] || fail "root から孤立した Rebase Map edge が ERROR 判定されなかった"
assert_contains "$output" "root に接続していません" "孤立 Rebase Map edge の ERROR が出力されない"

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
