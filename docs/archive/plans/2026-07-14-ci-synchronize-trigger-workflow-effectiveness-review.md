# Workflow Effectiveness Review: CI synchronize trigger correction

## Workflow Used

- Project Profile: [project-profile.md](../../project-profile.md)
- Plan Packet: [2026-07-14-ci-synchronize-trigger.md](2026-07-14-ci-synchronize-trigger.md)
- Test Design Matrix: [test-matrices/2026-07-14-ci-synchronize-trigger.md](test-matrices/2026-07-14-ci-synchronize-trigger.md)
- review-only sub-agent: independent Double Auditとfinding closure、main統合後のfresh Double Audit
- human approval: Ready / merge / closeout
- gates: targeted workflow/pre-push tests、Plan/full docs、CLEAN L1、exact-HEAD hosted final

## What Worked

- event文字列の存在確認ではなく実効YAML nodeとmutationを検査し、guard、concurrency、classifier、check名のfalse greenを実装前reviewで発見・修正できた。
- 先行PRのmain mergeを無視せず、競合解消後の全差分をfresh reviewer 2名が再監査したため、D-045やpublic-writer/history-view分離を失わず統合できた。
- Draft中のbranch更新で`synchronize` eventが生成されてもrunner jobsがskipされ、Ready後は同じcurrent HEADのhosted finalがgreenになった。
- PR本文をexact-HEAD evidenceのauthorityにしたため、tracked stateの例外があってもmerge対象と検証対象を曖昧にしなかった。

## What Did Not Work

- main競合により`human-confirm`から`implementing`へ正当に戻った結果、STATECAPのpost-implementation枠を使い切った。現契約には、外部main更新による再検証cycleを安全に完了する例外・補正laneがない。
- CoordinatorはSTATECAPを満たすため、未push local historyのresetと再構成を提案した。検証済みcontentの安定性よりstate machineの形式を優先し、フローが手段から目的へ変わりかけた。
- tracked Phaseはmerge時に`implementing`のまま残った。これはPR本文で透明に例外化したが、機械guardと正当な復旧経路が不整合なままである。

## Issues Caught Before Implementation

- `synchronize`欠落、required-check/path-filter非scope、Draft runner-zero維持をPlan Gateで固定した。
- 構造parseと削除・余分event mutationの必要性をPlan reviewで追加した。

## Issues Caught by Tests

- missing/extra event、Draft/owner guard弱体化、cancel無効化、wrong head SHA、quoted push、merge group、unguarded jobをnegative mutationが拒否した。
- Draft更新のhosted eventはjob-level guardによりrunner jobsをskipした。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| raw substring検査がcomment decoyやguard弱体化を受理する | accepted | 実効YAML構造validatorとmutationへ置換 |
| Contract Coverage Ledgerとtest分類の不足 | accepted | contract単位にimplementation/test/reviewを再配置 |
| main統合時にPR #1の完了状態を失う可能性 | prevented | fresh Double Auditで両変更の併存を確認 |

## Issues Caught by External Review

- ownerが「フローを守るために履歴を組み直すことが手段の目的化ではないか」と指摘した。reset提案を撤回し、現在の検証済みHEADを維持する非破壊routeへ戻した。

## Escaped / Late Findings

- STATECAPが正当なbacktrackを通常のstate churnと同じく数える問題は、merge直前まで表面化しなかった。
- Coordinator自身のadversarial checkが「履歴再構成は実害を減らすか」を問えず、owner interventionが必要になった。

## Test Adequacy

Strong tests:

- 実効YAML構造validatorとnegative mutation。
- exact current-head classifier、Draft/owner guard、concurrency、root trigger完全一致。

Weak or missing tests:

- mainがHuman Gate中に進み、正当なbacktrackと再reviewが必要になった場合のSTATECAP lifecycle fixture。
- state-only budget超過時に、履歴改変ではなくgoal invariant / non-destructive exceptionへ戻す契約。

Mutation-style observations:

- state-only commit数を減らすために履歴を組み直してもworkflow実装の安全性は増えない。むしろreviewed HEADを変え、force updateや再検証のリスクを追加する。

## Signal / Noise

- 高signal: 実効YAML mutation、fresh main統合review、exact-HEAD hosted final。
- noise: commit数上限を結果目的として扱い、検証済みcontentの履歴再構成を検討したこと。

## Cost / Friction

- useful cost: Plan Gate、structural/mutation tests、Double Audit、main統合後の再review、L1/hosted exact-head確認。
- excessive friction: STATECAP上限後の形式的なphase同期と、それを満たすための履歴再構成検討。
- confusing steps: backtrack自体は正しいのに、その記録が後続の正規Ready遷移を閉ざした。

## Recommended Workflow Adjustment

Keep:

- exact-HEAD evidence、Draft guard、構造/mutation tests、main変更後のfresh review。

Change:

- STATECAPはforward churnと、外部main変更・review findingによる必要なbacktrackを区別する。
- 上限到達時は履歴改変を提案せず、`goal / actual harm path / non-destructive evidence / residual process mismatch`で例外判定する。
- tracked Phase同期が不可能でも、PR本文の透明な例外、current HEADのCLEAN L1、P1/P2=0、hosted exact-headが揃う場合のowner-approved completion laneを設計する。

Follow-up:

- D-045 generic guardを実装する別R3 workflow changeに、STATECAP correction budget / exception semanticsとsynthetic lifecycle fixtureを含める。
- 最初のnon-doc PRでReady head更新の`synchronize`とcancellationをdogfoodする。

## Applied / Deferred Workflow Changes

Applied:

- reset / force update / local history reconstructionを行わず、PR本文へ手続例外と実質merge gateを明記してmergeした。
- Packet / Matrixをarchiveし、Plans / Handoffへ結果とfollow-up targetを同期した。

Deferred:

- generic workflow checker、template、Skillの変更は別R3。CI trigger修正のcloseoutへ混在させない。

Not applied:

- STATECAPを満たすためだけの履歴再構成。製品・CI安全性を改善せず、新しい履歴リスクを加えるため。
