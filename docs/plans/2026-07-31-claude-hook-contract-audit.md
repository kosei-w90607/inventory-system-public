# Plan Packet: Claude hook contract audit

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex
- Writer: Codex
- Plan Reviewer: Claude Sonnet 5 / xHigh fresh context
- Final Reviewer: Double Audit（Claude Sonnet 5 / xHigh fresh context + Claude Opus 5 / xHigh fresh context・D-056 §5.4低制約profile）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Plan Gate approval pending

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 4

既定よりrelayを2回増やす。R3 workflow gate changeのPlan Review 1回、必要時closure 1回、Final Review Double Audit 2 passを同一change内で完了するため。P3だけの追加roundは行わない。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
Claude CodeのPreToolUse decision、project hook inventory、changed-area routing、local/hosted gateを変更する。誤ったallowはPlan Gateを見せかけにし、誤ったdenyは正当な作業を停止するためworkflow gate changeとしてR3。product runtime、DB、wire、operator UIは変更しない。

## Goal

Goal Invariant:

### 最小完了条件

- このrepositoryが所有するClaude hookのownerと効果がtracked sourceから一意に復元でき、repo-owned fixtureがproject settings、root解決、success/failure、stdout/stderr、exit codeを判別する。user-global層はlocal audit境界として明示する。
- 未監査pluginと虚偽の副作用通知を有効化せず、ExitPlanModeだけをrepository正本checkerへcwd非依存で接続する。

### 失敗定義

- command文字列だけでpush/tag/PR完了を通知する、read-only roleへtracked writeを命じる、subdirectory cwdでgateを迂回できる、missing/malformed inputをallowする、未監査pluginがdeny/askを出せる、またはhook testがlocal/hosted main pathへ接続されない。

### 非目的

- Claude Code本体、plugin cache、harnessのupgrade/修理、global permissions、Codex hook、product code、memory内容、一般的なshell parserの実装は行わない。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `.claude/settings.json`: `claude-code-harness`をproject scopeで明示無効化し、effective project hookを`PreToolUse(ExitPlanMode)` 1本にする。
- `.claude/hooks/check-plan-on-exit.sh`: `${CLAUDE_PROJECT_DIR}`起点、full docs/active Packet check、exit 0/2のfail-closed contractへ縮約する。
- `.claude/hooks/`の未接続7 scriptを削除し、`.claude/commands/plan-rally.md`をoptional helperへ訂正する。
- `CLAUDE.md`の2-hook / memory-hook記述、`docs/DEV_SETUP_CHECKLIST.md`のglobal-ignore / SessionStart記述、`docs/TOOLING_SKILL_COMMANDS.md`のplugin実効一覧をD-059へ同期する。
- `.gitignore`: `**/.claude/settings.local.json`をrepo-owned ignoreへ追加する。
- `scripts/tests/claude-hooks.test.sh`を新設し、settings inventory、hook wire、negative paths、mutation感度をsynthetic fixtureで検査する。
- `.claude/settings.json`、`.claude/hooks/**`、`.claude/commands/**`をworkflowへ分類するよう`classify-changes.sh`とfixture testを更新する。`.claude/skills/**`の既存docs routingは変えない。
- hook testを`local-ci.sh full/changed`とGitHub Actionsへ配線し、`codex-safe-wrappers.test.sh`、`classify-changes.test.sh`、`local-ci.test.sh`、`ci-workflow.test.sh`を追随させる。
- `docs/AGENT_OPERATING_MANUAL.md` §6.1、`docs/decision-log.md` D-059、`docs/DEV_WORKFLOW.md`、`docs/ci.md`、`docs/project-profile.md`、`Plans.md`、`PROJECT_HANDOFF.md`を同期する。

## Non-scope

- `/home/kosei/.claude/settings.json`の追加変更やtracked snapshot化。
- `/home/kosei/.claude/plugins/cache/**`のpatch、harness upgrade、個別plugin hook override。
- `.claude/state/**`の修復またはcommit。plugin無効化後のlocal残骸はevidenceでありruntime正本ではない。
- `.codex/**`、`.agents/**`、Rust、frontend、DB、Tauri、operator workflow。
- Git push / PR作成後のPlans更新通知の再導入。

## Acceptance Criteria

- `jq`でtracked settingsを列挙するとproject hookは`PreToolUse / ExitPlanMode / check-plan-on-exit.sh` 1件だけで、harnessは`false`。
- rootと`docs/` cwdのfixtureで同じcheckerが呼ばれ、`CLAUDE_PROJECT_DIR`欠落、checker欠落、checker exit nonzeroはexit 2、成功はexit 0。
- successはstdout/stderr空、failureはstdout空・bounded stderrにreasonを持つ。`permissionDecision: ask/allow`やadditionalContextを出さない。
- effective project hook/commandに`MANDATORY`、`git push`、`gh pr create`、memory write、agent-log 30分条件、model名がない。
- `.claude/settings.local.json`がrepository `.gitignore`のruleでignoreされる。
- `bash scripts/tests/claude-hooks.test.sh`が実contractでgreenとなり、key guard/settings/root/error mutantが各redになる。
- `.claude/settings.json`、`.claude/hooks/**`、`.claude/commands/**`だけのdiffが`workflow=true`かつ`unknown=false`になり、`.claude/skills/**`は既存どおりdocs routingを維持する。
- `bash scripts/local-ci.sh changed`とhosted CIがhook testを実行し、CI static testがstep削除をredにする。

