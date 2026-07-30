# Plan Packet: Claude hook contract audit

## Workflow State

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: d90dc2d84b6fc59d25b31d00059b5344cda40838
- Amendments: none
- Coordinator: Codex
- Writer: Codex
- Plan Reviewer: Claude Sonnet 5 / xHigh fresh context
- Final Reviewer: Double Audit（Claude Sonnet 5 / xHigh fresh context + Claude Opus 5 / xHigh fresh context・D-056 §5.4低制約profile）
- Reviewed Content HEAD: e28249948ff53a8a906aee4c170e4f3e5a2d111f
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none（ownerが介入5/5でReady / merge一括承認）

## Owner Effort Budget

- 介入回数上限: 5
- 実働時間上限: 30分
- relay 往復上限: 6

既定より介入を2回、relayを4回増やす。relay 5/5のclosureでCH10合成迂回がruntime実証されたため、ownerが介入4/5としてsame-PR是正とclosure-only relay 1回を承認した。relay 6はClaude Opus 5 / xHigh fresh-context reviewer 1人によるP2-CH10 closureだけに使い、新規Broad Audit、P3探索、任意の証跡追加には使わない。介入5回目はReady / merge判断用に留保する。

## Consultation Relay

- Review Order Artifact: docs/review-orders/2026-07-31-claude-hook-plan-gate.md
- Review Order Ref: refs/heads/review-orders/claude-hook-plan-gate

## Risk

Risk: R3

Reason:
Claude CodeのPreToolUse decision、project hook inventory、changed-area routing、local/hosted gateを変更する。誤ったallowはPlan Gateを見せかけにし、誤ったdenyは正当な作業を停止するためworkflow gate changeとしてR3。product runtime、DB、wire、operator UIは変更しない。

## Goal

Goal Invariant:

### 最小完了条件

- この repository が所有する Claude hook inventory が tracked source から一意に復元でき、採用時点の inventory 0 本と `claude-code-harness` 無効化を repo-owned fixture が判別する。user-global 層は local audit 境界として明示する。
- Plan Gate を Claude 固有 hook へ重複実装せず、独立 Plan Review、`doc-consistency-check.sh`、pre-push、local full、hosted finalという既存の正本へ戻す。

### 失敗定義

- project hook が 1 本でも残る、command 文字列だけで push / tag / PR 完了を通知する、read-only role へ tracked write を命じる、未監査 plugin が deny / ask を出せる、live docs が退役 hook を現役として説明する、または inventory test が local / hosted main path へ接続されない。

### 非目的

- Claude Code本体、plugin cache、harnessのupgrade/修理、global permissions、Codex hook、product code、memory内容、一般的なshell parserの実装は行わない。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `.claude/settings.json`: `claude-code-harness` を project scope で明示無効化し、effective project hook inventory を 0 本にする。
- `.claude/hooks/`の現行8 scriptを全て削除し、`.claude/commands/plan-rally.md`を hook pass や mandatory Self-Review を要求しない optional helper へ訂正する。
- `CLAUDE.md`の2-hook / memory-hook記述、`docs/DEV_SETUP_CHECKLIST.md`のglobal-ignore / SessionStart記述、`docs/TOOLING_SKILL_COMMANDS.md`のplugin実効一覧をD-059へ同期する。
- `.gitignore`: `**/.claude/settings.local.json`をrepo-owned ignoreへ追加する。
- `scripts/tests/claude-hooks.test.sh`を新設し、settings inventory 0 本、plugin 無効化、退役 script 不在、禁止 directive 不在、既存 gate wiring、mutation 感度を検査する。
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

