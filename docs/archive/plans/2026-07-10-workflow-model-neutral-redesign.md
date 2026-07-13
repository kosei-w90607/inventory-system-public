# Plan Packet: workflow model-neutral 再設計（design + implementation slice 1）

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: codex-only
- Plan Commit: 9a6015c8d134ded53c9c8bede24adbf2acaae0e9
- Coordinator: Sol（実装 slice 1 の source-doc contract review、finding 裁定、final integration）
- Writer: Terra（実装 slice 1 の唯一の writer）
- Plan Reviewer: fresh read-only Sol（D-035 adjacent-transition amendment、P1/P2/P3 = 0）
- Final Reviewer: fresh read-only Sol（D-035 final Contract Audit round 2、Writer / Plan Reviewerと別context、P1/P2 = 0）
- Reviewed Content HEAD: 77332ec774038c62cdfe22dbcb932e71c778fc0a
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none

## Risk

Risk: R3

Reason:
workflow / merge gate の恒久変更（reading order 正本化、Workflow State 導入、Contract Audit 標準化、subagent budget、availability mode）と、その確定済み設計を skills / templates / review rules へ反映する implementation slice 1。docs/DEV_WORKFLOW.md の Risk Tiers「merge gate changes」に該当する。

## Goal

Fable / Claude / Codex のどの組み合わせが利用可能でも repository workflow が停止しない model-neutral な役割定義・状態管理・監査工程を source docs として確定し、PR #159 型の契約漏れを標準工程で検出できるようにする。続けて、実装前に確定していた Appendix B の implementation slice 1 を skills / templates / review rules へ反映する。

## Scope

### Completed design slice（PR #162）

- `AGENTS.md` Session Start を canonical reading order の正本に更新（AGENTS → DEV_WORKFLOW → Plans → project-memory → task docs）
- `docs/DEV_WORKFLOW.md` へ `Workflow State`（13 phase の固定 Markdown section）、`Subagent Budget`（risk 別上限）、`Contract Audit (R3/R4)`（PR #159 prevention package）を追加、Implementation Rules の reading order を正本参照へ修正
- `docs/AGENT_OPERATING_MANUAL.md` を model-neutral な role / availability mode（Mode A: fable-window、Mode B: dual-vendor-no-fable、Mode C: codex-only）の正本へ全面改訂、model slot 対応表を唯一の載せ替え点として新設
- `docs/decision-log.md` D-034、本 Plan Packet、Test Design Matrix、Appendix B / C の実装発注を確定

### Active implementation slice 1（PR #163）

Appendix B の実装前確定済み items 1-9 を正式 scope とする。実装対象と責務は次のとおりで、Appendix B との差分を作らない。

- `.agents/skills/inventory-workflow-start/SKILL.md` / `.agents/skills/inventory-operator-ui/SKILL.md`: canonical reading-order pointer、idempotent start/resume、Risk routing pointer
- `.agents/skills/inventory-implementation/SKILL.md`: Plan-first / Workflow State guard、L0/L1/L2 ladder、Draft / owner Ready / exact-HEAD 規則
- `.agents/skills/inventory-code-review/SKILL.md`: Contract Audit の実行手順
- `docs/templates/plan-packet.md` / `docs/templates/test-design-matrix.md` / `docs/templates/subagent-review-packet.md`: Workflow State、Contract Coverage Ledger、Lifecycle / Adjacent / anti-tautology / negative-space の review artifact
- `.github/pull_request_template.md`: Workflow State Phase 欄
- `.claude/rules/review-workflow.md` / `docs/quality/review-checklist.md` / `CLAUDE.md`: source-doc pointer と model-neutral 化
- `Plans.md`: active slice / blocking follow-up の同期
- Independent Contract Audit で accept した既存契約の整合修正: 本 packetの正式 Scope / Non-scope / Acceptance Criteria と Workflow State、R0/R1 no-Plan route、R2 `Hosted CI Requirement: not-required` と docs-only workflow/release 例外、kickoff output / skill description。修正先は上記対象に加え、その規範正本である `docs/DEV_WORKFLOW.md` / `docs/ci.md` / `docs/decision-log.md` D-033、本 packet / Matrix に限定する
- Follow-up D-035: tracked stateのSHA自己参照を廃止し、`Reviewed Content HEAD`とPR body正本のfinal exact-HEAD evidenceへ分離する。state-only transition commitとReady/merge三点一致を一意に定義し、DEV_WORKFLOW / D-035 / skills / templates / PR templateへ同期する

## Non-scope

- product runtime の `src/` / `src-tauri/src/`
- `scripts/doc-consistency-check.sh` の PK4 / PK5、drift grep test、hook（mechanical enforcement slice 2 へ deferred）
- D-033 の CI実装・workflow YAML・trigger・cache・L0/L1/L2・final-only・exact-HEAD 契約の変更。今回の `docs/ci.md` は既存 Risk Routing の曖昧さだけを訂正する
- `.codex/agents/*` / `.claude/agents/*` の新設・変更
- Ready 化、hosted final 実行、merge、GitHub settings / branch protection の変更
- `docs/ai-workflow/` generic pack の改訂（並行定義の統合は別判断）
- Appendix B items 1-9 と accepted Independent Contract Audit remediation を越える新機能・近接 cleanup
- PK4/PK5/checker/hookによるD-035機械強制（slice 2）

## Acceptance Criteria

- completed design slice の既存基準（canonical order、13 phase、3 mode、D-034、6-contract Ledger、Plan Gate P1/P2 = 0）を `rg -n "Workflow State|Contract Coverage Ledger|D-034" AGENTS.md docs/DEV_WORKFLOW.md docs/AGENT_OPERATING_MANUAL.md docs/decision-log.md` で確認できる
- formal Active implementation slice 1 と実装前から存在した Appendix B items 1-9 の対象・責務に差分がなく、`git diff --name-only main...HEAD` が Non-scope に触れない
- `rg -n "For R0/R1|For R2\\+|Current Phase: not applicable" .agents/skills/inventory-workflow-start/SKILL.md .agents/skills/inventory-implementation/SKILL.md` で、R0/R1 は Plan Packet / Workflow State / Plan Commit 不要、R2+だけが state machine対象と確認できる
- Workflow Stateの`Risk`はR2-R4、tracked `Hosted CI Requirement`は`required | not-required`だけ。`not-required`はmerge evidence義務を外すだけでReady eventを抑止しない。workflow/release changeはdocs-onlyでも`required`とし、run URL/headShaはPR bodyだけから復元できる
- kickoff output に Risk / Execution Mode / Required artifacts / Current Phase / Next action / Open questions が揃い、implementation skill description は AGENTS.md Session Start だけを参照する
- `rg -n "Ledger|Lifecycle|Adjacent|anti-tautology|negative-space|L3|freshness|local-ci.sh" docs/templates .agents/skills` で、Plan / Matrix / review templates と skills が Contract Audit 7観点とD-033 ladderを実行可能な文として保持すると確認できる
- `bash scripts/doc-consistency-check.sh`、`bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-10-workflow-model-neutral-redesign.md`、shell syntax、targeted contract grep、`git diff --check` が exit 0
- CLEAN exact-HEAD `bash scripts/local-ci.sh full` と Writer / scope-sync Plan Reviewer とは別 context の fresh Contract Auditで P1/P2 = 0。完了後に Workflow State / `Plans.md` / PR bodyを `human-confirm` へ同期する
- tracked packetにcurrent PR HEADのSHAを埋め込まず、`Reviewed Content HEAD`はFinal Reviewerが監査した先行content commitだけを指す。final L1 SHAとhosted URL/headShaはPR bodyだけに記録する
- owner Ready時はDraft上のstate-only `ready-hosted-final` commit → 同HEADのCLEAN L1 full → PR body更新 → Ready/dispatchの順で進み、merge gateはlive PR HEAD = PR-body L1 SHA = hosted headSha（required時）だけを比較する
- state-only commitで複数phaseをmaterializeする場合は、遷移表上の隣接forward遷移に限り、commit前に各required evidenceが存在し、append-only narrativeから全中間phaseを復元できる。`git diff --unified=0 <parent>..<state-commit>`とnarrativeを突合し、記録圧縮であってgate skipでないことを確認できる

