# Workflow Effectiveness Review: wave 2（順19 × 順20）

対象: 順19（PR #32 squash `2cb3380`）× 順20（PR #33 squash `45f7fa8`）、2026-07-28完了。2 worktree / 2 WriterとSonnet 5 fresh-context reviewを使ったwave運用。

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet / Matrix: 両laneともplan-firstでmainへ置き、footprintを分離
- review-only / external review: Codex preflight + lane別Sonnet 5 Plan / Final Review
- human approval: wave選定、batch Ready、lane別merge gate
- gates: targeted RED/GREEN、Coordinator mutation、exact-HEAD L1、Ready hosted final、merge-train rebase同値

## What Worked

- 2 worktreeで実装を並行化し、frontend/doc laneとRust/generator laneのfile footprint衝突は発生しなかった。
- lane 1のCodex preflightがPlan Gateで漏れた`ARCHITECTURE.md`旧RHF表記を発見し、gated AmendmentとX11へ戻せた。lane 2は設計したinternal / diagnostic / wire境界をFinal Reviewまで維持した。
- merge trainは#33 merge後に#32をconflict-free rebaseし、3 content commitのper-commit patch-id、range-diff、whole-diffが一致。再レビューなしでPhaseを維持できた。
- 両laneとも画面変更なしをdiffで確定でき、不要な視認・Windows native L3を追加しなかった。

## What Did Not Work

- lane 1は同じ証拠面を長く触り続けた。oracle hardening後にも全mutation再認定、closure、Formal Final Review spot-checkが重なり、ownerの「ずっとそこを弄っていないか」というgoal-drift signalまで停止できなかった。
- これは単発の過剰検証ではなく、過去にも起きた**supporting-evidence goal driftの再発**である。成果は「未参照wrapper / dependencyを安全に退役すること」なのに、証跡収集・mutation件数・review relayを増やすこと自体が進捗の代替になった。exact-HEAD full、Writer全量mutation、Coordinator独立再測定、review-only closureが揃った時点で技術的十分性は満たしており、その後に開始した修正後28件の全件再々測定はGoal Invariantを前進させなかった。
- 根本原因は、検証項目を列挙した一方で**証拠が十分になった時点の停止条件**を先に固定していなかったこと。accepted findingが出るたびに「念のため全量再認定」を追加できる余地が残り、relay上限も品質理由で段階的に拡張された。ownerの俯瞰要求で5件時点に中止できたが、Coordinator自身が先に止めるべきだった。
- append-only narrativeのSHA後書きというworkflow記録P2が、技術成果と無関係なreview relayを2回増やした。是正自体は必要だったが、最初からSHA記録を新規bulletに分ければ回避できた。
- Final Reviewerがfrontend fullとtypecheck/lintを並列実行し、共有`src/routeTree.gen.ts`の生成競合で偽陽性を出した。逐次再実行でgreenになりPR欠陥ではなかったが、調査コストを生んだ。

## Issues Caught Before Implementation

- 両laneのplan-first preflightでtraceability token、mutation注入形、内部field owner、unknown-source filename、diagnostic露出境界を是正。
- lane 1のArchitecture隣接契約は実装後preflightまで遅れた。Plan Gate前の旧語彙repo-wide sweepで拾える問題だった。

## Issues Caught by Tests

- lane 1 contract testはwrapper / dependency / source-doc旧positiveの再導入と、現役`zod` / `radix-ui`の巻き添え削除を区別した。
- lane 2 integration / static contract testはinternal field再膨張、diagnostic 5field欠落、raw detail露出、Z005 provenance欠落を検出した。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| Architecture旧RHF契約とtest false-open | accepted | Amendment 1 + X11 |
| retired dependencyのroot section false-open | accepted | test-only oracle hardening |
| source-doc additive drift false-open | accepted | exact anchor cardinality |
| append-only narrativeの既存bullet編集 | accepted | 原文復元 + 新規bullet |