- `jq`でtracked settingsを列挙するとproject hook inventoryは0件で、harnessは`false`。
- tracked `.claude/hooks/` に実行 script がなく、settings / command / live docs に退役 hook の接続または成功主張がない。
- effective project hook/commandに`MANDATORY`、`git push`、`gh pr create`、memory write、agent-log 30分条件、model名がない。
- `.claude/settings.local.json`がrepository `.gitignore`のruleでignoreされる。
- `bash scripts/tests/claude-hooks.test.sh`が実 contract で green となり、hook 追加、plugin true、退役 script 再追加、既存 gate wiring 削除の各 mutant が red になる。
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
| Zero-hook settings contract / future hook admission boundary | Plan Boundary / Wire Contract + Matrix | updated in plan-gate correction |
| Claude live usage / setup inventory | `CLAUDE.md` / DEV_SETUP / TOOLING_SKILL_COMMANDS | implementation change |
| Local/hosted gate routing | DEV_WORKFLOW / ci.md | implementation change |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| `scripts/tests/claude-hooks.test.sh` | `local-ci.sh`、hosted CI、CI static testへ登録し、classifierが`.claude/settings.json`、`.claude/hooks/**`、`.claude/commands/**`をworkflowへ送る |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-HOOK-01 | Manual §6.1 | D-059-H1 single owner / zero inventory | duplicate/global/plugin ownerを排除 | `.claude/settings.json` / delete `.claude/hooks/**` | CH1〜CH3 |
| SPEC-HOOK-02 | Manual §6.1 | D-059-H2 no semantic inference | false completionとwrite指示を排除 | settings / command / live docs | CH4 |
| SPEC-HOOK-03 | Manual §6.1 | D-059-H3 canonical gate ownership | timeout依存の重複Plan Gateを排除 | existing doc-consistency / pre-push / local / hosted wiring | CH5 |
| SPEC-HOOK-04 | Manual §6.1 | D-059-H4 permanent audit wiring | manual-only inventory auditを排除 | local-ci / CI / classifier | CH6〜CH10 |

## Design Intent Audit

- Source docsはglobal/project/local/pluginのowner、decision/advisory境界、plugin containmentをchatなしで説明できる。
- durable decisionはD-059へ昇格した。global containmentの実ファイル内容はmachine-localなのでtracked docsへsnapshotしない。
- Claude Code 2.1.220と公式hook referenceをpremiseとし、将来変更はRevisit条件にした。
- MatrixはD-059-H1〜H4を参照する。
- 「誤発火ゼロ」の絶対保証は置かず、effective project inventoryを0本へ縮約し、tracked configurationとlive wiringを明示fixtureで固定する。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | Claude runtime adapterとrepo workflow coreを分離 | Manual §6.1 / D-059 |
| Fact check / design decision split | hook仕様とlocal実測をdecisionから分離 | Contract Probe |
| Lifecycle / retry | project config無効化と新session反映 | Matrix State Lifecycle |
| Operator workflow | not applicable | — |
| Replacement path | harness / project hookを既存workflow gateへ縮約 | settings + hook test |
| Data safety / evidence | global/local/plugin cacheをcommitしない | Data Safety |
| Reporting / accounting semantics | false completion通知を禁止 | D-059-H3 |
| Manual verification | 新sessionでproject hook 0 / harness無効をdogfood | PR body |

## Design Readiness

- Existing design docs are sufficient because: DEV_WORKFLOWがPlan GateとCIを所有し、§6.1がharness境界を補う。
- Source docs updated in this PR: Manual §6.1、D-059。
- Design gaps intentionally deferred: harness再採用・upgrade、global generic hook設計。
- Durable decisions discovered in this plan and promoted to source docs: single owner、zero inventory、plugin containment、no semantic inference、future hook runtime admission。

## Contract Probe

- Claude Code 2.1.220 official hook wire: PreToolUse exit 2はblock、exit 0とその他exit / timeoutはblock保証にならないことを確認 -> 正常系runtimeが外側timeoutを下回らないhookは採用しない。
- checker runtime（同一WSL2 warm state）: `scripts/doc-consistency-check.sh` fullは33.53 / 33.70 / 33.64秒、`--target plan`は20.73 / 20.01秒。tracked project outer timeout 10秒、旧global outer timeout 30秒、提案inner最大22秒の全てで正常系が完走しない -> ExitPlanMode接続をrejectしproject inventory 0本へ改定。
- global PostToolUse false semantic inference: `rg -n "(git push"`で旧global hookが発火した実測を確認 -> 3 hookをcontainmentで削除、global hook count 0。
- project tag notification: `rg -n "git tag v1" docs` + success responseを入力すると`audit-trigger-phase.sh`が段階完了を出力 -> command text oracleをreject。
- project root binding: `cwd=.../docs`で現`check-plan-on-exit.sh`がchecker不在allow -> `${CLAUDE_PROJECT_DIR}`必須。
- plugin state: `.claude/state/session.json`は`jq -e` exit 5、line 14 parse error -> live baselineへ含めない。
- project plugin override: `claude --settings .claude/settings.json plugin list --json`でharness 2.7.4 `enabled:false` -> project単位containmentは実効。
- local ignore provenance: `git check-ignore -v`がuser-global ignoreだけを示す -> repo `.gitignore`追加が必要。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-059-H1 single project owner / zero inventory | settings / delete hooks / plugin false | CH1〜CH3 | global contentはnon-scope |
| D-059-H2 no false completion/write injection | settings / optional plan-rally / live docs | CH4 | memory content non-scope |
| D-059-H3 canonical Plan Gate ownership | existing checker / pre-push / local / hosted | CH5 | runtime hookなし |
| D-059-H4 permanent inventory audit wiring | classifier/local-ci/CI | CH6〜CH10 | hosted final required |
| local settings remain local | `.gitignore` | CH11 | local file内容non-scope |