## Design Sources

- Requirements / spec: docs/DEV_WORKFLOW.md（Flow / Risk Tiers / Plan Packet Rules / Verification Gates / Review Rules）
- Architecture: docs/AGENT_OPERATING_MANUAL.md（役割 / mode の正本）、AGENTS.md（入口の正本）
- Function / command / DTO: 該当なし（runtime code 非接触）
- DB: 該当なし
- Screen / UI: 該当なし
- Decision log / ADR: docs/decision-log.md D-026 / D-033 / D-034、docs/ci.md（CI 契約の正本）、docs/archive/plans/2026-07-08-ui10-stocktake-workflow-effectiveness-review.md（PR #159 一次入力）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 該当なし（runtime 非接触） | existing sufficient |
| Command / DTO / generated binding / wire shape | 該当なし | existing sufficient |
| DB / transaction / audit / rollback / migration | 該当なし | existing sufficient |
| Screen / UI / route state / Japanese wording | 該当なし | existing sufficient |
| CSV / TSV / report / import / export format | 該当なし | existing sufficient |
| Durable decision / ADR | docs/decision-log.md D-034 / D-035 | updated in this PR |
| Workflow gate / agent operating norms | AGENTS.md、docs/DEV_WORKFLOW.md、docs/AGENT_OPERATING_MANUAL.md | D-034実装済み。D-035 state/evidence分離をfollow-up設計で更新 |
| Skills / templates / rules（slice 1） | .agents/skills 4本、docs/templates 3本、.claude/rules/review-workflow.md、CLAUDE.md、PR template | PR #163で実装済み。D-035 field/pointer差分もfresh Plan Gateを経て同期済み |
| Mechanical enforcement（slice 2） | PK4/PK5、doc-consistency checker、reading-order drift test、hook | intentionally deferred（slice 2） |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-ORDER | AGENTS.md Session Start | D-034 | 5 通りの読み順 drift を単一正本化。各所複製は再 drift するため参照のみ許可 | AGENTS.md（本 PR）+ skills 参照化（slice 1） | doc check green + slice 2 の drift grep test |
| SPEC-WF-STATE | DEV_WORKFLOW.md Workflow State | D-034 / D-035 | 固定Markdown sectionを維持しつつ、tracked current SHAは自己参照になるため不採用。Reviewed Content HEAD + PR body evidenceを採用。post-local phase全面metadata化はoffline resumeを弱めるため不採用 | DEV_WORKFLOW.md + plan-packet / PR templates + workflow skills | 本packet self-dogfood + state-only lifecycle review。PK4/PK5はslice 2 |
| SPEC-WF-MODE | AGENT_OPERATING_MANUAL.md §2-3 | D-034 | 役割をモデル名から分離。model slot 表を唯一の載せ替え点にする | AGENT_OPERATING_MANUAL.md（本 PR） | Plan Gate レビュー + 次 R3 dogfood |
| SPEC-WF-AUDIT | DEV_WORKFLOW.md Contract Audit (R3/R4) | D-034 | PR #159 の 15 見落とし 3 分類に対応。専用 skill は入口増で不採用、既存 packet/template 拡張 | DEV_WORKFLOW.md（本 PR）+ templates / review skill（slice 1） | 次 R3 dogfood の ledger 実運用 |
| SPEC-WF-BUDGET | DEV_WORKFLOW.md Subagent Budget | D-034 | risk 別上限で token 消費と one-writer 衝突を制御 | DEV_WORKFLOW.md（本 PR） | Plan Gate レビュー + WER |
| SPEC-WF-CI | docs/ci.md Risk Routing + exact-HEAD contract | D-033 / D-035 | D-033実行契約は不変。accepted remediationでdocs/ci.md / D-033のR2・docs-only表現を更新し、D-035はevidence格納先だけを分離 | DEV_WORKFLOW / decision-log / skills / templates / PR body | doc check + three-point lifecycle review |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 本 PR 後、reading order は AGENTS.md、workflow 規範は DEV_WORKFLOW.md、役割は AGENT_OPERATING_MANUAL.md、判断根拠は D-034 から復元可能
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: frontmatter 不採用・専用 skill 不採用・slice 分割の 3 判断を D-034 Alternatives へ昇格済み
- Assumptions and constraints: Codex 側に hook 機構がない前提（AGENT_OPERATING_MANUAL §6）、doc checker は bash + rg の line-regex である前提、owner が唯一の Human Gate である前提
- Deferred design gaps, risk, and follow-up target: skills / templates / rulesとD-035 field/pointer差分はPR #163で実装済み。残るdeferはPK4/PK5/checker/drift test/hookのmechanical slice 2だけ
- Test Design Matrix can cite design decision IDs or source doc sections: Matrix は SPEC-WF-ORDER / STATE / MODE / AUDIT / BUDGET / CI を引用する

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable。POS / 外部機器に非接触 | なし |
| Fact check / design decision split | applicable。drift inventory（下記 Appendix A）は観測事実、canonical ownership は設計判断として D-034 に分離 | D-034 |
| Lifecycle / retry | applicable。Workflow State の phase 後退（Ready 後修正 → Draft → implementing）を遷移規則に明記済み | DEV_WORKFLOW Workflow State |
| Operator workflow | not applicable。店舗 operator 画面に非接触 | なし |
| Replacement path | applicable。モデル更改時は AGENT_OPERATING_MANUAL §3.4 の slot 表だけを更新する構造にした | AGENT_OPERATING_MANUAL §3.4 |
| Data safety / evidence | applicable。実装 slice でも実 PR の店舗データ・secret には非接触。evidence は SHA / run URL のみ | Data Safety section |
| Reporting / accounting semantics | not applicable。集計・帳票に非接触 | なし |
| Manual verification | applicable。Plan Gate レビューと次 R3 dogfood が人手検証に相当 | Review Response + 次 WER |

