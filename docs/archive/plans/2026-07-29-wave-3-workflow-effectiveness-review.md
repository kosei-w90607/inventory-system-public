# Workflow Effectiveness Review: wave 3（3 lane）

対象: wave 3 = 順10（PR #35 squash `73273cb`）× 順13（PR #36 squash `775c07b`）× 順21a（PR #34 squash `45b4e60`）、2026-07-29完了。3 worktree / 3 lane別Sonnet 5 reviewを初めて同時運用した。

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet / Matrix: 3 laneともplan-firstでmainへ置き、production / source docs / generated artifactのfile footprintを分離
- review-only / external review: Codex preflight + lane別Sonnet 5 Plan / Final Review。初回Broad Reviewはfresh context、closureは同Reviewerの同context
- human approval: 3 lane選定、条件付きbatch Ready / merge、lane 2のreview relay・Draft branch履歴訂正
- gates: targeted RED/GREEN、baseline mutation、影響family closure、exact-HEAD L1、Ready hosted final、merge-train rebase同値
- merge train: lane 3（PR #34）→ lane 1（PR #35）→ lane 2（PR #36）

## What Worked

- **3 laneの識別とfootprint分離は成立した**。ownerがterminal名を「レーン1・10担当」「レーン2・13担当」「レーン3・21a担当」に固定したことで、3件の返答をlaneへ誤配する事故はなかった。生成物`src/lib/bindings.ts`はlane 2だけが担当し、lane間のcontent conflictも発生しなかった。
- **小さいR2を2本、contract R3を1本にした編成が機能した**。lane 1はproduction変更なしのhome orchestration test、lane 3は同値なUI helper抽出、lane 2はRust / generated TypeScript wire契約に責務を分けられた。
- **Evidence Stop Conditionはwave 2の再発防止として効いた**。lane 1 / 3はbaseline全量と影響family closure後に再々測定を始めず、Formal Final Reviewの代表確認で止められた。証跡件数を成果へ置き換えるgoal driftは再発しなかった。
- **Plan / Final Reviewは実欠陥を拾った**。lane 3 Plan Reviewは実装後に陳腐化するlive test commentをScopeへ追加し、lane 2はCodex preflightがsource docsの旧generated status、Final Reviewがdurable wording guard欠落、closureがSTATECAP違反とD3 false-greenを検出した。
- **merge trainの直列gateは3 laneでも維持できた**。各laneを最新mainへrebaseし、rebase後HEADでL1を取り直し、live PR / local full / hosted runの三点一致とmerge CLEANを個別に確認した。
- 3 PRともoperator-visible UIの見た目・layout・操作を変更しない範囲を守った。human visual confirmationを形式的に追加せず、diffとcontract testで非変更を確定した。

## What Did Not Work

- **review発注時の実行条件が暗黙だった**。lane 2のclosure promptで初めて`Sonnet 5 / xHigh`を明示し、それ以前のreviewが同じeffortだったかを後から確定できなかった。terminalのmodel表示だけでは、durableなreview evidenceとしてeffortとbaselineを復元できない。
- **ownerが3 lane分の伝書鳩になった**。terminal名で誤配は防げたが、promptと長いreview結果をlaneごとに手作業転送する負荷は残った。3 laneの技術並列性より、review relayの人手がthroughput上限になった。
- **lane 2のstate materializationを分割しすぎた**。P2修正後のforward stateを複数state-only commitへ分け、`check-workflow-git.sh`のSTATECAP failureをclosure reviewまで持ち越した。既存DEV_WORKFLOWは「forward materialize直後にworkflow-gitを実行」と既に規定しており、規則不足ではなくCoordinatorの適用漏れだった。
- lane 2はrelayを既定2から5へ段階拡張した。うちsource-doc driftとdurable guard欠落は品質に寄与したが、STATECAP是正relayはCoordinatorの履歴設計ミスが生んだ回避可能なコストだった。
- Final Reviewerへ渡すbaseが「現在のmain tip」か「branchの実merge-base」か曖昧な場面があり、lane 3では`Plans.md`が後退したように見えるP3 noiseを生んだ。差分の基準線は用途別に固定する必要がある。

