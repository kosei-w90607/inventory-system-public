# Test Design Matrix: Claude hook contract audit

## Risk

Risk: R3

## Contracts Under Test

- D-059-H1: tracked project settingsだけがrepo hook inventoryを所有し、inventoryは0本、harnessは無効。
- D-059-H2: effective project設定とlive docsは虚偽完了・tracked write・model固有reviewを注入しない。
- D-059-H3: Plan Gateは独立Plan Review、doc consistency、pre-push、local full、hosted finalが所有し、Claude固有hookへ重複実装しない。
- D-059-H4: inventory testと`.claude/**` routingがlocal/hosted main pathへ接続される。

## Failure Modes

- extra project hookまたはpluginがhidden decision / advisory layerを復活させる。
- 退役したhook scriptやmandatory plan-rally記述がtracked sourceへ残る。
- command文字列の検索・dry-runを副作用完了と誤認する。
- full checkerを正常系runtimeより短いhook timeoutへ再接続する。
- test scriptは存在するがclassifier/local-ci/hostedから呼ばれない。
- canonicalなdoc consistency / pre-push / local / hosted gate wiringをhook退役と一緒に落とす。
- machine-global ignoreだけに依存してlocal settingsが別machineでtracked候補になる。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| H1 | extra project hook | config/mutation | CH1 `inventory_is_zero` | `hooks`にevent / matcher / commandが1件でもある |
| H1 | harness再有効化 | config/mutation | CH2 `harness_is_project_disabled` | enabledPluginsが欠落/true |
| H1 | retired script残存 | filesystem/mutation | CH3 `retired_hook_scripts_absent` | tracked `.claude/hooks/**`にfileがある |
| H2 | write/false completion/model gate注入 | static/mutation | CH4 `forbidden_hook_claims_absent` | effective settings / command / live docsに禁止literalまたはactive hook claimがある |
| H3 | canonical gate同時退役 | integration/mutation | CH5 `canonical_plan_gates_remain_wired` | doc consistencyがpre-push / local full / hosted finalの既存main pathから外れる |
| H4 | settings/hooks/commands unknown routing | classifier | CH6 `claude_paths_are_workflow` | workflow=falseまたはunknown=true、またはskillsがworkflowへ過剰分類 |
| H4 | local audit未接続 | integration | CH7 `local_ci_runs_hook_audit` | workflow changeでinventory testが呼ばれない |
| H4 | hosted未接続 | static/mutation | CH8 `hosted_runs_hook_audit` | CI step削除でgreen |
| H4 | static test未接続 | mutation | CH9 `ci_test_guards_hook_step` | command literal mutationをkillしない |
| H4 | source testでない | anti-tautology / source propagation mutation | CH10 `source hook propagation` | tracked sourceのsettings / docs / hooksを派生fixtureへmaterializeしない、またはsource hook追加が派生fixtureでgreen |
| local boundary | global ignore依存 | gitignore | CH11 `local_settings_repo_ignored` | repository rule欠落 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| project hook containment | hooks 8 / harness local false | tracked settings・scripts縮約 | hooks 0 / harness false | tracked setting・script追加 | inventory test | separate R3 hook adoption | Claude new session | hook > 0 / harness true | restore zero / false | CH1〜CH4 |
| canonical Plan Gate | existing review / doc / pre-push / local / hosted | wiring audit | existing ownerが継続 | wiring削除 | fixture reread | workflow change | next workflow run | CH5 red | restore canonical wiring | CH5 |
| workflow candidate | content HEAD | L1 / Double Audit | Reviewed Content HEAD | tracked correction | rerun full/review | Ready | new session via Packet | P1/P2 or gate fail | implementingへ戻る | PR body |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| project hook registration | `.claude/settings.json`全event / `.claude/hooks/**` | inventory 0本 | future hookは別R3 Plan Gate | CH1〜CH3 |
| live Claude docs | `CLAUDE.md` / DEV_SETUP / TOOLING_SKILL_COMMANDS / Plans backlog | D-059へ同期 | archiveは履歴のため非変更 | CH4 + drift sweep |
| shell fixture tests | `scripts/tests/*.test.sh` | `claude-hooks.test.sh` | runtime hook process fixtureは採用実装がないため非該当 | CH1〜CH11 |
| workflow routing | classifier/local-ci/CI/static tests | `.claude/**` + inventory test | pre-pushへの全workflow suite追加はlatencyのため除外 | CH5〜CH10 |
| local override ignore | repo/global ignore | repo `.gitignore`へ追加 | local file内容は非追跡 | CH11 |

