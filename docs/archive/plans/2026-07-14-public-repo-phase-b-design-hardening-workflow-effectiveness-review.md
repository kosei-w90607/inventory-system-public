# Workflow Effectiveness Review: public 化 Phase B runbook 安全設計補強（PR #168）

## Workflow Used

- Project Profile: [project-profile.md](../../project-profile.md)
- Plan Packet: [2026-07-14-public-repo-phase-b-design-hardening.md](2026-07-14-public-repo-phase-b-design-hardening.md)（plan-first、gated amendment 3件）
- Test Design Matrix: [test-matrices/2026-07-14-public-repo-phase-b-design-hardening.md](test-matrices/2026-07-14-public-repo-phase-b-design-hardening.md)
- review-only sub-agent: 独立 Plan Gate 4 round、実装後 Double Audit 2 pass、独立 closure
- external review: GitHub review/comment object は0件。レビュー authority は Packet の append-only Review Response と PR body
- human approval: Ready、closed Actions-unavailable route、merge
- gates: synthetic local Phase B probe、docs/workflow/public-sanitization、exact-HEAD local full、PR body/live HEAD 照合
- merge: PR #168 squash merge `d298f76`

## What Worked

- repository mutation前のDesign Phaseとして機能した。Plan Gateは、builder/evidence seal、hosted例外、provenance別failure route、actual closeout schemaを実行前に閉じ、repository作成・push・visibility変更を0件のまま維持した。
- `source baseline`と`final root`、private control planeとpublic payload、public writerとhistory-viewを別authority/roleとして正本化し、「同じclone/commitが両方を兼ねる」危険な省略を排除した。
- Double Auditはcandidate identity restart、actual empty destination、post-push recreate-only、durable GitHub surfaces、public closeout/dashboard同期を検出した。Findings Freeze後はclosure-onlyで収束し、post-freeze exceptionは0件だった。
- exact-HEAD local full、PR body、live PR HEADを一致させ、hosted allocation不成立をproduct failureと混同せず、closed例外とowner dispositionを記録してmergeできた。
- Phase A WERのfollow-upであるpublication surface ledger、public metadata、isolated builder probe、one-shot owner gateをR4 runbook/Matrixの必須入力へ昇格できた。

## What Did Not Work

- Plan Gateは4 roundを要した。初稿は重要概念を列挙していたが、immutable `H1`/`H2` seal、failure provenance、closeout field allowlistまで実行可能な状態機械として接続できていなかった。
- gated amendmentが3件発生し、source docs・Packet・Matrixの同根修正が分割された。正本表とMatrix要約の同期漏れが独立レビューで再検出され、レビュー摩擦を増やした。
- 実装後Double AuditでP1/P2が残った。Plan Gateで契約を閉じても、repository surfaceの再作成routeとcandidate epochの全消費者をline-by-lineで照合する工程が不足していた。
- GitHub上のreview objectは0件で、Plan Gate/Double Auditの根拠はPacket内記録を読まないと復元できない。

## Issues Caught Before Implementation

- Plan Gate round 1: P1=4/P2=4。Git実行環境隔離、Security & Analysis、Findings Freeze順序、hosted route、source-derived failure、retry budget、public closeout schemaを補強。
- round 2: P1=1/P2=3。2つのclosed hosted例外のSSOT、builder evidence、provenance分類、exact closeout contentを補強。
- round 3: P2=1。可変bundleへの追記を禁止し、immutable pre-push `H1`と`H1`を参照するpost-push `H2`へ分離。
- round 4: P1/P2=0でPlan Gate通過。

## Issues Caught by Tests

- synthetic probeは `archive -> isolated parentless builder -> explicit no-tags refspec -> bare destination -> fresh clone` を再現し、1 commit / 0 parent / active control artifact 0を確認した。
- docs/workflow/public-sanitization gatesはsource docs・Matrix・dashboardの参照整合と公開禁止classの不在を確認した。
- 実GitHub surface、visibility、permission inheritanceはDesign PRのnon-scopeであり、R4 private-first gateへ残った。

## Issues Caught by Review-only Sub-agent