## Issues Caught Before Implementation

- lane 1: Router依存子componentをnull mockするharness方針をPlan Reviewで具体化。
- lane 2: serde defaultからgenerated `_Deserialize` optionalityへ到達するContract Probeを独立再現。Design Sourcesの誤引用も特定。
- lane 3: `MonthlySalesPage.test.tsx`の「inline三重定義 / 将来別PR」commentをcomment-only Scopeへ追加。

## Issues Caught by Tests

- lane 1: 4 queryのliteral key / exact args、strict yesterday境界、visibility lifecycle、warning / toast独立性をproduction hook経由で固定。
- lane 2: ordinary fieldとclearable fieldのomitted / null / value、generated input optionality、frontend changed-only payload、source-doc command statusを固定。
- lane 3: canonical helperへ抽出後もclick payload、ARIA、indicator、alignment、Button variant / sizeの同値性を固定。
- lane 2のsection-wide stale-wording oracleは、D3単独の旧未来形をline filterが取りこぼすfalse-greenをclosureで解消した。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| lane 1 Router harness未指定 | accepted P3 | Writer handoffで具体化、contract変更なし |
| lane 2 UI-01b source docsの旧generated status | accepted P2 | gated Amendment 1で51 / SCREEN_DESIGNを同期 |
| lane 2 durable live-wording guard不在 | accepted P2 | existing contract testへrepositoryに残るguardを追加 |
| lane 2 STATECAP上限超過 | accepted P2 | Draft branch履歴をcompression ruleどおり訂正 |
| lane 2 D3単独mutation false-green | accepted P3 | section-wide negative oracleへ拡張 |
| lane 3 canonical化前提のlive test comment | accepted P2 | comment-only Scopeとsweepへ追加 |
| lane 3 stale main tipをbaseにした見かけのPlans差分 | accepted P3 | merge-base差分でNon-scope違反ではないと裁定 |

## Issues Caught by External Review

- 3 laneともFormal Final Review / closureで最終P1/P2=0。
- lane 2だけは初回Final Review後にcontent修正が必要となり、同Reviewerのclosure-only reviewでFindings Freeze境界を維持した。

## Escaped / Late Findings

- merge後のproduct defectは確認されていない。
- lane 2のsource-doc driftはPlan GateではなくCodex implementation preflight、durable guard欠落はFinal Reviewまで遅れた。touched source sectionをPlan Gate前にrepo-wide sweepし、Ledgerの「Automated test」欄を実在testまで確認すれば前倒しできた。
- STATECAP failureはCoordinatorがstate commit直後に機械checkを実行すべきで、reviewerまで到達させる必要がなかった。

## Test Adequacy

Strong tests:

- production helperから期待値を導出しないliteral / independent oracle。
- Rust serde、generated binding、frontend payloadを同じwire意味論の別境界から検査。
- UI helper抽出でDOM / ARIAだけでなくButtonの`variant` / `size`まで固定。
- source docsの対象sectionとgenerated bindingsを直接読むdurable drift guard。

Weak or missing tests:

- lane 2の初回wording guardはcommandを含む行だけを対象にしており、bare command名の旧D3文言を取りこぼした。section全体negative oracleで閉鎖済み。

Mutation-style observations:

- baseline全量1回 + 変更family代表closureは3 laneでも品質信号を維持した。新しいruntime failureまたはoracle弁別性疑義がなければ、全量再々測定は不要。

## Signal / Noise

- 高信号: source-doc drift、durable guard不在、STATECAP failure、D3 false-green、live comment陳腐化。
- noise: current main tipとmerge-baseの混同による見かけの`Plans.md`差分、review環境のeffort未記録による事後確認。
- terminal名によるlane識別は有効だったが、長文relayそのもののコストは減らさなかった。

