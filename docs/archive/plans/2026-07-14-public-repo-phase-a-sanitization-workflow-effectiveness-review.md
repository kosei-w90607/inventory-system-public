# Workflow Effectiveness Review: public 化 Phase A（PR #167）

## Workflow Used

- Project Profile: [project-profile.md](../../project-profile.md)
- Plan Packet: [2026-07-13-public-repo-phase-a-sanitization.md](2026-07-13-public-repo-phase-a-sanitization.md)（plan-first、gated amendment 1件）
- Test Design Matrix: [test-matrices/2026-07-13-public-repo-phase-a-sanitization.md](test-matrices/2026-07-13-public-repo-phase-a-sanitization.md)
- review-only sub-agent: 独立 Plan Gate 3 round、実装後 Broad Audit 2 pass、独立 closure 2 context
- external review: GitHub review/comment object は0件。レビュー authority は Packet の append-only Review Response と PR body
- human approval: local-only source の copy/hash confirmation、Ready authorization、hosted infrastructure failure の merge disposition
- gates: fixed candidate scan、clean archive、40/40 semantic audit、negative-space audit、local full、pre-push、exact-HEAD evidence
- merge: PR #167 squash merge。merge tree と検証済み final PR tree の一致を確認

## What Worked

- Plan Gate は実装前に P2 5件を検出し、要求責務の分離、coverage ledger の status/reason、40-row semantic audit、fixture class別の independent oracleを source docs / Packet / Matrixへ反映した。Round 3はP1/P2=0で、plan-first ancestryも維持された。
- Findings Freeze は意図どおり機能した。Broad Audit 2 passのP2 4件をfreezeし、closure 2 contextは全件closed、reopen P1/P2=0、post-freeze exception 0だった。
- 「検証手段と証跡自体も将来のpublic surface」という設計が実効した。checkerはimmutable candidateをfail-closedで検査し、tracked evidenceにはstatus-only resultだけを残した。
- finite canaryだけに依存せず、clean archive、private-identity/negative-space review、40/40 semantic auditを組み合わせ、既知literal以外の漏えい経路も扱った。
- hosted runner不成立とproduct failureを分離し、product/gate failureが観測されていないことを確認した上で、exact-HEAD local fullと独立監査をcompensating evidenceとしてowner dispositionできた。
- state-only commitは上限どおり3件に収まり、D-038/D-039のcapを実変更でdogfoodできた。

## What Did Not Work

- Matrixに失敗条件が存在したにもかかわらず、初回implementation candidateはarchive identityの非URL形残存、CRLF manifest境界、1行fixtureによる集計testのtautology、snapshot builderとsource/history cloneの構造分離不足をself-reviewで閉じ切れなかった。
- CRLFと複数行oracleはTDD/Boundary Check段階で捕まえるべき内容だった。Plan/Matrixの質だけでなく、実装完了前のMatrix行単位reconcileが不足していた。
- GitHub review objectは0件で、Plan Gate / Broad Audit / closureの実体がPacketのappend-only記録からしか追えない。
- owner backup handoffは公開証跡へ実パスを出さない制約を守れた一方、前提・コマンド・期待するstatus-only返信を最初から一括提示できず、追加の確認往復が発生した。
- 作業branchをplan-firstより前に作らず、squash前commit列がlocal `main` に残った。closeoutは`origin/main`直系の別branchから行う必要が生じ、local `main`の再同期は別の明示承認事項になった。

## Issues Caught Before Implementation

- 2つの要求責務がsource docs上で混同されていた -> accepted、責務と後続taskを分離。
- ledger placeholder/status/reasonが意味契約を満たしていなかった -> accepted、全行へ公開要約・定義先・status・理由を追加。
- 件数一致だけではsemantic mappingを保証できなかった -> accepted、40-row independent semantic auditを追加。
- fixtureと期待値の同時置換がtautologyになり得た -> accepted、backend/frontend/doc class別oracleとmutation条件を追加。
- 後続実装を含む要求行がcurrent扱いだった -> accepted、partialと理由へ訂正。

## Issues Caught by Tests

Strong tests:

- missing/empty/malformed manifest、wrong SHA、regular file、symlink target、search/readlink error、duplicate recordをfail-closedで検証した。
- audit fix後はCRLF clean/hit、embedded/residual CR、mixed-newline duplicateまで回帰testへ追加した。
- candidate SHAとdirty working treeを区別し、検査対象の取り違えを防いだ。
- 集計testは異なる2行から期待値を導出し、1行だけを見るmutationがREDになることを確認した。
- clean archiveのdoc consistencyにより、local-only working copyがdangling referenceを隠す経路を閉じた。

Weak or missing tests:

- 初回checker testにWindows newline境界がなかった。
- 初回集計testは1行のみで、入力と集計oracleの独立性を証明していなかった。
- runbookのclone isolationはprose reviewに依存し、初回implementation verificationに構造probeがなかった。

Mutation-style observations:

- 1行だけを集計するmutationで修正後testがREDになった。
- dummy forbidden recordをcandidateへ入れるprobeでcheckerがREDになり、token/pathを出力しないことを確認した。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| 非URL形のarchive identity残存 | accepted | generic notationへ変更し、identity scanを補強 |
| CRLF manifestのfalse negative | accepted | newline正規化と残存CR拒否、回帰testを追加 |
| 集計testが1行でtautological | accepted | distinct 2-row oracleとmutation REDへ変更 |
| snapshot builderがmixed source cloneから十分隔離されていない | accepted | archive由来のtransient repository、sole remote、push authority除去を必須化 |