## Design Readiness

- Existing design docs are sufficient because: 本 PR 自体が design docs の更新であり、CI 契約（docs/ci.md、D-033）と PR #159 WER が一次入力として確定済み
- Source docs updated in this PR: AGENTS.md、docs/DEV_WORKFLOW.md、docs/AGENT_OPERATING_MANUAL.md、docs/decision-log.md（D-034 / D-035）、accepted remediationのdocs/ci.md / D-033
- Design gaps intentionally deferred: PK4/PK5 の具体実装仕様（grep パターン・エラーメッセージ文言）は mechanical slice の Design Phase で確定
- Durable decisions discovered in this plan and promoted to source docs: D-034（Workflow State形式、Contract Audit配置、slice分割）とD-035（tracked audit identity / PR metadata exact-HEAD evidence分離）

Minimum design checks for business-app work:

- Layer ownership（UI → CMD → BIZ → IO/MNT）: 非接触、変更なし
- Backend function design: 非接触
- Command / DTO / data contract: 非接触
- Persistence / transaction / audit impact: 非接触
- Operator workflow / Japanese UI wording: 非接触
- Error, empty, retry, and recovery behavior: Workflow State の phase 後退規則として記述済み
- Testability and traceability IDs: SPEC-WF-ORDER / STATE / MODE / AUDIT / BUDGET / CI

## Test Plan

Test Design Matrix: [test-matrices/2026-07-10-workflow-model-neutral-redesign.md](test-matrices/2026-07-10-workflow-model-neutral-redesign.md)

- targeted tests: `bash scripts/doc-consistency-check.sh` と `--target plan`（本 packet）。契約と検証点の対応は `## Contract Coverage Ledger` を正とする
- negative tests: PK2 placeholder / 空 bullet 検査（checker 既存）、Workflow State の enum 外 phase 値は slice 2 の PK4 で ERROR 化予定
- compatibility checks: 既存 active plan なし（全 archive 済み）のため既存 packet への影響なし。既存 PK1-PK3 の必須セクション定義は不変
- data safety checks: 実データ・secret・store 情報への非接触を `git status --short` と diff レビューで確認
- main wiring/integration checks: DEV_WORKFLOW → AGENT_OPERATING_MANUAL → AGENTS.md の相互リンクが実在ファイルを指すこと（doc check R3 リンク検査）

## Boundary / Wire Contract

- producer: Writerがtracked Workflow Stateを更新し、coordinatorがvolatile exact-HEAD evidenceをPR bodyへ更新
- consumer: 人間（owner / reviewer）、`$inventory-workflow-start` のresume手順、将来のPK4 checker、merge前three-point check
- wire type: 固定Markdown section + PR body metadata。tracked sectionは`Reviewed Content HEAD`と`Final Exact-HEAD Evidence: PR body`を持ち、current PR HEADのSHAを持たない
- internal type: なし（runtime 非接触）
- precision/range: Phase enum 13値、Risk R2-R4、Execution Mode 3値。`Reviewed Content HEAD`はpendingまたは40桁SHA、final L1 / hosted headShaはPR bodyのlive PR HEADと一致。R0/R1はpacket / wire自体を持たない
- round-trip path: content commit C → L1 / Final Review on C → state-only commit SがCを記録 → L1 on S / PR body exact S → owner Ready state-only commit R → L1 / hosted on R → PR body三点一致 → merge
- invalid input: enum 外の値は slice 2 で PK4 ERROR。それまでは Plan Gate レビューで人手検出
- compatibility: active packet / templateをD-035 fieldへ同時移行。既存archived packetはPK検査対象外、R0/R1はpacket自体不要。旧`Local Full HEAD`を新packetで受理しない機械検査はslice 2

## Review Focus

- canonical ownership の分割（AGENTS / DEV_WORKFLOW / MANUAL / CLAUDE.md / skills）に漏れ・重複復活がないか
- Workflow State の 13 phase と遷移規則が実運用（Draft 戻し、review 差し戻し）を表現できているか
- Contract Audit の 7 要素が PR #159 の 15 見落とし 3 分類（契約書き忘れ / 機械レビュー限界 / 横展開漏れ）を実際にカバーするか
- Mode B / C で Plan Gate と Final Reviewer の独立性（自己承認禁止）が保たれるか
- CI 契約（D-033）を弱める記述が紛れ込んでいないか
- 実装 slice の発注内容（Appendix B）が skills / templates の現状と矛盾しないか

## Contract Coverage Ledger

DEV_WORKFLOW「Contract Audit (R3/R4)」の 4 列 ledger を本 packet 自身に適用する（self-dogfood。Plan Gate round 1 P1 指摘で追加）。automated test 列の「なし」は negative space の明示であり、L3 / dogfood 列がその契約の検証点になる。

| Design contract | Implementation target | Automated test | L3 / non-scope |
|---|---|---|---|
| SPEC-WF-ORDER: 読み順の正本は AGENTS.md Session Start のみ | AGENTS.md（本 PR）+ skills pointer 化（slice 1） | `doc-consistency-check.sh` リンク実在検査（現行）、reading-order drift grep test（slice 2） | non-scope（実機 L3 不要）。Plan Gate 人手確認 |
| SPEC-WF-STATE: Workflow State固定形式・13 phase・fail-closed・SHA自己参照なし | DEV_WORKFLOW Workflow State / D-035 + 本packet self-dogfood + plan / PR templates + skills | `--target plan` PK1/PK2、normative State block / templateのexact field検査。historical Review Responseは対象外。PK4/PK5はslice 2 | state-only commitとPR body three-pointをPR #163でdogfood |
| SPEC-WF-MODE: 役割のモデル非依存、Plan Gate / Final Reviewer の独立性 | AGENT_OPERATING_MANUAL §2-3 | なし（機械検査対象外） | Plan Gate 人手レビュー。Mode B/C は Fable window 終了後に dogfood |
| SPEC-WF-AUDIT: Contract Audit 7 要素の R3/R4 標準化 | DEV_WORKFLOW Contract Audit + templates / inventory-code-review（slice 1） | なし（本 PR 時点。checker 拡張は slice 2 で評価） | UI-11c dogfood の ledger 運用 + WER で実効性検証 |
| SPEC-WF-BUDGET: subagent 上限・depth 1・one-writer | DEV_WORKFLOW Subagent Budget | なし（機械検査対象外） | Plan Gate 人手レビュー + WER |
| SPEC-WF-CI: D-033 契約を弱めない、skills の L0/L1/L2 同語彙化 | docs/ci.md / D-033 の既存Risk Routing明確化 + skills 3 本（slice 1） | `doc-consistency-check.sh` green、`rg -n "not-required|pure docs-only|workflow/release" docs/DEV_WORKFLOW.md docs/ci.md docs/decision-log.md .agents/skills/` | hosted CI 実行はowner Ready後。Draft中は0 run |