## Cost / Friction

- useful cost: 3 worktree、lane別fresh-context review、generated artifact lane専有、merge trainのexact-HEAD再取得。
- excessive friction: lane 2 relay 5回、state-only履歴訂正、ownerによる3 terminal間の手動prompt / result転送。
- review rounds:
  - lane 1: Plan / Final
  - lane 2: Plan / Amendment closure / Final / P2 closure / STATECAP・D3 closure
  - lane 3: Plan / Plan closure / Final
- state-only friction: lane 2で分割過多を一度発生させ、Draft branch履歴訂正で回復。

## Recommended Workflow Adjustment

Keep:

- 3 lane時の`2つの小R2 + 1つのR3`、互いに素なworktree、generated artifact lane専有、merge train直列化。
- 初回Broad Reviewはfresh context、finding closureは同Reviewer / 同context、Evidence Stop Conditionは各Packetに置く。
- terminal名を`レーンN・順番担当`で固定し、ownerが返答を貼る際も担当名を添える。

Change:

- Formal reviewer promptの先頭に**Review Baseline Bundle**を固定する:
  - `Model: Sonnet 5`
  - `Effort: xHigh`
  - `Review mode: initial Broad Audit | closure-only`
  - `Base SHA / true merge-base`
  - `Plan Commit / Amendments`
  - `Reviewed Content HEAD / State HEAD`
  - `branch / worktree / PR`
  - `allowed finding scope`
- `main tip`と`true merge-base`を別fieldにし、PR whole diffはmerge-base基準、最新mainとの差分はrebase診断だけに使う。
- forward state materialization後は同じ操作単位で`check-workflow-git.sh`を実行し、複数遷移は既存compression ruleに従って最小commitへまとめる。
- 3 laneのreviewを同時に発注してよいが、ownerへ返す依頼はlaneごとに短いbaseline bundleと1つの次actionへ整形する。長い履歴はPacket / PR bodyを参照させ、chatへ再転記しない。

Follow-up:

- 次の3 lane waveでReview Baseline Bundleを全review promptへ適用し、relay誤配・base誤読・effort不明が0件か確認する。
- 1回dogfood後、`docs/templates/pr-review-prompt.md`またはreview packet templateへの正本化を次のworkflow docs consolidation候補として裁定する。

## Retired / Consolidated Rules

- wave-local practiceとして、reviewerのmodel / effort / baseをterminal設定や会話文脈へ暗黙依存させる運用を退役し、Review Baseline Bundleへ統合する。
- post-reviewのforward stateをphaseごとに小分けcommitする運用を退役し、既存のadjacent-transition compression + commit直後workflow-gitへ戻す。新しいworkflow ruleは増やさない。
- closure後の全mutation再々測定はwave 2に続いて退役を維持し、baseline全量1回 + 影響family closureへ統合する。

## Applied / Deferred Workflow Changes

Applied:

- 3 lane運用を「小R2×2 + R3×1、generated artifact lane専有、terminal名固定」の成立条件付きで次wave候補に昇格。
- 次waveのreview発注はReview Baseline Bundleと`Sonnet 5 / xHigh`明示をCoordinator標準とする。
- state materializationは既存compression ruleと直後workflow-gitを一操作として扱う。

Deferred:

- Review Baseline Bundleのtemplate正本化は次の3 lane dogfood後。対象は`docs/templates/pr-review-prompt.md`またはsubagent review packet。
- owner手動relayを置き換えるcross-agent messaging / automationは、今回のterminal名運用で誤配が0だったため即導入しない。次waveでowner負荷が再びbottleneckになった場合に評価する。

Not applied:

- mutation adequacy、independent Final Review、lane別exact-HEAD hosted finalは削減しない。削減対象は重複再測定と暗黙のreview環境だけ。
