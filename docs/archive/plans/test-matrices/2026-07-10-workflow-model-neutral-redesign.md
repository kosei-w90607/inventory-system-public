# Test Design Matrix: workflow model-neutral 再設計

> 親 packet: [../2026-07-10-workflow-model-neutral-redesign.md](../2026-07-10-workflow-model-neutral-redesign.md)

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-ORDER: canonical reading order は AGENTS.md Session Start のみ、他は参照
- SPEC-WF-STATE: R2+ packet の `## Workflow State` 固定形式、13 phase enum、Plan Commit 先行
- SPEC-WF-MODE: 役割のモデル非依存、model 実名は slot 表と State 値のみ
- SPEC-WF-AUDIT: R3/R4 independent-review = Contract Audit（ledger / lifecycle / adjacent / mutation / negative-space / L3 boundary / PR body freshness）
- SPEC-WF-BUDGET: risk 別 subagent 上限、depth 1、one-writer
- SPEC-WF-CI: D-033 の L0/L1/L2 契約を弱めず、skills が同語彙で参照する

## Failure Modes

- 読み順リストが将来また複製され、正本と乖離する
- Workflow State の Phase に enum 外の値・欠落フィールドが入り、resume 手順が壊れる
- Plan Packet が実装 commit と同時作成される（PR #159 型再発）
- 設計契約が implementation / test / ledger のどこにも現れない negative space が残る
- mock が設計書期待値と偶然一致し、契約逸脱が green を維持する
- skills が旧 CI 語彙のまま残り、per-push 前提の手順を再生産する
- Mode B/C で Coordinator が自己承認して独立レビューが消える
- R0/R1 が active packet / Workflow State 不在で fail closed し、lightest sufficient routeを使えない
- 通常R2のlocal-onlyを記録できない、またはworkflow/releaseのdocs-only changeを誤って0-runにする
- tracked Workflow Stateへcurrent HEAD SHAを書き込み、state-only commitのたびに値がstaleになる
- Reviewed Content HEADをmerge三点一致へ誤って含める、またはReady後にhosted URLをtracked packetへcommitしてHEADを変える

## Test Matrix