## Test Plan

Test Design Matrix: [2026-07-31-claude-hook-contract-audit.md](test-matrices/2026-07-31-claude-hook-contract-audit.md)

- targeted tests: `bash scripts/tests/claude-hooks.test.sh`、classifier/local-ci/CI static fixture。
- negative tests: extra hook、plugin true、退役 script 再追加、forbidden injection literal、canonical gate wiring削除、malformed settings。
- compatibility checks: settingsの`hooks` key欠落 / empty objectを同じ0本として扱い、`.claude/skills/**`の既存docs routingを維持する。
- data safety checks: local/global/plugin filesがgit diffへ入らず、repository ignoreがlocal settingsを保護。
- main wiring/integration checks: `local-ci.sh changed`実行ログとhosted docs step。

## Boundary / Wire Contract

- producer: tracked `.claude/settings.json`。
- consumer: Claude Code configuration resolverと`claude-hooks.test.sh`。
- wire type: `hooks`はabsentまたはempty object、`enabledPlugins["claude-code-harness@claude-code-harness-marketplace"]`はliteral `false`。
- internal type: effective project hook count 0 + plugin disabled。
- precision/range: hook countはexactly 0。timeout、stdin、stdout、stderr、process exitは採用実装のwireに存在しない。
- round-trip path: tracked settings -> Claude Code config resolution -> new session effective inventory。repo testはtracked settingsと退役script不在を直接読む。
- invalid input: hook entry追加、plugin false欠落/true、malformed settings、tracked hook script再追加はtest failure。
- compatibility: user-global / machine-local設定はPR外。新sessionでproject override実効をdogfoodする。

## Review Focus

- 8本から0本への縮約で、Plan Gate所有権が既存workflow正本へ漏れなく戻っているか。
- 正常系runtimeがtimeoutを超えるcheckerをhookへ再接続していないか。
- tracked settingsのplugin falseとignored local containmentの責務が混線していないか。
- `.claude/**`がlocal/hosted gateの実main pathへ接続されるか。
- testがsource scriptを呼ばずfixture copyだけを検証するtautologyになっていないか。

## Spec Contract

Contract ID: SPEC-HOOK-01

- effective inventoryはtracked project hook 0本、未監査plugin 0本。
- Plan Gateは独立Plan Review、doc consistency、pre-push、local full、hosted finalが所有し、Claude固有hookで重複実装しない。
- hookは副作用完了やtracked writeをadditional contextとして注入しない。
- inventory testはlocal/hosted双方のmain wiringに接続する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-HOOK-01/H1 | settings縮約 / hook削除 | CH1〜CH3 | effective owner | test output / PR body |
| SPEC-HOOK-01/H2 | advisory退役 | CH4 | false claims/write injection | sweep |
| SPEC-HOOK-01/H3 | canonical gate維持 | CH5 | ownership regression | test output |
| SPEC-HOOK-01/H4 | permanent wiring | CH6〜CH11 | local/hosted/classifier | local/hosted evidence |

## Data Safety

- `/home/kosei/.claude/settings.json`、plugin cache、`.claude/state/**`、`.claude/settings.local.json`をcommitしない。
- local-only: `.local/ci-evidence/`、hook runtime transcript、Claude memory、plugin state。
- synthetic-only: test fixtureのsettingsとmutation対象。

