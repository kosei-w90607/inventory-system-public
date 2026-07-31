# Workflow Effectiveness Review: public Actions CI contract

対象: PR #54（squash merge `2a1f81cda41e29b48de96b875cb0f660b5cb7b42`、2026-08-01）。public repository の GitHub Actions 契約、final trigger 選択、live-doc drift guard を再評価した R3 workflow gate change。

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-08-01-public-actions-ci-contract.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-08-01-public-actions-ci-contract.md`
- review-only sub-agent: Final Double Audit の契約突合 pass と独立 mutation pass
- external review: Claude Sonnet 5 の Plan Review、fresh re-Plan Review、Final Double Audit closure
- human approval: scope、C案裁定、Ready、merge / closeout
- gates: official contract / repository state probe、targeted shell test、synthetic mutation、L1 full、exact-HEAD hosted final、三点 SHA 一致

## What Worked

- Contract Probe が repository visibility、runner class、branch protection、ruleset、cache、run historyを分離して確認し、private repository 時代の billed-minute threshold を public standard-runner 契約へ持ち込む誤りを実装前に除去できた。
- Plan Review が CI-TRIGGER-D1 の recovery state の穴と mutation coverage の偏りを捕捉し、automatic / explicit failure を同じ recovery route に収容し、4 state を個別 mutation で守る設計へ直した。
- implementation wiring probe が `ci-workflow.test.sh` の実配線を直接追い、L1 local-only guard を hosted docs job の実防御と誤認していた Packet を implementation 前に design へ戻した。
- Final Double Audit の独立 mutation pass は built-in と追加 mutation を production oracle から独立して再注入し、guard の感度と残余限界を区別できた。
- CI-TRIGGER-D1 を同じ PR で dogfoodし、event-eligible Ready route だけで exact Ready HEAD の hosted final が成功した。予防的 `workflow_dispatch` は行わず、PR HEAD / PR body L1 SHA / hosted run headSha の三点一致を保った。

## What Did Not Work

- `Reviewed Content HEAD` に Plan Review HEAD を state-only commit で誤記し、その後の通常 content commit で `pending` に戻した。値の最終状態は回復したが、両方とも field の write mechanism 契約に違反し、Final Double Audit の P2 と追加 closure を招いた。
- wiring を実測する前の Packet が「既存配線を再利用」を hosted registration まで含むように扱った。`local-ci.sh` からの呼出しと hosted docs job の step listを別々に確認すべきだった。
- plan-gate の backtrack / re-entry により forward state-only commit 枠を先に消費し、post-implementation の複数 transition を残る1本へ圧縮する必要が生じた。圧縮自体は契約どおりだったが、STATECAP の余裕は小さかった。
- Ready authorization を owner intervention 3/3 で使い切り、merge authorization は後続メッセージになった。merge gate の判断材料はReady前に揃っていたため、最後の承認依頼で条件付き merge / closeout まで同時に提示できた。

## Issues Caught Before Implementation

- CI-TRIGGER-D1 recovery row が hosted-required docs-only の explicit dispatch failure / cancel を収容しない状態穴。
- trigger 4 state のうち一部だけを守る mutation design。
- HEAD SHA concurrency key案が既存のcross-HEAD cancellationを失い、sequential duplicateも防がないこと。
- current docs guard が L1 local-only で、hosted docs jobには未配線という登録境界。

## Issues Caught by Tests

- private quota wording、trigger state の個別弱体化、Actions-unavailable route 削除は synthetic mutation で rejectされた。
- validator は明示された live-doc pathだけを入力にし、archive historyをcurrent instructionとして扱わないことを確認した。
- repository pinと異なる system Node での初回実行は `devEngines` がfail-fastし、Node 24.18.0を明示したL1経路へ修正できた。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| `Reviewed Content HEAD` の誤記と非state-only訂正 | accepted | 違反をPacketへ記録し、正規の最終state-only commitでaudited content HEADを設定。closureでP2 CLOSED |
| M4はarchive意味解析ではなく5 live path限定の証明 | accepted / deferred | guardの主張範囲を残余限界として記録。実装変更なし |
| lexical guardは意味的言い換えを完全検出しない | accepted / deferred | source review / Contract Auditを残し、絶対保証として扱わない |

## Issues Caught by External Review

- Plan Reviewでtrigger recovery stateとmutation coverageのblockerを検出し、fresh re-reviewでclosureした。
- concurrency keyの軽量案をAlternativesへ追加し、既存cancellation semanticsとduplicate抑止能力を比較してYAML変更を見送った。
- Final Double Audit closureでP2の是正記録、Findings Freezeの発効時点、残るP3のnon-blocking性を確認した。

## Escaped / Late Findings

- product / runtime defectのmerge後escapeは確認されていない。
- `Reviewed Content HEAD` write mechanism違反はFinal Double Auditまで到達した。plan approval時のstate-only hunk reviewで、Phaseがhuman-confirmより前なら同fieldを変更しないことを確認すべきだった。
- PacketのFindings Freeze文言は一時「P2 closure待ち」と読める状態になった。D-038では初回2 pass完了時にfreezeが発効するため、closure statusとfreeze statusを分けて記録すべきだった。

## Test Adequacy

Strong tests:

- production contentを期待値sourceにしないsynthetic mutationと、trigger 4 state別の独立弱体化。
- live-doc allowlist、workflow YAML zero-diff、L1 main wiringを別々に検査する構成。
- Ready eventの実runで、運用契約をstatic testだけでなくexact-HEAD lifecycleとして確認したこと。

Weak or missing tests:

- M4はdirectory scanやarchive意味解析の能力を証明しない。
- finite lexical patternはprivate quota概念の言い換えを完全には検出できない。
- `Reviewed Content HEAD` の許可phase / commit種別は機械的に十分検査されていない。

Mutation-style observations:

- state表はheadingの存在だけでなく各rowの禁止動作を個別mutationにする必要がある。
- static guardの検出境界を広く主張せず、構造上実際に読むpathとliteralだけを証拠にする。

## Signal / Noise

- sub-agent findings total: initial Final Double Audit 3件
- accepted: 3件
- rejected: 0件
- deferred: 2件（non-blocking residual）
- question: hosted実防御が必要になる時点と、semantic paraphraseを機械化する費用対効果

## Cost / Friction

- useful cost: official/repository probe、fresh Plan Review、wiring probe、independent mutation audit、exact-HEAD Ready dogfood。
- excessive friction: Reviewed Content HEAD違反の追加P2 closure、同じplan-approved entryの再materialize、最後の承認をReadyとmergeへ分けたこと。
- confusing steps: local L1 registrationとhosted job registrationの区別、Findings Freeze発効とfinding closureの区別。
- review rounds: Plan Review initial + closure、wiring訂正後fresh re-Plan Review、Final Double Audit 2 pass + P2 closure confirmation。
- state-only commits / 総commit数: forward state-onlyは上限まで使用。backtrackとaudit-record commitを追加した。

## Recommended Workflow Adjustment

Keep:

- source contract更新前のofficial/repository Contract Probe。
- trigger lifecycleをstate table + state別mutation + actual Ready runで三層確認する方法。
- wiring claimをcall siteとhosted job stepの双方から検査すること。

Change:

- plan approvalのstate-only hunk auditでは、`Reviewed Content HEAD` が `pending` のままかを明示確認する。
- 最後のowner承認依頼でmerge条件まで揃っている場合は、Ready後の三点一致を条件にmerge / closeoutまで一括承認できる選択肢を提示する。
- Findings FreezeとP2 closureを別field / 文で記録し、freeze発効をclosure待ちと表現しない。

Follow-up:

- hosted側のdocs contract実防御が必要になった場合、`doc-consistency-check.sh`へ統合する別R3を起票する。
- 次のworkflow docs consolidationで、`Reviewed Content HEAD`の許可phase guardと条件付きmerge承認bundleを採否裁定する。
- 次のCI contract auditでM4の主張境界とlexical paraphrase residualを再確認する。

## Retired / Consolidated Rules

- private repository時代の75% / 90% billed-minute gateをcurrent public standard-runner運用から退役した。
- Ready / dispatch / recovery / already-successfulの散在判断をCI-TRIGGER-D1の1つのstate tableへ統合した。
- 「testがlocal-ciへ登録済みならhostedでも実行される」という暗黙の扱いを退役し、L1配線とhosted配線を別contractとして記録した。

## Applied / Deferred Workflow Changes

Applied:

- CI-PUBLIC-D1 / CI-TRIGGER-D1 / D-063をlive source contract化し、private quota wordingを除去した。
- trigger 4 stateのmutation coverage、Actions-unavailable route、live-doc allowlistをlocal L1 guardへ追加した。
- wiring誤認とReviewed Content HEAD違反をPacketへ記録し、正規phase / exact-HEAD routeへ戻した。

Deferred:

- hosted `doc-consistency-check.sh`統合は、hosted実防御の必要性が観測された場合の別R3。
- `Reviewed Content HEAD`許可phaseの機械guardと条件付きmerge承認bundleは次のworkflow docs consolidationで裁定する。
- M4のsemantic archive detectionとlexical paraphrase detectionは、現時点で機械化の便益が未実証のため追加しない。

Not applied:

- workflow YAML、concurrency key、required checks、runner topology、cache keyの変更。
- self-hosted / larger runner導入、Rust job再統合、npm dependency change B。
