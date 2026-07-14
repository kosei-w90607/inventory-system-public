# Workflow Effectiveness Review: public 化 Phase B の goal drift

> Public-safe retrospective. Detailed control-plane evidence, local paths, identities, and private review records are intentionally excluded.

## Workflow Used

- Project Profile: [project-profile.md](../../project-profile.md)
- Plan Packet / Test Design Matrix: owner-retained control artifacts; not copied into the public repository
- review: plan review、candidate privacy review、fresh-clone verification
- human approval: visibility変更など不可逆操作の直前承認
- gates: sanitized parentless snapshot、privacy checker、fresh-clone local full、public hosted CI

## What Worked

- 公開対象外原本をrepositoryから外し、公開treeの機微値をsynthetic値へ置換した。
- source historyから切り離したparentless snapshotと、public writer / history-viewのclone role分離は有効だった。
- private-firstで候補を検査し、公開前にfresh cloneからtree、topology、privacy、local fullを再検証できた。
- public化後、同じparentless rootに対するmanual dispatchで最初のhosted CI greenを確認できた。

## What Did Not Work

- 本来の失敗定義は「公開すべきでない情報の露出」だったが、実行中に「過去の証跡chainを完全に再構成できないこと」までpublication failureと同一視した。
- proof chainとsurface receiptが肥大化し、候補bytesの安全性より証跡の自己整合が作業目的になった。
- evidence findingに具体的なdisclosure pathを要求しなかったため、candidateを変えない証跡不備がdestination削除・再作成候補へ昇格した。
- Owner Effort Budget超過をhard stopとして使えず、状態説明と目的の再提示をownerへ繰り返し求めた。
- 「hosted CIを利用できる状態にする」という目的に対し、Actions有効化と最初のgreen runが当初の完了条件から外れていた。
- `Plans.md`が実際のmigration stateに追随せず、公開後も旧private repositoryの次工程を示す状態が残った。

## Issues Caught Before Implementation

- source historyをそのままpublicにしないこと。
- 公開対象外原本と実値canaryをpublic treeや検証証跡へ持ち込まないこと。
- public writerとhistory-viewを構造的に分離すること。

## Issues Caught by Tests

- checkerを誤ったdirectoryで実行したfailureは、candidate disclosureではなく検査対象の誤りとして切り分けられた。
- fixed candidateのfresh cloneでprivacy checkerとlocal fullを再実行し、候補を破壊せず安全性を再確認できた。
- public化後のmanual dispatchでhosted runtimeを確認し、migrationの実目的まで完了できた。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| evidence sealとruntime receiptのbinding不足 | evidence defect | fixed candidateを非破壊で再検証し、candidate disclosureとは分離 |
| surface registryとauthorityのdrift | workflow overreach | actual harm pathがない項目をpublication blockerから除外 |
| tree、privacy、topologyの再検査 | safety signal | fresh cloneで再実行しPASS |

## Issues Caught by External Review

- Public repositoryへ持ち込める独立したexternal review evidenceはない。

## Escaped / Late Findings

- Owner Effort Budget超過をCoordinatorが早期検知しなかった。
- evidence-only defectとactual candidate defectを分離するadjudication ruleがなかった。
- dashboardがlive stateより遅れた。
- public化の目的であるActions有効化と最初のhosted CI greenがsuccess pathの外に残った。

## Test Adequacy

Strong tests:

- immutable candidateに対するprivacy checker。
- fresh cloneのparentless topology確認とlocal full。
- public `main`に対するmanual hosted CI dispatch。

Weak or missing tests:

- workflow自身がgoalとcompletion conditionを維持しているかのinvariant。
- evidence findingが具体的なactual harm pathを持つかのadjudication check。
- Owner Effort Budget超過時に証跡拡張を止めるhard stop。

Mutation-style observations:

- 証跡receiptを欠損させてもcandidate bytesは変わらない。この反例がevidence qualityとcandidate safetyの混同を示す。
- fixed candidateのfresh-clone privacy/local-fullを再実行できるなら、過去receiptの欠損は現在の再検証可能性を失わせない。

## Signal / Noise

- candidate safety、mutation authority、evidence qualityを一つのblocker laneへ混在させたことがnoiseの主因だった。
- tree、privacy、topology、owner authorizationに直接結び付くfindingは高signalだった。

## Cost / Friction

