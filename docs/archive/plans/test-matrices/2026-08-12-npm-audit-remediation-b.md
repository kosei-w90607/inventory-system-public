# Test Design Matrix: npm 依存 audit 是正 change B

## Risk

Risk: R3

## Contracts Under Test

- SPEC-NPM-B-1: step 1（名指し 4 package 更新）で audit が high 1 / moderate 2 / low 0 の中間状態に減る
- SPEC-NPM-B-2: step 2（markdownlint-cli2@0.23.2 exact pin）で audit total 0（js-yaml >= 4.3.1、markdown-it >= 14.2.0）
- SPEC-NPM-B-3: lockfile diff は期待リスト内のみ、全変更 version の publish 日実測記録、keyv 系 5 package 不変
- SPEC-NPM-B-4: npm CLI 12 採否の decision-log 記録
- SPEC-NPM-B-5: Issue #45 は monitor clean 判定でのみ close
- AC-4: `.npmrc`（`ignore-scripts=true` / `min-release-age=7`）が PR の diff に現れない
- AC-5: step 2 後の docs gate green を設定緩和なしで達成

## Failure Modes

- FM-1: 更新解決が 2026-08-04 攻撃窓以降の侵害 version を拾う（cooldown 7 日は既に経過しており min-release-age では防げない）
- FM-2: `npm update` の名指し漏れ・波及で期待リスト外の package（特に keyv 系）が lockfile で変動する
- FM-3: markdownlint-cli2 0.23 系の rule 挙動変化で docs gate が fail し、`.markdownlint*` 設定の緩和で「解決」してしまう
- FM-4: js-yaml が 4.3.0 / 4.2.0 止まりで解決され、advisory 3 件のうち GHSA-5p4m-2wfm-xmqj（fix 4.3.1）が残存するのに audit 確認を `--audit-level=high` のみで済ませて見逃す
- FM-5: esbuild が vite / tsx の range 制約で 0.28.1 に届かず low が残存する
- FM-6: audit 残存のまま Issue #45 を手動 close する
- FM-7: npm 12 で lockfile を書き換え、CI（npm 11 系）の `npm ci` が非互換で fail する
- FM-8: brace-expansion が 1.1.17 止まりで解決され GHSA-rgw5-rvv9-x895（fix 1.1.18）が残存する

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-NPM-B-1 | FM-2 / FM-5 / FM-8 | CLI | `npm audit --json` 内訳照合（step 1 後、期待: high 1 / moderate 2 / low 0 / total 3） | 名指し更新が効いていない、または期待外の解消・残存がある |
| SPEC-NPM-B-1 | FM-2 | review/evidence | step 1 commit SHA 照合: PR body 記録の SHA を squash 前に checkout し `npm audit --json` を独立再実行して total 3 を再現 | Writer の転記が実状態と乖離している（自己申告のみで検証不能） |
| SPEC-NPM-B-2 | FM-4 / FM-5 | CLI | `npm audit --json` で `total: 0`（PR 最終 HEAD。`--audit-level=high` の exit code ではなく total を oracle にする） | js-yaml 4.3.1 未満 / markdown-it 14.2.0 未満 / esbuild 未達で残存する |
| SPEC-NPM-B-2 | FM-4 | CLI | `npm ls js-yaml markdown-it` で解決 version を実表示し PR body に転記 | dedupe された @eslint/eslintrc 側 js-yaml が旧版のまま残る |
| SPEC-NPM-B-3 | FM-1 | review/evidence | PR body 検分表: lockfile diff の全変更 package × `npm view <pkg> time` publish 日 | diff に現れた package が検分表に載っていない、または 08-04 以降 publish が無検分で採用される |
| SPEC-NPM-B-3 | FM-2 | CLI + review | `git diff main -- package-lock.json` の変更 package 抽出と期待リスト照合、`rg '"node_modules/(keyv|cacheable|flat-cache|file-entry-cache|flatted)"' -A 2` の before/after 一致 | keyv 系または期待外 package が変動している |
| AC-4 | — | CLI | `git diff --name-only main` に `.npmrc` が含まれない | 常設ガードが変更されている |
| AC-5 | FM-3 | integration | L1 full の docs gate PASS + `git diff --name-only main` に `.markdownlint*` が含まれない（docs 本文の修正は可） | rule 緩和で fail を隠している |
| SPEC-NPM-B-1/2 共通 | FM-7 | integration | PR 最終 HEAD の L1 full frontend-install（`npm ci --ignore-scripts`）成功 | lockfile が再現 install 不能・script 実行に依存 |
| SPEC-NPM-B-4 | — | review | PR review: decision-log D 番号形式 + Decision/Status/Why/Impact 必須項目の目視確認 | D 番号・形式不備 |
| SPEC-NPM-B-5 | FM-6 | CLI | merge 後 `gh workflow run npm-security-monitor.yml` -> run exit 0 -> `gh issue view 45 --json state` = CLOSED | 手動 close された、または audit 残存で monitor が exit 1 を返す |

