# Plan Packet: request builder shared primitives（監査順21 / P1-4、wave 4 lane 2）

## Workflow State

- Phase: human-confirm
- Risk: R2
- Execution Mode: dual-vendor-no-fable
- Plan Commit: d8129d9
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・裁定・Registry/train管理）
- Writer: Codex（plan-approved後の専用worktree / terminal W4-L2）
- Plan Reviewer: Codex fresh context（read-only、Writer非関与）
- Final Reviewer: Claude Opus 5 fresh context（ownerが難所lane reviewerとして指名、read-only）
- Reviewed Content HEAD: 3141481558fc3fe090416e2c7135a226a38192eb
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: wave train先頭をlane 2へ変更しlane 2をReady / mergeするowner承認

Narrative（append-only）:

- 2026-07-29 kickoff -> spec-check -> plan-draft: ownerがwave 4 lane 2として順21 P1-4を選定（介入1/3）。4 request builderの同一primitiveだけを共通化し、payload、validation、key lifecycle、画面は不変。production実装はPlan Gate前につき禁止。
- 2026-07-29 plan-draft -> plan-gate: Packet / Matrix、4 consumer境界、REQ-201〜204 traceability再生成義務、generated artifact専有をCoordinatorが確認した。plan-first content commitへ固定し、fresh Codex Plan Reviewへ進む。
- 2026-07-29 Plan Review round 1: P1=1 / P2=3。監査source誤参照、shared owner/APIのdurable source欠落、wrapper prefix/export/min oracle不足、UTC環境で生存するdate mutationを確認した。`76-ui-request-primitives.md`へ契約を昇格し、consumer直接testとtimezone非依存oracleへ補強して再レビューする。
- 2026-07-29 formal Plan Review closure（Codex fresh context、lane 2 reviewed content `128407c`）: APPROVE、P1=0 / P2=0 / P3=0。76のdurable owner/API、4 exact prefix / named export / consumer min、timezone非依存date oracle、REQ token各1 occurrence、lane 2だけの90専有をread-only再確認した。後続`f929472`はlane 1/3 Packet / Matrixだけの変更でlane 2 reviewed content不変。
- 2026-07-29 plan-gate -> plan-approved -> implementing（state-only compression）: 独立Plan Review closureでP1/P2=0となり、plan-first `d8129d9`とplan-gate corrections `7abfedf` / `128407c`は全実装commitより前に存在する。`Plan Commit`を`d8129d9`へ固定し、本state-only commit後にlane 2 Writer実装を許可する。
- 2026-07-29 implementing -> local-verified: content candidate `3141481558fc3fe090416e2c7135a226a38192eb`でexact-HEAD L1 fullがCLEAN / PASS、merge evidence validとなった。一次candidateで検出したUI専用設計書76のdesign compliance登録漏れは、既存UI設計書と同じ`SKIP_DOCS`登録へ是正し、design compliance / traceability WARN 0 / frontend / Rust / docsを全再実行した。
- 2026-07-29 local-verified -> independent-review: 一次Final Reviewは旧candidate `3de592c`の登録漏れをP2として捕捉し、是正後のexact candidateをWriter非関与の別fresh contextへclosure reviewとして発注した。
- 2026-07-29 formal Final Review closure（Codex fresh context、reviewed content `3141481558fc3fe090416e2c7135a226a38192eb`）: P1=0 / P2=0 / P3=0、Approve。3 primitive、4 consumer互換、portable date oracle、consumer min、REQ token各1 occurrence、90専有、bindings / route tree差分0とL1 CLEANをread-only確認した。
- 2026-07-29 independent-review -> human-confirm（state-only materialization）: `Reviewed Content HEAD`をclosure済みcandidateへ設定した。新設76がwave共通base上でdesign compliance / 90生成へ影響することが判明し、lane 1/3はlane 2 merge前のL1 fullをCLEANにできない。次のHuman Gateはmerge train先頭をlane 2へ変更し、lane 2のReady / mergeを先行するowner承認。
- 2026-07-29 owner review-route correction: ownerがSonnet 5 review未実施を検出し、Codex closureだけでは外部review gateを満たさないと明示した。Draft PR #37はReady停止を維持し、Codex reviewはpreflight evidenceへ格下げする。
- 2026-07-29 human-confirm -> independent-review（state-backtrack）: Execution ModeをClaude slot利用可能な`dual-vendor-no-fable`へ、Final ReviewerをSonnet 5 fresh contextへ訂正し、`Reviewed Content HEAD`をpendingへ戻した。Sonnet 5のP1/P2=0 closure前はhuman-confirmへ再進行しない。
- 2026-07-29 owner Final Reviewer designation: ownerはlane 2を難所と判断し、Claude側の高自律review-only slotであるOpus 5 fresh contextを本laneのFinal Reviewerへ指名した。Sonnet 5未実施を理由とした停止条件は、この明示的な代替担当指定によりOpus 5のFormal Final Reviewへ置換する。
- 2026-07-29 formal Final Review（Claude Opus 5 fresh context、reviewed content `3141481558fc3fe090416e2c7135a226a38192eb`）: lane 2 contentはAPPROVE、P1=0 / P2=0 / P3=1。3 primitiveと4 consumer互換、portable oracle、REQ token、90専有、state/backtrack hunkをread-only監査した。P3はPR bodyがplan-gate先行追加済みの設計書76 / FUNCTION_DESIGN登録までlane実装として記した誤帰属で、bodyを「76のdesign compliance UI除外登録」へ是正した。baseの76登録時点でdesign compliance / 90が一時redとなるlane外P2相当は、lane 2 contentが閉じる既知train依存としてacceptした。
- 2026-07-29 independent-review -> human-confirm（state-only materialization）: owner指定のOpus 5 Final Review P1/P2=0とPR body P3是正を根拠に、`Reviewed Content HEAD`をcontent candidateへ再設定した。次のHuman Gateはlane 2をmerge train先頭としてReady / hosted final / mergeへ進めるowner承認。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入1/3（wave 4起票）、relay 0/2

