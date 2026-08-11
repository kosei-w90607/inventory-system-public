# Plan Packet: npm 依存 audit 是正 change B（総点検・逐次更新・npm 12 採否）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: a0fb1df
- Amendments: 51a0424（Amendment 1: step 1 へ tsx 名指し更新を追加、owner 承認 介入 2/3）/ 2c5ee75（Amendment 2: orphan 削除許容 + 共有 tree ownership 宣言、owner 追認は merge 承認に bundle）
- Coordinator: Fable (Claude Fable 5, main thread)
- Writer: Codex (GPT-5.6, owner relay 経由)
- Plan Reviewer: 独立 Sonnet subagent（fresh context、Writer と別 vendor、D-062 (c)）
- Final Reviewer: 独立 Sonnet subagent（fresh context、Writer と別 vendor）
- Reviewed Content HEAD: 18e8f71
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: PR merge の owner 実操作（Ready 化 + merge click）のみ / L3 なし（Ready・merge・npm CLI 12 採用・Amendment 2 追認は 2026-08-12 介入 3/3 bundle で承認済み）

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2
- Plan Review round 天井: 3（既定 3）

decision point の計上設計: plan 承認（1 回目）/ PR merge 承認 + npm CLI 12 採否の bundle（2 回目）の計 2 回を基本とし、予備 1 回を rally disposition・Amendment 承認に充てる。

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者可視に何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
依存更新は build / lint / docs gate / CI install 経路を横断する（owner 判定 2026-08-12）。markdownlint-cli2 の 0.22 -> 0.23 更新は docs gate の挙動に影響し得る。さらに 2026-08-04 の Shai-Hulud 供給網攻撃（keyv 系、正規 provenance 付き悪性 publish）の直後であり、更新作業そのものが侵害 version を引き込むリスク管理を要する。

## Goal

Goal Invariant: `npm audit` の既知 7 脆弱性（high 3 / moderate 3 / low 1）が 0 になり、D-030 常設ガード（`ignore-scripts=true` / `min-release-age=7` / 名指し更新のみ）を一切緩めずに Issue #45 が close される。

### 最小完了条件

- `npm audit --json` の `metadata.vulnerabilities.total` が 0（PR merge 後）
- Issue #45 が monitor の clean 判定（exit 0）で close される
- npm CLI 12 の採否が decision-log に記録される（採用・見送りどちらでも可。採否自体が完了条件であり、採用は条件でない）

### 失敗定義

- 2026-08-04 攻撃窓（Shai-Hulud wave）の publish version、またはその他の侵害 version が lockfile に混入する
- 常設ガード（`.npmrc` の 2 行）が変更・迂回される
- audit 残存のまま Issue #45 を手動 close する

### 非目的

- runtime dependencies（React / Tauri / TanStack 等 18 件）の版上げ（audit 対象外であり触れない）
- pnpm 等への package manager 移行（D-029 で却下済み）
- npm-security-monitor の大改修（運用評価と記録のみ）
- keyv / cacheable / flat-cache / file-entry-cache / flatted の更新（eslint 経由の旧安定版 pin を維持。Shai-Hulud 直撃系統のため明示除外）

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

単一 PR で実装する（1 packet = 1 PR、squash merge 前提）。PR 内を 2 step に分け、step 1 完了時点の中間 evidence を PR body に記録する:

- **Step 1（名指し transitive 更新、lockfile-only）**: `npm update brace-expansion nanoid postcss esbuild tsx`（tsx は gated Amendment 1 で追加 — esbuild は tsx@4.21.0 の `~0.27.0` pin と dedupe 共有されており、tsx を 4.22.0 以上（`~0.28.0` 系列、親 range `^4.19.2` 内）へ更新しないと 0.28.1 に到達しない）。
  期待解消: brace-expansion high ×2 advisory（1 系 -> 1.1.18 / 5 系 -> 5.0.9）、nanoid high（-> 3.3.17 以上）、postcss moderate（-> 8.5.23 以上）、esbuild low（-> 0.28.1 以上、tsx -> 4.22.0 以上を同時解決）。
  中間確認: step 1 直後に `npm audit --json` で `high: 1, moderate: 2, low: 0, total: 3`（js-yaml / markdown-it / markdownlint-cli2 のみ残存。markdownlint-cli2@0.22.1 の pin により in-range 解決不可、audit `fixAvailable` 実測より）となることを実測し、`metadata.vulnerabilities` を PR body に転記する。step 1 完了時点で commit を切り、その commit SHA を PR body に記録する — 独立 reviewer が squash merge 前に当該 SHA を checkout して `npm audit --json` を再実行し、転記の実在を検証できるようにする。
