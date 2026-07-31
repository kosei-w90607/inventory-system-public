# Workflow Effectiveness Review: 店舗調査証跡と導入時運用契約の同期

対象: PR #55（squash merge `53d0d355cbb363817852bd6372ced27582f7aeca`、2026-08-01）。店舗調査で既に得ていたZ004/CV17証跡とowner補足を、実装済み・未実装・operator受入へ分離して正本化したR3 docs-only change。

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-08-01-field-evidence-operations-sync.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-08-01-field-evidence-operations-sync.md`
- review-only sub-agent: independent Claude Sonnet 5のFinal Contract Audit
- external review: independent Claude Sonnet 5のPlan Reviewと2回のclosure確認
- human approval: source事実の補足、標準取込み経路、Ready、merge / closeout
- gates: local-only evidence probe、source/code境界突合、stale wording mutation、data-safety / scope diff、L1 full、exact-HEAD hosted final、三点SHA一致

## What Worked

- Design Phaseで、Z004の存在・列・販売実績、BIZ-03の実装済み在庫pipeline、現行IO-02のlayout A未対応を分離した。これにより「Z004取得や在庫接続そのものが将来作業」という過大な未実装扱いをsource docsへ残さずに済んだ。
- ownerとの対話から、通常手順を`SD -> CV17 -> PC側EcrDatas`へ一本化し、layout A/Bをoperatorの選択肢ではなくadapter互換性として固定できた。デジタル操作に不慣れなoperatorへ不要な選択肢を露出しないという目的がsource contractへ入った。
- Plan Reviewはstale wording grepの自己一致を捕捉し、最初のclosureは修正後regexが実際に是正した`在庫自動引落し候補`を取りこぼすことまで検出した。現行docsで0件を見るだけでなく、main上の実在variantで検出能力を確かめたため、検査の見かけ上のgreenを防げた。
- Final Contract Auditはadapter/core、公式集計/商品別売上、current/future、紙代替受入、data safetyをsource docsと実装コードへ戻って突合し、docs-only changeの過大主張と実店舗artifact混入を防いだ。
- CI-TRIGGER-D1のrecovery routeを実運用した。docs-only Ready eventで自動runが0件だったことを確認してからworkflow dispatchを1件だけ行い、重複なしでexact-HEAD finalを得た。

## What Did Not Work

- 最初のstale grepはactive Packet自身の検査式・棄却説明と正常なPlans文へ自己一致した。広い語順regexを受入条件へ置く前に、対象pathと既知の正常文をfixtureとして試すべきだった。
- 自己一致を避ける初回修正は語彙を狭めすぎ、実在した`自動`挿入variantを取りこぼした。false positive除去と回帰感度を別々に確認しなかったため、closureがもう1round必要になった。
- final L1の初回は、起動済みプロセスが環境修正前のNode 25 PATHを保持していたため`npm ci`で停止した。repo pinとfresh shellは正しかったが、長寿命agent processのPATHが更新されない境界を開始前に明示できていなかった。
- R3 docs-onlyでもlocal fullと全hosted jobを実行したため計算量は大きい。本changeはworkflow contract上hosted-requiredであり省略できなかったが、product runtimeの欠陥を追加で見つけたわけではない。

## Issues Caught Before Implementation

- Z004を将来取得・在庫接続候補とする旧記述と、既存BIZ-03 pipelineの不一致。
- CV17 internal保存と明示書出しのshape差を、operatorが取込み形式を選ぶ仕様へ誤変換する危険。
- Excelファイル群は毎日上書きされ、印刷・バインダーだけが現行の日別履歴である一方、アプリ画面の紙代替受入は未完了という境界。
- stale wording grepの自己一致と、修正版regexの実在variant検出漏れ。

## Issues Caught by Tests

- main上の是正前文言をmutation fixtureとして流し、`在庫自動引落し候補`を新regexが検出することを確認した。
- active source docsと`docs/Plans.md`では同regexが0件となり、回帰感度とfalse positive抑制を両立した。
- doc consistency、scope diff、data-safety probe、local full、hosted finalが、docs-only境界とexact-HEAD evidenceを確認した。
- devEnginesが古いprocess PATHのNode 25をfail-fastし、誤ったtoolchainで検証を続行しなかった。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| Contract Coverage Ledger / negative-space / state-only / data safetyの欠落 | question / confirmed clean | Final Contract AuditでP1/P2/P3=0。source docs 15箇所と実装境界の整合を確認 |
| Reviewed Content HEADをstate-only live HEADへ合わせる推奨 | rejected | D-035に従い、監査済みcontent-bearing HEAD `657c3cc`を維持。final L1 HEADはPR body evidenceへ分離 |

## Issues Caught by External Review

- P3: stale grepが検査式自身・棄却説明・正常なbacklog文へ自己一致した。path境界を狭めてclosureした。
- P2: 狭めたregexが本change自身の是正前variant `在庫自動引落し候補`を検出しなかった。`自動`の任意挿入と既知variantを吸収し、main実文でclosureした。
- Final Contract Auditは新規findingなしで、field evidence、source docs、実装済みpipeline、Workflow State、L1 evidenceを独立突合した。

## Escaped / Late Findings

- product / runtime defectのmerge後escapeは確認されていない。
- stale grepの感度不足はPlan Gate内で閉じたが、initial reviewの修正が新しいgapを作ったためlate寄りのclosureとなった。修正後の0件確認だけではなく、修正前実文をpositive fixtureにする必要があった。
- stale process PATHはfinal L1で初めて表面化した。環境設定自体は正しく、`mise exec`で同一HEADを再検証したためmerge evidenceには残らなかった。

## Test Adequacy

Strong tests:

- 現行0件だけでなく、main上の実在stale文言をpositive fixtureとして再現したregex probe。
- source docs、実装コード、local-only匿名化evidenceを別々に読み、adapter factsとcore capabilityを突合したContract Audit。
- PR HEAD / local L1 / hosted runのexact SHA三点一致とduplicate run確認。

Weak or missing tests:

- lexical grepは意味的な言い換えを完全には検出しない。source reviewとContract Auditを代替不能な層として残す必要がある。
- Z004 layout A/Bのbyte-level parser、返品・複数数量・同日複数精算は本changeのnon-scopeで、後続R3の実装/testが必要。
- 日次/月次画面の紙・バインダー代替はoperator受入前で、自動testだけでは完了判定できない。

Mutation-style observations:

- wording guardはnegative側の0件だけでなく、正した実在variantをpositive側に置かないと、false positive修正で感度を失いやすい。
- regex本文をPacketとMatrixへ二重転記せず、Acceptance Criteriaをsingle oracleとしてMatrixから参照する方がdriftを減らす。

## Signal / Noise

- sub-agent findings total: blocker finding 2件、non-finding recommendation 1件
- accepted: 2件
- rejected: 1件（Reviewed Content HEAD推奨）
- deferred: 0件
- question: lexical guardで意味的言い換えまで機械化する費用対効果

## Cost / Friction

- useful cost: field evidence整理、source/code突合、実在variant mutation、cross-vendor Plan / Final Review、exact-HEAD CI。
- excessive friction: stale grepの修正が新しい検出漏れを作った追加closure、古いprocess PATHによるL1再実行。
- confusing steps: docs-only Ready eventが0-runになることとhosted-required finalのrecovery dispatch、Reviewed Content HEADとfinal L1 HEADの所有権差。
- review rounds (broad audit / closure確認の内訳): Plan Review 1 + closure 2、Final Contract Audit 1。
- state-only commits / 総commit数: 3 / 6（squash前branch）。

## Recommended Workflow Adjustment

Keep:

- field evidenceを確認済み事実・core実装・operator判断・未決follow-upへ分離するDesign Phase。
- wording guardを実在する旧文言でpositive mutationし、現行sourceでnegative確認する二面検証。
- docs-onlyでもrequired finalのstateを観測してからdispatch/no-opを選ぶCI-TRIGGER-D1。

Change:

- historical wordingを守るACは、Plan Gate前に少なくとも1件の実在pre-change文をpositive fixtureとして実行する。
- 長寿命agent processでtoolchain設定を変えた後は、final L1をfresh shellまたは`mise exec`から起動する。
- Reviewerのexact-HEAD推奨は、Reviewed Content HEADとfinal evidence HEADのfield ownerを先に突合してから採否を決める。

Follow-up:

- 次のZ004 layout A/B R3 Packetで、店舗採取shapeをpositive fixtureにしたparser mutationと既存在庫pipelineのend-to-endを設計する。
- 次のEcrDatas lifecycle R3で保持・命名・部分転送・再取込み境界を決める。
- go-live前の日報operator受入で、過去日検索・修正状態・欠落把握・backup/restoreを含む紙代替条件を確認する。

## Retired / Consolidated Rules

- Matrix M3へのregex全文の二重転記を退役し、Acceptance Criteriaの限定stale grepをsingle oracleとして参照する形へ統合した。
- SD、EcrDatas、明示書出しを同格の通常手順として提示する案を退役し、EcrDatas標準経路とrecovery/investigation経路へ統合した。
- lexical paraphraseを完全防御する新しいglobal checkerは追加しない。今回の2面probeとsource reviewで便益を満たし、未実証のrule growthを避ける。

## Applied / Deferred Workflow Changes

Applied:

- stale grepのpath境界をactive source docsへ限定し、実在する`自動`variantを含むpositive / negative probeへ修正した。
- MatrixはACのoracleを参照し、regex本文の独立ownerを増やさない形へ整理した。
- CI-TRIGGER-D1 recovery routeでexact HEADへ1回だけdispatchし、重複runなしを確認した。

Deferred:

- Z004 layout A/B parserと既存在庫pipelineの店舗shape end-to-endは次の別R3。
- EcrDatas lifecycle、固定slot / bulk onboarding、紙代替operator受入は各follow-up targetへ分離。

Not applied:

- semantic paraphraseを完全検出すると主張する新しいstatic guard。
- runtime code、workflow YAML、DB schema、実店舗fixtureの変更。
