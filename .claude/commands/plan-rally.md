Planの独立レビューが必要なときだけ使うoptional helper。reviewの要否、reviewer、予算、収束条件は対象Plan Packetと`docs/DEV_WORKFLOW.md`が所有し、このcommand自体はgateや承認条件を追加しない。

引数: `$ARGUMENTS`（対象Plan、確認したいscope、希望する出力形式）

## 実行フロー

1. `Plans.md`から対象のactive Plan Packetを一意に特定する。
2. PacketのRisk、Plan Reviewer、Owner Effort Budget、Subagent Budgetを確認する。
3. 独立fresh contextのread-only reviewerへ、対象scopeと既存findingだけを渡す。
4. 結果をP1 / P2 / P3、根拠、最小修正境界に整理し、Coordinatorへ返す。
5. 修正と最終裁定はCoordinatorが行う。P1/P2=0でもWorkflow Stateとowner Human Gateを自動遷移させない。

## 境界

- mandatoryな反復回数、model名、agent log時間窓、個人memory更新を要求しない。
- reviewerへWrite / Edit / commit / push / PR操作を渡さない。
- 同じfindingのclosure確認と、新しいbroad reviewを混ぜない。
- Packetの予算上限へ達したら追加reviewを生成せず、Coordinatorへblockerを返す。

## 正本

- workflow / phase / review: `docs/DEV_WORKFLOW.md`
- role / consultation relay: `docs/AGENT_OPERATING_MANUAL.md`
- task scope / budget / reviewer: 対象Plan Packet
