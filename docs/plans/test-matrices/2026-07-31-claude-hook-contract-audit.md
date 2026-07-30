# Test Design Matrix: Claude hook contract audit

## Risk

Risk: R3

## Contracts Under Test

- D-059-H1: tracked project settingsだけがrepo hookを所有し、harnessは無効。
- D-059-H2: ExitPlanMode gateは`${CLAUDE_PROJECT_DIR}`起点でfail-closed。
- D-059-H3: effective hookは虚偽完了・tracked write・model固有reviewを注入しない。
- D-059-H4: hook testと`.claude/**` routingがlocal/hosted main pathへ接続される。

## Failure Modes

- extra hookまたはpluginがhidden decision layerを復活させる。
- cwdがsubdirectory、root/checker欠落、checker failureでもallowする。
- checkerの想定外exitまたはhangがClaude Codeの0/2以外fail-openへ漏れる。
- exit codeだけgreenでstdout/stderrが壊れる、またはdiagnosticがunbounded。
- command文字列の検索・dry-runを副作用完了と誤認する。
- test scriptは存在するがclassifier/local-ci/hostedから呼ばれない。
- machine-global ignoreだけに依存してlocal settingsが別machineでtracked候補になる。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| H1 | extra project hook | config | CH1 `inventory_is_exact` | hook event/matcher/commandが1件以外 |
| H1 | harness再有効化 | config | CH2 `harness_is_project_disabled` | enabledPluginsが欠落/true |
| H2 | root cwdだけで通る | integration | CH3 `root_success` | canonical checker成功がexit 0でない |
| H2 | nested cwd bypass | integration | CH4 `nested_cwd_same_result` | event cwdに依存する |
| H2 | root unset | negative | CH5 `missing_project_root_blocks` | exit 0/1で進む |
| H2 | checker missing | negative | CH6 `missing_checker_blocks` | exit 2でない |
| H2 | checker failure | negative | CH7 `checker_failure_blocks` | failureをallowする |
| H2 | malformed stdin | negative | CH8 `stdin_not_authority` | stdinのcwd/commandでrootを上書きできる |
| H2 | unexpected internal failure | negative/mutation | CH8A `unexpected_nonzero_normalizes_to_block` | checker exit 1/126/127またはtrap可能な内部故障がexit 2以外になる |
| H2 | checker hang | timeout | CH8B `checker_deadline_blocks_before_runner_timeout` | 20秒超checkerがouter 30秒より前にbounded stderr + exit 2にならない |
| H3 | output contract drift | wire | CH9 `output_is_bounded` | success stdout/stderr非空、failure stdout非空、stderr20行超 |
| H3 | write/false completion注入 | static | CH10 `forbidden_context_absent` | effective settings/scriptに禁止literal |
| H3 | model-specific review gate | static | CH11 `review_policy_not_in_hook` | model/agent log/30分/Self-Reviewを強制 |
| H4 | settings/hooks/commands unknown routing | classifier | CH12 `claude_paths_are_workflow` | workflow=falseまたはunknown=true、またはskillsがworkflowへ過剰分類 |
| H4 | local gate未接続 | integration | CH13 `local_ci_runs_hook_test` | workflow changeでtestが呼ばれない |
| H4 | hosted未接続 | static/mutation | CH14 `hosted_runs_hook_test` | CI step削除でgreen |
| H4 | static test未接続 | mutation | CH15 `ci_test_guards_hook_step` | command literal mutationをkillしない |
| H4 | source testでない | anti-tautology | CH16 `test_executes_tracked_hook` |fixture再実装だけでもgreen |
| local boundary | global ignore依存 | gitignore | CH17 `local_settings_repo_ignored` | repository rule欠落 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| ExitPlanMode | tool call proposed | checker running（inner deadline 20s / kill-after 2s、outer 30s） | exit 0、normal Claude permission flow | Packet/doc edit | next invocation | next plan | session restart | exit 2 + bounded stderr | fix docs and retry | CH3〜CH9 |
| harness containment | user true / project false | Claude config resolution | effective false | tracked/local setting change | plugin list | separate audited adoption | Claude restart | enabled true | restore false | CH2 + runtime probe |
| workflow candidate | content HEAD | L1 / Double Audit | Reviewed Content HEAD | tracked correction | rerun full/review | Ready | new session via Packet | P1/P2 or gate fail | implementingへ戻る | PR body |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| project hook registration | `.claude/settings.json`全event | PreToolUse ExitPlanModeのみ | memory/audit/suggestionはworkflow正本外 | CH1/CH10 |
| live Claude docs | `CLAUDE.md` / DEV_SETUP / TOOLING_SKILL_COMMANDS / Plans backlog | D-059へ同期 | archiveは履歴のため非変更 | CH10 + drift sweep |
| shell fixture tests | `scripts/tests/*.test.sh` | `claude-hooks.test.sh` | product testは非該当 | CH3〜CH17 |
| workflow routing | classifier/local-ci/CI/static tests | `.claude/**` + hook test | pre-pushへの全workflow suite追加はlatencyのため除外 | CH12〜CH15 |
| local override ignore | repo/global ignore | repo `.gitignore`へ追加 | local file内容は非追跡 | CH17 |