## Spec Contract

Contract ID: SPEC-WF-REDESIGN-2026-07-10

- SPEC-WF-ORDER: セッション読み順の正本は AGENTS.md Session Start のみ。他文書・skill は参照に限る
- SPEC-WF-STATE: R2+ Plan Packetは固定Markdownの`## Workflow State`を持ち、Phaseは13値enum、Plan Commitはplan-approved時点でSHA確定し実装commitより先行する。tracked stateは`Reviewed Content HEAD`だけを持ち、final exact-HEAD evidenceはPR bodyを正本とする
- SPEC-WF-MODE: 役割定義はモデル名から独立。モデル実名は AGENT_OPERATING_MANUAL §3.4 の slot 表と Workflow State の値にのみ現れる
- SPEC-WF-AUDIT: R3/R4 の independent-review は Contract Coverage Ledger の再検証・negative-space audit・mutation/anti-tautology 確認・PR body freshness を含む
- SPEC-WF-BUDGET: subagent 同時数は R0/R1: 0、R2: 0-1、R3: 2、R4/workflow: 3。depth 1、one-writer、summary は約 20 項目以内 + file:line
- SPEC-WF-CI: L0 pre-push / L1 local-ci full（exact-HEAD CLEAN）/ L2 hosted final（Ready 化 or dispatch、required routeは1 change 1 run、pure docs R0/R1は0 run、workflow/release docs-onlyはdispatch、Ready 後修正は Draft 戻し）を全 skills が同語彙で参照する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-ORDER | AGENTS.md 更新 + slice 1 で skills 参照化 | doc check green（本 PR）、drift grep test（slice 2） | 読み順の複製が残っていないか | AGENTS.md diff + slice 2 test |
| SPEC-WF-STATE | DEV_WORKFLOW / D-035 + 本packet self-dogfood、Plan Gate後にskills/templates/PR template同期 | plan check、packet先頭State / templateの`- Local Full HEAD:` exact-line不在、state-only lifecycle review。historical Review Responseは許容。PK4はslice 2 | phase遷移・自己参照排除・three-point一意性 | packet / PR body / L1 evidence |
| SPEC-WF-MODE | AGENT_OPERATING_MANUAL 全面改訂 | Plan Gate レビュー（人手） | 自己承認禁止の担保 | Review Response |
| SPEC-WF-AUDIT | DEV_WORKFLOW Contract Audit 新設 + slice 1 templates | 次 R3 dogfood の ledger 運用 | 15 見落とし 3 分類のカバー | 次 WER |
| SPEC-WF-BUDGET | DEV_WORKFLOW Subagent Budget 新設 | Plan Gate レビュー（人手） | 上限値の妥当性 | Review Response |
| SPEC-WF-CI | slice 1 で skills 3 本へ ladder 語彙反映 | doc check green + slice 1 レビュー | D-033 を弱めていないか | slice 1 PR diff |

## Data Safety

- 実 POS CSV / PLU export / 店舗データ / DB / backup / log / secret / `.env*` に一切触れない（docs のみの変更）
- local-only paths（`.local/`、`docs/research/real-csv/` ほか project-profile 記載）は変更しない
- evidence は SHA / Actions run URL / file:line のみで、店舗固有情報を含めない

## Self-Review

7 観点セルフレビュー実施済み（2026-07-10、Fable）:

1. 設計書突合: DEV_WORKFLOW / ci.md / D-026 / D-033 / WER / PK1-PK3 checker 実装を直接読了し、記述はすべて実ファイルで裏取りした（subagent summary の直採用なし）
2. スコープ膨張: design sliceではskills / templates / rules / scriptsを除外し、implementation slice 1ではAppendix B items 1-9だけを正式Scopeへ昇格。mechanical scripts / hooksは引き続きNon-scope
3. 契約後退: CI 契約（final-only / exact-HEAD / Draft-first / pure docs R0/R1 0 run / workflow・release 1 run）は弱めていない
4. 既存 checker 通過: PK1 必須セクション（R3 = base 7 + Spec Contract / Trace Matrix / Data Safety + Matrix リンク）と PK2（placeholder / 空 bullet 禁止）を満たす形式で作成
5. 自己 dogfood: Workflow State を本 packet に初適用し、chicken-egg（Plan Commit は plan-approved まで pending）を遷移規則どおり表現
6. 再発防止の対応関係: PR #159 の 15 見落とし 3 分類それぞれに Contract Audit の要素を対応付けた（Ledger = 契約書き忘れ、L3 boundary + 独立監査 = 機械レビュー限界、Adjacent Pattern Audit = 横展開漏れ）
7. 停止耐性: Mode B / C で全役割が Fable / Claude なしでも埋まることを役割表で確認

## Appendix A: 現状 drift inventory（観測事実、2026-07-10 時点）

1. セッション読み順が 5 通り併存: AGENTS.md（project-memory 先頭）、CLAUDE.md「Codex と共通の作業視界」、AGENT_OPERATING_MANUAL §1、inventory-workflow-start Required Reading（project-memory 欠落）、inventory-operator-ui。MANUAL 自身が重複を指摘しながら未解消だった
2. `.claude/rules/review-workflow.md` が pre-D-033 の旧 pipeline を記述: L1/L2 を architecture_test / design_compliance_test の意味で使い（現行 L0/L1/L2 ladder と用語衝突）、Codex app 貼り付けレビュー方式・per-push 前提が残存。実装 slice 1 で廃止または pointer 化
3. AGENT_OPERATING_MANUAL 旧 §2 が「Codex 主実装 / Claude レビュー」の固定 2-agent 分担で、availability mode の概念がなかった（本 PR で解消）
4. Risk tier の再導出が 3 箇所（DEV_WORKFLOW 正本 + project-profile examples + workflow-start Routing）。profile は defer 宣言済みで許容、workflow-start の action 再導出は slice 1 で参照化
5. Plan-first 規律が DEV_WORKFLOW と inventory-implementation に全文二重記載。slice 1 で skill 側を pointer + 差分手順のみへ
6. Plan Packet に phase / role / state フィールドが存在せず、workflow 状態の機械可読な置き場がなかった（本 PR の Workflow State で解消）
7. モデル実名の hard-code: review-checklist「Fable exit 後の必須観点」見出し、MANUAL 旧冒頭「Fable 5 不在後に」、CLAUDE.md「Subagent 活用方針（Opus 4.7）」。MANUAL は本 PR で解消、残り 2 件は slice 1
8. PR #159 WER の Deferred 2 件（contract-audit 標準化、Plan timing 機械強制）が Plans.md backlog に未転記で追跡から漏れていた（本 PR で契約化 + slice 2 で機械化）
9. active docs に旧 per-push CI への言及は残存なし（確認済み）。ただし skills 3 本は L0/L1/L2 ladder の語彙を持たず「relevant gates」等の抽象記述のみ
10. `docs/ai-workflow/` generic pack と repo-local 定義が構造並行（guard はあり）。統合は本 PR の Non-scope、必要になった時点で別判断

