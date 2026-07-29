# Workflow Effectiveness Review: wave 4（3 lane / Claude dual-review experiment）

対象: wave 4 = 順16（PR #38 squash `5e341b5`）× 順21 P1-4（PR #40 squash `4a07f7d`）× PK3 negative-glob（PR #39 squash `b5e1c5e`）、2026-07-30完了。Claude Opus 5 / Sonnet 5を同一対象へ相互非開示で並走させるreview experimentを含む。

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet / Test Design Matrix: 3 laneともplan-first、production footprintは互いに素、generated artifactはlane 2専有
- review-only / external review: Codex preflightをFormal Final Reviewに数えず、Claude Opus 5 / Sonnet 5のread-only reviewをlane別に実施
- human approval: wave選定、review route訂正、追加監査、lane別Ready / merge。decision point単位で実数化
- gates: targeted test、実mutation、exact-HEAD L1 full、conflict-free rebase patch-id同値、Ready hosted final、三点SHA一致
- merge train: lane 2（PR #40）→ lane 3（PR #39）→ lane 1（PR #38）

## What Worked

- **3 laneのcontent分離とmerge trainは成立した**。lane 2だけが設計書76 / traceability生成を所有し、先行merge後にlane 3 / lane 1を競合なくrebaseできた。全laneでrange-diff / patch-id同値とrebase後L1を確認し、review evidenceを内容同一のままcarry forwardした。
- **vendorを分けたreviewは実欠陥を捕捉した**。lane 1ではproduction descriptor自身から期待値を導出する自己参照oracle、lane 3では`.gitignore`検証fixtureの`git init`欠落、lane 2ではOwner Effort過小計上とSTATECAP false-negativeを検出した。
- **mutation実注入がoracle品質を判定した**。lane 1はvariant削除・追加・順序・label・payloadと旧`slice(1)`、lane 2はrequest primitive / consumer drift、lane 3はnegative glob・search root・`--no-ignore`を実際にREDへできた。
- **contentとgovernanceを分離できた**。lane 2の実装内容は複数reviewで健全と確認され、clean replacementはproduction content HEADを保持したままstate履歴だけを再構築した。
- **exact-HEAD merge gateは3 laneすべてで機能した**。PR live HEAD、PR bodyのL1 SHA、hosted run headShaを一致させ、古いgreenを再利用しなかった。

## What Did Not Work

- **Owner Effort Budgetの実数化が遅れた**。review route訂正や追加監査の依頼自体をdecision pointとして直ちに計上せず、lane 2では上限到達後のReady要求がP1となりclean replacementまで必要になった。lane 1 / 3もmerge前に同型訂正が必要だった。
- **lane 2でR2のper-lane subagent上限を超えた**。Wave合算上限4をper-lane上限の緩和と誤読し、Opus / Sonnet 2体を同時発火した。review結果はread-only evidenceとして保持したが、D-034違反はPacketへincident記録した。
- **reviewerのfresh性と実行contextが記録語と一致しない場面があった**。lane 2の最初のOpus reviewはlane 2 diffには初見でも、他laneの発注・集約を行った継続sessionだった。「fresh context」はsession provenanceまで含めて記録しないと復元できない。
- **remote baseの同期不足が複数laneを汚染した**。local `main`が`origin/main`より先行したままPRを開いたため、GitHub diffと`local-ci.sh changed`のwindowがwave外commitまで広がった。lane 2 closureで初めてfast-forward pushし解消した。
- **ambient `/tmp/.git`がfixture再現を交絡した**。lane 3 Sonnet passでは空の祖先`.git`によりripgrepがGit tree内と誤認し、修正前fixtureもPASSした。Opus passがGit markerを持たないclean roomで因果を確定した。
- ownerがClaude窓口へのprompt / result relayを担い、長文転送と当事者だけが知る実行事実の申告が必要だった。技術並列性よりrelayとprovenance管理が律速になった。

## Issues Caught Before Implementation

- lane 1 Plan Review: Pageだけでなくdaily/monthlyのModeTabs・sortable tableを含む全finite-choice ownerと独立oracleをScope / Matrixへ追加。
- lane 2 Plan Review: shared request primitiveのdurable設計書76、consumer prefix / min / named export、timezone非依存date oracleを追加。
- lane 3 Plan Review: `-g`のseparate / attached / short-option clusterをruntime argv guardの対象へ拡張。

## Issues Caught by Tests

- lane 1: finite descriptorの削除・追加・順序・label・payload driftとsentinel順序依存を独立literal oracleで検出。
- lane 2: UUID fallback、local date、strict safe integer、consumer prefix / min / local再実装をmutationで検出。
- lane 3: negative glob再導入、search root削除、`--no-ignore`追加、ignored-only WARN / exit契約をfixtureで検出。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| lane 1 descriptor testの自己参照oracle | accepted P1 | test-only固定contract oracleへ置換し、mutation REDを再実証 |
| lane 1 formatterの`slice(1)` sentinel順序依存 | accepted P3 | sentinelを値で除外し、旧実装復元mutationをRED化 |
| lane 3 ignored-only fixtureのGit初期化欠落 | accepted P1 | synthetic repoへ`git init -q`を追加しclean roomでbefore/after確定 |
| lane 3 Owner Effort過小計上 | accepted P3 | review-route訂正をdecision pointとして2/3へ実数化 |
| lane 3 dependency failureの誤帰属 | accepted P3 | stale diff windowとlane 2設計書76gapの二段因果へ訂正 |
| lane 2 Owner Effort過小計上 | accepted P1 | 5 decision pointへ実数化し、一回限り5へ延長 |
| lane 2 noncanonical state subject / STATECAP false-negative | accepted P2 |旧state履歴を捨てたclean replacement PR #40で回復 |
| lane 2 stale `origin/main`によるGitHub PR diff汚染 | accepted P2 | local mainをfast-forward pushし、lane差分だけへ収束 |