## Negative Paths

- missing input: stdin空/invalidでもenvironment rootだけをauthorityとし、root欠落はblock。
- invalid input: invalid JSONはpolicy inputに使わない。
- duplicate/ambiguous input: project hook 2件目または同matcher重複をinventory testがreject。
- unknown reference: checker path欠落をexit 2。
- dependency missing: `bash`またはchecker実行不能をexit 2。
- permission/write failure: hook自身はtracked/local fileへwriteしない。
- dry-run side effect: PostToolUse semantic notifierをeffective inventoryに置かない。

## Boundary Checks

- threshold: stderr最大20行。
- null/default: `CLAUDE_PROJECT_DIR` unset/emptyはblock。
- empty/non-empty: success output空、failure reason非空。
- min/max: exit 0または2だけ。
- status/policy enum: project hookはdecision JSON enumを出さない。
- wire type: stdin JSON / environment string / process exit。
- internal type: canonical root / checker status。
- producer/consumer: Claude hook runner -> bash hook。
- round-trip token: settings command literalとsource script path。
- precision/range: not applicable。
- cross-language parse: jq settings parse + shell process contract。

## Compatibility Checks

- old schema/input: event cwdを含む既存stdinは無視して正常動作。
- new schema/input:未知field追加は無視。
- output order: stdout空、stderrのみdiagnostic。
- optional field behavior: stdin共通field欠落はroot environmentで決まる。

## Data Safety Checks

- source-derived data: なし。
- generated outputs: temp fixtureだけ、終了時削除。
- secrets: global settings本文をtest log/PR bodyへdumpしない。
- local-only files: settings.local/state/plugin cacheをgit statusで非追跡確認。
- synthetic sample boundaries: fixture root/checker/settingsだけ。

## Main Wiring / Integration Checks

- helper connected to main path: settings commandがtracked hookを指す。
- output reaches manifest/report: local-ci logとhosted stepにtest名が出る。
- effective config reaches runtime: `claude plugin list --json`はdogfood evidence、permanent testはtracked settingを検査。
- CLI arg reaches implementation: classifier diff pathがworkflow=trueへ到達。

## Mutation-style Adequacy Questions

- settingsのharness falseをtrueへ反転するとCH2がredになる。
- hook commandから`${CLAUDE_PROJECT_DIR}`を除くとCH4/CH5がredになる。
- missing checker branchをexit 0へ反転するとCH6がredになる。
- checker nonzeroを無視するとCH7がredになる。
- unexpected nonzeroの2正規化を外すとCH8A、inner deadlineまたはouter-before-inner余白を壊すとCH8Bがredになる。
- failure stderrをstdoutへ移すとCH9がredになる。
- settingsへ旧audit hookを1本戻すとCH1/CH10がredになる。
- classifierから対象3 path群を除く、または`.claude/skills/**`をworkflowへ広げるとCH12がredになる。
- CIのhook-test stepまたはlocal-ci registrationを削るとCH13〜CH15がredになる。
- test内にhookロジックを複製してsource呼出を外すとCH16がredになる。

## Residual Test Gaps

- Claude Code本体がsettingsをhot reloadする時機はfixtureでは再現しない。新sessionのreal ExitPlanModeをdogfoodする。
- outer hook runner自体がdeadline前に異常終了する経路はscript内trapで捕捉できない。inner 20秒 + kill-after 2秒がouter 30秒より先にblockへ収束することをfixtureとreal dogfoodで確認し、残余はClaude Code runtime境界として記録する。
- project `enabledPlugins:false`の解決優先順位はCLI 2.1.220で実測済みだが、将来versionはRevisit対象。
- user-global settingsにrepo hookが再追加されたことをpublic CIから検査できない。tracked contractとlocal auditの責務分離として残す。
- shellは任意commandのsemantic side effectを判定しない。副作用通知自体を非採用にして回避する。
