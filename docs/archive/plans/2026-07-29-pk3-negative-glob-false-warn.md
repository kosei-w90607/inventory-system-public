# Plan Packet: PK3 negative-glob false WARN correction（wave 4 lane 3）

## Workflow State

- Phase: archive
- Risk: R2
- Execution Mode: dual-vendor-no-fable
- Plan Commit: d8129d9
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・裁定・Registry/train管理）
- Writer: Codex（plan-approved後の専用worktree / terminal W4-L3）
- Plan Reviewer: Codex fresh context（read-only、Writer非関与）
- Final Reviewer: Claude fresh context（Plan Reviewerとは別context、read-only）
- Reviewed Content HEAD: b4137ead85597b6e12ec0969d92518e03da154a2
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: resolved Ready / merge（owner介入3/3）

Narrative（append-only）:

- 2026-07-29 kickoff -> spec-check -> plan-draft: ownerが既存backlogのPK3偽WARNをwave 4 lane 3に選定（介入1/3）。`test_token_exists()`の壊れたnegative glob除去とdeterministic fixtureだけを扱い、PK3の探索root、regex、WARN、exit、PK4/merge判定は不変。production実装はPlan Gate前につき禁止。
- 2026-07-29 plan-draft -> plan-gate: Packet / Matrix、2 content file、version非依存fixture、workflow hosted requirementをCoordinatorが確認した。plan-first content commitへ固定し、fresh Codex Plan Reviewへ進む。
- 2026-07-29 Plan Review round 1: P1=0 / P2=1。単一引用表記だけの静的guardでは`-g`や引用符違いの同義mutationが生存するため、PATH上のrg shimでhelper実行時argvを捕捉して全negated-glob表記を拒否するportable guardとsyntax-equivalent mutation tableへ補強した。Plan Gateは未通過のまま再レビューする。
- 2026-07-29 Plan Review round 2: P1=0 / P2=1 / P3=1。ripgrepが受理する`-qg PATTERN` / `-qgPATTERN` short-option clusterがargv parserから漏れ、Trace Matrixも旧static表記だった。value-taking `g`を含むshort cluster全体へparserとmutationを拡張し、runtime argv oracleへ記述を同期して再レビューする。
- 2026-07-29 formal Plan Review closure（Codex fresh context、HEAD `f929472`）: APPROVE、P1=0 / P2=0 / P3=0。long optionと任意short cluster内のvalue-taking `g`、separate / attached、runtime argv Trace、ignored-only / real rg delegation / 3 roots / WARN exit / R2 / D-055をread-only再確認し、実装可能と判定した。
- 2026-07-29 plan-gate -> plan-approved -> implementing（state-only compression）: 独立Plan Review closureでP1/P2=0となり、plan-first `d8129d9`とplan-gate corrections `7abfedf` / `128407c` / `f929472`は全実装commitより前に存在する。`Plan Commit`を`d8129d9`へ固定し、本state-only commit後にlane 3 Writer実装を許可する。
- 2026-07-29 review route correction: owner指示によりExecution Modeを`dual-vendor-no-fable`、Formal Final ReviewerをClaude fresh contextへ訂正した。既存Codex reviewはpreflightとして扱い、Formal Final Review gateの充足には用いない。新しいowner decision pointではないため介入回数は1/3のまま据え置く。
- 2026-07-29 external review P1 accepted: ignored-only fixtureがsynthetic treeをGit repositoryとして初期化せず、host / ripgrep versionによって`.gitignore`適用が変わるportable regressionを受理した。Phaseは`implementing`を維持し、fixture生成直後に`git init -q "$repo"`だけを追加した。
- 2026-07-29 P1 correction verification: content commit `d506fe3`でbash syntax、doc-consistency plan-packet fixture suite、targeted plan check、workflow git、diff checkがPASSし、tree CLEANを確認した。PR-wide changed gateはlane 2未統合の`76-ui-request-primitives.md` design compliance分類だけで停止するため、merge train依存解消後にL1 fullとClaude fresh-context closure reviewを行う。
- 2026-07-29 correction closure review（reviewed content `b4137ead85597b6e12ec0969d92518e03da154a2`）: Claude Opus 5 / Sonnet 5の相互非開示fresh context 2 passがともにAPPROVE、P1=0 / P2=0。Opus passはGit markerを持たないclean roomで`git init`除去時FAIL / 修正後PASSを対比し、前回P1の因果的closureを確定した。Sonnet passの`/tmp`再現はambientな空の`/tmp/.git`によりripgrepがGit treeと誤認するconfoundを受けたが、end-state suiteとnegative-glob / root / `--no-ignore` mutationは全て期待どおり検出した。
- 2026-07-29 P3 evidence correction: `local-ci.sh changed`の実ログではdocs gate自体はPASSしている。一方、`origin/main=be93d63`がlocal `main=be63da7`より遅れたdiff windowをbaseに全gate分類が発火し、その結果起動したRust `design_compliance_test`が`76-ui-request-primitives.md`未登録で実際にFAILした。したがって発火原因はstale remote-tracking base、直接の失敗原因はLane 2が閉じる設計書76登録gapという二段であり、Lane 3起因ではないとの結論は維持する。
- 2026-07-29 P3 owner-effort adjudication: review-route correctionは選択肢を伴う新しいHuman Gateではなく、現に利用可能なClaude slotとownerが既に指定したreview経路へ記録を合わせる是正であり、scope・merge train・Ready判断を変更していない。このdecision-point基準により介入は1/3据え置きとする。ambient `TMPDIR`祖先の空`.git`が将来のmutation再現感度を落とし得る点は現candidateのP1 closureを妨げないため、wave 4 WERのfollow-up候補へ分離する。
- 2026-07-29 workflow disposition: 本reviewはLane 2未統合下の是正closure evidenceである。stale diff windowと設計書76依存によりL1 full CLEANをまだ作れないためPhaseは`implementing`、`Reviewed Content HEAD`は`pending`を維持する。Lane 2統合後のconflict-free rebase、exact-HEAD L1 full CLEAN、formal Final Reviewを経て、同一state-only commitで`local-verified -> independent-review -> human-confirm`とReviewed Content HEADをmaterializeする。
- 2026-07-30 P3 owner-effort correction: 前項の1/3据え置き判断を訂正する。ownerがExecution ModeとFormal Final Reviewerを実態へ合わせるよう明示したreview-route correctionは、Human Gateの有無ではなくdecision point単位で数えるD-055上の独立介入である。wave 4起票を介入1、review-route correctionを介入2として実数化し、現況を2/3とする。今回のrebase・L1・state materializationは既承認merge trainの機械的遂行であり、新たなowner decision pointには数えない。
- 2026-07-30 P3 dependency attribution correction: 前項の旧L1 failure記述を現在の実証により補正する。stale `origin/main`は当時のdiff windowを拡大して無関係gateを起動した要因であり、起動後のRust design compliance failureはLane 2が所有した設計書76分類gapというbase dependencyだった。Lane 2はPR #40 squash `4a07f7d`で統合され、closeout後の`main=7af62e8`には当該分類が存在する。Lane 3をこのmainへrebaseした後のL1 fullではdesign complianceを含む全gateがPASSしたため、Lane 3 regressionではなくLane 2 mergeで解消した依存だったとの帰属を確定する。
- 2026-07-30 merge-train rebase evidence: 旧base `be63da7` / 旧tip `8a5275f`の5 commitを`main=7af62e8`へ競合なくrebaseし、新tip `f3a4c72`を得た。旧新5組のstable patch-id、`git range-diff`、旧全体差分`be63da7..8a5275f`と新全体差分`7af62e8..f3a4c72`のpatch-idが全て一致した。Plan Commit `d8129d9`は既にmain祖先でAmendmentsはnoneのためformal Rebase Map対象はない。Final Reviewerが実際に監査したcontent HEAD `b4137ea`は同内容のrebased commit `b6c3824`へ対応し、D-055のconflict-free content-equivalent rebaseとしてclosure reviewをcarry forwardする。
- 2026-07-30 implementing -> local-verified -> independent-review -> human-confirm: rebased content HEAD `f3a4c72`でL1 fullがCLEAN PASSし、tree clean・same-HEAD・merge evidence validを確認した。Claude Opus 5 / Sonnet 5 closure reviewのP1/P2=0と上記同値性証明をFinal Review evidenceとして確定し、実際のreview対象 `b4137ead85597b6e12ec0969d92518e03da154a2`をReviewed Content HEADへ設定した。残るHuman GateはownerのReady / merge判断と、その後のexact-HEAD L1・Hosted CIである。
- 2026-07-30 human-confirm -> ready-hosted-final: ownerが「Readyしていいしマージしていい」と明示し、介入3/3としてReady / mergeを承認した。本state-only commitをfinal candidate HEADとし、PRをDraftのままexact-HEAD L1 fullとPR body更新を行う。その後Ready化でHosted CIを起動し、PR HEAD・PR bodyのlocal full evidence SHA・successful hosted run headShaの三点一致を確認できた場合に限り、追加tracked commitなしでsquash mergeする。
- 2026-07-30 ready-hosted-final -> merge -> archive: final PR HEADのL1 fullはCLEAN PASS、Hosted CIは同一headShaでSUCCESSとなり、PR live HEADとの三点一致とMERGEABLE / CLEANを確認した。PR #39をsquash merge `b5e1c5e`として統合し、remote branchを削除した。Packet / Matrixをarchiveし、wave 4 merge trainの次をlane 1へ進める。workflow effectivenessは全3 lane closeout後のwave 4 WERで集約し、次のdogfood targetはlane 1の実R3 packetに対するPK3 false-WARN非再発確認とする。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入3/3（介入1 = wave 4起票、介入2 = review-route correction、介入3 = Ready / merge承認）、relay 0/2