## Issues Caught by External Review

- lane 1 Formal Final ReviewはP1/P2=0、代表mutationを独立spot-check。P3のImplementation Results未記入はcloseoutで解消。
- lane 2 Formal Final ReviewはP1/P2=0。正常fixture同梱理由のcomment提案は挙動非影響のP3として非blocker裁定。

## Escaped / Late Findings

- merge後のproduct defectなし。
- lane 1 Architecture driftは実装後preflightまで遅れたが、Ready前にgated Amendmentで閉じた。

## Test Adequacy

Strong tests:
- production期待値をimportしない独立列挙 / exact cardinality oracle。
- production pathを通るdiagnostic captureとwire / operation log非露出assert。

Weak or missing tests:
- なし。追加mutationの全量再実行より、変更したoracle familyの代表注入でclosureを確認すれば十分だった。

Mutation-style observations:
- 初回のMatrix全量独立再実測は有効。test-only oracle hardening後は「影響familyの代表注入 + unchanged familyの構造確認」で同じ品質信号を保てる。

## Signal / Noise

- 実欠陥信号: Architecture drift、root section false-open、source-doc additive false-open、append-only違反。
- noise: 共有generated artifactを並列更新したfrontend偽陽性、すでにclosure済みfamilyの全量mutation再実行。

## Cost / Friction

- useful cost: 2 worktree実装、lane別fresh-context review、merge-train rebase証明。
- excessive friction: lane 1 relay 4回と、oracle closure後の重複mutation認定。技術的十分性の達成後も証跡を増やした時間は成果へ寄与しなかった。
- review rounds: lane 1はPlan / Amendment / closure / Final、lane 2はPlan / Final。
- owner介入: 両laneとも3/3。batch Readyは依頼を束ねたが、merge gateは契約どおりlane別。

## Recommended Workflow Adjustment

Keep:
- file-footprint分離、generator lane専有、lane別fresh-context review、conflict-free rebaseのpatch-id二層証明。

Change:
- Matrix全量mutationのCoordinator独立再実測はbaselineで1回。test-only oracle hardening後のclosureは変更したoracle familyの代表mutationに限定し、未変更familyを全量再実行しない。
- 各laneの実装開始前にEvidence Stop Conditionを1文で固定する: `exact-HEAD L1 + baseline全量mutation + P1/P2 closure`が揃った後は、runtime failure、Scope変更、または未closureのP1/P2がない限り追加の全量証跡収集を開始しない。証跡はGoal Invariantの判定手段であり、独立した成果として扱わない。
- frontendのfull / typecheck / lint / route generationは、同じworktreeまたは共有generated artifactを使う環境では逐次実行する。
- Plan Gate前のold wording sweepは、採用正本だけでなくArchitecture等のactive source-doc全域を対象にする。

Follow-up:
- 次waveの各Packet `Review Focus`とreview発注書に上記3点を反映してdogfoodする。canonical workflowへの一般化は、次のworkflow docs consolidationで実測結果を見て判断する。

## Retired / Consolidated Rules

- wave-local practiceとして「oracle hardening後に全mutationを再び全量認定する」と「review / relayを増やせば品質が上がるという暗黙前提」を退役し、baseline全量1回 + 影響family closure + Evidence Stop Conditionへ統合する。DEV_WORKFLOWのmutation adequacyと独立Final Review自体は維持する。

## Applied / Deferred Workflow Changes

Applied:
- 次waveのCoordinator運用をbaseline全量1回 + 影響family closureへ変更。
- 次waveの各laneで、証跡収集開始前にEvidence Stop ConditionをPacketへ置く。
- frontend検証を共有generated artifact単位で逐次実行する。

Deferred:
- DEV_WORKFLOW / templateへの一般化は次のworkflow docs consolidation。次waveで同じ品質を保てた実測を採用条件とする。

Not applied:
- mutation adequacyやindependent reviewの削減は行わない。削るのはclosure後の重複実行だけ。