## Risk

Risk: R2

4 featureを横断する内部helper refactorだが、wire、route、operator workflow、key保持/rotation、validation意味論は不変。共有APIと4 consumerの接続を扱うためtricky R2としてMatrixと独立reviewを使う。

## Goal

Goal Invariant: 入庫・手動販売・廃棄・返品交換のrequest builderに重複するprefixed idempotency key、local `YYYY-MM-DD`、strict safe integer parserを1 ownerへ集約し、4業務の外部挙動を完全に維持する。

### 最小完了条件

- `src/lib/request-helpers.ts`が3 primitiveの唯一のimplementation
- 4 request fileはfeature固有wrapper/prefixとDTO組立だけを所有
- 4 builderのpayload、拒否集合、validation文言、signature、初期日付、retry/key rotationが不変
- 新規helper testにREQ-201/202/203/204を付与し、`90-traceability.md`を本wave唯一のgenerated artifactとして更新

### 失敗定義

- prefix、fallback key shape、local date、integer grammar / min / safe rangeが変わる
- request payload、null正規化、signature、error文言、Page lifecycleが変わる
- 4 target fileのいずれかにprimitiveのlocal bodyが残る

### 非目的

- builder固有rule、row normalization、confirmation token、receipt pathの共通化
- Page側key lifecycle、CMD/BIZ/DB、wire、route、UI変更
- 他featureのdate/number/UUID helper一般化

## Scope

- add `src/lib/request-helpers.ts`
  - `createPrefixedIdempotencyKey(prefix)`
  - `getLocalDateString(date = new Date())`
  - `parseRequiredSafeInteger(value, min)`
- update four request files under receiving / manual-sale / disposal / return-exchange
- feature固有`create*IdempotencyKey` wrapperと既存`getLocalDateString` import surfaceは維持する
- add `src/lib/request-helpers.test.ts`（behavior + four-consumer ownership guard）
- run existing request/Page regression tests without weakening
- source docs: add `docs/function-design/76-ui-request-primitives.md` and register it in `docs/FUNCTION_DESIGN.md`
- regenerate `docs/function-design/90-traceability.md`
- 本Packet / Matrix。`Plans.md`とWorkflow StateはCoordinatorのみ

## Non-scope

- 4 Page production files、feature `types.ts`、generated bindings、route tree
- source docs 61〜64の業務契約変更（Design Readiness引用のみ）
- row-utils、threshold parser、formatter、dependency / lockfile
- 順21 P1-3、順16

## Acceptance Criteria

- UUID pathは`${prefix}-${uuid}`、fallbackは`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`と同値
- local dateはlocal calendar getterで`YYYY-MM-DD`、UTC getterを使わない
- integer parserはtrim後ASCII digits、safe integer、inclusive `>= min`
- 4 wrapperはexact prefix（receiving / manual-sale / disposal / return）と各feature moduleの`getLocalDateString` named exportを維持する
- consumer-level casesが各builderのquantity min 1とreceiving/manual-sale/disposalの金額 min 0を直接観測する
- local date caseはlocal/UTC getterが異なるstubを使い、host timezoneに依存せずUTC getter mutationを落とす
- four request filesで`randomUUID` / calendar getter / `Number.isSafeInteger`のlocal implementationが0
- new helper testと4 existing request/Page family testsがPASS
- `cargo run --bin generate_traceability`後、`cargo run --bin generate_traceability -- --check` PASS
- bindings / route tree差分0、`90-traceability.md`だけがgenerated差分
- frontend full、docs/plan check、`bash scripts/local-ci.sh full` CLEAN