- useful cost: sanitization、parentless snapshot、private-first、fresh-clone privacy/local-full、first hosted CI green。
- excessive friction: candidate bytesを変えない証跡chain再構成、surface receipt拡張、destructive repair検討。
- confusing steps: CIを利用するためのpublic化なのに、最初のCI greenが当初の完了条件外だった。
- owner intervention: effort budgetを超えて状態説明とgoal復帰を求めた。

## Recommended Workflow Adjustment

Keep:

- sanitization、parentless snapshot、private-first、fresh-clone privacy/local-full、visibility直前approval。
- public writerとhistory-viewの分離。

Change:

- irreversible taskのfindingは `actual harm path / affected candidate or mutation / non-destructive revalidation / blocker reason` を持つ。
- destructive repairの前にfixed candidateへの最小の非破壊counterfactual checkを行う。
- Owner Effort Budgetをhard stopとし、超過見込み時は新しい証跡要求を止めてminimal sufficient routeへ戻る。
- Plan Packet冒頭のgoal invariantとcompletion conditionを、supporting evidenceより優先する。

Follow-up:

- `docs/DEV_WORKFLOW.md`、Plan Packet template、`inventory-workflow-start`へのgeneric guard実装は、CI trigger修正とは別のR3 workflow changeとして行う。

## Applied / Deferred Workflow Changes

Applied:

- D-045にgoal preservation、evidence adjudication、non-destructive revalidation、budget hard stopを記録した。
- `Plans.md`をpublic化・初回hosted CI green後の状態へ同期した。

Deferred:

- generic workflow、template、skillへのmechanical guardは別R3 change。

Not applied:

- candidateの削除・再作成、過去receiptの再構成。candidate bytesを変えず、実害を減らさないため。

## Addendum: Owner Primary Testimony（2026-07-14 追記）

> 本節以降は archive 後の append-only 追記。既存本文は改変していない。

owner の一次証言（文書からは復元できない早期警戒シグナルとして保存する）:

- 体感の総作業時間は約12時間以上。単純な目的に対して明らかに過大だった。
- 承認依頼が繰り返され、承認するたびに次の承認が発生し、完了へ近づいている感覚がなかった。owner は途中で複数回割って入った。
- agent は証跡収集や設定した指標の充足のためのスクリプトを次々に構築しており、owner からは何を作っているのか判別できなかった。
- 停止の契機は定量指標ではなく owner の勘（「時間がかかりすぎている」という違和感）だった。

この証言が示す検知ギャップ:

- 経過時間・承認依頼回数・新規スクリプト数を owner と agent の双方に可視化する telemetry がなく、Owner Effort Budget は測定を持たない宣言に留まっていた。
- 「設定した指標を満たすための作業」が進捗として報告され、利用者可視の outcome state（sanitized snapshot 完成 → private push → public 化 → hosted CI green）の前進と区別されていなかった。

## Addendum: Analysis Delta（2026-07-14 追記、独立分析）

既存本文と D-045 に対する追加所見。重複しない差分のみを記録する。

- 執行位置の欠陥: Owner Effort Budget は D-038（2026-07-12）で導入された docs 上の規則だが、2日後の本件で作動しなかった。docs 宣言型の budget はこの failure class に実証的に無効であり、執行は承認依頼インターフェース（承認依頼ごとに「この change で N 回目 / 予算 M 回 / 経過概算 / これを承認すると利用者から見て何が完了するか1文」を必須化し、owner が budget を執行できる形）、hook、発注書テンプレという機械的な位置に置く必要がある。
- 実行モード選択軸の欠落: 現行 workflow は Risk 軸のみで装備を決めるが、本件は「一回きり × 不可逆 × owner gate 必須」であり、agent の非同期自律 + 自由な証跡生成という実行形態自体が暴走の前提条件だった。頻度 × 可逆性の軸を加え、一回きりの不可逆作業には time-boxed な owner 同席同期セッション（runbook を最小証跡で踏む）を選べる実行モードが必要。
- ルール総量への削減圧力の欠如: 歴代 WER の是正がほぼ全て規則追加であり、検査面が単調増加して agent の正当な作業生成源になっている。WER template に「retire / 統合するルール」欄を設け、net rule growth への削減圧力を構造化する。

これらの generic 化（`docs/DEV_WORKFLOW.md` / template / hook への実装）は D-045 follow-up の別 R3 change の設計入力とし、本追記は一次証言と分析差分の保存に留める。
