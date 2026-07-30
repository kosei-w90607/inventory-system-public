# Test Design Matrix — D-058 Fable slot 不在編成の相談窓口役

## Risk

Risk: R3（workflow gate change）

## Contracts Under Test

- SPEC-WF-D058-2026-07-30 D1〜D6。
- D-056のread-only claims-producer、Coordinator / Writer / state遷移禁止、§5.4低制約profile 5点。
- DEV_WORKFLOW `Subagent Budget`のper-risk / wave合計 / depth 1 / one-writerとload-bearing decisionの直接読解。

## Failure Modes

- Fable稼働編成またはcodex-onlyでも§5.5を使える。
- consultation roleが発注書を起草・修正し、そのまま投入する。
- ownerが貼った本文を原本扱いし、tracked artifact / immutable ref / Coordinator帰属を確認せず投入する。
- 観点指摘がレビュー対象選定・優先順位・最終裁定へ昇格する。
- 「必要な数」が数値capを代替し、target change budgetを越える。
- consultation roleの子がsubagentを再生成する、またはwrite taskを実行する。
- main-thread配置がCoordinator / state / merge権限として読まれる。
- Fable復帰後も未dispatch remainderまたは新規subagentを生成する。
- D-056 / DEV_WORKFLOWを同時改変して整合したように見せる。

## Anchor Phrase Contract

実装後は各anchorが対象fileで一意にhitする。baseline hit / uniquenessと実装後結果はPR bodyへ記録する。

| ID | Anchor phrase | Target |
|---|---|---|
| A1 | `Fable slot 不在編成では §5.5 の相談窓口役を兼ねる（D-058）` | Manual §3 |
| A2 | `### 5.5 相談窓口役（Fable slot 不在編成のみ）` | Manual §5.5 |
| A3 | `Execution Mode が \`dual-vendor-no-fable\` の場合に限る` | Manual §5.5 |
| A4 | `owner が relay した immutable order ref` | Manual §5.5 |
| A5 | `発注書の起草 / 改変 / 指揮判断` | Manual §5.5 |
| A6 | `Coordinator が数値の subagent 生成上限を明記した場合だけ` | Manual §5.4 item 5 |
| A7 | `DEV_WORKFLOW の \`Subagent Budget\` へ算入する` | Manual §5.5 |
| A8 | `生成する subagent も read-only` | Manual §5.5 |
| A9 | `Coordinator が tracked order artifact を再作成し owner が新しい ref を relay` | Manual §5.5 |
| A10 | `main-thread への配置は Coordinator 権限を与えない` | Manual §5.5 |
| A11 | `Fable slot が復帰した後は新規 subagent を生成しない` | Manual §5.5 |
| A12 | `助言限定へ rollback する` | decision-log D-058 |
| A13 | `git show <commit>:<path>` | Manual §5.5 |
| A14 | `git merge-base --is-ancestor <commit> HEAD` | Manual §5.5 |
| A15 | `未 dispatch remainder は取り消す` | Manual §5.5 |

Assertion:

```bash
rg -F '<anchor phrase>' docs/AGENT_OPERATING_MANUAL.md docs/decision-log.md
```