Broad AuditはP1=0/P2=4。closure 2 contextは全4件closed、reopen P1/P2=0だった。

## Issues Caught by External Review

- GitHub上のreview/comment objectは0件だった。
- workflow開始前のレビュー集計はpublic-safeな一次証跡から再構成できないため、本WERの正式集計には含めない。

## Escaped / Late Findings

- Broad Auditの4件はimplementation candidateまで到達したlate findingだった。特にCRLFとanti-tautologyはMatrixに失敗条件があり、実装完了時のMatrix reconcileで前倒しできた。
- identity residualは「完全URL 0」だけではbare identity 0を保証しないことを示した。URLとidentity tokenは別のnegative classとして扱う必要がある。
- builder isolationは危険なpush commandの禁止だけでは安全境界にならず、push authorityとprivate historyが同じclone/object storeに共存できない構造を必要とした。
- merge後のPR bodyに、merge dispositionがpendingという陳腐化と、Phase B Plan Gateより先にrepositoryを作るよう読める順序矛盾が残った。closeoutで訂正したが、PR body freshnessはmerge前の三点照合に加えてpost-mergeでも確認する必要がある。
- Phase Aのtree scanは将来のpublic初期commit metadataを保証しない。author/committer identityの検証はPhase B gateのまま維持する。

## Test Adequacy

Strong tests:

- candidate/tree/archiveを分離したprivacy checkerとclean-archive check。
- requirements setの構造検査に加えた40/40 independent semantic audit。
- distinct rowsとmutationを使ったbackend/frontend arithmetic oracle。

Weak or missing tests:

- publication surface全体（commit metadata、refs、remotes、repository features、unauthenticated view）を一枚で照合するledgerはPhase Aにはなかった。
- isolated builderからdestination/fresh cloneまでのprobeはrunbook設計へ昇格したが、実repositoryでの実行はPhase BのR4 gateまで未実施。

Mutation-style observations:

- checker、集計oracle、clean archiveの各guardはtemporary mutationでREDを確認した。
- repository visibilityやGitHub surfaceはPhase Aでmutationできないため、Phase Bのprivate-first gateに残る。

## Signal / Noise

- sub-agent findings total: Plan Gate P2=5、Broad Audit P2=4。
- accepted: 9。
- rejected: 0。
- deferred: 0。
- question: 0。
- closure reopen: 0。

全findingが公開事故、契約欠落、またはfalse-greenへ直接つながるhigh-signalな内容だった。一方、全件acceptedだったことは初回plan/implementation reconcileに改善余地が残ることも示す。

## Cost / Friction

- useful cost: Plan Gate 3 round、Broad Audit 2 pass、closure 2 contextで、実装前の設計欠落と実装後の4漏えい/false-green経路を閉じた。
- excessive friction: owner操作のone-shot handoff不足、review結果がGitHub timelineから見えないこと、task branch作成が遅かったこと。
- confusing steps: public-safe evidence制約下のbackup topology説明と、Phase B Plan Gate / repository作成の順序が一時的に曖昧になった。
- review rounds: Plan Gate 3、Broad Audit 1（2 pass）、closure 1（2 context）。
- state-only commits / 総commit数: 3 / 9。

## Recommended Workflow Adjustment

Keep:

- fixed candidate SHA + clean archive + negative-space audit。
- Plan/Matrix/PR body自身をpublic surfaceとみなす規約。
- 40/40 semantic audit、Double Audit、Findings Freeze、closure-only verification。
- state-only commit capとinfrastructure failure/product failureの分離。

Change:

- 実装完了前にTest Matrix各行を `implemented / test exists / mutation or negative path run / evidence owner` の4観点でreconcileする。
- privacy/publication taskではURL検査とidentity-token検査を別negative classとして扱う。
- owner gateはprivate channelで「前提・実行コマンド・status-only期待値・返信文」を1メッセージにまとめる。
- task branchはplan-first commitより前に`origin/main`から作成し、local `main`でplan/implementation commitを積まない。
- merge後closeoutでPR bodyのstate/sequenceを再確認する。

Follow-up:

- Phase B R4 Packetでpublication surface ledgerを作り、tree、commit metadata、refs、remotes、repository features、unauthenticated viewを別行で扱う。
- Phase B Plan Gate前にisolated builder -> local bare destination -> fresh cloneの構造probeを再実行する。
- public初期commit前にauthor/committer name/email/date/signatureを固定して検証する。
- generic workflow/templateへのsensitive evidence handling追加は、Phase B WERで再現性を確認してから判断する。

## Applied / Deferred Workflow Changes

Applied:

- D-040と[PUBLIC_REPO_MIGRATION.md](../../PUBLIC_REPO_MIGRATION.md)へisolated snapshot builder / clone-role separationを昇格した。
- checkerをfixed-candidate・status-only・fail-closedにし、newline/symlink/error/output-leak regressionを追加した。
- 集計testをdistinct 2-row independent oracleへ修正した。
- Findings Freeze後のclosureを既存findingの確認へ限定し、post-freeze exception 0で完了した。
- Phase Bは`origin/main`直系のtask branchをplan-firstより前に作成する。

Deferred:

- publication surface ledger、public metadata probe、private-first visibility checks: Phase B R4 Packet / Matrix。
- owner gate one-shot command package: Phase Bの各just-in-time approval handoff。
- generic `DEV_WORKFLOW.md` / templateへの敏感証跡規約の昇格: Phase B WERで再評価。
- GitHub review object可視化方針: public repo cutover後のworkflow review target。

Not applied:

- 未知の機微情報を有限scannerだけで完全証明する仕組み。独立negative-space reviewとprivate-first stop conditionを維持する。