design + implementation slice 1 PRのため、source-doc / skills / templates / PR metadataをdocs check・grep・review・state-only commit dogfoodで検証する。PK4/PK5/checker/hookをslice 2でscript testへ昇格する行は明記する。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-WF-ORDER | 読み順の複製復活 | docs check + review | `bash scripts/doc-consistency-check.sh` + Plan Gate レビュー | AGENTS.md のリンク先が実在しない、または本 PR 内に順序リストの複製が残る |
| SPEC-WF-ORDER | 将来の再複製 | script test（slice 2） | reading-order drift grep test（`scripts/tests/` 予定） | AGENTS.md 以外の active docs に順序リストが再出現する |
| SPEC-WF-STATE | 形式不正 / enum 外 Phase | docs check（本 PR は self-dogfood、slice 2 で PK4） | `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-10-workflow-model-neutral-redesign.md` | 本 packet が PK1/PK2 を通らない。slice 2 後は enum 外 Phase が ERROR にならない場合に fail |
| SPEC-WF-STATE | 壊れた State のまま resume が進行 | 規範 + dogfood（fail-closed 規則、Plan Gate round 1 P2 対応） | UI-11c dogfood で欠落 State を意図的に想定した手順確認 | Workflow State 欠落・enum 外でも resume が実装や phase 前進を続けてしまう |
| SPEC-WF-STATE | plan-approved を経ず実装開始（Plan Gate bypass） | 規範 + dogfood（遷移表 + Implementation Rules 強化、round 2 P1 対応）、slice 2 PK5 | UI-11c dogfood で plan-first commit → plan-approved 記録 → 実装 commit の順序確認 | Phase が plan-gate のままの packet でも実装 commit が積める |
| SPEC-WF-STATE | 複数 / stale packet の誤選択で resume | 規範 + dogfood（packet 選択規則、round 2 P2 対応）、slice 2 PK4 候補 | Plans.md 進行中リンクとの突合手順確認 | Plans.md と不一致の packet や旧 branch の packet で resume が正常続行する |
| SPEC-WF-MODE | Mode 定義と packet 役割割当の矛盾 | 規範 + review（MANUAL §3.1 design-board 例外、round 2 P2 対応） | Plan Gate レビューで State の役割行と Mode 定義を突合 | 例外記録なしに Mode 表と異なる役割割当が通過する |
| SPEC-WF-MODE | 役割担当の一時不能で無承認進行 | 規範 + review（MANUAL §3.5 capacity-degraded、Plan Gate round 1 P2 対応） | Plan Gate レビュー + WER | Plan Reviewer / Final Reviewer が pending のまま plan-approved / Ready へ進める |
| SPEC-WF-STATE | Plan Commit が実装 commit に先行しない | git 検査（slice 2 の PK5）+ review | plan-commit ordering check（設計は Appendix C） | 実装ファイル初回 commit が Plan Commit より先でも検出されない |
| SPEC-WF-MODE | model 実名の hard-code 再発 | review + dogfood | Plan Gate レビュー + 次 R3 WER | normative 本文（slot 表と State 値以外）にモデル実名が現れても指摘されない |
| SPEC-WF-AUDIT | negative space 残存 | dogfood | 次 R3 change（UI-11c）での Contract Coverage Ledger 運用 | 触った design doc の決定 ID に ledger 行がないまま plan-gate を通過する |
| SPEC-WF-AUDIT | mock 偶然一致の green | dogfood | 次 R3 change での anti-tautology 確認（T11/T13 型） | mock 値を設計書期待値からずらしても全テスト green のまま |
| SPEC-WF-BUDGET | 上限超過 / 自己承認 | review | Plan Gate レビュー + WER | R3 で 3 本以上の並列 subagent、または Coordinator = Final Reviewer が通過する |
| SPEC-WF-CI | D-033 の弱体化 | docs check + review | `git diff -- docs/ci.md docs/decision-log.md` とRisk Routingの突合 | pure docs R0/R1 0-run、R2 impact routing、workflow/release 1-run、final-onlyのいずれかが弱まる |
| SPEC-WF-CI | skills の旧語彙残存 | grep + review（slice 1） | `rg -n "local-ci|ready_for_review|Hosted CI" .agents/skills/` を slice 1 受け入れで実行 | slice 1 後も skills に L0/L1/L2 語彙がない |
| SPEC-WF-STATE | R0/R1 が R2+ state machineへ誤進入 | grep + route review | workflow-start / implementation の R0/R1 no-Plan route確認 | R0/R1 に packet selection、Workflow State、Plan Commitのいずれかが必須になる |
| SPEC-WF-CI | R2 hosted evidence / docs-only workflow例外の混同 | source-doc + template + live workflow review | DEV_WORKFLOW Hosted CI Requirementとci.md Risk Routing / Ready guardの突合 | `not-required`をReady event抑止と誤認する、またはworkflow/releaseのdocs-only changeが0-runになる |
| SPEC-WF-STATE | tracked current SHAの自己参照 | lifecycle review + exact field check | active packet先頭Workflow State / templateに`- Local Full HEAD:`がなく、`Reviewed Content HEAD` + `Final Exact-HEAD Evidence: PR body`があること。historical Review Responseの旧語は対象外 | state-only transition commit後にtracked SHAが直ちにstaleになる |
| SPEC-WF-CI | Ready時three-pointの曖昧化 | state-only dogfood + PR metadata review | live PR HEAD = PR-body L1 SHA = hosted headSha（required時）。Reviewed Content HEADは比較対象外 | audit SHAをmerge SHAと誤認する、またはhosted後のtracked commitでHEADが変わる |