## Issues Caught by External Review

- 3 laneともcontent最終判定はP1/P2=0。
- lane 1 / 3の最初のreviewは実装またはfixtureのblockerを検出し、是正closureで閉じた。
- lane 2のpre-Ready総合監査はcontentではなくgovernance blockerを検出し、clean replacement後のclosureで旧P1/P2を閉じた。

## Escaped / Late Findings

- merge後のproduct defectは確認されていない。
- Owner Effortのdecision point集計はreview発注時にCoordinatorが更新すべきで、reviewerが自分の起用を後から数える構造にしてはならなかった。
- STATECAP subject違反はstate commit直後の`check-workflow-git.sh`とcommit subject reviewで検出すべきだった。
- remote main同期とPR diff scope確認はDraft作成直後に行えば、closure reviewまで持ち越す必要がなかった。

## Test Adequacy

Strong tests:

- production ownerから期待値を導出しない独立literal oracle。
- actual consumer配線とsource ownership guardを組み合わせ、helper単体greenだけで終わらせない構成。
- fixture前提そのものをbefore/after clean roomで検証する因果確認。

Weak or missing tests:

- Git依存fixtureがambient `TMPDIR`祖先の`.git`を継承しないことは機械保証されていない。
- STATECAPはcanonical subjectを名乗らない実Phase遷移を完全には検出できず、docs/Plans.md混在commitのtradeoffも残る。

Mutation-style observations:

- 構造読解だけでは自己参照oracleとfixture環境交絡を確定できない。代表mutation実注入とclean room対比を維持する。
- closure後の全量mutation再々測定は不要だが、initial findingの因果を閉じるmutationは省略しない。

## Signal / Noise

- sub-agent主要findings total: 8
- accepted: 8
- rejected: 1件（lane 2 Opusの「発注baseが陳腐化」診断。事実はremote mainが6 commit遅延）
- deferred: 1件（Git依存fixtureのhermetic `TMPDIR`共通化）
- question: relay定義とfresh-session provenanceの機械検証

## Cost / Friction

- useful cost: 3 worktree、lane別Plan / Final Review、Opus / Sonnetの独立観測、実mutation、merge trainのrebase同値、exact-HEAD hosted final。
- excessive friction: lane 2 clean replacement、owner手動relay、同じgovernance論点のlane 1 / 3後追い訂正。
- confusing steps: Wave合算subagent上限とper-lane上限の優先関係、review対象初見とsession freshの語義、local mainとorigin/mainのどちらをbase正本とするか。
- review rounds: lane 1 / 3はinitial + correction closure、lane 2はcontent preflight + Opus review + dual pre-Ready audit + governance closure。
- state-only friction: lane 2の旧履歴をclean replacementで除外。lane 1 / 3はrebase後にadjacent transition compressionと直後workflow-gitで完了。

## Recommended Workflow Adjustment

Keep:

- 3 laneの互いに素なfootprint、generated artifact lane専有、直列merge train。
- Codex preflightとFormal Final Reviewerの役割分離。
- independent oracle、実mutation、conflict-free rebase同値、exact-HEAD三点一致。

Change:

- owner decisionが発生した時点でPacketの内訳と`N/M`を更新し、review発注自体もdecision pointとして先に計上する。
- review発注bundleに`session fresh / target-first-seen / model / effort / base / true merge-base / review HEAD / role`を分離記録する。
- Draft作成前にlocal `main`と`origin/main`のfast-forward関係を確認し、PR baseをpushしてからGitHub diff scopeを検査する。
- subagent起動前にper-lane上限を先に適用し、その後でWave合算上限を適用する。
- Git / ignore挙動fixtureは祖先に`.git`がない明示TMPDIRを使う。

Follow-up:

- 次のworkflow docs consolidationで、decision-point即時計上、review provenance bundle、remote-base preflight、hermetic fixture guidanceを採否裁定する。
- npm audit warn-onlyの更新は本WERのworkflow変更ではなく、Wave 4外の独立dependency changeとして評価する。

## Retired / Consolidated Rules

- 「Codex reviewがgreenならClaude Formal Final Reviewを省略できる」という運用解釈を退役し、Codexはpreflight、Packet指定のFinal Reviewerだけがgateを満たす形へ統合する。
- review対象を初めて見たこととsession自体がfreshであることを同じ語で扱う記録を退役する。
- Wave合算上限だけを見てlane上限を緩和する運用を退役する。

## Applied / Deferred Workflow Changes

Applied:

- 3 laneすべてのOwner Effortをdecision point実数へ訂正。
- lane 2はclean replacementでSTATECAP履歴を回復し、R2 concurrent超過をincident記録。
- local mainをoriginへ同期し、以後のlane 3 / 1 rebaseとPR diffを正しいbaseへ収束。

Deferred:

- review provenance bundle、remote-base preflight、hermetic `TMPDIR`をrepository規範 / templateへ正本化する変更。
- owner relayを置き換えるcross-agent transportの採否。現時点では手動relayの実態記録を優先する。

Not applied:

- product contentの追加修正、dependency更新、UI変更。
- review深度・mutation adequacy・hosted finalの削減。