## Implementation Results

- tracked `.claude/settings.json` の`hooks`をempty contractへ縮約し、`claude-code-harness@claude-code-harness-marketplace`をproject scopeで`false`に固定した。
- `.claude/hooks/`のtracked 8 scriptを削除し、`plan-rally.md`を任意のread-only review helperへ縮約した。model、agent log、時間窓、Self-Review、memory writeをgate化しない。
- `claude-hooks.test.sh`をCH1〜CH11のsource-direct / mutation auditとして追加し、classifier、local-ci、hosted docs job、CI static testへ接続した。`.claude/settings.json` / hooks / commandsはworkflow、skillsはdocs routingを維持する。
- `CLAUDE.md`、Manual §6.1、DEV_SETUP、TOOLING、DEV_WORKFLOW、ci.md、project-profile、D-059、Plans / handoffをzero-hook contractへ同期した。repository `.gitignore`がmachine-local settingsを所有する。
- TDD redは旧8 hook、classifier unknown、hosted step欠落で再現し、実装後にtargeted fixture / mutation testsがgreenとなった。Node 24.18.0のrepo pin下でchanged / L1 fullをPASS / CLEAN、L1は`MERGE_EVIDENCE_VALID=true`まで確認し、Draft PR #48を作成した。Final Double Auditは後続phaseで実行する。
- Final Double Audit correctionでCH4のlive docs / fixture / mutationへ`docs/Plans.md`を追加し、CH10はsource-direct invocationの単一性を自己一致しない分割literalで検査した。source invocation削除でCH10がred、復元後greenを実測した。CH6 / CH8 / CH9のtest IDとhosted validatorのfail診断も同期した。

## Review Response

- Findings Freeze: frozen after both Final Double Audit passes completed on `3a54baf`; post-freeze exceptions: runtime-proven P2 only.

### Plan Review round 1（2026-07-31、consultation relay 1/4）

- Opus 5相談窓口が発注書を検証し、Workflow `agent()`でClaude Sonnet 5 / xHigh fresh-context reviewerを1人だけ起動・集約した。Verdict REQUEST CHANGES（P1=0 / P2=2 / P3=0）。
- P2-1 problem claimをaccept。Claude Codeは0/2以外をblockに使わないため、checker既知failureだけを2へ変換しても未捕捉内部故障とhangがfail-openになりうる。初回是正ではstrict mode + trapとinner deadlineを追加した。
- P2-2 problem claimをaccept。Plan Packet / DEV_WORKFLOWはSelf-Reviewを所有していなかった。旧hook固有7観点Self-Reviewを後継なしで退役し、Plan Packetへ昇格しない理由をManual §6.1とD-059 Alternativesへ明記した。
- 相談窓口の独立検算をaccept。session-monitorのGNU `stat -f`はexit 1の部分stdout後にfallback stdoutを連結するのが正しく、malformed JSON結論は不変。plugin hook数はcommand 19 + prompt 1 = 20でD-059記述が正しい。いずれもsource修正不要。
- mechanism差はevidenceとして記録する。Agent toolではper-agent effort xHighを指定できないため、相談窓口はWorkflow `agent()`を1回だけ使い、model / effort / fresh context / generation 1 / depth 1 / read-onlyを満たした。

### Plan Gate closure round 2（2026-07-31、consultation relay 2/4）

- Verdict REQUEST CHANGES（P1=0 / P2=1 / P3=0）。P2-2はCLOSED。P2-1はstrict/trap、CH8A/CH8B、外側kill非捕捉の開示までは満たしたが、内部deadlineが正常系runtimeより短いためPARTIALLY CLOSED。
- 相談窓口の実測をaccept。full checkerは33.53 / 33.70 / 33.64秒、`--target plan`は20.73 / 20.01秒。提案inner最大22秒、旧global outer 30秒、tracked project outer 10秒のいずれも正常系を完走できない。これはtimeout時だけでなく通常のExitPlanModeを恒久denyまたはouter cancel fail-openにするため、CoordinatorはP1相当のPlan blockerと裁定した。
- outer 60秒 / inner 45秒案は各ExitPlanModeへ約34秒の待ちを課し、doc増加で固定値が再び腐るためreject。hook専用軽量checker案もPlan Gate正本を二重化するためreject。D-059 / Manual §6.1 / Packet / Matrixをproject hook inventory 0本へ改定し、既存の独立Plan Review、doc consistency、pre-push、local full、hosted finalへ所有権を戻す。
- Phaseはplan-gateのまま。改定HEADとsupersedeしたimmutable order refでclosure review 3/4へ戻し、P1/P2=0までimplementationへ進まない。

