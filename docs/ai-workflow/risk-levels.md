# Risk Levels

Risk Level は変更全体の影響先で決める。ファイル種別ではなく、何を変えるかで判断する。

> Inventory-system では [../DEV_WORKFLOW.md](../DEV_WORKFLOW.md) と [../project-profile.md](../project-profile.md) が優先。ここは共通参考であり、repo-local gate と矛盾した場合は inventory 側の文書に従う。

## R0

docs typo / formatting only.

Required:
- doc check if available

## R1

isolated helper / refactor.
Public output, schema, metric, runtime behavior に影響しない。

Required:
- targeted test if relevant
- lint/type as relevant

## R2

local helper / CLI / evaluation support.
ただし schema/default/metric/threshold/policy 判断には直接影響しない。

Required:
- R1 gates
- CLI negative tests if CLI changed
- docs consistency if docs changed

Optional:
- review-only sub-agent for tricky CLI / data-safety-adjacent / evidence-generating changes

## R3

Public or semi-public contract に影響する変更。

Examples:
- emitted output schema or meaning
- manifest / report / evaluation summary
- config/default/runtime behavior
- threshold/policy/selector/scoring
- acceptance/evaluation metric interpretation
- output used for merge or product decision
- existing evidence interpretation

Required:
- Plan Packet
- Spec Contract
- Test Design Matrix
- negative/fail-fast tests
- compatibility/schema tests
- data safety checks
- review-only sub-agent by default
- external review when preparing PR / merge review
- human approval when the repo-local workflow or data-safety boundary requires it

## R4

Destructive, irreversible, secrets, production data, source-derived data lifecycle.

Required:
- R3 gates
- dry-run/no-op mode
- rollback or recovery plan
- manual checklist
- review-only sub-agent required
- human approval before execution and merge

## Boundary Rule

迷ったら上げる。
「scriptだからR2」とは判断しない。
評価結果、閾値判断、runtime統合判断に使う出力ならR3。
