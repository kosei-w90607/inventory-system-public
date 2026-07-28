# GPT-5.6 agent guidance / local override分離

## Workflow State

- Phase: ready-hosted-final
- Risk: R2
- Execution Mode: dual-vendor-no-fable
- Plan Commit: 6b60eb52ac3a1227ed7d7a776252ebbded82c773
- Amendments: none
- Coordinator: Codex
- Writer: Codex
- Plan Reviewer: independent fresh Codex context
- Final Reviewer: independent fresh Codex context
- Reviewed Content HEAD: e21c7cb965b7f94f9d91acf277bb4e4df7a05ad2
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` を参照する。

## Risk

Risk: R2

Reason:
repository-local agent promptとモデル別routingを更新するdeveloper workflow docs change。既存Human Gate、Workflow State、merge gate、product runtime、schema、operator workflowは変更せず、測定済みのGPT-5.6誤読を既存契約の明確化として補正する。機械的merge guardは追加しない。

## Goal

Goal Invariant:

### 最小完了条件

- GPT-5.6 familyのCodex sessionが同じrepository実務契約を読み、frontier profileを既定としつつbalanced / high-throughput profileはtask-fit差分だけを参照できる。具体model slotとprofileの対応は`docs/AGENT_OPERATING_MANUAL.md` §3.4だけが所有する。
- `進めたい`、疲労、提案依頼を未決Human Gateの承認へ読み替えず、最初の未決Gate、選択肢、条件付き推奨を保つ。
- 個人用の応答人格や実験記録はpublic repositoryへ入れず、ignored root `AGENTS.override.md`からtracked `AGENTS.md`を明示的にloadした後にだけ追加できる。

### 失敗定義

- local overrideの有無で正本、承認境界、検証、停止点が変わる。
- frontier / balanced / high-throughput profileに同じ長文規則を複製し、profile文書がdriftする。
- 疲労への配慮が作業停止、検証省略、選択肢削除、Human Gate先取りに変わる。
- 個人用の応答人格、その固有rubric、会話出力、採点結果がtracked historyへ入る。

### 非目的

- GPT-5.6 API model string、reasoning effort、Pro、PTC、multi-agent runtime設定の変更。
- `docs/DEV_WORKFLOW.md`のphase、Human Gate、Ready、merge契約の変更。
- Claude / Fable / Sonnet / Opusの既存role policyやprompt profileの再設計。
- 個人用local override本文、固有人格名、固有評価ログのcommit。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。ACや証跡作業がGoal Invariantを前進させない場合は、Goalを置き換えず簡略化・defer・削除する。

## Scope

- `AGENTS.md`
  - GPT-5.6 family向け共通入口と、測定済みapproval-boundary補正を追加する。
  - canonical `Session Start`の既存step 1〜4を変更せず、step 5のtask-specific docs sub-routeとして、Codex/OpenAI sessionだけがmodel guidance indexをtask design docより先に読む条件付きroutingを追加する。runtime identityが不明なCodexはfrontier profileを既定とする。
- `.gitignore`
  - root exact `/AGENTS.override.md`をlocal-only instruction fileとしてignoreする。commentに個人用人格名を含めない。
- `docs/agent-guidance/`
  - index、GPT-5.6 shared guidance、frontier / balanced / high-throughputのslot-neutral差分profileを新設する。
  - shared guidanceはOpenAI公式GPT-5.6 guidanceからoutcome、autonomy、approval、tool routing、validation、long-run stateをrepository契約へ写像する。
  - profileはtask fit、capacity、推奨される役割というinformational差分だけを持つ。approval、autonomy、stop、validationを変更しない。
- `docs/AGENT_OPERATING_MANUAL.md`
  - §3.4 model slot表だけで現行実体とslot-neutral profileを対応付け、新しいagent-guidance indexへ辿れるようにする。
  - runtime/model選択とrepository prompt契約を分離する。
- `docs/decision-log.md`
  - shared operating contract、slot-neutral profile差分、local-only override境界をdurable decisionとして追加する。
- `docs/PROJECT_HANDOFF.md`と`docs/Plans.md`
  - 導入状況、generic canary、active packetを同期する。
- `docs/plans/test-matrices/2026-07-28-gpt56-agent-guidance-local-override.md`
  - shared promptとlocal loaderのstatic / fresh-session評価契約を定義する。
- `docs/agent-guidance/evals/decision-gate-fixture.md`
  - live `Plans.md`から独立した公開可能なsynthetic state、exact user inputs、required / forbidden categoryを固定する。
- local-only setup（tracked diff外）
  - ignored root `AGENTS.override.md`は冒頭でtracked `./AGENTS.md`を読み、そのSession Startとshared rulesを適用してからlocal personalityを重ねる。
  - extensionはphase、approval、validation、stop conditionを上書きしない。

## Non-scope

- local `AGENTS.override.md`本文、個人用人格名、固有rubric、会話出力、採点結果のtracked artifact化。
- `docs/research/2026-07-28-codex-sol-week-playbook.md`の期間限定assignment変更。
- wave 2 lane選定、Plan Packet起票、worktree作成。
- Codexアプリのglobal設定、`~/.codex`、`~/.claude`の変更。
- model別のreasoning effort、verbosity、価格、context limitの固定値をrepository promptへ埋め込むこと。
- profileごとにapproval、tool、validation、stop rulesを変えること。

## Acceptance Criteria

- `AGENTS.md`を読めば、GPT-5.6 familyのshared contractとslot-neutral profile routingへ到達できる。
- shared guidanceは同じ判断規律を一度だけ定義し、frontier / balanced / high-throughput profileはinformationalなtask-fit差分だけを持つ。
- 現行の具体model slotとprofile対応は`docs/AGENT_OPERATING_MANUAL.md` §3.4だけに置く。packet、dashboard、model guidance文書は対応関係を所有しない。
- runtime identityが明示される場合は§3.4の対応先profile、明示されないCodex/OpenAI sessionはfrontier profileへfallbackする。
- `進めたい` / `提案して` / 疲労は未決Human Gateの選択ではないこと、冒頭要約でもGateを狭めないことが明記される。
- profileはapproval、autonomy、stop、validationを追加・削除・上書きしない。
- `/AGENTS.override.md`がroot exactでignoreされ、`git ls-files`に存在しない。
- local overrideの冒頭loaderはtracked `./AGENTS.md`とcanonical Session Startを先に適用し、local extensionの優先順位をその下に固定する。
- overrideなしはtracked `AGENTS.md`へ安全にfallbackする。
- Codex-managed worktreeは公式仕様のignored override copyを利用できる。手動git worktreeは自動copyを前提にせず、overrideなしを安全な既定とする。
- generic canaryはcontrol / local-extension双方で同じshared contractとloader形を使い、実務品質と任意の応答品質を別々に評価する。固有promptと結果はlocal-onlyに留める。
- synthetic fixtureはcontext / user input / required / forbidden categoryを逐語固定する。S1 / S2は各条件3 fresh run、S3はS2出力の再採点、S4 / S5は各条件1 fresh runとし、全run required充足・forbidden 0をPASS条件とする。
- `bash scripts/doc-consistency-check.sh --target plan`、実装後の`bash scripts/doc-consistency-check.sh`、`bash scripts/check-env-safety.sh`がPASSする。

## Design Sources

- Requirements / spec: not applicable
- Architecture: not applicable
- Function / command / DTO: not applicable
- DB: not applicable
- Screen / UI: not applicable
- Decision log / ADR: `docs/decision-log.md` D-034 / D-038 / D-055 / D-056、新規決定
- Agent workflow: `AGENTS.md`、`docs/DEV_WORKFLOW.md`、`docs/AGENT_OPERATING_MANUAL.md`
- External current guidance: OpenAI `Using GPT-5.6` / `Prompting guidance for GPT-5.6 Sol` / Codex manual `Custom instructions with AGENTS.md`（2026-07-28取得）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | none | intentionally deferred: runtime非接触 |
| Command / DTO / generated binding / wire shape | none | intentionally deferred: wire非接触 |
| DB / transaction / audit / rollback / migration | none | intentionally deferred: DB非接触 |
| Screen / UI / route state / Japanese wording | none | intentionally deferred: product UI非接触 |
| CSV / TSV / report / import / export format | none | intentionally deferred: file contract非接触 |
| Durable decision / ADR | `docs/decision-log.md`新規決定 | updated in this PR |
| Agent prompt / model routing | `AGENTS.md` / `docs/agent-guidance/**` / `docs/AGENT_OPERATING_MANUAL.md` | updated in this PR |
| Local-only boundary | `.gitignore` / local `AGENTS.override.md` loader contract | tracked ignore + local-only verification |
| Generic evaluation fixture | `docs/agent-guidance/evals/decision-gate-fixture.md` | updated in this PR |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| source / workflow doc新設 | `AGENTS.md`と`docs/AGENT_OPERATING_MANUAL.md`からindexへ到達可能にし、全relative linkをdocs checkで検証する |
| root local instruction override | `.gitignore`のroot exact entry、非tracked確認、base `AGENTS.md` loader確認、手動worktreeのsafe fallback確認 |
| agent eval fixture新設 | agent-guidance indexからeval目的とlocal-only evidence境界へ到達可能にする |

その他のTauri command、function-design、REQ coverage、route、operator画面の登録・生成義務は該当なし。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| AGENT56-D1 | OpenAI GPT-5.6 `Simplify prompts first` / `Define autonomy and approval boundaries` | 新規決定 Shared Contract | local personalityだけに補正を置くとbaselineが境界を失い比較も交絡する | `AGENTS.md` / shared guidance | TDM S1-S5 |
| AGENT56-D2 | OpenAI GPT-5.6 family model guidance / D-034 model-neutral role mapping | 新規決定 Slot-neutral Profile Delta | familyは同じprompt形式。具体model slotとprofileの対応は§3.4だけが所有し、profileはslot-neutralなtask fitだけを持つ | index / shared / 3 profiles / operating manual §3.4 | TDM V1-V5 |
| AGENT56-D3 | Codex manual `Custom instructions with AGENTS.md` | 新規決定 Local Override | root overrideはtracked AGENTSを置換するため、base loaderなしではcanonical rulesが消える | `.gitignore` / local loader | TDM L1-L6 |
| AGENT56-D4 | 2026-07-28 fresh-session canary | 新規決定 Controlled Evaluation | local extension側だけにshared補正を置く比較は因果を分離できない | generic Matrix / local-only evidence | TDM E1-E4 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。新規decisionとagent-guidance indexへ昇格する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: shared contract / slot-neutral profile差分 / local override / controlled evaluationをdecision-logへ昇格する。
- Assumptions and constraints: GPT-5.6 familyは同じdocumented prompt format。具体model slotとprofileの対応は§3.4だけ、profileはslot-neutral。model固有のtask-behavior差は測定されていない。
- Deferred design gaps, risk, and follow-up target: model固有prompt差は、同一evalで固有の回帰を測定し、D-034のmodel-neutral方針を再裁定した場合だけ追加する。
- Test Design Matrix can cite design decision IDs or source doc sections: yes、AGENT56-D1〜D4。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: local extensionのdisableはshared guidance / workflow rulesを無効化しない。override欠落時はtracked AGENTSへfallbackする。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable: product adapter非接触 | none |
| Fact check / design decision split | applicable: OpenAI公式のfamily共通事項、Codex override precedence、repo固有補正を分離 | decision-log / agent-guidance |
| Lifecycle / retry | applicable: fresh session / compaction / resume / worktreeで同じ契約を復元 | shared guidance / Matrix |
| Operator workflow | not applicable: product operator非接触 | none |
| Replacement path | applicable: future model更新時は§3.4の具体model slot対応だけを更新し、slot-neutral profileはtask role変更時だけ更新 | index / operating manual |
| Data safety / evidence | applicable: local personality、固有prompt、会話出力、採点をcommitしない | `.gitignore` / local-only evidence |
| Reporting / accounting semantics | not applicable | none |
| Manual verification | applicable: generic blind fresh-session eval | Test Design Matrix |

## Design Readiness

- Existing design docs are sufficient because: D-034 / D-038がcanonical reading orderとprompt重複回避、D-055がHuman Gate、D-056がmodel-role separationを定義済み。
- Source docs updated in this PR: `AGENTS.md`、agent-guidance、operating manual、decision-log、handoff。
- Design gaps intentionally deferred: model固有prompt差は公式に存在せず、測定とD-034再裁定まで追加しない。
- Durable decisions discovered in this plan and promoted to source docs: shared contract / slot-neutral profile差分 / local override / controlled evaluation。
- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): not applicable。
- Backend function design: not applicable。
- Command / DTO / data contract: not applicable。
- Persistence / transaction / audit impact: none。
- Operator workflow / Japanese UI wording: none。
- Error, empty, retry, and recovery behavior: guidance / override欠落時は上位契約を推測せず、tracked AGENTS fallbackまたは欠落報告を行う。
- Testability and traceability IDs: AGENT56-D1〜D4 / TDM S・V・L・E series。

## Contract Probe

- N/A: R2 docs-only。OpenAI / Codex公式docsを2026-07-28に取得済みで、model別prompt構文があるとは主張しない。

## Test Plan

- Test Design Matrix: `docs/plans/test-matrices/2026-07-28-gpt56-agent-guidance-local-override.md`
- targeted tests: `bash scripts/doc-consistency-check.sh --target plan`、実装後`bash scripts/doc-consistency-check.sh`、`bash scripts/check-env-safety.sh`
- negative tests: shared Human Gate補正削除、frontier fallback削除、profileからapproval上書き、base AGENTS loader削除をgeneric oracleで検出する。
- compatibility checks: Claude側既存`CLAUDE.md`とrole mappingを変更しない。runtime identity不明のCodexはfrontierへfallbackする。manual git worktreeはoverrideなしで安全に動く。
- data safety checks:
  - `git check-ignore -v AGENTS.override.md`、`git ls-files --error-unmatch AGENTS.override.md`が非trackedを示す。
  - publish候補baseは`git merge-base main HEAD`、finalは検証時HEADとしてPR bodyだけに記録する。
  - private denylistはsynthetic sentinelとは別に実private tokenを1件以上含める。実private token数とsentinelの存在を別々に確認し、scannerがsentinelを検出することを先に実証してから本走査する。
  - base..finalのcommit subject / body / trailerと、range内各commitの全tracked text blobを無出力走査する。changed binary / unscannable blobは0件を要求し、存在時はfail-closedで個別確認する。
  - 外部記録はbase SHA / final SHA / denylist非空 / sentinel kill / metadata hits 0 / tracked text hits 0 / binary-unscannable 0だけ。denylist内容はtracked file、command output、PR bodyへ出さない。
- main wiring/integration checks: canonical step 1〜4不変、step 5内で`AGENTS.md -> docs/agent-guidance/README.md -> shared + slot-neutral profile -> task-specific design doc`のordered anchorを確認する。local overrideはその外側で`./AGENTS.md`を先に読む。

## Boundary / Wire Contract

Not applicable。API、config、manifest、runtime model selectionは変更しない。

## Review Focus

- 既存Human Gateのclarificationを越えて新しいGateを作っていないか。
- shared guidanceとslot-neutral profileに同じ判断規律が重複していないか。
- 具体model slotとprofileの対応が§3.4以外へ増殖していないか。profileが公式にないtask-behavior差やprompt構文を創作していないか。
- root overrideの置換性を踏まえ、base AGENTSを確実に読むloaderになっているか。
- local extensionがworkflow rulesを上書きできる穴になっていないか。
- local personality名、固有prompt、出力、採点がtracked artifactやcommit historyに残っていないか。

## Spec Contract

R2のためnot applicable。

## Trace Matrix

R2のためnot applicable。Design Intent TraceとTest Design Matrixを使用する。

## Data Safety

- local personality名、固有prompt、会話出力、採点、secret、credential、個人情報はcommitしない。
- ignored root overrideとprivate denylistはlocal-onlyで、tracked diff、commit metadata、PR body、review commentへ内容を出さない。
- publish候補rangeはcommit metadata、各commitのtracked text blob、binary / unscannable blob有無まで検査する。scannerはsentinelを除く実private token 1件以上とsynthetic sentinelを別々に確認し、sentinelで事前に感度を実証する。
- 公開証跡はSHA、PASS、hit countだけとし、denylist tokenやlocal file本文を含めない。

## Implementation Results

- root `AGENTS.md` step 5へCodex/OpenAI条件付きrouteと判断・approval boundaryを追加した。既存step 1〜4は不変。
- `docs/agent-guidance/`にfamily shared contract、slot-neutral 3 profile、extension-neutralなexact decision-gate fixtureを新設した。
- 具体model slotとprofileの対応は`docs/AGENT_OPERATING_MANUAL.md` §3.4だけに追加し、D-057と`docs/PROJECT_HANDOFF.md`へ設計意図を同期した。
- root exact `/AGENTS.override.md`と`/.codex/*.local.denylist`をignoreし、local override / private denylistはtracked diffから分離した。
- fresh-session regressionで疲労を実質判断へ混ぜるshared failureとbase loader未実行を検出し、疲労をpresentation metadataへ限定、第一文のGate明示、filesystem実読loaderへ補正した。blind再採点はPASS、prompt / output / scoreはlocal-onlyを維持した。
- publish-boundary auditはPASS。Final Reviewはこの時点では未実施。

## Review Response

- Findings Freeze: not yet frozen; R2のためBroad Audit必須ではない。
- Plan Gate round 1（2026-07-28、旧local commit `5df0d89`）: P1×2 / P2×2 / P3×1。ownerの非公開方針を受け、tracked local-personality/research案を全撤回。root override precedence、worktree boundary、profile shared ownership、generic eval oracleをPlanへ追加し、旧commitはremote push前にsanitize/amendする。
- Plan Gate round 2（2026-07-28、sanitized commit `f0ec78c`）: P1=0 / P2×3 / P3=0。D-034と具体モデルprofileの衝突、exact fixture不足、branch history audit不足をaccept。profileをslot-neutral化し、§3.4だけが具体モデル対応を所有、Matrix fixtureとlocal denylist history auditを追加する。
- Plan Gate round 3（2026-07-28、commit `9d96f84`）: P1×2 / P2×2 / P3×1。synthetic context / loader / run / blind順の固定不足、history auditのmetadata/blob/binary/感度不足、§3.4単一所有drift、Session Start内位置固定不足をaccept。step 5 sub-route、公開fixture、range全体監査へ改訂する。
- Plan Gate round 4（2026-07-28、commit `7a2dbcf`）: P1×1。synthetic sentinel単独でdenylistの非空条件を満たせる監査空疎化をaccept。sentinelを除く実private token 1件以上を独立条件へ改訂する。
- Plan Gate round 5（2026-07-28、plan-first commit `6b60eb5`）: P1=0 / P2=0 / P3=0。独立fresh Plan Reviewerがexact fixture所有、loader/run/blind順、publish-boundary audit、§3.4単一所有、Session Start step 5 sub-routeを再確認し、Plan Gate PASS。`plan-draft -> plan-gate -> plan-approved -> implementing`をstate-onlyでmaterializeする。
- Local verification（2026-07-28）: docs / env / workflow / Rust / frontend / generated / traceabilityを含むL1 full PASS。npm auditは既存warn-only gateとして報告され、tree / HEAD不変を確認。fresh-session blind regressionとpublish-boundary auditもPASSし、`implementing -> local-verified`をcontent commitにmaterializeする。
- Final Review（2026-07-28、Reviewed Content HEAD `e21c7cb965b7f94f9d91acf277bb4e4df7a05ad2`）: 独立fresh Final ReviewerがP1=0 / P2=0 / P3=1でPASS。P3はImplementation Results内の「publish-boundary audit / Final Review未実施」が後段のLocal verification記録と時系列不明瞭だった点で、前者はPASS済み・後者だけが当時未実施と明確化した。tracked公開境界、§3.4の具体model mapping単一所有、Session Start step 5 sub-route、override precedence / base loader、decision-gate fixture、疲労補正、Plan / Matrix整合を再確認し、`local-verified -> independent-review -> human-confirm`をstate-onlyでmaterializeする。
- Owner Ready（2026-07-28、介入1/3）: ownerがReady / mergeを承認。Draft PR #31上で`human-confirm -> ready-hosted-final`をstate-onlyでmaterializeし、このexact HEADにL1 fullとrequired hosted finalを揃えてから追加commitなしでmergeする。