## Design Sources

- Requirements: REQ-201/202/203/204
- Function/UI: `76-ui-request-primitives.md` UI-REQUEST-D1、`61-ui-receiving.md`、`62-ui-manual-sale.md`、`63-ui-return-exchange.md`、`64-ui-disposal.md`
- Audit: `docs/research/audit-2026-07/report.md` 順21 P1-4、`docs/research/audit-2026-07/findings/p1-component-reuse.md` P1-4
- Architecture / DB / wire: unchanged

## Required Design Artifacts

| Area | Artifact | Status |
|---|---|---|
| 4 workflow validation / key lifecycle | function docs 61〜64 | existing sufficient |
| shared primitive ownership / API / wrapper compatibility | function doc 76 UI-REQUEST-D1 | added in corrected plan-first |
| wire / DB / screen | existing docs | unchanged |

## Registration / Generation Obligations

- 新規FE testにREQ-201/202/203/204を各1 occurrenceだけ付与する
- `cargo run --bin generate_traceability`で`90-traceability.md`を再生成する
- bindings / route treeは再生成対象外で、diff 0を確認する

## Design Intent Trace

| Spec | Source | Implementation | Test |
|---|---|---|---|
| REQ-201 | 61 | shared helper + receiving wrapper | helper + receiving tests |
| REQ-202 | 63 | shared helper + return wrapper | helper + return tests |
| REQ-203 | 62 | shared helper + manual-sale wrapper | helper + manual-sale tests |
| REQ-204 | 64 | shared helper + disposal wrapper | helper + disposal Page test |

## Design Intent Audit

- 4 source docsがinteger境界、今日、1保存試行単位keyを既に規定
- 76がshared owner/API、exact prefix、named export、consumer min、portable date oracleを規定
- generated artifactは本laneが専有し、lane 1/3は90を触らない
- P1-3と他helper一般化はdefer

## Impact Review Lenses

not applicable — external format、実機、operator workflow、data lifecycleの変更なし。

## Design Readiness

- Existing design docs are sufficient because: 61〜64が維持対象の業務挙動を定義し、76が共有ownerと互換境界を固定
- Source docs updated in this PR: `76-ui-request-primitives.md`新設、`FUNCTION_DESIGN.md`登録
- Design gaps intentionally deferred: 他primitive一般化、P1-3
- wire / persistence / wording / recovery: unchanged

## Contract Probe

- N/A: external premiseとcross-language contract変更なし

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-07-29-request-builder-primitives.md`

- targeted: new helper test（primitive + 4 wrapper exact prefix/export + consumer min + ownership）+ four existing families
- compatibility: exact payload/error/signature/key lifecycle
- mutation: UUID/fallback/date/integer branchとconsumer ownership
- full: frontend、traceability generation/check、docs、L1

## Boundary / Wire Contract

- producer: form strings / prefix / Date
- consumer: four generated request DTO builders
- wire type: generated DTO shape不変
- precision/range: JS safe integer、inclusive min 0/1
- compatibility: payload/null/signature/error不変

## Review Focus

- shared helperが現行edge behaviorを変えていないか
- exact 4 prefix / named export / min 0・1がconsumer側で直接固定されているか
- local/UTC getterが異なるstubでUTC mutationをportableにkillするか
- feature固有ruleやPage lifecycleへscope creepしていないか
- static ownership guardが4 targetだけを正確に検査するか
- 90が本wave唯一のgenerated artifactか

## Spec Contract

Contract ID: SPEC-UI-REQUEST-PRIMITIVES

- 3 primitiveのsingle implementation
- four external request contractsはbyte-semantic equivalent
- feature prefixはreceiving/manual-sale/disposal/return

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-201..204 | helper extraction | request-helpers.test.ts（各REQ token 1 occurrence） | exact primitive behavior | targeted |
| SPEC-UI-REQUEST-PRIMITIVES | 4 consumer wiring | exact prefix/export/min cases + static ownership guard | wrapper引数とlocal body 0 | targeted + rg |
| D-055 | traceability generation | generate/check | generated lane専有 | git diff |

## Data Safety

- DB / CSV / backup /実データ非接触
- rollbackはlane implementation commitのrevert
- synthetic Date/UUID/number fixtureのみ