## State Lifecycle Matrix

Workflow State 自体の lifecycle（本 PR で導入する状態機械の遷移検査）:

| 遷移 | 期待 | 検査 |
|---|---|---|
| initial（packet 新規作成） | Phase: kickoff または plan-draft、Plan Commit: pending | self-dogfood（本 packet）+ slice 2 PK4 |
| State 欠落・不完全・enum 外（fail-closed） | pre-plan-gate 扱いで停止、実装・phase 前進・Ready 禁止、owner へ報告 | DEV_WORKFLOW Workflow State fail-closed 規則 + UI-11c dogfood |
| 役割担当の一時不能（capacity-degraded） | 該当役割 pending 化 + Phase 前進禁止 + owner 指名 or fresh context | MANUAL §3.5 + Plan Gate レビュー |
| plan-approved → implementing（唯一の実装入口） | Phase が plan-approved 到達済み + Plan Commit が実装 commit に先行 | DEV_WORKFLOW 遷移表 + slice 2 PK5 |
| resume の packet 選択 | Plans.md 進行中リンクの唯一の active packet のみ。複数・不一致・欠落・branch 不一致は停止 | DEV_WORKFLOW 選択規則 + slice 2 PK4 候補 |
| plan-gate → plan-approved | 独立 Plan Reviewer の P1/P2 = 0 記録 + Plan Commit SHA 確定 | Review Response の記録 + slice 2 PK5 |
| 複数の隣接forward遷移を1 state-only commitでmaterialize | commit前に各遷移の証拠が揃い、append-only narrativeから全中間phaseと証拠を復元可能。gate skipや実装先行は不可 | `git diff --unified=0 <parent>..<state-commit>` + review narrative。`plan-gate → plan-approved → implementing` dogfood |
| implementing → local-verified | content candidateのCLEAN L1をPR bodyへ記録。tracked current SHAは書かない | L1 evidence / PR body突合 |
| independent-review → human-confirm | state-only commitがReviewed Content HEADに監査済みcontent SHAを記録。final exact-HEAD evidence locatorはPR bodyのまま | file allowlist + `git diff --unified=0 <parent>..<state-commit>`でpacket内hunkがState / append-only review evidenceだけか確認 + Final Reviewer result |
| human-confirm → ready-hosted-final | owner承認後、Draft上でstate-only Ready commit → 同HEAD L1 full → PR body更新 → Ready/dispatch | live PR state / L1 evidence / PR body |
| ready-hosted-final → merge | 追加tracked commitなし。PR HEAD = PR-body L1 SHA = hosted headSha（required時） | merge前three-point check |
| Ready 後の修正（後退遷移） | Draft へ戻し Phase: implementing へ明示的に後退 | pre-push Ready block（既存）+ State 行の更新確認 |
| failure / retry | 差し戻し時に Phase が前進しない | Plan Gate / independent-review の記録 |
| archive | packet を docs/archive/plans/ へ移動、Phase: archive | Post-Merge Closeout（既存手順） |
| R0/R1 route | Workflow Stateなし、Current Phase: not applicable、Risk tableのtargeted checkへ直接進む | workflow-start / implementation skillのrisk条件確認 |
| R2 hosted evidence not-required | Hosted CI Requirement: not-required。L1 fullをmerge evidenceとしhosted成功を必須にしない。ただしnon-doc Ready eventのincidental runは抑止しない | DEV_WORKFLOW field enum + ci.md Risk Routing + live workflow guard |
| R2 not-required incidental failure | product/test/gate failureはDraft→implementingへ戻して修正。infra/cancelだけowner residual-risk受理可 | run conclusion / failure class / PR body owner dispositionの突合 |
| workflow/release docs-only | Hosted CI Requirement: required。自動eventがpaths-ignoreでもowner Ready後にexplicit dispatchを1 run | ci.md Risk Routing + implementation skill |

## Adjacent Pattern Audit