## Risk

Risk: R2

local developer workflowのWARN精度だけを直す。PK3はWARN-onlyでexit codeとmerge可否を変えず、runtime contractも変えないためR2。PK3/PK4 enforcement、探索root、regex、exit semanticsへ拡張した場合はR3へ戻す。

## Goal

Goal Invariant: R3/R4 Trace Matrixに記載した実在test tokenを`tests` / `src` / `src-tauri`から検出し、ripgrep negative-glob optionに起因する偽WARNを出さない。欠落tokenは従来どおりWARN、checkerはexit 0とする。

### 最小完了条件

- `test_token_exists()`から3つのnegative `--glob`だけを除去
- valid tokenはWARNなし、ignored subtreeだけのtokenはmissing WARN、いずれも既存exit semantics
- deterministic fixtureがversion固有のrg再現に依存せず再導入mutationをkill

### 失敗定義

- 実在tokenがWARN、欠落tokenが無警告
- root / regex / ignore behavior / WARN text / exit code / PK4が変わる
- version pin、checker refactor、別PK改訂へscopeが広がる

### 非目的

- ripgrep更新・version pin
- token文法、探索root、PK3/PK4/Workflow Stateの拡張
- CI/classifier、source docs、他checkerの変更

## Scope

- `scripts/doc-consistency-check.sh`: `test_token_exists()`のnegative glob 3個削除だけ
- `scripts/tests/doc-consistency-plan-packet.test.sh`: temp PATHのrg shimがreal rgへ委譲しつつargvを記録し、末尾rootが`tests src src-tauri`のhelper呼出しについてlong optionと、`-g` / `-qg`等のvalue-taking `g`を含むshort-option cluster（pattern別token / attached双方）をripgrep option grammarとして解析し、先頭`!` patternがないことをsource上の引用符非依存で検査するguard、3 root valid canary、fixture自身が`.gitignore`を生成するignored-only missing WARN / exit 0 fixture
- 本Packet / Matrix。`Plans.md`とWorkflow StateはCoordinatorのみ

