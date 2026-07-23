# Workflow Effectiveness Review — 監査是正 順5: validation ownership / production CMD（PR #22）

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: [2026-07-23-validation-ownership-production-cmd-tests.md](2026-07-23-validation-ownership-production-cmd-tests.md)
- Test Design Matrix: [test-matrices/2026-07-23-validation-ownership-production-cmd-tests.md](test-matrices/2026-07-23-validation-ownership-production-cmd-tests.md)
- review-only sub-agent: owner指定のSol単独サイクルのためskip
- external review: Sonnet 5 fresh contextのPlan Review一次 + Final Review一次
- human approval: Plan承認 / Ready承認 / merge承認（介入3/3）
- gates: production CMD targeted tests、独立oracle `rg`、X1〜X4b mutation、
  local-ci full、doc / workflow / generated / traceability、hosted final三点一致

## What Worked

- **Plan Reviewが独立oracleの機械的担保を実装前に追加した**: 当初はReview Focusの
  人手確認だけだったが、P2をgated amendmentへ変換し、4 CMD moduleのtest本体が
  BIZ service由来の文字列定数/helperを参照しないことを`rg` 0件で証明する
  Acceptance Criteriaにした。Final Reviewerも同commandを独立再現できた
- **production command test化が実装欠陥を直接redにした**: CMD guard削除後、
  productは`import_error`、stocktake page/per_pageは`internal`へ落ち、count messageの
  「値/数」driftも露出した。旧test内分岐では観測できなかった経路差をTDDで捕捉した
- **clean committed baselineのmutation実測が所有層と境界を固定した**:
  product / integrity / stocktake / salesの全計画分岐を個別に壊し、対応CMD testのredと
  exact-file復元後のgreen / cleanを確認した。Final ReviewのX1 / X3d spot再注入も同じ
  感度を独立再現した
- **状態/evidence分離がmerge SHAを曖昧にしなかった**: Reviewed Content HEADは
  content candidateに固定し、Ready state-only HEADでL1を再実行。PR HEAD / local full /
  hosted run headShaの三点一致後だけmergeした

## What Did Not Work

- 初回`local-ci.sh changed`はtraceability生成物の同期漏れでfailした。正規generatorで
  即時解消できたが、実装完了チェックリスト上はgeneratorをchanged gateより先に置く方が
  1回の再実行を避けられた
- root `Plans.md`は`docs/Plans.md`へのsymlinkであり、`git add Plans.md`ではtarget内容が
  stageされなかった。human-confirm commitではpacketだけが入り、dashboard更新は次の
  ready state-only commitへ安全に回収したが、stage対象の認知負荷がある
- packetのImplementation Resultsに置いた「未完了」snapshotは、後続state-only commitが
  append-only制約のため書換えられずReadyまで陳腐化した。archive closeoutで最終状態へ
  正規化した

## Issues Caught Before Implementation

- Plan Review P2: production定数/helper非importが人手Review Focusだけで、独立転記oracleを
  機械担保していなかった。gated amendment `082379c`でAcceptance Criteriaへ追加
- scope再精査: integrity testは監査時点からdriftし、PR #20で既にproduction commandを
  呼んでいた。削除・再作成せずexact oracle強化として扱い、scopeを過剰拡張しなかった
- source docsのBIZ責務とCMD重複容認例が相反していたため、実装前に
  ARCH-VAL-D1 / BIZ-01-VAL-D1 / BIZ-06-VAL-D1 / BIZ-07-VAL-D1 /
  CMD-09-CONV-D1へ正本化した

## Issues Caught by Tests

- field付きBIZ validation variant追加前のcompile RED
- product empty guard移設前の`import_error` / `validation`不一致
- stocktake page/per_page guard移設前の`internal` / `validation`不一致
- stocktake count messageの「カウント値」/「カウント数」不一致
- X1 / X2 / X3a〜X3d / X4a〜X4bのproduction mutation全件red

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| Sol単独サイクル指定のため未実施 | skipped | owner起動のSonnet 5 Final Reviewで独立Contract Auditを実施 |