## Appendix B: 実装 slice 1 の Codex handoff（発注書）

前提: 本 PR が Plan Gate P1/P2 = 0 で merge された後に着手。Risk: R3（workflow gate 変更の続き）。当初は新 Plan Packet を plan-first commit で作る想定だったが、design PR #162 closeout 時の owner 明示指示により本 packet を active のまま slice 1 で消化する運用へ変更した（`## Implementation Results` 参照）。

**slice 1 は blocking follow-up**（Plan Gate round 1 P2 指摘で明示化）: 本 PR merge 後、slice 1 完了までは新 workflow を使う次の R2+ change（UI-11c を含む）を開始しない。それまでの間に skills / `.claude/rules` の旧記述と本 PR の規範が矛盾した場合は D-034 と DEV_WORKFLOW.md を正とする。

本 section の items 1-9 は `## Scope` の Active implementation slice 1 へ正式昇格済みである。Independent Contract Audit remediation は、その既存発注内容とD-033を正しく表現するための整合修正に限定し、新規 implementation scope として扱わない。

対象と作業:

1. `.agents/skills/inventory-workflow-start/SKILL.md` と `.agents/skills/inventory-operator-ui/SKILL.md`: Required Reading を AGENTS.md Session Start への参照 1 行に置換。resume 手順を追加（active Plan Packet の Workflow State を読み、Phase から次の一手を決める。Workflow State が欠落・不完全・enum 外の場合は DEV_WORKFLOW の fail-closed 規則に従い pre-plan-gate 扱いで停止・owner へ報告）。Routing 表の action 再導出を DEV_WORKFLOW への参照に寄せる
2. `.agents/skills/inventory-implementation/SKILL.md`: Plan-first Rule を DEV_WORKFLOW Plan Packet Rules + Workflow State への pointer + Codex 固有手順のみに縮約。Verify 手順に L0/L1/L2 ladder の語彙（iteration = `local-ci.sh changed`、completed HEAD = `local-ci.sh full`、Draft PR、owner Ready = hosted final、Ready 後修正は Draft 戻し、docs R0/R1 hosted 0、owner 指示なしに Ready/merge しない）を明記。Workflow State の Phase 更新責務を Completion Contract に追加
3. `.agents/skills/inventory-code-review/SKILL.md`: Contract Audit mode を追加（DEV_WORKFLOW Contract Audit (R3/R4) を手順化: ledger 再検証、negative-space、mutation/anti-tautology、adjacent pattern、PR body freshness）
4. `docs/templates/plan-packet.md`: 先頭に `## Workflow State` section（フィールドと enum を DEV_WORKFLOW から引用）、`## Contract Coverage Ledger` section（4 列表）を追加
5. `docs/templates/test-design-matrix.md`: `## State Lifecycle Matrix`、`## Adjacent Pattern Audit`、Mutation-style へ anti-tautology 2 問（mock 値を設計書期待値と変える / invalidate 前後で値が変わる）を追加
6. `docs/templates/subagent-review-packet.md`: Contract Audit 指示（ledger 全行の再検証と negative-space 報告）を Output Required の前に追加
7. `.github/pull_request_template.md`: Validation に Workflow State の Phase 記載欄を 1 行追加
8. `.claude/rules/review-workflow.md`: 廃止し、DEV_WORKFLOW への pointer だけ残す（L1/L2 用語衝突の解消）。`docs/quality/review-checklist.md` の「Fable exit 後の必須観点」見出しを model-neutral 化。`CLAUDE.md`「Codex と共通の作業視界」の読み順列挙（:23）を AGENTS.md Session Start への pointer へ置換（Plan Gate round 3 P2 の drift grep で検出）
9. `Plans.md`: backlog の「Workflow 自走化 第2層」記述を D-034 / 本 packet 参照へ更新

品質 gate: `bash scripts/doc-consistency-check.sh`（+ active plan があれば `--target plan`）green、変更が docs/skills/templates のみであること、D-033 契約の同語彙化を diff で確認。レビューは fresh read-only reviewer による independent-review（Contract Audit の ledger は本 packet の Spec Contract 6 本を対象にする）。

## Appendix C: mechanical enforcement slice（deferred、slice 2）

第 1 slice の dogfood 後に別 Plan Packet で実施。無理に同一 PR へ入れない（D-034 Alternatives 参照）。

- PK4: active plan の `## Workflow State` 存在 + Phase enum 13 値 + Risk / Execution Mode 値検査を doc-consistency-check.sh に追加。複数 active packet の同時存在と Plans.md 進行中リンクとの不一致検出も候補に含める（Plan Gate round 2 P2 対応）
- PK5: `Plan Commit` SHA が実装ファイルの初回 commit より ancestor であることの git 検査（`local-ci.sh changed` 側に置く案と比較して裁定）
- R2+ 分類の diff（rust / frontend）があるのに active plan がない場合の WARN → ERROR 段階導入
- 読み順 drift test: AGENTS.md 以外に順序リスト再出現で fail する grep test を `scripts/tests/` へ
- Claude 側 PreToolUse hook（phase が plan-approved 未満での R2+ source 編集 deny)は Codex 非対称を踏まえ最後に評価。全作業を止める大規模状態機械は導入しない

## Appendix D: 最初の dogfood target

次の R3 change = UI-11c 操作ログ実装（Plans.md 次の行動 2）。Workflow State / Contract Coverage Ledger / Mode 運用の初回実証に加え、Plans.md 記載の pending 事項「CI workflow dogfood（Draft push 無発火、Ready 化 1 回発火、exact-HEAD 突合）」を同一 change で消化し、完了後に Workflow Effectiveness Review を実施する。

## Implementation Results

design PR #162 は squash merge 済み（`8c2357c`、2026-07-10。Plan Gate 4 ラウンド収束 P1/P2 = 0、L1 full `7989eef` CLEAN、hosted dispatch run 29108606292 success、exact-HEAD 三点一致）。**本 packet と Test Design Matrix は owner 指示により archive せず active 残置**。実装 slice 1（Appendix B）の Implementation PR がこの packet を消化する: slice 1 の Writer（Terra）は着手時に Phase を implementing へ進め、完了後の archive も slice 1 の closeout で行う。