- **Step 2（markdownlint-cli2 更新 + npm 12 採否）**: `npm install markdownlint-cli2@0.23.2 --save-dev --save-exact`（0.22.1 -> 0.23.2、semver-major 相当）。transitive の js-yaml -> 4.3.1 以上（advisory 3 件全充足には 4.3.1 が必要）・markdown-it -> 14.2.0 以上を解消し audit 0 化。changelog（0.23.0〜0.23.2）実読と docs gate 全 corpus 通過で breaking 検分。@eslint/eslintrc 側の dedupe された js-yaml も同時に 4.3.1 以上へ更新されることを `npm ls js-yaml` で確認。npm CLI 12 採否の decision-log 追記と `docs/DEV_SETUP_CHECKLIST.md` 追随（採用時）も step 2 に含める。docs gate の新規違反が docs 修正で吸収不能と判明した場合の撤退経路: step 2 の package.json / lockfile 変更のみを revert して step 1 のみの縮小完了とし、縮小自体は本 packet の gated Amendment（D-039、Amendments 行へ SHA append）として記録して owner に諮る。markdownlint-cli2 更新の再開（audit 0 化・Issue #45 close の Goal Invariant 達成を含む）は本 packet close 後の新規 Plan Packet として Plans.md backlog に起票し、本 packet の Plans.md entry には Goal Invariant 未達である旨を明記する。`.markdownlint*` 設定の緩和による fix-forward 強行はしない。
- **GHSA-g7cv-rxg3-hmpx 再評価**: 実測（2026-08-12: `withdrawn_at: null`、active 継続）に基づき `WATCHED_ADVISORIES` 維持。本 packet への記録のみで script 変更なし。
- **Issue #45 消化**: PR merge 後に `npm-security-monitor.yml` を `workflow_dispatch` し、exit 0 -> 自動 close を確認。monitor 運用は現状維持（weekly + manual、D-033。high+critical のみ通知は仕様であり moderate 非通知は欠陥でない）と評価を記録。
- **供給網検分規律（両 step 共通の実装契約）**: lockfile diff の全変更 package について (a) 本 packet の期待リスト内であること (b) resolved version の publish 日を `npm view <pkg> time` で実測し、2026-08-04 攻撃窓以降の publish は個別に正当性を検分して PR body に記録すること (c) 期待リスト内 package の更新に随伴して orphan 化した transitive の**削除**行は許容し、削除である旨と orphan 化の根拠（旧親の依存廃止）を検分表に記載すること（gated Amendment 2。実例 = tsx@4.23.5 の get-tsconfig 依存廃止による get-tsconfig@4.14.0 / resolve-pkg-maps@1.0.0 の削除、Coordinator が他依存元なしを `npm ls` + lockfile 全文検索で独立検証済み）。
- **共有 tree 運用の ownership 宣言（実測で判明した実態の追認、gated Amendment 2）**: Writer は Coordinator と同一 working tree で作業している。非重複 file ownership — Writer: package.json / package-lock.json / docs/decision-log.md、Coordinator: docs/plans/* / docs/Plans.md。commit は明示パス add のみとし、commit 直前に `git diff --cached --name-only` で staged 集合の完全一致を検分する。`git reset --hard` / `git checkout` による tree 復元操作は相互の未 commit 変更を破壊するため、実行前に相手方の作業状態確認を必須とする。

## Non-scope

- runtime dependencies の更新、eslint / typescript-eslint / vite / vitest 等 devDep 親自体の版上げ（audit 解消に不要な範囲）
- keyv 系 5 package の更新（非目的に同じ、明示除外）
- `min-release-age-exclude[]` の追加（owner 明示承認必須事項、本 change では使わない）
- npm-security-monitor script / workflow の変更
- CI runner 側 npm の版固定（npm 12 採用時も CI は Node 24 同梱 npm 11 系のまま。lockfile 互換性は step 2 の npm 12 検分項目で確認し、CI 側変更は必要が実証された場合の follow-up とする）

## Acceptance Criteria

- AC-1: step 1 完了時点で `npm audit --json` が `high: 1, moderate: 2, low: 0, total: 3`。evidence: PR body の step 1 中間記録（`metadata.vulnerabilities` 転記 + step 1 commit SHA。squash 前に当該 SHA を checkout した独立再実行で検証可能）
- AC-2: PR 最終 HEAD で `npm audit --json` の `total: 0`（`metadata` field の存在を伴う）。evidence: PR body の audit 出力
- AC-3: lockfile diff の変更 package 一覧（`git diff main -- package-lock.json` から抽出）が本 packet の期待リストと一致し、各 resolved version の publish 日が `npm view <pkg> time` 実測で PR body の検分表に記録される。2026-08-04 以降 publish の version を採る場合は個別検分理由が併記される。evidence: PR body の検分表（`npm view` 出力 + 抽出 package 一覧の突合）
- AC-4: `.npmrc` は PR で diff に現れない（`git diff --name-only main` に `.npmrc` が含まれない）。evidence: PR diff
- AC-5: step 2 で docs gate（markdownlint）が L1 full で green。新規違反が出た場合は rule 側の意図的変更を確認のうえ docs 修正で吸収し、`.markdownlint*` 設定の緩和で逃げない。evidence: L1 evidence log の docs gate PASS
- AC-6: npm CLI 12 の採否が decision-log に D 番号付きで記録される（採用時は `docs/DEV_SETUP_CHECKLIST.md` も追随）。evidence: decision-log entry
- AC-7: merge 後の monitor `workflow_dispatch` が exit 0 で完走し、Issue #45 が close される。evidence: workflow run URL + issue state CLOSED
- AC-8: PR 最終 HEAD で `bash scripts/local-ci.sh full` が green（HEAD 一致 SHA と evidence log の RESULT 行は PR body に記録）。evidence: PR body の L1 SHA + `.local/ci-evidence/` の RESULT 行

## Design Sources

- Requirements / spec: `CLAUDE.md`「npm 供給網防御ルール」（常設ガード・禁止操作・逐次投入手順）
- Architecture: 該当なし（アプリ層コード変更なし）
- Function / command / DTO: 該当なし
- DB: 該当なし
- Screen / UI: 該当なし
- Decision log / ADR: D-019（npm 継続 + scripts block）/ D-029（min-release-age、allowScripts は npm 11.16+/v12 で評価）/ D-030（凍結解除・常設ガード移行）/ D-033（monitor weekly 化）/ D-062（計画規律・別 vendor reviewer）/ D-065（rally 天井・修正案必須ほか）

## Required Design Artifacts

Use `docs/DEV_WORKFLOW.md` Design artifact selection to decide what must exist before implementation.

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 該当なし | — |
| Command / DTO / generated binding / wire shape | 該当なし | — |
| DB / transaction / audit / rollback / migration | 該当なし | — |
| Screen / UI / route state / Japanese wording | 該当なし | — |
| CSV / TSV / report / import / export format | 該当なし | — |
| Durable decision / ADR | decision-log（npm 12 採否 + change B 実施記録） | updated in this PR (step 2) |

## Registration / Generation Obligations

該当なし（新規 command / doc / REQ / route / 画面の追加なし。decision-log は既存 doc への追記）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-NPM-B-1 | CLAUDE.md 逐次投入手順 | D-030 | `npm audit fix --force` は禁止。名指し `npm update` 4 package で in-range 解決（PR #41 change A と同型） | step 1 lockfile diff | audit 中間内訳 AC-1 |
| SPEC-NPM-B-2 | CLAUDE.md 逐次投入手順 | D-030 | js-yaml 3 advisory は markdownlint-cli2 pin により in-range 不可。親の名指し版上げ（0.23.2、publish 07-27 で cooldown 満了）を採る。設定緩和・fork・audit 例外化は却下 | step 2 package.json + lockfile | audit 0 化 AC-2 / docs gate AC-5 |
| SPEC-NPM-B-3 | 本 packet 供給網検分規律 | B-D1 | Shai-Hulud（08-04）侵害 version は cooldown 7 日を既に経過し min-release-age では防げない。publish 日実測 + 期待リスト照合を lockfile diff review に義務付け。keyv 系は更新自体を禁止 | PR body 検分表 | AC-3 / matrix FM-1 |
| SPEC-NPM-B-4 | D-029 残課題 | B-D2 | allowScripts 評価は npm 12 で native 化（allowScripts / --allow-git / --allow-remote 既定 off）。採否判断のみ本 change の完了条件とし、採用実施は owner 判断に従う | decision-log + DEV_SETUP_CHECKLIST | AC-6 |
| SPEC-NPM-B-5 | monitor 運用（D-033） | B-D3 | audit 0 化後の monitor clean 判定で Issue #45 を自動 close（手動 close は失敗定義）。運用は現状維持 | workflow_dispatch 実行 | AC-7 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes（CLAUDE.md 防御ルール + decision-log + 本 packet）
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: npm 12 採否と change B 実施記録を decision-log へ昇格（step 2）
- Assumptions and constraints: registry 到達可能な環境で実装する（Contract Probe 参照）。実装日が進むと min-release-age の解決点が変わり得るため、期待 version は「以上」で規定し実測で固定する
- Deferred design gaps, risk, and follow-up target: CI 側 npm の版差（local 12 / CI 11）は step 2 検分で互換性確認のみ行い、pin は follow-up
- Test Design Matrix can cite design decision IDs or source doc sections: yes（B-D1〜B-D3 / SPEC-NPM-B-*）
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: 例外は「08-04 以降 publish version の個別検分採用」のみで、AC-3 が検分記録を強制する

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable（アプリ層変更なし） | — |
| Fact check / design decision split | audit 内訳・publish 日・GHSA 状態は全て 2026-08-12 実測（Contract Probe） | 本 packet |
| Lifecycle / retry | monitor は weekly cron + dispatch。close は clean 判定経由のみ | AC-7 |
| Operator workflow | not applicable（利用者可視の変更なし） | — |
| Replacement path | markdownlint-cli2 0.22 -> 0.23 は挙動変化があり得る。changelog 実読 + docs gate 全 corpus で検分 | AC-5 / matrix FM-3 |
| Data safety / evidence | lockfile diff 検分表と publish 日実測を PR body に記録 | AC-3 |
| Reporting / accounting semantics | not applicable | — |
| Manual verification | .npmrc 不変・keyv 系不変は diff review でのみ担保（自動 gate なし）。AC-4 と matrix FM-2 で明示 | PR review checklist |
| 環境・再現性 | local npm 12 採用時、CI は npm 11 系のまま。lockfileVersion 互換を step 2 で検分し、非互換なら採用見送り or follow-up | AC-6 / decision-log |

環境・再現性 lens: 新設の環境依存（toolchain / CI runner / OS 差異等）は repo-pinned config で強制するか、明示的に defer するかを記録する。Node 24 `.node-version` single-owner pin の教訓（`docs/archive/plans/2026-07-30-node24-toolchain-alignment.md`）を参照。

## Design Readiness

- Existing design docs are sufficient because: 変更対象は依存 metadata（package.json / package-lock.json）と decision-log のみで、アプリ設計書に触れない
- Source docs updated in this PR: decision-log（npm 12 採否、change B 記録）、採用時 DEV_SETUP_CHECKLIST
- Design gaps intentionally deferred: CI 側 npm 版 pin
- Durable decisions discovered in this plan and promoted to source docs: Shai-Hulud 後の「lockfile diff publish 日検分」規律は本 change で運用し、定着判断は WER で扱う

Minimum design checks for business-app work: いずれも該当なし（Layer / function / DTO / persistence / operator UI / error path / traceability に変更なし）。

## Contract Probe

実測日 2026-08-12（Coordinator 実測）:

- `npm audit --json` 到達・実測: total 7（high 3: brace-expansion / js-yaml / nanoid、moderate 3: markdown-it / markdownlint-cli2 / postcss、low 1: esbuild）。L1 evidence log（08-12 full）とも件数一致
- 修正目標 version の publish 日（すべて min-release-age=7 満了かつ 08-04 攻撃窓より前）: brace-expansion 1.1.18 / 5.0.9 = 07-30、nanoid 3.3.17 = 08-03、postcss 8.5.25 = 07-29（8.5.23 fix、8.5.26 は 08-06 で cooldown 中）、esbuild 0.28.1 = 06-11、markdownlint-cli2 0.23.2 = 07-27、npm 12.0.2 = 07-29
- GHSA-g7cv-rxg3-hmpx: `withdrawn_at: null`、active 継続（`gh api /advisories/`）
- keyv 系 lockfile 現況: keyv@4.5.4 / flat-cache@4.0.1 / file-entry-cache@8.0.0 / flatted@3.4.2（eslint@9.39.4 経由の旧安定版 pin、08-04 wave 非該当）。keyv 系 4 package の registry 最新版はいずれも 08-04 publish で攻撃窓と一致し、更新禁止の根拠
- 9 GHSA 全件を `gh api /advisories/` で実読: 全件通常の DoS / 情報漏えい系（malware 混入 advisory なし）、全件 devDep transitive のみで runtime 影響なし
- 未実測（step 2 実装時に Writer が確認）: markdownlint-cli2@0.23.2 の依存 range が js-yaml 4.3.1 以上 / markdown-it 14.2.0 以上を解決すること（`npm view markdownlint-cli2@0.23.2 dependencies` + install 後 `npm ls`）
- esbuild 経路の実測（2026-08-12、Writer step 1 初回実行の停止報告を受けた Coordinator 追加実測 = gated Amendment 1 の根拠）: vite@7.3.6 の esbuild range は `^0.27.0 || ^0.28.0` で 0.28.1 を許容。ブロッカーは tsx@4.21.0 の `~0.27.0` pin（esbuild を dedupe 共有）。tsx は 4.22.0 で `~0.28.0` へ切替済み、親 range は `@tanstack/router-generator@1.166.32` の `^4.19.2` で 4.23 系まで許容。cooldown 適合の解決候補は tsx 4.23.5（08-02 publish、Shai-Hulud 窓より前）近辺、esbuild は 0.28.2（08-08）が cooldown 中のため 0.28.1（06-11 publish）

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-030 常設ガード維持（.npmrc 2 行不変） | PR diff | なし（gate 未整備） | PR diff review で AC-4 を人的確認 |
| D-030 名指し更新のみ | step 1 / step 2 実装コマンド | なし | PR body のコマンド記録 + lockfile diff 期待リスト照合（AC-3） |
| SPEC-NPM-B-1 audit 部分解消（step 1 後 total 3） | step 1 lockfile | `npm audit --json` 内訳（AC-1） | — |
| SPEC-NPM-B-2 audit 0 化（step 2 後） | step 2 package.json + lockfile | `npm audit --json` total 0（AC-2） | — |
| B-D1 攻撃窓 version 排除・keyv 系不変 | lockfile diff | なし | 検分表（AC-3）+ diff review で keyv 系不在確認 |
| AC-5 docs gate green（markdownlint 0.23 系） | step 2 | L1 full docs gate | — |
| B-D2 npm 12 採否記録 | decision-log / DEV_SETUP_CHECKLIST | なし（PR review で D 番号・Decision/Status/Why/Impact 必須項目を人的確認） | owner 採否判断 |
| B-D3 Issue #45 clean close | monitor dispatch | workflow run exit 0 | issue state CLOSED を owner / Coordinator 確認 |

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-08-12-npm-audit-remediation-b.md`

- targeted tests: `npm audit --json` 内訳照合（step 1 後の中間 / 最終 HEAD）、`npm ls js-yaml brace-expansion nanoid postcss esbuild tsx markdown-it` の解決 version 確認
- negative tests: `npm audit --audit-level=high` の exit code（step 1 後は非 0 = js-yaml 残存を正しく検出、最終 HEAD では 0。最終 oracle は `--json` total を正とする）
- compatibility checks: step 2 の docs gate 全 corpus、`npm ci --ignore-scripts` の再現 install 成功、npm 12 検分（採用時 lockfileVersion 互換）
- data safety checks: PR body に token / 個人情報を含めない。`.local/ci-evidence/` は local-only
- main wiring/integration checks: PR 最終 HEAD で L1 full（typecheck / lint / format / test / build / docs gate）green — 依存更新が build 経路に実際に載ることの確認

## Boundary / Wire Contract

- producer: npm CLI（lockfile 生成。local npm 11.16.0、npm 12 採用時は 12.0.2）
- consumer: `npm ci --ignore-scripts`（local L1 / hosted CI、CI は Node 24 同梱 npm 11 系）
- wire type: package-lock.json（lockfileVersion 3）
- internal type: 該当なし
- precision/range: 該当なし
- round-trip path: install -> lockfile -> `npm ci` 再現 install
- invalid input: 侵害 version 混入は publish 日検分（AC-3）で排除
- compatibility: npm 12 で lockfile を書き換える場合、npm 11 系 `npm ci` での再現可否を step 2 で検分（非互換なら npm 12 採用を見送り or CI 側 follow-up）

## Review Focus

- lockfile diff の全行が期待リスト（step 1: brace-expansion ×2 系統 / nanoid / postcss / esbuild / tsx、step 2: markdownlint-cli2 / js-yaml / markdown-it とその内部依存）に収まっているか。想定外の package 混入・keyv 系の変動は P1
- publish 日検分表の網羅性（diff に現れた全 package が載っているか）
- markdownlint-cli2 0.23 系の挙動変化が docs gate 設定の緩和で吸収されていないか（AC-5）
- 常設ガード・禁止操作（D-030）への抵触がないか

## Spec Contract

Contract ID: SPEC-NPM-B

- SPEC-NPM-B-1: step 1 は名指し 4 package の in-range 更新のみで、audit を high 1 / moderate 2 / low 0 の中間状態に減らす
- SPEC-NPM-B-2: step 2 は markdownlint-cli2@0.23.2 の exact pin 更新で audit を 0 にする（js-yaml は 4.3.1 以上、markdown-it は 14.2.0 以上に解決）
- SPEC-NPM-B-3: PR の lockfile diff は期待リスト内に収まり、全変更 version の publish 日が実測記録される。keyv / cacheable / flat-cache / file-entry-cache / flatted は変化しない
- SPEC-NPM-B-4: npm CLI 12 の採否が decision-log に記録される
- SPEC-NPM-B-5: Issue #45 は monitor の clean 判定でのみ close される

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-NPM-B-1 | step 1 | audit 中間内訳照合（AC-1） | 期待リスト外の diff | PR body（step 1 中間記録） |
| SPEC-NPM-B-2 | step 2 | audit total 0（AC-2）+ docs gate（AC-5） | 設定緩和の有無 | PR body + L1 log |
| SPEC-NPM-B-3 | step 1 / 2 共通 | 検分表（AC-3）+ .npmrc 不変（AC-4） | keyv 系不変・publish 日網羅 | PR body 検分表 |
| SPEC-NPM-B-4 | step 2 同乗 | PR review（AC-6） | 採否理由の妥当性 | decision-log |
| SPEC-NPM-B-5 | merge 後 | workflow run exit 0（AC-7） | 手動 close していないこと | run URL + issue state |

## Data Safety

- PR body / packet に GitHub token・registry token・個人情報を書かない
- `.local/ci-evidence/` は local-only（従来どおり commit しない）
- synthetic データ該当なし（fixture 不要の change）

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Plan Gate rally round 1（独立 Sonnet、2026-08-12）: P1 ×2 / P2 ×3 / P3 ×1 — 全件 accept。P1-2 / P2-2 / P3-1 は 2 PR 構成を単一 PR + 2 step 構成へ再設計して根治（1 packet = 1 PR、PK5 ancestry・decision point 計上を同時解消）。P1-1 は Plans.md 進行中 entry 追加、P2-1 は非実在 gate 引用を人的確認へ訂正、P2-3 は AC-3 / AC-8 へ観測 token 追加。是正後に `bash scripts/doc-consistency-check.sh --target plan` ERROR/WARN 0 を再実測。

Plan Gate rally round 2（独立 Sonnet fresh context、2026-08-12）: P1 ×0 / P2 ×2 / P3 ×0 — 全件 accept。P2-1 は step 1 中間 evidence へ commit SHA アンカー追加（squash 前の独立再実行検証を可能化）、P2-2 は docs gate 恒久 fail 時の撤退経路（step 2 revert + 縮小完了 + follow-up Amendment 化）を Scope / Negative Paths に明記。round 2 は `npm audit --json`（total 7 一致）・package-lock.json 現況・`gh api /advisories/` 2 件・`gh issue view 45`（OPEN）・`scripts/npm-security-monitor.sh` 実装・`.npmrc` の 6 系統を reviewer が独立再実測し、packet 記述との一致を確認済み。是正後に `bash scripts/doc-consistency-check.sh --target plan` を再実行して通過を確認。

Plan Gate rally round 3（独立 Sonnet fresh context、2026-08-12、天井到達）: P1 ×0 / P2 ×1 / P3 ×0。round 2 是正 2 件の三点一貫性・Contract Probe 実測値（`npm audit --json` total 7 / Issue #45 OPEN / GHSA-g7cv-rxg3-hmpx active）の独立再実測一致・`bash scripts/doc-consistency-check.sh --target plan` 通過を確認。P2 ×1（撤退経路の Amendment 語が D-039 gated amendment と新規作業を混同）は D-065 disposition = 同型指摘の一括是正として即時反映: 縮小 = 本 packet の gated Amendment / markdownlint-cli2 再開 = 新規 Plan Packet 起票、に分離。rally は天井 3 round で終結し、次 round は開始しない。

遷移 evidence（compression 記録、append-only）: plan-draft -> plan-gate = packet + matrix の内容 commit 完了（`5edb149` 起草、`962cd98` / `62c95fd` / `a0fb1df` rally 是正）と rally 天井 3 round の P1/P2 = 0 終結（本節 round 1〜3 記録）。plan-gate -> plan-approved = owner plan 承認（2026-08-12、介入 1/3、AskUserQuestion 応答「承認する」）。plan-approved -> implementing = 承認済み plan の Codex Writer 発注開始。Plan Commit = `a0fb1df`（承認対象の packet 内容 HEAD）。

追加遷移 evidence（compression 記録、append-only）: implementing -> local-verified = Writer 実装 3 commit（step 1 / step 2 / step 3）+ 最終 HEAD の L1 full PASS（PR #71 body の evidence log 参照、末尾 RESULT=PASS / MERGE_EVIDENCE_VALID=true）。local-verified -> independent-review = 独立 Sonnet Final Reviewer による R3 Contract Audit 実施（下記 Final Review 記録）。

Final Review（独立 Sonnet fresh context、2026-08-12）: P1 ×0 / P2 ×2 / P3 ×1 — 全件 accept。監査は Ledger 8 行照合・AC 全数実測（step 1 SHA checkout 独立再現、step 2 コマンド単独再現実験で js-yaml 残存を実証）・供給網監査（keyv 系 byte 一致、orphan 削除根拠、publish 日 8 件独立再測、45 エントリ網羅突合）・発注外コマンド監査（`npm update js-yaml` = D-030 名指し適合・副作用なし・未開示のみ問題）。是正: P2-1 = PR body 検分表 before 列を Coordinator が lockfile before/after 機械抽出（45 エントリ、reviewer 独立パースと一致）で差し替え。P2-2 = PR body に実行コマンド全量（`npm update js-yaml` 含む）を追記。P3-1 = Plans.md entry の stale label 是正。after 値・publish 日・網羅性・セキュリティ判定（攻撃窓混入なし）は全件不変。

Final Review 是正確認（同 reviewer 継続 context、2026-08-12、read-only）: P2-1 / P2-2 / P3-1 全件 closed（検分表全行が reviewer 独立パースと一致、コマンド記録が実測機序と一致、Plans.md label 同期確認）。新規 finding なし。P1/P2 = 0 確定 — independent-review -> human-confirm の遷移根拠。Reviewed Content HEAD = `18e8f71`（監査対象の product content HEAD。以後の docs 追記 commit は product content を変更しない）。

If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