本 PR が「既存パターンの横展開」に当たる箇所:

- PK1-PK3 の line-regex 検査パターン → PK4/PK5 は同機構で実装する（slice 2。YAML parser 等の新機構を持ち込んだら設計逸脱）
- PR #160 の plan-first commit → 実装 PR の分離パターン → 本 PR と slice 1 も同じ分離を踏襲する
- 73.13 の L3 checklist 形式（画面 / 到達手順 / 観測可能な合格基準） → Contract Audit の manual verification boundary が同形式を要求することを確認

## Negative Paths

- missing input: Workflow State のフィールド欠落 → slice 2 PK4 で ERROR、それまで Plan Gate レビューで検出
- invalid input: Phase enum 外の値 → 同上
- stale evidence: PR body L1 SHAがlive PR HEADと不一致 → Ready / merge停止
- state-only scope violation: transition commitにsource docs / skills / tests等が混入 → content commit扱いでimplementingへ戻しreview再実行
- hosted not-required failure: product/gate failure → Draft / implementingへ戻る。infra/cancel → owner dispositionをPR bodyへ記録しない限りmerge停止
- duplicate/ambiguous input: 読み順リストの複製 → drift grep test（slice 2）
- unknown reference: 相互リンク切れ → 既存 doc check R3 で ERROR
- dependency missing: active plan なしで R2+ 実装 diff → slice 2 で WARN → ERROR 段階導入
- permission/write failure: 該当なし（docs のみ）
- dry-run side effect: 該当なし

## Mutation-style Adequacy Questions

- Workflow State の Phase 行を削除したら、どの検査が fail するか → 本 PR 時点は Plan Gate レビュー、slice 2 後は PK4
- Plan Commit を実装 commit の後に置いたら、どの検査が fail するか → slice 2 PK5（それまでは DEV_WORKFLOW Plan Packet Rules への人手突合）
- mock 値を設計書期待値と同じにしたテストだけで構成したら、どの工程が検出するか → Contract Audit の anti-tautology 確認（次 R3 dogfood で実証）
- skills から L0/L1/L2 語彙を落としたら、どの検査が fail するか → slice 1 受け入れ grep
- tracked packetのnormative Stateへ`- Local Full HEAD: <current SHA>`を戻したら、どの検査がfailするか → State section / template exact-line検査 + Contract Audit lifecycle（historical narrativeは除外）
- hosted run URLをpacketへcommitしたら何が起きるか → PR HEADがhosted headShaからずれるためthree-point check fail

## Compatibility Checks

- old schema/input: 既存 archived packet（Workflow State なし）は PK 検査対象外で影響なし
- new schema/input: 本 packet が新形式の初例として checker green であること
- output order: 該当なし
- optional field behavior: R0/R1 は packet / Workflow State / Plan Commit 不要。R2+だけ固定Stateを持つ

## Data Safety Checks

- source-derived data: 非接触（docs のみ）
- generated outputs: 非接触
- secrets: 非接触
- local-only files: 非接触
- synthetic sample boundaries: 該当なし

## Main Wiring / Integration Checks

- helper connected to main path: DEV_WORKFLOW の新 3 section が Flow / Review Rules から参照可能な位置にあり、AGENT_OPERATING_MANUAL router 表が新 section を指す
- output reaches manifest/report: D-034 が decision-log に存在し、packet の Trace Matrix から引用されている
- effective config reaches runtime: 該当なし（runtime 非接触）
- CLI arg reaches implementation: 該当なし

## Residual Test Gaps

- Contract Audit の実効性（15 見落とし 3 分類を本当に捕捉するか）は本 PR では検証不能。次 R3 dogfood（UI-11c）の WER が初回の実証点
- PK4/PK5 が入るまで Workflow State の形式検査は人手依存
- Mode B / C の実運用は Fable window 終了後まで dogfood できない（設計上のみレビュー可能）