実装 slice 1 Writer pass（2026-07-11、Terra）: Appendix B 1-9 を反映。canonical entry pointer、idempotent start/resume router、Plan-first/Workflow State guard、D-033 ladder、Contract Audit、Workflow State / Ledger / Lifecycle / Adjacent / anti-tautology templates、PR Phase 欄、Claude pointer/model-neutral 化、backlog 同期を実装した。`bash scripts/doc-consistency-check.sh`、`bash scripts/doc-consistency-check.sh --target plan`、`bash -n scripts/doc-consistency-check.sh scripts/local-ci.sh scripts/pre-push.sh`、targeted `rg`、`git diff --check` は PASS。`bash scripts/local-ci.sh changed` は PASS / DIRTY diagnostic（未コミット Writer diff のため merge evidence ではない）。Phase は `implementing` のまま、次は Writer と別 context の Contract Audit、finding 裁定、commit 後の CLEAN exact-HEAD L1。

Post-implementation review（2026-07-11）: Luna / Terra / fresh read-only Sol の findings を coordinator が実ファイルと履歴で裁定。accepted findings は同 Writer pass で修正済み。Plan Commit ancestry claim は下記理由で reject、PK5 の機械検査は Appendix C どおり deferred。targeted fix verification は P1/P2 = 0。Draft PR #163 (private archive) を Phase `implementing` のまま開設し、CLEAN exact-HEAD L1 full evidence と最終PR本文を記録した。次は owner確認であり、Ready / hosted final / mergeは未実行。

## Review Response

### Implementation slice 1 post-implementation reviews（2026-07-11）

- Luna: P2（`CLAUDE.md` から D-030 npm 恒久契約まで削除）を accept し、npm 供給網防御ルールと禁止事項だけを HEAD から復元。P3（Implementation Results の Writer が Codex のまま）も accept し Terra へ同期。旧 reading order / 共通設計 docs 列挙 / 固定 model 見出しは復元していない。
- Terra: P2 × 3（router が request identity 判定前に任意 active packet を選ぶ、`ready-hosted-final` / `merge` / `archive` の next action が不正確、`Plans.md` current-work status が design Draft / 発注待ちのまま）を全件 accept し修正。P3 の squash / PK5 指摘は Appendix C の mechanical slice 2 へ defer し、本 slice では規範と履歴証拠を維持。
- fresh read-only Sol: P1（Plan Commit `9a6015c` が現 HEAD の ancestor ではないため entry requirement 違反）claim は coordinator reject。entry requirement は着手時の時系列契約で、design squash merge `8c2357c` が plan-first 内容を包含し、owner が同 active packet を implementation slice へ継続すると明示している。squash 後 SHA ancestry の機械判定は Appendix C の PK5 で裁定済み defer。P3（`Plans.md` status drift）は accept し修正。
- Fable: P1/P2 = 0、P3 × 3（Lifecycle Matrix delimiter 列数、Appendix B の旧「新 packet」前提、docs-only hosted 0 と R0/R1 skip token の圧縮表現）。3件とも同 PR 内の小変更として accept し修正。Plan Commit ancestry は current blocker ではなく Appendix C slice 2 Design 入力とする独立裁定を支持。
- accepted findings の修正後も Workflow State Phase は `implementing`。targeted fix verification、CLEAN exact-HEAD L1、Draft PR freshnessの最新証跡は PR #163 本文を正とする。owner gate、Ready、hosted final、mergeが未完了のため前進させない。

### Independent Contract Audit remediation（PR #163、reviewed HEAD `f14bf83`）

- P1 × 2 / P2 × 2 / P3 × 1 は全件 accept。正式 Scope / Non-scope / Acceptance Criteria の Appendix B slice 1 との衝突、stale Workflow State、R0/R1 no-Plan経路欠落、R2 local-only / docs-only workflow CI表現、kickoff / description drift を実ファイルで再現した。
- finding accept により Phase は規範どおり `implementing`。`Local Full HEAD` は `pending`、Final Reviewer は remediation 後の fresh context 待ちへ戻した。
- formal scope sync は実装前から Plan Gate 済みの Appendix B items 1-9 を top-level へ昇格する訂正であり、新しい implementation scope を後付けしない。独立 scope-sync Plan Reviewer が Appendix Bとの差分ゼロと本Acceptance Criteriaを再確認し、P1/P2 = 0 のときだけ completed candidate のL1 / Final Reviewerへ進む。
- scope-sync Plan Gate（fresh read-only Sol）: 初回確認の P2 × 2（`docs/ci.md`非接触という旧前提、Draft checkpointのReady/event-filter/dispatch表現）をacceptして修正。再確認は P1/P2/P3 = 0。`git diff --name-only main` で Appendix B + accepted remediation以外のscopeが0件、`bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-10-workflow-model-neutral-redesign.md` と `git diff --check` がexit 0。
- targeted verification と `bash scripts/local-ci.sh changed` はPASS。changed runは開始・終了DIRTYのiteration diagnosticでありmerge evidenceではない。Phaseは`implementing`、`Local Full HEAD`は`pending`のまま、次はfix commit後のCLEAN exact-HEAD L1 full。
- fix commit `c4cd8b82c03a3660c710c3cc56ecaf2f17bd1bb4` で `bash scripts/local-ci.sh full` を実行し、開始/終了HEAD一致、CLEAN/CLEAN、`MERGE_EVIDENCE_VALID=true`、`RESULT=PASS`を確認。規範どおり `implementing → local-verified → independent-review` を再走した。
- fresh Final Contract Audit（Writer / scope-sync Plan Reviewerと別context）: source docs → `main...c4cd8b8` full diff → active packet / Matrix → L1 evidenceの順で再監査し、元5 findings、Ledger 6行、negative-space / lifecycle / adjacent / mutation / L3 boundary / PR freshness prerequisiteを確認。VerdictはP1/P2/P3 = 0。`independent-review → human-confirm`へ遷移可と判定されたため、Phaseを`human-confirm`へ更新した。

### Follow-up Independent Contract Audit（PR #163、reviewed HEAD `9c85342`）