### Plan Gate closure round 3（2026-07-31、consultation relay 3/4）

- Verdict APPROVE（P1=0 / P2=0 / P3=1）。P2-1はCLOSED。zero-hook pivotが失敗経路を緩和せず除去し、6 closure-target docと既存gate ownershipの実体が整合することを確認した。P2-2もCLOSEDを維持した。
- P3のManual §6前文driftをaccept。実装で現在形のExitPlanMode強制記述をinventory 0本へ同期し、CH4 `forbidden_hook_claims_absent`のlive docs対象へManualを含めた。
- ownerは選択肢Aを承認。relay上限4を維持し、Final Double Auditは最後の1 orderでSonnet 5 / Opus 5 fresh-context reviewerを各1人生成する。

### Final Double Audit（2026-07-31、consultation relay 4/4）

- Sonnet 5 passはREQUEST CHANGES（P1=0 / P2=1 / P3=2）、Opus 5 passはP1=0 / P2=1 / P3=1を報告した。Opusの`APPROVE`表記はP2件数と発注書gateが矛盾するため採用せず、aggregateをREQUEST CHANGESと裁定した。両pass完了時点でFindings Freezeを発効した。
- 共通findingのCH4 live docsから`docs/Plans.md`が欠落する問題をP2としてacceptした。MatrixのAdjacent Pattern AuditがPlans backlogをCH4で覆うと主張する以上、実体のないcoverage claimはmerge blockerである。
- Opus単独findingのCH10未実装をP2としてacceptした。source rootへの`validate_contract`呼出しを削除してもfixture mutation群がgreenとなるため、Matrix / Ledgerが主張するanti-tautology契約を満たさない。
- Sonnet単独findingのhosted validator裸呼出しをP3、CH6 / CH8 / CH9のtest ID表示欠落をP3としてacceptした。いずれも同じtest correction内で閉じる。
- `DEV_WORKFLOW.md`のcorrection ruleに従い`independent-review -> implementing`へbacktrackする。Scope / Non-scope / durable contractは変更せず、test coverageと診断だけをsame-PR correctionする。
- Correction implementation: `claude-hooks.test.sh`のCH4 / CH10、`classify-changes.test.sh`のCH6、`ci-workflow.test.sh`のCH8 / CH9を最小是正した。CH10 source invocation削除mutationは期待どおりred、復元後は3 targeted testがgreen。追加review relayはOwner Effort Budget 4/4のため未生成。
- Owner budget exception: ownerが介入3/4として介入上限を3から4、relay上限を4から5へ今回限り拡張した。追加1回は同じfrozen finding setのP2 closureだけに使い、Claude Opus 5 / xHigh fresh-context reviewerを1人だけ生成する。Scope / Acceptance Criteria / Matrix / implementation contractは変更しないため、`Amendments`は`none`を維持する。

### Frozen P2 closure（2026-07-31、consultation relay 5/5）