各anchorは該当targetでexit 0・単一hit。cross-reference追加で複数hitになる場合は、定義anchorと参照anchorを別literalにして弁別する。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| D1 activation | Fable有無を問わず有効 | docs contract | A1〜A3 + X1/X8 | mode限定またはFable禁止が消える |
| D2 allowed duties | relayが指揮へ昇格 | policy | A4/A5/A10 + X2/X4 | 起草・改変・最終権限の禁止が消える |
| D3 provenance | owner提示なら何でも投入 | fail-fast | A4/A9/A13/A14 + X3/X9/X11 | tracked原本 / Coordinator作成 / 再relayが不要になる |
| D4 bounded cap | 「必要な数」で無界 | boundary | A6/A7 + X5/X6 | numeric capまたはexisting budget接続が消える |
| D5 read-only inheritance | 子がwrite / depth 2 | policy | A8 + N2 + X7 | child read-onlyまたはdepth契約が消える |
| D6 recovery | Fable復帰後も投入 | state/policy | A11/A12/A15 + X8/X10/X12 | 新規投入停止、remainder取消、rollbackが消える |
| D-056 compatibility | Coordinator代役化 | regression | N1/N3〜N6 + G1〜G9 | 既存禁止・profile・§2 / §3.1〜§3.4が変わる |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| §5.5 eligibility | `dual-vendor-no-fable` + exact orderなし | owner relay待ち | exact order + numeric capを検査 | Fable復帰 / mode変更 | N/A | 初回dogfood後 | 新sessionでもmode再判定 | mode不一致 | eligible modeでCoordinator再発行 | A1〜A3/A11 |
| order relay | target Packetがpath宣言、Coordinatorがtracked artifactをcommit | ownerがSHA + pathをrelay | HEAD ancestry / declared path / Packet Coordinator / target content / cap検査後に`git show`原本をchildへ投入 | 観点指摘で変更必要 | Coordinatorへ戻す | D-058 revisit | 新orderは新commit ref | ref不正 / non-ancestor / undeclared path / blobなし / Packet復元不能 / cap欠落 / write scope | Coordinator再commit + owner新ref relay | A4/A6/A8/A9/A13/A14 |
| result handling | raw child findings | consultation role集約 | 判定材料をCoordinatorへ返す | N/A | Coordinatorがsource直読 | findings裁定時 | session跨ぎはorder ID再確認 | roleが最終裁定 | Coordinatorが再検証 | A5/A10 |
| Fable復帰 | role active | child一部in-flight | 既存read-only結果だけ集約 | 未dispatch remainder取消 + 新規生成権失効 | N/A | D-058 Revisit | `fable-window`では無効 | 復帰後のremainder / 新規生成 | no retry in same formation | A3/A11/A15 |
| target Workflow State | target packetのcurrent phase | review結果待ち | Coordinatorだけがphase判断 | role権限なし | N/A | normal workflow | packetからresume | roleがstate編集 | Coordinatorへ返す | N1/N3 |
| D-058 PR | content candidate | L1 / Double Audit | state-only human-confirm | content changeでimplementingへ戻る | L1再実行 | post-merge dogfood | packet resume | state-only hunk違反 | normal backtrack | workflow-git |
| Ready/merge | owner authorization | Draft state-only Ready commit | exact-HEAD L1 -> PR body -> Ready -> explicit dispatch -> merge | Ready後pushは禁止 | Draftへ戻して再検証 | closeout | new HEADなら全証跡更新 | SHA不一致 / hosted fail | Draftでfix | PR evidence |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| D-056 role prohibition | Manual §3, §3.1〜§3.4, §5.4, §6 / decision-log D-056 / Handoff | §3参照 + §5.5 compatibility | §3.1〜§3.4は不変 | N1/N3/N4/N5 |
| Subagent Budget | DEV_WORKFLOW Wave Operation / Subagent Budget / Owner Effort | §5.4 item 5 + §5.5 reference only | 数値の複製はdriftするため不採用 | A6/A7/N2 |
| owner relay boundary | Manual §3.4「ownerを伝書鳩にしない」 | D-058でもownerはrepository evidenceのimmutable refだけをrelay | 発注書本文の手作業転送は不採用 | A4/A13/A14 |
| capacity-degraded | Manual §3.3 | Fable復帰 / mode変更時の停止 | reviewer代替規則は不変 | A3/A11/N1 |

## Negative Paths

- missing input: immutable ref、Packet宣言path、tracked artifact、Packet Coordinator、target content SHA、numeric capのいずれか欠落 -> 投入しない。
- invalid input: capが非整数・負数・budget超過 -> 投入しない。
- duplicate/ambiguous input: relay本文とref blobが併記されてもref blobだけを原本とし、不一致本文は無視して報告する。
- unknown reference: commitがHEAD非ancestor、pathがPacket宣言と不一致、path/blobまたは同commitのPacket不存在、Risk / stageを識別できない -> 投入しない。
- dependency missing: eligibleなSonnet child枠がない -> 待機し、上限を緩和しない。
- permission/write failure: write scopeを含むorder -> §5.5対象外としてCoordinatorへ返す。
- dry-run side effect: 観点指摘だけの相談でsubagent生成・file編集・state操作をしない。