## State Lifecycle Matrix

UI / data / cache / route 状態を持たない change のため、対象は lockfile と workflow-state のみ。

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| package-lock.json | main の 7 vuln 状態 | step 1 / step 2 の branch 更新 | step 1（total 3 中間実測）-> step 2（total 0）-> merge | 期待外 diff 発見 | `git restore` + 名指し再実行 | `npm ci` 再現 install | clean tree から再 update | 侵害 version 混入 | lockfile 復元後に対象を絞って再実行 | PR diff + 検分表 |
| Issue #45 | OPEN（high 3 報告済み） | merge 待ち | monitor exit 0 で CLOSED | 新規 advisory 出現で再 OPEN | 週次 cron | — | — | monitor exit 2（check 失敗） | dispatch 再実行 | run URL + issue state |

For workflow-state changes, add explicit rows for: 本 change は workflow-state contract を変更しないため該当なし。通常の phase 遷移（content candidate -> L1 / independent review -> state-only human-confirm commit -> Ready -> merge 三点一致）は DEV_WORKFLOW の標準経路に従う。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| PR #41「change A」名指し transitive 更新手順（D-030 逐次投入） | `docs/archive/plans/2026-07-05-npm-policy-d030-sequential-installs.md` / Plans.md backlog 節 | step 1 の update コマンドと lockfile diff review | change A に無かった publish 日検分（B-D1）を追加 — Shai-Hulud 08-04 以後は cooldown 通過済み侵害 version があり得るため | AC-3 検分表 |
| npm-security-monitor の clean close 経路 | `.github/workflows/npm-security-monitor.yml` / `scripts/npm-security-monitor.sh` | merge 後 dispatch（SPEC-NPM-B-5） | script 本体の変更は non-scope | run URL |

## Negative Paths

- missing input: 期待 version が registry から削除されていた場合 -> `npm view` で確認し、代替 version の publish 日検分のうえ packet Amendment
- invalid input: 侵害疑い version（08-04 以降 publish で正当性不明）-> 採用せず、in-range のより古い fix version に固定
- duplicate/ambiguous input: brace-expansion は 2 系統（1.x / 5.x）が別 node_modules に存在 -> `npm ls brace-expansion` で両系統の解決を個別確認
- unknown reference: audit が新規 advisory を報告した場合（実装日ずれで出現し得る）-> scope 追加せず packet Amendment で扱いを決める
- dependency missing: `npm ci --ignore-scripts` fail -> lockfile 巻き戻し
- docs gate 恒久 fail（markdownlint-cli2 0.23 系の rule 変化を docs 修正で吸収不能）: step 2 の package.json / lockfile 変更のみ revert -> step 1 縮小完了（縮小は本 packet の gated Amendment として記録し owner 裁定へ）。markdownlint-cli2 更新の再開は新規 Plan Packet として backlog 起票し、本 packet の Plans.md entry に Goal Invariant 未達を明記（設定緩和での強行禁止）
- permission/write failure: registry 不達（sandbox）-> 実装環境を owner relay（Codex 側）に切替
- dry-run side effect: audit / view / ls は read-only。update は branch 上でのみ実行