- Opus 5 / xHigh fresh-context reviewerはREQUEST CHANGES（P1=0 / P2=1 / P3=0）。P2-CH4はCLOSED、P2-CH10はPARTIALLY CLOSEDと判定した。
- CoordinatorはP2-CH10のproblem claimをaccept。source-direct呼出し2行をコメント化してliteralだけを残し、実sourceへstray hookを追加した使い捨てcloneで、`claude-hooks.test.sh`全体がPASSする合成迂回を独立再現した。Findings Freeze後だがruntime実証済みP2のためblockerを維持する。
- ownerは選択肢Aとしてsame-PR是正を承認した。正本規則どおり`independent-review -> implementing`へbacktrackし、次のcontent commitで予算拡張とCH10 source-hook propagation testを実装する。
- Owner budget exception: ownerが介入4/5として介入上限を4から5、relay上限を5から6へ今回限り拡張した。追加1回はP2-CH10のclosureだけに使い、Ready / merge判断を介入5回目へ留保する。Scope / Acceptance Criteria / durable contractは変更しないため、`Amendments`は`none`を維持する。
- Correction implementation: `make_fixture(source, fixture)`へ入力元を明示し、tracked sourceの`.claude/hooks/**`をsettings / docs / wiringと同じ派生fixtureへ複写する。source側stray hookが派生fixtureでrejectされるCH10 mutationを追加し、旧実装でred、実装後greenを確認した。
- Correction verification: source-direct検査をコメント化してliteralだけ残し、source側へstray hookを置く合成mutationを使い捨てcloneへ再注入したところ、派生fixtureのbaseline検査でredになった。targeted / changed / L1 fullはPASS / CLEANで、`MERGE_EVIDENCE_VALID=true`を確認した。`implementing -> local-verified -> independent-review`をmaterializeし、relay 6/6をP2-CH10 closureへ限定する。

### P2-CH10 final closure（2026-07-31、consultation relay 6/6）

- Opus 5 / xHigh fresh-context reviewerはAPPROVE（P1=0 / P2=0 / P3=0）、P2-CH10をCLOSEDと判定した。
- reviewerと相談窓口はそれぞれ独立の使い捨てcloneで、source-direct検査2行をコメント化してliteral count 1を維持し、tracked sourceへstray hookを置く合成mutationを実行した。是正後targetはbaseline検査でred、是正前controlはgreenとなり、source hook propagationが迂回路を閉じたことを実証した。
- Matrix CH10、Packet narrative、PR bodyのfailure pathは実測と一致する。Matrixの表示名`test_reads_tracked_settings_and_hooks`と実装label`CH10 source hook propagation`の不一致は名称だけのPost-Freeze P3としてacceptし、現HEADを動かすcontent修正にはせずPost-Merge Closeout follow-upへ送る。
- P1/P2=0が揃ったため、audited content commit `e28249948ff53a8a906aee4c170e4f3e5a2d111f`を`Reviewed Content HEAD`へ記録し、`independent-review -> human-confirm`をmaterializeする。

## Narrative