- 前回5 findingsは解消確認済み。新規P1（tracked `Local Full HEAD`の自己参照によりexact-HEAD merge gateと両立不能）とP2（active packet / Matrixのslice 1旧状態）をaccept。
- finding受領によりPhaseを`implementing`へ戻し、`Local Full HEAD`を`pending`、Plan Reviewer / Final Reviewerをfresh context待ちへ戻した。Ready / hosted final / mergeは禁止を維持する。
- P1は設計変更として、tracked packetにreview対象content SHAと最終evidenceの格納先を分離する案、post-local-verified phaseをPR metadataへ移す案を比較する。fresh Plan GateでP1/P2=0になるまでskills/templatesへの実装へ進まない。
- 比較裁定: D-035として前者を採用。tracked packetはoffline/idempotent resumeのためPhaseを保持し、`Reviewed Content HEAD`でFinal Reviewerの監査対象を指す。volatileなfinal L1 SHA / hosted URL/headShaは`Final Exact-HEAD Evidence: PR body`の正本へ分離する。post-local-verified phase全面metadata化はGitHub不在時のresumeとarchive証跡を失うため不採用。
- state-only transition commitはWorkflow State / `Plans.md` / append-only narrative review-evidenceだけに限定する。packet内でもScope / AC / Design / contract / instruction hunkは禁止し、file allowlist + `git diff --unified=0 <parent>..<state-commit>`のhunkを監査する。違反時はcontent commitとして`implementing`へ戻す。Final Review後のstate-only commitは監査済みcontent SHAを記録し、その結果HEADでL1 fullを再取得する。
- owner Ready時はowner承認 → Draft上の`ready-hosted-final` state-only commit → 同HEADのL1 full → PR body更新 → Ready / explicit dispatch。以後tracked commitを作らず、merge前はlive PR HEAD = PR-body L1 SHA = hosted headSha（required時）を比較する。`Reviewed Content HEAD`は三点一致に含めない。
- follow-up Plan Gate対象: D-035、DEV_WORKFLOW State/evidence separation、本packet / Matrixの設計。P1/P2=0後の実装対象はplan / PR templates、workflow-start / implementation / code-review skills、active packet field移行。PK4/PK5/checker/hookはslice 2のまま。
- fresh Plan Gate（Writer / Coordinatorと別context）: 初回P1/P2候補として旧Hosted enum、historical narrativeを拾うgrep、R2 not-requiredとlive Ready eventの不一致、state-only同一file hunk検査不足、incidental run failure disposition、Scope旧field名を検出。全件acceptしD-035 / DEV_WORKFLOW / ci.md / packet / Matrixへ修正後、P1/P2/P3 = 0。implementationへ進行可。
- D-035 implementation pass: plan / PR templates、workflow-start / implementation / code-review skills、test-design / subagent-review templatesへ`Reviewed Content HEAD`、PR-body final evidence、`Hosted CI Requirement`、state-only zero-context hunk監査、R2 incidental failure dispositionを反映。normative State / templateから`- Local Full HEAD:` exact fieldを除去した。targeted doc checks / exact-field grep / `git diff --check`と`bash scripts/local-ci.sh changed`はPASS（DIRTY iteration diagnostic）。
- fresh Final Contract Audit round 1: P1 = 0 / P2 = 2。D-035 field/pointerの旧未来形2箇所をacceptして実装済み表現へ同期。さらにcommit `43b2baf`が、証拠済みながら`plan-gate → implementing`を1 state-only commitで記録した履歴と、隣接遷移しか列挙しない規範の不整合を検出した。履歴改変は行わず、証拠がcommit前にすべて存在する隣接forward遷移だけを1 state-only commitでmaterializeできる一般規則をD-035 amendmentとしてPlan Gateへ戻す。
- D-035 amendment fresh Plan Gate: 初回P2（D-035 Statusが補遺を旧Gateでacceptedと自己認定）をacceptし、base accepted / amendment pendingへ分離。targeted再確認はP1/P2/P3 = 0。Plan-first commit `6c7c3c154ebce593e211321d55fcda76c39ed28c`、Reviewer verdict、実装開始前であることを証拠として、このstate-only commitで隣接する`plan-gate → plan-approved → implementing`をmaterializeした。
- fresh Final Contract Audit round 2: content HEAD `77332ec774038c62cdfe22dbcb932e71c778fc0a`と同HEADのCLEAN L1 full evidenceを監査し、P1/P2 = 0。D-035自己参照分離、state-only file/hunk境界、隣接forward遷移の事前証拠、owner Ready順序 / merge三点一致、R2 incidental failure、active packet / Matrix旧状態の解消を確認した。`implementing → local-verified → independent-review → human-confirm`の全証拠がこのcommit前に存在するため、このstate-only commitでmaterializeする。P3のPlans旧checkpoint driftも同じstate-only同期で修正する。
- GitHub follow-up review（reviewed HEAD `5decb60`）: P2（`Plan Commit`をD-035 amendment SHAで上書き）とP3（Human Gate / Plans parent phaseの旧表示）をaccept。`Plan Commit`はslice 1の元plan-first SHA `9a6015c8d134ded53c9c8bede24adbf2acaae0e9`へ戻し、amendment SHA `6c7c3c1`は本Review Responseの履歴として保持する。ownerがreview修正後のmerge-through-closeoutを明示承認したため、このstate-only commitで`human-confirm → ready-hosted-final`をmaterializeする。

## Post-Merge Closeout（2026-07-11）

- PR #163 was squash-merged to `main` as `ab03a20c010f123240de5c00f920f72f52d52927`.
- Final local evidence HEAD, live PR HEAD, and hosted run `headSha` all matched `98a431891ac728e3a2d2111204c144250d246f36`.
- Hosted final run 29124260732 (private archive Actions evidence 29124260732) completed successfully after the owner Ready transition; Draft pushes produced no hosted runs.
- The packet remained active after PR #162 only so PR #163 could consume implementation slice 1. With that implementation merged, the packet and Matrix are now archived as originally intended.
- Mechanical PK4/PK5/checker/drift-test/hook enforcement remains the next workflow design slice. UI-11c is the next product slice; it no longer carries the first D-033 dogfood obligation because PR #163 completed that proof.

Plan Gate round 1（Sol High、2026-07-10、PR #162 コメント (private archive)、判定 = design not ready）: P1 = 1 / P2 = 3 / P3 = 1、実証裁定の結果 **全 5 件 accept・同 PR 修正**。

- P1（Ledger 不在）: accept。DEV_WORKFLOW:283 の plan-gate blocker 定義に本 packet 自身が違反していた self-dogfood 矛盾。`## Contract Coverage Ledger`（4 列 × SPEC-WF 6 契約）を追加し、Acceptance Criteria / Test Plan / 本 section から参照
- P2（fail-closed 不在）: accept。修正方向は Sol 提示 2 案のうち後者を採用 — slice 1 への最小 PK4 前倒しではなく、DEV_WORKFLOW Workflow State に day-one の fail-closed 規則（欠落・不完全・enum 外 → pre-plan-gate 扱いで停止・owner 報告）を追加し、Appendix B の resume 発注へ同規則を明記。理由: 規範側で塞げば checker 未着でも運用が閉じ、slice 境界（owner の commit rule）を保てる
- P2（旧ルール残存の期間矛盾）: accept。Appendix B に「slice 1 は blocking follow-up、完了までは新 workflow での次の R2+ change（UI-11c 含む）を開始しない。矛盾時は D-034 / DEV_WORKFLOW が正」を明示。skills / `.claude/rules` の実編集は owner の commit rule により本 PR に含めない
- P2（capacity-degraded 未定義）: accept。AGENT_OPERATING_MANUAL §3.5 を新設（役割 pending 化 + Phase 前進禁止 + owner 指名 or fresh context + ブロッカー記録）。Test Matrix に failure mode 追加
- P3（「すべて満たす」の論理矛盾）: accept。「次のいずれかに該当する場合のみ」へ修正

