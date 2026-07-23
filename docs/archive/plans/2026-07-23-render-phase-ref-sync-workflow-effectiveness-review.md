# Workflow Effectiveness Review — 監査是正 順6: render-phase ref同期（PR #23）

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: [2026-07-23-render-phase-ref-sync.md](2026-07-23-render-phase-ref-sync.md)
- Test Design Matrix: [test-matrices/2026-07-23-render-phase-ref-sync.md](test-matrices/2026-07-23-render-phase-ref-sync.md)
- review-only sub-agent: owner指定のSol単独サイクルのためskip
- external review: Sonnet 5 fresh contextのPlan Review一次 + Final Review一次
- human approval: Plan承認 / Ready承認 / merge承認（介入3/3）
- gates: 是正前実code lint oracle、production RTL、X1〜X4b mutation、
  workflow-git / docs / frontend / full L1、bindings diff、hosted final三点一致

## What Worked

- **Design Phaseが二つの同期境界を実装前に固定した**: UI-11cはvalid renderを即時使用し
  snapshot更新だけをcommit後へ、UI-05は保存event開始時にlockする設計をsource docsへ
  昇格した。ownerはpassive effectの極小表示窓とevent開始点の可視差をPlan Gateで
  明示承認でき、実装中にquery keyや業務意味論を再設計しなかった。
- **Plan Reviewがlint presetのscope拡大を防いだ**: P2-1をgated amendmentとし、
  `recommended` spreadを外して既存2 rule + `refs`だけを明示する具体差分を固定した。
  plugin更新に伴う他Compiler ruleの暗黙導入を避けた。
- **是正前の実production codeがguard oracleとして機能した**: synthetic fixtureではなく
  plan commitの対象2fileへfinal configを適用し、対象render accessだけがred、
  final repo全体がgreenであることを確認した。修正とguardを同じ写しから導出しなかった。
- **Final Reviewの独立mutation再注入が誤ったkill主張を止めた**: X3 render同期mutantは
  lintではredだがcomponent testはgreenと再現され、event lock完全欠落を検出するX3aと
  static defenseのX3を分離できた。X4bも間接killから専用reset testへ改善した。
- **exact-HEAD分離がmerge evidenceを維持した**: Reviewed Content HEADをcontent候補に
  固定し、圧縮後Ready HEADでL1を再実行。PR HEAD / PR body L1 SHA /
  hosted run headShaの三点一致後だけmergeした。

## What Did Not Work

- Matrix初版はX3 render同期mutantをbehavior testがkillすると主張したが、
  `userEvent.click`の`act()` batchがPromise continuationより先にpending renderを
  commitするharnessではevent同期とrender同期を判別できなかった。複数のasync gap案を
  試したが、外部観測可能なcontinuationをrender commitより先へ置けず、Final Reviewまで
  evidence誤認が残った。
- 初回X4bは既存idempotency testの副作用でredになり、resetがsearch gateをunlockする
  契約を直接assertしていなかった。Matrixに独立行を持たせるべきだった。
- human-confirmとReadyを別state-only commitにするとforward state-only上限を超え、
  最初のReady HEADのL1がSTATECAPでfailした。既存ruleどおり各materialize直後に
  `check-workflow-git.sh`を実行していればL1前に検出できた。owner承認後、隣接遷移を
  1 commitへ圧縮し、canonical subjectと完全なnarrativeを保存した。
- relayは2回予算に対して3回となった。追加relayはFinal Review P1のowner独立再実測と
  Ready確認を分離したためで、owner明示のbudget exceptionとして記録した。

## Issues Caught Before Implementation

- Plan Review P2-1: plugin 7.1.1のrecommended presetがrefs以外のCompiler rule群まで
  有効化するscope drift。explicit 3-rule configへgated amendmentした。
- Plan Review P3-1: test環境の`startTransition`安定性を初回RED/GREENで確認する記録。
- scope精査: OperationLogs 1 cluster、Disposal render write 1 + event/async read 2へ
  現HEAD箇所を確定し、P7b-2 / P5-4への侵入を除外した。

## Issues Caught by Tests

- UI-11c旧render refへの回帰、snapshot effect削除、discarded transition漏出。
- UI-05 event lock完全欠落、validation/command failure unlock欠落、
  reset unlock欠落。
- 是正前実codeに対する`react-hooks/refs`違反と、final repo false positive 0。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| Sol単独サイクル指定のため未実施 | skipped | owner起動のSonnet 5 Final Reviewで独立確認 |

## Issues Caught by External Review

- Plan Review一次: P1=0 / P2=1 / P3=1。P2-1をacceptしgated amendment、
  P3-1は実装時確認事項として記録。
- Final Review一次: P1=1 / P2=0 / P3=1。P1はX3 kill非再現、P3はX4bの
  Matrix未定義・間接kill。両方acceptし、X3 lint単独防御 / X3a分離 /
  X4b専用testへ是正。