- 2026-07-31 kickoff -> design -> plan-gate: ownerがglobal repo固有hook停止とproject harness無効化のcontainment、および別branchでのR3 Hook監査着手を承認。D-058 closeoutを先にmainへ確定した。現物読解とContract Probeでcommand text誤発火、nested cwd allow、malformed plugin stateを再現し、D-059 / Manual §6.1 / Packet / Matrixを起草した。plan-first commit後、ownerがD-058の本来目的は複数review laneのterminal/session管理をOpus相談窓口へ集約することだと明確化したため、本Plan Gateを最初のeligible consultation relay dogfoodとし、Opus窓口からSonnet 5 / xHigh fresh-context reviewer 1本を起動する。
- 2026-07-31 Plan Review round 1 -> correction: consultation relayは生成1 / depth 1 / read-onlyを守り、Sonnet reviewerのP2×2を集約した。想定外非0とchecker hangのfail-openをstrict/trap/inner deadline + Matrixへ追加し、所有者不在だったSelf-Reviewは後継なし退役として正本化した。Phaseはplan-gateのまま、新しいtarget/order refでclosure reviewへ戻す。
- 2026-07-31 Plan Gate closure round 2 -> design pivot: P2-2はclosed、P2-1は実runtimeがinner/outer timeoutを超えるためresidual。通常系が成立しないのでP1相当blockerと裁定し、8本から1本ではなく0本へ縮約する。ExitPlanModeの重複gateを廃止し、既存workflow gateを正本として維持するPlan/Matrixへ改定した。
- 2026-07-31 Plan Gate closure round 3 -> plan-approved -> implementing: Sonnet 5 / xHigh fresh-context closureはAPPROVE（P1=0 / P2=0 / P3=1）。zero-hook pivotと既存gate ownershipの実体を確認し、ownerが選択肢AとしてPlan Gateを承認した。Plan Commitを`d90dc2d84b6fc59d25b31d00059b5344cda40838`へ固定し、隣接遷移をmaterializeした。P3のManual §6前文driftはimplementation時にCH4のlive docs対象として是正する。Final Double Auditは残るrelay 1回でSonnet 5 / Opus 5 fresh-context reviewerを各1人起動する。
- 2026-07-31 implementing first pass: zero-hook settings、tracked hook削除、harness false、optional plan helper、repo-owned inventory / mutation test、workflow classifier、local / hosted wiring、live docs同期を実装した。Plan Review P3のManual前文もCH4対象として是正し、targeted testsをgreenにした。
- 2026-07-31 local verification -> independent review: implementation commit `b3e1ad92fe0bc878a75b66024e8bcf9d743dfb57`をNode 24.18.0のrepo pin下でchanged / L1 full検証し、PASS / CLEAN / merge evidence validを確認した。system Node 25の初回changedは`devEngines`契約どおりfail-fastしたためmerge evidenceには採用しない。Draft PR #48を作成し、このvalidation / dashboard content commitへ`implementing -> local-verified -> independent-review`を同乗させ、最後のconsultation relay orderによるDouble Auditへ進む。
- 2026-07-31 Final Double Audit -> implementing: relay 4/4の独立2 passはCH4 Plans coverage欠落とCH10 source-direct anti-tautology未実装をP2として検出した。Coordinatorは両problem claimを実ソースで再現し、P3の診断 / ID表示と同じtest-only correctionで閉じると裁定した。Findings Freezeを発効し、正本規則どおり`independent-review -> implementing`へbacktrackする。
- 2026-07-31 correction implementation: CH4へPlans live sourceと専用mutationを追加し、CH10へsource-direct invocation単一性guardを実装した。source invocationを一時削除してCH10 redを再現し、復元後にhook audit / classifier / CI workflow testをgreen確認した。P3の診断とID表示も同じ3 test file内で閉じた。
- 2026-07-31 correction verification -> independent review: correction content candidateはtargeted / changed / L1 fullがPASS / CLEANで、`MERGE_EVIDENCE_VALID=true`を確認した。exact-HEAD SHAとevidence pathはPR bodyを正本とする。ownerが介入3/4として予算を介入4・relay 5へ拡張したため、`implementing -> local-verified -> independent-review`をmaterializeし、relay 5/5をClaude Opus 5 / xHigh fresh-context reviewer 1人によるfrozen P2 closureに限定する。
- 2026-07-31 frozen P2 closure -> implementing: relay 5/5のOpus closureはP2-CH4をCLOSED、P2-CH10をPARTIALLY CLOSEDとした。Coordinatorもsource呼出しコメント化 + stray hookの合成で全体PASSを再現し、runtime-proven P2としてacceptした。ownerはAを選択し、same-PR是正のため`independent-review -> implementing`へbacktrackする。
- 2026-07-31 CH10 closure correction: ownerが介入4/5として予算を介入5・relay 6へ拡張した。source-derived fixtureが`.claude/hooks/**`もmaterializeするAPIとpropagation mutationをtest-firstで追加し、旧実装の`CH10 source-derived hook fixture was not constructed` redからgreenへ転換した。次はexact content candidateのchanged / L1 fullとrelay 6/6 closure。
- 2026-07-31 CH10 correction verification -> independent review: composite bypass mutationは派生fixtureのbaseline検査でred、targeted / changed / L1 fullはPASS / CLEAN / merge evidence valid。exact-HEAD SHAとevidence pathはPR bodyを正本とし、`implementing -> local-verified -> independent-review`をmaterializeしてOpus 5 / xHigh fresh-contextのclosure-only relay 6/6へ進む。
- 2026-07-31 P2-CH10 final closure -> human-confirm: Opus 5 reviewerと相談窓口の独立mutationは、是正後targetをred、是正前controlをgreenとして再現し、P2-CH10をCLOSEDとした。Final Review closureはP1/P2=0。Matrix CH10表示名と実装labelの名称差はPost-Freeze P3 follow-upへ送り、audited content HEADを記録してownerのReady / merge判断を待つ。
- 2026-07-31 human-confirm -> ready-hosted-final: ownerが介入5/5としてReady / merge一括承認を選択した。Draftのままstate-only Ready遷移をmaterializeし、そのexact HEADでL1 full、PR body refresh、Ready、hosted final、三点SHA一致、merge、Post-Merge Closeoutを連続実行する。