## Non-scope

- 上記2 content file以外
- `scripts/local-ci.sh`, `pre-push.sh`, classifier, workflow YAML
- PK3 message / severity / exit、PK4、other doc checks
- generated artifacts、product source docs

## Acceptance Criteria

- rg shimが捕捉したhelper実行時argvに、long option、任意short-option cluster内のvalue-taking `g`、separate/equals/attached、source上のsingle/double/unquotedを問わず先頭`!`のglob patternが0
- `tests` / `src` / `src-tauri`の固有tokenを記載したsynthetic R3 packetが各tokenのmissing WARNを出さずexit 0
- gitignored `target` / `node_modules` / `dist`だけにあるtokenはexact missing WARNを出しexit 0
- existing `scripts/tests/doc-consistency-plan-packet.test.sh`全体PASS
- `--glob '!…'` / `--glob="!…"` / `--glob=!…` / `-g '!…'` / `-g!…` / `-qg '!…'` / `-qg!…`の同義negative glob再導入、root削除、regex破壊、`--no-ignore`、WARN抑止、exit 1 mutationが対応fixtureをredにする
- `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-29-pk3-negative-glob-false-warn.md` PASS
- `bash scripts/local-ci.sh full` CLEAN、hosted final required

## Design Sources

- Workflow: `docs/DEV_WORKFLOW.md` Plan Packet / PK3 WARN semantics
- Backlog: `Plans.md` Tooling follow-up
- Executable SSOT: `scripts/doc-consistency-check.sh`
- Existing fixture harness: `scripts/tests/doc-consistency-plan-packet.test.sh`