## Negative Paths

- missing input: `hooks` key欠落はempty objectと同じ0本として扱う。
- invalid input: malformed settings、enabledPlugins欠落/trueをreject。
- duplicate/ambiguous input: project hook 1件以上をinventory testがreject。
- unknown reference: tracked hook script再追加をreject。
- dependency missing: `jq`等のtest依存欠落はtest failure。
- permission/write failure: inventory test自身はtracked/local fileへwriteしない。
- dry-run side effect: PostToolUse semantic notifierをeffective inventoryに置かない。

## Boundary Checks

- threshold: project hook count exactly 0。
- null/default: absent `hooks`またはempty objectだけをaccept。
- empty/non-empty: `.claude/hooks/**` file 0件。
- status/policy enum: harness value literal `false`。
- wire type: JSON settings + tracked filesystem inventory。
- internal type: hook count / plugin enable boolean / file count。
- producer/consumer: tracked settings -> Claude config resolver / repo audit test。
- round-trip token: settings keyとtracked path。
- precision/range: countはnon-negative integer、accepted value 0のみ。
- cross-language parse: jq settings parse + shell filesystem check。

## Compatibility Checks

- old schema/input: populated `hooks`はreject。
- new schema/input: `hooks` key absent/empty objectは同値。
- optional field behavior: unrelated settings field追加はinventory判定へ影響しない。
- routing compatibility: `.claude/skills/**`は既存どおりdocs routingを維持する。

## Data Safety Checks

- source-derived data: なし。
- generated outputs: temp mutation fixtureだけ、終了時削除。
- secrets: global settings本文をtest log/PR bodyへdumpしない。
- local-only files: settings.local/state/plugin cacheをgit statusで非追跡確認。
- synthetic sample boundaries: settings / workflow wiringのmutationだけ。

## Main Wiring / Integration Checks

- helper connected to main path: inventory testがlocal-ciとhosted stepに登録される。
- output reaches manifest/report: local-ci logとhosted stepにtest名が出る。
- effective config reaches runtime: `claude plugin list --json`はdogfood evidence、permanent testはtracked settingを検査。
- canonical gates remain reachable: doc consistencyはpre-push / local full / hosted finalから外れない。
- CLI arg reaches implementation: classifier diff pathがworkflow=trueへ到達。

## Mutation-style Adequacy Questions

- settingsへ任意hookを1本追加するとCH1がredになる。
- settingsのharness falseをtrueまたは欠落へ変えるとCH2がredになる。
- `.claude/hooks/check-plan-on-exit.sh`等を再追加するとCH3がredになる。
- settings / command / live docsへ`[MANDATORY]`、push完了、Self-Review強制、active ExitPlanMode hook claimを戻すとCH4がredになる。
- canonical doc-consistency wiringをpre-push / local full / hosted finalのいずれかから削除するとCH5がredになる。
- classifierから対象3 path群を除く、または`.claude/skills/**`をworkflowへ広げるとCH6がredになる。
- CIのinventory-test stepまたはlocal-ci registrationを削るとCH7〜CH9がredになる。
- source-derived fixtureからtracked settings / hook directoryの複写を外す、またはsource側stray hookが派生fixtureへ届かないよう変えるとCH10がredになる。
- repo `.gitignore`からlocal settings ruleを削るとCH11がredになる。

## Residual Test Gaps

- Claude Code本体がsettingsをhot reloadする時機はfixtureでは再現しない。新sessionでproject hook 0本とharness無効をdogfoodする。
- project `enabledPlugins:false`の解決優先順位はCLI 2.1.220で実測済みだが、将来versionはRevisit対象。
- user-global settingsにrepo hookが再追加されたことをpublic CIから検査できない。tracked contractとlocal auditの責務分離として残す。
- shellは任意commandのsemantic side effectを判定しない。副作用通知自体を非採用にして回避する。
- 将来hookを採用する場合の正常系runtime / timeout contractは本Matrixでは検証しない。採用時の別R3 Plan Gateで先に実測する。