Phase は plan-gate のまま（前進なし）。round 2 で P1/P2 = 0 を確認してから plan-approved 化する。

Plan Gate round 2（Sol High、2026-07-10、PR #162 コメント (private archive)、判定 = design not ready）: round 1 の 5 件は全件修正確認済み。新規 P1 = 1 / P2 = 2、実証裁定の結果 **全 3 件 accept・同 PR 修正**。

- P1（遷移表不完全・plan-approved 実装 guard 欠落）: accept。定義済み遷移が 6/13 のみで、再設計の核心である「Plan Gate を通らず実装に入れない」guard が機械的に表現されていなかった。DEV_WORKFLOW の Transition rules を全 13 phase の遷移表（各遷移の必要証拠つき）へ置換し、`plan-approved → implementing` を実装への唯一の入口として明記。Implementation Rules の開始条件も「packet 存在」から「Workflow State が plan-approved 到達」へ強化。skip は spec-check → plan-draft（Design Readiness で既存 docs 十分と記録した場合）のみ許可
- P2（Mode A と本 packet の役割矛盾）: accept。MANUAL §3.1 に design-board 例外（workflow/architecture の design-only change + owner 明示指示 + Plan Gate / Final Reviewer は Fable 以外の独立 fresh context + 実装 code の Writer には不割当）を新設し、本 packet の Workflow State へ例外適用を明記。Plan Reviewer は Sol（round 1-2 実績）で確定
- P2（active / stale packet 選択規則なし）: accept。DEV_WORKFLOW Workflow State に resume の packet 選択規則を追加（Plans.md の明示リンクから唯一の active packet を選ぶ。複数・不一致・欠落・branch/PR 不一致は停止して owner 報告）。Appendix C の PK4 候補に複数 active packet / Plans.md 不一致検出を追加

round 3 で P1/P2 = 0 を確認してから plan-approved 化する。

Plan Gate round 3（Sol High、2026-07-10、PR #162 コメント (private archive)）: P2 = 1（読み順複製の残存）。accept。drift grep の結果、指摘 2 箇所（DEV_WORKFLOW:200 の括弧内再掲 / project-profile:173 の旧順序）に加えて CLAUDE.md:23 と inventory-operator-ui SKILL の計 4 箇所を検出。source docs 2 箇所は本 PR で pointer 化、agent config 2 箇所（CLAUDE.md / operator-ui skill）は Appendix B item 1 / 8 へ追記して slice 1 の対象に編入。

Fable 側 self-audit（round 3 併走、Sonnet subagent による遷移規則 + PR159 教訓カバレッジの独立監査、13 findings）の裁定:

- accept・修正済み（8 件）: R2 の Test Matrix optional と遷移表の矛盾（遷移行に R 階層条件を明記）/ R3 review-only skip 許容と independent-review 遷移の衝突（skip 記録を遷移条件に編入、skip 時は Final Reviewer が Contract Audit を直接実施）/ plan-gate 差し戻しの後退経路が曖昧（in-place 修正は plan-gate 維持、Scope 無効化は plan-draft へ、review 起因の code fix は implementing へ、を明文化）/ WER の double-audit 教訓が未制度化（R4・workflow gate は Contract Audit 2 回を必須化、R3 は operator-visible state lifecycle 接触時に推奨）/ Ledger の対象 class に #11（記載済みだが値が誤り）を追加し再検証意味論を明記 / Draft PR Checkpoint に Phase 同期規則を追加 / 本 packet の Final Reviewer 未定（Sol による merge 前 independent-review に確定）/ Plan Gate と Plan Reviewer の役割名 drift（MANUAL §2 で統一）
- reject（2 件）: ready-hosted-final の phase 名が hosted skip 時に過大（遷移行の when required で十分、enum 改名の churn に見合わない）/ 機械強制の未着を blocker とする主張（D-034 で slice 分割を明示裁定済み、owner 指示の first slice / follow-up 分離に一致）
- 残存リスク記録（1 件）: 機械強制（PK4/PK5/hook）が入るまで Plan Gate bypass への防御は規範 + fail-closed + blocking follow-up の文書層のみ。WER の「文書ルールだけでは再発した」実績への完全な答えは slice 2 で閉じる
- no-action（2 件）: templating の slice 1 送りは scheduled 扱いで基準充足 / miss #13・#10・#15・T11/T13 と PR body freshness のカバレッジは十分という肯定所見

round 4（または owner 判断）で P1/P2 = 0 を確認してから plan-approved 化する。

Plan Gate round 4 = 最終ラウンド（Sol High、2026-07-10、PR #162 コメント (private archive)、判定 = design not ready）: round 1-3 の全 9 指摘は解消確認済み。新規 P1 = 0 / P2 = 1 / P3 = 2、実証裁定の結果 **全 3 件 accept・同 PR 修正**。

- P2（Mode C に独立 Plan Reviewer なし）: accept。§3.3 の表が Coordinator / Explorer / Writer / Final Reviewer の 4 行のみで、plan-gate → plan-approved が必須とする Plan Reviewer を codex-only 時に規範から復元できず、Self-Review「全役割が埋まる」の claim に違反していた。§3.3 へ Plan Reviewer 行（fresh read-only Sol high、Coordinator・Writer と別 context、Final Reviewer とも別 instance）と Mode C の自己承認禁止を明記
- P3（D-034 の旧称 Plan Gate）: accept。role list を Plan Reviewer へ同期
- P3（hosted CI 経路の記述誤り）: accept。本 PR の 8 ファイルは docs/root Markdown のみで `paths-ignore` に一致し Ready event では自動起動しない。Workflow State の Hosted CI 行と PR body を「Ready 後に explicit `workflow_dispatch` で 1 run」へ修正。dispatch fallback（ci.md）があるため merge gate bypass にはならない

Sol は round 1 の自己 claim（Mode B/C 独立性に矛盾なし）の見落としを自己訂正した上でこの P2 を出しており、最終ラウンドとして残余は fix 検証のみ。plan-approved 化は「独立 Plan Reviewer の P1/P2 = 0 確認」を要するため、owner 判断: Sol への単一 fix 確認（数分の targeted 確認）または owner 自身の目視確認（§3.3 に Plan Reviewer 行が存在すること）をもって Phase を plan-approved に更新する。

**Plan Gate 収束（2026-07-10）**: Sol による round 4 P2 fix の targeted 確認で「P1/P2 = 0、plan-approved 可」を受領（HEAD `1223a6c` 時点の確認）。Phase を plan-approved へ更新、Plan Commit = `9a6015c` 確定。owner の merge 指示に基づき本 PR は Ready → explicit dispatch → exact-HEAD 突合 → squash merge へ進む。**本 packet と Test Design Matrix は archive せず docs/plans/ に active のまま残す（owner 指示）**: 実装 slice 1 の Implementation PR がこの packet を消化し、Phase を implementing 以降へ進める。