## Boundary Checks

- threshold: min-release-age=7 の境界 — nanoid 3.3.18（08-07）、postcss 8.5.26（08-06）、esbuild 0.28.2（08-08）は 08-12 時点 cooldown 中。実装日に解決点が変わるため、oracle は「fix version 以上 + publish 日検分」とし特定 version に固定しない
- null/default: 該当なし
- empty/non-empty: audit total 0 は「空」を期待する oracle — step 1 後の非空（total 3）照合と対にして、audit 実行自体の失敗を 0 と誤認しない（`metadata` field の存在確認を伴う）
- min/max: js-yaml >= 4.3.1 / markdown-it >= 14.2.0 / brace-expansion >= 1.1.18（1 系）・>= 5.0.9（5 系）/ esbuild >= 0.28.1 / postcss >= 8.5.23 / tsx >= 4.22.0（gated Amendment 1）
- status/policy enum: Issue state OPEN -> CLOSED、monitor exit 0/1/2 の区別（exit 2 は close 根拠にならない）
- wire type: lockfileVersion 3 維持
- internal type / producer/consumer / round-trip token / precision/range / cross-language parse: packet の Boundary / Wire Contract 節参照（npm 11/12 互換）

## Compatibility Checks

- old schema/input: 更新後 lockfile を npm 11.16.0 の `npm ci --ignore-scripts` で再現 install（L1 frontend-install が兼ねる）
- new schema/input: npm 12 採用時のみ、npm 12 での `npm ci` と lockfile 差分ゼロ確認
- output order: lockfile の並びは npm が管理（手編集しない）
- optional field behavior: 該当なし

## Data Safety Checks

- source-derived data: 該当なし
- generated outputs: lockfile は npm 生成のみ（手編集禁止）
- secrets: PR body / 検分表に token を書かない
- local-only files: `.local/ci-evidence/`
- synthetic sample boundaries: 該当なし

## Main Wiring / Integration Checks

- helper connected to main path: 更新された transitive が実際に build/lint/test 経路で使われることを L1 full green で確認
- output reaches manifest/report: audit 出力 / 検分表が PR body に到達
- effective config reaches runtime: `.npmrc` が install 時に有効（`npm config get ignore-scripts` = true を step 1 実装冒頭で確認）
- CLI arg reaches implementation: 該当なし

## Mutation-style Adequacy Questions

- If a guard is removed（`.npmrc` から `min-release-age=7` を落とす）: AC-4 の `git diff --name-only` 照合が fail する（自動 gate はないため PR review checklist 上の必須確認とする）
- If a threshold comparison changes（audit oracle を `--audit-level=high` exit code だけにする）: FM-4 のとおり moderate 残存を見逃す — matrix は `--json` total を oracle に固定済み
- If a key branch is inverted（monitor exit 2 を clean 扱いで close）: SPEC-NPM-B-5 の「exit 0 のみ close 根拠」照合が fail する
- If an output field is omitted（検分表から diff 内の 1 package を落とす）: AC-3 の「diff 全 package × 検分表」突合が fail する
- If a mock value...: 該当なし（mock 不使用）
- If invalidate/refetch changes...: lockfile 巻き戻し経路は State Lifecycle Matrix の Refetch/Retry 行で規定
- workflow-state 系の質問（exact-HEAD / state-only commit / hosted headSha）: 標準経路のまま、本 change 固有の変更なし

## Residual Test Gaps

- `.npmrc` 不変と keyv 系不変を機械強制する gate は未整備（diff review の人的確認に依存）。定着させる価値があるかは change B の WER で判断
- 侵害 version 検出は publish 日 heuristic + 期待リスト照合であり、registry 側 metadata の改竄までは検出できない（provenance も Shai-Hulud で偽装実績があり信頼根拠にしない）