## Boundary Checks

- threshold: numeric cap <= target Risk / stage ceiling。
- null/default: §5.4既定0。明示capなしは0のまま。
- empty/non-empty: order空欄またはscope空欄はreject。
- min/max: 0以上、DEV_WORKFLOW ceiling以下。
- status/policy enum: `dual-vendor-no-fable`のみeligible。
- wire type: immutable `<40-hex commit SHA>:<repo-relative path>` ref。target Packetがpath / Coordinatorを所有し、参照blobの§5.4 scope境界がtarget content / Risk / stage、item 5がnumeric capを持つ。
- internal type: read-only task payload。
- producer/consumer: Coordinator -> owner relay -> consultation role -> read-only child。
- round-trip token: commit SHA / Packet宣言path / target content SHA / branchまたはPR / Packet Coordinator / Risk / stage / cap。
- precision/range: integer、曖昧語「必要な数」は不可。
- cross-language parse: N/A。

## Compatibility Checks

- old schema/input: D-056 §5.4 orderはcap既定0のまま有効。
- new schema/input: §5.5 orderだけ、tracked refの検証と明示numeric capにより0を置換可能。
- output order: child outputsは集約しても最終Verdictへ変換しない。
- optional field behavior: provenance / cap / target metadataはoptionalではない。

## Data Safety Checks

- source-derived data: N/A。
- generated outputs: N/A。
- secrets: prompt / review outputへsecretを含めない。
- local-only files: `.local/ci-evidence/`非commit。
- synthetic sample boundaries: wording mutationのみ、real data非接触。

## Main Wiring / Integration Checks

- helper connected to main path: Manual §3 -> §5.5、§5.4 item 5 -> §5.5、decision-log D-058 -> Manual、immutable ref -> `git show`原本取得の4接続。
- output reaches manifest/report: Plans / PROJECT_HANDOFFがactive decisionへ同期。
- effective config reaches runtime: N/A（docs contract）。
- CLI arg reaches implementation: numeric capのruntime実運用はfirst dogfoodで確認。

## Mutation-style Adequacy Questions

- X1: A1のFable不在条件を削除するとA1がredになるか。
- X2: A5の禁止権限文を削除するとA5がredになるか。
- X3: immutable ref原本をowner貼付本文へ戻すとA4/A13がredになるか。
- X4: A10のno-Coordinator文を削除するとA10がredになるか。
- X5: numeric capを「必要な数」へ戻すとA6がredになるか。
- X6: budget算入文を削除するとA7がredになるか。
- X7: child read-only文を削除するとA8がredになるか。
- X8: Fable復帰後の新規生成禁止を削除するとA11がredになるか。これはactivation boundary D1とrecovery D6を同じmutationで守る意図的二重被覆。
- X9: Coordinator再commit + owner新ref relayを相談窓口の自己修正へ変えるとA9がredになるか。
- X10: D-058 rollback文を削除するとA12がredになるか。
- X11: `git merge-base --is-ancestor <commit> HEAD`検査を削除するとA14がredになるか。
- X12: Fable復帰後も未dispatch remainderを投入可能にするとA15がredになるか。

実測はimplementation commit後のclean treeで1 mutationずつ行い、red -> `git restore` -> green -> cleanを確認する。exact commandと結果はPR bodyへ置く。

## Invariant Guards