## Required Design Artifacts

| Area | Artifact | Status |
|---|---|---|
| PK3 behavior | existing checker + DEV_WORKFLOW | existing sufficient |
| regression oracle | Test Matrix / existing fixture suite | added in plan-first |
| runtime/product/source design | N/A | unchanged |

## Registration / Generation Obligations

該当なし。新script / source doc / route / command / REQ coverageを追加しない。

## Design Intent Trace

| Contract | Source | Implementation | Test |
|---|---|---|---|
| PK3 valid token detection | checker helper | negative glob removal | valid root canaries |
| PK3 missing WARN / exit0 | checker final branch | unchanged | ignored-only token fixture |
| scope guard | Plan / D-055 | two content files | runtime argv guard + git diff |

## Design Intent Audit

- durable semanticsは既存DEV_WORKFLOW / checkerから復元可能で変更なし
- external rg bugを新しいcontractへ昇格せず、desired behaviorをfixture化する
- lane 3はsource docs / generated artifactsへ触れない

## Impact Review Lenses

not applicable — 外部premiseを実装判断に使わず、deterministic local fixtureだけで閉じる。

## Design Readiness

- Existing design docs are sufficient because: PK3はheuristic WARNでexit 0と既存checkerが定義
- Source docs updated in this PR: none
- Design gaps intentionally deferred: PK4 registry extraction gap、Workflow State field coverage gap
- Workflow effectiveness: wave 4 WERへ含め、lane 1の実R3 packetで偽WARNがないことをdogfood

## Contract Probe

- N/A: rg 15.1再現を外部premiseにせず、command shapeとobservable behaviorをfixtureで固定する

## Test Plan

Test Design Matrix: `docs/archive/plans/test-matrices/2026-07-29-pk3-negative-glob-false-warn.md`

- targeted: doc-consistency plan packet fixture suite
- negative: ignored-only token / missing WARN / exit 0
- mutation: negative glob、root、regex、ignore、WARN、exit
- full: workflow classified L1 + hosted final

## Boundary / Wire Contract

not applicable — runtime wire / config / manifest不変。checker CLIのWARN/exit contractだけを既存同値で維持する。

## Review Focus

- 3 negative glob以外のhelper byte semanticsが変わっていないか
- fixtureがcurrent rgの偶然の挙動に依存していないか
- missing tokenとignored subtreeのoracleが逆転していないか
- R3へ昇格するscope creepがないか

## Review Response

- Findings Freeze: active。Claude closure reviewのP1/P2=0とconflict-free rebaseのcontent同値性を確定済み
- Plan Review: round 1 REQUEST CHANGES（P1=0 / P2=1）、round 2 REQUEST CHANGES（P1=0 / P2=1 / P3=1）、closure APPROVE（P1=0 / P2=0 / P3=0）
- Final Review: correction closureはClaude Opus 5 / Sonnet 5の2 passともAPPROVE（P1=0 / P2=0、reviewed content `b4137ead85597b6e12ec0969d92518e03da154a2`）。Lane 2統合後のconflict-free rebaseは全commit / range / 全体差分の同値性を証明し、rebased content HEAD `f3a4c72`のL1 fullもPASSしたためreview evidenceをcarry forwardした
- P3 disposition: stale `origin/main`は旧diff window拡大、設計書76分類gapはLane 2所有のbase dependencyとして帰属を確定し、Lane 2 merge後のL1 full PASSで解消を実証した。owner review-route correctionをD-055 decision pointとして介入2/3へ実数化した。ambient `TMPDIR`のmutation再現感度はwave 4 WER follow-up候補

## Spec Contract

Contract ID: SPEC-WF-PK3-TOKEN

- valid token across 3 roots => no missing WARN
- ignored-only / absent token => missing WARN
- WARN-only => exit 0

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-PK3-TOKEN | glob removal | valid canaries | false WARN 0 | fixture log |
| SPEC-WF-PK3-TOKEN | ignore preservation | ignored-only token | missing WARN + exit0 | fixture log |
| D-055 | two-file scope | runtime argv guard + git diff | footprint disjoint | fixture log + git diff |

## Data Safety

- repo外データ、secret、DB、backup非接触
- fixtureは`mktemp`配下のsynthetic repositoryだけ
- rollbackはlane implementation commitのrevert