## Issues Caught by External Review

- Plan Review一次: P1 = 0 / P2 = 1。P2は機械`rg` Acceptance Criteriaとしてacceptし、
  amendment後承認
- Final Review一次: P1 / P2 / P3 = 0。oracle再現、対象回帰、X1 / X3d spot mutation、
  wire文言、機械gate、scopeを独立確認しReady可

## Escaped / Late Findings

- production / contract findingのescapeはなし
- traceability generated driftはDraft前のchanged gateで検出・是正され、reviewへは到達しなかった
- symlink stageの摩擦はstate-only commit直後にstatus確認で検出し、次の許可対象commitへ回収した

## Test Adequacy

Strong tests:

- Tauri mock AppState経由のproduction command呼出し、独立転記した
  `kind` / `message` / `field`完全一致、valid boundaryのsuccess response
- branch削除、threshold強化、mode fallback / mapping交換を含むproduction mutation
- Final Reviewerによるoracle commandと代表mutantの独立再実測

Weak or missing tests:

- Tauri IPC serde harness全体は直接起動せず、Rust command関数 + managed Stateと
  bindings差分0で互換性を確認した。command signature不変の本scopeでは受容
- module固有の`rg`はPR evidenceであり常設CIではない。再発頻度が未実証のため
  global checkerへの昇格は保留

Mutation-style observations:

- guard削除だけでなく`< 0 -> <= 0`とvalid mode交換を入れたことで、
  invalid側だけgreenにする片側testを避けられた
- integrityはCMD guard削除後もBIZ guardでgreenになるため、BIZ guard自体を削るX2が
  単一所有の感度証明に不可欠だった

## Signal / Noise

- sub-agent findings total: 0（指定skip）
- accepted: 0
- rejected: 0
- deferred: 0
- question: 0
- external findings: Plan Review P2×1をaccept、Final Review P1/P2/P3 = 0

## Cost / Friction

- useful cost: 8 production mutation + Final Review spot mutation、exact-HEAD L1 2回、
  hosted final 1回
- excessive friction: traceability生成順の手戻り1回、Plans symlink stagingの回収
- confusing steps: state-only中にImplementation Resultsの進捗snapshotを更新できない点
- review rounds (broad audit / closure確認の内訳): Plan Review 1 / Final Broad Audit 1 /
  findingsなしのためclosure 0
- state-only commits / 総commit数: 3 / branch 8 commit（squashで1 commitへ集約）

## Recommended Workflow Adjustment

Keep:

- production command実呼出し + independent exact oracle + production mutationの三点セット
- Plan Reviewのgated amendment、clean committed mutation baseline、exact-HEAD三点一致

Change:

- 進捗で陳腐化する「未完了」一覧はImplementation Resultsへ置かず、Workflow State /
  Plans / PR bodyだけで管理する
- symlink `Plans.md`を編集したcommitではstage/status確認を実体path
  `docs/Plans.md`基準で行う

Follow-up:

- module固有oracle import `rg`の常設checker化は、別audit correctionで同型再発が
  観測された場合に次期workflow tooling PRで再評価する

## Retired / Consolidated Rules

- oracle独立性の人手Review Focus単独運用を廃止し、本changeでは一つの機械`rg`
  Acceptance Criteria / PR evidenceへ統合した。global hookは追加せず、重複する
  人手チェックと常設rule増殖の双方を避けた

## Applied / Deferred Workflow Changes

Applied:

- gated amendmentでoracle非importを機械確認し、Final Reviewerが同commandを再現
- archive packetから陳腐化した未完了snapshotを除き、完了証跡の正本をPR bodyへ限定
- 本closeoutは`docs/Plans.md`を明示stage対象として扱う

Deferred:

- module横断oracle import checker → 同型再発時のworkflow tooling PR
- Plans symlinkの機械guard / staging guidance → 再発時のworkflow tooling PR

Not applied:

- repository-wide AST/import-graph gate。今回の対象はRust 4 moduleに限定され、
  `rg`再現とmutation感度が成立しており、1件の実証だけで常設複雑性を増やさない