```bash
# N1: DEV_WORKFLOW / ci / scripts / workflowは不変
git diff --quiet origin/main -- docs/DEV_WORKFLOW.md docs/ci.md scripts/ .github/

# N2: depth 1 / one-writer / wave total契約は正本に残る
rg -F 'Max delegation depth is 1' docs/DEV_WORKFLOW.md
rg -F 'One-writer rule' docs/DEV_WORKFLOW.md
rg -F '全 lane 合算の同時 subagent 上限は 4' docs/DEV_WORKFLOW.md

# N3: editableな§3本体でもD-056のread-only / no Coordinator / no Writer境界は残る
rg -F 'read-only の Reviewer / Explorer 発注書ロール専任' docs/AGENT_OPERATING_MANUAL.md
rg -F 'Writer / Coordinator / state 遷移管理に割り当てない' docs/AGENT_OPERATING_MANUAL.md

# N4: §5.4の5点構成と過程指示禁止は残る
rg -F '次の 5 点のみで構成し' docs/AGENT_OPERATING_MANUAL.md
rg -F '過程指示・検証手順の指定を書かない' docs/AGENT_OPERATING_MANUAL.md

# N5: §3.4 model slot対応表sectionはbyte不変
diff -u <(git show origin/main:docs/AGENT_OPERATING_MANUAL.md | sed -n '/^### 3\.4 /,/^### 3\.5 /p') <(sed -n '/^### 3\.4 /,/^### 3\.5 /p' docs/AGENT_OPERATING_MANUAL.md)

# N6: Non-scopeの§2 / §3.1 / §3.2 / §3.3は各section byte不変
diff -u <(git show origin/main:docs/AGENT_OPERATING_MANUAL.md | sed -n '/^## 2\. /,/^## 3\. /p') <(sed -n '/^## 2\. /,/^## 3\. /p' docs/AGENT_OPERATING_MANUAL.md)
diff -u <(git show origin/main:docs/AGENT_OPERATING_MANUAL.md | sed -n '/^### 3\.1 /,/^### 3\.2 /p') <(sed -n '/^### 3\.1 /,/^### 3\.2 /p' docs/AGENT_OPERATING_MANUAL.md)
diff -u <(git show origin/main:docs/AGENT_OPERATING_MANUAL.md | sed -n '/^### 3\.2 /,/^### 3\.3 /p') <(sed -n '/^### 3\.2 /,/^### 3\.3 /p' docs/AGENT_OPERATING_MANUAL.md)
diff -u <(git show origin/main:docs/AGENT_OPERATING_MANUAL.md | sed -n '/^### 3\.3 /,/^### 3\.4 /p') <(sed -n '/^### 3\.3 /,/^### 3\.4 /p' docs/AGENT_OPERATING_MANUAL.md)
```

N5/N6はMarkdown見出しでsection本文を抽出してbyte比較する。diff hunk見出しやcontext推測には依存しない。

## Guard Sensitivity

| Guard ID | Mutation | Expected red |
|---|---|---|
| G1 | DEV_WORKFLOWへ無害な1行追加 | N1 non-zero |
| G2 | `Max delegation depth is 1`削除 | N2該当anchor exit 1 |
| G3 | D-056 read-only文削除 | N3 exit 1 |
| G4 | §5.4過程指示禁止文削除 | N4 exit 1 |
| G5 | §3.4 Opus rowの現行実体を変更 | N5 non-zero |
| G6 | §2 Coordinator role rowを変更 | N6 §2 non-zero |
| G7 | §3.1 design board例外を変更 | N6 §3.1 non-zero |
| G8 | §3.2 `dual-vendor-no-fable`定義を変更 | N6 §3.2 non-zero |
| G9 | §3.3 phase前進禁止を変更 | N6 §3.3 non-zero |

## Existing Checkers

```bash
bash scripts/doc-consistency-check.sh
bash scripts/doc-consistency-check.sh --target plan
bash scripts/check-workflow-git.sh
git diff --check
```

## Residual Test Gaps

- tracked ref方式はblob一致を機械検証できるが、git author名だけでCoordinator本人性を証明しない。target PacketのCoordinator fieldとorder artifactのCoordinator fieldを照合し、load-bearing裁定は既存どおりCoordinatorがsourceを直接読む。
- Fable復帰を自動検出するruntime hookはない。Plan Packet Execution Modeとsession kickoff確認による運用gate。
- 相談窓口がowner負荷を実際に減らすかは本docs changeでは未実証。最初のeligible review orderをdogfood targetにし、owner terminal数、relay回数、権限越境の有無をWERで評価する。