## Design Sources

- Requirements / spec: not applicable（developer workflow）
- Architecture: `docs/AGENT_OPERATING_MANUAL.md` §6.1
- Function / command / DTO: [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks) / [Hooks guide](https://code.claude.com/docs/en/hooks-guide)
- DB: not applicable
- Screen / UI: not applicable
- Decision log / ADR: `docs/decision-log.md` D-059

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Claude hook ownership / runtime boundary | AGENT_OPERATING_MANUAL §6.1 | updated in plan-first change |
| Durable containment / adoption decision | decision-log D-059 | updated in plan-first change |
| Hook stdin/stdout/stderr/exit contract | Plan Boundary / Wire Contract + Matrix | updated in plan-first change |
| Claude live usage / setup inventory | `CLAUDE.md` / DEV_SETUP / TOOLING_SKILL_COMMANDS | implementation change |
| Local/hosted gate routing | DEV_WORKFLOW / ci.md | implementation change |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| `scripts/tests/claude-hooks.test.sh` | `local-ci.sh`、hosted CI、CI static testへ登録し、classifierが`.claude/**`をworkflowへ送る |
| tracked hook command | `.claude/settings.json`から`${CLAUDE_PROJECT_DIR}`絶対解決で1箇所だけ接続する |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-HOOK-01 | Manual §6.1 | D-059-H1 single owner | duplicate/global ownerを排除 | `.claude/settings.json` | CH1/CH2 |
| SPEC-HOOK-02 | Manual §6.1 | D-059-H2 fail-closed root | cwd allow bypassを排除 | `check-plan-on-exit.sh` | CH3〜CH8 |
| SPEC-HOOK-03 | Manual §6.1 | D-059-H3 bounded output | injected write指示を排除 | hook stdout/stderr | CH9〜CH11 |
| SPEC-HOOK-04 | Manual §6.1 | D-059-H4 permanent wiring | manual-only gateを排除 | local-ci / CI / classifier | CH12〜CH16 |

## Design Intent Audit

- Source docsはglobal/project/local/pluginのowner、decision/advisory境界、plugin containmentをchatなしで説明できる。
- durable decisionはD-059へ昇格した。global containmentの実ファイル内容はmachine-localなのでtracked docsへsnapshotしない。
- Claude Code 2.1.220と公式hook referenceをpremiseとし、将来変更はRevisit条件にした。
- MatrixはD-059-H1〜H4を参照する。
- 「誤発火ゼロ」の絶対保証は置かず、effective inventoryを1 decision hookへ縮約し、明示fixtureとruntime dogfoodで残余を観測する。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | Claude runtime adapterとrepo workflow coreを分離 | Manual §6.1 / D-059 |
| Fact check / design decision split | hook仕様とlocal実測をdecisionから分離 | Contract Probe |
| Lifecycle / retry | ExitPlanMode成功/失敗/再試行 | Matrix State Lifecycle |
| Operator workflow | not applicable | — |
| Replacement path | harness依存をrepo hookへ縮約 | settings + hook test |
| Data safety / evidence | global/local/plugin cacheをcommitしない | Data Safety |
| Reporting / accounting semantics | false completion通知を禁止 | D-059-H3 |
| Manual verification | real Claude session dogfoodはFinal Review前に1回 | PR body |

## Design Readiness

- Existing design docs are sufficient because: DEV_WORKFLOWがPlan GateとCIを所有し、§6.1がharness境界を補う。
- Source docs updated in this PR: Manual §6.1、D-059。
- Design gaps intentionally deferred: harness再採用・upgrade、global generic hook設計。
- Durable decisions discovered in this plan and promoted to source docs: single owner、plugin containment、exit 0/2、no semantic inference。

## Contract Probe

- Claude Code 2.1.220 official hook wire: `${CLAUDE_PROJECT_DIR}`、PreToolUse exit 2 block、exit 0 JSONなしallowを公式referenceで確認 -> proposed wireと一致。
- global PostToolUse false semantic inference: `rg -n "(git push"`で旧global hookが発火した実測を確認 -> 3 hookをcontainmentで削除、global hook count 0。
- project tag notification: `rg -n "git tag v1" docs` + success responseを入力すると`audit-trigger-phase.sh`が段階完了を出力 -> command text oracleをreject。
- project root binding: `cwd=.../docs`で現`check-plan-on-exit.sh`がchecker不在allow -> `${CLAUDE_PROJECT_DIR}`必須。
- plugin state: `.claude/state/session.json`は`jq -e` exit 5、line 14 parse error -> live baselineへ含めない。
- project plugin override: `claude --settings .claude/settings.json plugin list --json`でharness 2.7.4 `enabled:false` -> project単位containmentは実効。
- local ignore provenance: `git check-ignore -v`がuser-global ignoreだけを示す -> repo `.gitignore`追加が必要。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-059-H1 single project owner | settings / delete unused hooks / live docs | CH1/CH2/CH9 | global contentはnon-scope |
| D-059-H2 cwd-independent fail-closed | check-plan-on-exit | CH3〜CH8 | real ExitPlanMode dogfood |
| D-059-H3 no false completion/write injection | settings / optional plan-rally doc | CH9〜CH11 | memory content non-scope |
| D-059-H4 permanent gate wiring | classifier/local-ci/CI | CH12〜CH16 | hosted final required |
| local settings remain local | `.gitignore` | CH17 | local file内容non-scope |

## Test Plan

Test Design Matrix: [2026-07-31-claude-hook-contract-audit.md](test-matrices/2026-07-31-claude-hook-contract-audit.md)

- targeted tests: `bash scripts/tests/claude-hooks.test.sh`、classifier/local-ci/CI static fixture。
- negative tests: missing root/checker、checker nonzero、malformed settings、extra hook、plugin true、forbidden injection literal。
- compatibility checks: root/subdirectory cwd、paths with spaces synthetic root、Claude Code exit 0/2 contract。
- data safety checks: local/global/plugin filesがgit diffへ入らず、repository ignoreがlocal settingsを保護。
- main wiring/integration checks: `local-ci.sh changed`実行ログとhosted docs step。

## Boundary / Wire Contract

- producer: Claude Code `PreToolUse(ExitPlanMode)` hook runner。
- consumer: `.claude/hooks/check-plan-on-exit.sh`。
- wire type: stdin JSONは消費するがpolicy判断には使わない。project rootはenvironment `${CLAUDE_PROJECT_DIR}`。
- internal type: canonical absolute project root + checker exit status + bounded diagnostic text。
- precision/range: exit codeは0/2のみ。stderrは末尾20行以下、stdoutは常に空。
- round-trip path: settings command -> hook -> `scripts/doc-consistency-check.sh` -> exit 0/2。
- invalid input: root unset/non-directory、checker missing/non-executable、checker nonzeroはexit 2。
- compatibility: event cwd、user home、plugin state、model名に依存しない。

## Review Focus

- 8本から1本への縮約で、必要なPlan Gate contractまで落としていないか。
- hook success/failure oracleがstdoutとexit codeの片側だけを見ていないか。
- tracked settingsのplugin falseとignored local containmentの責務が混線していないか。
- `.claude/**`がlocal/hosted gateの実main pathへ接続されるか。
- testがsource scriptを呼ばずfixture copyだけを検証するtautologyになっていないか。

## Spec Contract

Contract ID: SPEC-HOOK-01

- effective inventoryはtracked project owner 1本、未監査plugin 0本。
- ExitPlanMode gateはcwd非依存でrepo checkerを実行し、検証不能をallowしない。
- hookは副作用完了やtracked writeをadditional contextとして注入しない。
- hook testはlocal/hosted双方のmain wiringに接続する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-HOOK-01/H1 | settings縮約 | CH1/CH2/CH9 | effective owner | test output / PR body |
| SPEC-HOOK-01/H2 | gate rewrite | CH3〜CH8 | fail-closed/root | test output / dogfood |
| SPEC-HOOK-01/H3 | advisory退役 | CH9〜CH11 | false claims/write injection | sweep |
| SPEC-HOOK-01/H4 | permanent wiring | CH12〜CH17 | local/hosted/classifier | local/hosted evidence |

## Data Safety

- `/home/kosei/.claude/settings.json`、plugin cache、`.claude/state/**`、`.claude/settings.local.json`をcommitしない。
- local-only: `.local/ci-evidence/`、hook runtime transcript、Claude memory、plugin state。
- synthetic-only: test fixtureのsettings、checker、hook input/output。

## Implementation Results

未着手。Plan Gate通過前にproject hook実装を変更しない。

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

## Narrative

- 2026-07-31 kickoff -> design -> plan-gate: ownerがglobal repo固有hook停止とproject harness無効化のcontainment、および別branchでのR3 Hook監査着手を承認。D-058 closeoutを先にmainへ確定した。現物読解とContract Probeでcommand text誤発火、nested cwd allow、malformed plugin stateを再現し、D-059 / Manual §6.1 / Packet / Matrixを起草した。次はplan-first commit後の独立Plan Review。