- owner是正検証: X4b専用testのmutant RED→復元GREENとMatrix/evidence訂正を独立再現し、
  P1/P2 closure=0を確認。

## Escaped / Late Findings

- production behaviorのmerge後escapeはなし。
- X3 mutation evidenceの誤主張とX4bの間接oracleはFinal Reviewまで到達した。
  いずれもReady前に是正されたが、Matrix authoring時に「このharnessで二つの実装を
  観測上区別できるか」をREDで先に証明していればreview reworkを減らせた。
- STATECAP超過は最初のReady L1で検出された。product contentには影響せず、
  state-only履歴の圧縮とexact-HEAD L1再実行で解消した。

## Test Adequacy

Strong tests:

- Suspense sibling + `startTransition`でvalid renderを実際に破棄し、
  production OperationLogsPageのquery/display/paginationが最後のcommit済みsnapshotを
  維持するtest。
- production DisposalPageでevent lock完全欠落、failure unlock、reset unlockを
  個別mutantでredにするtest。
- 是正前production codeをoracleにしたlint検出と、repo全体のfalse positive 0確認。

Weak or missing tests:

- React離散eventのscheduler順により、X3 event同期とrender同期は現harnessで
  behavior上区別できない。無理にscheduler実装詳細へ依存するtestを追加せず、
  この差はofficial lint guardが防御する。
- React schedulerの全interleavingは列挙しない。監査害経路のdiscardと、
  event lock完全欠落・unlock lifecycleを代表系列として固定した。

Mutation-style observations:

- mutantがredでも契約を直接観測しているとは限らない。X4bのような副作用経由killは、
  契約名に対応する専用assertionと単独test選択で再確認する必要がある。
- static ruleが唯一の防御になる退行は存在する。behavior mutantを無理にkill扱いせず、
  lint-onlyとbehavior-observable mutantをMatrix上で分ける方が証拠として強い。

## Signal / Noise

- sub-agent findings total: 0（指定skip）
- accepted: 0
- rejected: 0
- deferred: 0
- question: 0
- external findings: Plan Review P2×1 / P3×1、Final Review P1×1 / P3×1。
  blocker修正2件と記録・実装時確認2件で、誤検出なし。

## Cost / Friction

- useful cost: concurrent discard harness、是正前実code lint oracle、X1〜X4b mutation、
  owner X4b独立再実測、exact-HEAD L1 2回、hosted final 1回。
- excessive friction: X3 async gap試行4系統、STATECAP超過後のstate-only履歴圧縮と
  exact-HEAD L1再実行。
- confusing steps: behavior test greenとlint redを一つの「mutation kill」と表現した点、
  adjacent transition compressionとstate-only上限の事前照合。
- review rounds (broad audit / closure確認の内訳): Plan Review 1 /
  Final Broad Audit 1 / owner closure確認 1。
- state-only commits / 総commit数: 3 / branch 12 commit（squashで1 commitへ集約）。

## Recommended Workflow Adjustment

Keep:

- source designでcommit/event境界を先に固定し、ownerが可視差をPlan Gateで裁定する流れ。
- 是正前production code guard oracle、clean baseline mutation、Final Reviewerの
  代表mutant独立再注入、Ready exact-HEAD三点一致。

Change:

- Matrixでmutation killを主張する前に、fixed / mutantがharness上で観測可能に
  区別されることを最初のREDで確認する。区別不能ならstatic-only defenseと
  behavior-observableな欠落mutantを別行にする。
- post-reviewの隣接遷移をmaterializeする前にforward state-only件数を確認し、
  evidenceが揃っている遷移は一つのcanonical commitへ圧縮する。各commit直後の
  `check-workflow-git.sh`という既存ruleを省略しない。

Follow-up:

- mutationの「behavior-observable / static-only」分類をglobal Matrix templateへ
  追加するかは、監査是正 順7〜8のWERで同型事例が再発した場合に次期workflow docs
  consolidationで判断する。

## Retired / Consolidated Rules

- X3を「render同期へ戻す一つのmutantでbehavior testとlintの双方がred」とする期待を
  退役し、X3 lint-only defenseとX3a event lock完全欠落behavior testへ統合・分離した。
  scheduler内部へ依存する専用test追加は行わず、既存official lint ruleを再発防止の
  正本とする。

## Applied / Deferred Workflow Changes

Applied:

- Matrix / PR evidenceをX3 lint-only、X3a behavior、X4b専用testへ是正し、
  ownerが代表mutantを独立再現した。
- state-only遷移をcanonical 1 commitへ圧縮し、完全な遷移列/evidence narrativeを保存。
- archive packetでmerge/archive状態、Plans/Handoffで次の監査順7を同期した。

Deferred:

- global Test Matrix templateへのmutation defense分類追加。単発事例でruleを増やさず、
  順7〜8 WERで同型再発時に次期workflow docs consolidationへ起票する。

Not applied:

- React schedulerに依存するcustom harness / timer制御。実装詳細への依存が強く、
  official lintで直接検出できる退行に対して保守コストが上回る。