- Double Audit A: P1=0/P2=5、B: P1=2/P2=2/P3=1。
- overlapを統合したfrozen setは、candidate identity変更時のaudit restart、source-derived post-push destination disposal、hosted-policy SSOT、recreate-only surface routing、actual empty destination、durable GitHub surfaces、public closeout/dashboard同期。
- 全P1/P2をacceptedし、同一epoch closureでP1/P2=0。post-freeze exceptionは0件。

## Issues Caught by External Review

- GitHub上のreview/comment objectは0件。ownerはHuman GateのReady・hosted例外・mergeだけを担当し、設計findingのrelayは行っていない。

## Escaped / Late Findings

- Double AuditのP1/P2はcontent candidateまで到達したlate findingだった。特に`candidate identity`の変更がFreezeだけでなくevidence/surface/closure authorityを全面失効させること、post-push failureの全routeがdestination再作成へ収束することはPlan Gate時のconsumer sweepで前倒しできた。
- exact closeout schemaがsource runbookに存在しても、`Plans.md` dashboardとの同時push gateが初稿では閉じていなかった。公開証跡は単一fileではなく同時公開されるsurface setとして扱う必要がある。

## Test Adequacy

Strong tests:

- builder/destination/fresh cloneを分離したsynthetic structural probe。
- public-sanitization、workflow state、doc link/contract consistencyの組合せ。
- exact-head clean local fullとPR body/live head照合。

Weak or deferred tests:

- namespace inheritance、collaborator/app/webhook/ruleset、Security & Analysis、unauthenticated viewはactual destinationが存在するまで検証不能。
- `H1`/`H2` chain、credential revocation、builder destructionはR4 execution evidenceで初めて実証可能。

## Signal / Noise

- Plan Gate: round 1 P1=4/P2=4、round 2 P1=1/P2=3、round 3 P2=1、round 4 P1/P2=0。
- Double Audit: A P2=5、B P1=2/P2=2/P3=1。P1/P2は全accepted、rejected 0、deferred 0、closure reopen 0。
- findingはすべて公開事故、false rollback、監査authority喪失、またはclosed hosted例外の逸脱に直結し、signalは高かった。一方、同根driftを複数roundで拾った分は初稿の正規化不足による回避可能な摩擦だった。

## Cost / Friction

- review rounds: Plan Gate 4 + Double Audit broad 2 pass + closure 2 context。
- state-only commits: 3（上限どおり）。
- owner intervention: Ready、hosted exception/merge disposition、merge。設計findingの手動relayは0。
- hosted CIはsource allocation不成立。exact-head local fullとDouble Auditをclosed non-release R2/R3 routeのcompensating evidenceとした。

## Recommended Workflow Adjustment

Keep:

- repository mutation前のR4 Plan Gate、Double Audit、Findings Freeze、immutable candidate epoch、just-in-time owner approval。
- private control plane/public payload分離とstatus-only evidence。

Change:

- R4 Packet初稿はprose列挙でなく、`lifecycle step / authority / irreversible command / precondition / evidence / failure route / owner gate` の単一canonical tableから作る。
- Plan Gate前にsurface ledger全行を `expected private / expected public / query / stop condition / recreate impact` でreconcileする。
- candidate identityの全consumer（H1/H2、audit、Freeze、fresh clone、surface ledger、closeout）をconsumer sweepし、1要素変更で全面失効するnegative testをMatrixへ置く。
- owner gateは前提・実行対象・status-only期待値・失敗時停止を1メッセージにまとめる。

## Applied / Deferred Workflow Changes

Applied:

- D-041と`PUBLIC_REPO_MIGRATION.md`へlifecycle、authority、recreate-only、surface、closeout契約を正本化した。
- R4 execution Packet/Matrixは上記canonical lifecycle/surface ledgerを必須入力とする。

Deferred:

- generic workflow/templateへのR4 lifecycle table追加は、actual Phase B WERで同じ摩擦が再現するか確認してから判断する。
- GitHub review object可視化方針はpublic cutover後のworkflow review target。

Not applied:

- scannerや単一reviewだけで未知の非公開情報不在を証明する設計。private-first、multiple surfaces、independent Double Audit、fail-closed stopを維持する。
